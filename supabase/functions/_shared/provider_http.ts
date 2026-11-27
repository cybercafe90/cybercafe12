const DEFINITIVE_PROVIDER_FAILURES = new Set([400, 401, 403, 404, 422]);

/** These 4xx responses mean the provider rejected the request; 408/429/5xx remain uncertain. */
export function isDefinitiveProviderFailure(status: number): boolean {
  return DEFINITIVE_PROVIDER_FAILURES.has(status);
}
