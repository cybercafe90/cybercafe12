import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { buildRazorpayWebhookEventInsert } from './razorpay_webhook.ts'

Deno.test('webhook event stores provider payment reference as text metadata, not UUID FK', () => {
  const record = buildRazorpayWebhookEventInsert(
    'evt_01ABC',
    'payment.captured',
    'order_01ABC',
    'pay_01ABC',
  )
  assertEquals(record.payment_id, null)
  assertEquals(record.metadata.razorpay_payment_id, 'pay_01ABC')
  assertEquals(record.metadata.order_id, 'order_01ABC')
  assertEquals(record.processed, false)
})
