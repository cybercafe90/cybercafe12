import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeRcPdfInput, parseProviderCost } from "./rc_pdf.ts";

Deno.test("RC PDF request defaults card layout and chip type to provider defaults", () => {
  assertEquals(normalizeRcPdfInput({ rcno: "up41 aj 1234" }), {
    rcno: "UP41AJ1234", cardtype: "2", chiptype: "2",
  });
});

Deno.test("RC PDF request accepts documented card and chip options", () => {
  assertEquals(normalizeRcPdfInput({ rcno: "UP41AJ1234", cardtype: 3, chiptype: 1 }), {
    rcno: "UP41AJ1234", cardtype: "3", chiptype: "1",
  });
});

Deno.test("RC PDF request rejects invalid registration and option values", () => {
  assertThrows(() => normalizeRcPdfInput({ rcno: "INVALID" }));
  assertThrows(() => normalizeRcPdfInput({ rcno: "UP41AJ1234", cardtype: 4 }));
  assertThrows(() => normalizeRcPdfInput({ rcno: "UP41AJ1234", chiptype: 3 }));
});

Deno.test("provider cost parser accepts decimal strings and numbers only", () => {
  assertEquals(parseProviderCost("10.00"), 10);
  assertEquals(parseProviderCost(7), 7);
  assertEquals(parseProviderCost("not-a-number"), null);
  assertEquals(parseProviderCost(-1), null);
  assertEquals(parseProviderCost("10.999"), null);
});
