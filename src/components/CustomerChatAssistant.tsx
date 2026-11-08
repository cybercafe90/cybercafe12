import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  FileText,
  Globe2,
  RotateCcw,
  MessageCircle,
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
const SERVICE_LINK = `${SITE}/#services`;
const TRACK_LINK = `${SITE}/track`;
const INSURANCE_LINK = `${SITE}/insurance`;
const CONTACT_LINK = `${SITE}/contact`;

const QUICK_ACTIONS = [
  "Browse all services", "Revenue certificates", "Birth / death / trade licence",
  "Driving licence / RC", "Motor insurance", "Payment help",
  "Track my application", "Submit a grievance", "Talk to a human",
];

const SENSITIVE_PATTERNS = [
  /\b(?:otp|one[- ]?time password|verification code|security code)\b\s*(?:is|:|=|-)?\s*\d{4,8}\b/i,
  /\b(?:here(?:'s| is)|my|this is)\s+(?:my\s+)?(?:otp|one[- ]?time password|verification code|security code)\b/i,
  /\b(?:password|passcode|login credentials)\s*(?:is|:|=)\s*\S+/i,
  /\b(?:my|here is|this is)\s+(?:password|passcode|pin)\b/i,
  /\b(?:upi|atm|debit|credit)?\s*pin\s*(?:is|:|=)?\s*\d{4,6}\b/i,
  /\b(?:bank details|bank account|account\s*(?:no\.?|number)|ifsc|cvv|card number|net banking)\b.{0,24}\b[\dA-Z]{4,}\b/i,
  /\b(?:here is|my|attached is)\s+(?:bank passbook|bank details|bank account)\b/i,
];

function isSensitive(text: string) {
  return /^\s*\d{4,18}\s*$/.test(text) || SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
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
  const websiteTopic = /\b(domicile|jamabandi|girdawari|land records?|mutation|income certificate|category certificate|revenue|birth|death|trade licen[cs]e|smc|municipal|driving licen[cs]e|learner|permanent dl|vehicle|rc transfer|fitness|rto|insurance|third.party|comprehensive|motor policy|bike|car|pan|udyam|msme|abha|passport|health id|bocw|labour|labor|e.sh?ram|artisan|weaver|handloom|handicraft|application|tracking|track|reference id|status|service|documents?|apply|enquir(?:y|e)|price|prices|cost|rate|rates|fee|fees|charges|contact|phone|call|whatsapp|email|location|srinagar|support|hello|hi|hey|salam|assalam|namaste)\b/i.test(q);

  if (outsideScope || !websiteTopic) {
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


function buildAdvancedReply(input: string, romanUrdu: boolean): Omit<ChatMessage, "id" | "role"> | null {
  const q = input.toLowerCase();
  if (/\b(payment|pay|paid|utr|transaction|refund|fee payment)\b/i.test(q)) {
    return {
      text: romanUrdu
        ? "Payment ke liye pehle Track Status par reference ID aur registered mobile se application verify karein. Due amount ho to website ka payment page follow karein. UTR dena payment credit hone ka proof nahi; bank credit verify hone ke baad hi payment confirmed hoti hai. OTP, PIN ya bank details chat mein share na karein."
        : "For payment help, first verify your application on Track Status using your reference ID and registered mobile. If an amount is due, follow the website payment page. A submitted UTR is not proof of credited funds; payment is confirmed only after bank credit is verified. Never share an OTP, PIN or bank details here.",
      links: [{ label: "Track & Payment", href: TRACK_LINK }, { label: "Payment Portal", href: SITE + "/pay" }, { label: "Contact Support", href: CONTACT_LINK }],
    };
  }
  if (/\b(grievance|complaint|complain|delay|issue|problem|refund request)\b/i.test(q)) {
    return {
      text: romanUrdu ? "Aap Grievance page par complaint submit kar sakte hain. Application reference ID aur issue ki short details ready rakhein. Password, OTP, PIN ya bank details share na karein." : "Submit a service-related complaint through the Grievance page. Keep your application reference ID and a short description of the issue ready. Do not include passwords, OTPs, PINs or bank details.",
      links: [{ label: "Submit a Grievance", href: SITE + "/grievance" }, { label: "Contact Support", href: CONTACT_LINK }],
    };
  }
  if (/\b(talk to a human|human|agent|staff|representative|support team|call me)\b/i.test(q)) {
    return {
      text: romanUrdu ? "Support team se WhatsApp ya phone par rabta karein. Sirf apni query batayein; OTP, password ya bank details share na karein." : "You can speak with our support team by WhatsApp or phone. Share only a brief description of your enquiry—never send an OTP, password or bank details.",
      links: [{ label: "Chat on WhatsApp", href: "https://wa.me/917006865909?text=Hello%20BABA%27S%20CYBER%20CAFE%2C%20I%20need%20assistance." }, { label: "Call support", href: "tel:+917006865909" }, { label: "Email support", href: "mailto:support@babacybercafe.in" }],
    };
  }
  if (/\b(browse all services|all services|service list|services list|catalogue|catalog)\b/i.test(q)) {
    return {
      text: romanUrdu ? "Revenue, SMC, RTO, Motor Insurance, PAN, ABHA, MSME, Labour, Handloom aur doosri digital assistance services browse karein. Availability aur eligibility har service ke liye alag ho sakti hai." : "Browse Revenue, SMC, RTO, Motor Insurance, PAN, ABHA, MSME, Labour, Handloom and other digital assistance services. Availability and eligibility vary by service.",
      links: [{ label: "Browse Services Hub", href: SITE + "/services" }, { label: "Start an Enquiry", href: SITE + "/apply" }],
    };
  }
  if (/\b(privacy|personal information|delete my data|data protection)\b/i.test(q)) {
    return {
      text: romanUrdu ? "Personal information sirf zaroori form ya verified support channel par dein. Is chat mein documents, Aadhaar number, OTP, password, PIN ya bank details share na karein. Data handling ke liye Privacy Policy dekhein." : "Share personal information only through the relevant form or a verified support channel. Do not share documents, Aadhaar numbers, OTPs, passwords, PINs or bank details in this chat. Review the Privacy Policy for data-handling information.",
      links: [{ label: "Privacy Policy", href: SITE + "/privacy" }, { label: "Contact Support", href: CONTACT_LINK }],
    };
  }
  return null;
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
  function resetChat() {
    setMessages([{ id: 1, role: "assistant", text: "Hello! I’m the BABA'S CYBER CAFE digital assistant for Srinagar, J&K. Ask about services, documents, tracking, payments or grievances. Never share OTPs, passwords, PINs or bank details here." }]);
    setNextId(2);
    setInput("");
  }

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
    const reply = buildAdvancedReply(value, language) ?? buildReply(value, language);
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
            <div className="customer-chat-tools">
              <button type="button" onClick={() => setRomanUrdu((value) => !value)} aria-label="Switch language" title="Switch English / Roman Urdu"><Globe2 size={15}/><span>{romanUrdu ? "اردو / EN" : "EN / اردو"}</span></button>
              <button type="button" onClick={resetChat} aria-label="Start a new chat" title="New chat"><RotateCcw size={15}/></button>
              <button className="customer-chat-close" type="button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={19}/></button>
            </div>
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
          <div className="customer-chat-quick-actions" aria-label="Quick help topics">
            {QUICK_ACTIONS.map((action) => <button type="button" key={action} onClick={() => sendMessage(action)}>{action}</button>)}
          </div>
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
          <div className="customer-chat-footnote"><FileText size={11}/> Website guidance only · Not monitored live · Messages are not saved</div>
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
