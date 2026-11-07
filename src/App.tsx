import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Papa from "papaparse";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileText,
  Globe2,
  HeartHandshake,
  Instagram,
  Landmark,
  LockKeyhole,
  MapPin,
  Menu,
  MessageCircle,
  PhoneCall,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Ticket,
  UsersRound,
  X,
  Zap,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  categories,
  categoryName,
  seedServices,
  statusLabels,
  type ApplicationStatus,
  type Category,
  type ServiceRecord,
} from "./data";
import { callFunction, clearPasswordRecoveryPending, hasPendingPasswordRecovery, isSupabaseConfigured, supabase } from "./lib/supabase";
import InvestigationPage from "./pages/InvestigationPage";
import GrievancePage from "./pages/GrievancePage";
import AdminGrievancePage from "./pages/AdminGrievancePage";
import PaymentPortal from "./pages/PaymentPortal";
import CustomerChatAssistant from "./components/CustomerChatAssistant";
import "./App.css";

const phone = "+91 7006865909";
const email = "support@babacybercafe.in";
const whatsapp = "917006865909";
const facebook = "https://www.facebook.com/babascybercafe";
const businessProfile = "https://share.google/0zqTy0GylWp6CnSYO";
const instagramProfile = "https://www.instagram.com/babascybercafe/";

function useCategoryList(activeOnly = true) {
  const [items, setItems] = useState<Category[]>(categories);
  useEffect(() => {
    if (!supabase) return;
    let current = true;
    const load = () => {
      let query = supabase!
        .from("service_categories")
        .select("slug, name, description, icon, is_active, sort_order")
        .order("sort_order");
      if (activeOnly) query = query.eq("is_active", true);
      void query.then(({ data }) => {
        if (current && data) setItems(data as Category[]);
      });
    };
    const refresh = () => load();
    load();
    window.addEventListener("catalog-updated", refresh);
    return () => {
      current = false;
      window.removeEventListener("catalog-updated", refresh);
    };
  }, [activeOnly]);
  return items;
}

function categoryLabel(slug: string, items: Category[]) {
  return items.find((item) => item.slug === slug)?.name ?? categoryName(slug);
}

type SiteSettings = {
  announcement: { enabled: boolean; text: string };
  homepage: { eyebrow: string; headline: string; description: string };
  contact: { phone: string; whatsapp: string; email: string };
  social: { facebook: string; business_profile: string; instagram: string };
};

const defaultSiteSettings: SiteSettings = {
  announcement: { enabled: false, text: "" },
  homepage: {
    eyebrow: "LOCAL SERVICE · SRINAGAR, J&K",
    headline: "Everyday services|made simpler.",
    description:
      "Friendly help with digital applications, documents and service enquiries, all in one place.",
  },
  contact: { phone, whatsapp, email },
  social: { facebook, business_profile: businessProfile, instagram: instagramProfile },
};

function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings);
  useEffect(() => {
    if (!supabase) return;
    let current = true;
    const loadSettings = async () => {
      const { data } = await supabase!
        .from("website_settings")
        .select("key, value")
        .in("key", [
          "homepage_announcement",
          "homepage_content",
          "contact",
          "social_links",
        ])
        .eq("is_public", true);
      if (!current || !data) return;
      const values = Object.fromEntries(
        data.map((item) => [item.key, item.value as Record<string, unknown>]),
      );
      const announcement = values.homepage_announcement ?? {};
      const homepage = values.homepage_content ?? {};
      const contact = values.contact ?? {};
      const social = values.social_links ?? {};
      setSettings({
        announcement: {
          enabled: announcement.enabled === true,
          text: typeof announcement.text === "string" ? announcement.text : "",
        },
        homepage: {
          eyebrow:
            typeof homepage.eyebrow === "string"
              ? homepage.eyebrow
              : defaultSiteSettings.homepage.eyebrow,
          headline:
            typeof homepage.headline === "string"
              ? homepage.headline
              : defaultSiteSettings.homepage.headline,
          description:
            typeof homepage.description === "string"
              ? homepage.description
              : defaultSiteSettings.homepage.description,
        },
        contact: {
          phone: typeof contact.phone === "string" ? contact.phone : phone,
          whatsapp:
            typeof contact.whatsapp === "string" ? contact.whatsapp : whatsapp,
          email: typeof contact.email === "string" ? contact.email : email,
        },
        social: {
          facebook:
            typeof social.facebook === "string" ? social.facebook : facebook,
          business_profile:
            typeof social.business_profile === "string"
              ? social.business_profile
              : businessProfile,
          instagram:
            typeof social.instagram === "string" && social.instagram.trim()
              ? social.instagram
              : instagramProfile,
        },
      });
    };
    const refresh = () => {
      void loadSettings();
    };
    void loadSettings();
    window.addEventListener("site-settings-updated", refresh);
    return () => {
      current = false;
      window.removeEventListener("site-settings-updated", refresh);
    };
  }, []);
  return settings;
}

function ConfigurationNote({
  children = "Secure online submissions are not configured yet. Please contact the cafe directly.",
}: {
  children?: string;
}) {
  return (
    <div className="notice notice-warn" role="status">
      <CircleHelp size={17} />
      {children}
    </div>
  );
}

function Header() {
  const settings = useSiteSettings();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <div className="topline">
        <span>Srinagar, Jammu &amp; Kashmir</span>
        <a href={`tel:${settings.contact.phone.replace(/[^+\d]/g, "")}`}>
          {settings.contact.phone}
        </a>
        <span>Independent digital assistance</span>
      </div>
      <header className="site-header">
        <Link
          to="/"
          className="brand"
          onClick={close}
          aria-label="Baba's Cyber Cafe home"
        >
          <span className="brand-mark"><ShieldCheck size={24}/><LockKeyhole className="brand-keyhole" size={10}/></span>
          <span className="brand-name">
            BABA'S <small>CYBER CAFE · SERVICE CENTRE · SRINAGAR</small>
          </span>
        </Link>
        <button
          className="icon-button menu-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
          <NavLink to="/services" onClick={close}>Services Hub</NavLink>
          <NavLink to="/dashboard" onClick={close}>Security Vault</NavLink>
          <NavLink to="/track" onClick={close}>Track Reference</NavLink>
          <NavLink to="/about" onClick={close}>About</NavLink>
          <NavLink to="/contact" onClick={close}>Direct Contact</NavLink>
          <Link className="nav-button" to="/track" onClick={close}>Track Application <ArrowUpRight size={15}/></Link>
        </nav>
      </header>
    </>
  );
}

