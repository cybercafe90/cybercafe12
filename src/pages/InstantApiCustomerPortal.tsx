import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, CarFront, CheckCircle2, CircleHelp, CreditCard, FileCheck2, IdCard, LoaderCircle, MessageCircle, Search, ShieldCheck, Vote, X } from "lucide-react";
import { Link } from "react-router-dom";
import { callFunction } from "../lib/supabase";
import "./InstantApiCustomerPortal.css";
import InstantApiCustomerCaseDesk from "./InstantApiCustomerCaseDesk";

type Service = { slug: string; name: string; description: string; customer_price: number; is_enabled: boolean; is_featured?: boolean; sort_order?: number };
type GatewayResult = { services?: Service[]; orderId?: string; serviceReference?: string; retrievalToken?: string; razorpayOrderId?: string; amount?: number; currency?: string; keyId?: string; status?: string; result?: unknown; error?: string };
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void }; } }

const iconFor = (slug: string) => slug.includes("voter") ? Vote : slug.includes("vehicle") || slug.includes("vahan") ? CarFront : slug.includes("pan") ? CreditCard : slug.includes("licence") ? IdCard : FileCheck2;
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const fields: Record<string, { name: string; label: string; placeholder: string; type?: string }[]> = {
  "voter-mobile-link": [{ name: "epic_no", label: "Voter EPIC number", placeholder: "Enter EPIC number" }, { name: "mobile_no", label: "Mobile number", placeholder: "10-digit mobile number", type: "tel" }],
  "aadhaar-to-pan": [{ name: "aadhaar_number", label: "Aadhaar number", placeholder: "12-digit Aadhaar number" }],
  "pan-verification": [{ name: "pan", label: "PAN number", placeholder: "ABCDE1234F" }],
  "vehicle-rc-pdf": [{ name: "rcno", label: "Vehicle registration number", placeholder: "Enter RC number" }, { name: "cardtype", label: "Card type (optional)", placeholder: "Default" }, { name: "chiptype", label: "Chip type (optional)", placeholder: "Default" }],
  "number-details": [{ name: "mobileNumber", label: "Mobile number", placeholder: "10-digit mobile number", type: "tel" }],
  "driving-licence-hd-pdf": [{ name: "dl", label: "Driving licence number", placeholder: "Enter DL number" }, { name: "dob", label: "Date of birth", placeholder: "DD-MM-YYYY" }],
  "vahan-to-mobile": [{ name: "vrn", label: "Vehicle registration number", placeholder: "Enter vehicle number" }],
  "voter-status": [{ name: "epic", label: "Voter EPIC number", placeholder: "Enter EPIC number" }],
};

async function loadRazorpay() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout="true"]');
    if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("Payment checkout could not load.")), { once: true }); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true; script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve(); script.onerror = () => reject(new Error("Payment checkout could not load."));
    document.body.appendChild(script);
  });
}

