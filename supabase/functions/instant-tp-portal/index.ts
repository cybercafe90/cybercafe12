import { checkRateLimit, serviceClient, verifyOwner } from '../_shared/auth.ts'
import { createTrackingReference, normalizeMobile, preflight, response } from '../_shared/http.ts'

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
const trackingPattern = /^BABA-[A-HJ-NP-Z2-9]{10}$/
const mobileFor = (value: unknown) => normalizeMobile(value)

async function audit(db: ReturnType<typeof serviceClient>, id: string, actor: string | null, action: string, details: Record<string, unknown> = {}) {
  const { error } = await db.from('instant_tp_audit_events').insert({ application_id: id, actor_id: actor, action, details })
  if (error) throw error
}
function publicRecord(row: Record<string, unknown>, policyUrl: string | null = null) {
  return {
    trackingId: row.tracking_id, customerName: row.customer_name, mobile: row.mobile,
    vehicleRegistration: row.vehicle_registration, vehicleMakeModel: row.vehicle_make_model,
    vehicleType: row.vehicle_type, quotedAmount: row.quoted_amount, insurerName: row.insurer_name,
    paymentStatus: row.payment_status, utr: row.utr, policyStatus: row.policy_status,
    policyNumber: row.policy_number, policyUrl, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}
Deno.serve(async (request: Request) => {
  const early = preflight(request); if (early) return early
  try {
    const db = serviceClient()
    const raw = await request.text()
    if (raw.length > 12_000_000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    if (body.action === 'create_application') {
      if (!await checkRateLimit(db, request, 'instant-tp-create', 'all', 5, 15)) return response(request, { error: 'Too many attempts. Please wait and try again.' }, 429)
      const customerName = clean(body.customerName, 120), mobile = mobileFor(body.mobile)
      const email = clean(body.email, 254).toLowerCase()
      const vehicleRegistration = clean(body.vehicleRegistration, 20).toUpperCase().replace(/[^A-Z0-9 -]/g, '')
      const vehicleMakeModel = clean(body.vehicleMakeModel, 120)
      const vehicleType = clean(body.vehicleType, 32)
      if (customerName.length < 2 || !mobile || vehicleRegistration.length < 4 || vehicleMakeModel.length < 2 ||
        !['private_car','two_wheeler','commercial_vehicle'].includes(vehicleType) ||
        (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return response(request, { error: 'Please enter valid customer, contact and vehicle details.' }, 400)
      }
      let saved: Record<string, unknown> | null = null
      for (let i = 0; i < 3 && !saved; i++) {
        const { data, error } = await db.from('instant_tp_applications').insert({
          tracking_id: createTrackingReference(), customer_name: customerName, mobile, email: email || null,
          vehicle_registration: vehicleRegistration, vehicle_make_model: vehicleMakeModel, vehicle_type: vehicleType,
        }).select('*').single()
        if (!error && data) saved = data
        else if (error?.code !== '23505') throw error ?? new Error('Could not save application.')
      }
      if (!saved) return response(request, { error: 'Could not create a tracking reference. Try again.' }, 503)
      await audit(db, String(saved.id), null, 'application_created')
      return response(request, { application: publicRecord(saved as Record<string, unknown>) }, 201, { 'Cache-Control': 'no-store' })
    }
    if (body.action === 'customer_lookup' || body.action === 'submit_utr') {
      if (!await checkRateLimit(db, request, 'instant-tp-customer', 'all', 12, 15)) return response(request, { error: 'Too many attempts. Please wait and try again.' }, 429)
      const trackingId = clean(body.trackingId, 24).toUpperCase(), mobile = mobileFor(body.mobile)
      if (!trackingPattern.test(trackingId) || !mobile) return response(request, { error: 'Enter your valid tracking ID and registered mobile number.' }, 400)
      const { data: row, error } = await db.from('instant_tp_applications').select('*').eq('tracking_id', trackingId).eq('mobile', mobile).maybeSingle()
      if (error) throw error
      if (!row) return response(request, { error: 'No matching application found. Check your tracking ID and mobile number.' }, 404)
      if (body.action === 'submit_utr') {
        const utr = clean(body.utr, 12)
        if (!/^\d{12}$/.test(utr)) return response(request, { error: 'Enter a valid 12-digit UTR.' }, 400)
        if (!row.quoted_amount || Number(row.quoted_amount) <= 0) return response(request, { error: 'Your payable amount is not ready yet. Please contact our insurance desk.' }, 409)
        if (row.payment_status === 'paid') return response(request, { error: 'Payment is already marked Paid.' }, 409)
        const { error: updateError } = await db.from('instant_tp_applications').update({ utr, payment_status: 'under_verification', updated_at: new Date().toISOString() }).eq('id', row.id)
        if (updateError) throw updateError
        await audit(db, row.id, null, 'utr_submitted', { utrLast4: utr.slice(-4) })
        row.utr = utr; row.payment_status = 'under_verification'
      }
      let policyUrl: string | null = null
      if (row.policy_status === 'issued' && row.policy_storage_path) {
        const { data, error: signedError } = await db.storage.from('instant-tp-policies').createSignedUrl(row.policy_storage_path, 300, { download: true })
        if (!signedError) policyUrl = data.signedUrl
      }
      return response(request, { application: publicRecord(row, policyUrl) }, 200, { 'Cache-Control': 'no-store' })
    }
    const owner = await verifyOwner(request, db)
    if (body.action === 'admin_list') {
      const search = clean(body.search, 80)
      let query = db.from('instant_tp_applications').select('id,tracking_id,customer_name,mobile,email,vehicle_registration,vehicle_make_model,vehicle_type,quoted_amount,insurer_name,payment_status,utr,admin_note,policy_status,policy_number,created_at,updated_at').order('created_at', { ascending: false }).limit(100)
      if (search) query = query.or(`tracking_id.ilike.%${search}%,customer_name.ilike.%${search}%,mobile.ilike.%${search}%,vehicle_registration.ilike.%${search}%`)
      const { data, error } = await query
      if (error) throw error
      return response(request, { items: data ?? [] }, 200, { 'Cache-Control': 'no-store' })
    }
    if (body.action === 'admin_update_quote') {
      const id = clean(body.id, 40), amount = Number(body.quotedAmount), insurerName = clean(body.insurerName, 120), adminNote = clean(body.adminNote, 1000)
      if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isFinite(amount) || amount <= 0 || amount > 1000000 || insurerName.length < 2) return response(request, { error: 'Enter a valid payable amount and insurer.' }, 400)
      const { error } = await db.from('instant_tp_applications').update({ quoted_amount: amount, insurer_name: insurerName, admin_note: adminNote, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      await audit(db, id, owner.id, 'quote_updated', { quotedAmount: amount, insurerName })
      return response(request, { updated: true })
    }
    if (body.action === 'admin_verify_payment') {
      const id = clean(body.id, 40)
      if (!/^[0-9a-f-]{36}$/i.test(id)) return response(request, { error: 'Invalid application.' }, 400)
      const { data: row, error: getError } = await db.from('instant_tp_applications').select('payment_status,utr').eq('id', id).maybeSingle()
      if (getError) throw getError
      if (!row || row.payment_status !== 'under_verification' || !row.utr) return response(request, { error: 'A submitted UTR must be present before verification.' }, 409)
      const { error } = await db.from('instant_tp_applications').update({ payment_status: 'paid', payment_verified_by: owner.id, payment_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      await audit(db, id, owner.id, 'payment_verified_paid', { utrLast4: row.utr.slice(-4) })
      return response(request, { updated: true })
    }
    if (body.action === 'admin_issue_policy') {
      const id = clean(body.id, 40), policyNumber = clean(body.policyNumber, 100), base64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : ''
      if (!/^[0-9a-f-]{36}$/i.test(id) || policyNumber.length < 3 || base64.length < 100 || base64.length > 11_200_000) return response(request, { error: 'Provide a policy number and a PDF under 8 MB.' }, 400)
      const { data: row, error: getError } = await db.from('instant_tp_applications').select('payment_status,tracking_id').eq('id', id).maybeSingle()
      if (getError) throw getError
      if (!row || row.payment_status !== 'paid') return response(request, { error: 'Verify actual payment before issuing a policy.' }, 409)
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
      if (bytes.length > 8 * 1024 * 1024 || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') return response(request, { error: 'The uploaded file is not a valid PDF or exceeds 8 MB.' }, 400)
      const path = `${row.tracking_id}/${crypto.randomUUID()}.pdf`
      const { error: uploadError } = await db.storage.from('instant-tp-policies').upload(path, bytes, { contentType: 'application/pdf', upsert: false })
      if (uploadError) throw uploadError
      const { error } = await db.from('instant_tp_applications').update({ policy_number: policyNumber, policy_storage_path: path, policy_status: 'issued', policy_issued_by: owner.id, policy_issued_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      await audit(db, id, owner.id, 'policy_issued', { policyNumber })
      return response(request, { issued: true })
    }
    return response(request, { error: 'Unknown action.' }, 400)
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    const status = message.includes('Unauthorized') || message.includes('Owner sign-in') ? 401 : message.includes('Owner authorization') ? 403 : 500
    console.error('instant-tp-portal failed:', status, message.slice(0, 120))
    return response(request, { error: status === 401 ? 'Owner sign-in required.' : status === 403 ? 'Owner authorization required.' : 'The insurance request could not be processed right now.' }, status)
  }
})
