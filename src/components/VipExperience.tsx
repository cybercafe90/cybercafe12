import { useMemo, useState } from "react";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, CarFront,
  CheckCircle2, ChevronDown, Clock3, FileCheck2, HeartHandshake,
  Landmark, LockKeyhole, MessageCircle, Search, ShieldCheck, Sparkles,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

const signatureServices = [
  { icon: Landmark, title: "Revenue & civic services", copy: "Guidance for certificates, records, municipal and public-service applications.", href: "/services/revenue", tag: "DOCUMENT SUPPORT" },
  { icon: CarFront, title: "RTO & vehicle desk", copy: "Vehicle registration services and instant challan lookups.", href: "/instant-services", tag: "VEHICLE SERVICES" },
  { icon: ShieldCheck, title: "Insurance centre", copy: "Motor insurance enquiries, policy guidance and quotation assistance.", href: "/insurance", tag: "INSURANCE" },
  { icon: FileCheck2, title: "Digital documentation", copy: "Support with PAN, ABHA, MSME, licences and other online service requests.", href: "/services", tag: "ONLINE APPLICATIONS" },
];

const steps = [
  ["01", "Choose your service", "Explore the service directory and check the document guidance."],
  ["02", "Send your enquiry", "Share the details needed for your request through the online form."],
  ["03", "Team review", "Our team reviews the request and contacts you about next steps and any applicable charges."],
  ["04", "Track updates", "Use your reference ID and registered mobile number to check progress."],
];

const commitments = [
  { icon: HeartHandshake, title: "Human support", copy: "A real service desk to help explain the next step, not confusing automated promises." },
  { icon: LockKeyhole, title: "Privacy-minded", copy: "We aim to handle customer information carefully and use configured secure systems for online requests." },
  { icon: BadgeCheck, title: "Clear and transparent", copy: "No hidden public price list, no false guarantees and no claim of government affiliation." },
];

const faqs = [
  { group: "Applications", q: "How do I submit a new application enquiry?", a: "Open the Services Hub, select the relevant department and service, review the document guidance, then use Start an Application. Our team will review the enquiry and contact you about the next steps." },
  { group: "Applications", q: "Will I receive a tracking reference?", a: "When an online request is successfully recorded by the configured application system, a reference is shown or shared. Keep it private and use it with your registered mobile number on the Track page." },
  { group: "Tracking", q: "How can I check my application status?", a: "Open Track Application, enter your reference ID and registered mobile number, and submit. If the details do not work, contact the service desk for help." },
  { group: "Payments", q: "Are service prices displayed on the website?", a: "No. We do not publish service rates on the website. Our team will confirm any applicable service or official charges after reviewing your request. Always verify payment details before paying." },
  { group: "Documents", q: "Which documents should I upload?", a: "The checklist depends on the selected service and the rules of the relevant authority. Read the service page carefully and confirm any current official requirements before submitting sensitive documents." },
  { group: "Insurance", q: "Can I request a motor insurance quotation?", a: "Yes. Visit the Insurance Centre or contact us on WhatsApp. A quotation depends on vehicle and policy details and is subject to insurer terms and availability." },
  { group: "Support", q: "How do I contact BABA'S CYBER CAFE?", a: "Call or WhatsApp +91 7006865909, or email support@babacybercafe.in. You can also use the Contact page." },
  { group: "Trust & safety", q: "Is BABA'S CYBER CAFE a government office?", a: "No. BABA'S CYBER CAFE is an independent digital assistance business in Srinagar. It is not a government department or an authorised government service centre. Official authorities make all decisions and issue official documents." },
  { group: "Trust & safety", q: "Does submitting an enquiry guarantee approval?", a: "No. An enquiry or assistance request is not an approval. Eligibility, processing, fees and final decisions are controlled by the relevant department, insurer or service provider." },
];

