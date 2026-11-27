import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const ORIGINS = new Set(["https://babacybercafe.in", "https://www.babacybercafe.in"]);
const encoder = new TextEncoder();

function cors(request: Request) {
  const origin = request.headers.get("origin") || "";
  let allowed = ORIGINS.has(origin);
  try {
    const url = new URL(origin);
    allowed ||= url.protocol === "https:" && (url.hostname === "babacybercafe.pages.dev" || url.hostname.endsWith(".babacybercafe.pages.dev"));
  } catch { /* non-browser request */ }
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://babacybercafe.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function reply(request: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(request), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function client() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase backend is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function sha(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function rateLimit(admin: ReturnType<typeof client>, request: Request, action: string) {
  const secret = Deno.env.get("TRACK_RATE_SECRET");
  if (!secret) throw new Error("Rate-limit protection is not configured.");
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown";
  const scope = await sha(secret + ":instant-api-cases:" + action + ":" + ip);
  const windowMs = 15 * 60_000;
  const start = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const { data, error } = await admin.rpc("consume_rate_limit", { p_scope_hash: scope, p_window_start: start, p_limit: action === "submit_case" ? 5 : 30 });
  if (error) throw new Error("Request protection is temporarily unavailable.");
  return data === true;
}

async function getCustomerOrder(admin: ReturnType<typeof client>, reference: string, token: string) {
  if (!/^BBC-20\d{2}-\d{6,8}$/.test(reference) || token.length < 24 || token.length > 128) return null;
  const { data, error } = await admin.from("instant_api_orders").select("id,service_reference,service_slug,customer_price,currency,status,refund_status,refund_amount,refund_reference,created_at,paid_at,fulfilled_at,result_expires_at,retrieval_token_hash,razorpay_payment_id").eq("service_reference", reference).maybeSingle();
  if (error) throw error;
  if (!data || !safeEqual(await sha(token), data.retrieval_token_hash)) return null;
  return data;
}

async function requireOwner(admin: ReturnType<typeof client>, request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data.user) return null;
  const { data: role, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "owner").maybeSingle();
  if (roleError || role?.role !== "owner") return null;
  return data.user;
}

