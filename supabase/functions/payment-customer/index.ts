import { checkRateLimit, serviceClient } from '../_shared/auth.ts'
import { normalizeMobile, preflight, response } from '../_shared/http.ts'

const validTracking = (value: unknown) => typeof value === 'string' && /^BABA-[A-Z0-9]{10}$/.test(value.trim().toUpperCase())
const validUtr = (value: unknown) => typeof value === 'string' && /^[0-9]{12}$/.test(value.trim())

async function getRecord(admin: ReturnType<typeof serviceClient>, trackingId: string, mobile: string) {
  const { data: app, error } = await admin.from('applications')
    .select('id, tracking_id, full_name, mobile, service_name, status, created_at')
    .eq('tracking_id', trackingId).eq('mobile', mobile).maybeSingle()
  if (error || !app) return null
  const { data: payment } = await admin.from('payment_orders')
    .select('id, amount, currency, status, claimed_utr, utr, paid_at, created_at, expires_at')
    .eq('application_id', app.id).maybeSingle()
  return { application: app, payment: payment ?? { id: undefined, amount: 0, currency: 'INR', status: 'pending', claimed_utr: null, utr: null, paid_at: null } }
}

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const raw = await request.text()
    if (raw.length > 3000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    const action = typeof body.action === 'string' ? body.action : ''
    const trackingId = validTracking(body.trackingId) ? body.trackingId.trim().toUpperCase() : ''
    const mobile = normalizeMobile(body.mobile)
    if (!trackingId || !mobile) return response(request, { error: 'We could not verify those details. Check the tracking ID and registered mobile number.' }, 404, { 'Cache-Control': 'no-store' })
    const admin = serviceClient()
    const ipLimit = action === 'status' ? 3000 : action === 'submit_confirmation' ? 30 : 60
    const referenceLimit = action === 'status' ? 300 : action === 'submit_confirmation' ? 4 : 8
    const [ipAllowed, referenceAllowed] = await Promise.all([
      checkRateLimit(admin, request, `payment-${action}-ip`, 'all', ipLimit, 15),
      checkRateLimit(admin, request, `payment-${action}-reference`, trackingId, referenceLimit, 15),
    ])
    if (!ipAllowed || !referenceAllowed) return response(request, { error: 'Too many payment lookups. Please wait and try again.' }, 429, { 'Cache-Control': 'no-store' })
    const record = await getRecord(admin, trackingId, mobile)
    if (!record) return response(request, { error: 'We could not verify those details. Check the tracking ID and registered mobile number.' }, 404, { 'Cache-Control': 'no-store' })

    if (action === 'lookup' || action === 'status') {
      return response(request, record, 200, { 'Cache-Control': 'no-store, private', 'Pragma': 'no-cache' })
    }
    if (action === 'submit_confirmation') {
      const utr = typeof body.utr === 'string' ? body.utr.trim() : ''
      if (!validUtr(utr)) return response(request, { error: 'Enter a valid 12-digit UPI reference number.' }, 400)
      const amount = Number(record.payment.amount ?? 0)
      if (amount <= 0) return response(request, { error: 'A payment amount has not been assigned yet.' }, 409)
      if (record.payment.status === 'paid') return response(request, { error: 'This payment is already marked as paid.' }, 409)
      if (record.payment.status !== 'pending') return response(request, { error: 'Your confirmation is already submitted and is awaiting verification.' }, 409)
      const { data, error } = await admin.from('payment_orders').update({
        status: 'claimed',
        claimed_utr: utr,
      }).eq('id', record.payment.id).eq('status', 'pending').select('id').maybeSingle()
      if (error || !data) return response(request, { error: 'This reference may already be submitted or the payment is being reviewed.' }, 409)
      await admin.from('payment_audit_events').insert({
        payment_id: record.payment.id,
        action: 'customer_submitted_utr',
        metadata: { claimed_utr: utr },
      })
      return response(request, { submitted: true, message: 'Your reference has been received. Payment will show as paid only after it is verified.' }, 200, { 'Cache-Control': 'no-store' })
    }
    return response(request, { error: 'Unsupported payment action.' }, 400)
  } catch (reason) {
    console.error('payment-customer failed:', reason instanceof Error ? reason.message.slice(0, 120) : 'unknown error')
    return response(request, { error: 'Payment details are temporarily unavailable.' }, 503, { 'Cache-Control': 'no-store' })
  }
})
