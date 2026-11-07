import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { callFunction, supabase } from "../lib/supabase";
import "../payment.css";

declare global {
  interface Window {
    QRCode?: new (element: HTMLElement, options: { text: string; width: number; height: number; colorDark: string; colorLight: string; correctLevel: number }) => { clear: () => void };
  }
}

type Payment = {
  id?: string;
  amount: number | string;
  currency?: string;
  status: "pending" | "claimed" | "paid" | "needs_review";
  claimed_utr?: string | null;
  utr?: string | null;
  paid_at?: string | null;
  expires_at?: string | null;
};
type PaymentRecord = {
  application: { id: string; tracking_id: string; full_name: string; mobile: string; service_name: string; status: string; created_at: string };
  payment: Payment;
};
type Alert = { id: string; sender: string; message: string; bank_timestamp: string; received_at: string; parsed_amount: number | null; parsed_utr: string | null; parsed_tracking_id: string | null; matched_payment_id: string | null; status: string; processing_note: string | null };
type Audit = { id: string; payment_id: string; action: string; metadata: Record<string, unknown>; created_at: string };
type AdminApplication = PaymentRecord["application"] & { payment: Payment | null };

const money = (value: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const payeeVpa = "mohammadzamanbaba@okicici";
const payeeName = "BABA CYBER CAFE";

function makeUpiUri(amount: number, trackingId: string, paymentId: string) {
  const params = new URLSearchParams({ pa: payeeVpa, pn: payeeName, am: amount.toFixed(2), cu: "INR", tr: paymentId.replace(/-/g, "").slice(0, 32), tn: trackingId });
  return `upi://pay?${params.toString()}`;
}

function useQrCode(value: string, enabled: boolean) {
  const [ready, setReady] = useState(() => typeof window !== "undefined" && Boolean(window.QRCode));
  useEffect(() => {
    if (window.QRCode) return;
    const existing = document.querySelector<HTMLScriptElement>('script[data-upi-qr]');
    if (existing) {
      existing.addEventListener("load", () => setReady(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    script.async = true;
    script.dataset.upiQr = "true";
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);
  useEffect(() => {
    const target = document.getElementById("upi-payment-qr");
    if (!target || !enabled || !value || !ready || !window.QRCode) return;
    target.replaceChildren();
    new window.QRCode(target, { text: value, width: 230, height: 230, colorDark: "#171713", colorLight: "#ffffff", correctLevel: 2 });
  }, [value, enabled, ready]);
  return ready;
}

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
  const initialTrackingId = typeof paymentEntry?.trackingId === "string" ? paymentEntry.trackingId : "";
  const initialMobile = typeof paymentEntry?.mobile === "string" ? paymentEntry.mobile : "";
  const [trackingId, setTrackingId] = useState(initialTrackingId);
  const [mobile, setMobile] = useState(initialMobile);
  const [record, setRecord] = useState<PaymentRecord | null>(null);
  const [utr, setUtr] = useState("");
  const [loading, setLoading] = useState(Boolean(initialTrackingId && initialMobile));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(0);
  const expiresAt = record?.payment.expires_at ? new Date(record.payment.expires_at).getTime() : 0;
  const remainingMs = expiresAt - clock;
  const qrExpired = Boolean(expiresAt && remainingMs <= 0);
  const uri = useMemo(() => record && Number(record.payment.amount) > 0 && record.payment.id ? makeUpiUri(Number(record.payment.amount), record.application.tracking_id, record.payment.id) : "", [record]);
  useQrCode(uri, Boolean(uri && record?.payment.status === "pending" && !qrExpired));
  useEffect(() => {
    if (!record?.payment.expires_at || record.payment.status !== "pending") return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [record?.payment.expires_at, record?.payment.status]);

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
    void callFunction<PaymentRecord>("payment-customer", {
      action: "lookup",
      trackingId: initialTrackingId,
      mobile: initialMobile,
    }).then((result) => {
      if (active) setRecord(result);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "We could not load the payment details.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [initialTrackingId, initialMobile]);

  const find = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError(""); setMessage(""); setRecord(null);
    try { await refresh("lookup"); } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not find that application."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!record || record.payment.status === "paid") return;
    const timer = window.setInterval(() => {
      void callFunction<PaymentRecord>("payment-customer", {
        action: "status", trackingId: record.application.tracking_id, mobile: record.application.mobile,
      }).then((next) => {
        if (next.payment.status === "paid" && record.payment.status !== "paid") playSuccessTone();
        setRecord(next);
      }).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [record]);

  const submitConfirmation = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      const result = await callFunction<{ submitted: boolean; message: string }>("payment-customer", {
        action: "submit_confirmation", trackingId: record?.application.tracking_id, mobile: record?.application.mobile, utr,
      });
      setMessage(result.message); setUtr(""); await refresh("status");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Confirmation could not be submitted."); }
    finally { setLoading(false); }
  };

  return (
    <main className="payment-page">
      <div className="payment-shell">
        <div className="payment-heading"><span className="eyebrow">BABA'S CYBER CAFE · SECURE PAYMENT</span><h1>Application payment</h1><p>Find your application to view the exact amount assigned by our team.</p><Link to="/track">← Back to combined tracking &amp; payment</Link></div>
        <section className="payment-panel">
          <form className="payment-lookup" onSubmit={find}>
            <label>Tracking ID<input value={trackingId} onChange={e => setTrackingId(e.target.value.toUpperCase())} placeholder="BABA-XXXXXXXXXX" pattern="BABA-[A-Z0-9]{10}" required maxLength={15}/></label>
            <label>Registered mobile number<input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="10-digit mobile number" inputMode="tel" required maxLength={16}/></label>
            <button className="button button-dark" disabled={loading}>{loading ? "Checking…" : "Find application"}</button>
          </form>
          {error && <p className="payment-alert payment-alert-error" role="alert">{error}</p>}
          {message && <p className="payment-alert payment-alert-info" role="status">{message}</p>}
        </section>

        {record && (
          <section className="payment-result">
            <div className="payment-customer-card">
              <div><span className="eyebrow">APPLICATION DETAILS</span><h2>{record.application.full_name}</h2><p>{record.application.service_name}</p></div>
              <div className="payment-detail-grid"><div><small>Tracking ID</small><b>{record.application.tracking_id}</b></div><div><small>Registered mobile</small><b>{record.application.mobile}</b></div><div><small>Application status</small><b>{record.application.status}</b></div><div><small>Payment status</small><PaymentStatus status={record.payment.status}/></div></div>
            </div>

            {record.payment.status === "paid" ? (
              <div className="payment-success">
                <div className="payment-success-icon">✓</div><span className="eyebrow">PAYMENT VERIFIED</span><h2>Payment received</h2><strong>{money(record.payment.amount)}</strong>
                <div className="payment-detail-grid"><div><small>UPI reference / UTR</small><b>{record.payment.utr}</b></div><div><small>Verified at</small><b>{dateTime(record.payment.paid_at)}</b></div></div>
                <button className="button button-dark" onClick={() => window.print()}>Download / print receipt</button>
              </div>
            ) : Number(record.payment.amount) <= 0 ? (
              <div className="payment-empty"><h2>Amount not assigned yet</h2><p>Payment amount has not been assigned by admin yet. Please check back shortly.</p></div>
            ) : (
              <div className="payment-method">
                <div className="payment-amount"><small>AMOUNT DUE</small><strong>{money(record.payment.amount)}</strong><span>Pay only the exact amount shown.</span></div>
                {record.payment.status === "claimed" || record.payment.status === "needs_review" ? (
                  <div className="payment-awaiting"><h2>Confirmation received</h2><p>Your UPI reference {record.payment.claimed_utr ? <b>{record.payment.claimed_utr}</b> : ""} is awaiting verification. This page checks for updates automatically.</p></div>
                ) : qrExpired ? (
                  <div className="payment-awaiting"><h2>QR code expired</h2><p>This QR was valid for five minutes. Contact BABA'S CYBER CAFE to renew it before paying. If you already paid, do not pay again; contact us with your UTR.</p></div>
                ) : (
                    <div className="payment-pay-grid">
                      <div className="payment-qr-card"><div id="upi-payment-qr" aria-label="Dynamic UPI payment QR code"/><small>Scan with GPay, PhonePe or Paytm</small><b className="payment-countdown">QR expires in {String(Math.floor(remainingMs / 60000)).padStart(2,"0")}:{String(Math.floor((remainingMs % 60000) / 1000)).padStart(2,"0")}</b></div>
                      <div className="payment-instructions"><h2>Pay using any UPI app</h2><p>Scan the QR code or open your UPI app using the button below.</p><a className="button button-gold payment-deep-link" href={uri}>Click to pay via UPI app ↗</a><p className="payment-warning">Do not change the payment remark / note. It contains your tracking ID and helps us reconcile your payment.</p><div className="payment-payee"><small>PAY TO</small><b>{payeeName}</b><span>{payeeVpa}</span></div></div>
                    </div>
                )}
                {record.payment.status === "pending" && (
                  <form className="payment-utr-form" onSubmit={submitConfirmation}>
                    <label>Enter 12-digit UPI reference / UTR number<input value={utr} onChange={e => setUtr(e.target.value.replace(/\D/g, "").slice(0,12))} inputMode="numeric" pattern="[0-9]{12}" minLength={12} maxLength={12} placeholder="12-digit UTR" required/></label>
                    <button className="button button-dark" disabled={loading || utr.length !== 12}>{loading ? "Submitting…" : "Submit confirmation"}</button>
                    <small>Submitting a reference does not itself confirm payment. Your payment status changes to Paid only after verification.</small>
                  </form>
                )}
                <p className="payment-poll-note">Payment status refreshes automatically every 3 seconds while this page is open.</p>
              </div>
            )}
          </section>
        )}
        <p className="payment-footnote">Never share your UPI PIN, bank password or OTP with anyone. BABA'S CYBER CAFE will never ask you to disclose these details.</p>
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
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [matchTargets, setMatchTargets] = useState<Record<string,string>>({});
  const [categories, setCategories] = useState<{slug: string; name: string}[]>([]);
  const [amounts, setAmounts] = useState<Record<string,string>>({});
  const [reasons, setReasons] = useState<Record<string,string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<"applications"|"alerts"|"audit">("applications");
  const [create, setCreate] = useState({fullName:"", mobile:"", serviceName:"", categorySlug:"", amount:""});
  const [manualUtr, setManualUtr] = useState<Record<string,string>>({});
  const [manualReason, setManualReason] = useState<Record<string,string>>({});
  const [manualStatementVerified, setManualStatementVerified] = useState<Record<string,boolean>>({});
  const [alertStatementVerified, setAlertStatementVerified] = useState<Record<string,boolean>>({});
  const visibleApps = selectedApplicationId
    ? apps.filter((app) => app.id === selectedApplicationId)
    : apps;

  const api = useCallback(async <T,>(body: object) => callFunction<T>("admin-payments", body, token), [token]);
  const load = useCallback(async () => {
    const result = await api<{applications:AdminApplication[];alerts:Alert[];audit:Audit[]}>({action:"list"});
    setApps(result.applications); setAlerts(result.alerts); setAudit(result.audit);
    setAmounts(Object.fromEntries(result.applications.map(item=>[item.id,String(item.payment?.amount ?? 0)])));
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
    void api<{applications:AdminApplication[];alerts:Alert[];audit:Audit[]}>({action:"list"}).then(result=>{setApps(result.applications);setAlerts(result.alerts);setAudit(result.audit);setAmounts(Object.fromEntries(result.applications.map(item=>[item.id,String(item.payment?.amount ?? 0)])));setReady(true);}).catch(reason=>{setError(reason instanceof Error?reason.message:"Owner access could not be verified.");setReady(true);});
    if (supabase) void supabase.from("service_categories").select("slug,name").eq("is_active",true).order("sort_order").then(({data})=>setCategories(data??[]));
  }, [token, api]);

  const run = async (key:string, body:object) => {
    setBusy(key); setError(""); setNotice("");
    try { await api(body); await load(); setNotice("Payment records updated."); }
    catch(reason) { setError(reason instanceof Error?reason.message:"The action could not be completed."); }
    finally { setBusy(""); }
  };
  const createApplication = async (event:FormEvent) => {
    event.preventDefault(); setBusy("create"); setError(""); setNotice("");
    try { const result=await api<{trackingId:string}>({action:"create_application",fullName:create.fullName,mobile:create.mobile,serviceName:create.serviceName,categorySlug:create.categorySlug,amount:Number(create.amount||0)}); setCreate({fullName:"",mobile:"",serviceName:"",categorySlug:"",amount:""}); await load(); setNotice(`Application created: ${result.trackingId}`); }
    catch(reason) { setError(reason instanceof Error?reason.message:"Application could not be created."); }
    finally { setBusy(""); }
  };

  if (!ready) return <main className="payment-page"><div className="payment-shell"><p>Verifying owner access…</p></div></main>;
  return (
    <main className="payment-page payment-admin-page"><div className="payment-shell payment-admin-shell">
      <div className="payment-heading"><span className="eyebrow">OWNER CONTROL CENTRE</span><h1>UPI payments</h1><p>Assign payment amounts, reconcile bank alerts and review customer confirmations.</p>{selectedApplicationId && <p>Showing the selected application only.</p>}<Link to="/admin">← Back to main admin</Link></div>
      {error && <p className="payment-alert payment-alert-error">{error}</p>}{notice && <p className="payment-alert payment-alert-info">{notice}</p>}
      <form className="payment-create-form" onSubmit={createApplication}><h2>New payment application</h2><div className="payment-admin-fields"><label>Customer name<input required minLength={2} maxLength={120} value={create.fullName} onChange={e=>setCreate({...create,fullName:e.target.value})}/></label><label>Mobile<input required value={create.mobile} onChange={e=>setCreate({...create,mobile:e.target.value})}/></label><label>Service type<input required list="payment-service-list" value={create.serviceName} onChange={e=>setCreate({...create,serviceName:e.target.value})}/><datalist id="payment-service-list">{categories.map(c=><option key={c.slug} value={c.name}/>)}</datalist></label><label>Category<select required value={create.categorySlug} onChange={e=>setCreate({...create,categorySlug:e.target.value})}><option value="">Select category</option>{categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label><label>Amount (₹)<input type="number" min="0" max="10000000" step="0.01" value={create.amount} onChange={e=>setCreate({...create,amount:e.target.value})}/></label></div><button className="button button-dark" disabled={busy==="create"}>{busy==="create"?"Creating…":"Create application"}</button></form>
      <div className="payment-admin-tabs"><button className={tab==="applications"?"is-active":""} onClick={()=>setTab("applications")} type="button">Applications ({apps.length})</button><button className={tab==="alerts"?"is-active":""} onClick={()=>setTab("alerts")} type="button">Bank alerts ({alerts.length})</button><button className={tab==="audit"?"is-active":""} onClick={()=>setTab("audit")} type="button">Audit log ({audit.length})</button><button className="payment-refresh" type="button" onClick={()=>void load()}>Refresh</button></div>
      {tab==="applications" ? <div className="payment-admin-list">{visibleApps.map(app=><article className="payment-admin-card" key={app.id}><div className="payment-admin-card-head"><div><b>{app.full_name}</b><span>{app.tracking_id} · {app.service_name}</span><small>{app.mobile} · {dateTime(app.created_at)}</small></div><PaymentStatus status={app.payment?.status??"pending"}/></div><div className="payment-admin-controls"><label>Assigned amount (₹)<input type="number" min="0" max="10000000" step="0.01" value={amounts[app.id]??"0"} onChange={e=>setAmounts({...amounts,[app.id]:e.target.value})}/></label><button className="button button-outline" disabled={!!busy} onClick={()=>void run(app.id,{action:"set_amount",applicationId:app.id,amount:Number(amounts[app.id]||0)})}>Save amount / renew 5-min QR</button></div>{app.payment?.status==="pending" && Number(app.payment.amount)>0 && <button className="text-button" disabled={!!busy} onClick={()=>void run(app.id,{action:"renew_qr",applicationId:app.id})}>Renew 5-minute QR</button>}{app.payment?.status==="paid" ? <><p className="payment-admin-meta">Verified UTR: <b>{app.payment.utr}</b> · {dateTime(app.payment.paid_at)}</p><button className="text-button" disabled={!!busy} onClick={()=>{const reason=window.prompt("Why are you reopening this payment?");if(reason && reason.trim().length>=10) void run(app.id,{action:"manual_mark_pending",applicationId:app.id,reason});}}>Reopen / mark pending</button></> : <div className="payment-admin-controls"><label>Manual UTR<input inputMode="numeric" maxLength={12} value={(manualUtr[app.id]??app.payment?.claimed_utr??"").replace(/\D/g,"").slice(0,12)} onChange={e=>setManualUtr({...manualUtr,[app.id]:e.target.value.replace(/\D/g,"").slice(0,12)})} placeholder="12-digit UTR"/></label><label>Verification note<input value={manualReason[app.id]??""} onChange={e=>setManualReason({...manualReason,[app.id]:e.target.value})} placeholder="Describe the bank-statement match (min. 10 characters)"/></label><label className="payment-verify-checkbox"><input type="checkbox" checked={manualStatementVerified[app.id]===true} onChange={e=>setManualStatementVerified({...manualStatementVerified,[app.id]:e.target.checked})}/><span>I personally verified the matching credit in the ICICI account or bank statement. An SMS or customer UTR alone is not proof.</span></label><ul className="payment-verification-checklist"><li className={(manualUtr[app.id]??app.payment?.claimed_utr??"").replace(/\D/g,"").length===12?"is-ready":""}>12-digit UTR {(manualUtr[app.id]??app.payment?.claimed_utr??"").replace(/\D/g,"").length===12?"✓":"—"}</li><li className={(manualReason[app.id]??"").trim().length>=10?"is-ready":""}>Verification note: {(manualReason[app.id]??"").trim().length}/10 characters</li><li className={manualStatementVerified[app.id]===true?"is-ready":""}>Bank statement personally checked {manualStatementVerified[app.id]===true?"✓":"—"}</li><li className={Number(app.payment?.amount??0)>0?"is-ready":""}>Payment amount assigned: {money(app.payment?.amount??0)}</li></ul><button className="button button-dark" disabled={!!busy || Number(app.payment?.amount??0)<=0 || (manualUtr[app.id]??app.payment?.claimed_utr??"").replace(/\D/g,"").length!==12 || (manualReason[app.id]??"").trim().length<10 || manualStatementVerified[app.id]!==true} onClick={()=>void run(app.id,{action:"manual_mark_paid",applicationId:app.id,utr:(manualUtr[app.id]??app.payment?.claimed_utr??"").replace(/\D/g,"").slice(0,12),reason:manualReason[app.id],bankStatementVerified:true})}>Mark paid</button></div>}{app.payment?.claimed_utr && <p className="payment-admin-meta">Customer submitted: {app.payment.claimed_utr} (not verified)</p>}</article>)}{visibleApps.length===0 && <p className="payment-empty">No payment application was found. Return to the admin dashboard and open the payment action from its application row.</p>}</div> : tab==="alerts" ? <div className="payment-alert-list">{alerts.map(alert=><article className="payment-alert-card" key={alert.id}><div className="payment-admin-card-head"><div><b>{alert.sender}</b><small>{dateTime(alert.received_at)} · {alert.parsed_tracking_id??"No tracking ID detected"}</small></div><PaymentStatus status={alert.status==="matched"?"paid":"needs_review"}/></div><p>{alert.message}</p><div className="payment-admin-meta">Amount: {alert.parsed_amount?money(alert.parsed_amount):"Not parsed"} · UTR: {alert.parsed_utr??"Not parsed"}</div>{alert.status!=="matched" && alert.parsed_utr && alert.parsed_amount ? <div className="payment-admin-controls"><label>Match to application<select value={matchTargets[alert.id]??apps.find(app=>app.payment?.id===alert.matched_payment_id)?.id??""} onChange={e=>setMatchTargets({...matchTargets,[alert.id]:e.target.value})}><option value="">Select matching application</option>{apps.filter(app=>Number(app.payment?.amount??0)===Number(alert.parsed_amount) && app.payment?.status!=="paid").map(app=><option key={app.id} value={app.id}>{app.tracking_id} · {app.full_name} · {money(app.payment?.amount??0)}</option>)}</select></label><label>Review note<input value={reasons[alert.id]??""} onChange={e=>setReasons({...reasons,[alert.id]:e.target.value})} placeholder="Describe the bank-statement match"/></label><label className="payment-verify-checkbox"><input type="checkbox" checked={alertStatementVerified[alert.id]===true} onChange={e=>setAlertStatementVerified({...alertStatementVerified,[alert.id]:e.target.checked})}/><span>I verified this exact credit in the ICICI account or bank statement; the SMS alert alone is not proof.</span></label><button className="button button-dark" disabled={!!busy || !(matchTargets[alert.id]??apps.find(app=>app.payment?.id===alert.matched_payment_id)?.id) || (reasons[alert.id]??"").trim().length<10 || alertStatementVerified[alert.id]!==true} onClick={()=>void run(alert.id,{action:"manual_match",alertId:alert.id,applicationId:matchTargets[alert.id]??apps.find(app=>app.payment?.id===alert.matched_payment_id)?.id,reason:reasons[alert.id],bankStatementVerified:true})}>Match payment</button></div>:null}<small>{alert.processing_note}</small></article>)}</div> : <div className="payment-alert-list">{audit.map(event=><article className="payment-alert-card" key={event.id}><b>{event.action.replaceAll("_"," ")}</b><small>{dateTime(event.created_at)} · Payment record {event.payment_id}</small><pre>{JSON.stringify(event.metadata,null,2)}</pre></article>)}</div>}
      <p className="payment-footnote">Customer-entered UTRs are claims, not proof. Confirm against the bank account before using manual mark-paid. All owner actions are audited.</p>
    </div></main>
  );
}

export default function PaymentPortal({ admin = false }: { admin?: boolean }) {
  return admin ? <AdminPayments/> : <CustomerPayment/>;
}
