import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ClipboardList, FileClock, RefreshCw, RotateCcw, Wallet, Search, X, Download } from "lucide-react";
import { supabase } from "../lib/supabase";

type Order = {
  id: string;
  service_slug: string;
  customer_price: number;
  status: string;
  provider_cost_at_order: number | null;
  provider_cost_actual: number | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  paid_at: string | null;
  provider_error_code: string | null;
  created_at: string;
  fulfilled_at: string | null;
};
type Service = {
  slug: string;
  name: string;
  is_enabled: boolean;
  authorization_verified: boolean;
  endpoint_url: string | null;
  provider_name: string | null;
};
type Audit = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const inr = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
const stamp = (value: string | null) => value ? new Date(value).toLocaleString("en-IN") : "—";
const shortId = (value: string) => value.slice(0, 8).toUpperCase();
const capturedStatuses = new Set(["paid", "processing", "succeeded", "fulfillment_unknown", "refund_pending", "refunded"]);

export default function InstantApiOperations() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [auditQuery, setAuditQuery] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const [orderResult, serviceResult, auditResult] = await Promise.all([
        supabase.from("instant_api_orders")
          .select("id,service_slug,customer_price,status,provider_cost_at_order,provider_cost_actual,razorpay_order_id,razorpay_payment_id,paid_at,provider_error_code,created_at,fulfilled_at")
          .order("created_at", { ascending: false }).limit(500),
        supabase.from("instant_api_services")
          .select("slug,name,is_enabled,authorization_verified,endpoint_url,provider_name")
          .order("sort_order"),
        supabase.from("admin_audit_logs")
          .select("id,actor_id,action,entity_type,entity_id,metadata,created_at")
          .or("entity_type.eq.instant_api_orders,entity_type.eq.instant_api_services,entity_type.eq.instant_api_order,entity_type.eq.instant_api_service,entity_type.eq.instant_api")
          .order("created_at", { ascending: false }).limit(200),
      ]);
      const failures: string[] = [];
      if (orderResult.error) {
        failures.push("Orders: " + orderResult.error.message);
        setOrders([]);
      } else {
        setOrders((orderResult.data ?? []) as Order[]);
      }
      if (serviceResult.error) {
        failures.push("Services: " + serviceResult.error.message);
        setServices([]);
      } else {
        setServices((serviceResult.data ?? []) as Service[]);
      }
      if (auditResult.error) {
        failures.push("Audit logs: " + auditResult.error.message);
        setAudit([]);
      } else {
        setAudit((auditResult.data ?? []) as Audit[]);
      }
      setError(failures.join(" · "));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Instant API operations. Check owner access and the Supabase connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const counts = useMemo(() => orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {}), [orders]);

  const filteredOrders = useMemo(() => {
    const term = query.trim().toLowerCase();
    return orders.filter(order => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesText = !term || [order.id, order.service_slug, order.razorpay_order_id ?? "", order.razorpay_payment_id ?? "", order.provider_error_code ?? ""].join(" ").toLowerCase().includes(term);
      return matchesStatus && matchesText;
    });
  }, [orders, query, statusFilter]);

  const capturedOrders = orders.filter(order => capturedStatuses.has(order.status) && (Boolean(order.razorpay_payment_id) || Boolean(order.paid_at)));
  const capturedTotal = capturedOrders.reduce((sum, order) => sum + Number(order.customer_price || 0), 0);
  const knownProviderCost = capturedOrders.reduce((sum, order) => sum + Number(order.provider_cost_actual ?? order.provider_cost_at_order ?? 0), 0);
  const knownCostCount = capturedOrders.filter(order => order.provider_cost_actual !== null || order.provider_cost_at_order !== null).length;
  const attentionOrders = orders.filter(order => ["failed", "fulfillment_unknown", "refund_pending"].includes(order.status));
  const pendingRefunds = orders.filter(order => order.status === "refund_pending");
  const completedRefunds = orders.filter(order => order.status === "refunded");
  const missingPaymentRefs = orders.filter(order => capturedStatuses.has(order.status) && !order.razorpay_payment_id);
  const filteredAudit = audit.filter(entry => !auditQuery.trim() || [entry.action, entry.entity_type, entry.entity_id ?? "", entry.actor_id ?? ""].join(" ").toLowerCase().includes(auditQuery.trim().toLowerCase()));

  const serviceHealth = services.map(service => {
    const serviceOrders = orders.filter(order => order.service_slug === service.slug);
    const completed = serviceOrders.filter(order => order.status === "succeeded").length;
    const failed = serviceOrders.filter(order => ["failed", "fulfillment_unknown", "refund_pending"].includes(order.status)).length;
    const latest = serviceOrders[0];
    const ready = service.is_enabled && service.authorization_verified && Boolean(service.endpoint_url);
    return { service, total: serviceOrders.length, completed, failed, latest, ready };
  });

  function downloadReconciliation() {
    const rows = [
      ["order_id", "service", "status", "customer_amount_inr", "provider_cost_at_order_inr", "provider_cost_actual_inr", "razorpay_order_id", "razorpay_payment_id", "paid_at", "created_at"],
      ...orders.map(order => [order.id, order.service_slug, order.status, String(order.customer_price), order.provider_cost_at_order == null ? "" : String(order.provider_cost_at_order), order.provider_cost_actual == null ? "" : String(order.provider_cost_actual), order.razorpay_order_id ?? "", order.razorpay_payment_id ?? "", order.paid_at ?? "", order.created_at]),
    ];
    const csv = rows.map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(",")).join("\\r\\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "instant-api-reconciliation.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <section className="ia-operations" aria-label="Instant API operational modules">
    <style>{`
      /* Keep the light Operations Centre independent from the dark owner shell. */
      .ia-operations {
        isolation: isolate;
        color-scheme: light;
        color: #0f172a !important;
      }
      .ia-operations .ia-ops-section {
        color: #0f172a !important;
        background: #ffffff !important;
      }
      .ia-operations .ia-ops-table {
        width: 100%;
        color: #0f172a !important;
        background: #ffffff !important;
        border-collapse: separate;
        border-spacing: 0;
      }
      .ia-operations .ia-ops-table thead th {
        color: #334155 !important;
        background: #f1f5f9 !important;
        border-bottom: 1px solid #cbd5e1 !important;
        font-weight: 700;
      }
      .ia-operations .ia-ops-table tbody td {
        color: #0f172a !important;
        background: #ffffff !important;
        border-bottom: 1px solid #e2e8f0 !important;
        opacity: 1 !important;
      }
      .ia-operations .ia-ops-table tbody tr:nth-child(even) td {
        background: #f8fafc !important;
      }
      .ia-operations .ia-ops-table tbody tr:hover td {
        background: #eff6ff !important;
      }
      .ia-operations .ia-ops-table td small {
        color: #475569 !important;
        opacity: 1 !important;
      }
      .ia-operations .ia-ops-table td code {
        color: #1e293b !important;
        background: #f1f5f9 !important;
      }
      .ia-operations .ia-ops-search {
        color: #475569 !important;
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
      }
      .ia-operations .ia-ops-search input,
      .ia-operations .ia-ops-search input:focus {
        color: #0f172a !important;
        background: #ffffff !important;
        caret-color: #0f172a;
        -webkit-text-fill-color: #0f172a !important;
        opacity: 1 !important;
      }
      .ia-operations .ia-ops-search input::placeholder {
        color: #64748b !important;
        -webkit-text-fill-color: #64748b !important;
        opacity: 1 !important;
      }
      .ia-operations .ia-ops-filter-label select {
        color: #0f172a !important;
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
      }
      .ia-operations .ia-ops-status {
        opacity: 1 !important;
        filter: none !important;
      }
      .ia-operations .ia-ops-table-wrap {
        max-width: 100%;
        overflow-x: auto;
        overscroll-behavior-inline: contain;
        -webkit-overflow-scrolling: touch;
        background: #ffffff !important;
      }
      @media (max-width: 760px) {
        .ia-operations .ia-ops-table {
          min-width: 760px;
        }
        .ia-operations .ia-ops-table th,
        .ia-operations .ia-ops-table td {
          white-space: nowrap;
        }
      }
    `}</style>
    <div className="ia-ops-head">
      <div><span className="ia-eyebrow">LIVE OPERATIONS · OWNER ONLY</span><h2>API Operations Centre</h2><p>Order and financial references only. Customer input fields and encrypted request/result payloads are never loaded into this screen.</p></div>
      <button className="ia-button ia-button-muted" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15}/>{loading ? "Refreshing…" : "Refresh all"}</button>
    </div>
    {error && <div className="ia-alert ia-error" role="alert"><AlertTriangle size={16}/>{error}</div>}
    {loading && <p className="ia-ops-muted" role="status">Loading operational records…</p>}
    {!loading && <>
      <div className="ia-ops-summary">
        <div><small>Orders loaded</small><b>{orders.length}</b></div>
        <div><small>Captured order value</small><b>{inr(capturedTotal)}</b></div>
        <div><small>Needs attention</small><b>{attentionOrders.length}</b></div>
        <div><small>Services enabled &amp; authorised</small><b>{services.filter(s => s.is_enabled && s.authorization_verified).length} / {services.length}</b></div>
      </div>

      <section className="ia-ops-section" id="ia-orders">
        <div className="ia-ops-title"><ClipboardList/><div><h3>Orders</h3><p>Latest {orders.length} records · search by order, service or payment reference</p></div></div>
        <div className="ia-ops-filters">
          <label className="ia-ops-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search order ID, service or payment reference" aria-label="Search Instant API orders"/></label>
          <label className="ia-ops-filter-label"><span>Status</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses ({orders.length})</option>{Object.entries(counts).sort(([a],[b]) => a.localeCompare(b)).map(([status,count]) => <option key={status} value={status}>{status.replaceAll("_"," ")} ({count})</option>)}</select></label>
        </div>
        <div className="ia-ops-table-wrap"><table className="ia-ops-table"><thead><tr><th>Order</th><th>Service</th><th>Amount</th><th>Provider cost</th><th>Status</th><th>Payment ref</th><th>Created</th><th>Details</th></tr></thead><tbody>
          {filteredOrders.map(order => <tr key={order.id}><td><code>{shortId(order.id)}</code></td><td>{order.service_slug}</td><td>{inr(order.customer_price)}</td><td>{inr(order.provider_cost_actual ?? order.provider_cost_at_order)} <small>{order.provider_cost_actual !== null ? "Actual" : order.provider_cost_at_order !== null ? "Quoted" : "—"}</small></td><td><span className={"ia-ops-status status-" + order.status}>{order.status.replaceAll("_", " ")}</span></td><td>{order.razorpay_payment_id ? order.razorpay_payment_id.slice(0, 13) + "…" : "—"}</td><td>{stamp(order.created_at)}</td><td><button className="ia-ops-link" onClick={() => setSelectedOrder(order)}>View</button></td></tr>)}
          {!filteredOrders.length && <tr><td colSpan={8}>No orders match this search and status filter.</td></tr>}
        </tbody></table></div>
        <p className="ia-ops-muted ia-ops-footnote">Showing up to 500 most recent orders. Sensitive customer inputs and decrypted results are deliberately excluded.</p>
      </section>

      <section className="ia-ops-section" id="ia-health">
        <div className="ia-ops-title"><Activity/><div><h3>API Health &amp; Service Readiness</h3><p>Configuration and real transaction outcomes. No paid or potentially billable provider test calls are sent automatically.</p></div></div>
        <div className="ia-ops-stats"><div><small>Configured services</small><b>{services.length}</b></div><div><small>Enabled &amp; authorised</small><b>{serviceHealth.filter(s => s.ready).length}</b></div><div><small>Orders needing attention</small><b>{attentionOrders.length}</b></div><div><small>Known provider cost</small><b>{inr(knownProviderCost)}</b></div></div>
        <div className="ia-ops-table-wrap"><table className="ia-ops-table"><thead><tr><th>Service</th><th>Provider</th><th>Configuration</th><th>Requests</th><th>Success</th><th>Attention</th><th>Last request</th><th>Last outcome</th></tr></thead><tbody>
          {serviceHealth.map(({service,total,completed,failed,latest,ready}) => <tr key={service.slug}><td>{service.name}</td><td>{service.provider_name || "Not configured"}</td><td><span className={"ia-ops-status " + (ready ? "status-succeeded" : "status-payment_pending")}>{ready ? "Configured" : "Not ready"}</span></td><td>{total}</td><td>{completed}</td><td>{failed}</td><td>{latest ? stamp(latest.created_at) : "No requests"}</td><td>{latest ? latest.provider_error_code || latest.status.replaceAll("_", " ") : "—"}</td></tr>)}
          {!services.length && <tr><td colSpan={8}>No service configuration found.</td></tr>}
        </tbody></table></div>
        <p className="ia-ops-warning"><Activity size={15}/> This panel reports configuration and observed order outcomes, not a live provider ping. A configured service is not proof that the provider is currently reachable.</p>
      </section>

      <section className="ia-ops-section" id="ia-reconciliation">
        <div className="ia-ops-title"><Wallet/><div><h3>Reconciliation</h3><p>Compare stored order, captured-payment and provider-cost references. This is not a bank settlement confirmation.</p></div></div>
        <div className="ia-ops-stats"><div><small>Captured payment records</small><b>{capturedOrders.length}</b></div><div><small>Captured customer value</small><b>{inr(capturedTotal)}</b></div><div><small>Orders with known provider cost</small><b>{knownCostCount}</b></div><div><small>Missing payment references</small><b>{missingPaymentRefs.length}</b></div></div>
        <div className="ia-ops-reconcile-actions"><button className="ia-button ia-button-muted" onClick={downloadReconciliation}><Download size={15}/> Export CSV</button><span>Export contains order/payment references and amounts only; no customer request data.</span></div>
        <div className="ia-ops-table-wrap"><table className="ia-ops-table"><thead><tr><th>Order</th><th>Order ref</th><th>Payment ref</th><th>Amount</th><th>Provider cost (actual / quoted)</th><th>Paid at</th><th>Fulfilled at</th><th>Check</th></tr></thead><tbody>
          {orders.filter(order => order.razorpay_order_id || order.razorpay_payment_id || capturedStatuses.has(order.status)).map(order => {
            const issue = capturedStatuses.has(order.status) && !order.razorpay_payment_id;
            return <tr key={order.id}><td><code>{shortId(order.id)}</code></td><td>{order.razorpay_order_id || "Missing"}</td><td>{order.razorpay_payment_id || "Missing"}</td><td>{inr(order.customer_price)}</td><td>{inr(order.provider_cost_actual ?? order.provider_cost_at_order)} <small>{order.provider_cost_actual !== null ? "Actual" : order.provider_cost_at_order !== null ? "Quoted" : "—"}</small></td><td>{stamp(order.paid_at)}</td><td>{stamp(order.fulfilled_at)}</td><td><span className={"ia-ops-status " + (issue ? "status-refund_pending" : "status-succeeded")}>{issue ? "Review" : "Recorded"}</span></td></tr>;
          })}
          {!orders.length && <tr><td colSpan={8}>No payment records available for reconciliation.</td></tr>}
        </tbody></table></div>
        <p className="ia-ops-warning"><AlertTriangle size={15}/> Settlement matching against the Razorpay dashboard or bank statement is still a manual verification step; this database does not contain a verified settlement feed.</p>
      </section>

      <section className="ia-ops-section" id="ia-audit">
        <div className="ia-ops-title"><FileClock/><div><h3>Audit Logs</h3><p>Recent matching entries from the existing owner audit log.</p></div></div>
        <label className="ia-ops-search"><Search size={16}/><input value={auditQuery} onChange={event => setAuditQuery(event.target.value)} placeholder="Filter action, entity or actor" aria-label="Filter Instant API audit logs"/></label>
        <div className="ia-ops-table-wrap"><table className="ia-ops-table"><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Actor</th></tr></thead><tbody>
          {filteredAudit.map(entry => <tr key={entry.id}><td>{stamp(entry.created_at)}</td><td>{entry.action}</td><td>{entry.entity_type}</td><td>{entry.entity_id || "—"}</td><td>{entry.actor_id ? shortId(entry.actor_id) : "System / removed user"}</td></tr>)}
          {!filteredAudit.length && <tr><td colSpan={5}>No matching Instant API audit events found.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="ia-ops-section" id="ia-refunds">
        <div className="ia-ops-title"><RotateCcw/><div><h3>Refunds</h3><p>Track refund cases recorded by the payment/provider workflow.</p></div></div>
        <div className="ia-ops-stats"><div><small>Awaiting refund resolution</small><b>{pendingRefunds.length}</b></div><div><small>Recorded as refunded</small><b>{completedRefunds.length}</b></div><div><small>Pending refund value</small><b>{inr(pendingRefunds.reduce((sum,order)=>sum+Number(order.customer_price),0))}</b></div></div>
        <div className="ia-ops-table-wrap"><table className="ia-ops-table"><thead><tr><th>Order</th><th>Service</th><th>Amount</th><th>Payment ref</th><th>Status</th><th>Reason code</th><th>Review</th></tr></thead><tbody>
          {[...pendingRefunds, ...completedRefunds].map(order => <tr key={order.id}><td><code>{shortId(order.id)}</code></td><td>{order.service_slug}</td><td>{inr(order.customer_price)}</td><td>{order.razorpay_payment_id || "Missing"}</td><td>{order.status.replaceAll("_", " ")}</td><td>{order.provider_error_code || "—"}</td><td><button className="ia-ops-link" onClick={() => setSelectedOrder(order)}>View order</button></td></tr>)}
          {!pendingRefunds.length && !completedRefunds.length && <tr><td colSpan={7}>No refund cases recorded.</td></tr>}
        </tbody></table></div>
        <p className="ia-ops-warning"><AlertTriangle size={15}/> Provider-rejection refunds are initiated automatically by the existing gateway. This portal does not issue a second refund or change payment status manually. Verify the final refund in Razorpay before treating a pending case as settled.</p>
      </section>
    </>}

    {selectedOrder && <div className="ia-ops-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedOrder(null); }}>
      <section className="ia-ops-modal" role="dialog" aria-modal="true" aria-labelledby="ia-order-detail-title">
        <header><div><span className="ia-eyebrow">SAFE ORDER DETAILS</span><h3 id="ia-order-detail-title">Order {shortId(selectedOrder.id)}</h3></div><button type="button" aria-label="Close order details" onClick={() => setSelectedOrder(null)}><X size={18}/></button></header>
        <dl>
          <div><dt>Order ID</dt><dd>{selectedOrder.id}</dd></div>
          <div><dt>Service</dt><dd>{selectedOrder.service_slug}</dd></div>
          <div><dt>Status</dt><dd>{selectedOrder.status.replaceAll("_"," ")}</dd></div>
          <div><dt>Customer amount</dt><dd>{inr(selectedOrder.customer_price)}</dd></div>
          <div><dt>Provider cost at order</dt><dd>{inr(selectedOrder.provider_cost_at_order)}</dd></div>
          <div><dt>Provider cost actual</dt><dd>{inr(selectedOrder.provider_cost_actual)}</dd></div>
          <div><dt>Razorpay order reference</dt><dd>{selectedOrder.razorpay_order_id || "Not recorded"}</dd></div>
          <div><dt>Razorpay payment reference</dt><dd>{selectedOrder.razorpay_payment_id || "Not recorded"}</dd></div>
          <div><dt>Provider error code</dt><dd>{selectedOrder.provider_error_code || "None recorded"}</dd></div>
          <div><dt>Created</dt><dd>{stamp(selectedOrder.created_at)}</dd></div>
          <div><dt>Paid</dt><dd>{stamp(selectedOrder.paid_at)}</dd></div>
          <div><dt>Fulfilled</dt><dd>{stamp(selectedOrder.fulfilled_at)}</dd></div>
        </dl>
        <p>Personal input fields, lawful-purpose text, retrieval tokens and encrypted request/result payloads are not accessible from this detail view.</p>
        <button className="ia-button ia-button-muted" onClick={() => setSelectedOrder(null)}>Close</button>
      </section>
    </div>}
  </section>;
}