async function razorpay(path: string, method: string, body?: unknown) {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !secret) throw new Error("Razorpay refund credentials are not configured.");
  const response = await fetch("https://api.razorpay.com/v1" + path, {
    method,
    headers: { Authorization: "Basic " + btoa(keyId + ":" + secret), "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Razorpay returned HTTP " + response.status);
  return data;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  if (request.method !== "POST") return reply(request, { error: "Method not allowed." }, 405);
  const origin = request.headers.get("origin");
  if (origin && cors(request)["Access-Control-Allow-Origin"] !== origin) return reply(request, { error: "Origin not allowed." }, 403);

  try {
    const raw = await request.text();
    if (raw.length > 10000) return reply(request, { error: "Request too large." }, 413);
    const body = JSON.parse(raw);
    const action = typeof body.action === "string" ? body.action : "";
    const admin = client();

    if (["lookup", "submit_case"].includes(action)) {
      if (!await rateLimit(admin, request, action)) return reply(request, { error: "Too many attempts. Please wait and try again." }, 429);
      const order = await getCustomerOrder(admin, String(body.serviceReference || "").trim().toUpperCase(), String(body.retrievalToken || ""));
      if (!order) return reply(request, { error: "We could not verify this E-Service ID and secure tracking code." }, 404);

      if (action === "lookup") {
        const { data: cases, error } = await admin.from("instant_api_cases").select("case_reference,case_type,status,admin_note,created_at,updated_at,resolved_at").eq("order_id", order.id).order("created_at", { ascending: false }).limit(10);
        if (error) throw error;
        return reply(request, {
          order: {
            serviceReference: order.service_reference,
            service: order.service_slug,
            amount: order.customer_price,
            status: order.status,
            refundStatus: order.refund_status,
            refundAmount: order.refund_amount,
            refundReference: order.refund_reference,
            createdAt: order.created_at,
            paidAt: order.paid_at,
          },
          cases: cases ?? [],
        });
      }

      const caseType = body.caseType;
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!["failed_service", "delayed_service", "payment_issue"].includes(caseType) || message.length < 8 || message.length > 1000) {
        return reply(request, { error: "Select a valid query type and enter at least 8 characters." }, 400);
      }
      const ageMinutes = (Date.now() - new Date(order.created_at).getTime()) / 60000;
      if (caseType === "delayed_service" && (ageMinutes < 15 || !["paid", "processing", "fulfillment_unknown"].includes(order.status))) {
        return reply(request, { error: "A delay query is available after 15 minutes while the service is still processing." }, 409);
      }
      if (caseType === "failed_service" && !["failed", "refund_pending", "refunded"].includes(order.status)) {
        return reply(request, { error: "A failed-service query is available only when the service is marked failed or refund processing." }, 409);
      }
      if (caseType === "payment_issue" && !["payment_pending", "paid", "processing", "fulfillment_unknown", "failed", "refund_pending", "refunded"].includes(order.status)) {
        return reply(request, { error: "This transaction is not eligible for a payment query." }, 409);
      }

      const { data: existing } = await admin.from("instant_api_cases").select("case_reference,status").eq("order_id", order.id).in("status", ["open", "under_review", "awaiting_customer"]).maybeSingle();
      if (existing) return reply(request, { caseReference: existing.case_reference, status: existing.status, alreadyOpen: true });

      const { data: created, error } = await admin.from("instant_api_cases").insert({
        order_id: order.id,
        case_type: caseType,
        customer_message: message,
      }).select("case_reference,status").single();
      if (error) {
        if (error.code === "23505") return reply(request, { error: "A query is already open for this E-Service ID." }, 409);
        throw error;
      }
      if (caseType === "failed_service" && order.refund_status === "none") {
        await admin.from("instant_api_orders").update({ refund_status: "requested", refund_amount: order.customer_price }).eq("id", order.id).eq("refund_status", "none");
      } else if (caseType === "payment_issue" && order.status === "payment_pending" && order.refund_status === "none") {
        await admin.from("instant_api_orders").update({ refund_status: "under_review" }).eq("id", order.id).eq("refund_status", "none");
      }
      return reply(request, { caseReference: created.case_reference, status: created.status, message: "Your query has been registered." }, 201);
    }

    const owner = await requireOwner(admin, request);
    if (!owner) return reply(request, { error: "Owner access required." }, 403);

    if (action === "admin_list") {
      const { data, error } = await admin.from("instant_api_cases")
        .select("id,case_reference,order_id,case_type,customer_message,status,admin_note,reviewed_by,reviewed_at,resolved_at,created_at,instant_api_orders(service_reference,service_slug,customer_price,status,refund_status,refund_amount,refund_id,refund_reference,razorpay_payment_id,paid_at,created_at)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return reply(request, { cases: data ?? [] });
    }

    if (action === "admin_update_case") {
      const caseId = String(body.caseId || "");
      const status = String(body.status || "");
      const note = typeof body.adminNote === "string" ? body.adminNote.trim() : "";
      if (!/^[0-9a-f-]{36}$/i.test(caseId) || !["under_review", "awaiting_customer", "resolved", "rejected"].includes(status) || note.length > 1000) {
        return reply(request, { error: "Invalid case update." }, 400);
      }
      const { data: updated, error } = await admin.from("instant_api_cases").update({
        status,
        admin_note: note || null,
        reviewed_by: owner.id,
        reviewed_at: new Date().toISOString(),
        resolved_at: ["resolved", "rejected"].includes(status) ? new Date().toISOString() : null,
      }).eq("id", caseId).select("id,case_reference,status").single();
      if (error) throw error;
      await admin.from("admin_audit_logs").insert({
        actor_id: owner.id, action: "instant_api_case_" + status, entity_type: "instant_api_case",
        entity_id: caseId, metadata: { case_reference: updated.case_reference },
      });
      return reply(request, { case: updated });
    }

    if (action === "admin_approve_refund") {
      const caseId = String(body.caseId || "");
      if (!/^[0-9a-f-]{36}$/i.test(caseId)) return reply(request, { error: "Invalid case reference." }, 400);
      const { data: caseRow, error: caseError } = await admin.from("instant_api_cases").select("id,order_id,case_reference,status,case_type").eq("id", caseId).maybeSingle();
      if (caseError) throw caseError;
      if (!caseRow) return reply(request, { error: "Refund query not found." }, 404);
      if (!["failed_service", "payment_issue"].includes(caseRow.case_type) || ["rejected", "resolved"].includes(caseRow.status)) return reply(request, { error: "This case is not eligible for refund approval." }, 409);
      const { data: order, error: orderError } = await admin.from("instant_api_orders").select("id,service_reference,status,customer_price,razorpay_payment_id,refund_status,refund_id").eq("id", caseRow.order_id).single();
      if (orderError) throw orderError;
      if (!["failed", "refund_pending"].includes(order.status)) return reply(request, { error: "Refund is blocked until the service failure is confirmed. Investigate uncertain or processing requests first." }, 409);
      if (!order.razorpay_payment_id) return reply(request, { error: "Captured payment reference is missing. Reconcile payment before refund." }, 409);
      if (order.refund_status === "refunded") return reply(request, { status: "refunded", message: "This order is already marked refunded." });
      if (!["none", "requested", "under_review", "approved", "processing"].includes(order.refund_status)) return reply(request, { error: "Refund is not eligible for approval." }, 409);

      const existingRefunds = await razorpay("/payments/" + encodeURIComponent(order.razorpay_payment_id) + "/refunds", "GET");
      const fullAmount = Math.round(Number(order.customer_price) * 100);
      const existingItems = Array.isArray(existingRefunds.items) ? existingRefunds.items : [];
      const eligibleRefunds = existingItems.filter((item: Record<string, unknown>) => ["processed", "pending"].includes(String(item.status)));
      const existingRefundTotal = eligibleRefunds.reduce((sum: number, item: Record<string, unknown>) => sum + Number(item.amount || 0), 0);
      if (existingRefundTotal > 0 && existingRefundTotal < fullAmount) {
        return reply(request, { error: "A partial refund already exists. No additional refund was issued; reconcile the existing refund with Razorpay before proceeding." }, 409);
      }
      const allExistingProcessed = eligibleRefunds.length > 0 && eligibleRefunds.every((item: Record<string, unknown>) => item.status === "processed");
      const matching = existingRefundTotal >= fullAmount
        ? { ...eligibleRefunds[eligibleRefunds.length - 1], status: allExistingProcessed ? "processed" : "pending" }
        : undefined;
      let refund = matching;
      if (!refund && order.refund_status === "processing") return reply(request, { error: "A refund request is already marked as processing. Reconcile Razorpay status before another attempt." }, 409);
      if (!refund) {
        const { data: claimed, error: claimError } = await admin.from("instant_api_orders").update({
          refund_status: "processing", refund_amount: order.customer_price,
        }).eq("id", order.id).in("refund_status", ["none", "requested", "under_review", "approved"]).select("id").maybeSingle();
        if (claimError) throw claimError;
        if (!claimed) return reply(request, { error: "Another refund operation is already running. Refresh before retrying." }, 409);
        refund = await razorpay("/payments/" + encodeURIComponent(order.razorpay_payment_id) + "/refund", "POST", {
          amount: fullAmount,
          notes: { instant_api_order_id: order.id, service_reference: order.service_reference, case_reference: caseRow.case_reference },
        });
      }
      const isProcessed = refund.status === "processed";
      const refundStatus = isProcessed ? "refunded" : "processing";
      const { error: saveError } = await admin.from("instant_api_orders").update({
        refund_status: refundStatus,
        refund_amount: order.customer_price,
        refund_id: typeof refund.id === "string" ? refund.id : null,
        refund_reference: typeof refund.id === "string" ? refund.id : null,
        refund_processed_at: isProcessed ? new Date().toISOString() : null,
        status: isProcessed ? "refunded" : "refund_pending",
      }).eq("id", order.id);
      if (saveError) throw saveError;
      await admin.from("instant_api_cases").update({
        status: isProcessed ? "resolved" : "under_review",
        admin_note: isProcessed ? "Refund confirmed by Razorpay." : "Refund request accepted by Razorpay and is processing.",
        reviewed_by: owner.id, reviewed_at: new Date().toISOString(),
        resolved_at: isProcessed ? new Date().toISOString() : null,
      }).eq("id", caseId);
      await admin.from("admin_audit_logs").insert({
        actor_id: owner.id, action: "instant_api_refund_" + refundStatus, entity_type: "instant_api_order",
        entity_id: order.id, metadata: { service_reference: order.service_reference, case_reference: caseRow.case_reference, refund_id: refund.id ?? null },
      });
      return reply(request, { status: refundStatus, refundId: refund.id ?? null, message: isProcessed ? "Refund confirmed by Razorpay." : "Refund accepted and is being processed." });
    }

    return reply(request, { error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("instant-api-cases:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return reply(request, { error: "Service case desk is temporarily unavailable. Please try again later." }, 503);
  }
});
