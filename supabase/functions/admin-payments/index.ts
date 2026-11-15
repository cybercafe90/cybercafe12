import { serviceClient, verifyOwner } from '../_shared/auth.ts'
import { createTrackingReference, normalizeMobile, preflight, response } from '../_shared/http.ts'


async function sendAssignedPaymentEmail(request: Request, to: string, trackingId: string, customerName: string, serviceName: string, amount: number) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) { console.error('Payment email skipped: RESEND_API_KEY is not configured.'); return false }
  const origin = request.headers.get('origin')
  const baseUrl = origin && /^https:\/\/[a-z0-9.-]+$/i.test(origin) ? origin : 'https://babacybercafe.in'
  const paymentUrl = `${baseUrl}/payment-portal?trackingId=${encodeURIComponent(trackingId)}`
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)
  const safeName = customerName.replace(/[<>]/g, '').slice(0, 120)
  const safeService = serviceName.replace(/[<>]/g, '').slice(0, 160)
  const html = `<!doctype html><html><body style="margin:0;background:#f5f2eb;font-family:Arial,sans-serif;color:#25231e"><div style="max-width:600px;margin:32px auto;padding:32px;background:#fff;border:1px solid #e7dfcf;border-radius:16px"><p style="letter-spacing:2px;color:#98763c;font-size:11px;font-weight:bold">BABA'S CYBER CAFE · SECURE PAYMENT</p><h1 style="font-size:26px">Payment link for your application</h1><p>Hello ${safeName},</p><p>An amount has been assigned for your ${safeService} application.</p><p style="font-size:30px;font-weight:bold;color:#98763c">${formattedAmount}</p><p>Tracking ID: <strong>${trackingId}</strong></p><p>Open the secure payment portal, then enter your registered mobile number to view and pay.</p><p style="margin:28px 0"><a href="${paymentUrl}" style="display:inline-block;padding:14px 22px;background:#b99450;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Open payment portal</a></p><p style="font-size:13px;color:#666">If you did not request this service, contact us at support@babacybercafe.in. Never share your UPI PIN, bank password or OTP.</p><p style="font-size:12px;color:#777">BABA'S CYBER CAFE · Srinagar, Jammu &amp; Kashmir</p></div></body></html>`
  const text = `Hello ${safeName}, an amount of ${formattedAmount} has been assigned for ${safeService}. Tracking ID: ${trackingId}. Open the payment portal: ${paymentUrl}. Enter your registered mobile number to continue. Never share your UPI PIN or OTP.`
  try {
    const sent = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: "BABA'S CYBER CAFE <support@babacybercafe.in>", to: [to], subject: `Payment link · ${trackingId}`, html, text, tags: [{ name: 'type', value: 'payment-link' }] }) })
    if (!sent.ok) { console.error('Resend payment email failed:', sent.status, (await sent.text()).slice(0, 250)); return false }
    return true
  } catch (error) { console.error('Resend payment email request failed:', error instanceof Error ? error.message.slice(0, 120) : 'unknown'); return false }
}

