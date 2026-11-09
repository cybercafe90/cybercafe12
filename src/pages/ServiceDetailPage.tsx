import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  Info,
  ShieldCheck,
} from "lucide-react";
import { categories, categoryName, seedServices, type ServiceRecord } from "../data";
import { supabase } from "../lib/supabase";

type Props = { serviceId: string };

export default function ServiceDetailPage({ serviceId }: Props) {
  const [service, setService] = useState<ServiceRecord | null>(
    () => seedServices.find((item) => item.id === serviceId) ?? null,
  );
  const [loading, setLoading] = useState(Boolean(supabase));
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setNotFound(!seedServices.some((item) => item.id === serviceId));
      return;
    }
    let current = true;
    void supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!current) return;
        if (data) {
          setService(data as ServiceRecord);
          setNotFound(false);
        } else if (error || !seedServices.some((item) => item.id === serviceId)) {
          setNotFound(true);
        }
        setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [serviceId]);

  if (loading && !service) {
    return <main className="content-page service-detail-page"><p>Loading service information…</p></main>;
  }
  if (notFound || !service) {
    return (
      <main className="content-page service-detail-page">
        <div className="service-detail-empty">
          <Info size={26} />
          <h1>Service information is unavailable</h1>
          <p>This service may have been updated or is no longer accepting enquiries.</p>
          <Link className="button button-dark" to="/services">Return to services <ArrowRight size={15} /></Link>
        </div>
      </main>
    );
  }

  const category = categories.find((item) => item.slug === service.category_slug);
  const documents = service.required_documents.filter(Boolean);
  const applyUrl = `/apply?service=${encodeURIComponent(service.name)}&category=${encodeURIComponent(service.category_slug)}`;

  return (
    <main className="content-page service-detail-page">
      <nav className="service-breadcrumb" aria-label="Breadcrumb">
        <Link to="/services"><ArrowLeft size={14} /> All services</Link>
        <span>/</span>
        <Link to={`/services/${service.category_slug}`}>{category?.name ?? categoryName(service.category_slug)}</Link>
        <span>/</span>
        <span aria-current="page">{service.name}</span>
      </nav>

      <section className="service-detail-hero">
        <div className="service-detail-heading">
          <span className="eyebrow"><BadgeCheck size={14} /> SERVICE INFORMATION &amp; ASSISTANCE</span>
          <h1>{service.name}</h1>
          <p>{service.description}</p>
          <div className="service-detail-meta">
            <span><ShieldCheck size={15} /> Independent assistance desk</span>
            <span><Clock3 size={15} /> Timelines depend on the responsible authority</span>
          </div>
          <div className="service-detail-actions">
            <Link className="button button-dark" to={applyUrl}>Start an assisted application <ArrowRight size={16} /></Link>
            <Link className="button button-outline" to="/track">Track an existing request</Link>
          </div>
        </div>
        <aside className="service-reference-card">
          <span className="service-reference-icon"><FileCheck2 size={25} /></span>
          <span className="eyebrow">SERVICE DESK</span>
          <strong>{category?.name ?? categoryName(service.category_slug)}</strong>
          <p>Review the information below before requesting assistance. Our team will confirm the current process and any service-specific requirements.</p>
          <small>Reference information · No public service rates</small>
        </aside>
      </section>

      <div className="service-detail-layout">
        <div className="service-detail-main">
          <section className="service-info-panel">
            <div className="service-info-title"><span>01</span><div><h2>Eligibility &amp; applicability</h2><p>Who may be able to request this service</p></div></div>
            <p>{service.eligibility || "Eligibility depends on the rules of the responsible authority. Our team can help you identify the applicable requirements before proceeding."}</p>
          </section>

          <section className="service-info-panel">
            <div className="service-info-title"><span>02</span><div><h2>Documents to prepare</h2><p>Checklist for your initial enquiry</p></div></div>
            {documents.length > 0 ? (
              <ul className="service-document-list">{documents.map((document) => <li key={document}><CheckCircle2 size={16} />{document}</li>)}</ul>
            ) : (
              <div className="service-info-note"><Info size={17} /><p>A verified document checklist has not been published for this service yet. Submit an enquiry and we will confirm the current requirements with you before proceeding. Do not upload original documents unless requested through a secure channel.</p></div>
            )}
          </section>

          <section className="service-info-panel">
            <div className="service-info-title"><span>03</span><div><h2>How the assistance process works</h2><p>What to expect after you submit your request</p></div></div>
            <p>{service.application_method || "Our team will review your enquiry and explain the next steps. Where an official online process is available, we can guide you through it. The responsible authority controls the official submission and decision."}</p>
            <ol className="service-process-list">
              <li><b>Submit your request</b><span>Provide your contact details and a short description through the secure enquiry form.</span></li>
              <li><b>Initial review</b><span>Our team reviews the request and contacts you if clarification or documents are needed.</span></li>
              <li><b>Assisted next steps</b><span>We explain the applicable process and help you prepare for the relevant official channel.</span></li>
              <li><b>Track your request</b><span>Use the reference number and registered mobile number to check customer-visible updates.</span></li>
            </ol>
          </section>

          {service.official_url && service.official_url_verified && (
            <section className="service-official-source">
              <ExternalLink size={18} />
              <div><b>Verified official authority link</b><p>Use the responsible authority's website to review official rules and submit directly where supported.</p><a href={service.official_url} target="_blank" rel="noreferrer">Open official portal <ExternalLink size={13} /></a></div>
            </section>
          )}
        </div>

        <aside className="service-detail-aside">
          <div className="service-aside-card">
            <span className="eyebrow">READY TO PROCEED?</span>
            <h2>Start your service request.</h2>
            <p>Send your enquiry to BABA'S CYBER CAFE. A reference is generated after a successful online submission.</p>
            <Link className="button button-dark" to={applyUrl}>Apply for assistance <ArrowRight size={15} /></Link>
            <Link className="service-aside-secondary" to="/track">Already applied? Track here</Link>
          </div>
          <div className="service-aside-card service-aside-muted">
            <BookOpen size={20} />
            <b>Before you apply</b>
            <p>Check that your details are accurate. Current eligibility, official fees, required documents and processing times are set by the relevant authority.</p>
          </div>
        </aside>
      </div>

      <div className="service-independence-notice">
        <ShieldCheck size={18} />
        <p><b>Important:</b> BABA'S CYBER CAFE is an independent digital assistance business, not a government department or authorised government portal. Submitting a request here sends an assistance enquiry to our team; it does not itself submit an application to a government authority or guarantee approval.</p>
      </div>
    </main>
  );
}
