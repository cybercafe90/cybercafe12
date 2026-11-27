import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { customerSafeResult } from "./instant-api-privacy.ts";

Deno.test("customer result removes provider financial and credential metadata recursively", () => {
  const result = customerSafeResult({
    status: true,
    message: "Success",
    data: { pan: "ABCDE1234F", name: "Test", wallet_balance: 900, api_key: "secret" },
    transaction: { fee: 10, profit: 4, reference: "REF-1" },
    authorization: "Bearer secret",
  });
  assertEquals(result, {
    status: true,
    message: "Success",
    data: { pan: "ABCDE1234F", name: "Test" },
    transaction: { reference: "REF-1" },
  });
});

Deno.test("customer result bounds depth, arrays and oversized strings", () => {
  const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: { l: "too deep" } } } } } } } } } } };
  const output = customerSafeResult({ rows: Array.from({ length: 600 }, (_, i) => i), large: "x".repeat(200_010), deep }) as Record<string, unknown>;
  assertEquals((output.rows as unknown[]).length, 500);
  assertEquals((output.large as string).length, 200_000);
});