const validId = (value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const admin = serviceClient()
    const actor = await verifyOwner(request, admin)
    const raw = await request.text()
    if (raw.length > 5000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    const action = typeof body.action === 'string' ? body.action : 'list'

    if (action === 'list') {
      const [apps, audit] = await Promise.all([
        admin.from('applications').select('id, tracking_id, full_name, mobile, email, service_name, created_at').order('created_at', { ascending: false }).limit(200),
        admin.from('payment_audit_events').select('id, payment_id, action, metadata, created_at').order('created_at', { ascending: false }).limit(100),
      ])
      if (apps.error || audit.error) throw new Error('Payment dashboard could not be loaded.')
      const ids = (apps.data ?? []).map(item => item.id)
      const { data: orders, error: ordersError } = ids.length ? await admin.from('payment_orders').select('id, application_id, amount, currency, status, razorpay_order_id, razorpay_payment_id, payment_provider, paid_at, created_at').in('application_id', ids) : { data: [], error: null }
      if (ordersError) throw new Error('Payment records could not be loaded.')
      const byApp = new Map((orders ?? []).map(item => [item.application_id, item]))
      return response(request, { applications: (apps.data ?? []).map(item => ({ ...item, payment: byApp.get(item.id) ?? null })), audit: audit.data ?? [] }, 200, { 'Cache-Control': 'no-store' })
    }

    if (action === 'create_application') {
      const name = typeof body.fullName === 'string' ? body.fullName.trim() : ''
      const mobile = normalizeMobile(body.mobile)
      const serviceName = typeof body.serviceName === 'string' ? body.serviceName.trim() : ''
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const categorySlug = typeof body.categorySlug === 'string' ? body.categorySlug.trim() : ''
      const amount = Number(body.amount)
      if (name.length < 2 || name.length > 120 || !mobile || !/^[^ @]+@[^ @]+[.][^ @]+$/.test(email) || serviceName.length < 2 || serviceName.length > 160 || !/^[a-z0-9-]{2,48}$/.test(categorySlug) || !Number.isFinite(amount) || amount < 0 || amount > 10000000) return response(request, { error: 'Enter valid customer, service, category and amount details.' }, 400)
      const trackingId = createTrackingReference()
      const { data: app, error } = await admin.from('applications').insert({
        tracking_id: trackingId, full_name: name, mobile, email, category_slug: categorySlug,
        service_name: serviceName, description: 'Payment record created by the owner.', required_documents: '',
        consent_at: new Date().toISOString(),
      }).select('id').single()
      if (error || !app) return response(request, { error: 'New payment application could not be created.' }, 400)
      if (amount > 0) {
        const { error: paymentError } = await admin.from('payment_orders').insert({ application_id: app.id, amount, created_by: actor.id })
        if (paymentError) throw paymentError
      }
      await admin.from('admin_audit_logs').insert({ actor_id: actor.id, action: 'payment_application_created', entity_type: 'application', entity_id: app.id, metadata: { tracking_id: trackingId, amount } })
      const emailSent = amount > 0 ? await sendAssignedPaymentEmail(request, email, trackingId, name, serviceName, amount) : false
      return response(request, { created: true, trackingId, emailSent, notification: amount > 0 ? (emailSent ? 'Payment link emailed.' : 'Application created, but payment email was not sent.') : 'Application created.' }, 201)
    }

    if (action === 'set_amount') {
      if (!validId(body.applicationId)) return response(request, { error: 'Invalid application.' }, 400)
      const amount = Number(body.amount)
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (!Number.isFinite(amount) || amount < 0 || amount > 10000000 || !/^[^ @]+@[^ @]+[.][^ @]+$/.test(email)) return response(request, { error: 'Enter a valid amount and customer email address.' }, 400)
      const { data: app } = await admin.from('applications').select('id, tracking_id, full_name, service_name').eq('id', body.applicationId).maybeSingle()
      if (!app) return response(request, { error: 'Application not found.' }, 404)
      const { data: existing } = await admin.from('payment_orders').select('id, status, amount').eq('application_id', body.applicationId).maybeSingle()
      if (existing && existing.status === 'paid') return response(request, { error: 'This application is already paid through Razorpay. A new payment link cannot be issued.' }, 409)
      const { error: emailUpdateError } = await admin.from('applications').update({ email }).eq('id', body.applicationId)
      if (emailUpdateError) throw emailUpdateError
      const result = existing
        ? await admin.from('payment_orders').update({
            amount, status: 'pending', payment_provider: null, razorpay_order_id: null,
            razorpay_payment_id: null, razorpay_signature_verified_at: null, paid_at: null,
            utr: null, claimed_utr: null, expires_at: null,
          }).eq('id', existing.id).select('id').single()
        : await admin.from('payment_orders').insert({ application_id: body.applicationId, amount, created_by: actor.id }).select('id').single()
      if (result.error) throw result.error
      await admin.from('payment_audit_events').insert({ payment_id: result.data.id, actor_id: actor.id, action: 'amount_assigned', metadata: { amount, notification_email: email } })
      const emailSent = amount > 0 ? await sendAssignedPaymentEmail(request, email, app.tracking_id, app.full_name, app.service_name, amount) : false
      return response(request, { updated: true, emailSent, notification: emailSent ? 'Payment link emailed.' : 'Amount saved, but payment email was not sent. Check Resend configuration.' }, 200)
    }

    return response(request, { error: 'Unsupported admin payment action.' }, 400)
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    const status = message.includes('Unauthorized') ? 401 : message.includes('Owner authorization') ? 403 : 500
    console.error('admin-payments failed:', status, message.slice(0, 120))
    return response(request, { error: status === 401 ? 'Owner sign-in required.' : status === 403 ? 'Owner authorization required.' : 'Payment admin action failed.' }, status)
  }
})
