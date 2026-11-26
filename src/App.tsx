import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
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
  ArrowLeft,
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
  Printer,
  UploadCloud,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { getServiceRequirement } from "./serviceRequirements";
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
const GrievancePage = lazy(() => import("./pages/GrievancePage"));
const SmartQrPortal = lazy(() => import("./pages/SmartQrPortal"));
const AdminGrievancePage = lazy(() => import("./pages/AdminGrievancePage"));
const FeedbackCentre = lazy(() => import("./pages/FeedbackCentre"));
const PaymentPortal = lazy(() => import("./pages/PaymentPortal"));
const ChallanPortal = lazy(() => import("./pages/ChallanPortal"));
const InsurancePortal = lazy(() => import("./pages/InsurancePortal"));
const InstantTPPreview = lazy(() => import("./pages/InstantTPPreview"));
const PrintPortal = lazy(() => import("./pages/PrintPortal"));
const PrintAdminPortal = lazy(() => import("./pages/PrintAdminPortal"));
const InstantApiAdminPortal = lazy(() => import("./pages/InstantApiAdminPortal"));
const InstantApiCustomerPortal = lazy(() => import("./pages/InstantApiCustomerPortal"));
const CustomerChatAssistant = lazy(() => import("./components/CustomerChatAssistant"));
import "./App.css";
import "./cyber-theme.css";
import "./portal-experience.css";
import "./performance-mobile.css";
import "./vip-experience.css";
import FreeEnhancements from "./components/FreeEnhancements";
import { VipAboutExperience, VipFaqPage, VipHomeExperience } from "./components/VipExperience";

