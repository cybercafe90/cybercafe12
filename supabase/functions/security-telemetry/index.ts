import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const allowedOrigins = ["https://babacybercafe.in", "https://www.babacybercafe.in"];
function reply(req: Request, body: unknown, status = 200) {
  const origin = req.headers.get("origin") ?? "";
  return new Response(JSON.stringify(body), { status, headers: {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
  }});
}
function getIp(req: Request) {
  const value = req.headers.get("cf-connecting-ip") ?? "";
  return value.length <= 45 && /^[0-9a-fA-F:.]+$/.test(value) ? value : null;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return reply(req, { ok: true });
  if (req.method !== "POST") return reply(req, { error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.includes(origin)) return reply(req, { error: "Origin not allowed." }, 403);
  try {
    const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return reply(req, { error: "Telemetry service unavailable." }, 503);
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const raw = await req.text();
    if (raw.length > 1500) return reply(req, { error: "Request too large." }, 413);
    const body = JSON.parse(raw || "{}");
    const route = typeof body.route === "string" ? body.route.slice(0, 120) : "/";
    const safeRoute = route.startsWith("/") && !route.startsWith("//") ? route.split("?")[0] : "/";
    const ip = getIp(req);
    const ua = (req.headers.get("user-agent") ?? "").slice(0, 512);
    const country = (req.headers.get("cf-ipcountry") ?? "").slice(0, 2);
    const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    let actorId: string | null = null;
    if (token && Deno.env.get("SUPABASE_ANON_KEY")) {
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
      const { data } = await userClient.auth.getUser(token);
      actorId = data.user?.id ?? null;
    }
    const key = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip ?? "unknown"}:${safeRoute}:${ua}`));
    const correlation = Array.from(new Uint8Array(key), b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    const { data: recent } = await admin.from("security_events").select("id").eq("correlation_id", correlation).gte("occurred_at", new Date(Date.now() - 120000).toISOString()).limit(1);
    if (!recent?.length) {
      const { error } = await admin.from("security_events").insert({
        source: "website", event_type: "page_view", severity: "info", status: "new",
        source_ip: ip, route: safeRoute, actor_reference: actorId,
        summary: "Website page visit recorded.",
        details: { user_agent: ua, country_code: country || null, device_hint: /mobile|android|iphone/i.test(ua) ? "mobile" : "desktop_or_tablet", collection: "server_request_headers" },
        correlation_id: correlation,
      });
      if (error) throw error;
    }
    return reply(req, { ok: true });
  } catch {
    return reply(req, { error: "Telemetry could not be recorded." }, 503);
  }
});