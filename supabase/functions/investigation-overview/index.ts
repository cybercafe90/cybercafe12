import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const allowedOrigins = ["https://babacybercafe.in", "https://www.babacybercafe.in", "https://security-audit-working-2026.babacybercafe.pages.dev"];
function cors(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
async function authorize(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !serviceKey || !anonKey || !token) throw new Error("UNAUTHENTICATED");
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) throw new Error("UNAUTHENTICATED");
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: owner } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "owner").maybeSingle();
  if (owner?.role === "owner") return { admin, user, role: "owner" as const, permissions: ["view_events", "investigate", "manage_investigators"] };
  const { data: investigator } = await admin.from("security_investigators").select("enabled,permissions").eq("user_id", user.id).maybeSingle();
  if (!investigator?.enabled) throw new Error("FORBIDDEN");
  return { admin, user, role: "investigator" as const, permissions: Array.isArray(investigator.permissions) ? investigator.permissions : [] };
}
function maskReference(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  return value.length <= 4 ? "••••" : `${value.slice(0, 2)}••••${value.slice(-2)}`;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.includes(origin)) return reply(req, { error: "Origin not allowed." }, 403);
  try {
    const auth = await authorize(req);
    if (!auth.permissions.includes("view_events")) return reply(req, { error: "Investigation access required." }, 403);
    const { data, error } = await auth.admin.from("security_events")
      .select("id,occurred_at,source,event_type,severity,status,source_ip,route,summary,customer_reference,correlation_id")
      .order("occurred_at", { ascending: false }).limit(100);
    if (error) throw new Error("EVENT_QUERY_FAILED");
    const events = (data ?? []).map((event) => ({ ...event, customer_reference: maskReference(event.customer_reference) }));
    return reply(req, {
      events,
      actor: { role: auth.role, permissions: auth.permissions },
      monitoring: {
        event_count: events.length,
        note: events.length === 0
          ? "No security events are currently recorded. This does not prove that no suspicious activity occurred; telemetry sources still need to be connected and verified."
          : "Only recorded telemetry is shown. Unconnected sources may not appear here.",
        telemetry_sources: ["application", "supabase_auth", "supabase_database", "supabase_storage", "cloudflare"],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" || message === "MFA_REQUIRED" ? 403 : 500;
    return reply(req, { error: status === 401 ? "Verified sign-in required." : status === 403 ? (message === "MFA_REQUIRED" ? "Google Authenticator verification is required." : "Investigation access is not granted.") : "Investigation data could not be loaded." }, status);
  }
});