function csvFlag(value?: string, fallback = false) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return fallback;
}

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
          <NavLink to="/instant-services" onClick={close}>Instant Services</NavLink>
          <NavLink to="/challan" onClick={close}>Check Challan</NavLink>
          <NavLink to="/dashboard" onClick={close}>Security Vault</NavLink>
          <NavLink to="/track" onClick={close}>Track Reference</NavLink>
          <NavLink to="/about" onClick={close}>About Us</NavLink>
          <NavLink to="/faq" onClick={close}>FAQ</NavLink>
          <NavLink to="/contact" onClick={close}>Direct Contact</NavLink>
          <Link className="nav-button" to="/track" onClick={close}>Track Application <ArrowUpRight size={15}/></Link>
          <Link className="owner-entry-link" to="/admin/login" onClick={close}><LockKeyhole size={14}/> Owner Login</Link>
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
          <Link to="/challan">Check traffic challan</Link>
          <Link to="/services/insurance">Insurance services</Link>
          <Link to="/insurance">Request an insurance quotation</Link>
          <Link to="/about">About us</Link>
          <Link to="/faq">FAQs &amp; Help Centre</Link>
          <Link to="/contact">Contact</Link>
        </div>
        <div>
          <h3>Your applications</h3>
          <Link to="/apply">New enquiry</Link>
          <Link to="/track">Track an application</Link>
          <Link to="/pay">Make a payment</Link>
          <Link to="/dashboard">Customer dashboard</Link>
          <Link to="/admin/login">Admin sign-in</Link>
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
  const [homeServiceQuery, setHomeServiceQuery] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [trackingMobile, setTrackingMobile] = useState("");
  const [trackingRecord, setTrackingRecord] = useState<TrackedRecord | null>(null);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingError, setTrackingError] = useState("");

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

      <section className="customer-shortcuts" aria-label="Quick customer actions">
        <a className="customer-shortcut shortcut-whatsapp" href={`https://wa.me/${settings.contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Hi, I need help from BABA'S CYBER CAFE.")}`} target="_blank" rel="noreferrer"><MessageCircle/><span>WhatsApp</span><small>واٹس ایپ</small></a>
        <a className="customer-shortcut shortcut-call" href={`tel:${settings.contact.phone.replace(/[^+\d]/g, "")}`}><PhoneCall/><span>Call us</span><small>کال کریں</small></a>
        <a className="customer-shortcut shortcut-docs" href="#services"><FileCheck2/><span>Documents Needed</span><small>ضروری کاغذات</small></a>
        <Link className="customer-shortcut shortcut-track" to="/track"><Search/><span>Track My Application</span><small>درخواست ٹریک کریں</small></Link>
      </section>
      <section className="homepage-service-search" aria-label="Search services">
        <div><span className="cyber-eyebrow">FIND A SERVICE</span><h2>What do you need help with?</h2><p>Search by service or department name.</p></div>
        <form onSubmit={(event) => { event.preventDefault(); navigate(`/services?search=${encodeURIComponent(homeServiceQuery.trim())}`); }}>
          <Search size={20}/><input type="search" value={homeServiceQuery} onChange={(event)=>setHomeServiceQuery(event.target.value)} placeholder="Search PAN, Domicile, Insurance, RTO…" aria-label="Search services"/><button type="submit">Search</button>
        </form>
      </section>

      <section className="cyber-command-wrap">
        <div className="cyber-command-intro"><span className="cyber-eyebrow">QUICK COMMAND</span><h2>Where would you like to go?</h2></div>
        <div className="cyber-command-grid">
          <form className="cyber-command-card" onSubmit={(event) => { event.preventDefault(); navigate("/track", { state: { trackingId: quickReference.trim() } }); }}>
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
            {["Reference Received","Department Filing","Scrutiny","Issued / Ready"].map((label,index)=><div className={currentStage===index ? "cyber-pipeline-step is-current" : currentStage>index ? "cyber-pipeline-step is-done" : "cyber-pipeline-step"} key={label}><span>{currentStage>index ? <Check size={14}/> : String(index+1).padStart(2,"0")}</span><b>{label}</b></div>)}
          </div>
          <p className="cyber-pipeline-note">{trackingRecord ? `Current application status: ${statusLabels.find((label) => label === trackingRecord.status) ?? trackingRecord.status}. The pipeline is an indicative view; final decisions are made by the relevant authority.` : "Typical workflow stages are shown above. Verify your reference to view your actual application status."}</p>
        </div>
      </section>

      <section className="tp-home-promo" aria-labelledby="tp-home-title">
        <div className="tp-home-promo-icon"><CarFront size={30}/><ShieldCheck size={16}/></div>
        <div className="tp-home-promo-copy">
          <span className="cyber-eyebrow">MOTOR INSURANCE · DIGITAL SERVICE DESK</span>
          <h2 id="tp-home-title">Third-Party Motor Insurance <em>made simpler.</em></h2>
          <p>Submit your vehicle details, receive the exact premium after our team confirms the insurer quote, pay manually through UPI, submit your UTR and track payment verification and policy processing in one place.</p>
          <div className="tp-home-feature-row"><span><Check size={13}/> Manual UPI payment</span><span><Check size={13}/> UTR verification</span><span><Check size={13}/> Policy PDF delivery</span></div>
        </div>
        <div className="tp-home-promo-action"><span className="tp-home-promo-tag"><i/> SERVICE PREVIEW</span><Link className="cyber-button cyber-button-primary" to="/instant-tp-preview">Explore TP Insurance <ArrowUpRight size={16}/></Link><small>Payment is verified by our admin before the policy is issued.</small></div>
      </section>
      <DepartmentServiceExplorer />

      <section className="cyber-concierge">
        <div><span className="cyber-eyebrow">DIRECT CONCIERGE · SRINAGAR LOCAL DESK</span><h2>Real help. <em>Right here.</em></h2><p>Speak with our team about services, application requirements and next steps.</p><div className="cyber-contact-actions"><a className="cyber-button cyber-button-primary" href={`https://wa.me/${settings.contact.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp desk <span className="cyber-online-dot"/></a><a className="cyber-button cyber-button-ghost" href={`tel:${settings.contact.phone.replace(/[^+\d]/g,"")}`}><PhoneCall size={16}/> {settings.contact.phone}</a></div></div>
        <div className="cyber-location-card"><span className="cyber-location-icon"><MapPin size={23}/></span><span className="cyber-eyebrow">OUR SERVICE AREA</span><h3>Srinagar, Jammu &amp; Kashmir</h3><p>For the exact business pin, opening hours and directions, use our verified Google Business Profile.</p><a href={settings.social.business_profile} target="_blank" rel="noreferrer">Open Google Business Profile <ArrowUpRight size={15}/></a></div>
      </section>
      <section className="cyber-social-wrap"><SocialPreviewSection/></section>
      <VipHomeExperience />
      <FreeEnhancements reviewUrl={settings.social.business_profile} />
      <section className="cyber-contact-band"><div><span className="cyber-eyebrow">NEED A HAND?</span><h2>Start with a clear conversation.</h2></div><Link to="/contact" className="cyber-button cyber-button-primary">Contact BABA'S CYBER CAFE <ArrowRight size={16}/></Link></section>
    </main>
  );
}


function DepartmentServiceExplorer() {
  const categoryList = useCategoryList();
  const navigate = useNavigate();
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceList, setServiceList] = useState<ServiceRecord[]>(seedServices);
  const [loadingServices, setLoadingServices] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let current = true;
    void supabase.from("services").select("*").eq("is_active", true).order("name").range(0, 999)
      .then(({ data }) => {
        if (!current) return;
        if (data?.length) setServiceList(data as ServiceRecord[]);
        setLoadingServices(false);
      }, () => {
        if (current) setLoadingServices(false);
      });
    return () => { current = false; };
  }, []);

  const departments = categoryList.filter((item) => item.slug !== "all");
  const selected = departments.find((item) => item.slug === selectedDepartment);
  const selectedServices = serviceList.filter((item) => item.category_slug === selectedDepartment && item.is_active !== false);
  const matchingServices = serviceList.filter((item) => {
    if (item.is_active === false) return false;
    const requirement = getServiceRequirement(item.name);
    const haystack = [item.name, categoryLabel(item.category_slug, categoryList), item.description, ...requirement.documents, ...(item.required_documents ?? [])].join(" ").toLowerCase();
    return haystack.includes(serviceQuery.trim().toLowerCase());
  });
  const uploadPrint = selectedDepartment === "upload-print";

  const openServiceFor = (departmentSlug: string, name: string) => {
    navigate(`/apply?department=${encodeURIComponent(departmentSlug)}&service=${encodeURIComponent(name)}`);
  };
  const openService = (name: string) => openServiceFor(selectedDepartment, name);

  return (
    <section className="neon-directory" id="services">
      <div className="neon-directory-heading">
        <div>
          <span className="cyber-eyebrow">BABA'S CYBER CAFE · SERVICE DIRECTORY</span>
          <h2>{selected ? <><>{selected.name}</> <em>Services</em></> : <>Explore our <em>departments.</em></>}</h2>
          <p>{selected ? selected.description : "Choose a department to discover the services and assistance available."}</p>
        </div>
        {selected && <button className="neon-back-button" type="button" onClick={() => setSelectedDepartment("")}><ArrowLeft size={16}/> Back to Departments</button>}
      </div>

      <label className="service-instant-search">
        <Search size={19} aria-hidden="true"/>
        <input type="search" value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Search services or required documents…" aria-label="Search services and required documents"/>
        {serviceQuery && <button type="button" onClick={() => setServiceQuery("")} aria-label="Clear search"><X size={17}/></button>}
      </label>

      {serviceQuery.trim() ? (
        <div className="neon-card-grid" aria-live="polite">
          {matchingServices.length ? matchingServices.map((service, index) => {
            const documents = service.required_documents?.length ? service.required_documents : getServiceRequirement(service.name).documents;
            return (
              <button className={`neon-directory-card neon-service-card neon-tone-${index % 6}`} type="button" key={service.id} onClick={() => openServiceFor(service.category_slug, service.name)}>
                <span className="neon-icon-badge"><FileCheck2 size={22}/></span>
                <strong>{service.name}</strong>
                <small>{categoryLabel(service.category_slug, categoryList)}</small>
                <span className="service-document-preview">Documents: {documents.slice(0, 2).join(" · ")}</span>
                <span className="neon-card-arrow"><ArrowUpRight size={16}/></span>
              </button>
            );
          }) : <p className="neon-empty-state">No matching service found. Try another keyword or contact our service desk.</p>}
        </div>
      ) : null}

      {!selected && !serviceQuery.trim() && (
        <div className="neon-card-grid">
          {departments.map((department, index) => (
            <button className={`neon-directory-card neon-tone-${index % 6}`} type="button" key={department.slug} onClick={() => setSelectedDepartment(department.slug)}>
              <span className="neon-icon-badge"><CategoryIcon slug={department.slug}/></span>
              <strong>{department.name}</strong>
              <small>View all services</small>
              <span className="neon-card-arrow"><ArrowUpRight size={16}/></span>
            </button>
          ))}
          <button className="neon-directory-card neon-tone-4" type="button" onClick={() => setSelectedDepartment("upload-print")}>
            <span className="neon-icon-badge"><Printer size={22}/></span>
            <strong>Upload &amp; Print</strong>
            <small>Upload documents or print files</small>
            <span className="neon-card-arrow"><ArrowUpRight size={16}/></span>
          </button>
        </div>
      )}

      {selected && !uploadPrint && !serviceQuery.trim() && (
        <div className="neon-card-grid">
          {selectedServices.length ? selectedServices.map((service, index) => (
            <button className={`neon-directory-card neon-service-card neon-tone-${index % 6}`} type="button" key={service.id} onClick={() => openService(service.name)}>
              <span className="neon-icon-badge"><FileCheck2 size={22}/></span>
              <strong>{service.name}</strong>
              <small>Apply Online · View requirements</small>
              {service.is_featured && <span className="neon-popular-badge">POPULAR</span>}
              <span className="neon-card-arrow"><ArrowUpRight size={16}/></span>
            </button>
          )) : <p className="neon-empty-state">No active services are listed in this department yet. Please contact our service desk for assistance.</p>}
        </div>
      )}

      {uploadPrint && !serviceQuery.trim() && (
        <div className="neon-card-grid">
          <Link className="neon-directory-card neon-tone-4" to="/print">
            <span className="neon-icon-badge"><UploadCloud size={22}/></span>
            <strong>Upload Documents</strong>
            <small>Send files securely for printing</small>
            <span className="neon-card-arrow"><ArrowUpRight size={16}/></span>
          </Link>
          <Link className="neon-directory-card neon-tone-2" to="/print">
            <span className="neon-icon-badge"><Printer size={22}/></span>
            <strong>Print Documents</strong>
            <small>Prepare and print your files</small>
            <span className="neon-card-arrow"><ArrowUpRight size={16}/></span>
          </Link>
        </div>
      )}
      {selected && !serviceQuery.trim() && <p className="neon-directory-note">{loadingServices ? "Syncing the latest service list…" : "Service availability and official decisions depend on the relevant authority."}</p>}
    </section>
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
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [category, setCategory] = useState(fixedCategory ?? "all");
  const [department, setDepartment] = useState("all");
  const [sort, setSort] = useState("featured");
  const [page, setPage] = useState(1);
  const [remoteServices, setRemoteServices] = useState<ServiceRecord[]>([]);
  const [remoteCount, setRemoteCount] = useState(0);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const pageSize = 12;

  useEffect(() => {
    const refresh = () => setCatalogVersion((version) => version + 1);
    window.addEventListener("catalog-updated", refresh);
    return () => window.removeEventListener("catalog-updated", refresh);
  }, []);

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
  }, [catalogVersion, category, department, page, search, sort]);

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
      {fixedCategory === "insurance" && (
        <div className="catalog-quote-cta">
          <p>Need a motor policy quotation? Share your vehicle details and check available insurer options securely.</p>
          <Link className="button button-gold" to="/insurance">Request an insurance quotation <ArrowUpRight size={14} /></Link>
        </div>
      )}
      <ServiceGuidancePanel category={activeCategory} />
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
            src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800&q=72"
            alt="People collaborating at a bright workspace"
            loading="lazy"
            decoding="async"
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
      <VipAboutExperience />
    </main>
  );
}

function printApplicationReceipt(details: {
  trackingId: string;
  fullName: string;
  mobile: string;
  email: string;
  department: string;
  service: string;
  submittedAt: string;
  status: string;
}) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.alert("Please allow pop-ups for this website to generate your receipt.");
    return;
  }
  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character] ?? character);
  const rows = [
    ["Customer name", details.fullName],
    ["Mobile number", details.mobile],
    ["Email address", details.email],
    ["Department", details.department],
    ["Service / enquiry", details.service],
    ["Submission date", new Date(details.submittedAt).toLocaleString("en-IN")],
    ["Current status", details.status],
  ];
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt ${escapeHtml(details.trackingId)}</title><style>
    *{box-sizing:border-box}body{margin:0;padding:32px;background:#f4f1e9;color:#171713;font:14px/1.55 Arial,sans-serif}
    .receipt{max-width:720px;margin:0 auto;padding:38px;background:#fff;border:1px solid #d8d0bd}
    .brand{font-size:22px;font-weight:800;letter-spacing:1.5px}.sub{color:#786c52;font-size:10px;letter-spacing:2px;margin-top:4px}
    .rule{height:3px;background:#b99b5c;margin:22px 0}.heading{font-size:22px;margin:0 0 5px}.muted{color:#666;font-size:12px}
    .reference{margin:24px 0;padding:20px;background:#171713;color:#fff;border-left:5px solid #c7a45e}
    .reference small{display:block;color:#e6d6b3;font-size:10px;letter-spacing:2px}.reference strong{display:block;margin-top:7px;color:#fff;font:bold 26px/1.3 Arial,sans-serif;letter-spacing:1px;overflow-wrap:anywhere}
    table{width:100%;border-collapse:collapse;margin-top:18px}td{padding:11px 8px;border-bottom:1px solid #e9e5dc;vertical-align:top}td:first-child{width:38%;color:#696457;font-size:12px}
    .notice{margin-top:22px;padding:14px;background:#f6f3ec;color:#504a3d;font-size:11px}
    .footer{margin-top:28px;padding-top:14px;border-top:1px solid #ddd5c5;color:#777;font-size:10px}
    .actions{display:flex;justify-content:flex-end;margin:0 auto 14px;max-width:720px}.actions button{padding:10px 18px;background:#171713;color:#fff;border:0;border-radius:4px;font-weight:700}
    @media print{body{padding:0;background:#fff}.receipt{border:0;max-width:none;padding:24px}.actions{display:none}@page{size:A4;margin:12mm}}
  </style></head><body><div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div><main class="receipt">
    <div class="brand">BABA'S CYBER CAFE</div><div class="sub">SERVICE CENTRE · SRINAGAR, JAMMU &amp; KASHMIR</div><div class="rule"></div>
    <h1 class="heading">Application submission receipt</h1><div class="muted">Acknowledgement of your enquiry / service request</div>
    <section class="reference"><small>YOUR TRACKING REFERENCE</small><strong>${escapeHtml(details.trackingId)}</strong></section>
    <table>${rows.map(([label,value]) => `<tr><td>${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`).join("")}</table>
    <div class="notice"><strong>Important:</strong> This receipt confirms that BABA'S CYBER CAFE has received your enquiry. It is not a government approval, service completion certificate, payment receipt, or guarantee of acceptance by any department or insurer. Keep your tracking reference and registered mobile number to check updates.</div>
    <div class="footer">For assistance: +91 7006865909 · support@babacybercafe.in<br>Thank you for choosing BABA'S CYBER CAFE — Your Trust, Our Service.</div>
  </main></body></html>`);
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 350);
}

