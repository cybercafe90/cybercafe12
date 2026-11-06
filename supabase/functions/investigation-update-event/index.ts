import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const allowedOrigins = ["https://babacybercafe.in", "https://www.babacybercafe.in"];
function cors(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0], "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
}
function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
async function authorize(req: Request) {
  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !serviceKey || !anonKey || !token) throw new Error("UNAUTHENTICATED");
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user || !(user.email_confirmed_at || user.confirmed_at)) throw new Error("UNAUTHENTICATED");
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: owner } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "owner").maybeSingle();
  if (owner?.role === "owner") return { admin, user, permissions: ["view_events", "investigate", "manage_investigators"], role: "owner" };
  const { data: investigator } = await admin.from("security_investigators").select("enabled,permissions").eq("user_id", user.id).maybeSingle();
  if (!investigator?.enabled) throw new Error("FORBIDDEN");
  return { admin, user, permissions: Array.isArray(investigator.permissions) ? investigator.permissions : [], role: "investigator" };
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.includes(origin)) return reply(req, { error: "Origin not allowed." }, 403);
  try {
    const auth = await authorize(req);
    if (!auth.permissions.includes("investigate")) return reply(req, { error: "Permission to update incidents is not granted." }, 403);
    const raw = await req.text();
    if (raw.length > 3000) return reply(req, { error: "Request too large." }, 413);
    const body = JSON.parse(raw);
    const id = typeof body.id === "string" ? body.id : "";
    const status = typeof body.status === "string" ? body.status : "";
    const allowed = ["new", "investigating", "contained", "resolved", "false_positive"];
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !allowed.includes(status) || !reason) {
      return reply(req, { error: "A valid event, status and short reason are required." }, 400);
    }
    const { data: current, error: readError } = await auth.admin.from("security_events").select("id,status").eq("id", id).maybeSingle();
    if (readError || !current) return reply(req, { error: "Incident not found." }, 404);
    const { error: updateError } = await auth.admin.from("security_events").update({ status }).eq("id", id);
    if (updateError) throw new Error("EVENT_UPDATE_FAILED");
    const actionType = status === "new" ? "mark_new" : status === "investigating" ? "mark_investigating" : status === "contained" ? "mark_contained" : status === "resolved" ? "mark_resolved" : "false_positive";
    const { error: auditError } = await auth.admin.from("security_actions").insert({
      event_id: id, action_type: actionType, reason, provider: "manual",
      status: "applied", performed_by: auth.user.id, result: { previous_status: current.status, new_status: status, actor_role: auth.role },
    });
    if (auditError) {
      await auth.admin.from("security_events").update({ status: current.status }).eq("id", id);
      throw new Error("AUDIT_WRITE_FAILED");
    }
    return reply(req, { updated: true, id, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return reply(req, { error: status === 401 ? "Verified sign-in required." : status === 403 ? "Investigation permission required." : "Incident update failed; no unlogged change was retained." }, status);
  }
});