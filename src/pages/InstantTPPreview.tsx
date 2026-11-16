import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, CheckCircle2, Clock3, Copy, Download, FileCheck2, FileText, LockKeyhole, RefreshCw, ShieldCheck, UploadCloud, WalletCards } from "lucide-react";
import { callFunction, supabase } from "../lib/supabase";
import "./InstantTPPreview.css";

type Application = {
  id?: string; trackingId: string; customerName: string; mobile: string; email?: string;
  vehicleRegistration: string; vehicleMakeModel: string; vehicleType: string;
  quotedAmount: number | null; insurerName: string | null; paymentStatus: "not_submitted" | "under_verification" | "paid";
  utr: string | null; adminNote?: string; policyStatus: "processing" | "issued";
  policyNumber: string | null; policyUrl?: string | null; createdAt?: string;
};
type AdminItem = {
  id: string; tracking_id: string; customer_name: string; mobile: string; email: string | null;
  vehicle_registration: string; vehicle_make_model: string; vehicle_type: string;
  quoted_amount: number | null; insurer_name: string | null; payment_status: Application["paymentStatus"];
  utr: string | null; admin_note: string; policy_status: Application["policyStatus"];
  policy_number: string | null; created_at: string;
};
const UPI_ID = "mohammadzamanbaba@okicici";
const UPI_LINK = "upi://pay?pa=mohammadzamanbaba%40okicici&pn=BABAS%20CYBER%20CAFE&cu=INR";
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

