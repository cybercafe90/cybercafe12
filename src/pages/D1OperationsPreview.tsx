import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Database, FileText, Mail, RefreshCw, ShieldCheck, Sparkles, Users } from "lucide-react";
import "./D1OperationsPreview.css";

type Snapshot = {
  connected: boolean;
  branch?: string;
  counts?: Record<string, number>;
  demoOrder?: { id: string; tracking_code: string; order_status: string; payment_status: string } | null;
  error?: string;
};

const metrics = [
  { key: "print_orders", label: "Print orders", icon: FileText },
  { key: "print_customers", label: "Independent customers", icon: Users },
  { key: "print_events", label: "Activity events", icon: Activity },
  { key: "email_delivery_log", label: "Email log rows", icon: Mail },
  { key: "integration_events", label: "Integration events", icon: Database },
];

export default function D1OperationsPreview() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/d1-preview", { cache: "no-store" });
      const data = await response.json() as Snapshot;
      setSnapshot(data);
      if (!response.ok) setNotice(data.error || "D1 preview is not available.");
    } catch {
      setSnapshot({ connected: false, error: "Could not reach the D1 preview endpoint." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const createDemo = async () => {
    setSeeding(true);
    setNotice("");
    try {
      const response = await fetch("/api/d1-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_demo" }),
      });
      const data = await response.json() as { message?: string; error?: string };
      setNotice(response.ok ? (data.message || "Demo record prepared.") : (data.error || "Demo record could not be created."));
      await refresh();
    } catch {
      setNotice("D1 preview request failed. Please refresh and try again.");
    } finally {
      setSeeding(false);
    }
  };

  return <main className="d1-preview">
    <header className="d1-head">
      <div className="d1-brand"><span><Database size={22}/></span><div><b>BABA'S CYBER CAFE</b><small>D1 PRINT OPERATIONS PREVIEW</small></div></div>
      <span className="d1-tag"><Sparkles size={13}/> PREVIEW ENVIRONMENT</span>
    </header>
    <section className="d1-content">
      <div className="d1-intro">
        <div className="d1-kicker">CLOUDFLARE D1 · ISOLATED TEST</div>
        <h1>Independent print operations</h1>
        <p>Check the live D1 connection and create one synthetic record to verify the independent customer register, print-order table and activity history.</p>
      </div>
      <div className="d1-safety"><ShieldCheck size={19}/><div><b>Preview-only safeguards</b><span>No Supabase records are copied. No real customer information, documents, payments, emails or printer jobs are processed here.</span></div></div>
      <section className="d1-panel">
        <div className="d1-panel-top"><div><span className="d1-kicker">DATABASE STATUS</span><h2>Connection health</h2></div><button onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? "d1-spin" : ""}/> Refresh</button></div>
        <div className="d1-status"><i className={snapshot?.connected ? "online" : "offline"}/><b>{loading ? "Checking D1…" : snapshot?.connected ? "Connected to D1" : "Connection unavailable"}</b><small>{snapshot?.branch || "Preview branch only"}</small></div>
        <div className="d1-metrics">{metrics.map(({key,label,icon:Icon}) => <article key={key}><span><Icon size={17}/></span><small>{label}</small><strong>{loading ? "…" : snapshot?.counts?.[key] ?? "—"}</strong></article>)}</div>
        {snapshot?.demoOrder && <div className="d1-order"><CheckCircle2 size={18}/><div><b>Demo order exists · {snapshot.demoOrder.tracking_code}</b><small>Payment: {snapshot.demoOrder.payment_status} · Status: {snapshot.demoOrder.order_status}</small></div></div>}
        <div className="d1-actions"><button className="d1-primary" onClick={() => void createDemo()} disabled={!snapshot?.connected || seeding || Boolean(snapshot?.demoOrder)}>{seeding ? "Preparing demo…" : snapshot?.demoOrder ? "Demo record already created" : "Create one synthetic test record"}</button><small>Idempotent action: repeat clicks cannot create duplicate demo records.</small></div>
        {notice && <p className="d1-notice" role="status">{notice}</p>}
        {snapshot?.error && <p className="d1-error" role="alert">{snapshot.error}</p>}
      </section>
      <section className="d1-next">
        <div><b>What this preview proves</b><p>Website → Pages Function → D1 binding → database tables. This is a connectivity and schema test, not yet the live print or payment integration.</p></div>
        <span><CheckCircle2 size={17}/> No production switch</span>
      </section>
      <footer className="d1-foot">BABA'S CYBER CAFE · Srinagar, Jammu &amp; Kashmir · Preview branch only</footer>
    </section>
  </main>;
}
