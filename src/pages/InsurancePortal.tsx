import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BadgeCheck, Bike, CarFront, CheckCircle2, ClipboardList, FileCheck2, Fuel, LockKeyhole, RefreshCw, ShieldCheck, Truck, WalletCards } from "lucide-react";
import { callFunction, supabase } from "../lib/supabase";
import "../insurance.css";

type QuoteForm = {
  customerName: string; mobile: string; email: string; vehicleType: string;
  registrationNumber: string; makeModel: string; variant: string; registrationYear: string;
  fuelType: string; policyType: string; previousInsurer: string; policyExpiry: string;
  claimsLastYear: boolean; customerNotes: string; consent: boolean;
};
const initialForm: QuoteForm = {
  customerName: "", mobile: "", email: "", vehicleType: "private_car", registrationNumber: "",
  makeModel: "", variant: "", registrationYear: String(new Date().getFullYear()), fuelType: "petrol",
  policyType: "comprehensive", previousInsurer: "", policyExpiry: "", claimsLastYear: false,
  customerNotes: "", consent: false,
};
type RequestRow = {
  id: string; tracking_id: string; customer_name: string; mobile: string; email: string;
  vehicle_type: string; registration_number: string | null; make_model: string; variant: string | null;
  registration_year: number; fuel_type: string; policy_type: string; previous_insurer: string | null;
  policy_expiry: string | null; claims_last_year: boolean; customer_notes: string | null;
  status: string; created_at: string;
};
const statusLabels: Record<string,string> = {
  received: "Received", partner_review: "Partner review", quotes_ready: "Quotes ready",
  customer_contacted: "Customer contacted", payment_pending: "Payment pending", issued: "Policy issued", closed: "Closed",
};
const vehicleLabels: Record<string,string> = { two_wheeler:"Two wheeler", private_car:"Private car", commercial_vehicle:"Commercial vehicle" };

