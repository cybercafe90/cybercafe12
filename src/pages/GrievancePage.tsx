import { useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Search } from "lucide-react";
import { callFunction, isSupabaseConfigured } from "../lib/supabase";

type GrievanceUpdate = { status: string; public_remark: string | null; created_at: string };
type TrackResult = { referenceId: string; subject: string; status: string; submittedAt: string; updatedAt: string; updates: GrievanceUpdate[] };
type SubmitResult = { referenceId: string; status: string; submittedAt: string; emailSent: boolean; emailWarning?: string };

export default function GrievancePage() {
  const [mode, setMode] = useState<"submit" | "track">("submit");
  const [form, setForm] = useState({ fullName: "", mobile: "", email: "", subject: "", description: "", consent: false });
  const [referenceId, setReferenceId] = useState("");
  const [trackMobile, setTrackMobile] = useState("");
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null);
  const [tracked, setTracked] = useState<TrackResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSubmitted(null);
    try {
      const result = await callFunction<SubmitResult>("create-grievance", form);
      setSubmitted(result);
      setForm({ fullName: "", mobile: "", email: "", subject: "", description: "", consent: false });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your grievance could not be submitted.");
    } finally { setBusy(false); }
  }

  async function track(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setTracked(null);
    try {
      const result = await callFunction<TrackResult>("track-grievance", { referenceId, mobile: trackMobile });
      setTracked(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not verify those details.");
    } finally { setBusy(false); }
  }

  return (
    <main className="content-page grievance-page">
      <span className="eyebrow">PUBLIC GRIEVANCE REDRESSAL</span>
      <h1>We’re listening. Tell us what went wrong.</h1>
      <p className="grievance-intro">Submit a complaint or service concern for review by BABA'S CYBER CAFE. Keep your reference number safe so you can follow updates securely.</p>
      {!isSupabaseConfigured && <div className="notice notice-warn">Secure backend configuration is required before submissions can be processed.</div>}
      <div className="grievance-tabs">
        <button className={mode === "submit" ? "active" : ""} onClick={() => { setMode("submit"); setError(""); }}>Submit grievance</button>
        <button className={mode === "track" ? "active" : ""} onClick={() => { setMode("track"); setError(""); }}>Track grievance</button>
      </div>
      {error && <div className="notice notice-error" role="alert"><AlertCircle size={16}/>{error}</div>}
      {mode === "submit" ? (
        <section className="grievance-panel">
          {submitted ? (
            <div className="grievance-success">
              <CheckCircle2 size={28}/>
              <h2>Your grievance has been received</h2>
              <p>Reference number</p>
              <strong>{submitted.referenceId}</strong>
              <small>Status: {submitted.status} · Submitted {new Date(submitted.submittedAt).toLocaleString("en-IN")}</small>
              {submitted.emailWarning && <div className="notice notice-warn">{submitted.emailWarning}</div>}
              <button className="button button-dark" onClick={() => { setMode("track"); setReferenceId(submitted.referenceId); }}>Track this grievance</button>
            </div>
          ) : (
            <form className="grievance-form" onSubmit={submit}>
              <label className="field"><span>Full name</span><input required minLength={2} maxLength={120} value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/></label>
              <div className="grievance-form-grid">
                <label className="field"><span>Mobile number</span><input required type="tel" minLength={8} maxLength={18} value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} placeholder="+91…"/></label>
                <label className="field"><span>Email address</span><input required type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
              </div>
              <label className="field"><span>Subject</span><input required minLength={4} maxLength={160} value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Briefly describe your concern"/></label>
              <label className="field"><span>Details of grievance</span><textarea required minLength={20} maxLength={4000} rows={6} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Include dates, service reference (if any), and what resolution you are seeking."/></label>
              <label className="grievance-consent"><input type="checkbox" required checked={form.consent} onChange={e=>setForm({...form,consent:e.target.checked})}/><span>I confirm these details are accurate and consent to their use for reviewing and responding to this grievance.</span></label>
              <button className="button button-dark" disabled={busy || !isSupabaseConfigured}>{busy ? "Submitting…" : "Submit grievance"}</button>
            </form>
          )}
        </section>
      ) : (
        <section className="grievance-panel">
          <form className="grievance-form" onSubmit={track}>
            <label className="field"><span>Grievance reference number</span><input required value={referenceId} onChange={e=>setReferenceId(e.target.value.toUpperCase())} placeholder="GRV-XXXXXXXXXX" maxLength={14}/></label>
            <label className="field"><span>Registered mobile number</span><input required type="tel" value={trackMobile} onChange={e=>setTrackMobile(e.target.value)} placeholder="+91…"/></label>
            <button className="button button-dark" disabled={busy || !isSupabaseConfigured}><Search size={15}/>{busy ? "Checking…" : "Track grievance"}</button>
          </form>
          {tracked && (
            <div className="grievance-track-result">
              <div className="grievance-track-heading"><div><span className="eyebrow">{tracked.referenceId}</span><h2>{tracked.subject}</h2></div><span className="grievance-status">{tracked.status}</span></div>
              <p className="grievance-track-date">Submitted {new Date(tracked.submittedAt).toLocaleDateString("en-IN")} · Updated {new Date(tracked.updatedAt).toLocaleDateString("en-IN")}</p>
              <div className="grievance-timeline">
                {tracked.updates.length ? tracked.updates.map((item,index)=><div className="grievance-update" key={index}><span className="grievance-dot"/><div><strong>{item.status}</strong><small>{new Date(item.created_at).toLocaleString("en-IN")}</small>{item.public_remark && <p>{item.public_remark}</p>}</div></div>) : <div className="grievance-update"><FileText size={17}/><div><strong>{tracked.status}</strong><small>No additional public updates yet.</small></div></div>}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
