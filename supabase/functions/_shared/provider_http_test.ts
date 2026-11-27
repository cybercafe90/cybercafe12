import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isDefinitiveProviderFailure } from "./provider_http.ts";

Deno.test("explicit provider rejections are definitive", () => {
  for (const status of [400, 401, 403, 404, 422]) assertEquals(isDefinitiveProviderFailure(status), true);
});

Deno.test("timeouts, rate limits and server failures remain uncertain", () => {
  for (const status of [408, 409, 429, 500, 502, 503, 504]) assertEquals(isDefinitiveProviderFailure(status), false);
});
