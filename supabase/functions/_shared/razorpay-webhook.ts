export function shouldAcknowledgeDuplicateWebhook(processed: unknown): boolean {
  return processed === true;
}
