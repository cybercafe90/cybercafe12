import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { callFunction, supabase } from "../lib/supabase";
import "../payment.css";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const razorpayCheckoutEnabled = import.meta.env.VITE_RAZORPAY_CHECKOUT_ENABLED === "true";
const isPaymentPreview = typeof window !== "undefined" && window.location.hostname.endsWith(".pages.dev");

function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Razorpay checkout could not be loaded.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded."));
    document.head.appendChild(script);
  });
}

type Payment = {
  id?: string;
  amount: number | string;
  currency?: string;
  status: "pending" | "claimed" | "paid" | "needs_review";
  razorpay_payment_id?: string | null;
  payment_provider?: string | null;
  paid_at?: string | null;
  expires_at?: string | null;
};
type PaymentRecord = {
  application: { id: string; tracking_id: string; full_name: string; mobile: string; email?: string; service_name: string; status: string; created_at: string };
  payment: Payment;
};
type Audit = { id: string; payment_id: string; action: string; metadata: Record<string, unknown>; created_at: string };
type AdminApplication = PaymentRecord["application"] & { payment: Payment | null };

const money = (value: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
function PaymentStatus({ status }: { status: string }) {
  const label = status === "paid" ? "Paid" : status === "claimed" ? "Confirmation submitted" : status === "needs_review" ? "Needs review" : "Pending";
  return <span className={`payment-status payment-status-${status}`}>{label}</span>;
}

function playSuccessTone() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.36);
    oscillator.onended = () => void context.close();
  } catch { /* Sound is optional. */ }
}

