import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { tokenHasAal2 } from "../_shared/auth.ts";
const allowedOrigins = ["https://babacybercafe.in", "https://www.babacybercafe.in", "https://security-audit-working-2026.babacybercafe.pages.dev"];
function cors(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0], "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
}
function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.includes(origin)) return reply(req, { error: "Origin not allowed." }, 403);
  try {
    const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!url || !serviceKey || !anonKey || !token) return reply(req, { error: "Verified owner sign-in required." }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user || !(user.email_confirmed_at || user.confirmed_at)) return reply(req, { error: "Verified owner sign-in required." }, 401);
    if (!tokenHasAal2(token)) return reply(req, { error: "Google Authenticator verification is required." }, 403);
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: owner } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "owner").maybeSingle();
    if (owner?.role !== "owner") return reply(req, { error: "Owner authorization required." }, 403);
    const raw = await req.text();
    if (raw.length > 4000) return reply(req, { error: "Request too large." }, 413);
    const body = JSON.parse(raw);
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "list") {
      const { data: grants, error } = await admin.from("security_investigators").select("user_id,enabled,permissions,granted_by,granted_at,revoked_at").order("granted_at", { ascending: false });
      if (error) throw new Error("INVESTIGATOR_LIST_FAILED");
      const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) throw new Error("USER_LIST_FAILED");
      const byId = new Map(users.users.map((item) => [item.id, item.email ?? ""]));
      return reply(req, { investigators: (grants ?? []).map((grant) => ({ ...grant, email: byId.get(grant.user_id) ?? "Account unavailable" })) });
    }
    if (action === "grant") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(req, { error: "Enter a valid existing account email." }, 400);
      const requested = Array.isArray(body.permissions) ? body.permissions : ["view_events", "investigate"];
      const permissions = [...new Set(requested.filter((value: unknown) => value === "view_events" || value === "investigate"))];
      if (!permissions.includes("view_events")) return reply(req, { error: "view_events permission is required." }, 400);
      const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) throw new Error("USER_LOOKUP_FAILED");
      const target = users.users.find((item) => item.email?.toLowerCase() === email);
      if (!target || !(target.email_confirmed_at || target.confirmed_at)) return reply(req, { error: "No existing verified account was found for that email. Public investigator registration is disabled." }, 404);
      const { error } = await admin.from("security_investigators").upsert({ user_id: target.id, enabled: true, permissions, granted_by: user.id, granted_at: new Date().toISOString(), revoked_at: null }, { onConflict: "user_id" });
      if (error) throw new Error("INVESTIGATOR_GRANT_FAILED");
      await admin.from("security_events").insert({ source: "manual", event_type: "investigator_access_granted", severity: "low", status: "new", summary: "Investigator access was granted by the owner.", actor_reference: user.id, details: { target_user_id: target.id, permissions } });
      return reply(req, { updated: true, action, email, permissions });
    }
    if (action === "revoke") {
      const userId = typeof body.user_id === "string" ? body.user_id : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return reply(req, { error: "A valid investigator account is required." }, 400);
      const { data: grant, error: readError } = await admin.from("security_investigators").select("user_id").eq("user_id", userId).maybeSingle();
      if (readError || !grant) return reply(req, { error: "Investigator grant not found." }, 404);
      const { error } = await admin.from("security_investigators").update({ enabled: false, revoked_at: new Date().toISOString() }).eq("user_id", userId);
      if (error) throw new Error("INVESTIGATOR_REVOKE_FAILED");
      await admin.from("security_events").insert({ source: "manual", event_type: "investigator_access_revoked", severity: "low", status: "new", summary: "Investigator access was revoked by the owner.", actor_reference: user.id, details: { target_user_id: userId } });
      return reply(req, { updated: true, action, user_id: userId });
    }
    return reply(req, { error: "Unsupported investigator action." }, 400);
  } catch (error) {
    console.error("investigation-manage-investigator:", error instanceof Error ? error.message : "unknown");
    return reply(req, { error: "Investigator access management failed." }, 500);
  }
});