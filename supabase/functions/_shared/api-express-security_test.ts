import {
  parseApiExpressBaseUrl,
  readBoundedJson,
} from "./api-express-security.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("API Express base URL accepts only HTTPS provider hosts", () => {
  const sandbox = parseApiExpressBaseUrl("https://sandbox.api.apiexpress.in/");
  assert(sandbox?.environment === "sandbox", "sandbox host should be accepted");
  const production = parseApiExpressBaseUrl("https://api.apiexpress.in");
  assert(production?.environment === "production", "production host should be accepted");
  assert(parseApiExpressBaseUrl("http://api.apiexpress.in") === null, "HTTP must be rejected");
  assert(parseApiExpressBaseUrl("https://api.apiexpress.in.attacker.example") === null, "lookalike host must be rejected");
  assert(parseApiExpressBaseUrl("https://user:pass@api.apiexpress.in") === null, "embedded credentials must be rejected");
  assert(parseApiExpressBaseUrl("https://api.apiexpress.in/private-proxy") === null, "unexpected path must be rejected");
  assert(parseApiExpressBaseUrl(null) === null, "missing base URL must be rejected");
});

Deno.test("API Express bounded JSON reader accepts a small JSON body", async () => {
  const stream = new Response(JSON.stringify({ service: "weather" })).body;
  const result = await readBoundedJson(stream, 1024);
  assert(result.ok, "valid body should parse");
  assert((result.value as { service: string }).service === "weather", "parsed body should be preserved");
});

Deno.test("API Express bounded JSON reader rejects oversized bodies", async () => {
  const stream = new Response(JSON.stringify({ value: "x".repeat(2048) })).body;
  const result = await readBoundedJson(stream, 128);
  assert(!result.ok && result.reason === "too_large", "oversized body must be rejected");
});

Deno.test("API Express bounded JSON reader rejects invalid JSON", async () => {
  const stream = new Response("{").body;
  const result = await readBoundedJson(stream, 128);
  assert(!result.ok && result.reason === "invalid_json", "invalid JSON must be rejected");
});