function Footer() {
  const settings = useSiteSettings();
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link to="/" className="brand">
            <span className="brand-mark"><ShieldCheck size={24}/><LockKeyhole className="brand-keyhole" size={10}/></span>
            <span className="brand-name">
              BABA'S <small>CYBER CAFE</small>
            </span>
          </Link>
          <p>Thoughtful digital assistance, rooted in Srinagar.</p>
        </div>
        <div>
          <h3>Explore</h3>
          <Link to="/services">All services</Link>
          <Link to="/services/insurance">Insurance services</Link>
          <Link to="/about">About us</Link>
          <Link to="/contact">Contact</Link>
        </div>
        <div>
          <h3>Your applications</h3>
          <Link to="/apply">New enquiry</Link>
          <Link to="/track">Track an application</Link>
          <Link to="/pay">Make a payment</Link>
          <Link to="/dashboard">Customer dashboard</Link>
          <Link to="/admin/login">Admin sign-in</Link>
          <Link to="/investigation">Investigation portal</Link>
          <Link to="/grievance">Grievance redressal</Link>
        </div>
        <div>
          <h3>Reach us</h3>
          <a href={`tel:${settings.contact.phone.replace(/[^+\d]/g, "")}`}>
            {settings.contact.phone}
          </a>
          <a href={`mailto:${settings.contact.email}`}>
            {settings.contact.email}
          </a>
          <a
            href={`https://wa.me/${settings.contact.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp <ArrowUpRight size={13} />
          </a>
          <a
            href={settings.social.business_profile}
            target="_blank"
            rel="noreferrer"
          >
            Google Business Profile <ArrowUpRight size={13} />
          </a>
          {settings.social.instagram && (
            <a
              href={settings.social.instagram}
              target="_blank"
              rel="noreferrer"
            >
              Instagram <ArrowUpRight size={13} />
            </a>
          )}
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} BABA'S CYBER CAFE · Srinagar, J&amp;K
        </span>
        <div>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <a href={settings.social.facebook} target="_blank" rel="noreferrer">
            Facebook
          </a>
          {settings.social.instagram && (
            <a
              href={settings.social.instagram}
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
          )}
        </div>
      </div>
      <p className="independence-note">
        BABA'S CYBER CAFE is an independent assistance business, not a
        government office or an authorised government service centre. Official
        authorities make all application decisions.
      </p>
    </footer>
  );
}

function PageIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="page-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{copy}</p>
    </div>
  );
}

function HomePage() {
  const settings = useSiteSettings();
  const navigate = useNavigate();
  const [quickReference, setQuickReference] = useState("");
  const [selectedService, setSelectedService] = useState("revenue");
  const [trackingId, setTrackingId] = useState("");
  const [trackingMobile, setTrackingMobile] = useState("");
  const [trackingRecord, setTrackingRecord] = useState<TrackedRecord | null>(null);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const [localFiles, setLocalFiles] = useState<{id:string;name:string;size:number;valid:boolean;message:string;preview?:string}[]>([]);
  const [dragging, setDragging] = useState(false);

  const departments = [
    { slug: "revenue", title: "Revenue Department", detail: "Land records, Jamabandi, mutations" },
    { slug: "smc", title: "Srinagar Municipal Corporation", detail: "Trade licences, birth and death assistance" },
    { slug: "rto", title: "RTO & Transport", detail: "Driving licence, vehicle transfer, permits" },
    { slug: "labour", title: "Labour & Employment", detail: "e-Shram and eligible artisan schemes" },
    { slug: "handloom", title: "Handloom & Handicrafts", detail: "Artisan identification and handloom support" },
    { slug: "central", title: "Central & National Services", detail: "PAN, passport and health-scheme assistance" },
  ];

  const inspectFiles = (incoming: FileList | File[]) => {
    Array.from(incoming).slice(0, 8).forEach((file) => {
      const id = `${file.name}-${file.lastModified}-${file.size}`;
      const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type);
      const underLimit = file.size <= 10 * 1024 * 1024;
      const valid = allowed && underLimit;
      const item = {
        id, name: file.name, size: file.size, valid,
        message: !allowed ? "Use PDF, JPG, PNG or WebP." : !underLimit ? "File exceeds the 10 MB limit." : "Format and size check passed.",
      };
      setLocalFiles((current) => [...current.filter((entry) => entry.id !== id), item]);
      if (valid && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => setLocalFiles((current) => current.map((entry) => entry.id === id ? { ...entry, preview: String(reader.result ?? "") } : entry));
        reader.readAsDataURL(file);
      }
    });
  };

  async function lookupApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTrackingBusy(true);
    setTrackingError("");
    setTrackingRecord(null);
    try {
      setTrackingRecord(await callFunction<TrackedRecord>("track-application", { trackingId, mobile: trackingMobile }));
    } catch (reason) {
      setTrackingError(reason instanceof Error ? reason.message : "We could not verify those details. Please check and try again.");
    } finally {
      setTrackingBusy(false);
    }
  }

  const currentStage = !trackingRecord ? -1 :
    trackingRecord.status === "Completed" || trackingRecord.status === "Rejected" ? 3 :
    trackingRecord.status === "Under Review" ? 2 :
    trackingRecord.status === "Documents Required" ? 1 : 0;

  return (
    <main className="cyber-home">
      {settings.announcement.enabled && settings.announcement.text && (
        <div className="cyber-announcement"><BadgeCheck size={15}/>{settings.announcement.text}</div>
      )}
      <section className="cyber-hero">
        <div className="cyber-hero-grid"/>
        <div className="cyber-hero-copy">
          <span className="cyber-eyebrow"><i/> DIGITAL CIVIC INFRASTRUCTURE · SECURE DOCUMENT ASSISTANCE</span>
          <h1>Smart Civic Assistance.<br/><em>Digitalized &amp; Secure.</em></h1>
          <p>Fast, friendly documentation and application assistance for Srinagar Municipal Corporation, Revenue, RTO, welfare schemes and more.</p>
          <div className="cyber-hero-actions">
            <Link className="cyber-button cyber-button-primary" to="/services">Explore Services <ArrowRight size={16}/></Link>
            <Link className="cyber-button cyber-button-ghost" to="/apply">Start an Application <ArrowUpRight size={16}/></Link>
          </div>
          <div className="cyber-trust-line"><ShieldCheck size={15}/> Independent assistance · Clear updates · Customer-first support</div>
        </div>
        <div className="cyber-hero-visual" aria-label="Animated cyber shield emblem">
          <div className="cyber-orbit cyber-orbit-a"/><div className="cyber-orbit cyber-orbit-b"/>
          <div className="cyber-shield-card">
            <div className="cyber-card-top"><span><i/> SYSTEM ONLINE</span><span>BBC / SRN</span></div>
            <div className="cyber-shield-emblem"><span className="shield-aura"/><ShieldCheck size={112} strokeWidth={1.1}/><LockKeyhole className="shield-lock" size={30}/></div>
            <div className="cyber-card-bottom"><span>SECURE SERVICE DESK</span><b>SRINAGAR · J&amp;K</b></div>
            <div className="cyber-circuit circuit-one"/><div className="cyber-circuit circuit-two"/>
          </div>
          <span className="cyber-float-tag"><Activity size={13}/> DIGITAL SERVICE NETWORK</span>
          <span className="cyber-float-code">01 / 06 &nbsp; · &nbsp; VERIFIED WORKFLOW</span>
        </div>
        <div className="cyber-hero-bottom"><span>01 — LOCAL SERVICE DESK</span><span>ASSISTANCE · DOCUMENTATION · TRACKING</span></div>
      </section>

      <section className="cyber-command-wrap">
        <div className="cyber-command-intro"><span className="cyber-eyebrow">QUICK COMMAND</span><h2>Where would you like to go?</h2></div>
        <div className="cyber-command-grid">
          <form className="cyber-command-card" onSubmit={(event) => { event.preventDefault(); navigate(`/track?trackingId=${encodeURIComponent(quickReference.trim())}`); }}>
            <span className="cyber-command-icon"><Search size={18}/></span>
            <label htmlFor="quick-reference">Track by reference ID</label>
            <div className="cyber-command-input"><input id="quick-reference" value={quickReference} onChange={(event)=>setQuickReference(event.target.value.toUpperCase())} placeholder="Enter tracking reference" maxLength={32} required/><button aria-label="Continue to tracking"><ArrowRight size={17}/></button></div>
          </form>
          <div className="cyber-command-card">
            <span className="cyber-command-icon purple"><Zap size={18}/></span>
            <label htmlFor="quick-service">Find a service</label>
            <div className="cyber-command-input"><select id="quick-service" value={selectedService} onChange={(event)=>setSelectedService(event.target.value)}>{categories.filter((item)=>item.slug!=="all").map((item)=><option value={item.slug} key={item.slug}>{item.name}</option>)}</select><button type="button" aria-label="Open selected service" onClick={()=>navigate(`/services/${selectedService}`)}><ArrowRight size={17}/></button></div>
          </div>
        </div>
      </section>

      <section className="cyber-vault-section" id="vault">
        <div className="cyber-section-heading"><div><span className="cyber-eyebrow">LIVE DIGITAL VAULT</span><h2>Your application. <em>One secure reference.</em></h2><p>Check the latest customer-visible update using your tracking ID and registered mobile number.</p></div><span className="cyber-vault-mark"><ShieldCheck size={28}/><small>PRIVATE LOOKUP</small></span></div>
        <div className="cyber-vault-card">
          <form className="cyber-vault-form" onSubmit={lookupApplication}>
            <label>APPLICATION REFERENCE<input value={trackingId} onChange={(event)=>setTrackingId(event.target.value.toUpperCase())} placeholder="BABA-XXXXXXXXXX" required minLength={8} maxLength={30}/></label>
            <label>REGISTERED MOBILE<input type="tel" value={trackingMobile} onChange={(event)=>setTrackingMobile(event.target.value)} placeholder="+91 mobile number" required pattern="[+0-9 ()-]{8,18}"/></label>
            <button className="cyber-button cyber-button-primary" disabled={trackingBusy || !isSupabaseConfigured}>{trackingBusy ? "Verifying…" : "Access tracking"} <ArrowRight size={16}/></button>
          </form>
          {!isSupabaseConfigured && <p className="cyber-inline-note">Online tracking is temporarily unavailable. Please contact our Srinagar desk.</p>}
          {trackingError && <p className="cyber-error" role="alert">{trackingError}</p>}
          {trackingRecord && <div className="cyber-live-result" aria-live="polite"><div><span className="cyber-eyebrow">REFERENCE VERIFIED</span><h3>{trackingRecord.service}</h3><p>{trackingRecord.trackingId} · Submitted {new Date(trackingRecord.submittedAt).toLocaleDateString("en-IN")}</p></div><StatusTag status={trackingRecord.status}/></div>}
          <div className="cyber-pipeline">
            {["Verified & Encrypted","Department Filing","Scrutiny","Issued / Ready"].map((label,index)=><div className={currentStage===index ? "cyber-pipeline-step is-current" : currentStage>index ? "cyber-pipeline-step is-done" : "cyber-pipeline-step"} key={label}><span>{currentStage>index ? <Check size={14}/> : String(index+1).padStart(2,"0")}</span><b>{label}</b></div>)}
          </div>
          <p className="cyber-pipeline-note">{trackingRecord ? `Current application status: ${statusLabels[trackingRecord.status] ?? trackingRecord.status}. The pipeline is an indicative view; final decisions are made by the relevant authority.` : "Typical workflow stages are shown above. Verify your reference to view your actual application status."}</p>
        </div>
      </section>

      <section className="cyber-departments">
        <div className="cyber-section-heading"><div><span className="cyber-eyebrow">SERVICE HUB · SIX KEY DESKS</span><h2>Public services, <em>made easier.</em></h2><p>Explore common departments and find the assistance relevant to your request.</p></div><Link to="/services" className="cyber-text-link">View all services <ArrowUpRight size={15}/></Link></div>
        <div className="cyber-department-grid">{departments.map((department,index)=><Link to={`/services/${department.slug}`} className="cyber-department-card" key={department.slug}><span className="cyber-dept-index">0{index+1}</span><CategoryIcon slug={department.slug}/><h3>{department.title}</h3><p>{department.detail}</p><small>Processing time varies by department and authority</small><ArrowUpRight className="cyber-dept-arrow" size={17}/></Link>)}</div>
      </section>

      <section className="cyber-document-section">
        <div className="cyber-document-copy"><span className="cyber-eyebrow">SMART DOCUMENT PRE-CHECK</span><h2>Check your files <em>before you submit.</em></h2><p>Choose up to eight documents for a local format and size check. This preview runs in your browser only; files selected here are not uploaded.</p><div className="cyber-security-note"><ShieldCheck size={18}/><span><b>Private by design</b><small>Submit documents only through the relevant application form. Do not upload passwords, OTPs or UPI PINs.</small></span></div><Link to="/apply" className="cyber-button cyber-button-primary">Continue to application <ArrowRight size={16}/></Link></div>
        <div className={dragging ? "cyber-dropzone is-dragging" : "cyber-dropzone"} onDragOver={(event)=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={(event)=>{event.preventDefault();setDragging(false);inspectFiles(event.dataTransfer.files);}}>
          <input id="cyber-document-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" multiple onChange={(event)=>inspectFiles(event.target.files ?? [])}/>
          <label htmlFor="cyber-document-input"><span className="cyber-upload-icon"><UploadCloud size={25}/></span><b>Drop files here or browse</b><small>PDF, JPG, PNG or WebP · Maximum 10 MB per file</small></label>
          {localFiles.length>0 && <div className="cyber-file-list">{localFiles.map((file)=><div className="cyber-file-item" key={file.id}>{file.preview ? <img src={file.preview} alt={`Preview of ${file.name}`}/> : <FileCheck2 size={20}/>}<span><b>{file.name}</b><small>{(file.size/1024/1024).toFixed(2)} MB · {file.message}</small></span><button type="button" aria-label={`Remove ${file.name}`} onClick={()=>setLocalFiles((current)=>current.filter((item)=>item.id!==file.id))}><X size={15}/></button></div>)}</div>}
          <p className="cyber-drop-note">Local pre-check only · No document upload occurs in this panel</p>
        </div>
      </section>

      <section className="cyber-concierge">
        <div><span className="cyber-eyebrow">DIRECT CONCIERGE · SRINAGAR LOCAL DESK</span><h2>Real help. <em>Right here.</em></h2><p>Speak with our team about services, application requirements and next steps.</p><div className="cyber-contact-actions"><a className="cyber-button cyber-button-primary" href={`https://wa.me/${settings.contact.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer><MessageCircle size={16}/> WhatsApp desk <span className="cyber-online-dot"/></a><a className="cyber-button cyber-button-ghost" href={`tel:${settings.contact.phone.replace(/[^+\d]/g,"")}`}><PhoneCall size={16}/> {settings.contact.phone}</a></div></div>
        <div className="cyber-location-card"><span className="cyber-location-icon"><MapPin size={23}/></span><span className="cyber-eyebrow">OUR SERVICE AREA</span><h3>Srinagar, Jammu &amp; Kashmir</h3><p>For the exact business pin, opening hours and directions, use our verified Google Business Profile.</p><a href={settings.social.business_profile} target="_blank" rel="noreferrer">Open Google Business Profile <ArrowUpRight size={15}/></a></div>
      </section>
      <section className="cyber-social-wrap"><SocialPreviewSection/></section>
      <section className="cyber-contact-band"><div><span className="cyber-eyebrow">NEED A HAND?</span><h2>Start with a clear conversation.</h2></div><Link to="/contact" className="cyber-button cyber-button-primary">Contact BABA'S CYBER CAFE <ArrowRight size={16}/></Link></section>
    </main>
  );
}

