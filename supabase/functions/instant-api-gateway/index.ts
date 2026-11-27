import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { customerSafeResult } from "../_shared/customer_safe.ts";
import { normalizeRcPdfInput, parseProviderCost } from "../_shared/rc_pdf.ts";
import { isDefinitiveProviderFailure } from "../_shared/provider_http.ts";

const ORIGINS = new Set(["https://babacybercafe.in", "https://www.babacybercafe.in"]);
const BASE_HOST = "api.smmtopserver.shop";
const encoder = new TextEncoder();

function cors(request: Request) {
  const origin = request.headers.get("origin") || "";
  let allowed = ORIGINS.has(origin);
  try { const u = new URL(origin); allowed ||= u.protocol === "https:" && (u.hostname === "babacybercafe.pages.dev" || u.hostname.endsWith(".babacybercafe.pages.dev")); } catch { /* no origin */ }
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://babacybercafe.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function reply(request: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors(request), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function hex(buf: ArrayBuffer) { return [...new Uint8Array(buf)].map(v => v.toString(16).padStart(2, "0")).join(""); }
function b64(bytes: Uint8Array) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function unb64(value: string) { const s = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); }
async function sha(value: string) { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
function equal(a: string, b: string) { if (a.length !== b.length) return false; let n = 0; for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i); return n === 0; }
async function encryptionKey() {
  const secret = Deno.env.get("INSTANT_API_DATA_ENCRYPTION_KEY");
  if (!secret || secret.length < 32) throw new Error("INSTANT_API_DATA_ENCRYPTION_KEY is missing or too short.");
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encrypt(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(JSON.stringify(value)));
  return b64(iv) + "." + b64(new Uint8Array(cipher));
}
async function decrypt(value: string) {
  const [iv, cipher] = value.split(".");
  if (!iv || !cipher) throw new Error("Encrypted record is invalid.");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await encryptionKey(), unb64(cipher));
  return JSON.parse(new TextDecoder().decode(plain));
}
function randomToken() { return b64(crypto.getRandomValues(new Uint8Array(32))); }
async function consumeRateLimit(admin: ReturnType<typeof client>, request: Request, purpose: string, identifier: string, limit: number, windowMinutes: number) {
  const secret = Deno.env.get("TRACK_RATE_SECRET");
  if (!secret) throw new Error("Rate-limit protection is not configured.");
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown";
  const value = secret + ":" + purpose + ":" + ip + ":" + identifier;
  const scopeHash = await sha(value);
  const windowMs = windowMinutes * 60_000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const { data, error } = await admin.rpc("consume_rate_limit", { p_scope_hash: scopeHash, p_window_start: windowStart, p_limit: limit });
  if (error) throw new Error("Rate-limit storage is unavailable.");
  return data === true;
}
async function verifyOwner(request: Request, admin: ReturnType<typeof client>) {
  const token = request.headers.get("authorization")?.match(/^Bearer\\s+(.+)$/i)?.[1];
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!token || !anonKey || !url) throw new Error("Unauthorized.");
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) throw new Error("Unauthorized.");
  const { data: role, error: roleError } = await admin.from("user_roles")
    .select("role").eq("user_id", user.id).eq("role", "owner").maybeSingle();
  if (roleError || role?.role !== "owner") throw new Error("Owner authorization required.");
  return user;
}

