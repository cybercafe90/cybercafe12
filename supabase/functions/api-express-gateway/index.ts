import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const DEFAULT_BASE_URL = "https://sandbox.api.apiexpress.in";
const ALLOWED_ORIGINS = new Set(["https://babacybercafe.in", "https://www.babacybercafe.in", "http://localhost:3000"]);
const SERVICES = new Set([
  "kyc_pan", "kyc_aadhaar_dl", "rc_verify", "bank_verify", "telecom_operator",
  "mobile_recharge", "fuel_price", "commodity_price", "weather", "air_quality", "security_risk",
]);
type ServiceName = "kyc_pan" | "kyc_aadhaar_dl" | "rc_verify" | "bank_verify" | "telecom_operator" | "mobile_recharge" | "fuel_price" | "commodity_price" | "weather" | "air_quality" | "security_risk";
type Json = Record<string, unknown>;

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://babacybercafe.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
}
function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}
function jsonObject(value: unknown): value is Json {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function str(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 && v.length <= max ? v : null;
}
function digits(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, "").toUpperCase();
  return v.length >= min && v.length <= max && /^[A-Z0-9]+$/.test(v) ? v : null;
}
function isInvalidProviderError(value: unknown): boolean {
  if (!jsonObject(value)) return false;
  const code = String(value.code ?? value.error_code ?? "").toUpperCase();
  const message = String(value.error ?? value.message ?? "").toUpperCase();
  return code.startsWith("INVALID_") || code === "NOT_FOUND" || message.includes("NOT_FOUND") || message.includes("INVALID_");
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function privateHash(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, "0")).join("");
}
function cacheDuration(service: ServiceName): number {
  if (service === "weather" || service === "air_quality") return 30 * 60;
  if (service === "fuel_price" || service === "commodity_price") return 6 * 60 * 60;
  if (service === "telecom_operator") return 24 * 60 * 60;
  return 0;
}
function normalizedCacheData(service: ServiceName, data: unknown): unknown {
  if (service !== "telecom_operator" || !jsonObject(data)) return data;
  const source = jsonObject(data.data) ? data.data : data;
  const allowed = ["operator", "operator_name", "circle", "circle_name", "type", "status"];
  const result: Json = {};
  for (const key of allowed) if (source[key] !== undefined) result[key] = source[key];
  return result;
}
function route(service: ServiceName, p: Json): { method: "GET" | "POST"; path: string; body?: Json; cacheInput?: string } | string {
  switch (service) {
    case "kyc_pan": {
      const pan = str(p.pan, 10)?.toUpperCase();
      if (!pan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return "A valid PAN format is required.";
      return { method: "POST", path: "/v1/kyc/pan", body: { pan } };
    }
    case "kyc_aadhaar_dl": {
      const type = str(p.doc_type, 12)?.toLowerCase();
      if (!["aadhaar", "dl", "voter"].includes(type ?? "")) return "doc_type must be aadhaar, dl, or voter.";
      const doc = str(p.document_number, 24);
      if (!doc) return "A valid document_number is required.";
      const path = type === "aadhaar" ? "/v1/kyc/aadhaar" : type === "dl" ? "/v1/kyc/dl" : "/v1/kyc/voter";
      return { method: "POST", path, body: { [type === "aadhaar" ? "aadhaar" : type === "dl" ? "dl_number" : "voter_id"]: doc } };
    }
    case "rc_verify": {
      const rc = str(p.rc_number, 24)?.toUpperCase();
      if (!rc || !/^[A-Z0-9-]+$/.test(rc)) return "A valid rc_number is required.";
      return { method: "POST", path: "/v1/rc/verify", body: { rc_number: rc } };
    }
    case "bank_verify": {
      const account = str(p.account_number, 34);
      const ifsc = str(p.ifsc, 11)?.toUpperCase();
      const vpa = str(p.vpa, 120);
      if (vpa && /^[\w.-]+@[\w.-]+$/.test(vpa)) return { method: "POST", path: "/v1/bank/verify", body: { vpa } };
      if (!account || !ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return "A valid account_number and IFSC, or VPA, is required.";
      return { method: "POST", path: "/v1/bank/verify", body: { account_number: account, ifsc } };
    }
    case "telecom_operator": {
      const mobile = str(p.mobile, 16)?.replace(/\D/g, "");
      if (!mobile || !/^\d{10,15}$/.test(mobile)) return "A valid mobile number is required.";
      return { method: "POST", path: "/v1/telecom/operator", body: { mobile }, cacheInput: mobile };
    }
    case "mobile_recharge": {
      const mobile = str(p.mobile, 16)?.replace(/\D/g, "");
      const operator = str(p.operator, 80);
      const amount = Number(p.amount);
      const type = str(p.type, 24);
      const ref_id = str(p.ref_id, 80);
      if (!mobile || !/^\d{10,15}$/.test(mobile) || !operator || !Number.isFinite(amount) || amount <= 0 || amount > 100000 || !type || !ref_id) return "Valid mobile, operator, amount, type, and ref_id are required.";
      return { method: "POST", path: "/v1/recharge", body: { mobile, operator, amount, type, ref_id } };
    }
    case "fuel_price": {
      const city = str(p.city, 80); if (!city) return "city is required.";
      return { method: "GET", path: `/v1/fuel?city=${encodeURIComponent(city)}`, cacheInput: city.toLowerCase() };
    }
    case "commodity_price": {
      const type = str(p.type, 24)?.toLowerCase(); const city = str(p.city, 80);
      if (!type || !["gold", "silver"].includes(type) || !city) return "type must be gold or silver and city is required.";
      return { method: "GET", path: `/v1/commodity/${encodeURIComponent(type)}?city=${encodeURIComponent(city)}`, cacheInput: `${type}:${city.toLowerCase()}` };
    }
    case "weather": case "air_quality": {
      const city = str(p.city, 80); if (!city) return "city is required.";
      return { method: "GET", path: `/v1/${service === "weather" ? "weather" : "aqi"}?city=${encodeURIComponent(city)}`, cacheInput: city.toLowerCase() };
    }
    case "security_risk": {
      const subject_type = str(p.subject_type, 24);
      const reference_id = str(p.reference_id, 100);
      if (!subject_type || !reference_id) return "subject_type and reference_id are required.";
      // Do not forward arbitrary PII. The provider integration must use its documented identifiers.
      const allowed: Json = { subject_type, reference_id };
      if (typeof p.metadata === "object" && p.metadata !== null && !Array.isArray(p.metadata)) allowed.metadata = p.metadata;
      return { method: "POST", path: "/v1/security/risk", body: allowed };
    }
  }
}
async function getUserAndRole(req: Request, admin: SupabaseClient): Promise<{user: User; role: string} | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !url || !anon) return null;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: roleRow, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle();
  if (roleError || !roleRow?.role) return null;
  return { user: data.user, role: String(roleRow.role) };
}
async function logCall(admin: SupabaseClient, userId: string, service: string, status: string, code: number) {
  // Metadata only. Never log request bodies, provider bodies, PAN, Aadhaar, bank details, VPA, or mobile.
  await admin.from("api_express_logs").insert({ user_id: userId, service_name: service, status, http_code: code });
}
async function readLogs(req: Request, admin: SupabaseClient, userId: string) {
  const limitRaw = Number(new URL(req.url).searchParams.get("limit") ?? 50);
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50));
  const { data, error } = await admin.from("api_express_logs").select("id,user_id,service_name,status,http_code,created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) return reply(req, { ok: false, service: "admin_logs", error: "Could not load API logs." }, 500);
  const rows = data ?? [];
  const counts = rows.reduce((acc: {total:number;success:number;errors:number;cache_hits:number}, row: {status:string}) => {
    acc.total++; if (row.status === "success") acc.success++; if (row.status === "error" || row.status === "rejected") acc.errors++; if (row.status === "cache_hit") acc.cache_hits++; return acc;
  }, {total:0,success:0,errors:0,cache_hits:0});
  return reply(req, { ok: true, service: "admin_logs", data: { items: rows, counts } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply(req, { ok: false, service: "unknown", error: "Origin not allowed." }, 403);
  if (req.method !== "POST") return reply(req, { ok: false, service: "unknown", error: "POST required." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("APIEXPRESS_API_KEY");
  const baseUrl = (Deno.env.get("APIEXPRESS_BASE_URL") || DEFAULT_BASE_URL).replace(/\/+$/, "");
  if (!supabaseUrl || !serviceRoleKey || !apiKey) return reply(req, { ok: false, service: "unknown", error: "Gateway is not configured." }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const identity = await getUserAndRole(req, admin);
  if (!identity) return reply(req, { ok: false, service: "unknown", error: "Authenticated account required." }, 401);

  let body: unknown;
  try { body = await req.json(); } catch { return reply(req, { ok: false, service: "unknown", error: "Invalid JSON body." }, 400); }
  if (!jsonObject(body) || typeof body.service !== "string" || !jsonObject(body.payload ?? {})) return reply(req, { ok: false, service: "unknown", error: "Expected { service, payload }." }, 400);
  const service = body.service;
  const payload = (body.payload ?? {}) as Json;
  if (service === "admin_logs") {
    if (!["owner", "admin"].includes(identity.role)) return reply(req, { ok: false, service, error: "Owner/admin authorization required." }, 403);
    return await readLogs(req, admin, identity.user.id);
  }
  if (!SERVICES.has(service)) return reply(req, { ok: false, service, error: "Unsupported service." }, 400);
  const serviceName = service as ServiceName;
  if (serviceName === "bank_verify" && !["owner", "admin", "agent"].includes(identity.role)) {
    await logCall(admin, identity.user.id, service, "rejected", 403);
    return reply(req, { ok: false, service, error: "Agent or owner authorization required." }, 403);
  }
  if (serviceName === "mobile_recharge" && !["owner", "admin", "agent"].includes(identity.role)) {
    await logCall(admin, identity.user.id, service, "rejected", 403);
    return reply(req, { ok: false, service, error: "Agent or owner authorization required." }, 403);
  }
  const routed = route(serviceName, payload);
  if (typeof routed === "string") {
    await logCall(admin, identity.user.id, service, "rejected", 400);
    return reply(req, { ok: false, service, error: routed }, 400);
  }

  const ttl = cacheDuration(serviceName);
  let cacheKey: string | null = null;
  if (ttl > 0 && routed.cacheInput) {
    const secret = apiKey;
    const material = serviceName === "telecom_operator"
      ? await privateHash(`${serviceName}:${routed.cacheInput}`, secret)
      : await sha256(`${serviceName}:${routed.cacheInput}`);
    cacheKey = `apx:${serviceName}:${material}`;
    const { data: cached } = await admin.from("api_express_cache").select("response,expires_at").eq("cache_key", cacheKey).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (cached?.response) {
      await logCall(admin, identity.user.id, service, "cache_hit", 200);
      return reply(req, { ok: true, service, data: cached.response, cached: true });
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}${routed.path}`, {
      method: routed.method,
      headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json", ...(routed.body ? { "Content-Type": "application/json" } : {}) },
      ...(routed.body ? { body: JSON.stringify(routed.body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    await logCall(admin, identity.user.id, service, "error", 502);
    return reply(req, { ok: false, service, error: "API Express could not be reached. Please try again later." }, 502);
  }

  let upstreamData: unknown;
  try { upstreamData = await upstream.json(); } catch { upstreamData = null; }
  if (!upstream.ok) {
    const invalid = isInvalidProviderError(upstreamData);
    await logCall(admin, identity.user.id, service, "error", upstream.status);
    const providerMessage = jsonObject(upstreamData) && typeof upstreamData.message === "string" ? upstreamData.message.slice(0, 180) : "";
    return reply(req, { ok: false, service, error: invalid ? (providerMessage || "The supplied details were not found or are invalid.") : (providerMessage || "The verification provider returned an error.") }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
  }

  const safeData = normalizedCacheData(serviceName, upstreamData);
  if (ttl > 0 && cacheKey) {
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    await admin.from("api_express_cache").upsert({ cache_key: cacheKey, service_name: serviceName, response: safeData, expires_at: expiresAt }, { onConflict: "cache_key" });
  }
  await logCall(admin, identity.user.id, service, "success", upstream.status);
  return reply(req, { ok: true, service, data: upstreamData, cached: false });
});
