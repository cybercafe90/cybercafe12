import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { customerSafeResult } from "./customer_safe.ts";

Deno.test("customer result recursively excludes provider costs and account balances", () => {
  const result = customerSafeResult({
    status: "success",
    data: {
      registration: "REDACTED-TEST",
      provider_cost: 10,
      cost_deducted: 9,
      nested: { wallet_balance: 100, document_url: "https://example.test/document.pdf" },
    },
    items: [{ name: "RC", commission: 2 }, { name: "DL", value: "ready" }],
  });
  assertEquals(result, {
    status: "success",
    data: {
      registration: "REDACTED-TEST",
      nested: { document_url: "https://example.test/document.pdf" },
    },
    items: [{ name: "RC" }, { name: "DL", value: "ready" }],
  });
});
