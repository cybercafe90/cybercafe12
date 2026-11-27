const PRIVATE_RESULT_FIELD = /(?:provider.?cost|cost.?deducted|remaining.?balance|wallet|profit|margin|commission|api.?balance|account.?balance|credit.?balance)/i;

/** Recursively removes provider billing and account metadata before customer delivery. */
export function customerSafeResult(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(customerSafeResult);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE_RESULT_FIELD.test(key)) continue;
    output[key] = customerSafeResult(item);
  }
  return output;
}
