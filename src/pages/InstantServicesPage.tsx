import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, BadgeCheck, CarFront, CloudSun, Fuel, Gem, LoaderCircle, MapPin, Radio, ShieldCheck, Wind } from "lucide-react";
import { callApiExpress, type ApiExpressService } from "../lib/apiExpressClient";
import { supabase } from "../lib/supabase";
import "../instant-services.css";

type ToolId = "kyc_pan" | "kyc_aadhaar_dl" | "rc_verify" | "telecom_operator" | "fuel_price" | "commodity_price" | "weather" | "air_quality";
type ToolDefinition = { id: ToolId; title: string; description: string; icon: typeof ShieldCheck; group: string };
const tools: ToolDefinition[] = [
  { id: "rc_verify", title: "Vehicle RC verification", description: "Enter a registration number to retrieve available vehicle details.", icon: CarFront, group: "Vehicle services" },
  { id: "kyc_pan", title: "PAN verification", description: "Check a PAN document's verification status.", icon: ShieldCheck, group: "Identity checks" },
  { id: "kyc_aadhaar_dl", title: "Aadhaar OTP request", description: "Start an Aadhaar verification request with your explicit consent.", icon: BadgeCheck, group: "Identity checks" },
  { id: "kyc_aadhaar_dl", title: "Driving licence check", description: "Check driving-licence details through the provider.", icon: CarFront, group: "Identity checks" },
  { id: "telecom_operator", title: "Mobile operator lookup", description: "Identify the operator and telecom circle for a mobile number.", icon: Radio, group: "Everyday utilities" },
  { id: "fuel_price", title: "Fuel price", description: "Request the latest available city fuel-price data.", icon: Fuel, group: "Everyday utilities" },
  { id: "commodity_price", title: "Gold & silver rates", description: "Look up gold or silver price data by city.", icon: Gem, group: "Everyday utilities" },
  { id: "weather", title: "Weather", description: "Get a city weather report.", icon: CloudSun, group: "Everyday utilities" },
  { id: "air_quality", title: "Air quality", description: "Check the available city AQI report.", icon: Wind, group: "Everyday utilities" },
];

type FormState = { pan: string; document: string; rc: string; mobile: string; city: string; commodity: "gold" | "silver"; consent: boolean };
const initial: FormState = { pan: "", document: "", rc: "", mobile: "", city: "Srinagar", commodity: "gold", consent: false };