function ServiceGuidancePanel({ category }: { category?: Category }) {
  if (!category) return null;
  const services = seedServices.filter((item) => item.category_slug === category.slug);
  return (
    <section className="service-guidance-panel" aria-label={`${category.name} document requirements and FAQs`}>
      <div className="service-guidance-heading"><span className="cyber-eyebrow">BEFORE YOU APPLY</span><h2>Documents Required <em>درکار کاغذات</em></h2><p>Use this as a starting checklist. The responsible department may ask for additional documents.</p></div>
      <div className="service-guidance-list">
        {services.map((service) => {
          const docs = service.required_documents?.length ? service.required_documents : getServiceRequirement(service.name).documents;
          const message = `Hi, I need help with ${service.name}. Please confirm the required documents and next steps.`;
          return <details className="service-guidance-item" key={service.id}>
            <summary>{service.name}<ChevronDown size={17}/></summary>
            <ul>{docs.map((doc) => <li key={doc}>{doc}</li>)}</ul>
            <a className="service-doc-whatsapp" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle size={15}/> Send documents on WhatsApp</a>
          </details>;
        })}
      </div>
      <div className="service-guidance-faq"><h3>Quick FAQs</h3>
        <details><summary>How long does the process take?<ChevronDown size={16}/></summary><p>Processing time depends on the service and the responsible department or provider. We will explain the current process; no timeline or approval is guaranteed.</p></details>
        <details><summary>What is the approximate fee?<ChevronDown size={16}/></summary><p>Official fees vary by service and applicant. We do not publish rates on this website. Any applicable official fee will be confirmed before you proceed.</p></details>
        <details><summary>What should I bring?<ChevronDown size={16}/></summary><p>Bring the original identity document and copies of the items listed for your service. Never share passwords, PINs or OTPs.</p></details>
      </div>
    </section>
  );
}

