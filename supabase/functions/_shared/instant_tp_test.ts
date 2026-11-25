import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { customerInstantTpRecord } from "./instant-tp.ts";

Deno.test("customer instant TP response excludes mobile and UTR", () => {
  const result = customerInstantTpRecord({
    tracking_id: "BABA-ABCDEFGHJK",
    customer_name: "Test Customer",
    mobile: "+919876543210",
    utr: "123456789012",
    vehicle_registration: "JK01AB1234",
    vehicle_make_model: "Test Vehicle",
    vehicle_type: "private_car",
    quoted_amount: 1250,
    insurer_name: "Test Insurer",
    payment_status: "under_verification",
    policy_status: "processing",
    policy_number: null,
    policy_storage_path: "private/path.pdf",
    created_at: "2026-11-26T00:00:00Z",
    updated_at: "2026-11-26T00:00:00Z",
  });
  assertEquals(result.trackingId, "BABA-ABCDEFGHJK");
  assertEquals(result.paymentStatus, "under_verification");
  assert(!("mobile" in result));
  assert(!("utr" in result));
  assert(!("policy_storage_path" in result));
});
