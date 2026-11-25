interface Env {
  SMART_QR_DB: D1Database;
  RESEND_API_KEY?: string;
  SMART_QR_OWNER_BOOTSTRAP_SECRET?: string;
  SMART_QR_PUBLIC_ORIGIN?: string;
}

type Context = { request: Request; env: Env; params: { path?: string } };
type SessionUser = { id: string; email: string; full_name: string; role: "merchant" | "platform_admin" };

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const EMAIL_FROM = "BABA'S CYBER CAFE <support@babacybercafe.in>";
const ADMIN_EMAIL = "support@babacybercafe.in";
const ALLOWED_EVENTS = new Set(["scan", "whatsapp", "call", "directions", "payment_tap", "share"]);

function response(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}
function fail(message: string, status = 400) { return response({ error: message }, status); }
async function bodyJson(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 20_000) throw new Error("Request is too large.");
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request body.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(value, (part) => part.toString(16).padStart(2, "0")).join("");
}
async function sha256(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (part) => part.toString(16).padStart(2, "0")).join("");
}
async function passwordHash(password: string, salt = randomToken(16)) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 310_000 }, material, 256);
  const derived = Array.from(new Uint8Array(bits), (part) => part.toString(16).padStart(2, "0")).join("");
  return { encoded: `pbkdf2_sha256$310000$${salt}$${derived}`, salt, derived };
}
async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterations, salt, expected] = encoded.split("$");
  if (algorithm !== "pbkdf2_sha256" || iterations !== "310000" || !salt || !expected) return false;
  const actual = await passwordHash(password, salt);
  return constantTimeEqual(actual.derived, expected);
}
function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function cookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") || "";
  const found = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}
function cookieHeader(value: string, maxAge: number) {
  return `smartqr_session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
async function rateLimit(db: D1Database, key: string, max: number, windowSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (now % windowSeconds);
  await db.prepare(`INSERT INTO smartqr_rate_limits(rate_key,window_started_at,request_count)
    VALUES(?,?,1) ON CONFLICT(rate_key) DO UPDATE SET
    request_count=CASE WHEN window_started_at=excluded.window_started_at THEN request_count+1 ELSE 1 END,
    window_started_at=excluded.window_started_at`).bind(key, start).run();
  const row = await db.prepare("SELECT request_count FROM smartqr_rate_limits WHERE rate_key=?").bind(key).first<{request_count:number}>();
  return (row?.request_count ?? max + 1) <= max;
}
async function sendSetupEmail(env: Env, email: string, token: string, origin: string, kind: "merchant" | "owner" | "reset") {
  if (!env.RESEND_API_KEY) throw new Error("Email delivery is not configured. Add RESEND_API_KEY as a Cloudflare secret before enabling registration.");
  const url = new URL(kind === "reset" ? "/smart-qr/reset-password" : kind === "owner" ? "/smart-qr/owner-setup" : "/smart-qr/setup", env.SMART_QR_PUBLIC_ORIGIN || origin);
  url.searchParams.set("token", token);
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202124"><h2>BABA'S SMART QR</h2><p>Set a secure password for your ${kind} account using the one-time link below.</p><p><a href="${url.toString()}" style="display:inline-block;padding:12px 18px;background:#171717;color:#fff;text-decoration:none">Set password</a></p><p>This link expires in 30 minutes and can be used once. If you did not request it, ignore this email.</p></div>`;
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [email], subject: kind === "reset" ? "Reset your BABA'S SMART QR password" : "Set up your BABA'S SMART QR account", html }),
  });
  if (!result.ok) throw new Error("The account email could not be delivered. Please try again later.");
}
async function createSetupToken(db: D1Database, userId: string, purpose: "setup" | "reset" = "setup") {
  const raw = randomToken();
  const tokenHash = await sha256(raw);
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await db.prepare("INSERT INTO smartqr_email_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?, ?, ?)").bind(tokenHash, userId, purpose, expires).run();
  return raw;
}
async function sessionUser(request: Request, db: D1Database): Promise<SessionUser | null> {
  const token = cookie(request, "smartqr_session");
  if (!token) return null;
  const hash = await sha256(token);
  const row = await db.prepare(`SELECT u.id,u.email,u.full_name,u.role,s.expires_at
    FROM smartqr_sessions s JOIN smartqr_users u ON u.id=s.user_id
    WHERE s.token_hash=?`).bind(hash).first<SessionUser & {expires_at:string}>();
  if (!row || Date.parse(row.expires_at) <= Date.now()) {
    await db.prepare("DELETE FROM smartqr_sessions WHERE token_hash=?").bind(hash).run();
    return null;
  }
  return { id: row.id, email: row.email, full_name: row.full_name, role: row.role };
}
async function createSession(db: D1Database, userId: string) {
  const token = randomToken();
  const hash = await sha256(token);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("INSERT INTO smartqr_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(hash, userId, expires).run();
  return token;
}
function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}
async function publicShop(db: D1Database, slug: string) {
  return db.prepare(`SELECT s.shop_code,s.slug,s.shop_name,s.category,s.description,s.phone,s.whatsapp,
    s.address_text,s.opening_hours,s.social_links,s.payment_url,s.logo_url,s.plan_code,
    s.approval_status,l.location_code,l.label AS location_label,l.address_text AS location_address,
    l.phone AS location_phone,l.opening_hours AS location_hours,q.qr_code
    FROM smartqr_shops s LEFT JOIN smartqr_locations l ON l.shop_id=s.id AND l.is_primary=1
    LEFT JOIN smartqr_qr_codes q ON q.shop_id=s.id AND q.is_active=1
    WHERE s.slug=? AND s.approval_status='approved' LIMIT 1`).bind(slug).first<Record<string,unknown>>();
}