export default function InstantApiCustomerPortal() {
  const [services, setServices] = useState<Service[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("Connecting to the secure service catalogue…");
  const [selected, setSelected] = useState<Service | null>(null);
  const [input, setInput] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [lawfulPurpose, setLawfulPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [orderRef, setOrderRef] = useState("");
  const [retrievalToken, setRetrievalToken] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    callFunction<GatewayResult>("instant-api-gateway", { action: "catalog" })
      .then((response) => {
        if (!active) return;
        const rows = Array.isArray(response.services) ? response.services.filter(item => item.is_enabled === true) : [];
        setServices(rows);
        setNotice(rows.length ? "" : "No services are currently enabled. Please check again later.");
      })
      .catch(() => { if (active) setNotice("Secure service gateway is not connected. Checkout is temporarily unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const resultObject = result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : null;
  const nestedResult = resultObject?.data && typeof resultObject.data === "object" ? resultObject.data as Record<string, unknown> : null;
  const pdfBase64 = [resultObject?.pdf_base64, resultObject?.pdf, nestedResult?.pdf_base64, nestedResult?.pdf].find(value => typeof value === "string" && value.length > 100) as string | undefined;
  const pdfUrl = [resultObject?.pdf_url, nestedResult?.pdf_url].find(value => typeof value === "string" && value.startsWith("https://")) as string | undefined;
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return services.filter(item => !term || [item.name, item.description, item.slug].join(" ").toLowerCase().includes(term));
  }, [query, services]);

  function openService(service: Service) {
    setSelected(service); setInput({}); setConsent(false); setLawfulPurpose(""); setError(""); setResult(null); setOrderStatus(""); setOrderRef(""); setRetrievalToken("");
  }

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    if (!consent || lawfulPurpose.trim().length < 8) { setError("Consent and a brief lawful purpose are required."); return; }
    setBusy(true); setError("");
    try {
      const idempotencyKey = crypto.randomUUID() + "-" + crypto.randomUUID();
      const created = await callFunction<GatewayResult>("instant-api-gateway", {
        action: "create_order", serviceSlug: selected.slug, input, consent: true,
        authorisedUse: true, lawfulPurpose, idempotencyKey,
      });
      if (!created.orderId || !created.retrievalToken || !created.razorpayOrderId || !created.keyId || !created.amount) throw new Error("The payment order could not be prepared.");
      setOrderRef(created.serviceReference || created.orderId!);
      setOrderStatus("payment_pending");
      setRetrievalToken(created.retrievalToken);
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Secure payment checkout is unavailable.");
      const checkout = new window.Razorpay({
        key: created.keyId, amount: created.amount, currency: created.currency || "INR",
        name: "BABA'S CYBER CAFE", description: selected.name, order_id: created.razorpayOrderId,
        theme: { color: "#087fba" },
        handler: async (payment: Record<string, string>) => {
          setBusy(true);
          try {
            const verified = await callFunction<GatewayResult>("instant-api-gateway", {
              action: "verify_payment", orderId: created.orderId, retrievalToken: created.retrievalToken,
              razorpayOrderId: payment.razorpay_order_id, razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySignature: payment.razorpay_signature,
            });
            setOrderRef(verified.serviceReference || created.serviceReference || created.orderId!); setOrderStatus(verified.status || "processing");
            if (verified.status === "succeeded") {
              const fetched = await callFunction<GatewayResult>("instant-api-gateway", { action: "retrieve_order", orderId: created.orderId, retrievalToken: created.retrievalToken });
              setResult(fetched.result ?? null);
            } else setNotice("Payment was verified. Your request is being checked; keep your order reference.");
          } catch (reason) { setError(reason instanceof Error ? reason.message : "Payment verification is pending. Do not pay again."); setOrderRef(created.serviceReference || created.orderId!); setRetrievalToken(created.retrievalToken!); }
          finally { setBusy(false); }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.open();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout could not be started.");
    } finally { setBusy(false); }
  }

  return (
    <main className="ia-customer">
      <section className="iac-hero"><div className="iac-shell">
        <div className="iac-brand"><span className="iac-mark"><ShieldCheck size={22}/></span><span>BABA'S CYBER CAFE<small>INSTANT DIGITAL SERVICES</small></span><span className="iac-secure"><BadgeCheck size={14}/> Secure service desk</span></div>
        <div className="iac-hero-copy"><span className="iac-eyebrow">SIMPLE · CLEAR · SECURE</span><h1>Digital services,<br/><em>made simpler.</em></h1><p>Choose a service, review the price and requirements, and follow your request from one place.</p><div className="iac-hero-actions"><a href="#instant-catalogue" className="iac-primary">Explore services <ArrowRight size={16}/></a><Link to="/track" className="iac-secondary">Track an application</Link><a href="#instant-api-case-desk" className="iac-secondary">Track E-Service / Refund</a></div></div>
        <div className="iac-search-wrap"><Search size={19}/><input aria-label="Search Instant API services" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search PAN, vehicle, voter, licence services…"/></div>
      </div></section>
      <section className="iac-shell iac-content" id="instant-catalogue">
        <div className="iac-section-head"><div><span className="iac-eyebrow">SERVICE DIRECTORY</span><h2>Choose your service</h2><p>Prices are displayed before secure checkout. Submit only information you are authorised to use.</p></div><span className="iac-count">{services.length} services</span></div>
        {notice && <div className="iac-notice" role="status"><CircleHelp size={18}/><span>{notice}</span></div>}
        {loading && <div className="iac-loading" role="status"><LoaderCircle className="iac-spin" size={18}/> Checking secure catalogue…</div>}
        {!loading && visible.length === 0 && <div className="iac-empty"><Search size={24}/><b>No available services</b><span>Try another search term or check again later.</span></div>}
        <div className="iac-cards">{visible.map(service => { const Icon = iconFor(service.slug); return <article className="iac-card" key={service.slug}>
          <div className="iac-card-top"><span className="iac-icon"><Icon size={22}/></span>{service.is_featured && <span className="iac-featured">POPULAR</span>}</div>
          <h3>{service.name}</h3><p>{service.description}</p><div className="iac-price"><small>Customer price</small><strong>{money(Number(service.customer_price))}</strong></div>
          <div className="iac-card-foot"><span className="iac-status"><CheckCircle2 size={14}/> Available</span><button type="button" onClick={() => openService(service)}>Continue <ArrowRight size={15}/></button></div>
        </article>; })}</div>
        <section className="iac-steps"><div><span className="iac-eyebrow">HOW IT WORKS</span><h2>Five clear steps</h2></div><div className="iac-step-grid">{[{n:"01",t:"Choose a service",d:"Select the service you need."},{n:"02",t:"Enter details",d:"Provide only the required information."},{n:"03",t:"Review and consent",d:"Confirm your authorised use."},{n:"04",t:"Pay securely",d:"Complete Razorpay checkout."},{n:"05",t:"Receive your result",d:"View your result securely for a limited time."}].map(step => <div className="iac-step" key={step.n}><b>{step.n}</b><strong>{step.t}</strong><span>{step.d}</span></div>)}</div></section>
        <section className="iac-privacy"><ShieldCheck size={20}/><div><b>Your information deserves care</b><p>Only submit information you are authorised to use. Never share OTPs, passwords, UPI PINs or payment PINs. This is an independent private service and is not a government website.</p></div></section>
        <div className="iac-bottom-actions"><Link to="/track"><Search size={17}/> Track an existing application</Link><a href="https://wa.me/917006865909?text=Hello%20BABA%27S%20CYBER%20CAFE%2C%20I%20need%20help%20with%20Instant%20Services." target="_blank" rel="noreferrer"><MessageCircle size={17}/> WhatsApp support</a></div>
        <div id="instant-api-case-desk"><InstantApiCustomerCaseDesk /></div>
      </section>
      {selected && <div className="ia-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setSelected(null); }}>
        <section className="ia-modal" role="dialog" aria-modal="true" aria-labelledby="ia-modal-title">
          <header><div><span className="iac-eyebrow">SECURE SERVICE REQUEST</span><h2 id="ia-modal-title">{selected.name}</h2><p>{money(Number(selected.customer_price))} · Payment through Razorpay</p></div><button type="button" aria-label="Close" onClick={() => setSelected(null)} disabled={busy}><X size={20}/></button></header>
          {error && <div className="ia-alert ia-error" role="alert">{error}</div>}
          {orderRef && <div className="ia-alert ia-success" role="status">E-Service ID: <b>{orderRef}</b> · Status: {orderStatus || "payment verification pending"}{retrievalToken && <><br/>Secure tracking code: <b>{retrievalToken}</b> · Save both details for future queries.</>}</div>}
          {orderRef && retrievalToken && <InstantApiCustomerCaseDesk initialReference={orderRef} initialToken={retrievalToken} />}
          {result !== null ? <div className="ia-result"><h3>Service result</h3>{pdfBase64 && <a className="ia-pdf-download" href={`data:application/pdf;base64,${pdfBase64}`} download="BABA-CYBER-CAFE-document.pdf">Download PDF document</a>}{pdfUrl && <a className="ia-pdf-download" href={pdfUrl} target="_blank" rel="noreferrer">Open PDF document</a>}<pre>{JSON.stringify(resultObject ? Object.fromEntries(Object.entries(resultObject).filter(([key]) => !["pdf", "pdf_base64"].includes(key) && !/(?:provider.?cost|cost.?deducted|remaining.?balance|wallet|profit|margin|commission|api.?balance|account.?balance|credit.?balance)/i.test(key))) : result, null, 2)}</pre></div> :
          <form onSubmit={checkout}>
            {(fields[selected.slug] || []).map(field => <label className="ia-field" key={field.name}><span>{field.label}</span><input required={!field.label.includes("optional")} type={field.type || "text"} autoComplete="off" value={input[field.name] || ""} placeholder={field.placeholder} onChange={event => setInput(current => ({ ...current, [field.name]: event.target.value }))}/></label>)}
            <label className="ia-field"><span>Purpose of request</span><textarea required minLength={8} maxLength={300} value={lawfulPurpose} onChange={event => setLawfulPurpose(event.target.value)} placeholder="Briefly explain why you are requesting this record"/></label>
            <label className="ia-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/><span>I confirm I am the data subject or have valid authority and consent to submit these details for this service. I understand this is a private service, not a government portal.</span></label>
            <button className="ia-button" type="submit" disabled={busy || !consent}>{busy ? <><LoaderCircle className="iac-spin" size={16}/> Preparing secure checkout…</> : <>Continue to pay {money(Number(selected.customer_price))} <ArrowRight size={16}/></>}</button>
            <p className="ia-small-note">Your submitted details are encrypted before storage and sent to the provider only after verified payment.</p>
          </form>}
        </section>
      </div>}
    </main>
  );
}
