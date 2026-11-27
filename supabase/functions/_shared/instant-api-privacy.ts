const PRIVATE_KEY = /(?:provider.?cost|cost.?deducted|remaining.?balance|wallet|profit|margin|commission|api.?balance|account.?balance|credit.?balance|secret|api.?key|access.?token|refresh.?token|retrieval.?token|authorization|password|signature|webhook|internal.?key|raw.?request|request.?headers|debug|stack|trace|private.?key)/i;

export function customerSafeResult(value: unknown, depth = 0): unknown {
  if (depth > 12) return null;
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => customerSafeResult(item, depth + 1));
  if (!value || typeof value !== "object") {
    if (typeof value === "string") return value.length > 200_000 ? value.slice(0, 200_000) : value;
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 500)) {
    if (PRIVATE_KEY.test(key)) continue;
    output[key] = customerSafeResult(item, depth + 1);
  }
  return output;
}
