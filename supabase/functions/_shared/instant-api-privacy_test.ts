import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { customerSafeResult } from "./instant-api-privacy.ts";

Deno.test("customer result uses an explicit allowlist recursively", () => {
  const result = customerSafeResult({
    status: true,
    message: "Success",
    data: { pan: "ABCDE1234F", name: "Test", wallet_balance: 900, api_key: "secret", custom_provider_field: "private" },
    transaction: { fee: 10, profit: 4, reference: "REF-1", provider_cost: 3 },
    authorization: "Bearer secret",
  });
  assertEquals(result, {
    status: true,
    message: "Success",
    data: { pan: "ABCDE1234F", name: "Test" },
  });
});

Deno.test("customer result bounds depth, arrays and oversized strings", () => {
  let deep: Record<string, unknown> = { result: "too deep" };
  for (let i = 0; i < 12; i++) deep = { data: deep };
  const output = customerSafeResult({
    records: Array.from({ length: 120 }, (_, i) => ({ name: "Customer " + i, unknown_provider_field: "private" })),
    message: "x".repeat(20_010),
    data: deep,
  }) as Record<string, unknown>;
  assertEquals((output.records as unknown[]).length, 100);
  assertEquals((output.message as string).length, 20_000);
  let nested: unknown = output.data;
  for (let i = 0; i < 10 && nested !== null; i++) nested = (nested as Record<string, unknown>).data;
  assertEquals(nested, null);
});

Deno.test("customer result preserves safe vehicle data and strips unknown nested keys", () => {
  assertEquals(customerSafeResult({
    status: "success",
    data: {
      registration_number: "JK01AB1234",
      owner_name: "Test Owner",
      vehicle_class: "LMV",
      insurance_upto: "2027-01-01",
      provider_balance: 1000,
      raw_response: { headers: { authorization: "secret" } },
    },
  }), {
    status: "success",
    data: { registration_number: "JK01AB1234", owner_name: "Test Owner", vehicle_class: "LMV", insurance_upto: "2027-01-01" },
  });
});