export default function InstantTPPreview() {
  const [view, setView] = useState<"customer" | "admin">("customer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState<Application | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [trackingId, setTrackingId] = useState("");
  const [mobile, setMobile] = useState("");
  const [utr, setUtr] = useState("");
  const [form, setForm] = useState({ customerName: "", mobile: "", email: "", vehicleRegistration: "", vehicleMakeModel: "", vehicleType: "private_car" });
  const [items, setItems] = useState<AdminItem[]>([]);
  const [selected, setSelected] = useState<AdminItem | null>(null);
  const [adminToken, setAdminToken] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [quote, setQuote] = useState({ quotedAmount: "", insurerName: "", adminNote: "" });
  const [policyNumber, setPolicyNumber] = useState("");
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  const paymentLabel = useMemo(() => ({ not_submitted: "Awaiting UTR", under_verification: "Under Verification", paid: "Paid" } as const), []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setAdminToken(data.session?.access_token ?? "");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setAdminToken(session?.access_token ?? ""));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function customerLookup(id = trackingId, phone = mobile) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await callFunction<{ application: Application }>("instant-tp-portal", { action: "customer_lookup", trackingId: id, mobile: phone });
      setApplication(result.application);
      setTrackingId(result.application.trackingId);
      setMobile(phone);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load your application."); }
    finally { setBusy(false); }
  }

  async function createApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await callFunction<{ application: Application }>("instant-tp-portal", { action: "create_application", ...form });
      setCreated(result.application); setApplication(result.application);
      setTrackingId(result.application.trackingId); setMobile(form.mobile);
      setNotice("Your application is saved. Keep your tracking ID and mobile number safe.");
      setForm({ customerName: "", mobile: "", email: "", vehicleRegistration: "", vehicleMakeModel: "", vehicleType: "private_car" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Application could not be saved."); }
    finally { setBusy(false); }
  }

  // Keep the customer's tracking panel in sync after the owner saves the insurer quote.
  // This makes the payable amount and manual UPI instructions appear without requiring
  // the customer to re-enter their tracking ID and mobile number.
  useEffect(() => {
    if (view !== "customer" || !application?.trackingId || !application.mobile) return;
    let active = true;
    const refreshApplication = async () => {
      try {
        const result = await callFunction<{ application: Application }>("instant-tp-portal", {
          action: "customer_lookup",
          trackingId: application.trackingId,
          mobile: application.mobile,
        });
        if (active) setApplication(result.application);
      } catch {
        // A temporary network failure should not interrupt the customer's current view.
      }
    };
    const timer = window.setInterval(() => { void refreshApplication(); }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [view, application?.trackingId, application?.mobile]);

  async function submitUtr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await callFunction<{ application: Application }>("instant-tp-portal", { action: "submit_utr", trackingId, mobile, utr });
      setApplication(result.application); setNotice("UTR received. Payment status is Under Verification until the actual bank credit is confirmed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "UTR could not be submitted."); }
    finally { setBusy(false); }
  }

  async function loadAdmin(search = adminSearch) {
    if (!adminToken) { setError("Please sign in using the owner account first."); return; }
    setBusy(true); setError("");
    try {
      const result = await callFunction<{ items: AdminItem[] }>("instant-tp-portal", { action: "admin_list", search }, adminToken);
      setItems(result.items);
      if (selected) setSelected(result.items.find((item) => item.id === selected.id) ?? null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Admin records could not be loaded."); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (view === "admin" && adminToken) void loadAdmin(""); }, [view, adminToken]);

  function choose(item: AdminItem) {
    setSelected(item);
    setQuote({ quotedAmount: item.quoted_amount ? String(item.quoted_amount) : "", insurerName: item.insurer_name ?? "", adminNote: item.admin_note ?? "" });
    setPolicyNumber(item.policy_number ?? "");
    setPolicyFile(null);
  }

  async function saveQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !adminToken) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await callFunction("instant-tp-portal", { action: "admin_update_quote", id: selected.id, quotedAmount: Number(quote.quotedAmount), insurerName: quote.insurerName, adminNote: quote.adminNote }, adminToken);
      setNotice("Payable amount and insurer saved. Customer can now view the UPI payment instructions.");
      await loadAdmin();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Quote could not be saved."); }
    finally { setBusy(false); }
  }

  async function verifyPayment() {
    if (!selected || !adminToken) return;
    if (!window.confirm("Confirm that you have checked the actual bank/UPI credit for this exact UTR and amount?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await callFunction("instant-tp-portal", { action: "admin_verify_payment", id: selected.id }, adminToken);
      setNotice("Payment marked Paid and recorded in the audit history."); await loadAdmin();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Payment could not be verified."); }
    finally { setBusy(false); }
  }

  async function issuePolicy() {
    if (!selected || !adminToken || !policyFile) return;
    if (policyFile.type !== "application/pdf" || policyFile.size > 8 * 1024 * 1024) { setError("Choose a PDF file under 8 MB."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read the PDF."));
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.readAsDataURL(policyFile);
      });
      await callFunction("instant-tp-portal", { action: "admin_issue_policy", id: selected.id, policyNumber, pdfBase64: base64 }, adminToken);
      setNotice("Policy PDF uploaded privately and marked Issued. Customer can now download it."); setPolicyFile(null); await loadAdmin();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Policy could not be issued."); }
    finally { setBusy(false); }
  }

  return (
    <main className="tp-preview">
      <header className="tp-preview-top">
        <div className="tp-brand"><span className="tp-brand-mark"><ShieldCheck size={22}/></span><span>BABA'S <small>CYBER CAFE · MOTOR INSURANCE</small></span></div>
        <span className="tp-preview-label">CONNECTED FUNCTIONAL PREVIEW</span>
      </header>
      <section className="tp-hero">
        <div><span className="tp-eyebrow">INSTANT THIRD-PARTY MOTOR INSURANCE</span><h1>Payment and policy,<br/><em>clearly tracked.</em></h1><p>Apply, receive a verified quote, pay manually by UPI, submit your UTR and track the policy until the issued PDF is ready.</p></div>
        <div className="tp-hero-seal"><ShieldCheck size={35}/><b>TRUST</b><small>YOUR TRUST, OUR SERVICE</small></div>
      </section>
      <nav className="tp-view-switch" aria-label="Portal views">
        <button className={view === "customer" ? "active" : ""} onClick={() => { setView("customer"); setError(""); }}><WalletCards size={16}/> Customer portal</button>
        <button className={view === "admin" ? "active" : ""} onClick={() => { setView("admin"); setError(""); }}><LockKeyhole size={16}/> Owner admin portal</button>
      </nav>
      {error && <div className="tp-alert tp-alert-error" role="alert">{error}</div>}
      {notice && <div className="tp-alert tp-alert-success" role="status"><CheckCircle2 size={17}/>{notice}</div>}
      {view === "customer" ? (
        <div className="tp-customer-layout">
          <section className="tp-panel">
            <div className="tp-section-head"><div><span className="tp-eyebrow">NEW CUSTOMER APPLICATION</span><h2>Start your insurance request</h2></div><span className="tp-chip tp-chip-blue">No online gateway</span></div>
            {created && <div className="tp-created-ref"><CheckCircle2/><span><b>Application received</b><strong>{created.trackingId}</strong><small>Save this tracking ID. Use it with your registered mobile number below.</small></span></div>}
            <form className="tp-utr-form" onSubmit={createApplication}>
              <label>Full name<input required minLength={2} maxLength={120} value={form.customerName} onChange={e=>setForm({...form,customerName:e.target.value})}/></label>
              <label>Mobile number<input required type="tel" minLength={10} maxLength={18} value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} placeholder="+91…"/></label>
              <label>Email address (optional)<input type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
              <label>Vehicle registration number<input required minLength={4} maxLength={20} value={form.vehicleRegistration} onChange={e=>setForm({...form,vehicleRegistration:e.target.value.toUpperCase()})} placeholder="JK01AB1234"/></label>
              <label>Vehicle make and model<input required minLength={2} maxLength={120} value={form.vehicleMakeModel} onChange={e=>setForm({...form,vehicleMakeModel:e.target.value})} placeholder="Maruti Swift"/></label>
              <label>Vehicle category<select value={form.vehicleType} onChange={e=>setForm({...form,vehicleType:e.target.value})}><option value="private_car">Private car</option><option value="two_wheeler">Two-wheeler</option><option value="commercial_vehicle">Commercial vehicle</option></select></label>
              <button className="tp-primary" disabled={busy}><ArrowRight size={17}/>{busy ? "Submitting…" : "Create application"}</button>
              <p className="tp-micro-note">Do not enter Aadhaar, OTP, UPI PIN or banking passwords here. Your request is stored securely.</p>
            </form>
            <div className="tp-divider"/>
            <div className="tp-section-head"><div><span className="tp-eyebrow">EXISTING APPLICATION</span><h2>Track your request</h2></div><RefreshCw size={18}/></div>
            <form className="tp-utr-form" onSubmit={e=>{e.preventDefault();void customerLookup();}}>
              <label>Tracking ID<input required value={trackingId} onChange={e=>setTrackingId(e.target.value.toUpperCase())} placeholder="BABA-XXXXXXXXXX"/></label>
              <label>Registered mobile number<input required value={mobile} onChange={e=>setMobile(e.target.value)} placeholder="+91…"/></label>
              <button className="tp-secondary" disabled={busy}>{busy ? "Checking…" : "Find my application"}</button>
            </form>
          </section>
          <aside className="tp-panel tp-status-panel">
            <span className="tp-eyebrow">APPLICATION TRACKING</span>
            {application ? <>
              <h2>{application.customerName}</h2>
              <div className="tp-utr-confirm"><span>TRACKING REFERENCE</span><b>{application.trackingId}</b><button type="button" onClick={()=>void navigator.clipboard?.writeText(application!.trackingId)}><Copy size={15}/></button></div>
              <div className="tp-vehicle-card"><div className="tp-vehicle-icon"><ShieldCheck size={24}/></div><div><b>{application.vehicleMakeModel}</b><small>{application.vehicleRegistration} · {application.vehicleType.replaceAll("_"," ")}</small></div></div>
              {application.quotedAmount ? <div className="tp-payable"><small>ADMIN-APPROVED PAYABLE AMOUNT</small><strong>{money(Number(application.quotedAmount))}</strong><span>{application.insurerName ?? "Insurer quote"}</span></div> : <div className="tp-policy-wait"><Clock3/><span><b>Quote pending</b><small>Our insurance desk is confirming the insurer's exact premium. Keep this page open — the amount and UPI payment instructions will appear here automatically once the quote is saved.</small></span></div>}
              {application.quotedAmount && application.paymentStatus !== "paid" && <div className="tp-upi-live-card">
                <div className="tp-upi-live-top"><WalletCards size={22}/><span><b>Pay BABA'S CYBER CAFE</b><small>Manual UPI · Verify amount before paying</small></span></div>
                <div className="tp-upi-id-row"><div><small>BUSINESS UPI ID</small><b>{UPI_ID}</b></div><button type="button" onClick={()=>{void navigator.clipboard?.writeText(UPI_ID);setCopied(true);window.setTimeout(()=>setCopied(false),1800);}}><Copy size={15}/>{copied?"Copied":"Copy"}</button></div>
                <a className="tp-upi-open-app" href={UPI_LINK+"&am="+encodeURIComponent(String(application.quotedAmount))}><WalletCards size={16}/> Pay {money(Number(application.quotedAmount))} in UPI app <ArrowRight size={15}/></a>
                <form className="tp-utr-form" onSubmit={submitUtr}><label>12-digit UTR / transaction reference<input required inputMode="numeric" minLength={12} maxLength={12} pattern="[0-9]{12}" value={utr} onChange={e=>setUtr(e.target.value.replace(/\D/g,"").slice(0,12))} placeholder="Enter UTR after payment"/></label><button className="tp-primary" disabled={busy || utr.length!==12}><CheckCircle2 size={17}/>Submit UTR</button><p className="tp-micro-note">Submitting UTR does not mark payment as Paid. Our owner verifies the actual bank credit manually.</p></form>
              </div>}
              <div className="tp-status-list">
                <div className="tp-status-step done"><span><CheckCircle2 size={16}/></span><div><b>Application received</b><small>{application.trackingId}</small></div><strong>Done</strong></div>
                <div className={application.paymentStatus==="paid"?"tp-status-step done":application.paymentStatus==="under_verification"?"tp-status-step current":"tp-status-step"}><span>{application.paymentStatus==="paid"?<CheckCircle2 size={16}/>:<Clock3 size={16}/>}</span><div><b>Payment status</b><small>{application.utr ? "UTR: "+application.utr : "Awaiting customer payment reference"}</small></div><strong>{paymentLabel[application.paymentStatus]}</strong></div>
                <div className={application.policyStatus==="issued"?"tp-status-step done":"tp-status-step current"}><span>{application.policyStatus==="issued"?<CheckCircle2 size={16}/>:<Clock3 size={16}/>}</span><div><b>Policy document</b><small>{application.policyStatus==="issued"?"Policy PDF is ready":"Processing after payment verification"}</small></div><strong>{application.policyStatus==="issued"?"Issued":"Processing"}</strong></div>
              </div>
              {application.policyStatus==="issued" && application.policyUrl && <a className="tp-primary tp-download" href={application.policyUrl} target="_blank" rel="noreferrer"><Download size={17}/>Download issued policy PDF</a>}
            </> : <div className="tp-status-intro"><h2>Your policy journey</h2><p>Submit a new application or enter your tracking ID and registered mobile number to see your live status.</p><div className="tp-policy-wait"><FileText/><span><b>Secure policy delivery</b><small>Your PDF becomes available only after owner upload and issue confirmation.</small></span></div></div>}
            <div className="tp-help-note">Need help? <b>+91 7006865909</b></div>
          </aside>
        </div>
      ) : (
        <div className="tp-admin-layout">
          <aside className="tp-admin-sidebar">
            <div className="tp-admin-title"><span className="tp-admin-avatar">BC</span><div><b>Insurance desk</b><small>Verified owner workspace</small></div></div>
            <div className="tp-admin-stat-grid"><div><small>APPLICATIONS</small><b>{items.length}</b></div><div><small>UTR TO VERIFY</small><b>{items.filter(x=>x.payment_status==="under_verification").length}</b></div><div><small>POLICIES PROCESSING</small><b>{items.filter(x=>x.policy_status!=="issued").length}</b></div></div>
            {!adminToken ? <div className="tp-admin-side-note"><LockKeyhole/><span>Owner sign-in is required. <Link to="/admin/login">Open secure login <ArrowRight size={13}/></Link></span></div> : <button className="tp-secondary" onClick={()=>void loadAdmin()} disabled={busy}><RefreshCw size={15}/> Refresh applications</button>}
          </aside>
          <section className="tp-admin-main">
            <div className="tp-admin-heading"><div><span className="tp-eyebrow">APPLICATION MANAGEMENT</span><h2>Third-party insurance requests</h2><p>Set the payable quote, verify actual bank credit, then issue the policy PDF.</p></div><span className="tp-chip tp-chip-green">Live records</span></div>
            <div className="tp-admin-toolbar"><input value={adminSearch} onChange={e=>setAdminSearch(e.target.value)} placeholder="Search customer, tracking ID or vehicle"/><button className="tp-secondary" onClick={()=>void loadAdmin(adminSearch)} disabled={busy}>Search</button></div>
            <div className="tp-admin-records">{items.map(item=><button key={item.id} className={selected?.id===item.id?"tp-admin-record selected":"tp-admin-record"} onClick={()=>choose(item)}><span><b>{item.customer_name}</b><small>{item.tracking_id} · {item.vehicle_registration}</small></span><span className="tp-record-status">{item.payment_status.replaceAll("_"," ")}</span></button>)}{!items.length&&<p className="tp-micro-note">{adminToken?"No applications yet. Customer submissions will appear here.":"Sign in as owner to load applications."}</p>}</div>
            {selected && <div className="tp-admin-workflow">
              <div className="tp-admin-request"><div><span className="tp-eyebrow">{selected.tracking_id}</span><h3>{selected.customer_name}</h3><p>{selected.mobile} · {selected.vehicle_registration} · {selected.vehicle_make_model}</p></div><span className="tp-chip tp-chip-blue">{selected.payment_status.replaceAll("_"," ")}</span></div>
              <form className="tp-admin-card" onSubmit={saveQuote}><h3>1 · Set payable amount and insurer</h3><label>Insurer<input required maxLength={120} value={quote.insurerName} onChange={e=>setQuote({...quote,insurerName:e.target.value})} placeholder="Insurer name"/></label><label>Exact payable amount (₹)<input required type="number" min="1" max="1000000" step="0.01" value={quote.quotedAmount} onChange={e=>setQuote({...quote,quotedAmount:e.target.value})} placeholder="Enter confirmed quote"/></label><label>Internal note<textarea rows={2} maxLength={1000} value={quote.adminNote} onChange={e=>setQuote({...quote,adminNote:e.target.value})}/></label><button className="tp-primary" disabled={busy}>Save quote for customer</button></form>
              <article className="tp-admin-card"><h3>2 · Verify UPI payment</h3><p>Customer UTR: <b>{selected.utr??"Not submitted"}</b></p><p>Payment state: <b>{selected.payment_status.replaceAll("_"," ")}</b></p><button className="tp-primary" disabled={busy||selected.payment_status!=="under_verification"} onClick={()=>void verifyPayment()}><BadgeCheck size={17}/>Confirm bank credit and mark Paid</button><small className="tp-warning">Only click after checking the actual UPI/bank statement. UTR alone is not proof of credit.</small></article>
              <article className="tp-admin-card"><h3>3 · Upload issued policy PDF</h3><label>Insurer policy number<input required value={policyNumber} onChange={e=>setPolicyNumber(e.target.value)} placeholder="Policy number"/></label><label className="tp-upload-policy"><UploadCloud size={18}/><span>{policyFile?.name??"Choose actual policy PDF (max 8 MB)"}</span><input type="file" accept="application/pdf,.pdf" onChange={e=>setPolicyFile(e.target.files?.[0]??null)}/></label><button className="tp-primary" disabled={busy||selected.payment_status!=="paid"||!policyFile||!policyNumber.trim()} onClick={()=>void issuePolicy()}><FileCheck2 size={17}/>Upload and mark policy Issued</button>{selected.payment_status!=="paid"&&<small className="tp-warning">Payment must be marked Paid first.</small>}</article>
            </div>}
          </section>
        </div>
      )}
      <footer className="tp-preview-footer">BABA'S CYBER CAFE <span>·</span> Your Trust, Our Service <span>·</span> Connected preview — no payment gateway</footer>
    </main>
  );
}
