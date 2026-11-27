import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, FileQuestion, RefreshCw, ShieldCheck } from "lucide-react";
import { callFunction } from "../lib/supabase";
import "./InstantApiCaseDesk.css";

type CaseRecord = { case_reference: string; case_type: string; status: string; admin_note: string | null; created_at: string; updated_at: string; resolved_at: string | null };
type LookupResponse = {
  order: { serviceReference: string; service: string; amount: number; status: string; refundStatus: string; refundAmount: number | null; refundReference: string | null; createdAt: string; paidAt: string | null };
  cases: CaseRecord[];
};

const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
const label = (value: string) => value.replaceAll("_", " ");

export default function InstantApiCustomerCaseDesk({ initialReference = "", initialToken = "" }: { initialReference?: string; initialToken?: string }) {
  const [reference, setReference] = useState(initialReference);
  const [token, setToken] = useState(initialToken);
  const [data, setData] = useState<LookupResponse | null>(null);
  const [caseType, setCaseType] = useState("failed_service");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setReference(initialReference);
    setToken(initialToken);
  }, [initialReference, initialToken]);

  async function lookup(event?: React.FormEvent) {
    event?.preventDefault();
    if (!reference.trim() || !token.trim()) { setError("Enter your E-Service ID and secure tracking code."); return; }
    setLoading(true); setError(""); setNotice(""); setData(null);
    try {
      const result = await callFunction<LookupResponse>("instant-api-cases", { action: "lookup", serviceReference: reference.trim(), retrievalToken: token.trim() });
      setData(result);
      const orderStatus = result.order.status;
      setCaseType(["failed", "refund_pending", "refunded"].includes(orderStatus) ? "failed_service" : ["paid", "processing", "fulfillment_unknown"].includes(orderStatus) ? "delayed_service" : "payment_issue");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not verify this transaction.");
    } finally { setLoading(false); }
  }

  async function submitCase(event: React.FormEvent) {
    event.preventDefault();
    if (!data || submitting) return;
    setSubmitting(true); setError(""); setNotice("");
    try {
      const result = await callFunction<{ caseReference: string; status: string; message: string }>("instant-api-cases", {
        action: "submit_case", serviceReference: data.order.serviceReference, retrievalToken: token.trim(), caseType, message: message.trim(),
      });
      setMessage("");
      await lookup();
      setNotice("Query registered: " + result.caseReference + ". Keep this reference for follow-up.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your query could not be submitted.");
    } finally { setSubmitting(false); }
  }

  return <section className="iac-case-desk" aria-label="Instant API service tracking and refund queries">
    <div className="iac-case-head"><span><FileQuestion size={18}/></span><div><b>Track service / raise a query</b><small>Use your E-Service ID and secure tracking code.</small></div></div>
    <form className="iac-case-lookup" onSubmit={lookup}>
      <label>E-Service ID<input value={reference} onChange={event => setReference(event.target.value.toUpperCase())} placeholder="BBC-2026-000001" autoComplete="off" required/></label>
      <label>Secure tracking code<input value={token} onChange={event => setToken(event.target.value)} placeholder="Code shown after checkout" autoComplete="off" required/></label>
      <button type="submit" disabled={loading}>{loading ? <RefreshCw className="iac-spin" size={15}/> : <ShieldCheck size={15}/>} Verify</button>
    </form>
    {error && <p className="iac-case-alert error" role="alert"><AlertCircle size={15}/>{error}</p>}
    {notice && <p className="iac-case-alert success" role="status"><CheckCircle2 size={15}/>{notice}</p>}
    {data && <>
      <div className="iac-case-order">
        <div><small>Service</small><b>{label(data.order.service)}</b></div>
        <div><small>Payment</small><b>{money(Number(data.order.amount))}</b></div>
        <div><small>Service status</small><b>{label(data.order.status)}</b></div>
        <div><small>Refund status</small><b>{label(data.order.refundStatus || "none")}</b></div>
      </div>
      {data.order.refundStatus === "refunded" && <p className="iac-case-alert success"><CheckCircle2 size={15}/> Refund confirmed{data.order.refundReference ? " · Reference " + data.order.refundReference : ""}.</p>}
      {data.cases.length > 0 && <div className="iac-case-history"><b>Query history</b>{data.cases.map(item => <article key={item.case_reference}><span>{item.case_reference}</span><strong>{label(item.case_type)} · {label(item.status)}</strong><small>{new Date(item.created_at).toLocaleString("en-IN")}</small>{item.admin_note && <p>{item.admin_note}</p>}</article>)}</div>}
      <form className="iac-case-form" onSubmit={submitCase}>
        <b>Need help with this transaction?</b>
        <label>Query type<select value={caseType} onChange={event => setCaseType(event.target.value)}>
          {["failed","refund_pending","refunded"].includes(data.order.status) && <option value="failed_service">Service failed / refund query</option>}
          {["paid","processing","fulfillment_unknown"].includes(data.order.status) && <option value="delayed_service">Service taking too long</option>}
          <option value="payment_issue">Payment deducted / payment confirmation issue</option>
        </select></label>
        <label>Describe the issue<textarea value={message} onChange={event => setMessage(event.target.value)} minLength={8} maxLength={1000} required placeholder="Briefly describe what happened. Do not include OTPs, PINs or passwords."/></label>
        <button type="submit" disabled={submitting || !message.trim()}>{submitting ? "Submitting…" : "Submit service query"}</button>
        <small><Clock3 size={13}/> Delayed-service queries are available after 15 minutes. Payment issues are sent for reconciliation before any refund decision.</small>
      </form>
    </>}
  </section>;
}