function SocialPreviewSection() {
  const settings = useSiteSettings();
  const mapsEmbed = "https://www.google.com/maps?q=BABA%27S%20CYBER%20CAFE%2C%20Srinagar%2C%20Jammu%20and%20Kashmir&output=embed";
  return (
    <section className="social-preview-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">FOLLOW &amp; FIND US</span>
          <h2>Our pages, in one place.</h2>
        </div>
        <p>Visit our social pages or find BABA'S CYBER CAFE on Google.</p>
      </div>
      <div className="social-preview-grid">
        <article className="social-preview-card facebook-preview">
          <div className="social-preview-head">
            <span className="social-preview-icon facebook-icon">f</span>
            <div><b>Facebook</b><small>BABA'S CYBER CAFE</small></div>
            <a href={settings.social.facebook} target="_blank" rel="noreferrer">Open page <ArrowUpRight size={14} /></a>
          </div>
          <a className="facebook-live-card" href={settings.social.facebook} target="_blank" rel="noreferrer">
            <div className="instagram-live-top">
              <span className="facebook-avatar">f</span>
              <span><b>babascybercafe</b><small>BABA'S CYBER CAFE · Srinagar</small></span>
            </div>
            <div className="facebook-preview-art">
              <span className="facebook-preview-mark">f</span>
              <b>Follow us on Facebook</b>
              <span>Services · Announcements · Customer information</span>
            </div>
            <span className="instagram-live-action">Visit our Facebook page <ArrowUpRight size={15} /></span>
          </a>
          <p className="social-preview-note">Follow our official Facebook page for business updates and announcements.</p>
        </article>
        <article className="social-preview-card instagram-preview">
          <div className="social-preview-head">
            <span className="social-preview-icon instagram-icon"><Instagram size={21} /></span>
            <div><b>Instagram</b><small>@babascybercafe</small></div>
            <a href={settings.social.instagram} target="_blank" rel="noreferrer">Open profile <ArrowUpRight size={14} /></a>
          </div>
          <a className="instagram-live-card" href={settings.social.instagram} target="_blank" rel="noreferrer">
            <div className="instagram-live-top">
              <span className="instagram-avatar">B</span>
              <span><b>babascybercafe</b><small>BABA'S CYBER CAFE · Srinagar</small></span>
            </div>
            <div className="instagram-preview-art">
              <Instagram size={38} strokeWidth={1.4} />
              <b>Follow our updates</b>
              <span>Services · Announcements · Customer information</span>
            </div>
            <span className="instagram-live-action">View live Instagram profile <ArrowUpRight size={15} /></span>
          </a>
          <p className="social-preview-note">Instagram does not provide a reliable public profile embed. This card opens your live profile.</p>
        </article>
        <article className="social-preview-card google-preview">
          <div className="social-preview-head">
            <span className="social-preview-icon google-icon"><Globe2 size={20} /></span>
            <div><b>Google Business</b><small>BABA'S CYBER CAFE · Srinagar</small></div>
            <a href={settings.social.business_profile} target="_blank" rel="noreferrer">Open listing <ArrowUpRight size={14} /></a>
          </div>
          <div className="social-embed-frame maps-frame">
            <iframe
              title="Google Maps search preview for BABA'S CYBER CAFE in Srinagar"
              src={mapsEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <a className="google-directions-link" href={settings.social.business_profile} target="_blank" rel="noreferrer">
            View Google Business Profile &amp; directions <ArrowUpRight size={15} />
          </a>
          <p className="social-preview-note">Map preview is a Google search for the business name and city; confirm the correct pin on the listing.</p>
        </article>
      </div>
    </section>
  );
}

function ContactBand() {
  const settings = useSiteSettings();
  return (
    <section className="contact-band">
      <div>
        <span className="eyebrow">NEED A HAND?</span>
        <h2>Talk to a real person.</h2>
      </div>
      <div className="contact-band-actions">
        <a
          className="button button-gold"
          href={`https://wa.me/${settings.contact.whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={16} /> WhatsApp us
        </a>
        <a
          className="button button-light-outline"
          href={`mailto:${settings.contact.email}`}
        >
          Send an email <ArrowUpRight size={15} />
        </a>
      </div>
    </section>
  );
}

function CategoryIcon({ slug }: { slug: string }) {
  const icons: Record<string, typeof Building2> = {
    insurance: ShieldCheck,
    revenue: Landmark,
    smc: Building2,
    labour: BriefcaseBusiness,
    handloom: HeartHandshake,
    rto: CarFront,
    central: Globe2,
    education: BookOpen,
    "social-welfare": HeartHandshake,
    employment: UsersRound,
    health: Activity,
    agriculture: Sparkles,
    electricity: Zap,
    water: Activity,
    banking: Landmark,
    travel: Ticket,
    other: CircleHelp,
  };
  const Icon = icons[slug] ?? FileText;
  return (
    <span className="category-icon">
      <Icon size={20} strokeWidth={1.5} />
    </span>
  );
}

function ServicesPage({ fixedCategory }: { fixedCategory?: string }) {
  const categoryList = useCategoryList();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(fixedCategory ?? "all");
  const [department, setDepartment] = useState("all");
  const [sort, setSort] = useState("featured");
  const [page, setPage] = useState(1);
  const [remoteServices, setRemoteServices] = useState<ServiceRecord[]>([]);
  const [remoteCount, setRemoteCount] = useState(0);
  const pageSize = 12;

  useEffect(() => {
    if (!supabase) return;
    let current = true;
    let request = supabase
      .from("services")
      .select("*", { count: "exact" })
      .eq("is_active", true);
    if (category !== "all") request = request.eq("category_slug", category);
    if (department !== "all") request = request.eq("category_slug", department);
    const needle = search.trim().replace(/[%,_]/g, "");
    if (needle) request = request.ilike("name", `%${needle}%`);
    if (sort === "alphabetical")
      request = request.order("name", { ascending: true });
    else if (sort === "recent")
      request = request.order("created_at", { ascending: false });
    else
      request = request
        .order("is_featured", { ascending: false })
        .order("name", { ascending: true });
    void request
      .range((page - 1) * pageSize, page * pageSize - 1)
      .then(({ data, count }) => {
        if (current) {
          setRemoteServices((data ?? []) as ServiceRecord[]);
          setRemoteCount(count ?? 0);
        }
      });
    return () => {
      current = false;
    };
  }, [category, department, page, search, sort]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matching = seedServices.filter((service) => {
      const matchesName =
        !needle ||
        `${service.name} ${service.description} ${categoryName(service.category_slug)}`
          .toLowerCase()
          .includes(needle);
      return (
        matchesName &&
        (category === "all" || service.category_slug === category) &&
        (department === "all" || service.category_slug === department)
      );
    });
    return matching.sort((a, b) =>
      sort === "alphabetical"
        ? a.name.localeCompare(b.name)
        : sort === "recent"
          ? b.created_at.localeCompare(a.created_at)
          : Number(b.is_featured) - Number(a.is_featured) ||
            a.name.localeCompare(b.name),
    );
  }, [category, department, search, sort]);
  const visible = supabase
    ? remoteServices
    : filtered.slice((page - 1) * pageSize, page * pageSize);
  const resultCount = supabase ? remoteCount : filtered.length;
  const totalPages = Math.max(1, Math.ceil(resultCount / pageSize));
  const activeCategory = categoryList.find(
    (item) => item.slug === fixedCategory,
  );

  return (
    <main className="content-page">
      <PageIntro
        eyebrow={activeCategory ? "SERVICE DEPARTMENT" : "SERVICE DIRECTORY"}
        title={activeCategory?.name ?? "Find the right assistance."}
        copy={
          activeCategory?.description ??
          "Search a growing directory of digital and public-service assistance. Requirements can change; confirm current rules with the responsible authority."
        }
      />
      <div className="catalog-toolbar">
        <label className="search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search services..."
            aria-label="Search services by name"
          />
          <kbd>⌘ K</kbd>
        </label>
        <label className="select-wrap">
          <span>Category</span>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
            disabled={Boolean(fixedCategory)}
          >
            <option value="all">All categories</option>
            {categoryList.map((item) => (
              <option value={item.slug} key={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
        <label className="select-wrap">
          <span>Department</span>
          <select
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All departments</option>
            {categoryList
              .filter(
                (item) =>
                  !["insurance", "travel", "banking", "other"].includes(
                    item.slug,
                  ),
              )
              .map((item) => (
                <option value={item.slug} key={item.slug}>
                  {item.name}
                </option>
              ))}
          </select>
          <ChevronDown size={15} />
        </label>
        <label className="select-wrap sort-select">
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="featured">Featured</option>
            <option value="recent">Recently added</option>
            <option value="alphabetical">A to Z</option>
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      <div className="catalog-meta">
        <span>
          {resultCount} {resultCount === 1 ? "service" : "services"}{" "}
          {supabase ? "in the live catalogue" : "in the initial catalogue"}
        </span>
        <span>Assistance only · Department rules apply</span>
      </div>
      {visible.length ? (
        <div className="service-grid">
          {visible.map((service) => (
            <article className="service-card" key={service.id}>
              <div className="service-card-top">
                <CategoryIcon slug={service.category_slug} />
                {service.is_featured && (
                  <span className="featured-label">FEATURED</span>
                )}
              </div>
              <span className="service-department">
                {categoryLabel(service.category_slug, categoryList)}
              </span>
              <h2>{service.name}</h2>
              <p>{service.description}</p>
              {service.required_documents.length > 0 && (
                <p className="service-documents">
                  <b>Documents noted:</b>{" "}
                  {service.required_documents.join(", ")} · confirm current
                  requirements with the authority.
                </p>
              )}
              {service.official_url && service.official_url_verified && (
                <a
                  className="official-service-link"
                  href={service.official_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Verified official portal <ArrowUpRight size={13} />
                </a>
              )}
              <div className="service-card-bottom">
                <Link
                  to={`/apply?service=${encodeURIComponent(service.name)}&category=${service.category_slug}`}
                >
                  Enquire <ArrowRight size={15} />
                </Link>
                <span>Details confirmed at enquiry</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={22} />
          <h2>No matching services</h2>
          <p>Try a different search term or category.</p>
        </div>
      )}
      <div className="pagination">
        <span>
          Page {page} of {totalPages}
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ArrowRight className="flip-icon" size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
      <div className="disclaimer-box">
        <ShieldCheck size={18} />
        <p>
          We provide independent application assistance. Official procedures,
          eligibility, required documents and decisions must be confirmed with
          the relevant department. We do not represent any government
          department.
        </p>
      </div>
    </main>
  );
}

function AboutPage() {
  return (
    <main className="content-page">
      <PageIntro
        eyebrow="ABOUT BABA'S"
        title="Local knowledge. Practical digital help."
        copy="BABA'S CYBER CAFE is a Srinagar-based independent business offering support with digital tasks, application enquiries and document preparation."
      />
      <section className="about-grid">
        <div className="about-portrait">
          <img
            src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1100&q=85"
            alt="People collaborating at a bright workspace"
          />
          <span>SRINAGAR · JAMMU &amp; KASHMIR</span>
        </div>
        <div className="about-copy">
          <span className="eyebrow">A HUMAN-FIRST SERVICE DESK</span>
          <h2>Clear help for the steps that feel complicated.</h2>
          <p>
            Digital forms and document requirements can be difficult to
            navigate. We help customers understand the information they need to
            prepare and offer assistance with online applications.
          </p>
          <p>
            Our role is to assist, not to decide. Government departments,
            insurers and other providers set their own eligibility rules,
            processes and outcomes.
          </p>
          <div className="about-principles">
            <div>
              <span>01</span>
              <b>Clarity first</b>
              <small>We explain what we can and cannot do.</small>
            </div>
            <div>
              <span>02</span>
              <b>Privacy matters</b>
              <small>
                Application details are handled through configured secure
                systems.
              </small>
            </div>
            <div>
              <span>03</span>
              <b>Independent service</b>
              <small>
                No government authorisation or affiliation is claimed.
              </small>
            </div>
          </div>
          <Link className="text-link" to="/contact">
            Get in touch <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}

function ApplicationPage() {
  const settings = useSiteSettings();
  const categoryList = useCategoryList();
  const [params] = useSearchParams();
  const [serviceList, setServiceList] = useState(seedServices);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    params.get("category") ?? "",
  );
  const [selectedService, setSelectedService] = useState(
    params.get("service") ?? "",
  );
  const [description, setDescription] = useState("");
  const [documents, setDocuments] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    trackingId: string;
    emailSent: boolean;
    emailWarning?: string;
  } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let query = supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (selectedCategory) query = query.eq("category_slug", selectedCategory);
    let current = true;
    void query.range(0, 999).then(({ data }) => {
      if (current && data) setServiceList(data as ServiceRecord[]);
    });
    return () => {
      current = false;
    };
  }, [selectedCategory]);
  const options = serviceList.filter(
    (item) => !selectedCategory || item.category_slug === selectedCategory,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isSupabaseConfigured) {
      setError(
        "Online applications are not configured yet. Please call or WhatsApp the cafe to send your enquiry.",
      );
      return;
    }
    if (!consent) {
      setError("Please confirm the privacy notice before continuing.");
      return;
    }
    setBusy(true);
    const whatsappWindow = window.open("", "_blank");
    try {
      const response = await callFunction<{
        trackingId: string;
        emailSent: boolean;
        emailWarning?: string;
      }>(
        "create-application",
        {
          fullName,
          mobile,
          email: customerEmail,
          category: selectedCategory,
          service: selectedService,
          description,
          requiredDocuments: documents,
          consent,
        },
      );
      setResult(response);
      const message = `Hello BABA'S CYBER CAFE, I have submitted an enquiry. Reference: ${response.trackingId}. Please let me know the next steps.`;
      if (whatsappWindow)
        whatsappWindow.location.href = `https://wa.me/${settings.contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    } catch (reason) {
      whatsappWindow?.close();
      setError(
        reason instanceof Error
          ? reason.message
          : "The application could not be submitted. Please try again or contact the cafe.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (result)
    return (
      <main className="content-page narrow-page">
        <div className="success-panel">
          <span className="success-icon">
            <Check size={26} />
          </span>
          <span className="eyebrow">ENQUIRY RECEIVED</span>
          <h1>Your next step is in motion.</h1>
          <p>
            Your reference number is ready. Keep it private and use it with your
            registered mobile number to check for updates.
          </p>
          <div className="tracking-code">
            <small>TRACKING REFERENCE</small>
            <strong>{result.trackingId}</strong>
          </div>
          <div className="success-actions">
            <Link className="button button-dark" to="/track">
              Track application <ArrowRight size={16} />
            </Link>
            <a
              className="button button-outline"
              href={`https://wa.me/${settings.contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello BABA'S CYBER CAFE, I submitted enquiry ${result.trackingId}.`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Open WhatsApp <ArrowUpRight size={15} />
            </a>
          </div>
          {result.emailSent ? (
            <p className="success-note">A confirmation email has been sent.</p>
          ) : (
            <ConfigurationNote>
              {result.emailWarning ??
                "The enquiry was saved, but email confirmation is not configured. Keep your reference number."}
            </ConfigurationNote>
          )}
        </div>
      </main>
    );

  return (
    <main className="content-page">
      <PageIntro
        eyebrow="NEW ENQUIRY"
        title="Let's get you to the right place."
        copy="Tell us what you need. We will review your enquiry and share a reference to help you follow its progress."
      />
      {!isSupabaseConfigured && <ConfigurationNote />}
      <div className="form-layout">
        <form className="form-panel" onSubmit={submit}>
          <div className="form-section-title">
            <span>01</span>
            <div>
              <h2>Your details</h2>
              <p>
                We use these details to respond and verify tracking requests.
              </p>
            </div>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>
                Full name <i>*</i>
              </span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
              />
            </label>
            <label className="field">
              <span>
                Mobile number <i>*</i>
              </span>
              <input
                type="tel"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                required
                pattern="[+0-9 ()-]{8,18}"
                autoComplete="tel"
                placeholder="+91"
              />
            </label>
            <label className="field field-wide">
              <span>
                Email address <i>*</i>
              </span>
              <input
                type="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                required
                maxLength={254}
                autoComplete="email"
              />
            </label>
          </div>
          <div className="form-section-title">
            <span>02</span>
            <div>
              <h2>Your service</h2>
              <p>
                Choose the closest match. You can describe anything else below.
              </p>
            </div>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>
                Department <i>*</i>
              </span>
              <select
                value={selectedCategory}
                onChange={(event) => {
                  setSelectedCategory(event.target.value);
                  setSelectedService("");
                }}
                required
              >
                <option value="">Choose a department</option>
                {categoryList.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                Service <i>*</i>
              </span>
              <select
                value={selectedService}
                onChange={(event) => setSelectedService(event.target.value)}
                required
              >
                <option value="">Choose a service</option>
                {options.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
                <option value="Other enquiry">Other enquiry</option>
              </select>
            </label>
            <label className="field field-wide">
              <span>
                Tell us what you need <i>*</i>
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                placeholder="A brief description of the help you are looking for"
              />
            </label>
            <label className="field field-wide">
              <span>Documents you already have</span>
              <textarea
                value={documents}
                onChange={(event) => setDocuments(event.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="List document names only. Do not send sensitive documents here."
              />
            </label>
          </div>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
            />
            <span>
              I agree to the{" "}
              <Link to="/privacy" target="_blank">
                Privacy Policy
              </Link>{" "}
              and consent to BABA'S CYBER CAFE using these details to respond to
              my enquiry.
            </span>
          </label>
          {error && (
            <div className="notice notice-error" role="alert">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="button button-dark form-submit"
            disabled={busy || !isSupabaseConfigured}
          >
            {busy ? "Sending securely…" : "Submit enquiry"}{" "}
            <ArrowRight size={16} />
          </button>
          <p className="form-footnote">
            <ShieldCheck size={14} /> Your reference is generated securely after
            submission. Do not include passwords, PINs or OTPs.
          </p>
        </form>
        <aside className="form-aside">
          <span className="eyebrow">WHAT HAPPENS NEXT</span>
          <div className="aside-step">
            <b>01</b>
            <span>
              <strong>We receive your enquiry</strong>
              <small>
                Your details are stored securely after the system is configured.
              </small>
            </span>
          </div>
          <div className="aside-step">
            <b>02</b>
            <span>
              <strong>We review the request</strong>
              <small>We may contact you if more information is needed.</small>
            </span>
          </div>
          <div className="aside-step">
            <b>03</b>
            <span>
              <strong>You follow your reference</strong>
              <small>
                Use your reference ID and mobile number to check progress.
              </small>
            </span>
          </div>
          <div className="aside-caution">
            <ShieldCheck size={17} />
            <p>
              Never share bank PINs, passwords or one-time passcodes. Government
              departments and insurers make all official decisions.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

type TrackedRecord = {
  trackingId: string;
  service: string;
  category: string;
  status: ApplicationStatus;
  submittedAt: string;
  remarks: string[];
  history: { status: ApplicationStatus; created_at: string }[];
  documents: { name: string; url: string; expiresAt: string }[];
};

function TrackPage() {
  const categoryList = useCategoryList();
  const [searchParams] = useSearchParams();
  const [trackingId, setTrackingId] = useState(searchParams.get("trackingId") ?? "");
  const [mobile, setMobile] = useState("");
  const [record, setRecord] = useState<TrackedRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setRecord(null);
    try {
      setRecord(
        await callFunction<TrackedRecord>("track-application", {
          trackingId,
          mobile,
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not verify those details. Please check and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="content-page">
      <PageIntro
        eyebrow="APPLICATION TRACKING"
        title="A clear view of what comes next."
        copy="Enter your tracking reference and the mobile number registered with your enquiry. Sensitive application details are never placed in the page URL."
      />
      {!isSupabaseConfigured && <ConfigurationNote />}
      <div className="track-layout">
        <form className="track-form" onSubmit={submit}>
          <span className="eyebrow">VERIFY YOUR REQUEST</span>
          <label className="field">
            <span>Tracking ID</span>
            <input
              value={trackingId}
              onChange={(event) =>
                setTrackingId(event.target.value.toUpperCase())
              }
              required
              minLength={8}
              maxLength={30}
              autoComplete="off"
              placeholder="BABA-XXXXXXXX"
            />
          </label>
          <label className="field">
            <span>Registered mobile number</span>
            <input
              type="tel"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              required
              pattern="[+0-9 ()-]{8,18}"
              autoComplete="tel"
              placeholder="+91"
            />
          </label>
          {error && (
            <div className="notice notice-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button button-dark"
            type="submit"
            disabled={busy || !isSupabaseConfigured}
          >
            {busy ? "Verifying…" : "View application status"}{" "}
            <ArrowRight size={16} />
          </button>
          <p className="form-footnote">
            <ShieldCheck size={14} /> Requests are rate-limited to protect your
            information.
          </p>
        </form>
        {record ? (
          <div className="tracking-result">
            <div className="tracking-result-head">
              <div>
                <span className="eyebrow">{record.trackingId}</span>
                <h2>{record.service}</h2>
                <p>
                  {categoryLabel(record.category, categoryList)} · Received{" "}
                  {new Date(record.submittedAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <StatusTag status={record.status} />
            </div>
            <div className="timeline">
              {record.history.map((item, index) => (
                <div
                  className={
                    index === 0 ? "timeline-item is-current" : "timeline-item"
                  }
                  key={`${item.status}-${item.created_at}`}
                >
                  <span className="timeline-dot" />
                  <div>
                    <strong>{item.status}</strong>
                    <small>
                      {new Date(item.created_at).toLocaleString("en-IN")}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            {record.remarks.length > 0 && (
              <div className="customer-remarks">
                <h3>Latest update</h3>
                {record.remarks.map((remark, index) => (
                  <p key={index}>{remark}</p>
                ))}
              </div>
            )}
            {record.documents.length > 0 && (
              <div className="approved-documents">
                <h3>Approved documents</h3>
                {record.documents.map((doc) => (
                  <a
                    href={doc.url}
                    key={doc.name}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileCheck2 size={16} />
                    {doc.name}
                    <ArrowUpRight size={14} />
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="track-empty">
            <Clock3 size={27} />
            <h2>Progress, without the guesswork.</h2>
            <p>
              Once verified, you will see the latest status, approved updates
              and any documents shared with you.
            </p>
            <span>Keep your tracking ID private.</span>
          </div>
        )}
      </div>
    </main>
  );
}

function StatusTag({ status }: { status: string }) {
  const key = status.toLowerCase().replaceAll(" ", "-");
  return <span className={`status-tag status-${key}`}>{status}</span>;
}

function CustomerDashboard() {
  return (
    <main className="content-page narrow-page">
      <PageIntro
        eyebrow="CUSTOMER PORTAL"
        title="Track your application securely."
        copy="Email OTP sign-in has been removed. Use your tracking reference and registered mobile number to view the latest status and customer-visible updates."
      />
      <div className="signin-panel">
        <h2>Continue to application tracking</h2>
        <p>Keep your tracking reference private. Your registered mobile number is required to look up the request.</p>
        <Link className="button button-dark" to="/track">Open tracking portal <ArrowRight size={16} /></Link>
      </div>
    </main>
  );
}

function WebsiteSettingsEditor() {
  const [form, setForm] = useState<SiteSettings>(defaultSiteSettings);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let current = true;
    void supabase
      .from("website_settings")
      .select("key, value")
      .then(({ data }) => {
        if (!current || !data) return;
        const values = Object.fromEntries(
          data.map((item) => [item.key, item.value as Record<string, unknown>]),
        );
        const announcement = values.homepage_announcement ?? {};
        const homepage = values.homepage_content ?? {};
        const contact = values.contact ?? {};
        const social = values.social_links ?? {};
        setForm({
          announcement: {
            enabled: announcement.enabled === true,
            text:
              typeof announcement.text === "string" ? announcement.text : "",
          },
          homepage: {
            eyebrow:
              typeof homepage.eyebrow === "string"
                ? homepage.eyebrow
                : defaultSiteSettings.homepage.eyebrow,
            headline:
              typeof homepage.headline === "string"
                ? homepage.headline
                : defaultSiteSettings.homepage.headline,
            description:
              typeof homepage.description === "string"
                ? homepage.description
                : defaultSiteSettings.homepage.description,
          },
          contact: {
            phone: typeof contact.phone === "string" ? contact.phone : phone,
            whatsapp:
              typeof contact.whatsapp === "string"
                ? contact.whatsapp
                : whatsapp,
            email: typeof contact.email === "string" ? contact.email : email,
          },
          social: {
            facebook:
              typeof social.facebook === "string" ? social.facebook : facebook,
            business_profile:
              typeof social.business_profile === "string"
                ? social.business_profile
                : businessProfile,
            instagram:
              typeof social.instagram === "string" && social.instagram.trim()
                ? social.instagram
                : instagramProfile,
          },
        });
      });
    return () => {
      current = false;
    };
  }, []);

  function update<K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await supabase.auth.getSession();
      await callFunction(
        "admin-update-settings",
        form,
        data.session?.access_token,
      );
      window.dispatchEvent(new Event("site-settings-updated"));
      setNotice("Website content and contact settings are updated.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Website settings could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-section settings-editor">
      <div className="admin-section-head">
        <div>
          <span className="eyebrow">PUBLIC WEBSITE</span>
          <h2>Content, contact &amp; announcements</h2>
        </div>
      </div>
      {notice && (
        <div className="notice notice-success">
          <Check size={16} />
          {notice}
        </div>
      )}
      {error && <div className="notice notice-error">{error}</div>}
      <form className="settings-form" onSubmit={save}>
        <div className="settings-group">
          <div>
            <span className="eyebrow">HOMEPAGE</span>
            <p>Set the public heading and supporting copy.</p>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Eyebrow</span>
              <input
                value={form.homepage.eyebrow}
                onChange={(event) =>
                  update("homepage", {
                    ...form.homepage,
                    eyebrow: event.target.value,
                  })
                }
                maxLength={100}
                required
              />
            </label>
            <label className="field">
              <span>Headline (use | to split lines)</span>
              <input
                value={form.homepage.headline}
                onChange={(event) =>
                  update("homepage", {
                    ...form.homepage,
                    headline: event.target.value,
                  })
                }
                maxLength={120}
                required
              />
            </label>
            <label className="field field-wide">
              <span>Description</span>
              <textarea
                value={form.homepage.description}
                onChange={(event) =>
                  update("homepage", {
                    ...form.homepage,
                    description: event.target.value,
                  })
                }
                maxLength={400}
                rows={2}
                required
              />
            </label>
          </div>
        </div>
        <div className="settings-group">
          <div>
            <span className="eyebrow">ANNOUNCEMENT</span>
            <p>Publish a short banner across the home page.</p>
          </div>
          <div className="field-grid">
            <label className="consent-check field-wide">
              <input
                type="checkbox"
                checked={form.announcement.enabled}
                onChange={(event) =>
                  update("announcement", {
                    ...form.announcement,
                    enabled: event.target.checked,
                  })
                }
              />
              <span>Show announcement banner</span>
            </label>
            <label className="field field-wide">
              <span>Announcement text</span>
              <input
                value={form.announcement.text}
                onChange={(event) =>
                  update("announcement", {
                    ...form.announcement,
                    text: event.target.value,
                  })
                }
                maxLength={240}
              />
            </label>
          </div>
        </div>
        <div className="settings-group">
          <div>
            <span className="eyebrow">CONTACT DETAILS</span>
            <p>Update public phone, WhatsApp and email.</p>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Phone number</span>
              <input
                value={form.contact.phone}
                onChange={(event) =>
                  update("contact", {
                    ...form.contact,
                    phone: event.target.value,
                  })
                }
                maxLength={22}
                required
              />
            </label>
            <label className="field">
              <span>WhatsApp number (country code)</span>
              <input
                value={form.contact.whatsapp}
                onChange={(event) =>
                  update("contact", {
                    ...form.contact,
                    whatsapp: event.target.value,
                  })
                }
                maxLength={20}
                required
              />
            </label>
            <label className="field field-wide">
              <span>Business email</span>
              <input
                type="email"
                value={form.contact.email}
                onChange={(event) =>
                  update("contact", {
                    ...form.contact,
                    email: event.target.value,
                  })
                }
                maxLength={254}
                required
              />
            </label>
          </div>
        </div>
        <div className="settings-group">
          <div>
            <span className="eyebrow">SOCIAL LINKS</span>
            <p>Only HTTPS links are accepted.</p>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Facebook</span>
              <input
                type="url"
                pattern="https://.*"
                value={form.social.facebook}
                onChange={(event) =>
                  update("social", {
                    ...form.social,
                    facebook: event.target.value,
                  })
                }
                required
              />
            </label>
            <label className="field">
              <span>Google Business Profile</span>
              <input
                type="url"
                pattern="https://.*"
                value={form.social.business_profile}
                onChange={(event) =>
                  update("social", {
                    ...form.social,
                    business_profile: event.target.value,
                  })
                }
                required
              />
            </label>
            <label className="field field-wide">
              <span>Instagram page (optional)</span>
              <input
                type="url"
                pattern="https://.*"
                value={form.social.instagram}
                onChange={(event) =>
                  update("social", {
                    ...form.social,
                    instagram: event.target.value,
                  })
                }
                placeholder="https://www.instagram.com/your-page/"
              />
            </label>
          </div>
        </div>
        <button className="button button-dark" disabled={busy}>
          {busy ? "Saving…" : "Save website settings"} <Check size={15} />
        </button>
      </form>
    </section>
  );
}

type AdminApplication = {
  id: string;
  tracking_id: string;
  full_name: string;
  mobile: string;
  email: string;
  category_slug: string;
  service_name: string;
  status: ApplicationStatus;
  created_at: string;
};

function AdminPage() {
  const adminCategories = useCategoryList(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [error, setError] = useState("");
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [applicationPage, setApplicationPage] = useState(1);
  const [applicationCount, setApplicationCount] = useState(0);
  const [applicationPageCount, setApplicationPageCount] = useState(1);
  const [overviewVersion, setOverviewVersion] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    documentsRequired: 0,
  });
  const [active, setActive] = useState<AdminApplication | null>(null);
  const [newStatus, setNewStatus] = useState<ApplicationStatus>("Under Review");
  const [customerRemark, setCustomerRemark] = useState("");
  const [internalRemark, setInternalRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [serviceCategory, setServiceCategory] = useState(categories[0].slug);
  const [featureService, setFeatureService] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adminServices, setAdminServices] = useState<ServiceRecord[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePage, setServicePage] = useState(1);
  const [serviceCount, setServiceCount] = useState(0);
  const [servicePageCount, setServicePageCount] = useState(1);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryDraft, setCategoryDraft] = useState({
    name: "",
    description: "",
  });
  const [editingService, setEditingService] = useState<ServiceRecord | null>(
    null,
  );
  const [serviceDraft, setServiceDraft] = useState({
    name: "",
    category_slug: categories[0].slug,
    description: "",
    required_documents: "",
    eligibility: "",
    application_method: "",
    official_url: "",
    official_url_verified: false,
    is_active: true,
    is_featured: false,
  });

  useEffect(() => {
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
        setUser(
          session?.user
            ? { id: session.user.id, email: session.user.email }
            : null,
        );
        setIsOwner(false);
        setReady(!session?.user);
      },
    );
    // Supabase may process the recovery redirect before this route mounts.
    // Read the captured flag after the asynchronous session lookup completes.
    void supabase.auth.getSession().then(({ data }) => {
      setUser(
        data.session?.user
          ? { id: data.session.user.id, email: data.session.user.email }
          : null,
      );
      if (hasPendingPasswordRecovery()) setPasswordRecovery(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase || !user) return;
    let current = true;
    void (async () => {
      try {
        const { data, error: roleError } = await supabase!
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "owner")
          .maybeSingle();
        if (!current) return;
        if (roleError) throw roleError;
        if (data?.role === "owner") {
          setIsOwner(true);
          setError("");
          setReady(true);
          return;
        }
        const { data: sessionData } = await supabase!.auth.getSession();
        await callFunction("investigation-overview", {}, sessionData.session?.access_token);
        if (current) window.location.replace("/investigation");
      } catch (reason) {
        if (!current) return;
        setIsOwner(false);
        setError(reason instanceof Error ? reason.message : "Secure portal access could not be verified.");
        setReady(true);
      }
    })();
    return () => { current = false; };
  }, [user]);
  useEffect(() => {
    if (!supabase || !isOwner) return;
    let current = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        const { data } = await supabase!.auth.getSession();
        const overview = await callFunction<{
          items: AdminApplication[];
          count: number;
          pageSize: number;
          page: number;
          stats: typeof stats;
        }>(
          "admin-overview",
          { search: filter, status: statusFilter, page: applicationPage },
          data.session?.access_token,
        );
        if (!current) return;
        setApplications(overview.items);
        setApplicationCount(overview.count);
        setApplicationPageCount(
          Math.max(1, Math.ceil(overview.count / overview.pageSize)),
        );
        setStats(overview.stats);
      })().catch((reason) => {
        if (current)
          setError(
            reason instanceof Error
              ? reason.message
              : "Admin overview could not be loaded.",
          );
      });
    }, 180);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [applicationPage, filter, isOwner, overviewVersion, statusFilter]);
  useEffect(() => {
    if (!supabase || !isOwner) return;
    let current = true;
    const timer = window.setTimeout(() => {
      let query = supabase!
        .from("services")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      const needle = serviceSearch.trim().replace(/[%,_]/g, "");
      if (needle) query = query.ilike("name", `%${needle}%`);
      void query
        .range((servicePage - 1) * 20, servicePage * 20 - 1)
        .then(({ data, count, error: queryError }) => {
          if (!current) return;
          if (queryError) setError(queryError.message);
          else {
            setAdminServices((data ?? []) as ServiceRecord[]);
            setServiceCount(count ?? 0);
            setServicePageCount(Math.max(1, Math.ceil((count ?? 0) / 20)));
          }
        });
    }, 180);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [catalogVersion, isOwner, servicePage, serviceSearch]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!supabase) {
      setError("Supabase authentication is not configured.");
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password,
    });
    if (authError) setError(authError.message);
  }
  async function requestPasswordReset() {
    setError("");
    setNotice("");
    if (!supabase) return;
    const normalizedEmail = adminEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your verified email address first.");
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo: `${window.location.origin}/admin/login` },
    );
    if (resetError) setError(resetError.message);
    else setNotice("If the account exists, password reset instructions were sent. Use the newest email link once.");
  }
  async function updateRecoveredPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!supabase) return;
    if (newPassword.length < 12) {
      setError("Choose a password with at least 12 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("The passwords do not match.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) setError(updateError.message);
    else {
      setPasswordRecovery(false);
      clearPasswordRecoveryPending();
      setNewPassword("");
      setConfirmNewPassword("");
      setNotice("Password updated. Sign in with your new password.");
    }
  }
  async function changeAdminPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!supabase || !isOwner) return;
    if (newPassword.length < 12) {
      setError("Choose at least 12 characters.");
      return;
    }
    if (
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      setError("Include uppercase, lowercase, a number, and a symbol.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("The passwords do not match.");
      return;
    }
    setChangingPassword(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setChangingPassword(false);
    if (updateError) setError(updateError.message);
    else {
      setNewPassword("");
      setConfirmNewPassword("");
      setNotice("Password updated successfully.");
    }
  }
  async function signOut() {
    await supabase?.auth.signOut();
    setApplications([]);
    setIsOwner(false);
  }
  async function saveUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active || !supabase) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await supabase.auth.getSession();
      const update = await callFunction<{
        emailSent: boolean;
        emailWarning?: string;
      }>(
        "admin-update-application",
        {
          applicationId: active.id,
          status: newStatus,
          customerRemark,
          internalRemark,
        },
        data.session?.access_token,
      );
      setNotice(
        update.emailWarning
          ? `Application update saved. ${update.emailWarning}`
          : update.emailSent
            ? "Application update saved and an email was sent."
            : "Application update saved and recorded in the audit history.",
      );
      setCustomerRemark("");
      setInternalRemark("");
      setActive(null);
      setOverviewVersion((version) => version + 1);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save this update.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function deleteApplication(item: AdminApplication) {
    const confirmed = window.confirm(`Permanently delete application ${item.tracking_id} for ${item.full_name}? This also deletes its payment record, remarks, status history and customer documents. The deletion action remains in the owner audit log.`);
    if (!confirmed || !supabase) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data } = await supabase.auth.getSession();
      const result = await callFunction<{deleted:boolean; storageCleanupPending?:boolean}>("admin-delete-application", { applicationId: item.id }, data.session?.access_token);
      if (active?.id === item.id) setActive(null);
      setNotice(result.storageCleanupPending ? `Application ${item.tracking_id} deleted. Private document cleanup needs administrator review.` : `Application ${item.tracking_id} and its linked records were deleted.`);
      setOverviewVersion(version => version + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Application could not be deleted."); }
    finally { setBusy(false); }
  }

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error: insertError } = await supabase.from("services").insert({
      category_slug: serviceCategory,
      name: serviceName.trim(),
      description:
        "Application assistance. Confirm current requirements with the responsible authority.",
      required_documents: [],
      eligibility:
        "Confirm current eligibility with the responsible authority.",
      application_method:
        "Enquire with BABA'S CYBER CAFE for assistance. The responsible authority controls the official process.",
      official_url: null,
      official_url_verified: false,
      is_active: true,
      is_featured: featureService,
    });
    if (insertError) setError(insertError.message);
    else {
      setServiceName("");
      setFeatureService(false);
      setNotice("Service added to the catalogue.");
      setCatalogVersion((version) => version + 1);
    }
    setBusy(false);
  }
  async function importCsv(file?: File) {
    if (!file || !supabase) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data, errors: parseErrors }) => {
        if (parseErrors.length) {
          setError(`CSV could not be read: ${parseErrors[0].message}`);
          return;
        }
        const valid = data.filter(
          (row) =>
            row.name?.trim() &&
            adminCategories.some(
              (item) => item.slug === row.category_slug?.trim(),
            ),
        );
        if (!valid.length) {
          setError(
            "No valid rows. Include name and a valid category_slug column.",
          );
          return;
        }
        setBusy(true);
        try {
          const { data: session } = await supabase!.auth.getSession();
          const result = await callFunction<{
            imported: number;
            skipped: number;
          }>("import-services", { rows: valid }, session.session?.access_token);
          setNotice(
            `${result.imported} service(s) imported; ${result.skipped} row(s) skipped.`,
          );
          setError("");
          setCatalogVersion((version) => version + 1);
        } catch (reason) {
          setError(
            reason instanceof Error ? reason.message : "CSV import failed.",
          );
        } finally {
          setBusy(false);
        }
      },
    });
  }
  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const slug = categoryNameInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setBusy(true);
    setError("");
    setNotice("");
    const { error: insertError } = await supabase
      .from("service_categories")
      .insert({
        slug,
        name: categoryNameInput.trim(),
        description: categoryDescription.trim(),
        icon: "file",
        is_active: true,
        sort_order: adminCategories.length + 1,
      });
    if (insertError) setError(insertError.message);
    else {
      setCategoryNameInput("");
      setCategoryDescription("");
      setNotice("Category added to the catalogue.");
      window.dispatchEvent(new Event("catalog-updated"));
    }
    setBusy(false);
  }
  async function setCategoryActive(category: Category) {
    if (!supabase) return;
    const { error: updateError } = await supabase
      .from("service_categories")
      .update({ is_active: category.is_active === false })
      .eq("slug", category.slug);
    if (updateError) setError(updateError.message);
    else {
      setNotice(
        `Category ${category.is_active === false ? "activated" : "deactivated"}.`,
      );
      window.dispatchEvent(new Event("catalog-updated"));
    }
  }
  function editCategory(category: Category) {
    setEditingCategory(category);
    setCategoryDraft({
      name: category.name,
      description: category.description,
    });
  }
  async function saveCategoryEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editingCategory) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error: updateError } = await supabase
      .from("service_categories")
      .update({
        name: categoryDraft.name.trim(),
        description: categoryDraft.description.trim(),
      })
      .eq("slug", editingCategory.slug);
    if (updateError) setError(updateError.message);
    else {
      setEditingCategory(null);
      setNotice("Category details saved.");
      window.dispatchEvent(new Event("catalog-updated"));
    }
    setBusy(false);
  }
  async function setServiceField(
    service: ServiceRecord,
    field: "is_active" | "is_featured",
  ) {
    if (!supabase) return;
    const { error: updateError } = await supabase
      .from("services")
      .update({ [field]: !service[field] })
      .eq("id", service.id);
    if (updateError) setError(updateError.message);
    else {
      setNotice("Service listing updated.");
      setCatalogVersion((version) => version + 1);
    }
  }
  function editService(service: ServiceRecord) {
    setEditingService(service);
    setServiceDraft({
      name: service.name,
      category_slug: service.category_slug,
      description: service.description,
      required_documents: service.required_documents.join(" | "),
      eligibility: service.eligibility,
      application_method: service.application_method,
      official_url: service.official_url ?? "",
      official_url_verified: service.official_url_verified,
      is_active: service.is_active,
      is_featured: service.is_featured,
    });
  }
  async function saveServiceEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editingService) return;
    if (serviceDraft.official_url && !serviceDraft.official_url_verified) {
      setError(
        "Confirm that this HTTPS address is an official source before saving it.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const { error: updateError } = await supabase
      .from("services")
      .update({
        name: serviceDraft.name.trim(),
        category_slug: serviceDraft.category_slug,
        description: serviceDraft.description.trim(),
        required_documents: serviceDraft.required_documents
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean),
        eligibility: serviceDraft.eligibility.trim(),
        application_method: serviceDraft.application_method.trim(),
        official_url: serviceDraft.official_url.trim() || null,
        official_url_verified: Boolean(
          serviceDraft.official_url.trim() &&
          serviceDraft.official_url_verified,
        ),
        is_active: serviceDraft.is_active,
        is_featured: serviceDraft.is_featured,
      })
      .eq("id", editingService.id);
    if (updateError) setError(updateError.message);
    else {
      setEditingService(null);
      setNotice("Service details saved.");
      setCatalogVersion((version) => version + 1);
    }
    setBusy(false);
  }
  async function uploadDocument(file?: File) {
    if (!active || !file || !supabase) return;
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError("Choose a PDF, JPG or PNG file up to 10 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${active.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("application-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: recordError } = await supabase
        .from("application_documents")
        .insert({
          application_id: active.id,
          file_name: file.name,
          storage_path: path,
          mime_type: file.type,
          file_size_bytes: file.size,
          is_customer_visible: true,
          uploaded_by: user?.id,
        });
      if (recordError) throw recordError;
      setNotice(
        "Document uploaded to private storage. It appears in tracking only after the application is Approved or Completed.",
      );
      try {
        const { data } = await supabase.auth.getSession();
        const notification = await callFunction<{
          emailSent: boolean;
          emailWarning?: string;
        }>(
          "notify-customer",
          { applicationId: active.id, type: "document_available" },
          data.session?.access_token,
        );
        if (notification.emailWarning)
          setNotice(`Document uploaded. ${notification.emailWarning}`);
        else if (notification.emailSent)
          setNotice(
            "Document uploaded privately and an availability email was sent.",
          );
      } catch {
        setNotice(
          "Document uploaded privately. Email notification could not be confirmed; check the email configuration.",
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Document upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  const shownApplications = applications;

  return (
    <main className="content-page admin-page">
      <div className="admin-head">
        <div>
          <span className="eyebrow">PRIVATE WORKSPACE</span>
          <h1>Owner dashboard</h1>
          <p>Manage enquiries, service listings and customer updates.</p>
          {isOwner && (
            <div className="admin-portal-shortcuts">
              <Link className="button button-outline" to="/grievance/admin">Manage grievances <ArrowUpRight size={14} /></Link>
              <Link className="button button-outline" to="/investigation">Security investigation <ArrowUpRight size={14} /></Link>
            </div>
          )}
        </div>
        {user && (
          <button
            className="button button-outline"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        )}
      </div>
      {!isSupabaseConfigured && (
        <ConfigurationNote>
          Admin authentication is unavailable until Supabase is configured.
        </ConfigurationNote>
      )}
      {passwordRecovery && (
        <form
          className="signin-panel admin-signin"
          onSubmit={updateRecoveredPassword}
        >
          <div className="signin-icon">
            <ShieldCheck size={25} />
          </div>
          <span className="eyebrow">PASSWORD RECOVERY</span>
          <h2>Choose a new password</h2>
          <label className="field">
            <span>New password (at least 12 characters)</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
            />
          </label>
          {error && <div className="notice notice-error">{error}</div>}
          {notice && <div className="notice notice-success">{notice}</div>}
          <button className="button button-dark" disabled={!isSupabaseConfigured || newPassword.length < 12 || newPassword !== confirmNewPassword}>
            Update password <ArrowRight size={16} />
          </button>
        </form>
      )}
      {!user && !passwordRecovery && (
        <form className="signin-panel admin-signin" onSubmit={signIn}>
          <div className="signin-icon">
            <ShieldCheck size={25} />
          </div>
          <span className="eyebrow">OWNER ACCESS ONLY</span>
          <h2>Secure admin sign-in</h2>
          <p>
            There is no public registration. Owner accounts must be provisioned
            by a trusted administrator.
          </p>
          <label className="field">
            <span>Verified email</span>
            <input
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <div className="notice notice-error">{error}</div>}
          {notice && <div className="notice notice-success">{notice}</div>}
          <button
            className="button button-dark"
            disabled={!isSupabaseConfigured}
          >
            Sign in securely <ArrowRight size={16} />
          </button>
          <button
            className="button button-outline"
            type="button"
            disabled={!isSupabaseConfigured}
            onClick={() => void requestPasswordReset()}
          >
            Forgot password?
          </button>
        </form>
      )}
      {!passwordRecovery && user && !ready && <p>Checking secure portal access…</p>}
      {!passwordRecovery && user && ready && !isOwner && (
        <div className="notice notice-error">
          {error || "Owner access is required for this dashboard."}
        </div>
      )}
      {!passwordRecovery && user && ready && isOwner && (
        <>
          {error && <div className="notice notice-error">{error}</div>}
          {notice && (
            <div className="notice notice-success">
              <Check size={16} />
              {notice}
            </div>
          )}
          <section className="admin-section">
            <div className="admin-section-head">
              <div>
                <span className="eyebrow">ACCOUNT SECURITY</span>
                <h2>Change password</h2>
              </div>
            </div>
            <form className="form-panel" onSubmit={changeAdminPassword}>
              <div className="field-grid">
                <label className="field">
                  <span>New password (at least 12 characters)</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={12}
                    required
                    autoComplete="new-password"
                  />
                </label>
                <label className="field">
                  <span>Confirm new password</span>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) =>
                      setConfirmNewPassword(event.target.value)
                    }
                    minLength={12}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                </label>
              </div>
              {error && <div className="notice notice-error">{error}</div>}
              <button
                className="button button-dark"
                disabled={changingPassword}
              >
                {changingPassword ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
          <div className="metric-grid">
            <div>
              <span>Applications</span>
              <strong>{stats.total}</strong>
              <small>All records</small>
            </div>
            <div>
              <span>In progress</span>
              <strong>{stats.pending}</strong>
              <small>Awaiting completion</small>
            </div>
            <div>
              <span>Documents needed</span>
              <strong>{stats.documentsRequired}</strong>
              <small>Customer follow-up</small>
            </div>
            <div>
              <span>Completed</span>
              <strong>{stats.completed}</strong>
              <small>Marked complete</small>
            </div>
          </div>
          <section className="admin-section">
            <div className="admin-section-head">
              <div>
                <span className="eyebrow">CUSTOMER REQUESTS</span>
                <h2>Application management</h2>
              </div>
              <label className="search-box admin-search">
                <Search size={17} />
                <input
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value);
                    setApplicationPage(1);
                  }}
                  placeholder="Name, phone or tracking ID"
                />
              </label>
            </div>
            <div className="admin-filters">
              <label className="field">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setApplicationPage(1);
                  }}
                >
                  <option value="all">All statuses</option>
                  {statusLabels.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <span>{applicationCount} matching · owner-only data</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reference / customer</th>
                    <th>Service</th>
                    <th>Received</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shownApplications.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <b>{item.tracking_id}</b>
                        <small>
                          {item.full_name} · {item.mobile}
                        </small>
                      </td>
                      <td>
                        {item.service_name}
                        <small>
                          {categoryLabel(item.category_slug, adminCategories)}
                        </small>
                      </td>
                      <td>
                        {new Date(item.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td>
                        <StatusTag status={item.status} />
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => {
                            setActive(item);
                            setNewStatus(item.status);
                            setError("");
                          }}
                        >
                          Update <ArrowRight size={14} />
                        </button>
                        <Link className="text-button" to={`/admin/payments?application=${item.id}`}>
                          Payment <ArrowRight size={14} />
                        </Link>
                        <button className="text-button" disabled={busy} onClick={() => void deleteApplication(item)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shownApplications.length === 0 && (
                <p className="table-empty">No matching applications.</p>
              )}
            </div>
            <div className="pagination admin-pagination">
              <span>
                Page {applicationPage} of {applicationPageCount}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous applications"
                  disabled={applicationPage <= 1}
                  onClick={() => setApplicationPage((page) => page - 1)}
                >
                  <ArrowRight className="flip-icon" size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Next applications"
                  disabled={applicationPage >= applicationPageCount}
                  onClick={() => setApplicationPage((page) => page + 1)}
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </section>
          <section className="admin-section service-admin">
            <div className="admin-section-head">
              <div>
                <span className="eyebrow">SERVICE CATALOGUE</span>
                <h2>Add or import services</h2>
              </div>
              <a
                className="text-link"
                href="/service-catalogue-template.csv"
                download
              >
                CSV template <ArrowDown size={15} />
              </a>
            </div>
            <div className="service-admin-grid">
              <form className="inline-service-form" onSubmit={addService}>
                <label className="field">
                  <span>Service name</span>
                  <input
                    value={serviceName}
                    onChange={(event) => setServiceName(event.target.value)}
                    required
                    maxLength={160}
                  />
                </label>
                <label className="field">
                  <span>Category</span>
                  <select
                    value={serviceCategory}
                    onChange={(event) => setServiceCategory(event.target.value)}
                  >
                    {adminCategories
                      .filter((item) => item.is_active !== false)
                      .map((item) => (
                        <option key={item.slug} value={item.slug}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={featureService}
                    onChange={(event) =>
                      setFeatureService(event.target.checked)
                    }
                  />
                  <span>Feature on service listing</span>
                </label>
                <button className="button button-dark" disabled={busy}>
                  Add service <ArrowRight size={15} />
                </button>
              </form>
              <label className="csv-drop">
                <FileText size={24} />
                <b>Import a CSV catalogue</b>
                <small>
                  Upload rows with name and category_slug. The server validates
                  imports.
                </small>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => void importCsv(event.target.files?.[0])}
                  disabled={busy}
                />
              </label>
            </div>
          </section>
          <section className="admin-section">
            <div className="admin-section-head">
              <div>
                <span className="eyebrow">CATALOGUE RECORDS</span>
                <h2>Edit or deactivate services</h2>
              </div>
              <label className="search-box admin-search">
                <Search size={17} />
                <input
                  value={serviceSearch}
                  onChange={(event) => {
                    setServiceSearch(event.target.value);
                    setServicePage(1);
                  }}
                  placeholder="Search catalogue by service name"
                />
              </label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Category</th>
                    <th>Featured</th>
                    <th>Active</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {adminServices.map((service) => (
                    <tr key={service.id}>
                      <td>
                        <b>{service.name}</b>
                        <small>{service.description}</small>
                      </td>
                      <td>
                        {categoryLabel(service.category_slug, adminCategories)}
                      </td>
                      <td>
                        <input
                          aria-label={`Feature ${service.name}`}
                          type="checkbox"
                          checked={service.is_featured}
                          onChange={() =>
                            void setServiceField(service, "is_featured")
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Activate ${service.name}`}
                          type="checkbox"
                          checked={service.is_active}
                          onChange={() =>
                            void setServiceField(service, "is_active")
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => editService(service)}
                        >
                          Edit <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {adminServices.length === 0 && (
                <p className="table-empty">No matching services.</p>
              )}
            </div>
            <div className="pagination admin-pagination">
              <span>
                {serviceCount} services · page {servicePage} of{" "}
                {servicePageCount}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous service page"
                  disabled={servicePage <= 1}
                  onClick={() => setServicePage((page) => page - 1)}
                >
                  <ArrowRight className="flip-icon" size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Next service page"
                  disabled={servicePage >= servicePageCount}
                  onClick={() => setServicePage((page) => page + 1)}
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </section>
          <section className="admin-section category-admin">
            <div className="admin-section-head">
              <div>
                <span className="eyebrow">DEPARTMENTS &amp; CATEGORIES</span>
                <h2>Manage service categories</h2>
              </div>
            </div>
            <div className="category-management-grid">
              <form className="category-create-form" onSubmit={addCategory}>
                <label className="field">
                  <span>Category name</span>
                  <input
                    value={categoryNameInput}
                    onChange={(event) =>
                      setCategoryNameInput(event.target.value)
                    }
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                <label className="field">
                  <span>Category slug</span>
                  <input
                    value={categoryNameInput
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")}
                    readOnly
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    value={categoryDescription}
                    onChange={(event) =>
                      setCategoryDescription(event.target.value)
                    }
                    maxLength={500}
                    rows={2}
                  />
                </label>
                <button className="button button-dark" disabled={busy}>
                  Add category <ArrowRight size={15} />
                </button>
              </form>
              <div className="category-admin-list">
                {adminCategories.map((item) => (
                  <div className="category-admin-row" key={item.slug}>
                    <CategoryIcon slug={item.slug} />
                    <span>
                      <b>{item.name}</b>
                      <small>{item.slug}</small>
                    </span>
                    <StatusTag
                      status={item.is_active === false ? "Inactive" : "Active"}
                    />
                    <button
                      className="text-button"
                      onClick={() => editCategory(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-button"
                      onClick={() => void setCategoryActive(item)}
                    >
                      {item.is_active === false ? "Activate" : "Deactivate"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <WebsiteSettingsEditor />
          {active && (
            <div
              className="modal-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setActive(null);
              }}
            >
              <section
                className="admin-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="update-title"
              >
                <div className="modal-head">
                  <div>
                    <span className="eyebrow">{active.tracking_id}</span>
                    <h2 id="update-title">Update application</h2>
                    <p>
                      {active.full_name} · {active.service_name}
                    </p>
                    <Link className="text-button" to={`/admin/payments?application=${active.id}`}>
                      Manage this application's payment <ArrowRight size={14} />
                    </Link>
                    <button type="button" className="text-button" disabled={busy} onClick={() => void deleteApplication(active)}>Delete this application</button>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Close update dialog"
                    onClick={() => setActive(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={saveUpdate}>
                  <label className="field">
                    <span>Application status</span>
                    <select
                      value={newStatus}
                      onChange={(event) =>
                        setNewStatus(event.target.value as ApplicationStatus)
                      }
                    >
                      {statusLabels.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Customer-visible update</span>
                    <textarea
                      value={customerRemark}
                      onChange={(event) =>
                        setCustomerRemark(event.target.value)
                      }
                      maxLength={1000}
                      rows={3}
                    />
                  </label>
                  <label className="field">
                    <span>Internal note (owner only)</span>
                    <textarea
                      value={internalRemark}
                      onChange={(event) =>
                        setInternalRemark(event.target.value)
                      }
                      maxLength={1000}
                      rows={3}
                    />
                  </label>
                  <label className="field">
                    <span>
                      Upload approved customer document (PDF, JPG, PNG · max 10
                      MB)
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      disabled={uploading}
                      onChange={(event) =>
                        void uploadDocument(event.target.files?.[0])
                      }
                    />
                  </label>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setActive(null)}
                    >
                      Cancel
                    </button>
                    <button className="button button-dark" disabled={busy}>
                      {busy ? "Saving…" : "Save update"} <Check size={15} />
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
          {editingService && (
            <div
              className="modal-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget)
                  setEditingService(null);
              }}
            >
              <section
                className="admin-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="service-edit-title"
              >
                <div className="modal-head">
                  <div>
                    <span className="eyebrow">SERVICE CATALOGUE</span>
                    <h2 id="service-edit-title">Edit service listing</h2>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Close service editor"
                    onClick={() => setEditingService(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={saveServiceEdit}>
                  <label className="field">
                    <span>Service name</span>
                    <input
                      value={serviceDraft.name}
                      onChange={(event) =>
                        setServiceDraft({
                          ...serviceDraft,
                          name: event.target.value,
                        })
                      }
                      maxLength={160}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Category</span>
                    <select
                      value={serviceDraft.category_slug}
                      onChange={(event) =>
                        setServiceDraft({
                          ...serviceDraft,
                          category_slug: event.target.value,
                        })
                      }
                    >
                      {adminCategories
                        .filter((item) => item.is_active !== false)
                        .map((item) => (
                          <option value={item.slug} key={item.slug}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <textarea
                      value={serviceDraft.description}
                      onChange={(event) =>
                        setServiceDraft({
                          ...serviceDraft,
                          description: event.target.value,
                        })
                      }
                      maxLength={2000}
                      rows={2}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Required documents (separate with |)</span>
                    <textarea
                      value={serviceDraft.required_documents}
                      onChange={(event) =>
                        setServiceDraft({
                          ...serviceDraft,
                          required_documents: event.target.value,
                        })
                      }
                      maxLength={4000}
                      rows={2}
                    />
                  </label>
                  <label className="field">
                    <span>Eligibility information</span>
                    <textarea
                      value={serviceDraft.eligibility}
                      onChange={(event) =>
                        setServiceDraft({
                          ...serviceDraft,
                          eligibility: event.target.value,
                        })
                      }
                      maxLength={1000}
                      rows={2}
                    />
                  </label>
                  <label className="field">
                    <span>Application method</span>
                    <textarea
                      value={serviceDraft.application_method}
                      onChange={(event) =>
                        setServiceDraft({
                          ...serviceDraft,
                          application_method: event.target.value,
                        })
                      }
                      maxLength={1000}
                      rows={2}
                    />
                  </label>
                  <label className="field">
                    <span>
                      Official HTTPS URL (leave blank unless verified)
                    </span>
                    <input
                      type="url"
                      pattern="https://.*"
                      value={serviceDraft.official_url}
                      onChange={(event) =>
                        setServiceDraft({
                          ...serviceDraft,
                          official_url: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={serviceDraft.official_url_verified}
                      onChange={(event) =>
                        setServiceDraft({
                          ...serviceDraft,
                          official_url_verified: event.target.checked,
                        })
                      }
                    />
                    <span>
                      I verified this is the responsible authority's official
                      URL.
                    </span>
                  </label>
                  <div className="field-grid">
                    <label className="consent-check">
                      <input
                        type="checkbox"
                        checked={serviceDraft.is_active}
                        onChange={(event) =>
                          setServiceDraft({
                            ...serviceDraft,
                            is_active: event.target.checked,
                          })
                        }
                      />
                      <span>Active</span>
                    </label>
                    <label className="consent-check">
                      <input
                        type="checkbox"
                        checked={serviceDraft.is_featured}
                        onChange={(event) =>
                          setServiceDraft({
                            ...serviceDraft,
                            is_featured: event.target.checked,
                          })
                        }
                      />
                      <span>Featured</span>
                    </label>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setEditingService(null)}
                    >
                      Cancel
                    </button>
                    <button className="button button-dark" disabled={busy}>
                      {busy ? "Saving…" : "Save service"} <Check size={15} />
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
          {editingCategory && (
            <div
              className="modal-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget)
                  setEditingCategory(null);
              }}
            >
              <section
                className="admin-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="category-edit-title"
              >
                <div className="modal-head">
                  <div>
                    <span className="eyebrow">
                      CATEGORY · {editingCategory.slug}
                    </span>
                    <h2 id="category-edit-title">Edit category</h2>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Close category editor"
                    onClick={() => setEditingCategory(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={saveCategoryEdit}>
                  <label className="field">
                    <span>Category name</span>
                    <input
                      value={categoryDraft.name}
                      onChange={(event) =>
                        setCategoryDraft({
                          ...categoryDraft,
                          name: event.target.value,
                        })
                      }
                      minLength={2}
                      maxLength={100}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <textarea
                      value={categoryDraft.description}
                      onChange={(event) =>
                        setCategoryDraft({
                          ...categoryDraft,
                          description: event.target.value,
                        })
                      }
                      maxLength={500}
                      rows={3}
                    />
                  </label>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setEditingCategory(null)}
                    >
                      Cancel
                    </button>
                    <button className="button button-dark" disabled={busy}>
                      {busy ? "Saving…" : "Save category"} <Check size={15} />
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function ContactPage() {
  const settings = useSiteSettings();
  return (
    <main className="content-page">
      <PageIntro
        eyebrow="CONTACT"
        title="A conversation is a good place to start."
        copy="Reach BABA'S CYBER CAFE in Srinagar for service enquiries, application assistance or help with an existing reference."
      />
      <SocialPreviewSection />
      <div className="contact-grid">
        <a
          href={`tel:${settings.contact.phone.replace(/[^+\d]/g, "")}`}
          className="contact-card"
        >
          <span>
            <MessageCircle size={21} />
          </span>
          <small>CALL OR WHATSAPP</small>
          <strong>{settings.contact.phone}</strong>
          <p>For a quick enquiry or follow-up.</p>
          <ArrowUpRight size={16} />
        </a>
        <a href={`mailto:${settings.contact.email}`} className="contact-card">
          <span>
            <FileText size={21} />
          </span>
          <small>EMAIL</small>
          <strong>{settings.contact.email}</strong>
          <p>Send a detailed question by email.</p>
          <ArrowUpRight size={16} />
        </a>
        <a
          href={settings.social.facebook}
          target="_blank"
          rel="noreferrer"
          className="contact-card"
        >
          <span>
            <Globe2 size={21} />
          </span>
          <small>FOLLOW</small>
          <strong>Facebook</strong>
          <p>Visit our Facebook page.</p>
          <ArrowUpRight size={16} />
        </a>
        {settings.social.instagram && (
          <a
            href={settings.social.instagram}
            target="_blank"
            rel="noreferrer"
            className="contact-card"
          >
            <span>
              <Instagram size={21} />
            </span>
            <small>FOLLOW</small>
            <strong>Instagram</strong>
            <p>Visit our Instagram page.</p>
            <ArrowUpRight size={16} />
          </a>
        )}
        <a
          href={settings.social.business_profile}
          target="_blank"
          rel="noreferrer"
          className="contact-card"
        >
          <span>
            <Building2 size={21} />
          </span>
          <small>BUSINESS PROFILE</small>
          <strong>Google Business Profile</strong>
          <p>Open the shared business profile.</p>
          <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="location-note">
        <Landmark size={20} />
        <div>
          <h2>Based in Srinagar, Jammu &amp; Kashmir</h2>
          <p>
            We have not published a street address or map pin. Use the verified
            business profile or contact us for directions.
          </p>
          <a
            className="text-link"
            href={settings.social.business_profile}
            target="_blank"
            rel="noreferrer"
          >
            Get directions via Google Business Profile{" "}
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </main>
  );
}

function LegalPage({ privacy = false }: { privacy?: boolean }) {
  return (
    <main className="content-page legal-page">
      <PageIntro
        eyebrow={privacy ? "PRIVACY" : "TERMS"}
        title={
          privacy
            ? "Your information deserves care."
            : "Clear terms for assistance."
        }
        copy={
          privacy
            ? "This policy explains what information may be collected when you enquire with BABA'S CYBER CAFE."
            : "These terms describe the independent assistance services offered by BABA'S CYBER CAFE."
        }
      />
      <article className="legal-copy">
        <p className="legal-updated">Last updated: 2 November 2026</p>
        {privacy ? (
          <>
            <h2>Information we collect</h2>
            <p>
              If you submit an application enquiry, we collect the name, mobile
              number, email, selected service and details you provide. Do not
              submit passwords, bank details, PINs or one-time passcodes.
            </p>
            <h2>How information is used</h2>
            <p>
              Information is used to respond to enquiries, provide application
              assistance, share status updates and maintain service records. We
              do not sell personal information.
            </p>
            <h2>Storage and access</h2>
            <p>
              Once the secure backend is configured, application data is stored
              in Supabase with access controls. Documents are stored in private
              storage and shared only when approved. System availability depends
              on the configured service providers.
            </p>
            <h2>Your choices</h2>
            <p>
              You may contact us to request access, correction or deletion,
              subject to legal and operational record-keeping requirements.
              Email <a href={`mailto:${email}`}>{email}</a>.
            </p>
            <h2>Third-party services</h2>
            <p>
              Authentication, hosting and email providers may process
              information to operate the portal. WhatsApp, Facebook, Instagram
              and Google links are governed by their own privacy policies. Do
              not use the portal for emergencies.
            </p>
            <h2>Contact</h2>
            <p>
              BABA'S CYBER CAFE · Srinagar, Jammu &amp; Kashmir ·{" "}
              <a href={`tel:+917006865909`}>{phone}</a>.
            </p>
          </>
        ) : (
          <>
            <h2>Independent assistance only</h2>
            <p>
              BABA'S CYBER CAFE is not a government office,
              government-authorised centre, insurer, bank or department
              representative. Assistance does not guarantee submission
              acceptance, eligibility, approval or a specific outcome.
            </p>
            <h2>Official processes and information</h2>
            <p>
              The responsible authority controls application rules, required
              documents, fees, processing times and decisions. Confirm current
              requirements directly with that authority. No prices are published
              on this website.
            </p>
            <h2>Customer responsibilities</h2>
            <p>
              Provide accurate information and only documents you are permitted
              to share. Never share passwords, PINs or OTPs. Keep tracking
              references private and use the registered mobile number for
              verification.
            </p>
            <h2>Availability and communication</h2>
            <p>
              Online services depend on configured third-party systems and may
              be unavailable. A confirmation email is sent only when the email
              integration is configured and reports success. WhatsApp is an
              optional communication channel.
            </p>
            <h2>Contact</h2>
            <p>
              Questions about these terms:{" "}
              <a href={`mailto:${email}`}>{email}</a> or{" "}
              <a href="tel:+917006865909">{phone}</a>.
            </p>
          </>
        )}
      </article>
    </main>
  );
}

function NotFound() {
  return (
    <main className="content-page not-found">
      <span className="eyebrow">404 · NOT FOUND</span>
      <h1>This page isn't here.</h1>
      <p>The link may have changed. Let's find the right place.</p>
      <Link className="button button-dark" to="/">
        Back to home <ArrowRight size={16} />
      </Link>
    </main>
  );
}


function SoundControls() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return window.localStorage.getItem("baba-site-sound") !== "off";
    } catch {
      return true;
    }
  });
  const enabledRef = useRef(enabled);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
    try {
      window.localStorage.setItem("baba-site-sound", enabled ? "on" : "off");
    } catch {
      // Sound preference remains available for this page session.
    }
  }, [enabled]);

  useEffect(() => {
    const playTone = (kind: "tap" | "submit") => {
      if (!enabledRef.current) return;
      try {
        const AudioContextClass = window.AudioContext;
        if (!AudioContextClass) return;
        const context = audioRef.current ?? new AudioContextClass();
        audioRef.current = context;
        if (context.state === "suspended") void context.resume();
        const now = context.currentTime;
        const notes = kind === "submit" ? [660, 880] : [520];
        notes.forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const start = now + index * 0.085;
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, start);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(kind === "submit" ? 0.045 : 0.022, start + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.075);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + 0.08);
        });
      } catch {
        // Audio is an enhancement; it must never interrupt a customer action.
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest("a,button,[role='button'],summary,input[type='submit'],input[type='button'],select");
      if (!control || control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true") return;
      if (control.closest("[data-sound-control]")) return;
      playTone("tap");
    };
    const onSubmit = (event: Event) => {
      if (event.target instanceof HTMLFormElement) playTone("submit");
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      void audioRef.current?.close();
      audioRef.current = null;
    };
  }, []);

  return (
    <button
      className="sound-control"
      type="button"
      data-sound-control
      aria-label={enabled ? "Turn interface sounds off" : "Turn interface sounds on"}
      aria-pressed={enabled}
      title={enabled ? "Sound on · click to mute" : "Sound off · click to enable"}
      onClick={() => setEnabled((value) => !value)}
    >
      {enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
      <span>{enabled ? "Sound on" : "Sound off"}</span>
    </button>
  );
}

function RoutedApp() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    const privateRoute = ["/admin", "/dashboard", "/apply", "/track", "/pay", "/investigation", "/grievance/admin"].some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
    const categorySlug = path.startsWith("/services/")
      ? path.split("/").at(-1)
      : "";
    const category = categories.find((item) => item.slug === categorySlug);
    const titles: Record<string, string> = {
      "/": "BABA'S CYBER CAFE | Digital Service Assistance in Srinagar",
      "/about": "About Us | BABA'S CYBER CAFE",
      "/services": "Service Directory | BABA'S CYBER CAFE",
      "/apply": "New Enquiry | BABA'S CYBER CAFE",
      "/track": "Track Application | BABA'S CYBER CAFE",
      "/dashboard": "Customer Dashboard | BABA'S CYBER CAFE",
      "/contact": "Contact | BABA'S CYBER CAFE",
      "/privacy": "Privacy Policy | BABA'S CYBER CAFE",
      "/terms": "Terms & Conditions | BABA'S CYBER CAFE",
      "/admin": "Owner Dashboard | BABA'S CYBER CAFE",
      "/admin/login": "Secure Admin Login | BABA'S CYBER CAFE",
      "/investigation": "Investigation Portal | BABA'S CYBER CAFE",
      "/grievance": "Grievance Redressal | BABA'S CYBER CAFE",
      "/grievance/admin": "Grievance Management | BABA'S CYBER CAFE",
    };
    document.title = category
      ? `${category.name} Assistance | BABA'S CYBER CAFE`
      : (titles[path] ?? "BABA'S CYBER CAFE | Srinagar");
    const robots = document.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    if (robots)
      robots.content = privateRoute ? "noindex,nofollow" : "index,follow";
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (canonical)
      canonical.href = `https://babacybercafe.in${path === "/" ? "/" : path}`;
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (description)
      description.content = privateRoute
        ? "Secure application services for BABA'S CYBER CAFE customers."
        : "Independent digital application and document assistance from BABA'S CYBER CAFE in Srinagar, Jammu & Kashmir.";
  }, [location.pathname]);
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:category" element={<CategoryRoute />} />
        <Route path="/insurance" element={<ServicesPage fixedCategory="insurance" />} />
        <Route path="/apply" element={<ApplicationPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/dashboard" element={<CustomerDashboard />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<LegalPage privacy />} />
        <Route path="/terms" element={<LegalPage />} />
        <Route path="/pay" element={<PaymentPortal />} />
        <Route path="/admin/payments" element={<PaymentPortal admin />} />
        <Route path="/admin/login" element={<AdminPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/investigation" element={<InvestigationPage />} />
        <Route path="/grievance" element={<GrievancePage />} />
        <Route path="/grievance/admin" element={<AdminGrievancePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
      <SoundControls />
      <CustomerChatAssistant />
    </>
  );
}

function CategoryRoute() {
  const categoryList = useCategoryList();
  const { category: slug = "" } = useParams();
  const category = categoryList.find((item) => item.slug === slug);
  return category ? (
    <ServicesPage fixedCategory={category.slug} key={category.slug} />
  ) : (
    <NotFound />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RoutedApp />
    </BrowserRouter>
  );
}
