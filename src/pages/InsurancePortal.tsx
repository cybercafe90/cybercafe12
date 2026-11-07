import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { callFunction, supabase } from "../lib/supabase";
import "../insurance-portal.css";

type InsuranceRequest = {
  id: string;
  tracking_id: string;
  customer_name: string;
  mobile: string;
  email: string;
  vehicle_type: string;
  registration_number: string | null;
  make_model: string;
  variant: string | null;
  registration_year: number;
  fuel_type: string;
  policy_type: string;
  previous_insurer: string | null;
  policy_expiry: string | null;
  claims_last_year: boolean;
  customer_notes: string | null;
  status: string;
  created_at: string;
};
type InsuranceQuote = {
  id: string;
  insurer_name: string;
  product_name: string;
  policy_type: string;
  premium: number | string;
  idv: number | string | null;
  cover_summary: string;
  add_ons: string[];
  exclusions: string[];
  payment_url: string | null;
  valid_until: string | null;
  created_at: string;
};
const statuses = ["received", "partner_review", "quotes_ready", "customer_contacted", "payment_pending", "issued", "closed"];
const policyLabel = (value: string) => ({
  third_party: "Third-party",
  comprehensive: "Comprehensive",
  standalone_od: "Standalone own-damage",
  renewal: "Renewal",
  bundled: "Bundled",
}[value] ?? value.replaceAll("_", " "));
const money = (value: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Not specified";

const blankForm = {
  customerName: "", mobile: "", email: "", vehicleType: "private_car",
  registrationNumber: "", makeModel: "", variant: "", registrationYear: "",
  fuelType: "petrol", policyType: "comprehensive", previousInsurer: "",
  policyExpiry: "", claimsLastYear: false, customerNotes: "", consent: false,
};

export default function InsurancePortal({ admin = false }: { admin?: boolean }) {
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createdRef, setCreatedRef] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [trackingMobile, setTrackingMobile] = useState("");
  const [quotes, setQuotes] = useState<InsuranceQuote[]>([]);
  const [quoteStatus, setQuoteStatus] = useState("");
  const [requests, setRequests] = useState<InsuranceRequest[]>([]);
  const [selected, setSelected] = useState<InsuranceRequest | null>(null);
  const [adminReady, setAdminReady] = useState(() => !admin || !supabase);
  const [adminToken, setAdminToken] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [quoteDraft, setQuoteDraft] = useState({
    insurerName: "", productName: "", policyType: "comprehensive", premium: "",
    idv: "", coverSummary: "", addOns: "", exclusions: "", paymentUrl: "", validUntil: "",
  });
  const [statusDraft, setStatusDraft] = useState("received");

  async function loadRequests(token: string, search = adminSearch) {
    const result = await callFunction<{ items: InsuranceRequest[]; count: number }>(
      "insurance-portal", { action: "list_requests", search }, token,
    );
    setRequests(result.items);
    if (selected) {
      const latest = result.items.find((item) => item.id === selected.id);
      if (latest) setSelected(latest);
    }
  }

  useEffect(() => {
    if (!admin || !supabase) return;
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const token = data.session?.access_token ?? "";
      setAdminToken(token);
      if (!token) {
        setError("Sign in with the owner account to open insurance management.");
        setAdminReady(true);
        return;
      }
      try {
        const result = await callFunction<{ items: InsuranceRequest[]; count: number }>(
          "insurance-portal", { action: "list_requests", search: "" }, token,
        );
        if (active) setRequests(result.items);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Owner access could not be verified.");
      } finally {
        if (active) setAdminReady(true);
      }
    });
    return () => { active = false; };
  }, [admin]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice(""); setCreatedRef("");
    try {
      const result = await callFunction<{ trackingId: string; emailSent: boolean; emailWarning?: string }>(
        "insurance-portal",
        { action: "create_request", ...form, registrationYear: Number(form.registrationYear) },
      );
      setCreatedRef(result.trackingId);
      setTrackingId(result.trackingId);
      setTrackingMobile(form.mobile);
      setNotice(result.emailWarning ?? (result.emailSent ? "Confirmation email sent. Our insurance desk will review your request." : "Your request was saved. Keep this reference safe."));
      setForm(blankForm);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your insurance request could not be submitted.");
    } finally { setBusy(false); }
  }

  async function lookupQuotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setQuotes([]);
    try {
      const result = await callFunction<{ trackingId: string; status: string; quotes: InsuranceQuote[] }>(
        "insurance-portal", { action: "get_quotes", trackingId, mobile: trackingMobile },
      );
      setQuotes(result.quotes);
      setQuoteStatus(result.status);
      if (!result.quotes.length) setNotice("Your request is on file. No quotation has been published yet.");
      else setNotice("Your available quotation details are shown below.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not find that insurance request.");
    } finally { setBusy(false); }
  }

  async function refreshAdmin() {
    if (!adminToken) return;
    setBusy(true); setError("");
    try { await loadRequests(adminToken); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Requests could not be refreshed."); }
    finally { setBusy(false); }
  }

  async function createQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !adminToken) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await callFunction<{ saved: boolean; emailSent: boolean; emailWarning?: string }>("insurance-portal", {
        action: "create_quote",
        requestId: selected.id,
        ...quoteDraft,
        premium: Number(quoteDraft.premium),
        idv: quoteDraft.idv,
        addOns: quoteDraft.addOns.split("\n").map((item) => item.trim()).filter(Boolean),
        exclusions: quoteDraft.exclusions.split("\n").map((item) => item.trim()).filter(Boolean),
      }, adminToken);
      setNotice(result.emailWarning ?? (result.emailSent ? "Quotation saved and customer email sent." : "Quotation saved. Customer email delivery was not confirmed."));
      setQuoteDraft({ insurerName: "", productName: "", policyType: "comprehensive", premium: "", idv: "", coverSummary: "", addOns: "", exclusions: "", paymentUrl: "", validUntil: "" });
      await loadRequests(adminToken);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Quotation could not be saved.");
    } finally { setBusy(false); }
  }

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !adminToken) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await callFunction("insurance-portal", { action: "update_status", id: selected.id, status: statusDraft }, adminToken);
      setNotice("Insurance request status updated.");
      await loadRequests(adminToken);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Status could not be updated.");
    } finally { setBusy(false); }
  }

  if (admin) {
    return (
      <main className="content-page insurance-portal-page insurance-admin-page">
        <div className="insurance-page-heading">
          <span className="eyebrow">OWNER-ONLY WORKSPACE</span>
          <h1>Insurance quotation desk</h1>
          <p>Review vehicle enquiries, prepare insurer quotations and update customer request status.</p>
          <Link to="/admin/login">Open owner sign-in <ArrowRight size={14}/></Link>
        </div>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {notice && <div className="notice notice-success" role="status">{notice}</div>}
        {!adminReady ? <div className="insurance-empty">Loading owner access…</div> : !adminToken ? (
          <div className="insurance-empty"><ShieldCheck size={24}/><h2>Owner sign-in required</h2><p>Only the authorised owner can access customer insurance details.</p></div>
        ) : (
          <>
            <div className="insurance-admin-toolbar">
              <input value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder="Search reference, customer, mobile or registration"/>
              <button className="button button-dark" disabled={busy} onClick={() => { setBusy(true); void loadRequests(adminToken, adminSearch).catch((reason) => setError(reason instanceof Error ? reason.message : "Search failed.")).finally(() => setBusy(false)); }}>Search</button>
              <button className="button button-outline" disabled={busy} onClick={() => void refreshAdmin()}><RefreshCw size={15}/> Refresh</button>
            </div>
            <div className="insurance-admin-layout">
              <section className="insurance-request-list">
                <h2>Customer requests ({requests.length})</h2>
                {requests.length ? requests.map((item) => (
                  <button type="button" className={selected?.id === item.id ? "insurance-request-row is-selected" : "insurance-request-row"} key={item.id} onClick={() => { setSelected(item); setStatusDraft(item.status); }}>
                    <span><b>{item.customer_name}</b><small>{item.tracking_id} · {item.make_model}</small></span>
                    <span className="insurance-status">{item.status.replaceAll("_", " ")}</span>
                  </button>
                )) : <p className="insurance-empty">No insurance requests yet.</p>}
              </section>
              <section className="insurance-admin-detail">
                {selected ? (
                  <>
                    <div className="insurance-request-detail">
                      <span className="eyebrow">{selected.tracking_id}</span>
                      <h2>{selected.customer_name}</h2>
                      <p>{selected.mobile} · {selected.email}</p>
                      <dl>
                        <div><dt>Vehicle</dt><dd>{selected.vehicle_type.replaceAll("_", " ")} · {selected.make_model} {selected.variant ?? ""}</dd></div>
                        <div><dt>Registration</dt><dd>{selected.registration_number ?? "Not supplied"} · {selected.registration_year}</dd></div>
                        <div><dt>Fuel / cover</dt><dd>{selected.fuel_type} · {policyLabel(selected.policy_type)}</dd></div>
                        <div><dt>Previous insurer</dt><dd>{selected.previous_insurer ?? "Not supplied"}</dd></div>
                        <div><dt>Policy expiry / claims</dt><dd>{dateLabel(selected.policy_expiry)} · Claims last year: {selected.claims_last_year ? "Yes" : "No"}</dd></div>
                        {selected.customer_notes && <div><dt>Customer notes</dt><dd>{selected.customer_notes}</dd></div>}
                      </dl>
                    </div>
                    <form className="insurance-admin-form" onSubmit={updateStatus}>
                      <h3>Request status</h3>
                      <label>Status<select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
                      <button className="button button-outline" disabled={busy}>Save status</button>
                    </form>
                    <form className="insurance-admin-form" onSubmit={createQuote}>
                      <h3>Create insurer quotation</h3>
                      <div className="insurance-form-grid">
                        <label>Insurer<input required maxLength={120} value={quoteDraft.insurerName} onChange={(event) => setQuoteDraft({ ...quoteDraft, insurerName: event.target.value })}/></label>
                        <label>Product / policy name<input required maxLength={160} value={quoteDraft.productName} onChange={(event) => setQuoteDraft({ ...quoteDraft, productName: event.target.value })}/></label>
                        <label>Cover type<select value={quoteDraft.policyType} onChange={(event) => setQuoteDraft({ ...quoteDraft, policyType: event.target.value })}>{["third_party", "comprehensive", "standalone_od", "bundled", "renewal"].map((type) => <option key={type} value={type}>{policyLabel(type)}</option>)}</select></label>
                        <label>Premium (₹)<input required type="number" min="1" max="10000000" step="0.01" value={quoteDraft.premium} onChange={(event) => setQuoteDraft({ ...quoteDraft, premium: event.target.value })}/></label>
                        <label>IDV (₹, optional)<input type="number" min="0" max="100000000" step="0.01" value={quoteDraft.idv} onChange={(event) => setQuoteDraft({ ...quoteDraft, idv: event.target.value })}/></label>
                        <label>Valid until<input type="datetime-local" value={quoteDraft.validUntil} onChange={(event) => setQuoteDraft({ ...quoteDraft, validUntil: event.target.value })}/></label>
                      </div>
                      <label>Cover summary<textarea required minLength={5} maxLength={1600} rows={3} value={quoteDraft.coverSummary} onChange={(event) => setQuoteDraft({ ...quoteDraft, coverSummary: event.target.value })}/></label>
                      <div className="insurance-form-grid">
                        <label>Add-ons (one per line)<textarea rows={3} value={quoteDraft.addOns} onChange={(event) => setQuoteDraft({ ...quoteDraft, addOns: event.target.value })}/></label>
                        <label>Exclusions (one per line)<textarea rows={3} value={quoteDraft.exclusions} onChange={(event) => setQuoteDraft({ ...quoteDraft, exclusions: event.target.value })}/></label>
                      </div>
                      <label>Official insurer payment link (HTTPS only)<input type="url" placeholder="https://…" value={quoteDraft.paymentUrl} onChange={(event) => setQuoteDraft({ ...quoteDraft, paymentUrl: event.target.value })}/></label>
                      <button className="button button-dark" disabled={busy}>{busy ? "Saving…" : "Save quotation and notify customer"}</button>
                    </form>
                  </>
                ) : <div className="insurance-empty">Select a customer request to review and prepare a quotation.</div>}
              </section>
            </div>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="content-page insurance-portal-page">
      <div className="insurance-page-heading">
        <span className="eyebrow">BABA'S CYBER CAFE · MOTOR INSURANCE DESK</span>
        <h1>Request an insurance quotation.</h1>
        <p>Share your vehicle details once. Our team will review your request and provide available insurer options. Premiums and policy terms depend on the vehicle and selected cover.</p>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className="notice notice-success" role="status">{notice}</div>}
      {createdRef && <div className="insurance-reference"><CheckCircle2 size={20}/><div><b>Your request has been received</b><strong>{createdRef}</strong><small>Keep this reference and your registered mobile number to check quotations.</small></div></div>}
      <section className="insurance-customer-grid">
        <form className="insurance-customer-form" onSubmit={submitRequest}>
          <h2>Vehicle and contact details</h2>
          <div className="insurance-form-grid">
            <label>Full name<input required minLength={2} maxLength={120} value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })}/></label>
            <label>Mobile number<input required type="tel" minLength={8} maxLength={18} value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} placeholder="+91…"/></label>
            <label>Email address<input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label>
            <label>Vehicle type<select value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value })}><option value="private_car">Private car</option><option value="two_wheeler">Two-wheeler</option><option value="commercial_vehicle">Commercial vehicle</option></select></label>
            <label>Make and model<input required minLength={2} maxLength={120} value={form.makeModel} onChange={(event) => setForm({ ...form, makeModel: event.target.value })} placeholder="e.g. Maruti Swift"/></label>
            <label>Variant (optional)<input maxLength={120} value={form.variant} onChange={(event) => setForm({ ...form, variant: event.target.value })}/></label>
            <label>Registration year<input required type="number" min="1980" max={new Date().getFullYear() + 1} value={form.registrationYear} onChange={(event) => setForm({ ...form, registrationYear: event.target.value })}/></label>
            <label>Fuel type<select value={form.fuelType} onChange={(event) => setForm({ ...form, fuelType: event.target.value })}>{["petrol", "diesel", "cng", "electric", "other"].map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></label>
            <label>Registration number (optional)<input maxLength={20} value={form.registrationNumber} onChange={(event) => setForm({ ...form, registrationNumber: event.target.value.toUpperCase() })}/></label>
            <label>Cover requested<select value={form.policyType} onChange={(event) => setForm({ ...form, policyType: event.target.value })}><option value="third_party">Third-party</option><option value="comprehensive">Comprehensive</option><option value="standalone_od">Standalone own-damage</option><option value="renewal">Renewal</option></select></label>
            <label>Previous insurer (optional)<input maxLength={120} value={form.previousInsurer} onChange={(event) => setForm({ ...form, previousInsurer: event.target.value })}/></label>
            <label>Current policy expiry (optional)<input type="date" value={form.policyExpiry} onChange={(event) => setForm({ ...form, policyExpiry: event.target.value })}/></label>
          </div>
          <label>Notes (optional)<textarea rows={3} maxLength={800} value={form.customerNotes} onChange={(event) => setForm({ ...form, customerNotes: event.target.value })} placeholder="Share any additional details relevant to the quotation."/></label>
          <label className="insurance-check"><input type="checkbox" checked={form.claimsLastYear} onChange={(event) => setForm({ ...form, claimsLastYear: event.target.checked })}/> I made an insurance claim in the previous policy year.</label>
          <label className="insurance-check"><input type="checkbox" required checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })}/> I consent to BABA'S CYBER CAFE using these details to obtain and respond to insurance quotations.</label>
          <button className="button button-dark" disabled={busy}>{busy ? "Submitting request…" : "Submit quotation request"} <ArrowRight size={15}/></button>
          <p className="insurance-disclaimer">This is an enquiry, not an insurance policy or a binding premium offer. Final pricing, eligibility, exclusions and issuance are confirmed by the insurer.</p>
        </form>
        <aside className="insurance-lookup-card">
          <span className="eyebrow">ALREADY REQUESTED A QUOTE?</span>
          <h2>Check your quotation.</h2>
          <p>Enter your reference and the mobile number used when submitting the request.</p>
          <form onSubmit={lookupQuotes}>
            <label>Insurance reference<input required value={trackingId} onChange={(event) => setTrackingId(event.target.value.toUpperCase())} placeholder="BABA-XXXXXXXXXX" maxLength={15}/></label>
            <label>Registered mobile<input required type="tel" value={trackingMobile} onChange={(event) => setTrackingMobile(event.target.value)} placeholder="+91…"/></label>
            <button className="button button-outline" disabled={busy}>{busy ? "Checking…" : "Find quotation"}</button>
          </form>
          {quoteStatus && <p className="insurance-status-note">Request status: {quoteStatus.replaceAll("_", " ")}</p>}
          {quotes.map((quote) => (
            <article className="insurance-quote-card" key={quote.id}>
              <span className="eyebrow">{quote.insurer_name}</span>
              <h3>{quote.product_name}</h3>
              <b className="insurance-premium">{money(quote.premium)}</b>
              <small>{policyLabel(quote.policy_type)} · IDV {quote.idv == null ? "not specified" : money(quote.idv)}</small>
              <p>{quote.cover_summary}</p>
              {quote.add_ons.length > 0 && <p><b>Add-ons:</b> {quote.add_ons.join(", ")}</p>}
              {quote.exclusions.length > 0 && <p><b>Exclusions:</b> {quote.exclusions.join(", ")}</p>}
              {quote.valid_until && <small>Valid until {dateLabel(quote.valid_until)}</small>}
              {quote.payment_url && <a className="button button-dark" href={quote.payment_url} target="_blank" rel="noreferrer">Continue with insurer <ArrowRight size={14}/></a>}
            </article>
          ))}
        </aside>
      </section>
    </main>
  );
}
