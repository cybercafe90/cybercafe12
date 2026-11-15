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

const validUtr = (value: unknown) => typeof value === 'string' && /^[0-9]{12}$/.test(value.trim())
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
      const [apps, alerts, audit] = await Promise.all([
        admin.from('applications').select('id, tracking_id, full_name, mobile, email, service_name, created_at').order('created_at', { ascending: false }).limit(200),
        admin.from('bank_sms_alerts').select('id, sender, message, bank_timestamp, received_at, parsed_amount, parsed_utr, parsed_tracking_id, matched_payment_id, status, processing_note').order('received_at', { ascending: false }).limit(50),
        admin.from('payment_audit_events').select('id, payment_id, action, metadata, created_at').order('created_at', { ascending: false }).limit(50),
      ])
      if (apps.error || alerts.error || audit.error) throw new Error('Payment dashboard could not be loaded.')
      const ids = (apps.data ?? []).map(item => item.id)
      const { data: orders } = ids.length ? await admin.from('payment_orders').select('id, application_id, amount, status, claimed_utr, utr, paid_at, created_at, expires_at').in('application_id', ids) : { data: [] }
      const byApp = new Map((orders ?? []).map(item => [item.application_id, item]))
      return response(request, { applications: (apps.data ?? []).map(item => ({ ...item, payment: byApp.get(item.id) ?? null })), alerts: alerts.data ?? [], audit: audit.data ?? [] }, 200, { 'Cache-Control': 'no-store' })
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
        tracking_id: trackingId, full_name: name, mobile, email: '', category_slug: categorySlug,
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
      if (existing && ['paid','claimed'].includes(existing.status) && amount !== Number(existing.amount)) return response(request, { error: 'Reopen or resolve the existing payment before changing its amount.' }, 409)
      const { error: emailUpdateError } = await admin.from('applications').update({ email }).eq('id', body.applicationId)
      if (emailUpdateError) throw emailUpdateError
      const result = existing
        ? await admin.from('payment_orders').update({ amount, expires_at: new Date(Date.now() + 5 * 60_000).toISOString() }).eq('id', existing.id).select('id').single()
        : await admin.from('payment_orders').insert({ application_id: body.applicationId, amount, expires_at: new Date(Date.now() + 5 * 60_000).toISOString(), created_by: actor.id }).select('id').single()
      if (result.error) throw result.error
      await admin.from('payment_audit_events').insert({ payment_id: result.data.id, actor_id: actor.id, action: 'amount_assigned', metadata: { amount, notification_email: email } })
      const emailSent = amount > 0 ? await sendAssignedPaymentEmail(request, email, app.tracking_id, app.full_name, app.service_name, amount) : false
      return response(request, { updated: true, emailSent, notification: emailSent ? 'Payment link emailed.' : 'Amount saved, but payment email was not sent. Check Resend configuration.' }, 200)
    }

    if (action === 'renew_qr') {
      if (!validId(body.applicationId)) return response(request, { error: 'Invalid application.' }, 400)
      const { data: payment } = await admin.from('payment_orders').select('id, status, amount').eq('application_id', body.applicationId).maybeSingle()
      if (!payment || Number(payment.amount) <= 0 || payment.status !== 'pending') return response(request, { error: 'Only an unpaid payment with an assigned amount can receive a new QR expiry.' }, 409)
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()
      const { error } = await admin.from('payment_orders').update({ expires_at: expiresAt }).eq('id', payment.id)
      if (error) throw error
      await admin.from('payment_audit_events').insert({ payment_id: payment.id, actor_id: actor.id, action: 'upi_qr_renewed', metadata: { expires_at: expiresAt } })
      return response(request, { renewed: true, expiresAt }, 200)
    }

    if (action === 'manual_mark_paid') {
      if (!validId(body.applicationId) || !validUtr(body.utr) || typeof body.reason !== 'string' || body.reason.trim().length < 10 || body.bankStatementVerified !== true) return response(request, { error: 'A 12-digit UTR, verification note and explicit bank-statement confirmation are required.' }, 400)
      const { data: payment } = await admin.from('payment_orders').select('id, status, amount').eq('application_id', body.applicationId).maybeSingle()
      if (!payment || Number(payment.amount) <= 0) return response(request, { error: 'Assign a positive amount before recording payment.' }, 409)
      const { data, error } = await admin.from('payment_orders').update({ status: 'paid', utr: body.utr.trim(), paid_at: new Date().toISOString() }).eq('id', payment.id).in('status', ['pending','claimed','needs_review']).is('utr', null).select('id').maybeSingle()
      if (error || !data) return response(request, { error: 'Payment could not be marked paid. Check whether the UTR is already used.' }, 409)
      await admin.from('payment_audit_events').insert({ payment_id: payment.id, actor_id: actor.id, action: 'admin_marked_paid', metadata: { utr: body.utr.trim(), reason: body.reason.trim(), bank_statement_verified: true } })
      return response(request, { updated: true }, 200)
    }

    if (action === 'manual_mark_pending') {
      if (!validId(body.applicationId) || typeof body.reason !== 'string' || body.reason.trim().length < 10) return response(request, { error: 'A reason is required.' }, 400)
      const { data: payment } = await admin.from('payment_orders').select('id').eq('application_id', body.applicationId).maybeSingle()
      if (!payment) return response(request, { error: 'Payment record not found.' }, 404)
      const { error } = await admin.from('payment_orders').update({ status: 'pending', utr: null, paid_at: null, claimed_utr: null, expires_at: new Date(Date.now() + 5 * 60_000).toISOString() }).eq('id', payment.id)
      if (error) throw error
      await admin.from('payment_audit_events').insert({ payment_id: payment.id, actor_id: actor.id, action: 'admin_reopened_payment', metadata: { reason: body.reason.trim() } })
      return response(request, { updated: true }, 200)
    }

    if (action === 'manual_match') {
      if (!validId(body.alertId) || !validId(body.applicationId) || typeof body.reason !== 'string' || body.reason.trim().length < 10 || body.bankStatementVerified !== true) return response(request, { error: 'Select an application, verify the matching bank-statement credit and provide a review note.' }, 400)
      const { data: alert } = await admin.from('bank_sms_alerts').select('id, parsed_amount, parsed_utr, parsed_tracking_id, status').eq('id', body.alertId).maybeSingle()
      if (!alert || !alert.parsed_amount || !alert.parsed_utr || alert.status === 'matched') return response(request, { error: 'This alert is not ready for manual matching.' }, 409)
      const { data: app } = await admin.from('applications').select('id, tracking_id').eq('id', body.applicationId).maybeSingle()
      if (!app || app.tracking_id !== alert.parsed_tracking_id) return response(request, { error: 'The alert tracking ID does not match the selected application.' }, 409)
      const { data: payment } = await admin.from('payment_orders').select('id, amount').eq('application_id', body.applicationId).maybeSingle()
      if (!payment || Number(payment.amount).toFixed(2) !== Number(alert.parsed_amount).toFixed(2)) return response(request, { error: 'The selected application amount does not match this bank alert.' }, 409)
      const { data: updated, error } = await admin.from('payment_orders').update({ status: 'paid', utr: alert.parsed_utr, paid_at: new Date().toISOString() }).eq('id', payment.id).in('status', ['pending','claimed','needs_review']).is('utr', null).select('id').maybeSingle()
      if (error || !updated) return response(request, { error: 'The payment could not be matched; the UTR may already be used.' }, 409)
      await admin.from('bank_sms_alerts').update({ status: 'matched', matched_payment_id: payment.id, processing_note: 'Manually matched by owner after reviewing bank statement: ' + body.reason.trim().slice(0, 300) }).eq('id', alert.id)
      await admin.from('payment_audit_events').insert({ payment_id: payment.id, actor_id: actor.id, action: 'admin_manually_matched_bank_alert', metadata: { alert_id: alert.id, utr: alert.parsed_utr, reason: body.reason.trim(), bank_statement_verified: true } })
      return response(request, { updated: true }, 200)
    }

    if (action === 'match_alert') {
      if (!validId(body.alertId) || typeof body.reason !== 'string' || body.reason.trim().length < 10 || body.bankStatementVerified !== true) return response(request, { error: 'Verify the matching bank-statement credit and provide a review note.' }, 400)
      const { data: alert } = await admin.from('bank_sms_alerts').select('id, parsed_amount, parsed_utr, parsed_tracking_id, status').eq('id', body.alertId).maybeSingle()
      if (!alert || !alert.parsed_amount || !alert.parsed_utr || !alert.parsed_tracking_id || alert.status === 'matched') return response(request, { error: 'This alert is not ready for matching.' }, 409)
      const { data: app } = await admin.from('applications').select('id').eq('tracking_id', alert.parsed_tracking_id).maybeSingle()
      if (!app) return response(request, { error: 'No application matches this tracking ID.' }, 404)
      const { data: payment } = await admin.from('payment_orders').select('id, amount').eq('application_id', app.id).maybeSingle()
      if (!payment || Number(payment.amount).toFixed(2) !== Number(alert.parsed_amount).toFixed(2)) return response(request, { error: 'The bank alert amount does not match the assigned amount.' }, 409)
      const { data: updated, error } = await admin.from('payment_orders').update({ status: 'paid', utr: alert.parsed_utr, paid_at: new Date().toISOString() }).eq('id', payment.id).in('status', ['pending','claimed','needs_review']).is('utr', null).select('id').maybeSingle()
      if (error || !updated) return response(request, { error: 'The payment could not be matched; the UTR may already be used.' }, 409)
      await admin.from('bank_sms_alerts').update({ status: 'matched', matched_payment_id: payment.id, processing_note: 'Manually matched by owner: ' + body.reason.trim().slice(0, 300) }).eq('id', alert.id)
      await admin.from('payment_audit_events').insert({ payment_id: payment.id, actor_id: actor.id, action: 'admin_matched_bank_alert', metadata: { alert_id: alert.id, utr: alert.parsed_utr, reason: body.reason.trim(), bank_statement_verified: true } })
      return response(request, { updated: true }, 200)
    }
    return response(request, { error: 'Unsupported admin payment action.' }, 400)
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    const status = message.includes('Unauthorized') ? 401 : message.includes('Owner authorization') ? 403 : 500
    console.error('admin-payments failed:', status, message.slice(0, 120))
    return response(request, { error: status === 401 ? 'Owner sign-in required.' : status === 403 ? 'Owner authorization required.' : 'Payment admin action failed.' }, status)
  }
})
