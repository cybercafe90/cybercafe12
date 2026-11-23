import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, ChevronDown, Clock3, MessageCircle, ShieldCheck, Star } from "lucide-react";

type Props = { reviewUrl: string };

const faqs = [
  { q: "How do I start an application?", a: "Open Services, choose the relevant department and service, review the requirements, then submit an enquiry. Our team will contact you about the next steps." },
  { q: "How can I track my application?", a: "Use Track Status and enter your application reference with the registered mobile number. Keep your reference private." },
  { q: "When do I need to pay?", a: "Any applicable amount is confirmed by our team after reviewing the request. We do not publish service prices on this website. Do not pay an unverified person or account." },
  { q: "Which documents should I prepare?", a: "Requirements vary by service and authority. Check the service card for the current checklist and confirm any official requirements with the relevant department." },
  { q: "Is BABA'S CYBER CAFE a government office?", a: "No. BABA'S CYBER CAFE is an independent assistance business. Official authorities make all application decisions and issue official documents." },
  { q: "How can I contact the service desk?", a: "Call +91 7006865909 or message the team on WhatsApp. You can also use the Contact page for email details." },
];

export default function FreeEnhancements({ reviewUrl }: Props) {
  const [timing, setTiming] = useState<{ load: number | null; dom: number | null }>({ load: null, dom: null });
  useEffect(() => {
    const read = () => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;
      setTiming({
        load: nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : null,
        dom: nav.domContentLoadedEventEnd > 0 ? Math.round(nav.domContentLoadedEventEnd) : null,
      });
    };
    read();
    const id = window.requestAnimationFrame(read);
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <section className="free-enhancements" aria-label="Customer help and website information">
      <div className="free-enhancements-heading">
        <span className="cyber-eyebrow">HELP CENTRE · CUSTOMER FIRST</span>
        <h2>Clear answers. <em>Confident next steps.</em></h2>
        <p>Quick guidance for applications, documents, payments and tracking.</p>
      </div>
      <div className="free-enhancements-grid">
        <div className="free-faq-panel">
          {faqs.map((item, index) => (
            <details className="free-faq-item" key={item.q} open={index === 0}>
              <summary>{item.q}<ChevronDown size={17} aria-hidden="true" /></summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
        <aside className="free-trust-panel">
          <div className="free-trust-icon"><Star size={21} /></div>
          <span className="cyber-eyebrow">YOUR FEEDBACK MATTERS</span>
          <h3>Visited our service desk?</h3>
          <p>Share an honest review on our Google Business Profile. Your feedback helps local customers make informed choices.</p>
          <a className="cyber-button cyber-button-primary" href={reviewUrl} target="_blank" rel="noreferrer">View Google profile <ArrowUpRight size={15}/></a>
          <div className="free-trust-divider" />
          <div className="free-performance-title"><Activity size={17}/><b>Page load diagnostics</b></div>
          <p className="free-performance-copy">A lightweight, local browser timing snapshot. Results vary by device and network; this is not a laboratory speed score.</p>
          <div className="free-performance-metrics">
            <span><Clock3 size={14}/> DOM ready <b>{timing.dom === null ? "Measuring…" : `${timing.dom} ms`}</b></span>
            <span><Activity size={14}/> Page load <b>{timing.load === null ? "Measuring…" : `${timing.load} ms`}</b></span>
          </div>
          <small className="free-performance-note"><ShieldCheck size={13}/> Measured in your browser. No tracking service added.</small>
        </aside>
      </div>
      <div className="free-announcement-note"><MessageCircle size={16}/><span>For service updates and announcements, contact our team directly or check the latest notice on the homepage.</span></div>
    </section>
  );
}