export function VipHomeExperience() {
  return (
    <div className="vip-experience">
      <section className="vip-signature-section">
        <div className="vip-section-heading">
          <span className="vip-kicker"><Sparkles size={14}/> THE BABA'S STANDARD</span>
          <h2>More than a cyber cafe.<br/><em>Your digital service partner.</em></h2>
          <p>One organised place for service discovery, application assistance, insurance enquiries and progress updates.</p>
        </div>
        <div className="vip-signature-grid">
          {signatureServices.map(({ icon: Icon, title, copy, href, tag }) => (
            <Link to={href} className="vip-signature-card" key={title}>
              <span className="vip-card-icon"><Icon size={22}/></span>
              <small>{tag}</small>
              <h3>{title}</h3>
              <p>{copy}</p>
              <span className="vip-card-link">Explore <ArrowUpRight size={15}/></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="vip-process-section">
        <div className="vip-section-heading vip-centered">
          <span className="vip-kicker"><Zap size={14}/> SIMPLE BY DESIGN</span>
          <h2>Your request, <em>step by step.</em></h2>
          <p>A clear journey from choosing a service to receiving an update.</p>
        </div>
        <div className="vip-process-grid">
          {steps.map(([number, title, copy]) => (
            <article className="vip-process-card" key={number}>
              <span>{number}</span><h3>{title}</h3><p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="vip-commitment-section">
        <div className="vip-section-heading">
          <span className="vip-kicker"><ShieldCheck size={14}/> BUILT AROUND TRUST</span>
          <h2>Premium service means<br/><em>getting the basics right.</em></h2>
        </div>
        <div className="vip-commitment-grid">
          {commitments.map(({ icon: Icon, title, copy }) => (
            <article className="vip-commitment-card" key={title}>
              <Icon size={23}/><h3>{title}</h3><p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="vip-about-banner">
        <div className="vip-about-emblem"><BriefcaseBusiness size={30}/></div>
        <div><span className="vip-kicker">ROOTED IN SRINAGAR · JAMMU &amp; KASHMIR</span><h2>Local understanding. A more organised digital experience.</h2><p>Meet the team, learn about our role and understand how we support your service journey.</p></div>
        <Link className="vip-gold-button" to="/about">Discover our story <ArrowRight size={16}/></Link>
      </section>
    </div>
  );
}

export function VipAboutExperience() {
  return (
    <div className="vip-about-extra">
      <section className="vip-about-mission">
        <div><span className="vip-kicker"><Sparkles size={14}/> OUR PURPOSE</span><h2>Making everyday digital tasks feel <em>more manageable.</em></h2></div>
        <p>We bring service discovery, document guidance and customer communication together in one convenient digital experience. Our aim is to make the next step easier to understand while respecting each customer's time and information.</p>
      </section>
      <section className="vip-about-values">
        {commitments.map(({ icon: Icon, title, copy }) => <article key={title}><Icon size={22}/><h3>{title}</h3><p>{copy}</p></article>)}
      </section>
      <section className="vip-about-journey">
        <div><span className="vip-kicker">HOW WE WORK</span><h2>Helpful guidance.<br/><em>Honest expectations.</em></h2><p>We help customers navigate online service steps and prepare enquiries. We do not control government or insurer decisions, official processing timelines or eligibility.</p></div>
        <ul><li><CheckCircle2 size={17}/> Service information in one place</li><li><CheckCircle2 size={17}/> Enquiry and application assistance</li><li><CheckCircle2 size={17}/> Reference-based progress tracking where available</li><li><CheckCircle2 size={17}/> Direct contact with our service desk</li></ul>
      </section>
      <section className="vip-about-cta"><div><span className="vip-kicker">WE'RE HERE TO HELP</span><h2>Have a service in mind?</h2><p>Explore the directory or speak with our team before you begin.</p></div><Link className="vip-gold-button" to="/services">Explore services <ArrowRight size={16}/></Link></section>
    </div>
  );
}

export function VipFaqPage() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const groups = ["All", ...Array.from(new Set(faqs.map((item) => item.group)))];
  const filtered = useMemo(() => faqs.filter((item) => (group === "All" || item.group === group) && (item.q + " " + item.a).toLowerCase().includes(query.toLowerCase().trim())), [group, query]);
  return (
    <main className="vip-faq-page">
      <header className="vip-faq-hero"><span className="vip-kicker"><MessageCircle size={14}/> CUSTOMER HELP DESK</span><h1>Questions, <em>answered.</em></h1><p>Find clear guidance about applications, tracking, payments, documents and our service.</p><label className="vip-faq-search"><Search size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a question or topic..." aria-label="Search frequently asked questions"/></label></header>
      <div className="vip-faq-layout">
        <nav className="vip-faq-filters" aria-label="FAQ categories">{groups.map((item) => <button type="button" key={item} className={group === item ? "is-active" : ""} onClick={() => setGroup(item)}>{item}</button>)}</nav>
        <section className="vip-faq-list" aria-live="polite">{filtered.length ? filtered.map((item, index) => <details className="vip-faq-entry" key={item.q} open={index === 0 && Boolean(query)}><summary>{item.q}<ChevronDown size={18}/></summary><p>{item.a}</p></details>) : <div className="vip-faq-empty"><Search size={24}/><h3>No matching questions</h3><p>Try a different keyword or choose another category.</p></div>}</section>
      </div>
      <section className="vip-faq-contact"><div><span className="vip-kicker">STILL NEED HELP?</span><h2>Talk to our service desk.</h2><p>Call +91 7006865909 or send us a WhatsApp message.</p></div><a className="vip-gold-button" href="https://wa.me/917006865909" target="_blank" rel="noreferrer">Chat on WhatsApp <ArrowUpRight size={16}/></a></section>
      <p className="vip-faq-disclaimer"><Clock3 size={14}/> Information is general guidance. Service requirements and official decisions may change; confirm details with the relevant authority.</p>
    </main>
  );
}
