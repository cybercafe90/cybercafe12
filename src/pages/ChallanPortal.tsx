import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import { callFunction, isSupabaseConfigured } from "../lib/supabase";
import "../challan.css";

const OFFICIAL_CHALLAN_URL = "https://echallan.parivahan.gov.in/";

type Submission = { trackingId: string; emailSent: boolean; emailWarning?: string };

export default function ChallanPortal() {
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [requestType, setRequestType] = useState("Check a challan");
  const [details, setDetails] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submission, setSubmission] = useState<Submission | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isSupabaseConfigured) {
      setError("Online assistance requests are temporarily unavailable. Please call or WhatsApp BABA'S CYBER CAFE.");
      return;
    }
    if (!consent) {
      setError("Please agree to the privacy notice before submitting.");
      return;
    }
    setBusy(true);
    try {
      const result = await callFunction<Submission>("create-application", {
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        category: "rto",
        service: "Challan Information Assistance",
        description: [
          "CHALLAN ASSISTANCE REQUEST",
          `Vehicle registration: ${vehicleNumber.trim().toUpperCase()}`,
          `Request type: ${requestType}`,
          details.trim() ? `Additional details: ${details.trim()}` : "",
        ].filter(Boolean).join("\n"),
        requiredDocuments: "",
        consent,
      });
      setSubmission(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your request could not be submitted. Please try again or contact the cafe.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="challan-page">
      <section className="challan-hero">
        <div className="challan-hero-copy">
          <span className="eyebrow">BABA'S CYBER CAFE · RTO ASSISTANCE</span>
          <h1>Check your <em>traffic challan.</em></h1>
          <p>Use the Government of India's official eChallan service for live challan details and payments, or send our team a request for personal assistance.</p>
          <div className="challan-hero-actions">
            <a className="button button-gold" href={OFFICIAL_CHALLAN_URL} target="_blank" rel="noopener noreferrer">
              Open official eChallan <ExternalLink size={15} />
            </a>
            <a className="button button-outline challan-outline-light" href="#challan-assistance">Request assistance <ArrowRight size={15} /></a>
          </div>
          <div className="challan-trust"><ShieldCheck size={17} /> Official challan records remain on the Government portal.</div>
        </div>
        <aside className="challan-official-card">
          <span className="challan-card-icon"><ShieldCheck size={24}/></span>
          <span className="eyebrow">GOVERNMENT OF INDIA</span>
          <h2>NextGen eChallan</h2>
          <p>Digital Traffic / Transport Enforcement Solution · Ministry of Road Transport &amp; Highways</p>
          <a href={OFFICIAL_CHALLAN_URL} target="_blank" rel="noopener noreferrer">echallan.parivahan.gov.in <ArrowUpRight size={14}/></a>
        </aside>
      </section>

      <section className="challan-guidance">
        <div><strong>1. Check securely</strong><p>Open the official portal and follow its vehicle / challan search and verification steps.</p></div>
        <div><strong>2. Pay only officially</strong><p>Review the challan details and complete any payment only on the official government portal.</p></div>
        <div><strong>3. Need help?</strong><p>Send an assistance request below. We will provide a tracking reference for your enquiry.</p></div>
      </section>

      <section className="challan-form-section" id="challan-assistance">
        <div className="challan-form-intro">
          <span className="eyebrow">PERSONAL ASSISTANCE</span>
          <h2>Let us help with your challan enquiry.</h2>
          <p>Share your contact details and vehicle number. Our team can guide you through checking the official record and understanding the next steps.</p>
          <div className="challan-privacy"><ShieldCheck size={18}/><span>Your request is recorded in the existing secure application system and can be followed using its tracking reference.</span></div>
        </div>

        {submission ? (
          <div className="challan-success" role="status">
            <CheckCircle2 size={34}/>
            <span className="eyebrow">REQUEST RECEIVED</span>
            <h2>Your assistance request is registered.</h2>
            <p>Keep this reference safe. Use it with your registered mobile number on the tracking page to check updates.</p>
            <div className="challan-reference"><small>YOUR TRACKING REFERENCE</small><strong>{submission.trackingId}</strong></div>
            <div className="challan-success-actions">
              <Link className="button button-dark" to="/track">Track request <ArrowRight size={15}/></Link>
              <a className="button button-outline" href={`https://wa.me/917006865909?text=${encodeURIComponent(`Hello BABA'S CYBER CAFE, I submitted challan assistance request ${submission.trackingId}.`)}`} target="_blank" rel="noopener noreferrer">Contact on WhatsApp <ArrowUpRight size={15}/></a>
            </div>
            {!submission.emailSent && <p className="challan-warning">{submission.emailWarning ?? "Your request is saved. Email confirmation was not confirmed; please keep your tracking reference."}</p>}
          </div>
        ) : (
          <form className="challan-form" onSubmit={submit}>
            <div className="challan-field-grid">
              <label className="field"><span>Full name <i>*</i></span><input value={fullName} onChange={e => setFullName(e.target.value)} required minLength={2} maxLength={120} autoComplete="name" /></label>
              <label className="field"><span>Mobile number <i>*</i></span><input value={mobile} onChange={e => setMobile(e.target.value)} required inputMode="tel" pattern="[0-9+() -]{10,16}" maxLength={16} autoComplete="tel" /></label>
              <label className="field"><span>Email address <i>*</i></span><input type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} autoComplete="email" /></label>
              <label className="field"><span>Vehicle registration number <i>*</i></span><input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value.toUpperCase())} required minLength={5} maxLength={15} placeholder="e.g. JK01AB1234" autoCapitalize="characters" /></label>
              <label className="field challan-field-full"><span>What do you need help with? <i>*</i></span><select value={requestType} onChange={e => setRequestType(e.target.value)}><option>Check a challan</option><option>Understand challan details</option><option>Payment / receipt guidance</option><option>Check payment status</option><option>Other challan enquiry</option></select></label>
              <label className="field challan-field-full"><span>Additional details (optional)</span><textarea value={details} onChange={e => setDetails(e.target.value)} maxLength={1200} rows={4} placeholder="Tell us briefly how we can assist. Do not share OTPs, passwords or card details." /></label>
            </div>
            <label className="challan-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required/><span>I consent to BABA'S CYBER CAFE using these details to respond to this challan assistance enquiry. I understand this is an independent assistance service, not a government authority.</span></label>
            {error && <p className="challan-error" role="alert">{error}</p>}
            <button className="button button-dark" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? "Submitting request…" : "Submit assistance request"} <ArrowRight size={15}/></button>
            {!isSupabaseConfigured && <p className="challan-warning">Online submissions are not configured at this time. Please contact the cafe directly.</p>}
          </form>
        )}
      </section>

      <section className="challan-disclaimer">
        <strong>Important safety notice</strong>
        <p>BABA'S CYBER CAFE is an independent digital assistance business, not a government office or an authorised challan collection agency. We do not access or guarantee live government challan records from this page, collect government challan payments, or change official challan status. Verify details and make payments only at the official Parivahan eChallan website. Never share OTPs, passwords or payment credentials with anyone.</p>
      </section>
    </main>
  );
}
