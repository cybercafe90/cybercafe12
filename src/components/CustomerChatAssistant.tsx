import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

type ChatLink = { label: string; href: string };
type ChatMessage = {
  id: number;
  role: "assistant" | "customer";
  text: string;
  links?: ChatLink[];
};

const SITE = "https://babacybercafe.in";
const SERVICE_LINK = `${SITE}/services`;
const TRACK_LINK = `${SITE}/track`;
const INSURANCE_LINK = `${SITE}/services/insurance`;
const CONTACT_LINK = `${SITE}/contact`;

const QUICK_ACTIONS = [
  "Revenue certificates",
  "Birth / death / trade licence",
  "Driving licence / RC",
  "Motor insurance",
  "Track my application",
];

const SENSITIVE_PATTERNS = [
  /\b(?:otp|one[- ]?time password|verification code|security code)\b/i,
  /\b(?:password|passcode|login credentials)\b/i,
  /\b(?:upi|atm|debit|credit)?\s*pin\b/i,
  /\b(?:bank details|bank account|bank passbook|account\s*(?:no\.?|number)|ifsc|cvv|card number|net banking)\b/i,
];

function isSensitive(text: string) {
  return /^\s*\d{4,8}\s*$/.test(text) || SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function isRomanUrdu(text: string) {
  return /\b(assalam|salam|mujhe|mujhay|kya|kaise|kaisay|kaisa|chahiye|chaiye|hai|hain|karna|krna|batao|bataye|madad|darkar|kahan|kidhar|mera|meri|mere|ke liye|kitna|kitne|documents|dastavez|apply|banwana|banwani|status|maloom)\b/i.test(text);
}

function buildReply(input: string, romanUrdu: boolean): Omit<ChatMessage, "id" | "role"> {
  const q = input.toLowerCase();

  if (isSensitive(input)) {
    return {
      text: romanUrdu
        ? "Security warning: barah-e-karam OTP, password, PIN, bank account number, IFSC ya card details yahan share na karein. Main in details ko process ya store nahi karta. Agar aap ne koi secret share kiya hai to usay dobara post na karein; apne bank/account ki security settings check karein."
        : "Security warning: Please do not share an OTP, password, PIN, bank account number, IFSC, or card details here. I cannot process or store these details. If you have shared a secret, do not post it again; review the security of the relevant account.",
    };
  }

  const outsideScope = /\b(weather|forecast|politics|election|news|cricket|football|movie|song|joke|general knowledge|capital of|stock market|crypto|coding|programming|write code|translate|homework)\b/i.test(q);


  if (outsideScope) {
    return {
      text: "I only assist with BABA'S CYBER CAFE services on babacybercafe.in.",
    };
  }

  if (/\b(track|tracking|status|reference id|application id|where is my application)\b/i.test(q)) {
    return {
      text: romanUrdu
        ? "Apni application ka status dekhne ke liye Track Status page kholen. Wahan apna reference ID aur registered mobile number enter karein. Apna OTP, password ya bank details chat mein share na karein."
        : "To check an existing application, open Track Status and enter your reference ID and registered mobile number there. Do not send an OTP, password or bank details in this chat.",
      links: [{ label: "Track Status", href: TRACK_LINK }],
    };
  }

  if (/\b(insurance|third.party|comprehensive|motor policy|bike insurance|car insurance)\b/i.test(q)) {
    return {
      text: romanUrdu
        ? "Motor Insurance Desk bike, car aur commercial vehicle ke liye Third-Party aur Comprehensive cover enquiries leta hai. Shuruat ke liye ye documents paas rakhein:\n• Vehicle RC copy\n• Previous insurance policy copy (agar available ho)\n\nExact premium aur terms vehicle details dekh kar confirm honge; fixed rate yahan quote nahi kiya ja sakta."
        : "Our Motor Insurance Desk handles Third-Party and Comprehensive insurance enquiries for bikes, cars and commercial vehicles. Keep these ready:\n• Vehicle RC copy\n• Previous policy copy, if available\n\nThe premium and policy terms depend on the vehicle and cover selected. Please enquire for an exact quotation; no fixed price is promised here.",
      links: [{ label: "Open Insurance Desk", href: INSURANCE_LINK }],
    };
  }

  if (/\b(domicile|jamabandi|girdawari|land record|land records|mutation|income certificate|category certificate|revenue)\b/i.test(q)) {
    return {
      text: romanUrdu
        ? "Revenue Department ki assistance (Domicile, Land Records/Jamabandi/Girdawari, Income ya Category Certificate) ke liye aam tor par ye documents paas rakhein:\n• Aadhaar Card\n• Ration Card ya Voter ID\n• Purane land records ya parent documents (jahan lagu hon)\n\nExact requirement case ke mutabiq badal sakti hai."
        : "For Revenue Department assistance—Domicile, Land Records/Jamabandi/Girdawari, Income or Category Certificates—keep these ready:\n• Aadhaar Card\n• Ration Card or Voter ID\n• Previous land records or parent documents, where applicable\n\nThe exact requirement can vary by application.",
      links: [{ label: "Apply / Enquire", href: SERVICE_LINK }],
    };
  }

  if (/\b(birth|death|trade licen[cs]e|smc|municipal)\b/i.test(q)) {
    return {
      text: romanUrdu
        ? "SMC / Municipal Services (Birth Certificate, Death Certificate ya Trade Licence) ke liye ye documents paas rakhein:\n• Hospital discharge slip (birth/death ke liye, jahan lagu ho)\n• ID proof\n• Address proof\n\nCase ke mutabiq mazeed documents lag sakte hain."
        : "For SMC / Municipal Services—Birth Certificate, Death Certificate or Trade Licence—keep these ready:\n• Hospital discharge slip, where applicable for birth/death cases\n• Identity proof\n• Address proof\n\nAdditional documents may be needed depending on the case.",
      links: [{ label: "Apply / Enquire", href: SERVICE_LINK }],
    };
  }

  if (/\b(driving licen[cs]e|learner|permanent dl|vehicle|rc transfer|fitness|rto)\b/i.test(q)) {
    return {
      text: romanUrdu
        ? "RTO & Transport assistance (Learner/Permanent Driving Licence, RC Transfer, Fitness) ke liye ye documents ready rakhein:\n• Aadhaar Card\n• Existing DL ya RC copy\n• Recent photo; Form 1-A medical certificate agar applicable ho\n\nFinal checklist service aur eligibility par depend karegi."
        : "For RTO & Transport assistance—Learner/Permanent Driving Licence, RC Transfer or Fitness—keep these ready:\n• Aadhaar Card\n• Existing Driving Licence or RC copy\n• Recent photo; Form 1-A medical certificate if applicable\n\nThe final checklist depends on the service and eligibility.",
      links: [{ label: "Apply / Enquire", href: SERVICE_LINK }],
    };
  }

  if (/\b(pan|udyam|msme|abha|passport|health id|business scheme)\b/i.test(q)) {
    return {
      text: romanUrdu
        ? "Central & Business Services (PAN, MSME Udyam, ABHA Health ID aur Passport Assistance) ke liye:\n• Aadhaar Card\n• PAN, agar service ke liye relevant ho\n• Business records, agar Udyam ke liye relevant hon\n\nAadhaar-linked mobile verification ki zaroorat ho sakti hai, lekin OTP kabhi chat mein share na karein. Bank account number ya bank details yahan na bhejein."
        : "For Central & Business Services—PAN, MSME Udyam, ABHA Health ID and Passport Assistance—keep these in mind:\n• Aadhaar Card\n• PAN, where relevant to the service\n• Relevant business records for Udyam, if applicable\n\nAn Aadhaar-linked mobile may be needed for verification, but never share an OTP in chat. Do not send bank account numbers or bank details here.",
      links: [{ label: "Apply / Enquire", href: SERVICE_LINK }],
    };
  }

  if (/\b(bocw|labour|labor|e.sh?ram|artisan|weaver|handloom|handicraft)\b/i.test(q)) {
    return {
      text: romanUrdu
        ? "Labour & Handicrafts (BOCW Labour Card, e-Shram, Artisan/Weaver ID) ke liye aam tor par ye documents chahiye ho sakte hain:\n• Aadhaar Card\n• Recent photo\n• Work certificate / endorsement\n\nBank passbook ki zaroorat ho sakti hai; uski photo, account number ya details chat mein share na karein. Secure submission ka tareeqa support se confirm karein."
        : "For Labour & Handicrafts services—BOCW Labour Card, e-Shram, Artisan or Weaver ID—these may be required:\n• Aadhaar Card\n• Recent photograph\n• Work certificate or endorsement\n\nA bank passbook may be required for some services, but do not share its image, account number or details in chat. Contact support to confirm the secure submission process.",
      links: [{ label: "Apply / Enquire", href: SERVICE_LINK }],
    };
  }

  if (/\b(price|prices|cost|rate|rates|fee|fees|charges|kitna|kitne paise)\b/i.test(q)) {
    return {
      text: romanUrdu
        ? "Service charges aur government fees case aur service ke mutabiq alag ho sakti hain. Main fixed price invent nahi karunga. Exact rate ke liye website par enquiry submit karein ya support se rabta karein."
        : "Service charges and government fees vary by service and application. I won't invent a fixed price. Please submit an enquiry on the website or contact our support team for the exact amount.",
      links: [
        { label: "Submit an Enquiry", href: `${SITE}/apply` },
        { label: "Contact Support", href: CONTACT_LINK },
      ],
    };
  }

  if (/\b(contact|phone|call|whatsapp|email|location|address|srinagar|support)\b/i.test(q)) {
    return {
      text: romanUrdu
        ? "BABA'S CYBER CAFE, Srinagar, Jammu & Kashmir\nPhone / WhatsApp: +91 7006865909\nEmail: support@babacybercafe.in\nAap website ke Contact page se bhi rabta kar sakte hain."
        : "BABA'S CYBER CAFE · Srinagar, Jammu & Kashmir\nPhone / WhatsApp: +91 7006865909\nEmail: support@babacybercafe.in\nYou can also use the website Contact page.",
      links: [
        { label: "Contact Page", href: CONTACT_LINK },
        { label: "Call +91 7006865909", href: "tel:+917006865909" },
        { label: "Email Support", href: "mailto:support@babacybercafe.in" },
      ],
    };
  }

  if (/\b(apply|enquire|enquiry|document|documents|requirement|requirements|what do i need|how to apply)\b/i.test(q)) {
    return {
      text: romanUrdu
        ? "Main documents aur application navigation mein madad kar sakta hoon. Aap kis service ke liye apply karna chahte hain—Revenue, SMC, RTO, Motor Insurance, PAN/MSME/ABHA, ya Labour/Handloom?"
        : "I can help with document checklists and application navigation. Which service do you need—Revenue, SMC, RTO, Motor Insurance, PAN/MSME/ABHA, or Labour/Handloom?",
      links: [{ label: "Browse All Services", href: SERVICE_LINK }],
    };
  }

  return {
    text: romanUrdu
      ? "Main sirf BABA'S CYBER CAFE ki services, required documents aur website navigation mein madad karta hoon. Aap service ka naam batayein—Revenue, SMC, RTO, Insurance, PAN/MSME/ABHA, Labour/Handloom, ya application tracking."
      : "I can help with BABA'S CYBER CAFE services, document requirements and website navigation only. Tell me the service name—Revenue, SMC, RTO, Insurance, PAN/MSME/ABHA, Labour/Handloom, or application tracking.",
    links: [{ label: "Browse Services", href: SERVICE_LINK }],
  };
}

export default function CustomerChatAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "Hello! I’m the BABA'S CYBER CAFE service assistant for Srinagar, J&K. I can help with services, document checklists and application tracking. Please do not share OTPs, passwords, PINs or bank details here.",
    },
  ]);
  const [romanUrdu, setRomanUrdu] = useState(false);
  const [nextId, setNextId] = useState(2);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      inputRef.current?.focus();
    }
  }, [messages, open]);

  function sendMessage(raw: string) {
    const value = raw.trim();
    if (!value) return;
    const language = isRomanUrdu(value) || romanUrdu;
    setRomanUrdu(language);
    const sensitive = isSensitive(value);
    const customerMessage: ChatMessage | null = sensitive
      ? null
      : { id: nextId, role: "customer", text: value };
    const reply = buildReply(value, language);
    setMessages((current) => [
      ...current,
      ...(customerMessage ? [customerMessage] : []),
      { id: nextId + 1, role: "assistant", ...reply },
    ]);
    setNextId((current) => current + 2);
    setInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="customer-chat-assistant">
      {open && (
        <section className="customer-chat-panel" role="dialog" aria-modal="false" aria-label="BABA'S CYBER CAFE customer assistant">
          <header className="customer-chat-header">
            <div className="customer-chat-avatar"><ShieldCheck size={21}/></div>
            <div className="customer-chat-heading">
              <strong>BABA'S CYBER CAFE</strong>
              <span><i/> SERVICE ASSISTANT · SRINAGAR</span>
            </div>
            <button className="customer-chat-close" type="button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={19}/></button>
          </header>
          <div className="customer-chat-security"><ShieldAlert size={14}/><span>Never share OTPs, passwords, PINs or bank details in chat.</span></div>
          <div className="customer-chat-messages" role="log" aria-live="polite" aria-relevant="additions">
            {messages.map((message) => (
              <article className={message.role === "assistant" ? "customer-chat-message assistant" : "customer-chat-message customer"} key={message.id}>
                {message.role === "assistant" && <span className="customer-chat-message-mark"><ShieldCheck size={13}/></span>}
                <div className="customer-chat-bubble">
                  <p>{message.text}</p>
                  {message.links && message.links.length > 0 && (
                    <div className="customer-chat-links">
                      {message.links.map((link) => (
                        <a href={link.href} key={link.label} target={link.href.startsWith("https://babacybercafe.in/") ? "_self" : undefined}>
                          {link.label}<ArrowUpRight size={13}/>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
            <div ref={bottomRef}/>
          </div>
          {messages.length === 1 && (
            <div className="customer-chat-quick-actions">
              {QUICK_ACTIONS.map((action) => <button type="button" key={action} onClick={() => sendMessage(action)}>{action}</button>)}
            </div>
          )}
          <form className="customer-chat-compose" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about a service or documents…"
              aria-label="Ask about BABA'S CYBER CAFE services"
              maxLength={500}
              autoComplete="off"
            />
            <button type="submit" disabled={!input.trim()} aria-label="Send message"><Send size={17}/></button>
          </form>
          <div className="customer-chat-footnote"><FileText size={11}/> Website service guidance only · Messages are not saved</div>
        </section>
      )}
      <button className={open ? "customer-chat-launcher is-open" : "customer-chat-launcher"} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close customer assistant" : "Open customer assistant"}>
        {open ? <X size={21}/> : <MessageCircle size={21}/>}
        <span>{open ? "Close" : "Ask assistant"}</span>
        {!open && <i/>}
      </button>
    </div>
  );
}
