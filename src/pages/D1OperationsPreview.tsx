import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Database, FileText, Mail, RefreshCw, ShieldCheck, Sparkles, Users, Trash2 } from "lucide-react";
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
  const [markingPrinted, setMarkingPrinted] = useState(false);
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
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const runAction = async (action: "seed_demo" | "mark_demo_printed") => {
    action === "seed_demo" ? setSeeding(true) : setMarkingPrinted(true);
    setNotice("");
    try {
      const response = await fetch("/api/d1-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json() as { message?: string; error?: string };
      setNotice(response.ok ? (data.message || "Preview action completed.") : (data.error || "Preview action failed."));
      await refresh();
    } catch {
      setNotice("D1 preview request failed. Please refresh and try again.");
    } finally {
      setSeeding(false);
      setMarkingPrinted(false);
    }
  };

  const demoPrinted = snapshot?.demoOrder?.order_status === "printed";

  return <main className="d1-preview">
    <header className="d1-head">
      <div className="d1-brand"><span><Database size={22}/></span><div><b>BABA'S CYBER CAFE</b><small>D1 PRINT OPERATIONS PREVIEW</small></div></div>
      <span className="d1-tag"><Sparkles size={13}/> PREVIEW ENVIRONMENT</span>
    </header>
    <section className="d1-content">
      <div className="d1-intro">
        <div className="d1-kicker">CLOUDFLARE D1 · ISOLATED TEST</div>
        <h1>Print, confirm &amp; clean up</h1>
        <p>Test the independent D1 connection and the proposed print-only document cleanup lifecycle using a synthetic order.</p>
      </div>
      <div className="d1-safety"><ShieldCheck size={19}/><div><b>Strict data separation</b><span>Only synthetic print-order data is used. Government-service application documents are excluded. No real Supabase file, payment, email or printer job is touched.</span></div></div>
      <section className="d1-panel">
        <div className="d1-panel-top"><div><span className="d1-kicker">DATABASE STATUS</span><h2>Connection health</h2></div><button onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? "d1-spin" : ""}/> Refresh</button></div>
        <div className="d1-status"><i className={snapshot?.connected ? "online" : "offline"}/><b>{loading ? "Checking D1…" : snapshot?.connected ? "Connected to D1" : "Connection unavailable"}</b><small>{snapshot?.branch || "Preview branch only"}</small></div>
        <div className="d1-metrics">{metrics.map(({key,label,icon:Icon}) => <article key={key}><span><Icon size={17}/></span><small>{label}</small><strong>{loading ? "…" : snapshot?.counts?.[key] ?? "—"}</strong></article>)}</div>
        {snapshot?.demoOrder && <div className="d1-order"><CheckCircle2 size={18}/><div><b>Demo order · {snapshot.demoOrder.tracking_code}</b><small>Payment: {snapshot.demoOrder.payment_status} · Status: {snapshot.demoOrder.order_status}</small></div></div>}
        <div className="d1-actions">
          <button className="d1-primary" onClick={() => void runAction("seed_demo")} disabled={!snapshot?.connected || seeding || Boolean(snapshot?.demoOrder)}>{seeding ? "Preparing demo…" : snapshot?.demoOrder ? "Demo record already created" : "1. Create synthetic print order"}</button>
          {snapshot?.demoOrder && <button className="d1-cleanup" onClick={() => void runAction("mark_demo_printed")} disabled={!snapshot.connected || markingPrinted || demoPrinted}>{markingPrinted ? "Recording Printed…" : demoPrinted ? "Printed status recorded" : "2. Mark demo as Printed"}</button>}
          <small>These controls update only the synthetic D1 preview record.</small>
        </div>
        {demoPrinted && <div className="d1-cleanup-preview"><Trash2 size={18}/><div><b>Print-file cleanup eligibility recorded</b><span>In the eventual live flow, only this print-order file would be deleted after Printed is confirmed. Tracking, payment/status history and audit events remain. Application documents are never included.</span><small>SIMULATION ONLY · No real file exists here; no deletion has been executed.</small></div></div>}
        {notice && <p className="d1-notice" role="status">{notice}</p>}
        {snapshot?.error && <p className="d1-error" role="alert">{snapshot.error}</p>}
      </section>
      <section className="d1-next">
        <div><b>Next implementation stage</b><p>After this preview is reviewed, the live Supabase print workflow needs a separately secured admin-only Printed action, idempotent deletion of the exact print-jobs storage object, and a retained audit event. The Windows desktop-agent status “sent_to_printer” will not trigger deletion.</p></div>
        <span><CheckCircle2 size={17}/> Production unchanged</span>
      </section>
      <footer className="d1-foot">BABA'S CYBER CAFE · Srinagar, Jammu &amp; Kashmir · Preview branch only</footer>
    </section>
  </main>;
}