export const onRequest = async ({ request, env, params }: Context) => {
  const url = new URL(request.url);
  const path = (params.path || "").split("/").filter(Boolean);
  const route = path.join("/");
  const method = request.method.toUpperCase();
  if (!env.SMART_QR_DB) return fail("Smart QR database binding is unavailable.", 503);
  const db = env.SMART_QR_DB;
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET,POST,PATCH,OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "600" } });
  if (method !== "GET" && !assertSameOrigin(request)) return fail("Request origin could not be verified.", 403);

  try {
    if (route === "register" && method === "POST") {
      if (!(await rateLimit(db, `register:${await sha256(request.headers.get("cf-connecting-ip") || "unknown")}`, 5, 3600))) return fail("Too many attempts. Try again later.", 429);
      const input = await bodyJson(request);
      const email = text(input.email, 254).toLowerCase();
      const ownerName = text(input.ownerName, 120);
      const shopName = text(input.shopName, 140);
      const plan = text(input.plan, 20);
      const monthly = text(input.monthlyOption, 20);
      const monthlyConsent = input.monthlyConsent === true;
      if (monthly !== "none" && !monthlyConsent) return fail("Explicit consent is required before selecting recurring monthly billing.");
      const monthlyConsentAt = monthly === "none" ? null : new Date().toISOString();
      const category = text(input.category, 80);
      const description = text(input.description, 600);
      const phone = text(input.phone, 24);
      const whatsapp = text(input.whatsapp, 24);
      const address = text(input.address, 240);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || ownerName.length < 2 || shopName.length < 2) return fail("Enter a valid email, owner name and shop name.");
      const fees: Record<string,{setup:number;monthly:number;option:string}> = {
        starter:{setup:49900,monthly:0,option:"none"},
        growth:{setup:99900,monthly:monthly==="growth"?9900:0,option:monthly==="growth"?"growth":"none"},
        vip:{setup:199900,monthly:monthly==="vip"?19900:0,option:monthly==="vip"?"vip":"none"},
      };
      const pricing = fees[plan];
      if (!pricing || pricing.option !== monthly && monthly !== "none") return fail("Invalid plan or monthly option.");
      if (plan === "starter" && monthly !== "none") return fail("Starter does not offer a monthly subscription.");
      const exists = await db.prepare("SELECT id FROM smartqr_users WHERE email=?").bind(email).first();
      if (exists) return fail("If the address is already registered, use login or password recovery.", 409);
      const id = crypto.randomUUID();
      const slugBase = slugify(shopName) || "shop";
      const slug = `${slugBase}-${randomToken(3)}`;
      const shopCode = `BBC-${randomToken(4).toUpperCase()}`;
      const locationCode = `LOC-${randomToken(3).toUpperCase()}`;
      const qrCode = `QR-${randomToken(5).toUpperCase()}`;
      const batch = db.batch([
        db.prepare("INSERT INTO smartqr_users(id,email,full_name,password_hash,role) VALUES(?,?,?,NULL,'merchant')").bind(id,email,ownerName),
        db.prepare(`INSERT INTO smartqr_shops(shop_code,owner_user_id,slug,shop_name,category,description,phone,whatsapp,address_text,owner_display_name,plan_code,monthly_option,monthly_consent_at,approval_status,subscription_status)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'pending','inactive')`).bind(shopCode,id,slug,shopName,category,description,phone,whatsapp,address,ownerName,plan,monthly,monthlyConsentAt),
      ]);
      await batch;
      const shop = await db.prepare("SELECT id FROM smartqr_shops WHERE owner_user_id=?").bind(id).first<{id:number}>();
      if (!shop) throw new Error("Shop application could not be created.");
      await db.batch([
        db.prepare("INSERT INTO smartqr_locations(shop_id,location_code,label,address_text,phone,is_primary) VALUES(?,?,?,?,?,1)").bind(shop.id,locationCode,"Main location",address,phone),
        db.prepare("INSERT INTO smartqr_qr_codes(shop_id,qr_code,label) VALUES(?,?,?)").bind(shop.id,qrCode,"Main QR"),
        db.prepare("INSERT INTO smartqr_audit_logs(actor_user_id,shop_id,action,detail_json) VALUES(?,?,?,?)").bind(id,shop.id,"merchant_registered",JSON.stringify({plan,monthlyOption:monthly})),
      ]);
      const token = await createSetupToken(db,id);
      try { await sendSetupEmail(env,email,token,url.origin,"merchant"); }
      catch (error) {
        await db.batch([
          db.prepare("DELETE FROM smartqr_shops WHERE id=?").bind(shop.id),
          db.prepare("DELETE FROM smartqr_users WHERE id=?").bind(id),
        ]);
        throw error;
      }
      return response({message:"Application received. Check your email to set a password and verify your address.",shopCode},201);
    }

    if (route === "setup" && method === "POST") {
      const input = await bodyJson(request);
      const token = text(input.token,128);
      const password = text(input.password,256);
      if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) return fail("Use at least 12 characters with uppercase, lowercase and a number.");
      const hash = await sha256(token);
      const row = await db.prepare(`SELECT t.user_id,t.expires_at,t.used_at FROM smartqr_email_tokens t
        WHERE t.token_hash=? AND t.purpose='setup'`).bind(hash).first<{user_id:string;expires_at:string;used_at:string|null}>();
      if (!row || row.used_at || Date.parse(row.expires_at)<=Date.now()) return fail("This setup link is invalid or expired.", 410);
      const stored = await passwordHash(password);
      await db.batch([
        db.prepare("UPDATE smartqr_users SET password_hash=?,email_verified_at=COALESCE(email_verified_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(stored.encoded,row.user_id),
        db.prepare("UPDATE smartqr_email_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=? AND used_at IS NULL").bind(hash),
      ]);
      const session = await createSession(db,row.user_id);
      return response({message:"Password created. Your merchant application is pending approval."},200,{"set-cookie":cookieHeader(session,604800)});
    }

    if (route === "forgot-password" && method === "POST") {
      if (!(await rateLimit(db, "reset:" + await sha256(request.headers.get("cf-connecting-ip") || "unknown"), 5, 3600))) return fail("Too many requests. Try again later.",429);
      const input = await bodyJson(request);
      const email = text(input.email,254).toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const account = await db.prepare("SELECT id,email FROM smartqr_users WHERE email=? AND password_hash IS NOT NULL").bind(email).first<{id:string;email:string}>();
        if (account) {
          const token = await createSetupToken(db,account.id,"reset");
          await sendSetupEmail(env,account.email,token,url.origin,"reset");
        }
      }
      return response({message:"If an account exists for that address, password reset instructions have been sent."});
    }

    if (route === "reset-password" && method === "POST") {
      const input = await bodyJson(request);
      const token = text(input.token,128);
      const password = text(input.password,256);
      if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) return fail("Use at least 12 characters with uppercase, lowercase and a number.");
      const hash = await sha256(token);
      const row = await db.prepare("SELECT user_id,expires_at,used_at FROM smartqr_email_tokens WHERE token_hash=? AND purpose='reset'").bind(hash).first<{user_id:string;expires_at:string;used_at:string|null}>();
      if (!row || row.used_at || Date.parse(row.expires_at)<=Date.now()) return fail("This reset link is invalid or expired.",410);
      const stored = await passwordHash(password);
      await db.batch([
        db.prepare("UPDATE smartqr_users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(stored.encoded,row.user_id),
        db.prepare("UPDATE smartqr_email_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=? AND used_at IS NULL").bind(hash),
        db.prepare("DELETE FROM smartqr_sessions WHERE user_id=?").bind(row.user_id),
      ]);
      return response({message:"Password reset successfully. Sign in with your new password."});
    }

    if (route === "login" && method === "POST") {
      if (!(await rateLimit(db, `login:${await sha256(request.headers.get("cf-connecting-ip") || "unknown")}`, 10, 900))) return fail("Too many login attempts. Try again later.",429);
      const input = await bodyJson(request);
      const email = text(input.email,254).toLowerCase();
      const password = text(input.password,256);
      const user = await db.prepare("SELECT id,email,full_name,role,password_hash FROM smartqr_users WHERE email=?").bind(email).first<SessionUser & {password_hash:string|null}>();
      if (!user?.password_hash || !(await verifyPassword(password,user.password_hash))) return fail("Email or password is incorrect.",401);
      const session = await createSession(db,user.id);
      return response({user:{id:user.id,email:user.email,fullName:user.full_name,role:user.role}},200,{"set-cookie":cookieHeader(session,604800)});
    }

    if (route === "logout" && method === "POST") {
      const token = cookie(request,"smartqr_session");
      if (token) await db.prepare("DELETE FROM smartqr_sessions WHERE token_hash=?").bind(await sha256(token)).run();
      return response({message:"Signed out."},200,{"set-cookie":cookieHeader("",0)});
    }

    const user = await sessionUser(request,db);
    if (route === "me" && method === "GET") return user ? response({user}) : fail("Authentication required.",401);

    if (route === "shop" && method === "GET") {
      if (!user) return fail("Authentication required.",401);
      const shop = await db.prepare(`SELECT shop_code,slug,shop_name,category,description,phone,whatsapp,address_text,
        opening_hours,social_links,payment_url,logo_url,approval_status,plan_code,monthly_option,subscription_status,created_at
        FROM smartqr_shops WHERE owner_user_id=?`).bind(user.id).first<Record<string,unknown>>();
      if (!shop) return fail("Shop not found.",404);
      const locations = await db.prepare("SELECT location_code,label,address_text,phone,opening_hours,is_primary FROM smartqr_locations WHERE shop_id=(SELECT id FROM smartqr_shops WHERE owner_user_id=?) ORDER BY is_primary DESC,id").bind(user.id).all();
      const qrCodes = await db.prepare("SELECT qr_code,label,is_active,created_at FROM smartqr_qr_codes WHERE shop_id=(SELECT id FROM smartqr_shops WHERE owner_user_id=?) ORDER BY id").bind(user.id).all();
      return response({shop,locations:locations.results,qrCodes:qrCodes.results});
    }

    if (route === "locations" && method === "POST") {
      if (!user || user.role!=="merchant") return fail("Merchant authentication required.",401);
      const input=await bodyJson(request);
      const label=text(input.label,80);
      if (label.length<2) return fail("Enter a location name.");
      const shop=await db.prepare("SELECT id,plan_code FROM smartqr_shops WHERE owner_user_id=?").bind(user.id).first<{id:number;plan_code:string}>();
      if (!shop) return fail("Shop not found.",404);
      const limit=shop.plan_code==="vip"?3:1;
      const count=await db.prepare("SELECT COUNT(*) AS total FROM smartqr_locations WHERE shop_id=?").bind(shop.id).first<{total:number}>();
      if ((count?.total??0)>=limit) return fail("Your current plan's location limit has been reached.",409);
      const code="LOC-"+randomToken(4).toUpperCase();
      await db.prepare("INSERT INTO smartqr_locations(shop_id,location_code,label,address_text,phone,opening_hours,is_primary) VALUES(?,?,?,?,?,?,0)").bind(shop.id,code,label,text(input.address,240),text(input.phone,24),JSON.stringify(input.openingHours||{})).run();
      return response({message:"Location added.",locationCode:code},201);
    }

    if (route === "qr" && method === "POST") {
      if (!user || user.role!=="merchant") return fail("Merchant authentication required.",401);
      const input=await bodyJson(request);
      const label=text(input.label,80)||"Additional QR";
      const shop=await db.prepare("SELECT id,plan_code FROM smartqr_shops WHERE owner_user_id=?").bind(user.id).first<{id:number;plan_code:string}>();
      if (!shop) return fail("Shop not found.",404);
      const limit=shop.plan_code==="vip"?3:1;
      const count=await db.prepare("SELECT COUNT(*) AS total FROM smartqr_qr_codes WHERE shop_id=? AND is_active=1").bind(shop.id).first<{total:number}>();
      if ((count?.total??0)>=limit) return fail("Your current plan's QR-code limit has been reached.",409);
      let locationId:number|null=null;
      const locationCode=text(input.locationCode,40);
      if (locationCode) {
        const location=await db.prepare("SELECT id FROM smartqr_locations WHERE shop_id=? AND location_code=?").bind(shop.id,locationCode).first<{id:number}>();
        if (!location) return fail("That location does not belong to your shop.",403);
        locationId=location.id;
      }
      const code="QR-"+randomToken(5).toUpperCase();
      await db.prepare("INSERT INTO smartqr_qr_codes(shop_id,location_id,qr_code,label) VALUES(?,?,?,?)").bind(shop.id,locationId,code,label).run();
      return response({qrCode:code},201);
    }

    if (route === "shop" && method === "PATCH") {
      if (!user || user.role !== "merchant") return fail("Merchant authentication required.",401);
      const input = await bodyJson(request);
      const allowed = ["shop_name","category","description","phone","whatsapp","address_text","opening_hours","social_links","payment_url"];
      const values: unknown[] = [];
      const updates: string[] = [];
      for (const field of allowed) if (Object.hasOwn(input,field)) {
        const value = input[field];
        const max = field==="description"?600:field==="shop_name"?140:field==="address_text"?240:field==="opening_hours"||field==="social_links"?2000:field==="payment_url"?500:120;
        const clean = typeof value==="string" ? value.trim().slice(0,max) : field==="opening_hours"||field==="social_links" ? JSON.stringify(value) : "";
        updates.push(`${field}=?`); values.push(clean);
      }
      if (!updates.length) return fail("No editable shop fields were supplied.");
      updates.push("updated_at=CURRENT_TIMESTAMP");
      values.push(user.id);
      await db.prepare(`UPDATE smartqr_shops SET ${updates.join(",")} WHERE owner_user_id=?`).bind(...values).run();
      return response({message:"Shop profile updated."});
    }

    if (route.startsWith("public/") && method === "GET") {
      const slug = text(route.slice(7),80);
      const shop = await publicShop(db,slug);
      return shop ? response({shop},200,{"cache-control":"public, max-age=60, stale-while-revalidate=300"}) : fail("Shop not found.",404);
    }

    if (route.startsWith("event/") && method === "POST") {
      const slug = text(route.slice(6),80);
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      if (!(await rateLimit(db, "event:" + await sha256(ip + "|" + slug), 120, 900))) return fail("Too many activity events. Try again later.",429);
      const input = await bodyJson(request);
      const type = text(input.type,30);
      if (!ALLOWED_EVENTS.has(type)) return fail("Unsupported event type.");
      const shop = await db.prepare("SELECT id FROM smartqr_shops WHERE slug=? AND approval_status='approved'").bind(slug).first<{id:number}>();
      if (!shop) return fail("Shop not found.",404);
      const ua = (request.headers.get("user-agent") || "").slice(0,160);
      const bucket = Math.floor(Date.now()/900000);
      const dedupe = await sha256(`${ip}|${ua}|${slug}|${type}|${bucket}`);
      await db.prepare("INSERT INTO smartqr_events(shop_id,event_type,dedupe_hash) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM smartqr_events WHERE dedupe_hash=?)").bind(shop.id,type,dedupe,dedupe).run();
      return response({recorded:true});
    }

    if (route === "analytics" && method === "GET") {
      if (!user) return fail("Authentication required.",401);
      const shop = await db.prepare("SELECT id,plan_code FROM smartqr_shops WHERE owner_user_id=?").bind(user.id).first<{id:number;plan_code:string}>();
      if (!shop) return fail("Shop not found.",404);
      const days = shop.plan_code==="starter"?7:shop.plan_code==="growth"?365:730;
      const stats = await db.prepare("SELECT event_type,COUNT(*) AS total FROM smartqr_events WHERE shop_id=? AND created_at>=datetime('now',?) GROUP BY event_type").bind(shop.id,`-${days} days`).all();
      return response({retentionDays:days,stats:stats.results});
    }

    if (route === "admin/bootstrap" && method === "POST") {
      if (!(await rateLimit(db, "owner-bootstrap:" + await sha256(request.headers.get("cf-connecting-ip") || "unknown"), 3, 3600))) return fail("Too many owner setup attempts. Try again later.",429);
      const supplied = request.headers.get("x-owner-bootstrap-secret") || "";
      const expected = env.SMART_QR_OWNER_BOOTSTRAP_SECRET || "";
      if (!expected || !constantTimeEqual(supplied,expected) || text((await bodyJson(request)).email,254).toLowerCase()!==ADMIN_EMAIL) return fail("Owner bootstrap is not authorized.",403);
      const count = await db.prepare("SELECT COUNT(*) AS total FROM smartqr_users WHERE role='platform_admin'").first<{total:number}>();
      if ((count?.total ?? 0)>0) return fail("Owner bootstrap has already been completed.",409);
      const id=crypto.randomUUID();
      await db.prepare("INSERT INTO smartqr_users(id,email,full_name,password_hash,role) VALUES(?,?,?,NULL,'platform_admin')").bind(id,ADMIN_EMAIL,"BABA'S CYBER CAFE Owner").run();
      const token=await createSetupToken(db,id);
      try { await sendSetupEmail(env,ADMIN_EMAIL,token,url.origin,"owner"); }
      catch (error) { await db.prepare("DELETE FROM smartqr_users WHERE id=?").bind(id).run(); throw error; }
      await db.prepare("INSERT INTO smartqr_audit_logs(actor_user_id,action,detail_json) VALUES(?,?,?)").bind(id,"owner_setup_initiated",JSON.stringify({email:ADMIN_EMAIL})).run();
      return response({message:"Owner setup email sent. The account is not active until the password is set."},202);
    }

    if (route === "admin/shops" && method === "GET") {
      if (!user || user.role!=="platform_admin") return fail("Owner access required.",403);
      const rows=await db.prepare(`SELECT s.shop_code,s.shop_name,s.slug,s.category,s.approval_status,s.plan_code,s.monthly_option,
        s.subscription_status,s.created_at,u.email,u.full_name
        FROM smartqr_shops s JOIN smartqr_users u ON u.id=s.owner_user_id ORDER BY s.created_at DESC LIMIT 200`).all();
      return response({shops:rows.results});
    }

    if (route.startsWith("admin/shops/") && route.endsWith("/status") && method === "PATCH") {
      if (!user || user.role!=="platform_admin") return fail("Owner access required.",403);
      const shopCode=path[2];
      const input=await bodyJson(request);
      const status=text(input.status,20);
      if (!["approved","rejected","suspended","pending"].includes(status)) return fail("Invalid shop status.");
      if (status==="approved") {
        const payment=await db.prepare("SELECT id FROM smartqr_payments WHERE shop_id=(SELECT id FROM smartqr_shops WHERE shop_code=?) AND payment_kind='setup' AND status='captured' LIMIT 1").bind(shopCode).first();
        if (!payment) return fail("The verified setup payment must be captured before approval.",409);
      }
      await db.prepare("UPDATE smartqr_shops SET approval_status=?,updated_at=CURRENT_TIMESTAMP WHERE shop_code=?").bind(status,shopCode).run();
      await db.prepare("INSERT INTO smartqr_audit_logs(actor_user_id,action,detail_json) VALUES(?,?,?)").bind(user.id,"shop_status_changed",JSON.stringify({shopCode,status})).run();
      return response({message:"Shop status updated."});
    }

    return fail("Smart QR endpoint not found.",404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return fail(message.includes("RESEND_API_KEY") ? message : "The request could not be completed. Please try again.", message.includes("RESEND_API_KEY") ? 503 : 500);
  }
};
