import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { callFunction, isSupabaseConfigured, supabase } from "../lib/supabase";

type SecurityEvent = {
  id: string;
  occurred_at: string;
  source: string;
  event_type: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  status: "new" | "investigating" | "contained" | "resolved" | "false_positive";
  source_ip: string | null;
  route: string | null;
  summary: string;
  customer_reference: string | null;
};
type Overview = {
  events: SecurityEvent[];
  actor: { role: "owner" | "investigator"; permissions: string[] };
  monitoring: { event_count: number; note: string; telemetry_sources: string[] };
};
type Investigator = { user_id: string; email: string; enabled: boolean; permissions: string[]; granted_at: string; revoked_at: string | null };

const severityClass = (severity: SecurityEvent["severity"]) => `incident-severity severity-${severity}`;

export default function InvestigationPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [investigators, setInvestigators] = useState<Investigator[]>([]);
  const [investigatorEmail, setInvestigatorEmail] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!supabase) throw new Error("Secure services are not configured.");
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setData(null);
        setError("Sign in with an approved owner or investigator account to continue.");
        return;
      }
      const overview = await callFunction<Overview>("investigation-overview", {}, sessionData.session.access_token);
      setData(overview);
      if (overview.actor.role === "owner") {
        const grants = await callFunction<{ investigators: Investigator[] }>("investigation-manage-investigator", { action: "list" }, sessionData.session.access_token);
        setInvestigators(grants.investigators);
      } else {
        setInvestigators([]);
      }
    } catch (reason) {
      setData(null);
      setError(reason instanceof Error ? reason.message : "Investigation data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function manageInvestigator(action: "grant" | "revoke", target?: Investigator) {
    if (!supabase) return;
    setGrantBusy(true);
    setError("");
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const payload = action === "grant"
        ? { action, email: investigatorEmail, permissions: ["view_events", "investigate"] }
        : { action, user_id: target?.user_id };
      await callFunction("investigation-manage-investigator", payload, sessionData.session?.access_token);
      setMessage(action === "grant" ? "Verified account granted investigator access." : "Investigator access revoked.");
      setInvestigatorEmail("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Investigator access could not be updated.");
    } finally {
      setGrantBusy(false);
    }
  }

  async function updateStatus(event: SecurityEvent, status: SecurityEvent["status"]) {
    const reason = (reasons[event.id] ?? "").trim();
    if (!reason) {
      setError("Enter a short investigation note before changing an incident status.");
      return;
    }
    if (!supabase) return;
    setBusyId(event.id);
    setError("");
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      await callFunction("investigation-update-event", { id: event.id, status, reason }, sessionData.session?.access_token);
      setMessage("Incident status updated and the action was recorded.");
      setReasons((current) => ({ ...current, [event.id]: "" }));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Incident update failed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="content-page investigation-page">
      <div className="investigation-heading">
        <div>
          <span className="eyebrow">RESTRICTED SECURITY WORKSPACE</span>
          <h1>Investigation portal</h1>
          <p>Review recorded security events and document incident handling. This portal only displays telemetry that has actually been collected.</p>
        </div>
        <button className="button button-outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} /> {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {!isSupabaseConfigured && <div className="notice notice-warn">The secure backend is not configured.</div>}
      {error && <div className="notice notice-error" role="alert">{error} <Link to="/admin/login">Open secure sign-in</Link></div>}
      {message && <div className="notice notice-success" role="status">{message}</div>}

      {loading ? <div className="investigation-empty"><Activity size={22} /> Loading restricted event feed…</div> : data ? (
        <>
          <section className="investigation-summary">
            <div><span className="eyebrow">RECORDED EVENTS</span><strong>{data.monitoring.event_count}</strong><small>Latest 100 events</small></div>
            <div><span className="eyebrow">ACCESS LEVEL</span><strong>{data.actor.role === "owner" ? "Owner" : "Investigator"}</strong><small>Verified account</small></div>
            <div><span className="eyebrow">EVENT SOURCES</span><strong>{data.monitoring.telemetry_sources.length}</strong><small>Configured source types, not live connection status</small></div>
          </section>
          <div className="notice notice-warn investigation-warning"><AlertTriangle size={17} /> {data.monitoring.note} Cloudflare log collection, Supabase audit streaming and automated alert delivery are not confirmed by this event feed.</div>
          {data.actor.role === "owner" && (
            <section className="investigator-management">
              <div className="admin-section-head"><div><span className="eyebrow">OWNER CONTROL</span><h2>Investigator access</h2></div></div>
              <p>Only an existing, email-verified account can be granted access. This does not create accounts or permit public registration.</p>
              <form className="investigator-grant-form" onSubmit={(event) => { event.preventDefault(); void manageInvestigator("grant"); }}>
                <input type="email" value={investigatorEmail} onChange={(event) => setInvestigatorEmail(event.target.value)} required maxLength={254} placeholder="Existing verified account email" />
                <button className="button button-dark" disabled={grantBusy}>{grantBusy ? "Saving…" : "Grant access"}</button>
              </form>
              {investigators.length === 0 ? <p className="investigator-empty-note">No investigator grants exist.</p> : investigators.map((person) => (
                <div className="investigator-row" key={person.user_id}>
                  <div><strong>{person.email}</strong><small>{person.permissions.join(" · ") || "No permissions"} · {person.enabled ? "Enabled" : "Revoked"}</small></div>
                  {person.enabled && <button className="button button-outline" disabled={grantBusy} onClick={() => void manageInvestigator("revoke", person)}>Revoke</button>}
                </div>
              ))}
            </section>
          )}
          <section className="investigation-events">
            <div className="admin-section-head">
              <div><span className="eyebrow">INCIDENT REGISTER</span><h2>Security events</h2></div>
              <span className="investigation-access"><ShieldCheck size={15} /> {data.actor.role} access</span>
            </div>
            {data.events.length === 0 ? (
              <div className="investigation-empty"><ShieldCheck size={25} /><h2>No events recorded yet</h2><p>This is an empty event register, not a clean security bill of health. Connect and test event sources before relying on monitoring.</p></div>
            ) : data.events.map((event) => (
              <article className="incident-card" key={event.id}>
                <div className="incident-topline">
                  <span className={severityClass(event.severity)}>{event.severity}</span>
                  <span className="incident-status">{event.status.replace("_", " ")}</span>
                  <time>{new Date(event.occurred_at).toLocaleString("en-IN")}</time>
                </div>
                <h3>{event.summary}</h3>
                <div className="incident-meta">
                  <span><b>Source</b> {event.source}</span>
                  <span><b>Event</b> {event.event_type}</span>
                  {event.route && <span><b>Route</b> {event.route}</span>}
                  {event.source_ip && <span><b>Source IP</b> {event.source_ip}</span>}
                  {event.customer_reference && <span><b>Customer ref</b> {event.customer_reference}</span>}
                </div>
                {data.actor.permissions.includes("investigate") && (
                  <div className="incident-controls">
                    <input aria-label="Investigation note" value={reasons[event.id] ?? ""} onChange={(e) => setReasons((current) => ({ ...current, [event.id]: e.target.value }))} placeholder="Reason / investigation note (required)" maxLength={500} />
                    <select aria-label="New incident status" defaultValue={event.status} id={`status-${event.id}`}>
                      <option value="new">New</option><option value="investigating">Investigating</option><option value="contained">Contained</option><option value="resolved">Resolved</option><option value="false_positive">False positive</option>
                    </select>
                    <button className="button button-dark" disabled={busyId === event.id} onClick={() => {
                      const select = document.getElementById(`status-${event.id}`) as HTMLSelectElement | null;
                      if (select) void updateStatus(event, select.value as SecurityEvent["status"]);
                    }}>{busyId === event.id ? "Saving…" : "Record update"}</button>
                  </div>
                )}
              </article>
            ))}
          </section>
        </>
      ) : (
        <div className="investigation-empty"><ShieldCheck size={25} /><h2>Restricted access</h2><p>Only the verified owner or an investigator explicitly granted access can view this workspace.</p><Link className="button button-dark" to="/admin/login">Go to secure sign-in</Link></div>
      )}
    </main>
  );
}
