import { useMemo, useState, type FormEvent } from "react";
import {
  BadgeCheck, Check, CheckCircle2, Clock3, Copy, FileCheck2,
  FileText, LockKeyhole, ShieldCheck, UploadCloud, WalletCards, ArrowRight,
} from "lucide-react";
import "./InstantTPPreview.css";

type PaymentState = "not_submitted" | "under_verification" | "paid";
type PolicyState = "processing" | "issued";

export default function InstantTPPreview() {
  const [view, setView] = useState<"customer" | "admin">("customer");
  const [utr, setUtr] = useState("612345678901");
  const [upiCopied, setUpiCopied] = useState(false);
  const [submittedUtr, setSubmittedUtr] = useState("");
  const [paymentState, setPaymentState] = useState<PaymentState>("not_submitted");
  const [policyState, setPolicyState] = useState<PolicyState>("processing");
  const [proofName, setProofName] = useState("upi-payment-screenshot.jpg");
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [policyNumber, setPolicyNumber] = useState("TP/J&K/2026/001258");
  const [adminNote, setAdminNote] = useState("UTR received. Verify the credit in the bank account before marking paid.");

  const paymentLabel = useMemo(() => ({
    not_submitted: "Awaiting UTR",
    under_verification: "Under Verification",
    paid: "Paid",
  }[paymentState]), [paymentState]);

  function submitUtr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\\d{12}$/.test(utr.trim())) return;
    setSubmittedUtr(utr.trim());
    setPaymentState("under_verification");
    setPolicyState("processing");
  }

  function uploadPolicy() {
    if (!policyFile || paymentState !== "paid") return;
    setPolicyState("issued");
    setAdminNote("Policy document uploaded. Customer can now download the issued policy.");
  }

  return (
    <main className="tp-preview">
      <div className="tp-preview-top">
        <div className="tp-brand"><span className="tp-brand-mark"><ShieldCheck size={22}/></span><span>BABA'S <small>CYBER CAFE · MOTOR INSURANCE</small></span></div>
        <span className="tp-preview-label">DESIGN PREVIEW · DEMO DATA</span>
      </div>

      <section className="tp-hero">
        <div>
          <span className="tp-eyebrow">INSTANT THIRD-PARTY MOTOR INSURANCE</span>
          <h1>Payment and policy,<br/><em>clearly tracked.</em></h1>
          <p>Manual UPI payment with UTR submission, owner verification and policy delivery in one place.</p>
        </div>
        <div className="tp-hero-seal"><ShieldCheck size={35}/><b>TRUST</b><small>YOUR TRUST, OUR SERVICE</small></div>
      </section>

      <div className="tp-view-switch" role="tablist" aria-label="Preview mode">
        <button className={view === "customer" ? "active" : ""} onClick={() => setView("customer")} role="tab" aria-selected={view === "customer"}> <WalletCards size={16}/> Customer view</button>
        <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")} role="tab" aria-selected={view === "admin"}><LockKeyhole size={16}/> Admin portal preview</button>
      </div>

      {view === "customer" ? (
        <div className="tp-customer-layout">
          <section className="tp-panel tp-payment-panel">
            <div className="tp-section-head"><div><span className="tp-eyebrow">APPLICATION · TP-2026-00125</span><h2>Submit your payment reference</h2></div><span className="tp-chip tp-chip-gold">Third-party · 1 year</span></div>
            <div className="tp-vehicle-card">
              <div className="tp-vehicle-icon"><ShieldCheck size={24}/></div>
              <div><b>Private car · Petrol</b><small>Vehicle: JK01AB1234 · Maruti Swift</small></div>
              <span className="tp-demo-tag">SAMPLE</span>
            </div>
            <div className="tp-payment-instructions">
              <b>Pay using the business UPI details</b>
              <p>Scan the QR code or use the UPI ID displayed by BABA'S CYBER CAFE. After completing payment, enter the 12-digit UTR below.</p>
              <div className="tp-upi-live-card">  <div className="tp-upi-live-top"><span className="tp-upi-mark"><WalletCards size={22}/></span><span><b>Pay BABA'S CYBER CAFE</b><small>Manual UPI payment · Verify before proceeding</small></span><span className="tp-secure"><LockKeyhole size={13}/> UPI</span></div>  <div className="tp-upi-id-row"><div><small>BUSINESS UPI ID</small><b>mohammadzamanbaba@okicici</b></div><button type="button" onClick={() => { void navigator.clipboard?.writeText("mohammadzamanbaba@okicici"); setUpiCopied(true); window.setTimeout(() => setUpiCopied(false), 2200); }} aria-label="Copy business UPI ID"><Copy size={15}/>{upiCopied ? "Copied" : "Copy"}</button></div>  <a className="tp-upi-open-app" href="upi://pay?pa=mohammadzamanbaba%40okicici&pn=BABAS%20CYBER%20CAFE&cu=INR"><WalletCards size={16}/> Open UPI app <ArrowRight size={15}/></a>  <small className="tp-upi-disclaimer">Enter the exact amount shown on your application in your UPI app. Do not treat this screen as proof of payment.</small></div>
            </div>
            <form className="tp-utr-form" onSubmit={submitUtr}>
              <label htmlFor="tp-utr">12-digit UTR / transaction reference</label>
              <input id="tp-utr" inputMode="numeric" autoComplete="off" maxLength={12} minLength={12} pattern="[0-9]{12}" value={utr} onChange={e => setUtr(e.target.value.replace(/\\D/g, "").slice(0,12))} placeholder="Enter 12-digit UTR" required/>
              <label className="tp-upload-label">Payment screenshot <small>Optional · JPG, PNG or PDF</small><input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setProofName(e.target.files?.[0]?.name ?? "")}/></label>
              {proofName && <div className="tp-file-row"><FileText size={16}/><span>{proofName}</span><BadgeCheck size={16}/></div>}
              <button className="tp-primary" type="submit" disabled={utr.length !== 12}><CheckCircle2 size={17}/> Submit UTR and continue</button>
              <p className="tp-micro-note">Submitting a UTR confirms only that your payment details were submitted. Our team must verify the actual bank credit before marking payment as Paid.</p>
            </form>
          </section>

          <aside className="tp-panel tp-status-panel">
            {paymentState === "under_verification" ? (
              <div className="tp-success-animation">
                <div className="tp-success-orbit"><span className="tp-success-check"><Check size={34}/></span></div>
                <span className="tp-eyebrow">SUBMISSION SUCCESSFUL</span>
                <h2>Payment details<br/><em>received!</em></h2>
                <p>Your UTR has been submitted. We are now checking your payment.</p>
              </div>
            ) : (
              <div className="tp-status-intro"><span className="tp-eyebrow">LIVE APPLICATION STATUS</span><h2>Your policy journey</h2><p>After you submit your UTR, your confirmation and tracking details will appear here.</p></div>
            )}
            {submittedUtr && <div className="tp-utr-confirm"><span>SUBMITTED UTR</span><b>{submittedUtr}</b><button type="button" onClick={() => void navigator.clipboard?.writeText(submittedUtr)} aria-label="Copy UTR"><Copy size={15}/></button></div>}
            <div className="tp-status-list">
              <div className="tp-status-step done"><span><Check size={16}/></span><div><b>Application received</b><small>Reference TP-2026-00125</small></div><strong>Done</strong></div>
              <div className={paymentState === "under_verification" || paymentState === "paid" ? "tp-status-step current" : "tp-status-step"}><span><Clock3 size={16}/></span><div><b>Payment status</b><small>{paymentLabel === "Under Verification" ? "Our admin is verifying your UTR" : paymentLabel === "Paid" ? "Payment verified by admin" : "Waiting for UTR submission"}</small></div><strong>{paymentLabel}</strong></div>
              <div className={policyState === "issued" ? "tp-status-step done" : "tp-status-step current"}><span>{policyState === "issued" ? <Check size={16}/> : <Clock3 size={16}/>}</span><div><b>Policy document</b><small>{policyState === "issued" ? "Your policy is ready to view" : "Insurance policy is being processed"}</small></div><strong>{policyState === "issued" ? "Issued" : "Processing"}</strong></div>
            </div>
            {policyState === "issued" ? <button className="tp-primary" type="button"><FileCheck2 size={17}/> Download policy PDF</button> : <div className="tp-policy-wait"><FileText size={18}/><span><b>Policy document under processing</b><small>Your policy PDF will appear here after our admin uploads it.</small></span></div>}
            <div className="tp-help-note">Need help? <b>+91 7006865909</b></div>
          </aside>
        </div>
      ) : (
        <div className="tp-admin-layout">
          <section className="tp-admin-sidebar">
            <div className="tp-admin-title"><span className="tp-admin-avatar">BC</span><div><b>Insurance desk</b><small>Owner workspace · Preview</small></div></div>
            <div className="tp-admin-stat-grid"><div><small>NEW REQUESTS</small><b>04</b></div><div><small>UTR TO VERIFY</small><b>{paymentState === "under_verification" ? "01" : "00"}</b></div><div><small>POLICIES PROCESSING</small><b>{policyState === "issued" ? "00" : "03"}</b></div></div>
            <div className="tp-admin-nav"><span className="selected"><FileText size={16}/> Applications</span><span><WalletCards size={16}/> Payment verification</span><span><FileCheck2 size={16}/> Policy documents</span></div>
            <div className="tp-admin-side-note"><LockKeyhole size={16}/><span>Owner-only access. Customer payment claims never mark themselves as paid.</span></div>
          </section>
          <section className="tp-admin-main">
            <div className="tp-admin-heading"><div><span className="tp-eyebrow">APPLICATION MANAGEMENT</span><h2>Third-party insurance requests</h2><p>Review the UTR, verify the payment, then upload the issued policy.</p></div><span className="tp-chip tp-chip-green">System preview</span></div>
            <div className="tp-admin-request"><div><span className="tp-eyebrow">TP-2026-00125 · SUBMITTED TODAY</span><h3>Customer Demo</h3><p>+91 98XXXXXX10 · JK01AB1234 · Maruti Swift Petrol</p></div><span className="tp-chip tp-chip-gold">TP Insurance</span></div>
            <div className="tp-admin-details">
              <div><small>INSURER</small><b>Selected insurer</b></div><div><small>PREMIUM DUE</small><b>As per approved quote</b></div><div><small>CUSTOMER UTR</small><b>{submittedUtr || "Awaiting customer submission"}</b></div><div><small>PAYMENT STATUS</small><b className={paymentState === "paid" ? "tp-text-green" : "tp-text-amber"}>{paymentLabel}</b></div>
            </div>
            <div className="tp-admin-workflow">
              <article><div className="tp-workflow-head"><h3><WalletCards size={18}/> Payment verification</h3><span className={paymentState === "paid" ? "tp-chip tp-chip-green" : "tp-chip tp-chip-gold"}>{paymentLabel}</span></div><p>Compare the submitted UTR and payment proof against the actual bank / UPI account credit.</p>{submittedUtr && <div className="tp-utr-confirm admin"><span>CUSTOMER-SUBMITTED UTR</span><b>{submittedUtr}</b></div>}<label className="tp-admin-note-label">Internal admin note<textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}/></label><button className="tp-primary" type="button" disabled={paymentState !== "under_verification"} onClick={() => setPaymentState("paid")}><BadgeCheck size={17}/> Verify payment and mark Paid</button><small className="tp-warning">This is a demo action only. In the real portal it will require owner authentication and an audit record.</small></article>
              <article><div className="tp-workflow-head"><h3><UploadCloud size={18}/> Policy issuance</h3><span className={policyState === "issued" ? "tp-chip tp-chip-green" : "tp-chip tp-chip-blue"}>{policyState === "issued" ? "Issued" : "Processing"}</span></div><p>Upload the actual policy document after completing the insurance with the insurer.</p><label className="tp-admin-note-label">Policy number<input value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Enter insurer policy number"/></label><label className="tp-upload-policy"> <UploadCloud size={18}/><span>{policyFile ? policyFile.name : "Choose issued policy PDF"}</span><input type="file" accept=".pdf,application/pdf" onChange={e => setPolicyFile(e.target.files?.[0] ?? null)}/></label><button className="tp-primary" type="button" disabled={paymentState !== "paid" || !policyFile || !policyNumber.trim()} onClick={uploadPolicy}><FileCheck2 size={17}/> Upload policy and mark Issued</button>{paymentState !== "paid" && <small className="tp-warning">Verify payment first. Policy cannot be marked Issued before payment is Paid.</small>}{policyState === "issued" && <div className="tp-issued-confirm"><CheckCircle2 size={17}/> Policy uploaded. Customer can now download it.</div>}</article>
            </div>
            <div className="tp-audit-note"><ShieldCheck size={17}/><span>Every payment verification, status change and policy upload will be recorded in the admin activity history.</span></div>
          </section>
        </div>
      )}
      <footer className="tp-preview-footer">BABA'S CYBER CAFE <span>·</span> Your Trust, Our Service <span>·</span> Preview only — no real payment or document is submitted</footer>
    </main>
  );
}
