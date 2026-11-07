import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, Mail, MessageCircle, PhoneCall, Send, ShieldAlert, ShieldCheck, X } from "lucide-react";

type ChatLink = { label: string; href: string };
type ChatMessage = { id: number; role: "assistant" | "customer"; text: string; links?: ChatLink[] };

const OUT_OF_SCOPE = "I only assist with BABA'S CYBER CAFE services on babacybercafe.in.";
const SERVICES_LINK = "/#services";
const QUICK_ACTIONS = ["Revenue documents", "Motor insurance", "Track application"];

function containsSensitiveData(value: string) {
  const patterns = [
    /\b(?:otp|one[ -]?time password|verification code)\b\s*(?:is|:|=|-)?\s*\d{4,8}\b/i,
    /\b(?:password|passcode|pin|upi pin|cvv|cvc)\b\s*(?:is|:|=|-)?\s*[a-z0-9@#$!_-]{3,}/i,
    /\b\d{12}\b/,
    /\b\d{16}\b/,
    /\b\d{9,18}\b/,
    /\b[a-z0-9._-]{2,}@[a-z]{2,}\b/i,
  ];
  return patterns.some((pattern) => pattern.test(value));
}

function answerFor(message: string): { text: string; links?: ChatLink[] } {
  const q = message.toLowerCase();
  if (/\b(hello|hi|hey|salaam|assalam|assalamu|namaste)\b/.test(q)) {
    return { text: "Hello! Welcome to BABA'S CYBER CAFE in Srinagar. I can help with service requirements, document checklists, enquiries and application tracking. What would you like help with?", links: [{ label: "Browse services", href: SERVICES_LINK }, { label: "Track an application", href: "/track" }] };
  }
  if (/\b(price|prices|rate|rates|cost|fee|fees|charges|kitna|qeemat)\b/.test(q)) {
    return { text: "Service charges and government fees can vary by service and case. I don't quote fixed prices here. Please submit an enquiry or contact our support desk for the current details.", links: [{ label: "Apply / Enquire", href: SERVICES_LINK }, { label: "Contact support", href: "/contact" }] };
  }
  if (/\b(track|tracking|status|reference|application id|tracking id|tracking number)\b/.test(q)) {
    return { text: "To check an existing application, open Track Status and enter your reference ID along with the registered mobile number requested on the tracking page. Please do not share OTPs or passwords in this chat.", links: [{ label: "Track Status", href: "/track" }] };
  }
  if (/\b(insurance|motor|vehicle policy|third party|comprehensive|bike insurance|car insurance)\b/.test(q)) {
    return { text: "Our Motor Insurance Desk assists with bike, car and commercial vehicle third-party and comprehensive insurance. Quick checklist: (1) Vehicle RC copy, (2) Previous policy copy if available. Do not send payment credentials, OTPs or PINs in chat. For a quotation, submit an enquiry.", links: [{ label: "Open Insurance Desk", href: "/insurance" }, { label: "Contact support", href: "/contact" }] };
  }
  if (/\b(revenue|domicile|jamabandi|girdawari|land record|mutation|income certificate|category certificate)\b/.test(q)) {
    return { text: "For Revenue Department assistance (Domicile, Land Records, Jamabandi, Girdawari, Income or Category Certificates), prepare: (1) Aadhaar Card, (2) Ration Card or Voter ID, (3) Previous land or parent documents, if relevant. The exact checklist depends on the service and case.", links: [{ label: "Apply / Enquire", href: SERVICES_LINK }] };
  }
  if (/\b(smc|municipal|birth certificate|death certificate|trade licen[cs]e)\b/.test(q)) {
    return { text: "For Municipal / SMC assistance (Birth or Death Certificates and Trade Licence), prepare: (1) Hospital discharge slip or supporting record, (2) ID proof, (3) Address proof. Requirements can vary by application.", links: [{ label: "Apply / Enquire", href: SERVICES_LINK }] };
  }
  if (/\b(rto|driving licen[cs]e|learner|permanent dl|vehicle transfer|rc transfer|fitness certificate)\b/.test(q)) {
    return { text: "For RTO & Transport assistance, prepare: (1) Aadhaar Card, (2) Existing Driving Licence or RC copy, (3) Photo. Form 1-A medical may apply in some cases. We can confirm the exact list when you enquire.", links: [{ label: "Apply / Enquire", href: SERVICES_LINK }] };
  }
  if (/\b(pan|msme|udyam|abha|health id|passport|business scheme|central scheme)\b/.test(q)) {
    return { text: "For PAN, MSME Udyam, ABHA Health ID or Passport Assistance, the initial checklist may include: (1) Aadhaar Card, (2) PAN if already issued, (3) Relevant business or application documents. An Aadhaar-linked mobile may be needed for an official verification step, but never tell us an OTP. Do not send bank account details in this chat; confirm any scheme-specific documents with our desk.", links: [{ label: "Apply / Enquire", href: SERVICES_LINK }] };
  }
  if (/\b(labour|bocw|e.?shram|artisan|weaver|handicraft|handloom)\b/.test(q)) {
    return { text: "For Labour & Handicrafts assistance (BOCW Labour Card, e-Shram, Artisan or Weaver IDs), prepare: (1) Aadhaar Card, (2) Bank passbook for document review—please do not share account numbers or bank details in chat, (3) Photo and work certificate / endorsement if available.", links: [{ label: "Apply / Enquire", href: SERVICES_LINK }] };
  }
  if (/\b(document|documents|requirement|requirements|checklist|apply|application|enquir|service|services)\b/.test(q)) {
    return { text: "I can guide you through Revenue, Municipal / SMC, RTO, Motor Insurance, Central & Business Schemes, and Labour & Handicrafts services. Tell me which service you need and I’ll give you a short document checklist. Exact fees are confirmed by support, not guessed here.", links: [{ label: "Browse all services", href: SERVICES_LINK }, { label: "Apply / Enquire", href: "/apply" }] };
  }
  if (/\b(contact|phone|call|whatsapp|email|address|location)\b/.test(q)) {
    return { text: "BABA'S CYBER CAFE customer support is based in Srinagar, Jammu & Kashmir. Phone / WhatsApp: +91 7006865909. Email: support@babacybercafe.in. You can also open the contact page for available details.", links: [{ label: "Contact page", href: "/contact" }] };
  }
  return { text: OUT_OF_SCOPE };
}

export default function CustomerChatAssistant() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: "assistant", text: "Hi! I'm the BABA'S CYBER CAFE service assistant. I can help with services, document checklists, enquiries and tracking. Please never share passwords, PINs, bank details or OTPs here.", links: [{ label: "Browse services", href: SERVICES_LINK }, { label: "Track status", href: "/track" }] },
  ]);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(2);

  const sendMessage = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setDraft("");
    setShowQuickActions(false);
    if (containsSensitiveData(value)) {
      setMessages((current) => [...current, { id: nextId.current++, role: "assistant", text: "⚠️ Security warning: please do not share passwords, OTPs, PINs, bank account details, card numbers or verification codes here. I do not collect or process them. If you already shared a real credential, contact your bank or the relevant provider immediately and secure the account. I have not sent your message anywhere." }]);
      return;
    }
    const response = answerFor(value);
    setMessages((current) => [...current, { id: nextId.current++, role: "customer", text: value }, { id: nextId.current++, role: "assistant", ...response }]);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage(draft);
  };

  const suggestions = useMemo(() => QUICK_ACTIONS, []);
  return (
    <div className="customer-chat-assistant">
      {open && (
        <section className="customer-chat-panel" role="dialog" aria-modal="false" aria-label="BABA'S CYBER CAFE customer assistant">
          <header className="customer-chat-header">
            <span className="customer-chat-avatar"><Bot size={21}/></span>
            <span className="customer-chat-title"><b>BABA'S CYBER CAFE</b><small><i/> SERVICE ASSISTANT · SRINAGAR</small></span>
            <button type="button" className="customer-chat-close" onClick={() => setOpen(false)} aria-label="Close chat"><X size={19}/></button>
          </header>
          <div className="customer-chat-safety"><ShieldCheck size={14}/> Website services only · Never share OTPs, PINs or bank details</div>
          <div className="customer-chat-messages" ref={scrollRef} aria-live="polite">
            {messages.map((message) => (
              <div className={message.role === "customer" ? "customer-chat-row is-customer" : "customer-chat-row"} key={message.id}>
                <div className="customer-chat-bubble">
                  <p>{message.text}</p>
                  {message.links && <div className="customer-chat-links">{message.links.map((link) => <Link key={link.href} to={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowRight size={13}/></Link>)}</div>}
                </div>
              </div>
            ))}
            {showQuickActions && <div className="customer-chat-quick">{suggestions.map((item) => <button type="button" key={item} onClick={() => sendMessage(item)}>{item}</button>)}</div>}
          </div>
          <form className="customer-chat-compose" onSubmit={handleSubmit}>
            <input aria-label="Ask about BABA'S CYBER CAFE services" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about a service…" maxLength={500}/>
            <button type="submit" aria-label="Send message" disabled={!draft.trim()}><Send size={17}/></button>
          </form>
          <footer className="customer-chat-footer"><span><ShieldAlert size={12}/> No passwords, OTPs, PINs or bank details</span><a href="tel:+917006865909"><PhoneCall size={12}/> Call support</a><a href="mailto:support@babacybercafe.in"><Mail size={12}/> Email</a></footer>
        </section>
      )}
      <button className={open ? "customer-chat-launcher is-open" : "customer-chat-launcher"} type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="dialog" aria-expanded={open}>
        {open ? <X size={20}/> : <MessageCircle size={21}/>}<span>{open ? "Close assistant" : "Chat with us"}</span>
      </button>
    </div>
  );
}
