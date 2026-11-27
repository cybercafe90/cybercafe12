const DEFINITIVE_PROVIDER_FAILURES = new Set([400, 401, 403, 404, 422]);

/** Refund only definitive provider rejections; timeouts, conflicts, rate limits and 5xx responses remain reconciliation cases. */
export function isDefinitiveProviderFailure(status: number): boolean {
  return DEFINITIVE_PROVIDER_FAILURES.has(status);
}