function CustomerPayment() {
  const location = useLocation();
  const paymentEntry = location.state as { trackingId?: unknown; mobile?: unknown } | null;
  const initialTrackingId = typeof paymentEntry?.trackingId === "string" ? paymentEntry.trackingId : new URLSearchParams(window.location.search).get("trackingId") ?? "";
  const initialMobile = typeof paymentEntry?.mobile === "string" ? paymentEntry.mobile : "";
  const [trackingId, setTrackingId] = useState(initialTrackingId);
  const [mobile, setMobile] = useState(initialMobile);
  const [record, setRecord] = useState<PaymentRecord | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialTrackingId && initialMobile));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const refresh = useCallback(async (action: "lookup" | "status" = "lookup") => {
    if (!record && action === "status") return;
    const result = await callFunction<PaymentRecord>("payment-customer", {
      action,
      trackingId: action === "status" ? record?.application.tracking_id : trackingId,
      mobile: action === "status" ? record?.application.mobile : mobile,
    });
    setRecord(result);
    return result;
  }, [record, trackingId, mobile]);

  useEffect(() => {
    if (!initialTrackingId || !initialMobile) return;
    let active = true;
    void callFunction<PaymentRecord>("payment-customer", { action: "lookup", trackingId: initialTrackingId, mobile: initialMobile })
      .then((result) => { if (active) setRecord(result); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "We could not load the payment details."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialTrackingId, initialMobile]);

  const openDemoPayment = () => {
    setDemoMode(true); setError(""); setMessage("DESIGN PREVIEW ONLY — this sample cannot accept or create a payment.");
    setTrackingId("BABA-DEMO202611"); setMobile("7000000000");
    setRecord({
      application: { id: "demo-application", tracking_id: "BABA-DEMO202611", full_name: "Demo Customer", mobile: "7000000000", email: "demo@example.com", service_name: "Document Assistance Service", status: "under_review", created_at: new Date().toISOString() },
      payment: { id: "demo-payment", amount: 1250, currency: "INR", status: "pending", expires_at: null },
    });
  };

  const find = async (event: FormEvent) => {
    event.preventDefault(); setDemoMode(false); setLoading(true); setError(""); setMessage(""); setRecord(null);
    try { await refresh("lookup"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "We could not find that application."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!record || record.payment.status === "paid" || demoMode) return;
    const timer = window.setInterval(() => {
      void callFunction<PaymentRecord>("payment-customer", {
        action: "status", trackingId: record.application.tracking_id, mobile: record.application.mobile,
      }).then((next) => {
        if (next.payment.status === "paid" && record.payment.status !== "paid") playSuccessTone();
        setRecord(next);
      }).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [record, demoMode]);

  const startRazorpayCheckout = async () => {
    if (!record || !razorpayCheckoutEnabled || demoMode || checkoutBusy) return;
    setCheckoutBusy(true); setError(""); setMessage("");
    try {
      await loadRazorpayCheckout();
      const order = await callFunction<{ orderId: string; amount: number; currency: string; keyId: string }>("razorpay-checkout", {
        action: "create_order", trackingId: record.application.tracking_id, mobile: record.application.mobile,
      });
      if (!window.Razorpay) throw new Error("Razorpay checkout is not ready.");
      const checkout = new window.Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
        name: "BABA'S CYBER CAFE", description: record.application.service_name,
        prefill: { name: record.application.full_name, contact: record.application.mobile },
        notes: { tracking_id: record.application.tracking_id }, theme: { color: "#c9a45c" },
        handler: async (result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          setLoading(true);
          try {
            const verified = await callFunction<{ paid: boolean; message: string }>("razorpay-checkout", {
              action: "verify_payment", trackingId: record.application.tracking_id, mobile: record.application.mobile,
              razorpayOrderId: result.razorpay_order_id, razorpayPaymentId: result.razorpay_payment_id, razorpaySignature: result.razorpay_signature,
            });
            setMessage(verified.message || "Razorpay has received the payment. Confirmation is being checked.");
            await refresh("status");
          } catch (reason) {
            setMessage("Razorpay has returned your payment response. Automatic confirmation is in progress; please do not pay again.");
            setError(reason instanceof Error ? reason.message : "Payment confirmation is still processing.");
          } finally { setLoading(false); setCheckoutBusy(false); }
        },
        modal: { ondismiss: () => setCheckoutBusy(false) },
      });
      checkout.open();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Razorpay checkout could not be started.");
      setCheckoutBusy(false);
    }
  };

  return (
    <main className="payment-page">
      <div className="payment-shell">
        <div className="payment-heading"><span className="eyebrow">BABA'S CYBER CAFE · RAZORPAY SECURE PAYMENTS</span><h1>Application payment</h1><p>Find your application and pay the assigned amount securely through Razorpay.</p><Link to="/track">← Back to application tracking</Link></div>
        <section className="payment-panel">
          <form className="payment-lookup" onSubmit={find}>
            <label>Tracking ID<input value={trackingId} onChange={e => setTrackingId(e.target.value.toUpperCase())} placeholder="BABA-XXXXXXXXXX" pattern="BABA-[A-Z0-9]{10}" required maxLength={15}/></label>
            <label>Registered mobile number<input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="10-digit mobile number" inputMode="tel" required maxLength={16}/></label>
            <button className="button button-dark" disabled={loading}>{loading ? "Checking…" : "Find application"}</button>
          </form>
          {isPaymentPreview && <div className="payment-preview-demo"><span className="eyebrow">INTERACTIVE DESIGN PREVIEW</span><p>View a sample Razorpay-only payment screen. No real customer or payment data is used.</p><button className="button button-gold" type="button" onClick={openDemoPayment}>View sample customer payment</button><small>Razorpay checkout is disabled in this design preview.</small></div>}
          {error && <p className="payment-alert payment-alert-error" role="alert">{error}</p>}
          {message && <p className="payment-alert payment-alert-info" role="status">{message}</p>}
        </section>
        {record && (
          <section className="payment-result">
            <div className="payment-customer-card">
              <div><span className="eyebrow">APPLICATION DETAILS</span><h2>{record.application.full_name}</h2><p>{record.application.service_name}</p></div>
              <div className="payment-detail-grid">
                <div><small>Tracking ID</small><b>{record.application.tracking_id}</b></div>
                <div><small>Registered mobile</small><b>{record.application.mobile}</b></div>
                <div><small>Application status</small><b>{record.application.status}</b></div>
                <div><small>Payment status</small><PaymentStatus status={record.payment.status}/></div>
              </div>
            </div>
            {record.payment.status === "paid" ? (
              <div className="payment-success">
                <div className="payment-success-icon">✓</div><span className="eyebrow">{record.payment.payment_provider === "razorpay" ? "RAZORPAY PAYMENT VERIFIED" : "PAYMENT STATUS RECORDED"}</span><h2>{record.payment.payment_provider === "razorpay" ? "Payment received" : "Payment already marked as paid"}</h2><strong>{money(record.payment.amount)}</strong>
                <div className="payment-detail-grid"><div><small>{record.payment.payment_provider === "razorpay" ? "Razorpay payment ID" : "Payment reference"}</small><b>{record.payment.razorpay_payment_id || "Not available for this earlier payment"}</b></div><div><small>Paid at</small><b>{dateTime(record.payment.paid_at)}</b></div></div>
                <button className="button button-dark" onClick={() => window.print()}>Download / print receipt</button>
              </div>
            ) : Number(record.payment.amount) <= 0 ? (
              <div className="payment-empty"><h2>Amount not assigned yet</h2><p>Our team will email you when your application fee is assigned.</p></div>
            ) : (
              <div className="payment-method">
                <div className="payment-amount"><small>AMOUNT DUE</small><strong>{money(record.payment.amount)}</strong><span>Pay the exact amount securely through Razorpay.</span></div>
                {record.payment.status === "pending" ? (
                  <div className="payment-razorpay-panel">
                    <h2>Pay securely with Razorpay</h2>
                    <p>Use the available payment methods shown in Razorpay checkout, such as UPI, cards or netbanking, depending on eligibility.</p>
                    {demoMode ? <><button className="button button-gold" type="button" disabled>Razorpay checkout · sample only</button><small>Preview mode: no payment is initiated.</small></> :
                      razorpayCheckoutEnabled ? <><button className="button button-gold" type="button" onClick={() => void startRazorpayCheckout()} disabled={checkoutBusy || loading}>{checkoutBusy ? "Opening Razorpay…" : `Pay ${money(record.payment.amount)} with Razorpay`}</button><small>Payment confirmation is automatic. Do not pay again if the status is still updating.</small></> :
                      <><button className="button button-gold" type="button" disabled>Razorpay checkout is being configured</button><small>Online checkout will appear here once the secure Razorpay service is enabled.</small></>}
                  </div>
                ) : (
                  <div className="payment-awaiting"><h2>Payment is being reconciled</h2><p>Razorpay confirmation is pending. This page checks for updates automatically. Please do not make another payment.</p></div>
                )}
                {demoMode && <div className="payment-preview-methods"><span>Razorpay Checkout</span><span>Automatic payment verification</span><span>Digital payment receipt</span></div>}
                <p className="payment-poll-note">Payment status refreshes automatically while this page is open.</p>
              </div>
            )}
          </section>
        )}
        <p className="payment-footnote">All payments are processed by Razorpay. BABA'S CYBER CAFE will never ask for your UPI PIN, bank password or OTP.</p>
      </div>
    </main>
  );
}

function AdminPayments() {
  const [searchParams] = useSearchParams();
  const selectedApplicationId = searchParams.get("application");
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [apps, setApps] = useState<AdminApplication[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [categories, setCategories] = useState<{slug: string; name: string}[]>([]);
  const [amounts, setAmounts] = useState<Record<string,string>>({});
  const [customerEmails, setCustomerEmails] = useState<Record<string,string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<"applications"|"audit">("applications");
  const [create, setCreate] = useState({fullName:"", mobile:"", email:"", serviceName:"", categorySlug:"", amount:""});
  const visibleApps = selectedApplicationId ? apps.filter((app) => app.id === selectedApplicationId) : apps;

  const api = useCallback(async <T,>(body: object) => callFunction<T>("admin-payments", body, token), [token]);
  const load = useCallback(async () => {
    const result = await api<{applications:AdminApplication[];audit:Audit[]}>({action:"list"});
    setApps(result.applications); setAudit(result.audit);
    setAmounts(Object.fromEntries(result.applications.map(item=>[item.id,String(item.payment?.amount ?? 0)])));
    setCustomerEmails(Object.fromEntries(result.applications.map(item=>[item.id,item.email ?? ""])));
  }, [api]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!supabase) { setError("Secure services are not configured."); setReady(true); return; }
      const {data} = await supabase.auth.getSession();
      const currentToken = data.session?.access_token ?? "";
      if (!currentToken) { window.location.replace("/admin/login"); return; }
      if (alive) setToken(currentToken);
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!token) return;
    void api<{applications:AdminApplication[];audit:Audit[]}>({action:"list"}).then(result=>{
      setApps(result.applications); setAudit(result.audit);
      setAmounts(Object.fromEntries(result.applications.map(item=>[item.id,String(item.payment?.amount ?? 0)])));
      setCustomerEmails(Object.fromEntries(result.applications.map(item=>[item.id,item.email ?? ""])));
      setReady(true);
    }).catch(reason=>{setError(reason instanceof Error?reason.message:"Owner access could not be verified.");setReady(true);});
    if (supabase) void supabase.from("service_categories").select("slug,name").eq("is_active",true).order("sort_order").then(({data})=>setCategories(data??[]));
  }, [token, api]);

  const run = async (key:string, body:object) => {
    if (isPaymentPreview) { setNotice("Preview mode: payment changes are disabled. No live records will be modified."); return; }
    setBusy(key); setError(""); setNotice("");
    try { const result = await api<{notification?:string}>(body); await load(); setNotice(result.notification ?? "Payment records updated."); }
    catch(reason) { setError(reason instanceof Error?reason.message:"The action could not be completed."); }
    finally { setBusy(""); }
  };
  const createApplication = async (event:FormEvent) => {
    event.preventDefault();
    if (isPaymentPreview) { setNotice("Preview mode: new payment applications cannot be created here."); return; }
    setBusy("create"); setError(""); setNotice("");
    try {
      const result=await api<{trackingId:string;notification?:string}>({action:"create_application",fullName:create.fullName,mobile:create.mobile,email:create.email,serviceName:create.serviceName,categorySlug:create.categorySlug,amount:Number(create.amount||0)});
      setCreate({fullName:"",mobile:"",email:"",serviceName:"",categorySlug:"",amount:""});
      await load(); setNotice(`Application created: ${result.trackingId}. ${result.notification??""}`);
    } catch(reason) { setError(reason instanceof Error?reason.message:"Application could not be created."); }
    finally { setBusy(""); }
  };

  if (!ready) return <main className="payment-page"><div className="payment-shell"><p>Verifying owner access…</p></div></main>;
  return (
    <main className="payment-page payment-admin-page"><div className="payment-shell payment-admin-shell">
      <div className="payment-heading"><span className="eyebrow">OWNER CONTROL CENTRE · RAZORPAY AUTOMATION</span><h1>Payment management</h1><p>Assign application fees, email secure payment links and monitor automatic Razorpay confirmations.</p>{selectedApplicationId && <p>Showing the selected application only.</p>}{isPaymentPreview && <p className="payment-alert payment-alert-info">Safe preview: existing records are read-only. Creating applications, changing amounts and sending emails are disabled.</p>}<Link to="/admin">← Back to main admin</Link></div>
      {error && <p className="payment-alert payment-alert-error">{error}</p>}{notice && <p className="payment-alert payment-alert-info">{notice}</p>}
      <form className="payment-create-form" onSubmit={createApplication}>
        <h2>New payment application</h2>
        <div className="payment-admin-fields">
          <label>Customer name<input required minLength={2} maxLength={120} value={create.fullName} onChange={e=>setCreate({...create,fullName:e.target.value})}/></label>
          <label>Mobile<input required value={create.mobile} onChange={e=>setCreate({...create,mobile:e.target.value})}/></label>
          <label>Customer email<input type="email" required value={create.email} onChange={e=>setCreate({...create,email:e.target.value})} placeholder="customer@example.com"/></label>
          <label>Service type<input required list="payment-service-list" value={create.serviceName} onChange={e=>setCreate({...create,serviceName:e.target.value})}/><datalist id="payment-service-list">{categories.map(c=><option key={c.slug} value={c.name}/>)}</datalist></label>
          <label>Category<select required value={create.categorySlug} onChange={e=>setCreate({...create,categorySlug:e.target.value})}><option value="">Select category</option>{categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
          <label>Amount (₹)<input type="number" min="0" max="10000000" step="0.01" value={create.amount} onChange={e=>setCreate({...create,amount:e.target.value})}/></label>
        </div>
        <button className="button button-dark" disabled={busy==="create"}>{busy==="create"?"Creating…":"Create application & send payment email"}</button>
      </form>
      <div className="payment-admin-tabs"><button className={tab==="applications"?"is-active":""} onClick={()=>setTab("applications")} type="button">Applications ({apps.length})</button><button className={tab==="audit"?"is-active":""} onClick={()=>setTab("audit")} type="button">Payment activity ({audit.length})</button><button className="payment-refresh" type="button" onClick={()=>void load()}>Refresh</button></div>
      {tab==="applications" ? (
        <div className="payment-admin-list">
          {visibleApps.map(app=>(
            <article className="payment-admin-card" key={app.id}>
              <div className="payment-admin-card-head"><div><b>{app.full_name}</b><span>{app.tracking_id} · {app.service_name}</span><small>{app.mobile} · {app.email || "No email saved"} · {dateTime(app.created_at)}</small></div><PaymentStatus status={app.payment?.status??"pending"}/></div>
              <div className="payment-admin-controls">
                <label>Customer email<input type="email" required value={customerEmails[app.id]??""} onChange={e=>setCustomerEmails({...customerEmails,[app.id]:e.target.value})} placeholder="customer@example.com"/></label>
                <label>Assigned amount (₹)<input type="number" min="0" max="10000000" step="0.01" value={amounts[app.id]??"0"} onChange={e=>setAmounts({...amounts,[app.id]:e.target.value})}/></label>
                <button className="button button-outline" disabled={!!busy || !/^[^ @]+@[^ @]+[.][^ @]+$/.test(customerEmails[app.id]??"")} onClick={()=>void run(app.id,{action:"set_amount",applicationId:app.id,amount:Number(amounts[app.id]||0),email:customerEmails[app.id]})}>Save fee &amp; email Razorpay payment link</button>
              </div>
              {app.payment?.status==="paid" ? <p className="payment-admin-meta">Razorpay payment ID: <b>{app.payment.razorpay_payment_id || "Verified"}</b> · Paid at {dateTime(app.payment.paid_at)}</p> :
                <p className="payment-admin-meta">{Number(app.payment?.amount??0)>0 ? "Awaiting automatic Razorpay payment confirmation." : "Assign an amount to start the payment process."}</p>}
            </article>
          ))}
          {visibleApps.length===0 && <p className="payment-empty">No payment application was found. Return to the admin dashboard and open the payment action from its application row.</p>}
        </div>
      ) : (
        <div className="payment-alert-list">{audit.map(event=><article className="payment-alert-card" key={event.id}><b>{event.action.replaceAll("_"," ")}</b><small>{dateTime(event.created_at)} · Payment record {event.payment_id}</small><pre>{JSON.stringify(event.metadata,null,2)}</pre></article>)}</div>
      )}
      <p className="payment-footnote">Payment status is updated from verified Razorpay checkout responses and Razorpay webhook events. Manual UTR and bank-alert reconciliation are not part of this portal.</p>
    </div></main>
  );
}

export default function PaymentPortal({ admin = false }: { admin?: boolean }) {
  return admin ? <AdminPayments/> : <CustomerPayment/>;
}
