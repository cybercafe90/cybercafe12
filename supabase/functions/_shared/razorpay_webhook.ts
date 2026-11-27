export type RazorpayWebhookEventInsert = {
  event_id: string;
  event_type: string;
  payment_id: null;
  processed: false;
  metadata: {
    order_id: string | null;
    event_type: string;
    razorpay_payment_id: string | null;
  };
};

/**
 * payment_id is the internal UUID foreign key to payment_orders.
 * Razorpay's payment_<id> is a provider reference, not a UUID; keep it
 * in metadata and leave the internal relation null until it is resolved.
 */
export function buildRazorpayWebhookEventInsert(
  eventId: string,
  eventType: string,
  orderId: string,
  razorpayPaymentId: string | null,
): RazorpayWebhookEventInsert {
  return {
    event_id: eventId,
    event_type: eventType,
    payment_id: null,
    processed: false,
    metadata: {
      order_id: orderId || null,
      event_type: eventType,
      razorpay_payment_id: razorpayPaymentId,
    },
  };
}
