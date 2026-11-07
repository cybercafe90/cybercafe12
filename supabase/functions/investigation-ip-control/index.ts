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
async function owner(req: Request) {
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !service || !anon || !token) throw new Error("UNAUTHENTICATED");
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) throw new Error("UNAUTHENTICATED");
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "owner").maybeSingle();
  if (role?.role !== "owner") throw new Error("FORBIDDEN");
  return { admin, user };
}
function validPublicIp(ip: string) {
  if (ip.length > 45 || ip.includes("/") || !/^[0-9a-fA-F:.]+$/.test(ip)) return false;
  if (ip.includes(".")) {
    const p = ip.split(".");
    if (p.length !== 4 || p.some(x => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return false;
    const [a,b] = p.map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    return true;
  }
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("ff")) return false;
  return v.includes(":");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return reply(req, { ok: true });
  if (req.method !== "POST") return reply(req, { error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.includes(origin)) return reply(req, { error: "Origin not allowed." }, 403);
  try {
    const { admin, user } = await owner(req);
    const raw = await req.text();
    if (raw.length > 2500) return reply(req, { error: "Request too large." }, 413);
    const body = JSON.parse(raw || "{}");
    const action = body.action;
    const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const zone = Deno.env.get("CLOUDFLARE_ZONE_ID");
    if (!token || !zone) return reply(req, { error: "Cloudflare blocking is not configured yet. Add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID as Supabase Edge Function secrets." }, 503);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (action === "list") {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/firewall/access_rules/rules?per_page=100&page=1`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error("CLOUDFLARE_LIST_FAILED");
      return reply(req, { rules: json.result ?? [] });
    }
    const ip = typeof body.ip === "string" ? body.ip.trim() : "";
    if (!validPublicIp(ip)) return reply(req, { error: "Enter a valid public IP address. Private, loopback, reserved and CIDR ranges are not accepted." }, 400);
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
    if (reason.length < 8) return reply(req, { error: "Provide an investigation reason of at least 8 characters." }, 400);
    if (action === "block") {
      const { data: existing } = await admin.from("security_actions").select("id").eq("target_ip", ip).eq("provider", "cloudflare").eq("status", "applied").limit(1);
      if (existing?.length) return reply(req, { error: "This IP is already blocked." }, 409);
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/firewall/access_rules/rules`, {
        method: "POST", headers, body: JSON.stringify({ mode: "block", configuration: { target: ip.includes(":") ? "ip6" : "ip", value: ip }, notes: `BABA'S CYBER CAFE investigation: ${reason}` }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.result?.id) return reply(req, { error: "Cloudflare did not confirm the IP block. Check API permissions and plan support." }, 502);
      const { error } = await admin.from("security_actions").insert({ action_type: "temporary_ip_block", target_ip: ip, provider: "cloudflare", provider_rule_id: json.result.id, reason, status: "applied", performed_by: user.id, result: { provider: "cloudflare", rule_id: json.result.id } });
      if (error) {
        await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/firewall/access_rules/rules/${json.result.id}`, { method: "DELETE", headers });
        throw new Error("ACTION_AUDIT_FAILED_BLOCK_REVERTED");
      }
      await admin.from("security_events").insert({ source: "cloudflare", event_type: "ip_blocked", severity: "high", status: "contained", source_ip: ip, summary: "Owner blocked an IP address at Cloudflare.", actor_reference: user.id, details: { reason } });
      return reply(req, { blocked: true, ip, rule_id: json.result.id });
    }
    if (action === "unblock") {
      const { data: actions } = await admin.from("security_actions").select("id,provider_rule_id").eq("target_ip", ip).eq("provider", "cloudflare").eq("status", "applied").order("performed_at", { ascending: false }).limit(1);
      const record = actions?.[0];
      if (!record?.provider_rule_id) return reply(req, { error: "No active BABA'S CYBER CAFE block record was found for this IP." }, 404);
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/firewall/access_rules/rules/${record.provider_rule_id}`, { method: "DELETE", headers });
      const json = await res.json();
      if (!res.ok || !json.success) return reply(req, { error: "Cloudflare did not confirm the unblock." }, 502);
      await admin.from("security_actions").update({ status: "released", performed_by: user.id, result: { provider: "cloudflare", removed: true } }).eq("id", record.id);
      await admin.from("security_events").insert({ source: "cloudflare", event_type: "ip_unblocked", severity: "low", status: "resolved", source_ip: ip, summary: "Owner removed an IP block at Cloudflare.", actor_reference: user.id, details: { reason } });
      return reply(req, { unblocked: true, ip });
    }
    return reply(req, { error: "Unsupported action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return reply(req, { error: status === 401 ? "Verified owner sign-in required." : status === 403 ? "Only the owner can block or unblock IP addresses." : "IP restriction operation failed." }, status);
  }
});