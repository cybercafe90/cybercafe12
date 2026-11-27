const DEFINITIVE_PROVIDER_FAILURES = new Set([400, 401, 403, 404, 422]);

/** Only explicit provider rejections are definitive. Timeouts, rate limits and 5xx remain reconciliation cases. */
export function isDefinitiveProviderFailure(status: number): boolean {
  return DEFINITIVE_PROVIDER_FAILURES.has(status);
}
