export type ApiExpressEnvironment = "sandbox" | "production";

export function parseApiExpressBaseUrl(raw: string | null): {
  baseUrl: string;
  environment: ApiExpressEnvironment;
} | null {
  if (!raw || raw.length > 300) return null;
  try {
    const url = new URL(raw.trim());
    const allowedHosts = new Set(["api.apiexpress.in", "sandbox.api.apiexpress.in"]);
    if (
      url.protocol !== "https:" ||
      !allowedHosts.has(url.hostname.toLowerCase()) ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) return null;
    return {
      baseUrl: url.origin,
      environment: url.hostname.toLowerCase() === "sandbox.api.apiexpress.in" ? "sandbox" : "production",
    };
  } catch {
    return null;
  }
}

export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" };

export async function readBoundedJson(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  contentLength: string | null = null,
): Promise<BoundedJsonResult> {
  if (!stream || !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    return { ok: false, reason: "invalid_json" };
  }
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: "too_large" };
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid_json" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
