import { serviceClient } from '../_shared/auth.ts'
import { response } from '../_shared/http.ts'

const encoder = new TextEncoder()

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(body)))
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return mismatch === 0
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response(request, { error: 'Method not allowed.' }, 405)
  try {
    const rawBody = await request.text()
    if (rawBody.length > 256_000) return response(request, { error: 'Webhook payload is too large.' }, 413)
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    const signature = request.headers.get('x-razorpay-signature') ?? ''
    const eventId = request.headers.get('x-razorpay-event-id') ?? ''
    if (!secret || !signature || !eventId) return response(request, { error: 'Webhook authentication headers are missing.' }, 400)
    const expected = await hmacSha256(secret, rawBody)
    if (!safeEqual(expected, signature.toLowerCase())) return response(request, { error: 'Invalid webhook signature.' }, 401)

    const payload = JSON.parse(rawBody)
    const eventType = typeof payload.event === 'string' ? payload.event : 'unknown'
    const admin = serviceClient()
    const entity = payload.payload?.payment?.entity ?? null
    const orderEntity = payload.payload?.order?.entity ?? null
    const orderId = typeof entity?.order_id === 'string' ? entity.order_id : typeof orderEntity?.id === 'string' ? orderEntity.id : ''
    const paymentId = typeof entity?.id === 'string' ? entity.id : null

    const { error: insertError } = await admin.from('razorpay_webhook_events').insert({
      event_id: eventId,
      event_type: eventType,
      payment_id: paymentId,
      processed: false,
      metadata: { order_id: orderId || null, event_type: eventType },
    })
    if (insertError) {
      if (insertError.code === '23505') return response(request, { received: true, duplicate: true }, 200)
      throw insertError
    }

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      if (!orderId || !entity || entity.status !== 'captured' || entity.captured !== true || !paymentId) {
        await admin.from('razorpay_webhook_events').update({ processed: true, metadata: { order_id: orderId || null, ignored: 'No captured payment entity in event.' } }).eq('event_id', eventId)
        return response(request, { received: true, processed: false }, 200)
      }
      const { data: paymentOrder, error: lookupError } = await admin.from('payment_orders')
        .select('id, amount, currency, status, razorpay_order_id')
        .eq('razorpay_order_id', orderId).maybeSingle()
      if (lookupError) throw lookupError
      if (!paymentOrder) {
        await admin.from('razorpay_webhook_events').update({ processed: true, metadata: { order_id: orderId, ignored: 'Order not found in payment records.' } }).eq('event_id', eventId)
        return response(request, { received: true, processed: false }, 200)
      }
      const expectedPaise = Math.round(Number(paymentOrder.amount) * 100)
      if (Number(entity.amount) !== expectedPaise || entity.currency !== (paymentOrder.currency || 'INR')) {
        await admin.from('payment_audit_events').insert({ payment_id: paymentOrder.id, action: 'razorpay_webhook_amount_mismatch', metadata: { event_id: eventId, order_id: orderId, payment_id: paymentId, received_amount: entity.amount, expected_amount: expectedPaise, received_currency: entity.currency } })
        await admin.from('razorpay_webhook_events').update({ processed: true, metadata: { order_id: orderId, rejected: 'Amount or currency mismatch.' } }).eq('event_id', eventId)
        return response(request, { received: true, processed: false }, 200)
      }
      if (paymentOrder.status !== 'paid') {
        const { data: updated, error: updateError } = await admin.from('payment_orders').update({
          status: 'paid',
          payment_provider: 'razorpay',
          razorpay_payment_id: paymentId,
          paid_at: new Date().toISOString(),
          razorpay_signature_verified_at: new Date().toISOString(),
        }).eq('id', paymentOrder.id).eq('razorpay_order_id', orderId).neq('status', 'paid').select('id').maybeSingle()
        if (updateError) throw updateError
        if (updated) await admin.from('payment_audit_events').insert({
          payment_id: paymentOrder.id,
          action: 'razorpay_webhook_payment_captured',
          metadata: { event_id: eventId, event_type: eventType, razorpay_order_id: orderId, razorpay_payment_id: paymentId, amount_paise: entity.amount },
        })
      }
    } else if (eventType === 'payment.failed') {
      if (orderId) {
        const { data: paymentOrder } = await admin.from('payment_orders').select('id').eq('razorpay_order_id', orderId).maybeSingle()
        if (paymentOrder) await admin.from('payment_audit_events').insert({ payment_id: paymentOrder.id, action: 'razorpay_payment_failed', metadata: { event_id: eventId, razorpay_order_id: orderId, razorpay_payment_id: paymentId } })
      }
    }

    await admin.from('razorpay_webhook_events').update({ processed: true }).eq('event_id', eventId)
    return response(request, { received: true, processed: true }, 200)
  } catch (error) {
    console.error('razorpay-webhook failed:', error instanceof Error ? error.message.slice(0, 160) : 'unknown error')
    return response(request, { error: 'Webhook processing failed.' }, 500)
  }
})