function client() {
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase backend is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
async function razorpay(path: string, method: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
  const id = Deno.env.get("RAZORPAY_KEY_ID"), secret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!id || !secret) throw new Error("Razorpay is not configured.");
  const response = await fetch("https://api.razorpay.com/v1" + path, {
    method, headers: { Authorization: "Basic " + btoa(id + ":" + secret), "Content-Type": "application/json", ...extraHeaders },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Razorpay request failed with status " + response.status);
  return json;
}
type Service = { slug: string; endpoint_url: string; http_method: string; api_key_secret_name: string; customer_price: number; provider_cost: number | null; is_enabled: boolean; authorization_verified: boolean };
function validateInput(slug: string, input: Record<string, unknown>) {
  const fields: Record<string, string[]> = {
    "voter-mobile-link": ["epic_no", "mobile_no"],
    "aadhaar-to-pan": ["aadhaar_number"],
    "pan-verification": ["pan"],
    "vehicle-rc-pdf": ["rcno"],
    "number-details": ["mobileNumber"],
    "driving-licence-hd-pdf": ["dl", "dob"],
    "vahan-to-mobile": ["vrn"],
    "voter-status": ["epic"],
  };
  const required = fields[slug];
  if (!required) throw new Error("Unsupported service.");
  const output: Record<string, string> = {};
  for (const field of required) {
    const value = input[field];
    if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 64) throw new Error("Please enter valid " + field.replaceAll("_", " ") + ".");
    output[field] = value.trim();
  }
  if (slug === "aadhaar-to-pan" && !/^\d{12}$/.test(output.aadhaar_number)) throw new Error("Enter a valid 12-digit Aadhaar number.");
  if (slug === "pan-verification" && !/^[A-Z]{5}\d{4}[A-Z]$/.test(output.pan.toUpperCase())) throw new Error("Enter a valid PAN format.");
  if (slug === "voter-mobile-link" && !/^\d{10}$/.test(output.mobile_no.replace(/\D/g, ""))) throw new Error("Enter a valid 10-digit mobile number.");
  if (slug === "number-details" && !/^\d{10}$/.test(output.mobileNumber.replace(/\D/g, ""))) throw new Error("Enter a valid 10-digit mobile number.");
  if (slug === "driving-licence-hd-pdf" && !/^\d{2}-\d{2}-\d{4}$/.test(output.dob)) throw new Error("Date of birth must be DD-MM-YYYY.");
  if (slug === "vehicle-rc-pdf") return normalizeRcPdfInput(input);
  if (slug === "vahan-to-mobile" && !/^[A-Z0-9 -]{5,15}$/i.test(output.vrn)) throw new Error("Enter a valid vehicle registration number.");
  return output;
}
async function callProvider(service: Service, input: Record<string, string>) {
  const endpoint = new URL(service.endpoint_url);
  if (endpoint.protocol !== "https:" || endpoint.hostname !== BASE_HOST || endpoint.username || endpoint.password) throw new Error("Provider endpoint is not on the approved host.");
  if (service.slug === "vehicle-rc-pdf") { endpoint.pathname = "/api/rc-pdf.php"; endpoint.search = ""; endpoint.hash = ""; }
  const apiKey = Deno.env.get(service.api_key_secret_name);
  if (!apiKey) throw new Error("Provider credential is missing: " + service.api_key_secret_name);
  const params = new URLSearchParams(input);
  const headers = new Headers({ Accept: "application/json" });
  let url = endpoint.toString();
  let body: string | undefined;
  if (service.slug === "voter-mobile-link") {
    params.set("api_key", apiKey);
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    body = params.toString();
  } else if (service.slug === "aadhaar-to-pan" || service.slug === "number-details") {
    params.set("api_key", apiKey);
    url += "?" + params.toString();
  } else {
    // PAN Verification's executable cURL examples use Bearer auth.
    // Do not also place the credential in the URL query string.
    headers.set("Authorization", "Bearer " + apiKey);
    url += "?" + params.toString();
  }
  const response = await fetch(url, { method: service.http_method, headers, ...(body ? { body } : {}), signal: AbortSignal.timeout(25000), redirect: "error" });
  if (!response.ok && isDefinitiveProviderFailure(response.status)) {
    return { __provider_failed: true, provider_error_code: "provider_http_" + response.status };
  }
  if (!response.ok) throw new Error("Provider returned HTTP " + response.status);
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  const maxResponseBytes = service.slug === "vehicle-rc-pdf" ? 8_000_000 : 2_000_000;
  if (raw.length > maxResponseBytes) throw new Error("Provider response exceeded the permitted size.");
  let result: unknown;
  if (contentType.includes("application/json") || raw.trimStart().startsWith("{") || raw.trimStart().startsWith("[")) {
    try { result = JSON.parse(raw); } catch { result = { raw_text: raw.slice(0, 2000) }; }
  } else {
    result = { content_type: contentType, response_text: raw.slice(0, 2000) };
  }
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (record.status !== true) {
      const state = typeof record.status === "string" ? record.status.toLowerCase() : "";
      const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
      if (["pending", "processing", "queued"].includes(state) || /pending|processing|queued|in progress/.test(message)) {
        return { __provider_pending: true, provider_order_id: typeof record.order_id === "string" ? record.order_id : null };
      }
      return { __provider_failed: true, provider_error: typeof record.message === "string" ? record.message.slice(0, 120) : "Provider did not confirm success." };
    }
  }
  return result;
}
type InstantOrder = { id: string; service_slug: string; request_ciphertext: string; status: string; customer_price: number; razorpay_payment_id?: string | null };
async function fulfill(admin: ReturnType<typeof client>, order: InstantOrder) {
  const { data: service, error: serviceError } = await admin.from("instant_api_services").select("*").eq("slug", order.service_slug).maybeSingle();
  if (serviceError || !service || !service.is_enabled || !service.authorization_verified) throw new Error("Service is not authorised for fulfilment.");
  const stored = await decrypt(order.request_ciphertext) as { providerInput: Record<string, string> };
  const { data: claimed, error: claimError } = await admin.from("instant_api_orders").update({ status: "processing" }).eq("id", order.id).eq("status", "paid").select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) {
    const { data: latest } = await admin.from("instant_api_orders").select("status").eq("id", order.id).maybeSingle();
    return { status: latest?.status || "processing" };
  }
  try {
    const result = await callProvider(service as Service, stored.providerInput) as Record<string, unknown>;
    if (result.__provider_pending === true) {
      await admin.from("instant_api_orders").update({
        status: "fulfillment_unknown",
        provider_order_id: typeof result.provider_order_id === "string" ? result.provider_order_id : null,
        provider_error_code: "provider_pending",
      }).eq("id", order.id).eq("status", "processing");
      return { status: "fulfillment_unknown", message: "Provider accepted the request but has not confirmed completion. Do not submit it again." };
    }
    if (result.__provider_failed === true) {
      await admin.from("instant_api_orders").update({ status: "refund_pending", provider_error_code: "provider_rejected" }).eq("id", order.id).eq("status", "processing");
      try {
        if (!order.razorpay_payment_id) throw new Error("Captured payment reference is missing.");
        const refund = await razorpay("/payments/" + encodeURIComponent(order.razorpay_payment_id) + "/refund", "POST", {
          amount: Math.round(Number(order.customer_price) * 100),
          notes: { instant_api_order_id: order.id, reason: "provider_rejected" },
        });
        const finalStatus = refund.status === "processed" ? "refunded" : "refund_pending";
        await admin.from("instant_api_orders").update({ status: finalStatus, provider_error_code: finalStatus === "refunded" ? "provider_rejected_refunded" : "refund_processing" }).eq("id", order.id).eq("status", "refund_pending");
        return { status: finalStatus, message: finalStatus === "refunded" ? "The provider could not complete the request. Your payment has been refunded." : "The provider could not complete the request. Your refund is being processed." };
      } catch {
        await admin.from("instant_api_orders").update({ status: "refund_pending", provider_error_code: "refund_request_failed" }).eq("id", order.id);
        return { status: "refund_pending", message: "The provider could not complete the request. Your refund needs reconciliation; contact support if it is not reflected." };
      }
    }
    const cipher = await encrypt(result);
    const actualCost = parseProviderCost(result.cost_deducted) ?? service.provider_cost;
    const { error } = await admin.from("instant_api_orders").update({
      status: "succeeded", result_ciphertext: cipher, provider_cost_actual: actualCost,
      provider_order_id: typeof result.order_id === "string" ? result.order_id : null,
      fulfilled_at: new Date().toISOString(), provider_error_code: null,
    }).eq("id", order.id).eq("status", "processing");
    if (error) throw error;
    return { status: "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider request failed.";
    await admin.from("instant_api_orders").update({
      status: "fulfillment_unknown", provider_error_code: message.slice(0, 80),
    }).eq("id", order.id).eq("status", "processing");
    return { status: "fulfillment_unknown" };
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  if (request.method !== "POST") return reply(request, { error: "Method not allowed." }, 405);
  const origin = request.headers.get("origin");
  if (origin && cors(request)["Access-Control-Allow-Origin"] !== origin) return reply(request, { error: "Origin not allowed." }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 12000) return reply(request, { error: "Request too large." }, 413);
    const body = JSON.parse(raw);
    const action = typeof body.action === "string" ? body.action : "";
    const admin = client();
    if (action !== "process_webhook") {
      const identifier = action === "create_order" && typeof body.serviceSlug === "string" ? body.serviceSlug : "public";
      const limit = action === "create_order" ? 5 : action === "verify_payment" ? 15 : action === "retrieve_order" ? 40 : 60;
      if (!await consumeRateLimit(admin, request, "instant-api-" + action, identifier, limit, 15)) return reply(request, { error: "Too many attempts. Please wait and try again." }, 429);
    }

    if (action === "admin_refund") {
      let actor;
      try { actor = await verifyOwner(request, admin); }
      catch (reason) {
        const message = reason instanceof Error ? reason.message : "";
        return reply(request, { error: message.includes("authorization") ? "Owner authorization required." : "Verified owner sign-in required." }, message.includes("authorization") ? 403 : 401);
      }
      const orderId = typeof body.orderId === "string" ? body.orderId : "";
      if (!/^[0-9a-f-]{36}$/i.test(orderId)) return reply(request, { error: "A valid order ID is required." }, 400);
      const { data: order, error: orderError } = await admin.from("instant_api_orders")
        .select("id,service_slug,customer_price,status,provider_error_code,razorpay_order_id,razorpay_payment_id,razorpay_refund_id,refund_status,refund_idempotency_key")
        .eq("id", orderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return reply(request, { error: "Order not found." }, 404);
      if (order.status === "refunded" && order.razorpay_refund_id) return reply(request, { status: "refunded", refundId: order.razorpay_refund_id, duplicate: true });
      if (order.status !== "refund_pending" || !order.razorpay_payment_id) {
        return reply(request, { error: "Only captured orders awaiting refund resolution can be refunded." }, 409);
      }
      const expectedAmount = Math.round(Number(order.customer_price) * 100);
      if (!Number.isSafeInteger(expectedAmount) || expectedAmount < 100) return reply(request, { error: "Stored refund amount is invalid." }, 409);
      const payment = await razorpay("/payments/" + encodeURIComponent(order.razorpay_payment_id), "GET");
      if (payment.status !== "captured" || payment.captured !== true || payment.currency !== "INR" ||
          payment.order_id !== order.razorpay_order_id || Number(payment.amount) !== expectedAmount) {
        return reply(request, { error: "Razorpay payment is not captured or its order/amount does not match. No refund was sent." }, 409);
      }
      const refundList = await razorpay("/payments/" + encodeURIComponent(order.razorpay_payment_id) + "/refunds", "GET");
      const refunds = Array.isArray(refundList.items) ? refundList.items : [];
      const matched = refunds.find((item: Record<string, unknown>) =>
        Number(item.amount) === expectedAmount &&
        item.notes && typeof item.notes === "object" &&
        (item.notes as Record<string, unknown>).instant_api_order_id === order.id
      );
      if (matched && typeof matched.id === "string") {
        const status = matched.status === "processed" ? "refunded" : "refund_pending";
        const { error: syncError } = await admin.from("instant_api_orders").update({
          razorpay_refund_id: matched.id, refund_status: matched.status === "processed" ? "processed" : "pending",
          status, refund_processed_at: matched.status === "processed" ? new Date().toISOString() : null,
          provider_error_code: status === "refunded" ? "provider_rejected_refunded" : "refund_processing",
        }).eq("id", order.id);
        if (syncError) throw syncError;
        return reply(request, { status, refundId: matched.id, reconciled: true });
      }
      const refundedAmount = Number(payment.amount_refunded || 0);
      if (refundedAmount > 0) return reply(request, { error: "Razorpay shows another refund or partial refund for this payment. Manual reconciliation is required; no new refund was sent." }, 409);
      const idempotencyKey = order.refund_idempotency_key || "instant-api-refund-" + order.id;
      const { error: reserveError } = await admin.from("instant_api_orders").update({
        refund_idempotency_key: idempotencyKey,
        refund_status: "pending",
        refund_requested_at: new Date().toISOString(),
      }).eq("id", order.id).eq("status", "refund_pending");
      if (reserveError) throw reserveError;
      try {
        const refund = await razorpay("/payments/" + encodeURIComponent(order.razorpay_payment_id) + "/refund", "POST", {
          amount: expectedAmount,
          notes: { instant_api_order_id: order.id, reason: "provider_rejected", initiated_by: actor.id },
        }, { "X-Refund-Idempotency": idempotencyKey });
        if (typeof refund.id !== "string") throw new Error("Razorpay did not return a refund reference.");
        const processed = refund.status === "processed";
        const { error: saveError } = await admin.from("instant_api_orders").update({
          razorpay_refund_id: refund.id, refund_status: processed ? "processed" : "pending",
          status: processed ? "refunded" : "refund_pending",
          refund_processed_at: processed ? new Date().toISOString() : null,
          provider_error_code: processed ? "provider_rejected_refunded" : "refund_processing",
        }).eq("id", order.id);
        if (saveError) throw saveError;
        await admin.from("admin_audit_logs").insert({
          actor_id: actor.id, action: "instant_api_refund_requested", entity_type: "instant_api_orders",
          entity_id: order.id, metadata: { refund_id: refund.id, amount_paise: expectedAmount, refund_status: refund.status },
        });
        return reply(request, { status: processed ? "refunded" : "refund_pending", refundId: refund.id });
      } catch {
        await admin.from("instant_api_orders").update({ status: "refund_pending", refund_status: "pending", provider_error_code: "refund_reconciliation_required" }).eq("id", order.id);
        return reply(request, { status: "refund_pending", reconciliationRequired: true, message: "Refund request outcome is uncertain. Retry the reconciliation action; the same idempotency key will be reused." }, 202);
      }
    }

    if (action === "catalog") {
      const { data, error } = await admin.from("instant_api_services").select("slug,name,description,customer_price,is_featured,sort_order,is_enabled,authorization_verified").eq("is_enabled", true).eq("authorization_verified", true).order("sort_order");
      if (error) throw error;
      return reply(request, { services: data ?? [] });
    }

    if (action === "create_order") {
      if (body.consent !== true || body.authorisedUse !== true) return reply(request, { error: "Please confirm consent and that you are authorised to request this record." }, 400);
      if (typeof body.lawfulPurpose !== "string" || body.lawfulPurpose.trim().length < 8 || body.lawfulPurpose.length > 300) return reply(request, { error: "Please provide a brief lawful purpose." }, 400);
      const slug = typeof body.serviceSlug === "string" ? body.serviceSlug : "";
      const input = validateInput(slug, body.input && typeof body.input === "object" ? body.input : {});
      const { data: service, error } = await admin.from("instant_api_services").select("*").eq("slug", slug).eq("is_enabled", true).eq("authorization_verified", true).maybeSingle();
      if (error) throw error;
      if (!service) return reply(request, { error: "This service is not currently available." }, 409);
      const secret = Deno.env.get(service.api_key_secret_name);
      if (!secret) return reply(request, { error: "Service credentials are not configured. Please contact support." }, 503);
      if (!Deno.env.get("RAZORPAY_KEY_ID") || !Deno.env.get("RAZORPAY_KEY_SECRET")) return reply(request, { error: "Payment gateway is not configured." }, 503);
      const idem = request.headers.get("x-idempotency-key") || body.idempotencyKey;
      if (typeof idem !== "string" || idem.length < 16 || idem.length > 128) return reply(request, { error: "A valid idempotency key is required." }, 400);
      const idemHash = await sha(idem);
      const { data: existing } = await admin.from("instant_api_orders").select("*").eq("idempotency_key_hash", idemHash).maybeSingle();
      if (existing) {
        const token = await decrypt(existing.retrieval_token_ciphertext);
        return reply(request, { orderId: existing.id, retrievalToken: token, razorpayOrderId: existing.razorpay_order_id, amount: Math.round(Number(existing.customer_price) * 100), currency: "INR", keyId: Deno.env.get("RAZORPAY_KEY_ID"), reused: true });
      }
      const token = randomToken();
      const requestCipher = await encrypt({ providerInput: input, lawfulPurpose: body.lawfulPurpose.trim() });
      const tokenCipher = await encrypt(token);
      const { data: order, error: insertError } = await admin.from("instant_api_orders").insert({
        service_slug: slug, customer_price: service.customer_price, provider_cost_at_order: service.provider_cost,
        status: "payment_pending", idempotency_key_hash: idemHash, request_ciphertext: requestCipher,
        retrieval_token_hash: await sha(token), retrieval_token_ciphertext: tokenCipher,
      }).select("*").single();
      if (insertError) throw insertError;
      try {
        const amount = Math.round(Number(service.customer_price) * 100);
        if (!Number.isSafeInteger(amount) || amount < 100) throw new Error("Invalid service price.");
        const rp = await razorpay("/orders", "POST", { amount, currency: "INR", receipt: order.id, notes: { instant_api_order_id: order.id, service_slug: slug } });
        if (typeof rp.id !== "string" || rp.amount !== amount || rp.currency !== "INR") throw new Error("Payment gateway returned an invalid order.");
        const { error: saveError } = await admin.from("instant_api_orders").update({ razorpay_order_id: rp.id }).eq("id", order.id);
        if (saveError) throw saveError;
        return reply(request, { orderId: order.id, retrievalToken: token, razorpayOrderId: rp.id, amount, currency: "INR", keyId: Deno.env.get("RAZORPAY_KEY_ID") });
      } catch (error) {
        await admin.from("instant_api_orders").update({ status: "failed", provider_error_code: "payment_order_creation_failed" }).eq("id", order.id);
        throw error;
      }
    }

    if (action === "verify_payment") {
      const orderId = typeof body.orderId === "string" ? body.orderId : "";
      const token = typeof body.retrievalToken === "string" ? body.retrievalToken : "";
      const rpOrder = typeof body.razorpayOrderId === "string" ? body.razorpayOrderId : "";
      const paymentId = typeof body.razorpayPaymentId === "string" ? body.razorpayPaymentId : "";
      const signature = typeof body.razorpaySignature === "string" ? body.razorpaySignature : "";
      if (!/^[0-9a-f-]{36}$/i.test(orderId) || !token || !rpOrder || !paymentId || !/^[a-f0-9]{64}$/i.test(signature)) return reply(request, { error: "Payment verification data is invalid." }, 400);
      const { data: order, error } = await admin.from("instant_api_orders").select("*").eq("id", orderId).maybeSingle();
      if (error) throw error;
      if (!order || !equal(await sha(token), order.retrieval_token_hash) || order.razorpay_order_id !== rpOrder) return reply(request, { error: "Order could not be verified." }, 404);
      if (order.status === "succeeded") return reply(request, { verified: true, status: "succeeded" });
      const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
      if (!secret || !equal(await hmac(secret, rpOrder + "|" + paymentId), signature.toLowerCase())) return reply(request, { error: "Payment signature is invalid." }, 400);
      const remote = await razorpay("/payments/" + encodeURIComponent(paymentId), "GET");
      if (remote.order_id !== rpOrder || Number(remote.amount) !== Math.round(Number(order.customer_price) * 100) || remote.currency !== "INR" || remote.status !== "captured" || remote.captured !== true) return reply(request, { error: "Payment is not captured or amount does not match." }, 409);
      const { data: updated, error: updateError } = await admin.from("instant_api_orders").update({ status: "paid", razorpay_payment_id: paymentId, paid_at: new Date().toISOString() }).eq("id", order.id).in("status", ["payment_pending", "paid"]).select("*").maybeSingle();
      if (updateError) throw updateError;
      const current = updated || order;
      const result = await fulfill(admin, current);
      return reply(request, { verified: true, orderId, ...result });
    }

    if (action === "process_webhook") {
      const internalKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!internalKey || request.headers.get("x-internal-gateway-key") !== internalKey) return reply(request, { error: "Not authorised." }, 401);
      const orderId = typeof body.orderId === "string" ? body.orderId : "";
      const { data: order, error } = await admin.from("instant_api_orders").select("*").eq("id", orderId).maybeSingle();
      if (error) throw error;
      if (!order) return reply(request, { error: "Order not found." }, 404);
      if (order.status === "succeeded") return reply(request, { status: "succeeded", duplicate: true });
      if (order.status !== "paid") return reply(request, { status: order.status, duplicate: true });
      return reply(request, await fulfill(admin, order));
    }

    if (action === "retrieve_order") {
      const orderId = typeof body.orderId === "string" ? body.orderId : "";
      const token = typeof body.retrievalToken === "string" ? body.retrievalToken : "";
      const { data: order, error } = await admin.from("instant_api_orders").select("id,status,result_ciphertext,result_expires_at,created_at").eq("id", orderId).maybeSingle();
      if (error) throw error;
      if (!order || !token || !equal(await sha(token), (await admin.from("instant_api_orders").select("retrieval_token_hash").eq("id", orderId).single()).data?.retrieval_token_hash || "")) return reply(request, { error: "Order not found." }, 404);
      if (new Date(order.result_expires_at).getTime() < Date.now()) return reply(request, { error: "This result has expired. Contact support for assistance." }, 410);
      const result = order.result_ciphertext ? customerSafeResult(await decrypt(order.result_ciphertext)) : null;
      return reply(request, { orderId: order.id, status: order.status, result });
    }
    return reply(request, { error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("instant-api-gateway:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return reply(request, { error: "Instant API is temporarily unavailable. Please try again later." }, 503);
  }
});
