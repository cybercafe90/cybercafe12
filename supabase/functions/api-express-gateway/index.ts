import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { parseApiExpressBaseUrl, readBoundedJson } from "../_shared/api-express-security.ts";

const ALLOWED_ORIGINS = new Set(["https://babacybercafe.in", "https://www.babacybercafe.in", "http://localhost:3000"]);
const SERVICES = new Set([
  "kyc_pan", "kyc_aadhaar_dl", "rc_verify", "bank_verify", "telecom_operator",
  "mobile_recharge", "fuel_price", "commodity_price", "weather", "air_quality", "security_risk",
]);
type ServiceName = "kyc_pan" | "kyc_aadhaar_dl" | "rc_verify" | "bank_verify" | "telecom_operator" | "mobile_recharge" | "fuel_price" | "commodity_price" | "weather" | "air_quality" | "security_risk";
type Json = Record<string, unknown>;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" &&
      (parsed.hostname === "babacybercafe.pages.dev" || parsed.hostname.endsWith(".babacybercafe.pages.dev"));
  } catch {
    return false;
  }
}
function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin && isAllowedOrigin(origin) ? origin : "https://babacybercafe.in",
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
  const allowed = ["operator", "operator_name", "circle", "circle_name", "type", "status", "connection", "ported"];
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
      if (type === "aadhaar" && p.consent !== true) return "Explicit Aadhaar consent is required before requesting OTP verification.";
      const path = type === "aadhaar" ? "/v1/kyc/aadhaar" : type === "dl" ? "/v1/kyc/dl" : "/v1/kyc/voter";
      return { method: "POST", path, body: type === "aadhaar" ? { aadhaar: doc, consent: true } : { [type === "dl" ? "dl_number" : "voter_id"]: doc } };
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
      return { method: "GET", path: `/v1/fuel/price?city=${encodeURIComponent(city)}`, cacheInput: city.toLowerCase() };
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
      const email_hash = str(p.email_hash, 80);
      const phone_hash = str(p.phone_hash, 80);
      const device_id = str(p.device_id, 120);
      const ip = str(p.ip, 64);
      if (!email_hash && !phone_hash && !device_id && !ip) return "Provide at least one hashed identity, device_id, or IP risk signal.";
      if (email_hash && !/^sha256:[a-f0-9]{64}$/i.test(email_hash)) return "email_hash must be a SHA-256 hex digest prefixed with sha256:.";
      if (phone_hash && !/^sha256:[a-f0-9]{64}$/i.test(phone_hash)) return "phone_hash must be a SHA-256 hex digest prefixed with sha256:.";
      const allowed: Json = {};
      if (email_hash) allowed.email_hash = email_hash;
      if (phone_hash) allowed.phone_hash = phone_hash;
      if (device_id) allowed.device_id = device_id;
      if (ip) allowed.ip = ip;
      return { method: "POST", path: "/v1/security/risk", body: allowed };
    }
  }
}
async function getUserAndRole(req: Request, admin: SupabaseClient): Promise<{user: User; roles: string[]} | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !url || !anon) return null;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: roleRows, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", data.user.id);
  if (roleError) return null;
  return { user: data.user, roles: (roleRows ?? []).map((row: {role:string}) => String(row.role)) };
}
async function logCall(admin: SupabaseClient, userId: string, service: string, status: string, code: number, environment: "sandbox" | "production") {
  // Metadata only. Never log request bodies, provider bodies, PAN, Aadhaar, bank details, VPA, or mobile.
  const { error } = await admin.from("api_express_logs").insert({ user_id: userId, service_name: service, status, http_code: code, environment });
  if (error) throw new Error("API audit logging is unavailable; request blocked.");
}
async function readLogs(req: Request, admin: SupabaseClient) {
  const limitRaw = 50;
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50));
  const { data, error } = await admin.from("api_express_logs").select("id,user_id,service_name,status,http_code,created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) return reply(req, { ok: false, service: "admin_logs", error: "Could not load API logs." }, 500);
  const rows = data ?? [];
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [totalResult, successResult, errorResult, cacheResult, quotaResult] = await Promise.all([
    admin.from("api_express_logs").select("id", { count: "exact", head: true }),
    admin.from("api_express_logs").select("id", { count: "exact", head: true }).eq("status", "success"),
    admin.from("api_express_logs").select("id", { count: "exact", head: true }).eq("status", "error"),
    admin.from("api_express_logs").select("id", { count: "exact", head: true }).eq("status", "cache_hit"),
    admin.from("api_express_quota_counters").select("used").eq("bucket_key", "global:production").eq("window_start", monthStart.toISOString()).maybeSingle(),
  ]);
  if ([totalResult, successResult, errorResult, cacheResult].some(result => result.error) || quotaResult.error) {
    return reply(req, { ok: false, service: "admin_logs", error: "Could not calculate API usage." }, 500);
  }
  const used = Number(quotaResult.data?.used ?? 0);
  const quotaLimit = Number(Deno.env.get("APIEXPRESS_FREE_CALL_LIMIT") ?? 1000);
  const counts = {
    total: totalResult.count ?? 0,
    success: successResult.count ?? 0,
    errors: errorResult.count ?? 0,
    cache_hits: cacheResult.count ?? 0,
  };
  return reply(req, {
    ok: true,
    service: "admin_logs",
    data: {
      items: rows,
      counts,
      quota: {
        configured_limit: quotaLimit,
        estimated_upstream_attempts: used,
        remaining_estimate: Math.max(0, quotaLimit - used),
        note: "Usage is counted by atomic quota reservations; API Express account usage remains authoritative.",
      },
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) return reply(req, { ok: false, service: "unknown", error: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return reply(req, { ok: false, service: "unknown", error: "POST required." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("APIEXPRESS_API_KEY");
  const providerConfig = parseApiExpressBaseUrl(Deno.env.get("APIEXPRESS_BASE_URL"));
  if (!supabaseUrl || !serviceRoleKey || !apiKey || !providerConfig) {
    return reply(req, { ok: false, service: "unknown", error: "Gateway is not configured with a valid API Express provider URL and key." }, 503);
  }
  const { baseUrl, environment } = providerConfig;

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const identity = await getUserAndRole(req, admin);
  if (!identity) return reply(req, { ok: false, service: "unknown", error: "Authenticated account required." }, 401);

  const parsedBody = await readBoundedJson(req.body, 16 * 1024, req.headers.get("content-length"));
  if (!parsedBody.ok) {
    return reply(req, { ok: false, service: "unknown", error: parsedBody.reason === "too_large" ? "Request body is too large." : "Invalid JSON body." }, 400);
  }
  const body: unknown = parsedBody.value;
  if (!jsonObject(body) || typeof body.service !== "string" || !jsonObject(body.payload ?? {})) {
    return reply(req, { ok: false, service: "unknown", error: "Expected { service, payload }." }, 400);
  }
  const service = body.service;
  const payload = (body.payload ?? {}) as Json;
  if (service === "admin_logs") {
    if (!identity.roles.some(role => ["owner", "admin"].includes(role))) return reply(req, { ok: false, service, error: "Owner/admin authorization required." }, 403);
    return await readLogs(req, admin);
  }
  if (!SERVICES.has(service)) return reply(req, { ok: false, service, error: "Unsupported service." }, 400);
  const serviceName = service as ServiceName;
  if (serviceName === "bank_verify" && !identity.roles.some(role => ["owner", "admin", "agent"].includes(role))) {
    await logCall(admin, identity.user.id, service, "rejected", 403, environment);
    return reply(req, { ok: false, service, error: "Agent or owner authorization required." }, 403);
  }
  if (serviceName === "mobile_recharge" && !identity.roles.some(role => ["owner", "admin", "agent"].includes(role))) {
    await logCall(admin, identity.user.id, service, "rejected", 403, environment);
    return reply(req, { ok: false, service, error: "Agent or owner authorization required." }, 403);
  }
  const routed = route(serviceName, payload);
  if (typeof routed === "string") {
    await logCall(admin, identity.user.id, service, "rejected", 400, environment);
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
      await logCall(admin, identity.user.id, service, "cache_hit", 200, environment);
      return reply(req, { ok: true, service, data: cached.response, cached: true });
    }
  }

  const configuredLimitRaw = Number(Deno.env.get("APIEXPRESS_FREE_CALL_LIMIT") ?? 1000);
  const configuredLimit = Number.isSafeInteger(configuredLimitRaw) && configuredLimitRaw > 0
    ? Math.min(configuredLimitRaw, 1000000)
    : 1000;
  const monthlyUsageOffsetRaw = Deno.env.get("APIEXPRESS_MONTHLY_USAGE_OFFSET") ?? "0";
  const monthlyUsageOffset = Number(monthlyUsageOffsetRaw);
  if (!Number.isSafeInteger(monthlyUsageOffset) || monthlyUsageOffset < 0 || monthlyUsageOffset > configuredLimit) {
    return reply(req, { ok: false, service, error: "API Express monthly usage baseline is invalid. Check gateway configuration." }, 503);
  }
  const { data: reservation, error: reservationError } = await admin.rpc("reserve_api_express_quota", {
    p_user_id: identity.user.id,
    p_environment: environment,
    p_monthly_limit: configuredLimit,
    p_monthly_usage_offset: monthlyUsageOffset,
    p_user_minute_limit: 20,
  });
  if (reservationError || !jsonObject(reservation)) {
    return reply(req, { ok: false, service, error: "API quota protection is temporarily unavailable." }, 503);
  }
  if (reservation.allowed !== true) {
    await logCall(admin, identity.user.id, service, "rejected", 429, environment);
    const monthlyLimitReached = reservation.reason === "monthly_quota";
    return reply(req, {
      ok: false,
      service,
      error: monthlyLimitReached
        ? "The configured API Express call allowance has been reached. Please check the provider account quota."
        : "Request limit reached. Please wait before trying again.",
    }, 429);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}${routed.path}`, {
      method: routed.method,
      headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json", ...(routed.body ? { "Content-Type": "application/json" } : {}) },
      ...(routed.body ? { body: JSON.stringify(routed.body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    await logCall(admin, identity.user.id, service, "error", 502, environment);
    return reply(req, { ok: false, service, error: "API Express could not be reached. Please try again later." }, 502);
  }

  const parsedUpstream = await readBoundedJson(upstream.body, 1024 * 1024, upstream.headers.get("content-length"));
  if (!parsedUpstream.ok) {
    await logCall(admin, identity.user.id, service, "error", 502, environment);
    return reply(req, { ok: false, service, error: "The verification provider returned an invalid or oversized response." }, 502);
  }
  const upstreamData: unknown = parsedUpstream.value;
  if (!upstream.ok) {
    const invalid = isInvalidProviderError(upstreamData);
    await logCall(admin, identity.user.id, service, "error", upstream.status, environment);
    return reply(req, { ok: false, service, error: invalid ? "The supplied details were not found or are invalid." : "The verification provider returned an error." }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
  }

  const safeData = normalizedCacheData(serviceName, upstreamData);
  if (ttl > 0 && cacheKey) {
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    await admin.from("api_express_cache").upsert({ cache_key: cacheKey, service_name: serviceName, response: safeData, expires_at: expiresAt }, { onConflict: "cache_key" });
  }
  await logCall(admin, identity.user.id, service, "success", upstream.status, environment);
  return reply(req, { ok: true, service, data: safeData, cached: false });
});