function ApplicationPage() {
  const settings = useSiteSettings();
  const [params] = useSearchParams();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [service, setService] = useState(params.get("service") ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const serviceOptions = [...new Set(seedServices.map((item) => item.name))].sort((a,b) => a.localeCompare(b));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{10}$/.test(mobile.replace(/\D/g, ""))) { setError("Please enter a valid 10-digit mobile number."); return; }
    const text = ["New customer enquiry — BABA'S CYBER CAFE", `Name: ${name.trim()}`, `Phone: +91 ${mobile.replace(/\D/g, "")}`, `Service: ${service}`, `Message: ${message.trim() || "Please contact me with the next steps."}`].join("\n");
    window.open(`https://wa.me/${settings.contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
  return (
    <main className="content-page narrow-page">
      <PageIntro eyebrow="QUICK ENQUIRY" title="Tell us what you need." copy="Fill in four short details. WhatsApp will open with your message ready to send to our team." />
      <form className="form-panel quick-whatsapp-form" onSubmit={submit}>
        <label className="field"><span>Name <i>*</i></span><input value={name} onChange={(event)=>setName(event.target.value)} placeholder="Your full name" autoComplete="name" required maxLength={100}/></label>
        <label className="field"><span>Phone <i>*</i></span><input type="tel" value={mobile} onChange={(event)=>setMobile(event.target.value)} placeholder="10-digit mobile number" autoComplete="tel-national" inputMode="numeric" required maxLength={15}/></label>
        <label className="field"><span>Service <i>*</i></span><select value={service} onChange={(event)=>setService(event.target.value)} required><option value="">Choose a service</option>{serviceOptions.map((item)=><option value={item} key={item}>{item}</option>)}</select></label>
        <label className="field"><span>Message</span><textarea value={message} onChange={(event)=>setMessage(event.target.value)} placeholder="Tell us briefly what help you need…" rows={4} maxLength={1000}/></label>
        {error && <p className="cyber-error" role="alert">{error}</p>}
        <button className="cyber-button cyber-button-primary" type="submit"><MessageCircle size={17}/> Send enquiry on WhatsApp</button>
        <p className="field-helper">Your message is sent only after you review and press Send in WhatsApp. Do not share passwords, PINs or OTPs.</p>
      </form>
    </main>
  );
}

type CustomerPaymentSummary = {
  application: { tracking_id: string; full_name: string; mobile: string; service_name: string };
  payment: { amount: number | string; status: "pending" | "claimed" | "paid" | "needs_review"; claimed_utr?: string | null; utr?: string | null; paid_at?: string | null };
};

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
  const location = useLocation();
  const navigate = useNavigate();
  const initialTrackingId = (location.state as { trackingId?: unknown } | null)?.trackingId;
  const [trackingId, setTrackingId] = useState(typeof initialTrackingId === "string" ? initialTrackingId : "");
  const [mobile, setMobile] = useState("");
  const [record, setRecord] = useState<TrackedRecord | null>(null);
  const [payment, setPayment] = useState<CustomerPaymentSummary | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setRecord(null);
    setPayment(null);
    setPaymentError("");
    try {
      const verifiedTracking = await callFunction<TrackedRecord>("track-application", {
        trackingId,
        mobile,
      });
      setRecord(verifiedTracking);
      try {
        const paymentSummary = await callFunction<CustomerPaymentSummary>("payment-customer", {
          action: "lookup",
          trackingId,
          mobile,
        });
        setPayment(paymentSummary);
      } catch (paymentReason) {
        setPaymentError(paymentReason instanceof Error ? paymentReason.message : "Payment information is temporarily unavailable.");
      }
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
            <section className="combined-payment-card" aria-label="Application payment">
              <div className="combined-payment-head">
                <div><span className="eyebrow">PAYMENT OVERVIEW</span><h3>Application payment</h3><p>Check the amount and payment confirmation without looking up your application again.</p></div>
                {payment && <span className={`payment-status payment-status-${payment.payment.status}`}>{payment.payment.status === "paid" ? "Paid" : payment.payment.status === "claimed" ? "Confirmation submitted" : payment.payment.status === "needs_review" ? "Under review" : "Pending"}</span>}
              </div>
              {paymentError ? <p className="combined-payment-note">{paymentError}</p> : payment ? (
                <>
                  <div className="combined-payment-amount"><small>AMOUNT ASSIGNED</small><strong>{new Intl.NumberFormat("en-IN", {style:"currency",currency:"INR"}).format(Number(payment.payment.amount || 0))}</strong></div>
                  {payment.payment.status === "paid" ? <p className="combined-payment-note">Your payment has been verified. {payment.payment.utr ? `Verified UTR: ${payment.payment.utr}.` : ""} {payment.payment.paid_at ? `Verified on ${new Date(payment.payment.paid_at).toLocaleString("en-IN")}.` : ""}</p>
                    : payment.payment.status === "claimed" || payment.payment.status === "needs_review" ? <p className="combined-payment-note">Your payment reference has been submitted and is awaiting verification. A customer-entered UTR is not proof of credited funds.</p>
                    : Number(payment.payment.amount) > 0 ? <p className="combined-payment-note">An amount has been assigned. Continue to the secure payment page to view the UPI QR and submit your payment reference.</p>
                    : <p className="combined-payment-note">No payment amount has been assigned yet. Please check again later.</p>}
                  {payment.payment.status === "pending" && Number(payment.payment.amount) > 0 && <button type="button" className="button button-dark" onClick={() => navigate("/pay", {state:{trackingId:record.trackingId,mobile}})}>View payment options <ArrowRight size={15}/></button>}
                </>
              ) : <p className="combined-payment-note">Loading your payment information…</p>}
            </section>
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
  const destinations = [
    { number: "01", title: "Apply for a service", copy: "Choose a department, tell us what you need and receive a reference number.", action: "Start application", to: "/apply", icon: <FileCheck2 size={21}/> },
    { number: "02", title: "Track an application", copy: "Check progress and customer-visible updates using your reference and registered mobile.", action: "Track request", to: "/track", icon: <Search size={21}/> },
    { number: "03", title: "Motor insurance", copy: "Request a third-party policy quote and follow payment verification and policy delivery.", action: "Open insurance", to: "/instant-tp-preview", icon: <ShieldCheck size={21}/> },
    { number: "04", title: "Print documents", copy: "Send documents for printing and follow your print order.", action: "Open print service", to: "/print", icon: <Printer size={21}/> },
  ];
  return (
    <main className="content-page customer-hub-page">
      <div className="customer-hub-intro">
        <span className="eyebrow">BABA'S CYBER CAFE · CUSTOMER PORTAL</span>
        <h1>Your services, <em>made simple.</em></h1>
        <p>Choose what you need. We will guide you through each step and keep your application reference handy.</p>
      </div>
      <section className="customer-hub-grid" aria-label="Customer services">
        {destinations.map((item) => (
          <article className="customer-hub-card" key={item.number}>
            <div className="customer-hub-card-top"><span>{item.number}</span><i>{item.icon}</i></div>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
            <Link to={item.to}>{item.action} <ArrowRight size={16}/></Link>
          </article>
        ))}
      </section>
      <div className="customer-hub-help"><span><ShieldCheck size={18}/></span><div><b>Need a little help?</b><p>Call our Srinagar service desk at +91 7006865909 or email support@babacybercafe.in. Never share passwords, PINs or OTPs.</p></div></div>
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

type AdminFeedbackOverviewData = {
  items: Array<{
    id: string;
    reference_id: string;
    full_name: string | null;
    feedback_type: string;
    service_name: string;
    rating: number;
    message: string;
    status: string;
    created_at: string;
  }>;
  stats: { total: number; average: number; open: number; resolved: number };
};

function AdminFeedbackOverview() {
  const [overview, setOverview] = useState<AdminFeedbackOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let current = true;
    const load = async () => {
      if (!supabase) throw new Error("Feedback data is not configured.");
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Please sign in again to view feedback.");
      const result = await callFunction<AdminFeedbackOverviewData>(
        "feedback-admin",
        { action: "list", search: "", status: "", page: 0 },
        data.session.access_token,
      );
      if (current) setOverview(result);
    };
    queueMicrotask(() => {
      if (!current) return;
      setLoading(true);
      setError("");
      void load()
        .catch((reason) => {
          if (current) setError(reason instanceof Error ? reason.message : "Feedback overview could not be loaded.");
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    });
    return () => {
      current = false;
    };
  }, [refreshVersion]);

  const stats = overview?.stats;
  return (
    <section className="admin-section" aria-labelledby="admin-feedback-title">
      <div className="admin-section-head">
        <div>
          <span className="eyebrow">CUSTOMER VOICE</span>
          <h2 id="admin-feedback-title">Feedback overview</h2>
          <p>Recent customer compliments, suggestions and complaints.</p>
        </div>
        <div className="admin-portal-shortcuts">
          <button className="button button-outline" type="button" onClick={() => setRefreshVersion((value) => value + 1)} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh feedback"}
          </button>
          <Link className="button button-dark" to="/feedback">
            Manage all feedback <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <div className="metric-grid" aria-live="polite">
        <div><span>Total feedback</span><strong>{loading ? "—" : stats?.total ?? 0}</strong><small>All submissions</small></div>
        <div><span>Average rating</span><strong>{loading ? "—" : `${(stats?.average ?? 0).toFixed(1)}/5`}</strong><small>Customer experience</small></div>
        <div><span>Open cases</span><strong>{loading ? "—" : stats?.open ?? 0}</strong><small>Need review</small></div>
        <div><span>Resolved</span><strong>{loading ? "—" : stats?.resolved ?? 0}</strong><small>Resolved or closed</small></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Reference / customer</th><th>Service &amp; feedback</th><th>Rating</th><th>Status</th><th>Received</th></tr></thead>
          <tbody>
            {(overview?.items ?? []).slice(0, 5).map((item) => (
              <tr key={item.id}>
                <td><b>{item.reference_id}</b><small>{item.full_name || "Anonymous"}</small></td>
                <td><b>{item.service_name}</b><small>{item.feedback_type} · {item.message.slice(0, 90)}{item.message.length > 90 ? "…" : ""}</small></td>
                <td><span aria-label={`${item.rating} out of 5 stars`}>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</span><small>{item.rating}/5</small></td>
                <td><StatusTag status={item.status === "under_review" ? "Under Review" : item.status === "resolved" ? "Completed" : item.status === "closed" ? "Closed" : "New"} /></td>
                <td>{new Date(item.created_at).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && (overview?.items.length ?? 0) === 0 && <p className="table-empty">No customer feedback has been submitted yet.</p>}
        {!loading && !error && (overview?.items.length ?? 0) > 0 && <p className="form-footnote">Showing the latest feedback available in this dashboard preview.</p>}
      </div>
    </section>
  );
}

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
  const [documentFileName, setDocumentFileName] = useState("");
  const [adminServices, setAdminServices] = useState<ServiceRecord[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePage, setServicePage] = useState(1);
  const [serviceCount, setServiceCount] = useState(0);
  const [servicePageCount, setServicePageCount] = useState(1);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvPreviewError, setCsvPreviewError] = useState("");
  const [csvImportPhase, setCsvImportPhase] = useState("");
  const csvReview = csvRows.map((row, index) => {
    const issues: string[] = [];
    const name = row.name?.trim() ?? "";
    const category = adminCategories.find((item) => item.slug === row.category_slug?.trim());
    if (name.length < 2 || name.length > 160) issues.push("Service name must be 2–160 characters.");
    if (!category || category.is_active === false) issues.push("Choose an active department slug.");
    const officialUrl = row.official_url?.trim() ?? "";
    if (officialUrl) {
      try {
        if (new URL(officialUrl).protocol !== "https:") issues.push("Official links must use HTTPS.");
      } catch {
        issues.push("Official link is not a valid URL.");
      }
      if (!csvFlag(row.official_url_verified, false)) issues.push("Confirm the official link before importing.");
    }
    return { row, index, issues };
  });
  const csvValidCount = csvReview.filter((item) => item.issues.length === 0).length;
  const csvInvalidCount = csvReview.length - csvValidCount;
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
        setIsOwner(false);
        setError("Owner access required.");
        setReady(true);
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
    const officialUrl = serviceDraft.official_url.trim();
    if (officialUrl && (!/^https:\/\//i.test(officialUrl) || !serviceDraft.official_url_verified)) {
      setError("Use an HTTPS official website and confirm that you have checked the source.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: insertError } = await supabase.from("services").insert({
        category_slug: serviceCategory,
        name: serviceName.trim(),
        description: serviceDraft.description.trim() || "Application assistance. Confirm current requirements with the responsible authority.",
        required_documents: serviceDraft.required_documents.split("|").map((item) => item.trim()).filter(Boolean),
        eligibility: serviceDraft.eligibility.trim() || "Confirm current eligibility with the responsible authority.",
        application_method: serviceDraft.application_method.trim() || "Enquire with BABA'S CYBER CAFE for assistance. The responsible authority controls the official process.",
        official_url: officialUrl || null,
        official_url_verified: Boolean(officialUrl && serviceDraft.official_url_verified),
        is_active: true,
        is_featured: featureService,
      });
      if (insertError) throw insertError;
      setServiceName("");
      setFeatureService(false);
      setServiceDraft((draft) => ({ ...draft, description: "", required_documents: "", eligibility: "", application_method: "", official_url: "", official_url_verified: false }));
      setNotice("Service added. It is now available in the catalogue according to its active status.");
      setCatalogVersion((version) => version + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Service could not be added.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicateService(service: ServiceRecord) {
    if (!supabase) return;
    if (!window.confirm(`Create a copy of "${service.name}"? You can edit the copy before publishing it.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: insertError } = await supabase.from("services").insert({
        category_slug: service.category_slug,
        name: `${service.name} (Copy)`,
        description: service.description,
        required_documents: service.required_documents,
        eligibility: service.eligibility,
        application_method: service.application_method,
        official_url: service.official_url,
        official_url_verified: service.official_url_verified,
        is_active: false,
        is_featured: false,
      });
      if (insertError) throw insertError;
      setNotice("Draft copy created as inactive. Edit it and activate it when ready.");
      setServiceSearch(service.name);
      setServicePage(1);
      setCatalogVersion((version) => version + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Service could not be duplicated.");
    } finally {
      setBusy(false);
    }
  }
  async function previewCsv(file?: File) {
    setCsvPreviewError("");
    setError("");
    setNotice("");
    setCsvRows([]);
    setCsvFileName("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvPreviewError("Please choose a .csv file.");
      return;
    }
    if (file.size > 1_500_000) {
      setCsvPreviewError("CSV file is too large. Maximum size is 1.5 MB.");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: ({ data, errors: parseErrors, meta }) => {
        if (parseErrors.length) {
          setCsvPreviewError(`CSV could not be read: ${parseErrors[0].message}`);
          return;
        }
        const headers = new Set(meta.fields ?? []);
        if (!headers.has("name") || !headers.has("category_slug")) {
          setCsvPreviewError("CSV must include the name and category_slug columns. Download the template for the full format.");
          return;
        }
        const rows = data.filter((row) => Object.values(row).some((value) => String(value ?? "").trim()));
        if (!rows.length) {
          setCsvPreviewError("The selected CSV has no service rows.");
          return;
        }
        setCsvRows(rows);
        setCsvFileName(file.name);
      },
    });
  }

  async function submitCsvImport() {
    if (!supabase || !csvRows.length || !csvValidCount) return;
    const valid = csvReview.filter((item) => item.issues.length === 0).map((item) => item.row);
    setBusy(true);
    setError("");
    setNotice("");
    setCsvImportPhase("Checking your catalogue rows…");
    try {
      const { data: session } = await supabase.auth.getSession();
      setCsvImportPhase(`Securely importing ${valid.length} valid service rows…`);
      const result = await callFunction<{
        imported: number;
        skipped: number;
      }>("import-services", { rows: valid }, session.session?.access_token);
      setCsvImportPhase("Refreshing the service catalogue…");
      setNotice(`${result.imported} service(s) imported or updated. ${result.skipped + csvInvalidCount} row(s) skipped. Existing matching services are updated rather than duplicated.`);
      setCsvRows([]);
      setCsvFileName("");
      setCsvPreviewError("");
      setCatalogVersion((version) => version + 1);
      window.dispatchEvent(new Event("catalog-updated"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "CSV import failed.");
    } finally {
      setCsvImportPhase("");
      setBusy(false);
    }
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
              <Link className="button button-outline" to="/insurance/admin">Insurance quotation desk <ArrowUpRight size={14} /></Link>
              <Link className="button button-outline" to="/instant-tp-admin"><ShieldCheck size={14} /> Instant third-party insurance desk <ArrowUpRight size={14} /></Link>
              <Link className="button button-outline" to="/print/admin">Print orders &amp; phone printing <ArrowUpRight size={14} /></Link>
              <Link className="button button-outline" to="/admin/instant-api"><ShieldCheck size={14} /> Instant API services &amp; pricing <ArrowUpRight size={14} /></Link>
              <Link className="button button-outline" to="/feedback">Customer feedback centre <ArrowUpRight size={14} /></Link>
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
          <AdminFeedbackOverview />
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
                <details className="service-advanced-fields">
                  <summary>Advanced service details <span>Optional · documents, eligibility, process and official link</span></summary>
                  <label className="field">
                    <span>Short description</span>
                    <textarea value={serviceDraft.description} onChange={(event) => setServiceDraft({ ...serviceDraft, description: event.target.value })} rows={2} maxLength={1200} placeholder="Explain what this service helps customers with." />
                  </label>
                  <label className="field">
                    <span>Required documents (separate each with | )</span>
                    <textarea value={serviceDraft.required_documents} onChange={(event) => setServiceDraft({ ...serviceDraft, required_documents: event.target.value })} rows={2} placeholder="Aadhaar card | Photograph | Proof of address" />
                  </label>
                  <label className="field">
                    <span>Eligibility</span>
                    <textarea value={serviceDraft.eligibility} onChange={(event) => setServiceDraft({ ...serviceDraft, eligibility: event.target.value })} rows={2} maxLength={1200} placeholder="Who can apply? Mention any known conditions." />
                  </label>
                  <label className="field">
                    <span>Application method</span>
                    <textarea value={serviceDraft.application_method} onChange={(event) => setServiceDraft({ ...serviceDraft, application_method: event.target.value })} rows={2} maxLength={1200} placeholder="Describe the steps or how customers can get assistance." />
                  </label>
                  <label className="field">
                    <span>Official website (HTTPS only)</span>
                    <input type="url" value={serviceDraft.official_url} onChange={(event) => setServiceDraft({ ...serviceDraft, official_url: event.target.value, official_url_verified: false })} placeholder="https://official.gov.in/" />
                  </label>
                  <label className="consent-check">
                    <input type="checkbox" checked={serviceDraft.official_url_verified} onChange={(event) => setServiceDraft({ ...serviceDraft, official_url_verified: event.target.checked })} disabled={!serviceDraft.official_url.trim()} />
                    <span>I have checked that this is the correct official source</span>
                  </label>
                </details>
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={featureService}
                    onChange={(event) => setFeatureService(event.target.checked)}
                  />
                  <span>Feature on service listing</span>
                </label>
                <button className="button button-dark" disabled={busy || !serviceName.trim()}>
                  {busy ? "Saving service…" : "Add service"} <ArrowRight size={15} />
                </button>
              </form>
              <div className="csv-import-panel">
                <label className="csv-drop">
                  <FileText size={24} />
                  <b>Upload a CSV catalogue</b>
                  <small>Choose a CSV, review the preview, then press Submit to publish the changes.</small>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void previewCsv(file);
                      event.currentTarget.value = "";
                    }}
                    disabled={busy}
                  />
                </label>
                {csvPreviewError && <p className="csv-feedback csv-error" role="alert">{csvPreviewError}</p>}
                {csvRows.length > 0 && (
                  <div className="csv-preview">
                    <div className="csv-preview-head">
                      <div><b>{csvFileName}</b><small>{csvRows.length} rows ready to review</small></div>
                      <span className={csvInvalidCount ? "csv-review-needed" : "csv-ready"}>{csvInvalidCount ? "Review required" : "Ready to submit"}</span>
                    </div>
                    <div className="csv-preview-stats">
                      <span>{csvRows.length} total rows</span>
                      <span className="csv-stat-valid">{csvValidCount} ready</span>
                      <span className={csvInvalidCount ? "csv-stat-invalid" : ""}>{csvInvalidCount} need attention</span>
                    </div>
                    <div className="csv-preview-list">
                      {csvReview.slice(0, 8).map(({ row, index, issues }) => (
                        <div className="csv-preview-row" key={`${row.category_slug}-${row.name}-${index}`}>
                          <span className="csv-preview-service">
                            <b>{row.name || "Unnamed service"}</b>
                            <small>{adminCategories.find((item) => item.slug === row.category_slug?.trim())?.name ?? row.category_slug ?? "No department"}</small>
                            {issues.length > 0 && <small className="csv-row-issue">{issues.join(" ")}</small>}
                          </span>
                          <span className={issues.length ? "csv-row-invalid" : "csv-row-valid"}>{issues.length ? "Needs attention" : "Ready"}</span>
                        </div>
                      ))}
                      {csvRows.length > 8 && <small>Showing 8 of {csvRows.length} rows. All rows are checked before import.</small>}
                    </div>
                    <p className="csv-import-note">Matching services already in the catalogue will be updated. No public prices are imported.</p>
                    <button type="button" className="text-button csv-cancel" onClick={() => { setCsvRows([]); setCsvFileName(""); setCsvPreviewError(""); setCsvImportPhase(""); }} disabled={busy}>Remove selected CSV</button>
                  </div>
                )}
                <button
                  type="button"
                  className="button button-dark csv-submit"
                  onClick={() => void submitCsvImport()}
                  disabled={busy || csvValidCount === 0}
                  aria-describedby="csv-submit-help"
                >
                  {busy ? (csvImportPhase || "Updating catalogue…") : csvRows.length ? `Import ${csvValidCount} valid services` : "Import CSV"}
                  <ArrowRight size={15} />
                </button>
                <small id="csv-submit-help" className="csv-submit-help">
                  {csvRows.length
                    ? "Review the preview above, then submit to publish these catalogue changes."
                    : "Choose a CSV file to validate it before importing."}
                </small>
              </div>
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
                        <label className={`admin-feature-toggle ${service.is_featured ? "is-featured" : "is-standard"}`}>
                          <input
                            aria-label={`Feature ${service.name}`}
                            type="checkbox"
                            checked={service.is_featured}
                            onChange={() => void setServiceField(service, "is_featured")}
                          />
                          <span>{service.is_featured ? "★ Featured" : "☆ Standard"}</span>
                        </label>
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
                        <button className="text-button" disabled={busy} onClick={() => void duplicateService(service)}>
                          Duplicate
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
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => printApplicationReceipt({
                        trackingId: active.tracking_id,
                        fullName: active.full_name,
                        mobile: active.mobile,
                        email: active.email,
                        department: categoryLabel(active.category_slug, adminCategories),
                        service: active.service_name,
                        submittedAt: active.created_at,
                        status: newStatus || active.status,
                      })}
                    >
                      <FileText size={14} /> Generate application receipt
                    </button>
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
                  <div className="field">
                    <span>Share an approved customer document</span>
                    <label className={`admin-document-dropzone${uploading ? " is-uploading" : ""}`}>
                      <UploadCloud size={24}/>
                      <strong>{uploading ? "Uploading securely…" : documentFileName || "Tap to choose a document"}</strong>
                      <small>PDF, JPG or PNG · maximum 10 MB · stored privately</small>
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        disabled={uploading}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          setDocumentFileName(file?.name ?? "");
                          void uploadDocument(file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <small className="admin-document-hint">The customer can view this file in tracking only when the application is Approved or Completed.</small>
                  </div>
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
            <h2>Website security information</h2>
            <p>
              To protect the website and investigate suspicious activity, the
              site may record the public IP address observed by our hosting
              network, visit time, page path, browser and device information,
              and a coarse country code when supplied by the network. If you
              sign in, a system account reference may also be recorded. This
              information is restricted to the owner and authorised
              investigators, is used for security and abuse prevention, and is
              not used to identify a person with certainty. Shared networks,
              mobile carriers and VPNs can cause multiple people to appear under
              the same IP address.
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


function MobileQuickBar() {
  return (
    <nav className="mobile-quick-bar" aria-label="Quick actions">
      <a href="tel:+917006865909"><PhoneCall size={18}/><span>Call</span></a>
      <a href="https://wa.me/917006865909" target="_blank" rel="noreferrer"><MessageCircle size={18}/><span>WhatsApp</span></a>
      <Link to="/track"><Search size={18}/><span>Track Status</span></Link>
    </nav>
  );
}

function FloatingWhatsApp() {
  const location = useLocation();
  const slug = location.pathname.startsWith("/services/") ? location.pathname.split("/").at(-1) : "";
  const category = categories.find((item) => item.slug === slug);
  const message = category ? `Hi, I need help with ${category.name}. Please share the required documents and next steps.` : "Hi, I need help from BABA'S CYBER CAFE. Please guide me.";
  return <a className="floating-whatsapp" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" aria-label={category ? `WhatsApp about ${category.name}` : "Chat with BABA'S CYBER CAFE on WhatsApp"}><MessageCircle size={24}/><span>WhatsApp</span></a>;
}

function RoutedApp() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    const privateRoute = ["/admin", "/dashboard", "/apply", "/track", "/pay", "/payment-portal", "/grievance/admin", "/smart-qr/dashboard", "/smart-qr/admin", "/smart-qr/login", "/smart-qr/setup", "/smart-qr/owner-setup", "/smart-qr/reset-password", "/smart-qr/forgot-password", "/smart-qr/system-check", "/smart-qr/owner-bootstrap"].some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
    const categorySlug = path.startsWith("/services/")
      ? path.split("/").at(-1)
      : "";
    const category = categories.find((item) => item.slug === categorySlug);
    const titles: Record<string, string> = {
      "/": "BABA'S CYBER CAFE | Digital Service Assistance in Srinagar",
      "/about": "About Us | BABA'S CYBER CAFE",
      "/faq": "FAQs & Customer Help | BABA'S CYBER CAFE",
      "/services": "Service Directory | BABA'S CYBER CAFE",
      "/instant-services": "Instant Digital Services | BABA'S CYBER CAFE",
      "/apply": "New Enquiry | BABA'S CYBER CAFE",
      "/track": "Track Application | BABA'S CYBER CAFE",
      "/dashboard": "Customer Dashboard | BABA'S CYBER CAFE",
      "/contact": "Contact | BABA'S CYBER CAFE",
      "/privacy": "Privacy Policy | BABA'S CYBER CAFE",
      "/terms": "Terms & Conditions | BABA'S CYBER CAFE",
      "/payment-portal": "Secure Payment Portal | BABA'S CYBER CAFE",
      "/admin": "Owner Dashboard | BABA'S CYBER CAFE",
      "/admin/login": "Secure Admin Login | BABA'S CYBER CAFE",
      "/grievance": "Grievance Redressal | BABA'S CYBER CAFE",
      "/grievance/admin": "Grievance Management | BABA'S CYBER CAFE",
      "/feedback": "Customer Feedback | BABA'S CYBER CAFE",
      "/smart-qr": "BABA'S SMART QR | Merchant Registration",
      "/smart-qr/login": "Merchant Login | BABA'S SMART QR",
      "/smart-qr/dashboard": "Merchant Dashboard | BABA'S SMART QR",
      "/smart-qr/admin": "Platform Administration | BABA'S SMART QR",
      "/smart-qr/system-check": "System Readiness | BABA'S SMART QR",
      "/smart-qr/owner-bootstrap": "Owner Setup | BABA'S SMART QR",
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
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const token = data.session?.access_token;
      void callFunction("security-telemetry", { route: location.pathname }, token).catch(() => {
        // Monitoring must never interrupt the public website.
      });
    });
    return () => { cancelled = true; };
  }, [location.pathname]);
  if (location.pathname.startsWith("/smart-qr") || location.pathname.startsWith("/s/")) return (
    <div className="smartqr-standalone">
      <Suspense fallback={<main className="smartqr-shell" role="status">Loading Smart QR…</main>}>
        <Routes>
          <Route path="/smart-qr/*" element={<SmartQrPortal />} />
          <Route path="/s/:slug" element={<SmartQrPortal />} />
        </Routes>
      </Suspense>
    </div>
  );
  if (location.pathname === "/payment-portal") return (
    <div className="payment-standalone"><Suspense fallback={<main className="payment-page"><div className="payment-shell">Loading secure payment portal…</div></main>}><Routes><Route path="/payment-portal" element={<PaymentPortal />} /></Routes></Suspense><FloatingWhatsApp /></div>
  );
  return (
    <div className="site-shell">
      <Header />
      <Suspense fallback={<main className="content-page" role="status">Loading page…</main>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/faq" element={<VipFaqPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:category" element={<CategoryRoute />} />
        <Route path="/insurance" element={<InsurancePortal />} />
        <Route path="/instant-tp-preview" element={<InstantTPPreview />} />
        <Route path="/instant-tp-admin" element={<InstantTPPreview adminOnly />} />
        <Route path="/print" element={<PrintPortal />} />
        <Route path="/print/admin" element={<PrintAdminPortal />} />
        <Route path="/insurance/admin" element={<InsurancePortal admin />} />
        <Route path="/apply" element={<ApplicationPage />} />
        <Route path="/challan" element={<ChallanPortal />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/dashboard" element={<CustomerDashboard />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<LegalPage privacy />} />
        <Route path="/terms" element={<LegalPage />} />
        <Route path="/pay" element={<PaymentPortal />} />
        <Route path="/admin/payments" element={<PaymentPortal admin />} />
        <Route path="/instant-services" element={<InstantApiCustomerPortal />} />
        <Route path="/admin/instant-api" element={<InstantApiAdminPortal />} />
        <Route path="/admin/login" element={<AdminPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/grievance" element={<GrievancePage />} />
        <Route path="/grievance/admin" element={<AdminGrievancePage />} />
        <Route path="/feedback" element={<FeedbackCentre />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      <Footer />
      <MobileQuickBar />
      <FloatingWhatsApp />
      <Suspense fallback={null}><CustomerChatAssistant /></Suspense>
    </div>
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
