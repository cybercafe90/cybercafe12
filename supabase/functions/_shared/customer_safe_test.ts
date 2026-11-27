import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { customerSafeResult } from "./customer_safe.ts";

Deno.test("customer result excludes provider billing, account balances and direct document URLs", () => {
  const result = customerSafeResult({
    status: "success",
    data: {
      registration: "REDACTED-TEST",
      provider_cost: 10,
      cost_deducted: 9,
      nested: {
        wallet_balance: 100,
        document_url: "https://example.test/document.pdf",
        pdf_url: "https://provider.example.test/private.pdf",
        pdf_base64: "JVBERi0xLjQ=",
      },
    },
    items: [{ name: "RC", commission: 2 }, { name: "DL", value: "ready" }],
  });
  assertEquals(result, {
    status: "success",
    data: {
      registration: "REDACTED-TEST",
      nested: { pdf_base64: "JVBERi0xLjQ=" },
    },
    items: [{ name: "RC" }, { name: "DL", value: "ready" }],
  });
});
