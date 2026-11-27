const RC_PDF_CARD_TYPES = new Set(["1", "2", "3"]);
const RC_PDF_CHIP_TYPES = new Set(["1", "2"]);

/** Normalize and validate the provider's documented RC PDF request parameters. */
export function normalizeRcPdfInput(input: Record<string, unknown>): Record<string, string> {
  const rcno = typeof input.rcno === "string" ? input.rcno.toUpperCase().replace(/[\s-]/g, "") : "";
  if (!/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/.test(rcno)) {
    throw new Error("Enter a valid vehicle registration number, for example UP41AJ1234.");
  }
  const cardtype = input.cardtype == null || input.cardtype === "" ? "2" : String(input.cardtype);
  const chiptype = input.chiptype == null || input.chiptype === "" ? "2" : String(input.chiptype);
  if (!RC_PDF_CARD_TYPES.has(cardtype)) throw new Error("RC card layout must be 1, 2 or 3.");
  if (!RC_PDF_CHIP_TYPES.has(chiptype)) throw new Error("RC chip type must be 1 (Chip) or 2 (Non-Chip).");
  return { rcno, cardtype, chiptype };
}

/** Provider currently returns cost_deducted as a decimal string (e.g. "10.00"). */
export function parseProviderCost(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
