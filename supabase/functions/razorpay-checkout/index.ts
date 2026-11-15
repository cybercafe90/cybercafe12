import { checkRateLimit, serviceClient } from '../_shared/auth.ts'
import { normalizeMobile, preflight, response } from '../_shared/http.ts'

const validTracking = (value: unknown) => typeof value === 'string' && /^BABA-[A-Z0-9]{10}$/.test(value.trim().toUpperCase())
const encoder = new TextEncoder()

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return bytesToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

async function razorpayRequest(path: string, method: string, body?: unknown) {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID')
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
  if (!keyId || !keySecret) throw new Error('Razorpay credentials are not configured.')
  const authorization = btoa(`${keyId}:${keySecret}`)
  const result = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await result.json().catch(() => ({}))
  if (!result.ok) {
    console.error('Razorpay API error:', result.status, JSON.stringify(payload).slice(0, 300))
    throw new Error('Razorpay could not process this payment request.')
  }
  return payload
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
    if (!trackingId || !mobile) return response(request, { error: 'Check the tracking ID and registered mobile number.' }, 404, { 'Cache-Control': 'no-store' })

    const admin = serviceClient()
    const [ipAllowed, referenceAllowed] = await Promise.all([
      checkRateLimit(admin, request, `razorpay-${action}-ip`, 'all', 30, 15),
      checkRateLimit(admin, request, `razorpay-${action}-reference`, trackingId, 5, 15),
    ])
    if (!ipAllowed || !referenceAllowed) return response(request, { error: 'Too many attempts. Please wait and try again.' }, 429, { 'Cache-Control': 'no-store' })

    const { data: app } = await admin.from('applications')
      .select('id, tracking_id, mobile')
      .eq('tracking_id', trackingId).eq('mobile', mobile).maybeSingle()
    if (!app) return response(request, { error: 'We could not verify those application details.' }, 404, { 'Cache-Control': 'no-store' })

    const { data: payment } = await admin.from('payment_orders')
      .select('id, amount, currency, status, razorpay_order_id, payment_provider')
      .eq('application_id', app.id).maybeSingle()
    if (!payment || Number(payment.amount) <= 0) return response(request, { error: 'A payment amount has not been assigned yet.' }, 409)
    if (payment.status === 'paid') return response(request, { error: 'This payment is already marked as paid.' }, 409)
    if (payment.status !== 'pending') return response(request, { error: 'This payment is under review. Please contact the cafe before paying again.' }, 409)

    if (action === 'create_order') {
      if (payment.razorpay_order_id && payment.payment_provider === 'razorpay') {
        const existing = await razorpayRequest(`/orders/${encodeURIComponent(payment.razorpay_order_id)}`, 'GET')
        if (existing.status === 'created' || existing.status === 'attempted') {
          return response(request, { orderId: existing.id, amount: existing.amount, currency: existing.currency, keyId: Deno.env.get('RAZORPAY_KEY_ID') }, 200, { 'Cache-Control': 'no-store' })
        }
      }
      const amountPaise = Math.round(Number(payment.amount) * 100)
      if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) return response(request, { error: 'The assigned payment amount is invalid.' }, 409)
      const currency = payment.currency || 'INR'
      if (currency !== 'INR') return response(request, { error: 'Only INR payments are currently supported.' }, 409)
      const order = await razorpayRequest('/orders', 'POST', {
        amount: amountPaise,
        currency,
        receipt: payment.id,
        notes: { tracking_id: app.tracking_id, payment_order_id: payment.id },
      })
      if (typeof order.id !== 'string' || order.amount !== amountPaise || order.currency !== currency) throw new Error('Razorpay returned an invalid order.')
      const { error } = await admin.from('payment_orders').update({
        payment_provider: 'razorpay',
        razorpay_order_id: order.id,
      }).eq('id', payment.id).eq('status', 'pending')
      if (error) throw new Error('The payment order could not be saved securely.')
      await admin.from('payment_audit_events').insert({
        payment_id: payment.id,
        action: 'razorpay_order_created',
        metadata: { razorpay_order_id: order.id, amount_paise: amountPaise, currency },
      })
      return response(request, { orderId: order.id, amount: amountPaise, currency, keyId: Deno.env.get('RAZORPAY_KEY_ID') }, 200, { 'Cache-Control': 'no-store' })
    }

    if (action === 'verify_payment') {
      const orderId = typeof body.razorpayOrderId === 'string' ? body.razorpayOrderId : ''
      const paymentId = typeof body.razorpayPaymentId === 'string' ? body.razorpayPaymentId : ''
      const signature = typeof body.razorpaySignature === 'string' ? body.razorpaySignature : ''
      if (!orderId || !paymentId || !/^[a-f0-9]{64}$/i.test(signature) || orderId !== payment.razorpay_order_id || payment.payment_provider !== 'razorpay') {
        return response(request, { error: 'Payment verification details are invalid.' }, 400)
      }
      const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
      if (!keySecret) throw new Error('Razorpay credentials are not configured.')
      const expected = await hmacSha256(keySecret, `${orderId}|${paymentId}`)
      if (!safeEqual(expected, signature.toLowerCase())) return response(request, { error: 'The payment signature could not be verified.' }, 400)

      const remotePayment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`, 'GET')
      if (remotePayment.order_id !== orderId || Number(remotePayment.amount) !== Math.round(Number(payment.amount) * 100) || remotePayment.currency !== (payment.currency || 'INR')) {
        return response(request, { error: 'Payment details do not match the assigned amount.' }, 409)
      }
      if (remotePayment.status !== 'captured' || remotePayment.captured !== true) {
        await admin.from('payment_audit_events').insert({
          payment_id: payment.id,
          action: 'razorpay_payment_authorized_pending_capture',
          metadata: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_status: remotePayment.status },
        })
        return response(request, { verified: true, paid: false, message: 'Payment is authorised and awaiting capture confirmation. Keep this page open; do not pay again.' }, 202, { 'Cache-Control': 'no-store' })
      }

      const { data: updated, error } = await admin.from('payment_orders').update({
        status: 'paid',
        payment_provider: 'razorpay',
        razorpay_payment_id: paymentId,
        razorpay_signature_verified_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
      }).eq('id', payment.id).eq('status', 'pending').eq('razorpay_order_id', orderId).select('id').maybeSingle()
      if (error) throw error
      if (updated) {
        await admin.from('payment_audit_events').insert({
          payment_id: payment.id,
          action: 'razorpay_payment_verified',
          metadata: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, amount_paise: remotePayment.amount },
        })
      }
      return response(request, { verified: true, paid: true, message: 'Payment successfully verified.' }, 200, { 'Cache-Control': 'no-store' })
    }

    return response(request, { error: 'Unsupported Razorpay action.' }, 400)
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'unknown error'
    console.error('razorpay-checkout failed:', message.slice(0, 160))
    return response(request, { error: 'Online payment is temporarily unavailable. Please try again or contact the cafe.' }, 503, { 'Cache-Control': 'no-store' })
  }
})