export function InsurancePortal() {
  const [form,setForm] = useState<QuoteForm>(initialForm);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [trackingId,setTrackingId] = useState("");
  const update = (key: keyof QuoteForm, value: string | boolean) => setForm(current => ({...current,[key]:value}));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setTrackingId("");
    try {
      const result = await callFunction<{trackingId:string}>("insurance-portal", {
        action:"create_request", ...form, registrationYear:Number(form.registrationYear),
      });
      setTrackingId(result.trackingId); setForm(initialForm);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not save your quote request. Please try again.");
    } finally { setBusy(false); }
  }
  return <main className="insurance-market">
    <section className="insurance-market-hero">
      <div className="insurance-market-glow"/>
      <div className="insurance-market-hero-copy">
        <span className="insurance-kicker"><ShieldCheck size={15}/> BABA'S CYBER CAFE · MOTOR INSURANCE DESK</span>
        <h1>Cover your drive.<br/><em>Compare with clarity.</em></h1>
        <p>Request motor insurance options through our POSP partner network. Review cover, IDV, add-ons and insurer terms before choosing a policy.</p>
        <div className="insurance-market-actions">
          <a href="#motor-quote" className="insurance-primary-button">Get vehicle quotes <ArrowRight size={16}/></a>
          <a href="#cover-types" className="insurance-secondary-button">Explore cover types</a>
        </div>
        <div className="insurance-market-trust"><BadgeCheck size={15}/> No fabricated premiums · Insurer-confirmed payment · Customer-first guidance</div>
      </div>
      <div className="insurance-market-visual">
        <div className="insurance-ring ring-one"/><div className="insurance-ring ring-two"/>
        <div className="insurance-car-plate"><CarFront size={86} strokeWidth={1}/><span>PROTECTED JOURNEYS</span><b>BBC / MOTOR</b></div>
        <div className="insurance-visual-label">MOTOR · TWO WHEELER · COMMERCIAL</div>
      </div>
    </section>
    <section className="insurance-market-stats">
      <div><strong>3</strong><span>Vehicle categories</span></div><div><strong>4</strong><span>Cover journeys</span></div><div><strong>1</strong><span>Secure request reference</span></div>
    </section>
    <section className="insurance-cover-section" id="cover-types">
      <div className="insurance-section-heading"><span className="insurance-kicker">CHOOSE YOUR VEHICLE</span><h2>One desk. Multiple journeys.</h2><p>Start with the vehicle type and cover you need. Final availability and price depend on insurer underwriting.</p></div>
      <div className="insurance-cover-grid">
        <article><Bike/><h3>Two wheeler</h3><p>Motorcycles and scooters, with third-party or package cover where available.</p><small>TP · Comprehensive · Renewal</small></article>
        <article><CarFront/><h3>Private car</h3><p>Private-use cars with liability, own-damage and eligible add-on options.</p><small>TP · Comprehensive · Standalone OD</small></article>
        <article><Truck/><h3>Commercial vehicle</h3><p>Eligible goods and passenger vehicles, subject to insurer product rules.</p><small>Third-party · Package · Renewal</small></article>
      </div>
      <div className="insurance-cover-types">
        <div><ShieldCheck/><span><b>Third-party</b><small>Mandatory liability cover for third-party injury, death and property damage, subject to policy terms.</small></span></div>
        <div><CarFront/><span><b>Comprehensive / Package</b><small>Combines third-party liability with own-damage protection, subject to exclusions and deductibles.</small></span></div>
        <div><RefreshCw/><span><b>Standalone own-damage / Renewal</b><small>Availability and eligibility depend on existing liability cover and insurer underwriting.</small></span></div>
      </div>
    </section>
    <section className="insurance-quote-section" id="motor-quote">
      <div className="insurance-section-heading"><span className="insurance-kicker">SECURE QUOTE REQUEST</span><h2>Tell us about your vehicle.</h2><p>We use these details to prepare an insurer/partner quote request. Please do not upload identity documents or share payment details here.</p></div>
      {trackingId ? <div className="insurance-success-panel"><CheckCircle2 size={34}/><h3>Your quote request is saved.</h3><p>Your reference number is</p><strong>{trackingId}</strong><p>Keep this reference. Our POSP desk will review the vehicle details and contact you with available insurer quotations. No policy has been purchased yet.</p><button type="button" onClick={()=>setTrackingId("")}>Submit another vehicle</button></div> :
      <form className="insurance-quote-form" onSubmit={submit}>
        <div className="insurance-form-heading"><span>01</span><div><b>Vehicle and cover</b><small>Enter accurate details from your RC and current policy.</small></div></div>
        <div className="insurance-form-grid">
          <label>Vehicle category<select value={form.vehicleType} onChange={e=>update("vehicleType",e.target.value)}><option value="private_car">Private car</option><option value="two_wheeler">Two wheeler</option><option value="commercial_vehicle">Commercial vehicle</option></select></label>
          <label>Cover required<select value={form.policyType} onChange={e=>update("policyType",e.target.value)}><option value="comprehensive">Comprehensive / Package</option><option value="third_party">Third-party only</option><option value="standalone_od">Standalone own damage</option><option value="renewal">Renewal – help me choose</option></select></label>
          <label>Registration number <span>(optional)</span><input value={form.registrationNumber} onChange={e=>update("registrationNumber",e.target.value.toUpperCase())} placeholder="e.g. JK01AB1234" maxLength={20}/></label>
          <label>Make and model<input value={form.makeModel} onChange={e=>update("makeModel",e.target.value)} placeholder="e.g. Maruti Swift / Honda Activa" required maxLength={120}/></label>
          <label>Variant <span>(optional)</span><input value={form.variant} onChange={e=>update("variant",e.target.value)} placeholder="e.g. VXI / 125cc" maxLength={120}/></label>
          <label>Registration year<input type="number" min="1980" max={new Date().getFullYear()+1} value={form.registrationYear} onChange={e=>update("registrationYear",e.target.value)} required/></label>
          <label>Fuel type<select value={form.fuelType} onChange={e=>update("fuelType",e.target.value)}><option value="petrol">Petrol</option><option value="diesel">Diesel</option><option value="cng">CNG</option><option value="electric">Electric</option><option value="other">Other</option></select></label>
          <label>Previous insurer <span>(optional)</span><input value={form.previousInsurer} onChange={e=>update("previousInsurer",e.target.value)} placeholder="Insurer name" maxLength={120}/></label>
          <label>Current policy expiry <span>(optional)</span><input type="date" value={form.policyExpiry} onChange={e=>update("policyExpiry",e.target.value)}/></label>
          <label className="insurance-check-field"><input type="checkbox" checked={form.claimsLastYear} onChange={e=>update("claimsLastYear",e.target.checked)}/> Any claim in the previous policy year?</label>
        </div>
        <div className="insurance-form-heading"><span>02</span><div><b>Your contact details</b><small>We will use these only to respond to this insurance request.</small></div></div>
        <div className="insurance-form-grid">
          <label>Full name<input value={form.customerName} onChange={e=>update("customerName",e.target.value)} required minLength={2} maxLength={120}/></label>
          <label>Mobile number<input type="tel" value={form.mobile} onChange={e=>update("mobile",e.target.value)} placeholder="+91" required maxLength={20}/></label>
          <label className="insurance-wide-field">Email address<input type="email" value={form.email} onChange={e=>update("email",e.target.value)} required maxLength={254}/></label>
          <label className="insurance-wide-field">Additional information <span>(optional)</span><textarea rows={3} value={form.customerNotes} onChange={e=>update("customerNotes",e.target.value)} maxLength={800} placeholder="Tell us about preferred cover or renewal requirements."/></label>
        </div>
        <label className="insurance-consent"><input type="checkbox" checked={form.consent} onChange={e=>update("consent",e.target.checked)} required/> I consent to BABA'S CYBER CAFE using these details to arrange insurance quotations through its authorised POSP/insurance partner channels and to contact me about this request.</label>
        {error && <p className="insurance-form-error" role="alert">{error}</p>}
        <button className="insurance-submit-button" disabled={busy}>{busy ? "Saving secure request…" : "Request insurer quotations"} <ArrowRight size={17}/></button>
        <p className="insurance-form-disclaimer"><LockKeyhole size={13}/> Your request is stored securely. We do not collect premiums or card/bank credentials on this page.</p>
      </form>}
    </section>
    <section className="insurance-how-section">
      <div className="insurance-section-heading"><span className="insurance-kicker">A TRANSPARENT PURCHASE JOURNEY</span><h2>From vehicle details to insurer payment.</h2></div>
      <div className="insurance-steps">
        <div><span>01</span><ClipboardList/><b>Vehicle details</b><p>Submit vehicle and contact information.</p></div>
        <div><span>02</span><Fuel/><b>Partner quotations</b><p>POSP checks eligible insurer quotes and terms in authorised partner systems.</p></div>
        <div><span>03</span><FileCheck2/><b>Compare and choose</b><p>Review final premium, IDV, add-ons, exclusions and policy wording.</p></div>
        <div><span>04</span><WalletCards/><b>Pay insurer directly</b><p>Payment happens only on the selected insurer's verified payment gateway.</p></div>
      </div>
      <div className="insurance-partner-note"><ShieldCheck/><div><b>Partner-led, not price-invented.</b><p>InsuranceDekho and Liberty partner access is currently dashboard-based. This portal records your request; live automated multi-insurer premiums, instant vehicle-history reports and policy issuance will activate only after the relevant partner API/data permissions are approved and connected.</p></div></div>
    </section>
  </main>;
}

