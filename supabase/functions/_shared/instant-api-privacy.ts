const CUSTOMER_FIELDS = new Set([
  "status", "success", "message", "data", "result", "details", "records", "items",
  "name", "full_name", "owner_name", "father_name", "gender", "date_of_birth", "dob",
  "pan", "pan_number", "aadhaar_number", "epic", "epic_no", "voter_id",
  "mobile", "mobile_number", "phone", "email",
  "vehicle", "vehicle_details", "registration_number", "registration_no", "rc_number",
  "registration_date", "registered_at", "vehicle_class", "class", "fuel_type",
  "maker", "maker_model", "model", "manufacturing_year", "colour", "color",
  "chassis_number", "engine_number", "engine_capacity", "norms",
  "insurance", "insurance_upto", "fitness", "fitness_upto", "tax", "tax_upto",
  "pucc", "pucc_upto", "permit", "permit_upto", "status_description",
  "address", "permanent_address", "present_address", "district", "state", "pincode",
  "license_number", "dl_number", "validity", "valid_from", "valid_to",
  "application_status", "verification_status", "reference_number", "reference",
  "issued_date", "expiry_date", "date", "count", "type", "category",
]);

const CONTAINER_FIELDS = new Set(["data", "result", "details", "records", "items", "vehicle", "vehicle_details", "insurance", "fitness", "tax", "permit"]);

export function customerSafeResult(value: unknown, depth = 0): unknown {
  if (depth > 10) return null;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => customerSafeResult(item, depth + 1));
  if (!value || typeof value !== "object") {
    if (typeof value === "string") return value.length > 20_000 ? value.slice(0, 20_000) : value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    return typeof value === "boolean" || value === null ? value : null;
  }
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!CUSTOMER_FIELDS.has(normalized)) continue;
    if (item && typeof item === "object" && !CONTAINER_FIELDS.has(normalized) && !Array.isArray(item)) continue;
    output[normalized] = customerSafeResult(item, depth + 1);
  }
  return output;
}
