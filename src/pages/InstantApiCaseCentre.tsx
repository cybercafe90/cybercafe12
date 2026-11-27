import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { callFunction } from "../lib/supabase";
import "./InstantApiCaseDesk.css";

type ApiCase = {
  id: string; case_reference: string; order_id: string; case_type: string; customer_message: string; status: string; admin_note: string | null; created_at: string;
  instant_api_orders: { service_reference: string; service_slug: string; customer_price: number; status: string; refund_status: string; refund_amount: number | null; refund_id: string | null; refund_reference: string | null; razorpay_payment_id: string | null; razorpay_order_id: string | null; paid_at: string | null; created_at: string } | null;
};

const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
const label = (value: string) => value.replaceAll("_", " ");

export default function InstantApiCaseCentre() {
  const [cases, setCases] = useState<ApiCase[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await callFunction<{ cases: ApiCase[] }>("instant-api-cases", { action: "admin_list" });
      setCases(result.cases ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load customer service queries.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function updateCase(item: ApiCase, status: string) {
    setBusyId(item.id); setError(""); setNotice("");
    try {
      await callFunction("instant-api-cases", { action: "admin_update_case", caseId: item.id, status, adminNote: notes[item.id] ?? "" });
      setNotice(item.case_reference + " updated.");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Case update failed.");
    } finally { setBusyId(""); }
  }

  async function approveRefund(item: ApiCase) {
    const amount = item.instant_api_orders ? money(Number(item.instant_api_orders.customer_price)) : "the captured amount";
    if (!window.confirm("Approve a full refund of " + amount + " for " + (item.instant_api_orders?.service_reference ?? item.case_reference) + "? Razorpay will be checked for existing refunds first.")) return;
    setBusyId(item.id); setError(""); setNotice("");
    try {
      const result = await callFunction<{ status: string; message: string }>("instant-api-cases", { action: "admin_approve_refund", caseId: item.id });
      setNotice(item.case_reference + ": " + result.message);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Refund could not be processed.");
    } finally { setBusyId(""); }
  }

  const openCount = cases.filter(item => ["open", "under_review", "awaiting_customer"].includes(item.status)).length;
  const refundCount = cases.filter(item => item.instant_api_orders && ["requested", "under_review", "approved", "processing"].includes(item.instant_api_orders.refund_status)).length;

  return <section className="ia-case-admin" id="ia-case-centre" aria-label="Instant API failure and refund management">
    <div className="ia-ops-head"><div><span className="ia-eyebrow">CUSTOMER PROTECTION · OWNER ONLY</span><h2>Service Failure &amp; Refund Centre</h2><p>Review failed transactions, delayed services, payment queries and verified refund outcomes.</p></div><button className="ia-button ia-button-muted" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15}/>{loading ? "Refreshing…" : "Refresh cases"}</button></div>
    {error && <p className="ia-alert ia-error" role="alert"><AlertTriangle size={15}/>{error}</p>}
    {notice && <p className="ia-alert ia-success" role="status"><CheckCircle2 size={15}/>{notice}</p>}
    <div className="ia-ops-stats"><div><small>Customer queries</small><b>{cases.length}</b></div><div><small>Open / in review</small><b>{openCount}</b></div><div><small>Refunds requiring action</small><b>{refundCount}</b></div><div><small>Resolved</small><b>{cases.filter(item => item.status === "resolved").length}</b></div></div>
    {loading && <p className="ia-ops-muted">Loading customer queries…</p>}
    {!loading && !cases.length && <p className="ia-ops-muted">No service failure or payment queries have been raised.</p>}
    <div className="ia-case-admin-list">{cases.map(item => {
      const order = item.instant_api_orders;
      const canRefund = !!order && ["failed", "refund_pending"].includes(order.status) && order.refund_status !== "refunded" && !!order.razorpay_payment_id;
      return <article className="ia-case-admin-card" key={item.id}>
        <div className="ia-case-admin-title"><div><span>{item.case_reference}</span><b>{label(item.case_type)}</b></div><em className={"ia-ops-status status-" + item.status}>{label(item.status)}</em></div>
        <div className="ia-case-admin-facts">
          <div><small>E-Service ID</small><b>{order?.service_reference ?? "—"}</b></div>
          <div><small>Service</small><b>{order?.service_slug ?? "—"}</b></div>
          <div><small>Amount</small><b>{order ? money(Number(order.customer_price)) : "—"}</b></div>
          <div><small>Razorpay payment</small><b>{order?.razorpay_payment_id ? order.razorpay_payment_id.slice(0, 14) + "…" : "Not verified"}</b></div>
          <div><small>Razorpay order</small><b>{order?.razorpay_order_id ? order.razorpay_order_id : "Not created"}</b></div>
          <div><small>Service / refund</small><b>{order ? label(order.status) + " / " + label(order.refund_status) : "Order unavailable"}</b></div>
          <div><small>Raised</small><b>{new Date(item.created_at).toLocaleString("en-IN")}</b></div>
        </div>
        <p className="ia-case-customer-message">{item.customer_message}</p>
        {order?.refund_reference && <p className="ia-case-refund-ref">Refund reference: <code>{order.refund_reference}</code></p>}
        <label className="ia-case-admin-note">Customer-visible update note<textarea value={notes[item.id] ?? item.admin_note ?? ""} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} placeholder="Explain what was checked or what the customer should do next."/></label>
        <div className="ia-case-admin-actions">
          <button type="button" onClick={() => void updateCase(item, "under_review")} disabled={busyId === item.id}><ClipboardCheck size={14}/> Mark under review</button>
          <button type="button" onClick={() => void updateCase(item, "awaiting_customer")} disabled={busyId === item.id}>Awaiting customer</button>
          <button type="button" onClick={() => void updateCase(item, "rejected")} disabled={busyId === item.id || (notes[item.id] ?? item.admin_note ?? "").trim().length < 8}>Reject with reason</button>
          {canRefund && <button type="button" className="refund" onClick={() => void approveRefund(item)} disabled={busyId === item.id}><ShieldCheck size={14}/> {busyId === item.id ? "Processing…" : "Approve & process refund"}</button>}
          {order?.refund_status === "processing" && <span className="ia-case-processing">Refund submitted; verify Razorpay status before closing.</span>}
          {item.status === "resolved" && <span className="ia-case-resolved">Resolved</span>}
        </div>
      </article>;
    })}</div>
  </section>;
}
