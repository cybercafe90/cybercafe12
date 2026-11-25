import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Backend is not configured.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
function response(request: Request, body: unknown, status=200) {
  const origin = request.headers.get('origin') || ''
  const allowed = ['https://babacybercafe.in','https://www.babacybercafe.in']
  let valid = allowed.includes(origin)
  try { const u = new URL(origin); valid ||= u.protocol === 'https:' && (u.hostname === 'babacybercafe.pages.dev' || u.hostname.endsWith('.babacybercafe.pages.dev')) } catch { /* Invalid URL: keep the origin disallowed. */ }
  return new Response(JSON.stringify(body), { status, headers: { 'Access-Control-Allow-Origin': valid ? origin : 'https://babacybercafe.in', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-razorpay-signature, x-razorpay-event-id', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Content-Type':'application/json; charset=utf-8' } })
}

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
      if (insertError.code !== '23505') throw insertError
      // A previous delivery may have inserted the event before a transient
      // database failure. Only acknowledge it as a duplicate after processing
      // has completed; otherwise allow Razorpay's retry to resume the work.
      const { data: existingEvent, error: existingEventError } = await admin
        .from('razorpay_webhook_events')
        .select('processed')
        .eq('event_id', eventId)
        .maybeSingle()
      if (existingEventError) throw existingEventError
      if (!existingEvent) throw new Error('Webhook idempotency state could not be confirmed.')
      if (existingEvent.processed) return response(request, { received: true, duplicate: true }, 200)
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
        const { data: printJob, error: printLookupError } = await admin.from('print_jobs')
          .select('id, job_number, payment_amount, payment_status, status, razorpay_order_id')
          .eq('razorpay_order_id', orderId).maybeSingle()
        if (printLookupError) throw printLookupError
        if (printJob && entity.status === 'captured' && entity.captured === true && paymentId) {
          const expectedPrintPaise = Math.round(Number(printJob.payment_amount) * 100)
          if (Number(entity.amount) !== expectedPrintPaise || entity.currency !== 'INR') {
            await admin.from('print_job_events').insert({ print_job_id: printJob.id, actor_type: 'system', event_type: 'razorpay_webhook_amount_mismatch', details: { event_id: eventId, order_id: orderId, payment_id: paymentId, received_amount: entity.amount, expected_amount: expectedPrintPaise, received_currency: entity.currency } })
            await admin.from('razorpay_webhook_events').update({ processed: true, metadata: { order_id: orderId, rejected: 'Print job amount or currency mismatch.' } }).eq('event_id', eventId)
            return response(request, { received: true, processed: false }, 200)
          }
          const { data: paidJob, error: printUpdateError } = await admin.from('print_jobs').update({
            payment_status: 'paid', razorpay_payment_id: paymentId, status: 'queued', updated_at: new Date().toISOString(),
          }).eq('id', printJob.id).eq('payment_status', 'pending').eq('razorpay_order_id', orderId).select('id').maybeSingle()
          if (printUpdateError) throw printUpdateError
          if (paidJob) await admin.from('print_job_events').insert({ print_job_id: printJob.id, actor_type: 'system', event_type: 'razorpay_payment_captured_webhook', details: { event_id: eventId, order_id: orderId, payment_id: paymentId, amount_paise: entity.amount } })
          await admin.from('razorpay_webhook_events').update({ processed: true, metadata: { order_id: orderId, print_job_number: printJob.job_number, paid: Boolean(paidJob) } }).eq('event_id', eventId)
          return response(request, { received: true, processed: true, print_job: printJob.job_number }, 200)
        }
        await admin.from('razorpay_webhook_events').update({ processed: true, metadata: { order_id: orderId, ignored: 'Order not found in application or print payment records.' } }).eq('event_id', eventId)
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