function displayValue(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export default function InstantServicesPage() {
  const [form, setForm] = useState<FormState>(initial);
  const [selected, setSelected] = useState<ToolId>("rc_verify");
  const [docType, setDocType] = useState<"aadhaar" | "dl">("aadhaar");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    if (!supabase) { setSessionReady(true); return; }
    void supabase.auth.getSession().then(({ data }) => {
      if (active) { setSignedIn(!!data.session); setSessionReady(true); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(!!session);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const visibleTools = useMemo(() => tools.filter((tool) => `${tool.title} ${tool.description} ${tool.group}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const activeTool = tools.find((tool) => tool.id === selected);

  function choose(tool: ToolDefinition) {
    setSelected(tool.id);
    setResult(null);
    setError("");
    if (tool.title === "Aadhaar OTP request") setDocType("aadhaar");
    if (tool.title === "Driving licence check") setDocType("dl");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setResult(null);
    let service: ApiExpressService = selected;
    let payload: Record<string, unknown> = {};
    switch (selected) {
      case "kyc_pan":
        payload = { pan: form.pan.trim().toUpperCase() };
        break;
      case "kyc_aadhaar_dl":
        payload = { doc_type: docType, document_number: form.document.trim().toUpperCase(), ...(docType === "aadhaar" ? { consent: form.consent } : {}) };
        break;
      case "rc_verify":
        payload = { rc_number: form.rc.trim().toUpperCase() };
        break;
      case "telecom_operator":
        payload = { mobile: form.mobile.replace(/\D/g, "") };
        break;
      case "fuel_price":
      case "weather":
      case "air_quality":
        payload = { city: form.city.trim() };
        break;
      case "commodity_price":
        payload = { type: form.commodity, city: form.city.trim() };
        break;
    }
    try {
      const response = await callApiExpress(service, payload);
      if (!response.ok) setError(response.error ?? "The service could not complete this request.");
      else setResult(response.data ?? response);
    } catch {
      setError("We could not connect. Please try again or contact our service desk.");
    } finally { setBusy(false); }
  }

  const selectedToolTitle = selected === "kyc_aadhaar_dl" ? (docType === "aadhaar" ? "Aadhaar OTP request" : "Driving licence check") : (activeTool?.title ?? "Instant service");
  const selectedToolDescription = selected === "kyc_aadhaar_dl" && docType === "dl" ? "Check driving-licence details through the provider." : (activeTool?.description ?? "Choose a service to continue.");
  const whatsappMessage = encodeURIComponent(`Hello BABA'S CYBER CAFE, I need assistance with ${selectedToolTitle}.`);
  const serviceReady = sessionReady && signedIn;

  return (
    <main className="instant-services-page">
      <section className="instant-services-hero">
        <div className="instant-services-hero-copy">
          <span className="eyebrow"><i className="eyebrow-dot" /> DIGITAL SERVICE DESK · SRINAGAR</span>
          <h1>Vehicle details.<br /><em>Just one number.</em></h1>
          <p>Start with a vehicle registration number, or choose another identity and everyday service. Enter the details once and view the provider response in this page.</p>
          <div className="instant-services-trust"><ShieldCheck size={17} /> Secure gateway · No public API keys · Clear result messages</div>
        </div>
        <div className="instant-services-hero-panel">
          <span>INSTANT SERVICE DESK</span>
          <strong>09</strong>
          <small>Customer-facing tools</small>
          <div className="instant-services-panel-line" />
          <p>Enter your RC number to begin. Other checks are one tap away.</p>
        </div>
      </section>

      <section className="instant-services-body">
        <div className="instant-services-heading">
          <div><span className="eyebrow">SERVICE DIRECTORY</span><h2>Start your service</h2><p>Vehicle RC lookup is ready first. Choose another service whenever you need it.</p></div>
          <label className="instant-services-search"><span className="sr-only">Search services</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search services…" /></label>
        </div>
        <div className="instant-services-layout">
          <div className="instant-services-list">
            {visibleTools.map((tool) => {
              const Icon = tool.icon;
              const isActive = selected === tool.id && ((tool.title === "Aadhaar OTP request" && docType === "aadhaar") || (tool.title === "Driving licence check" && docType === "dl") || !["Aadhaar OTP request", "Driving licence check"].includes(tool.title));
              return <button type="button" key={tool.title} className={isActive ? "instant-service-card is-active" : "instant-service-card"} onClick={() => choose(tool)}>
                <span className="instant-service-icon"><Icon size={19}/></span>
                <span className="instant-service-card-copy"><b>{tool.title}</b><small>{tool.description}</small></span>
                <ArrowRight size={16}/>
              </button>;
            })}
            {!visibleTools.length && <p className="instant-services-empty">No matching service. Try another search.</p>}
          </div>

          <section className="instant-service-workspace">
            <div className="instant-service-workspace-head">
              <span className="eyebrow">SELECTED SERVICE</span>
              <h2>{selectedToolTitle}</h2>
              <p>{selectedToolDescription}</p>
            </div>
            {!serviceReady ? <div className="instant-service-auth">
              <ShieldCheck size={25}/>
              <h3>{sessionReady ? "Sign in to use secure checks" : "Checking secure access…"}</h3>
              <p>To protect personal documents and prevent anonymous API use, verification requests require an authenticated customer account.</p>
              {sessionReady && <Link className="button button-dark" to="/dashboard">Open customer sign-in <ArrowRight size={15}/></Link>}
            </div> : <form className="instant-service-form" onSubmit={(e) => void submit(e)}>
              {selected === "kyc_pan" && <label className="field"><span>PAN number</span><input required minLength={10} maxLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" autoComplete="off" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F"/></label>}
              {selected === "kyc_aadhaar_dl" && <>
                <label className="field"><span>Document type</span><select value={docType} onChange={(e) => { setDocType(e.target.value as "aadhaar" | "dl"); setForm((current) => ({ ...current, consent: false })); setResult(null); setError(""); }}><option value="aadhaar">Aadhaar OTP request</option><option value="dl">Driving licence</option></select></label>
                <label className="field"><span>{docType === "aadhaar" ? "Aadhaar number" : "Driving licence number"}</span><input required minLength={docType === "aadhaar" ? 12 : 5} maxLength={24} autoComplete="off" inputMode={docType === "aadhaar" ? "numeric" : "text"} value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value.replace(docType === "aadhaar" ? /\D/g : /[^a-zA-Z0-9-]/g, "").slice(0,24) })} placeholder={docType === "aadhaar" ? "12-digit Aadhaar number" : "Driving licence number"}/></label>
                {docType === "aadhaar" && <label className="instant-consent"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })}/><span>I consent to sending my Aadhaar number to the verification provider to request an OTP. I understand this starts a request only; OTP confirmation is a separate step.</span></label>}
              </>}
              {selected === "rc_verify" && <label className="field"><span>Vehicle registration number</span><input required minLength={5} maxLength={24} autoComplete="off" value={form.rc} onChange={(e) => setForm({ ...form, rc: e.target.value.toUpperCase() })} placeholder="e.g. JK01AB1234"/></label>}
              {selected === "telecom_operator" && <label className="field"><span>Mobile number</span><input required minLength={10} maxLength={15} inputMode="tel" autoComplete="off" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0,15) })} placeholder="10-digit mobile number"/></label>}
              {["fuel_price", "commodity_price", "weather", "air_quality"].includes(selected) && <>
                <label className="field"><span>City</span><input required maxLength={80} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Srinagar"/></label>
                {selected === "commodity_price" && <label className="field"><span>Commodity</span><select value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value as "gold" | "silver" })}><option value="gold">Gold</option><option value="silver">Silver</option></select></label>}
              </>}
              <button className="button button-dark instant-service-submit" disabled={busy || (selected === "kyc_aadhaar_dl" && docType === "aadhaar" && !form.consent)}>
                {busy ? <><LoaderCircle size={16}/> Processing securely…</> : <>Run {selectedToolTitle} <ArrowRight size={16}/></>}
              </button>
              <p className="instant-service-footnote">Your entry is sent securely to the service gateway. Do not share OTPs, passwords or payment PINs.</p>
            </form>}
            {error && <div className="notice notice-error" role="alert">{error}</div>}
            {result !== null && <div className="instant-service-result" role="status"><div><BadgeCheck size={17}/><b>Provider response received</b></div><pre>{displayValue(result)}</pre><small>Review the returned details carefully. A response is not a government approval or a guarantee of eligibility.</small></div>}
          </section>
        </div>
      </section>
      <section className="instant-services-notes">
        <div><ShieldCheck size={20}/><span><b>Privacy first</b><small>Verification inputs are not displayed in URLs or saved in the page.</small></span></div>
        <div><Activity size={20}/><span><b>Availability varies</b><small>Provider access, sandbox status and network availability affect results.</small></span></div>
        <div><MapPin size={20}/><span><b>Need assistance?</b><small>Our Srinagar service desk can guide you through the process.</small></span></div>
      </section>
      <section className="instant-services-contact"><div><span className="eyebrow">PERSONAL ASSISTANCE</span><h2>Would you like our team to help?</h2><p>Contact BABA'S CYBER CAFE for guidance, document requirements and service availability.</p></div><a className="button button-gold" href={`https://wa.me/917006865909?text=${whatsappMessage}` } target="_blank" rel="noreferrer">Chat on WhatsApp <ArrowRight size={15}/></a></section>
      <p className="instant-services-disclaimer">BABA'S CYBER CAFE is an independent assistance business, not a government department or authorised government portal. Some API functions may remain in sandbox until production access is approved. No result should be treated as official approval.</p>
    </main>
  );
}
