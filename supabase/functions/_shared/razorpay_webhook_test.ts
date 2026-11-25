import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldAcknowledgeDuplicateWebhook } from './razorpay-webhook.ts';

Deno.test('only fully processed webhook events are acknowledged as duplicates', () => {
  assertEquals(shouldAcknowledgeDuplicateWebhook(true), true);
  assertEquals(shouldAcknowledgeDuplicateWebhook(false), false);
  assertEquals(shouldAcknowledgeDuplicateWebhook(null), false);
  assertEquals(shouldAcknowledgeDuplicateWebhook(undefined), false);
});
