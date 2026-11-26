import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, CarFront, CheckCircle2, CircleHelp, CreditCard, FileCheck2, IdCard, LoaderCircle, MessageCircle, Search, ShieldCheck, Vote } from "lucide-react";
import { Link } from "react-router-dom";
import { callFunction } from "../lib/supabase";
import "./InstantApiCustomerPortal.css";

type Service = {
  slug: string;
  name: string;
  description: string;
  customer_price: number;
  is_enabled: boolean;
  is_featured?: boolean;
  sort_order?: number;
};

const fallbackServices: Service[] = [
  { slug: "voter-mobile-link", name: "Voter Mobile Link", description: "Check the mobile-link service for an eligible voter record.", customer_price: 80, is_enabled: false },
  { slug: "aadhaar-to-pan", name: "Aadhaar to PAN", description: "Request an Aadhaar-to-PAN lookup where you are legally authorised.", customer_price: 50, is_enabled: false },
  { slug: "pan-verification", name: "PAN Verification", description: "Verify PAN details for a permitted purpose.", customer_price: 60, is_enabled: false },
  { slug: "vehicle-rc-pdf", name: "Vehicle RC PDF", description: "Request a vehicle registration certificate document.", customer_price: 90, is_enabled: false },
  { slug: "mobile-number-details", name: "Mobile Number Details", description: "Request mobile-number information only where you have lawful authority.", customer_price: 70, is_enabled: false },
  { slug: "dl-hd-pdf", name: "DL HD PDF", description: "Request a driving licence document using the required details.", customer_price: 50, is_enabled: false },
  { slug: "vahan-to-mobile", name: "Vahan to Mobile", description: "Request a vehicle-to-mobile lookup for an authorised purpose.", customer_price: 150, is_enabled: false },
  { slug: "voter-status", name: "Voter Status", description: "Check voter application status where access is permitted.", customer_price: 40, is_enabled: false },
];

const iconFor = (slug: string) => slug.includes("voter") ? Vote : slug.includes("vehicle") || slug.includes("vahan") ? CarFront : slug.includes("pan") ? CreditCard : slug.includes("licence") ? IdCard : FileCheck2;
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export default function InstantApiCustomerPortal() {
  const [services, setServices] = useState<Service[]>(fallbackServices);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [catalogueAvailable, setCatalogueAvailable] = useState(false);
  const [notice, setNotice] = useState("Instant lookup checkout is being prepared. Services remain unavailable until the secure gateway is tested and activated.");

  useEffect(() => {
    let active = true;
    callFunction<{ services?: Service[] }>("instant-api-gateway", { action: "catalog" })
      .then((result) => {
        if (!active || !Array.isArray(result.services)) return;
        const safe = result.services.filter((item) =>
          typeof item.slug === "string" && typeof item.name === "string" &&
          typeof item.description === "string" && Number.isFinite(Number(item.customer_price)) &&
          item.is_enabled === true
        );
        setServices(safe);
        setCatalogueAvailable(true);
        setNotice(safe.length ? "" : "No Instant API services are currently enabled. Please check again later.");
      })
      .catch(() => {
        if (active) setNotice("Secure service catalogue is not connected yet. These service previews are informational; checkout is not available.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return services.filter((service) => !term || [service.name, service.description, service.slug].join(" ").toLowerCase().includes(term));
  }, [query, services]);

  return (
    <main className="ia-customer">
      <section className="iac-hero">
        <div className="iac-shell">
          <div className="iac-brand"><span className="iac-mark"><ShieldCheck size={22}/></span><span>BABA'S CYBER CAFE<small>INSTANT DIGITAL SERVICES</small></span><span className="iac-secure"><BadgeCheck size={14}/> Secure service desk</span></div>
          <div className="iac-hero-copy">
            <span className="iac-eyebrow">SIMPLE · CLEAR · SECURE</span>
            <h1>Digital services,<br/><em>made simpler.</em></h1>
            <p>Choose a service, review the price and requirements, and follow your request from one place.</p>
            <div className="iac-hero-actions"><a href="#instant-catalogue" className="iac-primary">Explore services <ArrowRight size={16}/></a><Link to="/track" className="iac-secondary">Track an application</Link></div>
          </div>
          <div className="iac-search-wrap"><Search size={19}/><input aria-label="Search Instant API services" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search PAN, vehicle, voter, licence services…"/></div>
        </div>
      </section>

      <section className="iac-shell iac-content" id="instant-catalogue">
        <div className="iac-section-head"><div><span className="iac-eyebrow">SERVICE DIRECTORY</span><h2>Choose your service</h2><p>Prices are shown before checkout. Final availability depends on authorisation and provider status.</p></div><span className="iac-count">{services.length} services</span></div>
        {notice && <div className="iac-notice" role="status"><CircleHelp size={18}/><span>{notice}</span></div>}
        {loading && <div className="iac-loading" role="status"><LoaderCircle className="iac-spin" size={18}/> Checking secure catalogue…</div>}
        {!loading && visible.length === 0 && <div className="iac-empty"><Search size={24}/><b>No matching services</b><span>Try another search term.</span></div>}
        <div className="iac-cards">
          {visible.map((service) => {
            const Icon = iconFor(service.slug);
            const ready = catalogueAvailable && service.is_enabled;
            return <article className="iac-card" key={service.slug}>
              <div className="iac-card-top"><span className="iac-icon"><Icon size={22}/></span>{service.is_featured && <span className="iac-featured">POPULAR</span>}</div>
              <h3>{service.name}</h3><p>{service.description}</p>
              <div className="iac-price"><small>Customer price</small><strong>{money(Number(service.customer_price))}</strong></div>
              <div className="iac-card-foot">{ready ? <span className="iac-status"><CheckCircle2 size={14}/> Available</span> : <span className="iac-status iac-status-off">Not yet available</span>}<button type="button" disabled={!ready} title="Secure checkout will be enabled after gateway verification">Continue <ArrowRight size={15}/></button></div>
            </article>;
          })}
        </div>
        <section className="iac-steps"><div><span className="iac-eyebrow">HOW IT WORKS</span><h2>Five clear steps</h2></div><div className="iac-step-grid">{[{n:"01",t:"Choose a service",d:"Select the service you need."},{n:"02",t:"Enter details",d:"Provide only the required information."},{n:"03",t:"Review and consent",d:"Check the price and authorised-use declaration."},{n:"04",t:"Pay securely",d:"Use the protected payment checkout."},{n:"05",t:"Track your result",d:"Use your private order reference to check progress."}].map(step => <div className="iac-step" key={step.n}><b>{step.n}</b><strong>{step.t}</strong><span>{step.d}</span></div>)}</div></section>
        <section className="iac-privacy"><ShieldCheck size={20}/><div><b>Your information deserves care</b><p>Only submit information you are authorised to use. Never share OTPs, passwords, UPI PINs or payment PINs. This is an independent private service and is not a government website.</p></div></section>
        <div className="iac-bottom-actions"><Link to="/track"><Search size={17}/> Track an existing application</Link><a href="https://wa.me/917006865909?text=Hello%20BABA%27S%20CYBER%20CAFE%2C%20I%20need%20help%20with%20Instant%20Services." target="_blank" rel="noreferrer"><MessageCircle size={17}/> WhatsApp support</a></div>
      </section>
    </main>
  );
}
