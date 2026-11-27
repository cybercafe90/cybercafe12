import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, CircleAlert, ExternalLink, KeyRound, RefreshCw, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./InstantApiAdminPortal.css";
import InstantApiOperations from "./InstantApiOperations";

type InstantService = {
  slug: string;
  name: string;
  description: string;
  provider_name: string | null;
  endpoint_url: string | null;
  http_method: "GET" | "POST";
  api_key_secret_name: string;
  provider_cost: number | null;
  customer_price: number;
  is_enabled: boolean;
  is_featured: boolean;
  authorization_verified: boolean;
  sort_order: number;
  updated_at: string;
};

const money = (value: number | null) => value === null ? "Not set" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
const secretName = (slug: string) => "INSTANT_API_" + slug.toUpperCase().replaceAll("-", "_") + "_KEY";
const safeEndpoint = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !["localhost", "127.0.0.1", "::1"].includes(url.hostname) &&
      !url.hostname.endsWith(".local");
  } catch { return false; }
};

export default function InstantApiAdminPortal() {
  const [access, setAccess] = useState<"checking" | "owner" | "signed-out" | "not-owner" | "unavailable">("checking");
  const [items, setItems] = useState<InstantService[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [draft, setDraft] = useState<InstantService | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) throw new Error("Supabase is not configured.");
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase.from("instant_api_services").select("*").order("sort_order");
      if (queryError) throw queryError;
      const rows = (data ?? []) as InstantService[];
      setItems(rows);
      setSelectedSlug(current => rows.some(row => row.slug === current) ? current : rows[0]?.slug ?? "");
      setDraft(current => {
        const row = rows.find(item => item.slug === current?.slug) ?? rows[0];
        return row ? { ...row } : null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) { queueMicrotask(() => setAccess("unavailable")); return; }
    let active = true;
    const verify = async (userId: string | null) => {
      if (!userId) { if (active) setAccess("signed-out"); return; }
      const { data, error: roleError } = await supabase!.from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
      if (!active) return;
      setAccess(roleError ? "unavailable" : data?.role === "owner" ? "owner" : "not-owner");
    };
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) throw sessionError;
      return verify(data.session?.user?.id ?? null);
    }).catch(() => { if (active) setAccess("unavailable"); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => void verify(session?.user?.id ?? null));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (access !== "owner") return;
    queueMicrotask(() => void load().catch(reason => setError(reason instanceof Error ? reason.message : "Could not load API service settings.")));
  }, [access, load]);

  function choose(item: InstantService) {
    setSelectedSlug(item.slug);
    setDraft({ ...item });
    setNotice("");
    setError("");
  }

  function update<K extends keyof InstantService>(key: K, value: InstantService[K]) {
    setDraft(current => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!supabase || !draft) return;
    setError("");
    setNotice("");
    if (draft.endpoint_url && !safeEndpoint(draft.endpoint_url)) {
      setError("Endpoint must be a valid HTTPS URL without embedded credentials or a local hostname.");
      return;
    }
    if (!Number.isFinite(Number(draft.customer_price)) || Number(draft.customer_price) < 0) {
      setError("Enter a valid customer price.");
      return;
    }
    if (draft.provider_cost !== null && (!Number.isFinite(Number(draft.provider_cost)) || Number(draft.provider_cost) < 0)) {
      setError("Provider cost must be a non-negative amount or left blank.");
      return;
    }
    if (draft.is_enabled && (!draft.endpoint_url || !draft.authorization_verified)) {
      setError("A service cannot be enabled until its HTTPS endpoint is saved and provider authorization has been verified.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        provider_name: draft.provider_name?.trim() || null,
        endpoint_url: draft.endpoint_url?.trim() || null,
        http_method: draft.http_method,
        provider_cost: draft.provider_cost === null ? null : Number(draft.provider_cost),
        customer_price: Number(draft.customer_price),
        is_enabled: draft.is_enabled,
        is_featured: draft.is_featured,
        authorization_verified: draft.authorization_verified,
      };
      const { error: updateError } = await supabase.from("instant_api_services").update(payload).eq("slug", draft.slug);
      if (updateError) throw updateError;
      await load();
      setNotice("Settings saved. Provider credentials remain outside the database.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (access === "checking") return <main className="ia-admin"><div className="ia-message">Verifying owner access…</div></main>;
  if (access !== "owner") return <main className="ia-admin"><div className="ia-message"><ShieldCheck size={28}/><h1>Owner access required</h1><p>{access === "signed-out" ? "Sign in with your existing BABA'S CYBER CAFE owner account." : access === "not-owner" ? "This account does not have the owner role." : "Secure owner authentication is unavailable. Check Supabase configuration."}</p><Link to="/admin/login" className="ia-button">Open owner login</Link><Link to="/" className="ia-back">Return to website</Link></div></main>;

  return (
    <main className="ia-admin">
      <header className="ia-top"><Link to="/admin" className="ia-brand"><ShieldCheck size={23}/> BABA'S CYBER CAFE <small>INSTANT API CONTROL</small></Link><div><span className="ia-owner"><ShieldCheck size={14}/> OWNER VERIFIED</span><Link to="/admin" className="ia-back"><ArrowLeft size={15}/> Main admin</Link></div></header>
      <nav className="ia-admin-nav" aria-label="Instant API administration">
        <a href="#ia-overview">Overview</a>
        <a href="#ia-services" aria-current="page">Services &amp; Pricing</a>
        <a href="#ia-orders">Orders</a>
        <a href="#ia-health">API Health</a>
        <a href="#ia-reconciliation">Reconciliation</a>
        <a href="#ia-audit">Audit Logs</a>
        <a href="#ia-refunds">Refunds</a>
      </nav>
      <div className="ia-layout">
        <aside className="ia-sidebar" id="ia-overview"><span className="ia-eyebrow">SERVICE MANAGEMENT</span><h2>Instant API</h2><p>Configure provider endpoints, selling prices and activation controls.</p><div className="ia-side-stats"><span>Configured services</span><b>{items.length}</b><span>Enabled for customers</span><b>{items.filter(item => item.is_enabled && item.authorization_verified).length}</b></div><button className="ia-button ia-button-muted" onClick={() => setShowSetup(value => !value)}><KeyRound size={15}/> API key setup guide</button></aside>
        <section className="ia-main" id="ia-services">
          <div className="ia-heading"><div><span className="ia-eyebrow">OWNER CONSOLE / API CATALOGUE</span><h1>Instant Services Control</h1><p>Set provider cost, customer price, endpoint and activation status.</p></div><button className="ia-button ia-button-muted" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> {loading ? "Refreshing…" : "Refresh"}</button></div>
          {error && <div className="ia-alert ia-error" role="alert"><CircleAlert size={16}/>{error}</div>}
          {notice && <div className="ia-alert ia-success" role="status"><Check size={16}/>{notice}</div>}
          {showSetup && <section className="ia-setup"><h2><KeyRound size={18}/> Secure API key setup</h2><ol><li>Open your Supabase project dashboard and select <b>Edge Functions → Secrets</b>.</li><li>Add the exact secret name shown for each service below.</li><li>Paste the provider API key in the Supabase secret value field, then save. Never add keys to this website, GitHub, SQL or a public environment variable.</li><li>Use a different key for each provider/service where the provider issues separate keys. Rotate any key previously pasted into a chat or source file.</li></ol><a href="https://supabase.com/dashboard/project/dyzyfugxzsdvboxerbxv/functions/secrets" target="_blank" rel="noreferrer">Open Supabase Edge Function secrets <ExternalLink size={13}/></a><p>Adding a secret does not activate a service. The API gateway must be deployed and tested against that provider's documented request format first.</p></section>}
          <div className="ia-grid">
            <nav className="ia-list" aria-label="Instant API services">{items.map(item => <button key={item.slug} className={item.slug === selectedSlug ? "ia-service is-selected" : "ia-service"} onClick={() => choose(item)}><span>{item.name}</span><small>{money(item.customer_price)} · Cost {money(item.provider_cost)}</small><em className={item.is_enabled && item.authorization_verified ? "ia-live" : "ia-off"}>{item.is_enabled && item.authorization_verified ? "Customer enabled" : "Not live"}</em></button>)}</nav>
            {draft && <section className="ia-editor"><div className="ia-editor-head"><div><span className="ia-eyebrow">SERVICE CONFIGURATION</span><h2>{draft.name}</h2><p>Reference: <code>{draft.slug}</code></p></div><span className="ia-lock"><ShieldCheck size={15}/> Owner only</span></div>
              <div className="ia-form-grid">
                <label>Provider name<input value={draft.provider_name ?? ""} onChange={e => update("provider_name", e.target.value || null)} placeholder="API provider / vendor"/></label>
                <label>Endpoint URL<input type="url" inputMode="url" value={draft.endpoint_url ?? ""} onChange={e => update("endpoint_url", e.target.value || null)} placeholder="https://provider.example/api/endpoint"/></label>
                <label>HTTP method<select value={draft.http_method} onChange={e => update("http_method", e.target.value as "GET" | "POST")}><option value="POST">POST</option><option value="GET">GET</option></select></label>
                <label>Provider cost (₹)<input type="number" min="0" step="0.01" value={draft.provider_cost ?? ""} onChange={e => update("provider_cost", e.target.value === "" ? null : Number(e.target.value))} placeholder="Leave blank if unknown"/></label>
                <label>Customer selling price (₹)<input type="number" min="0" step="0.01" value={draft.customer_price} onChange={e => update("customer_price", Number(e.target.value))}/></label>
                <label>API key secret name (read-only)<input readOnly value={draft.api_key_secret_name || secretName(draft.slug)}/></label>
              </div>
              <div className="ia-secret"><KeyRound size={17}/><div><b>API key is not stored here</b><p>Add <code>{draft.api_key_secret_name || secretName(draft.slug)}</code> under Supabase Edge Function Secrets. Only the server-side function can read it.</p></div><button type="button" className="ia-copy" onClick={() => void navigator.clipboard?.writeText(draft.api_key_secret_name || secretName(draft.slug))}>Copy name</button></div>
              <div className="ia-checks"><label><input type="checkbox" checked={draft.is_featured} onChange={e => update("is_featured", e.target.checked)}/> Featured service</label><label><input type="checkbox" checked={draft.authorization_verified} onChange={e => update("authorization_verified", e.target.checked)}/> Provider authorization and lawful consent process verified</label><label><input type="checkbox" checked={draft.is_enabled} onChange={e => update("is_enabled", e.target.checked)}/> Enable for customers</label></div>
              <div className="ia-margin"><div><span>Estimated gross margin</span><b>{draft.provider_cost === null ? "Pending provider cost" : money(Number(draft.customer_price) - Number(draft.provider_cost))}</b></div><small>Before Razorpay fees, taxes, refunds and operating costs.</small></div>
              <button className="ia-button ia-save" onClick={() => void save()} disabled={saving}><Save size={16}/>{saving ? "Saving…" : "Save service settings"}</button>
            </section>}
          </div>
          <div className="ia-warning"><SlidersHorizontal size={17}/><p><b>Important:</b> This console saves catalogue settings only. It does not make provider requests or mark payments as paid. Customer lookups must remain unavailable until the API gateway, verified Razorpay payment flow, provider request mapping, consent checks and result handling are implemented and tested.</p></div>
          <InstantApiOperations />
        </section>
      </div>
    </main>
  );
}