export function AdminInsurancePortal() {
  const [items,setItems] = useState<RequestRow[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("all");
  const [notice,setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Please sign in through the owner admin portal first.")
      const result = await callFunction<{items:RequestRow[]}>("insurance-portal",{action:"list_requests",search,status:filter},token);
      setItems(result.items);
    } catch(reason) { setError(reason instanceof Error ? reason.message : "Could not load insurance requests."); }
    finally { setLoading(false); }
  },[search,filter]);
  useEffect(()=>{void load()},[load]);
  async function changeStatus(id:string,status:string) {
    try {
      const session=await supabase?.auth.getSession(), token=session?.data.session?.access_token;
      if(!token) throw new Error("Owner sign-in required.")
      await callFunction("insurance-portal",{action:"update_status",id,status},token);
      setNotice("Request status updated."); await load();
    } catch(reason) { setError(reason instanceof Error ? reason.message : "Update failed."); }
  }
  return <main className="insurance-admin-page">
    <div className="insurance-admin-head"><span className="insurance-kicker">OWNER WORKSPACE · MOTOR INSURANCE</span><h1>Insurance enquiries</h1><p>Private customer requests submitted through the motor insurance portal.</p></div>
    <div className="insurance-admin-tools"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, reference, mobile or vehicle"/><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div>
    {notice && <p className="insurance-admin-notice">{notice}</p>}{error && <p className="insurance-form-error">{error}</p>}
    {loading ? <p>Loading secure requests…</p> : items.length===0 ? <p className="insurance-admin-empty">No insurance requests found.</p> :
      <div className="insurance-admin-list">{items.map(item=><article key={item.id}>
        <div className="insurance-admin-row-top"><div><b>{item.customer_name}</b><small>{item.tracking_id} · {new Date(item.created_at).toLocaleString()}</small></div><span>{statusLabels[item.status]??item.status}</span></div>
        <div className="insurance-admin-details"><span>{vehicleLabels[item.vehicle_type]} · {item.make_model} {item.variant??""}</span><span>{item.registration_number||"Registration not provided"} · {item.registration_year}</span><span>{item.mobile} · {item.email}</span><span>{item.policy_type.replaceAll("_"," ")} · {item.fuel_type}</span><span>Previous insurer: {item.previous_insurer||"Not provided"} · Claims: {item.claims_last_year?"Yes":"No"}</span></div>
        {item.customer_notes && <p>{item.customer_notes}</p>}
        <label className="insurance-status-control">Request status<select value={item.status} onChange={e=>void changeStatus(item.id,e.target.value)}>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      </article>)}</div>}
    <p className="insurance-admin-footnote"><LockKeyhole size={13}/> Owner-only data access. Customer requests are not publicly readable.</p>
  </main>;
}
