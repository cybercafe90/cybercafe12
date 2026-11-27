import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, ClipboardList, FileClock, RefreshCw, RotateCcw, Wallet } from "lucide-react";
import { supabase } from "../lib/supabase";

type Order = {
  id: string; service_slug: string; customer_price: number; status: string;
  provider_cost_actual: number | null; razorpay_order_id: string | null;
  razorpay_payment_id: string | null; paid_at: string | null;
  provider_error_code: string | null; created_at: string; fulfilled_at: string | null;
};
type Service = { slug: string; name: string; is_enabled: boolean; authorization_verified: boolean; endpoint_url: string | null; provider_name: string | null };
type Audit = { id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; created_at: string };

const inr = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
const stamp = (value: string | null) => value ? new Date(value).toLocaleString("en-IN") : "—";
const shortId = (value: string) => value.slice(0, 8).toUpperCase();

export default function InstantApiOperations() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [orderResult, serviceResult, auditResult] = await Promise.all([
        supabase.from("instant_api_orders").select("id,service_slug,customer_price,status,provider_cost_actual,razorpay_order_id,razorpay_payment_id,paid_at,provider_error_code,created_at,fulfilled_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("instant_api_services").select("slug,name,is_enabled,authorization_verified,endpoint_url,provider_name").order("sort_order"),
        supabase.from("admin_audit_logs").select("id,actor_id,action,entity_type,entity_id,metadata,created_at").or("entity_type.eq.instant_api_order,entity_type.eq.instant_api_service,entity_type.eq.instant_api").order("created_at", { ascending: false }).limit(100),
      ]);
      if (orderResult.error) throw orderResult.error;
      if (serviceResult.error) throw serviceResult.error;
      if (auditResult.error) throw auditResult.error;
      setOrders((orderResult.data ?? []) as Order[]);
      setServices((serviceResult.data ?? []) as Service[]);
      setAudit((auditResult.data ?? []) as Audit[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Instant API operations. Confirm that the Instant API migrations have been applied.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const counts = orders.reduce<Record<string, number>>((acc, order) => { acc[order.status] = (acc[order.status] ?? 0) + 1; return acc; }, {});
  const needsAttention = orders.filter(order => ["failed", "fulfillment_unknown", "refund_pending"].includes(order.status));
  const paid = orders.filter(order => ["paid", "processing", "succeeded", "fulfillment_unknown", "refund_pending", "refunded"].includes(order.status));
  const paidTotal = paid.reduce((sum, order) => sum + Number(order.customer_price || 0), 0);
  const costTotal = orders.reduce((sum, order) => sum + Number(order.provider_cost_actual ?? 0), 0);
  const pendingRefunds = orders.filter(order => order.status === "refund_pending");
  const completedRefunds = orders.filter(order => order.status === "refunded");

  return <section className="ia-operations" aria-label="Instant API operational modules">
    <div className="ia-ops-head"><div><span className="ia-eyebrow">LIVE OPERATIONS · OWNER ONLY</span><h2>API Operations Centre</h2><p>Read-only operational visibility. Customer identity inputs and encrypted payloads are never displayed here.</p></div><button className="ia-button ia-button-muted" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15}/>{loading ? "Refreshing…" : "Refresh all"}</button></div>
    {error && <div className="ia-alert ia-error" role="alert"><AlertTriangle size={16}/>{error}</div>}
    {loading && <p className="ia-ops-muted" role="status">Loading operational records…</p>}
    {!loading && !error && <>
      <section className="ia-ops-section" id="ia-orders"><div className="ia-ops-title"><ClipboardList/><div><h3>Orders</h3><p>Latest 200 orders · newest first</p></div></div>
        <div className="ia-ops-stats"><div><small>Total loaded</small><b>{orders.length}</b></div><div><small>Paid / in progress / complete</small><b>{paid.length}</b></div><div><small>Needs attention</small><b>{needsAttention.length}</b></div><div><small>Captured order value</small><b>{inr(paidTotal)}</b></div></div>
        <div className="ia-ops-table-wrap"><table className="ia-ops-table"><thead><tr><th>Order</th><th>Service</th><th>Amount</th><th>Status</th><th>Payment ref</th><th>Created</th></tr></thead><tbody>
          {orders.map(order => <tr key={order.id}><td><code>{shortId(order.id)}</code></td><td>{order.service_slug}</td><td>{inr(order.customer_price)}</td><td><span className={"ia-ops-status status-" + order.status}>{order.status.replaceAll("_", " ")}</span></td><td>{order.razorpay_payment_id ? order.razorpay_payment_id.slice(0, 12) + "…" : "—"}</td><td>{stamp(order.created_at)}</td></tr>)}
          {!orders.length && <tr><td colSpan={6}>No Instant API orders recorded yet.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="ia-ops-section" id="ia-health"><div className="ia-ops-title"><Activity/><div><h3>API Health</h3><p>Configuration and observed transaction outcomes; no unverified test calls are sent to providers.</p></div></div>
        <div className="ia-ops-stats"><div><small>Configured services</small><b>{services.length}</b></div><div><small>Enabled &amp; authorised</small><b>{services.filter(s => s.is_enabled && s.authorization_verified && !!s.endpoint_url).length}</b></div><div><small>Provider errors / uncertain</small><b>{needsAttention.length}</b></div><div><small>Recorded actual provider cost</small><b>{inr(costTotal)}</b></div></div>
        <div className="ia-ops-table-wrap"><table className="ia-ops-table"><thead><tr><th>Service</th><th>Provider</th><th>Endpoint</th><th>Readiness</th></tr></thead><tbody>
          {services.map(service => <tr key={service.slug}><td>{service.name}</td><td>{service.provider_name || "Not configured"}</td><td>{service.endpoint_url ? new URL(service.endpoint_url).hostname : "Missing"}</td><td><span className={"ia-ops-status " + (service.is_enabled && service.authorization_verified && service.endpoint_url ? "status-succeeded" : "status-payment_pending")}>{service.is_enabled && service.authorization_verified && service.endpoint_url ? "Configured" : "Not ready"}</span></td></tr>)}
          {!services.length && <tr><td colSpan={4}>No service configuration found.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="ia-ops-section" id="ia-reconciliation"><div className="ia-ops-title"><Wallet/><div><h3>Reconciliation</h3><p>Cross-check stored order/payment references and operational statuses. This is a review report, not a bank settlement confirmation.</p></div></div>
        <div className="ia-ops-stats"><div><small>Payment pending</small><b>{counts.payment_pending ?? 0}</b></div><div><small>Paid / processing</small><b>{(counts.paid ?? 0) + (counts.processing ?? 0)}</b></div><div><small>Fulfilled</small><b>{counts.succeeded ?? 0}</b></div><div><small>Refund pending</small><b>{counts.refund_pending ?? 0}</b></div></div>
        <div className="ia-ops-table-wrap"><table className="ia-ops-table"><thead><tr><th>Order</th><th>Order ref</th><th>Payment ref</th><th>Amount</th><th>Paid at</th><th>Fulfilled at</th></tr></thead><tbody>
          {orders.filter(o => o.razorpay_order_id || o.razorpay_payment_id || ["paid","processing","succeeded","refund_pending","refunded"].includes(o.status)).map(o => <tr key={o.id}><td><code>{shortId(o.id)}</code></td><td>{o.razorpay_order_id || "Missing"}</td><td>{o.razorpay_payment_id || "Missing"}</td><td>{inr(o.customer_price)}</td><td>{stamp(o.paid_at)}</td><td>{stamp(o.fulfilled_at)}</td></tr>)}
          {!orders.length && <tr><td colSpan={6}>No payment records available for reconciliation.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="ia-ops-section" id="ia-audit"><div className="ia-ops-title"><FileClock/><div><h3>Audit Logs</h3><p>Recent matching entries from the existing owner audit log.</p></div></div>
        <div className="ia-ops-table-wrap"><table className="ia-ops-table"><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Actor</th></tr></thead><tbody>
          {audit.map(entry => <tr key={entry.id}><td>{stamp(entry.created_at)}</td><td>{entry.action}</td><td>{entry.entity_type}</td><td>{entry.entity_id || "—"}</td><td>{entry.actor_id ? shortId(entry.actor_id) : "System / removed user"}</td></tr>)}
          {!audit.length && <tr><td colSpan={5}>No matching Instant API audit events found. Catalogue changes may be audited under their table trigger but not tagged as Instant API in metadata.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="ia-ops-section" id="ia-refunds"><div className="ia-ops-title"><RotateCcw/><div><h3>Refunds</h3><p>Refund queue and completed refund references. This screen does not issue refunds automatically.</p></div></div>
        <div className="ia-ops-stats"><div><small>Awaiting refund review</small><b>{pendingRefunds.length}</b></div><div><small>Marked refunded</small><b>{completedRefunds.length}</b></div><div><small>Refund pending value</small><b>{inr(pendingRefunds.reduce((sum,o)=>sum+Number(o.customer_price),0))}</b></div></div>
        <div className="ia-ops-table-wrap"><table className="ia-ops-table"><thead><tr><th>Order</th><th>Service</th><th>Amount</th><th>Payment ref</th><th>Status</th><th>Reason code</th></tr></thead><tbody>
          {[...pendingRefunds, ...completedRefunds].map(o => <tr key={o.id}><td><code>{shortId(o.id)}</code></td><td>{o.service_slug}</td><td>{inr(o.customer_price)}</td><td>{o.razorpay_payment_id || "Missing"}</td><td>{o.status.replaceAll("_", " ")}</td><td>{o.provider_error_code || "—"}</td></tr>)}
          {!pendingRefunds.length && !completedRefunds.length && <tr><td colSpan={6}>No refund cases recorded.</td></tr>}
        </tbody></table></div>
        <p className="ia-ops-warning"><AlertTriangle size={15}/> Refund execution remains intentionally separate: verify the captured payment and customer entitlement before issuing a refund through the payment provider. No refund button is exposed until that audited workflow is implemented.</p>
      </section>
    </>}
  </section>;
}
