import { useEffect, useRef, useState, type FormEvent } from "react";
import { callFunction } from "../lib/supabase";
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
type ChatSource = { title: string; url: string };
type ChatMessage = {
  id: number;
  role: "assistant" | "customer";
  text: string;
  links?: ChatLink[];
  sources?: ChatSource[];
  searched?: boolean;
};
type AssistantApiResponse = { answer: string; sources?: ChatSource[]; searched?: boolean; checkedAt?: string };

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
  const [isTyping, setIsTyping] = useState(false);
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
  }, [messages, open, isTyping]);

  async function sendMessage(raw: string) {
    const value = raw.trim();
    if (!value || isTyping) return;
    const language = isRomanUrdu(value) || romanUrdu;
    setRomanUrdu(language);
    if (isSensitive(value)) {
      setMessages((current) => [...current, {
        id: nextId,
        role: "assistant",
        text: language
          ? "Security warning: please remove personal details, Aadhaar/PAN numbers, phone numbers, email addresses, OTPs, passwords, PINs and bank details. Only ask a general service question here."
          : "Security warning: please remove personal details, Aadhaar/PAN numbers, phone numbers, email addresses, OTPs, passwords, PINs and bank details. This assistant accepts general service questions only.",
      }]);
      setNextId((current) => current + 1);
      setInput("");
      return;
    }
    const localReply = buildAdvancedReply(value, language);
    const customerMessage: ChatMessage = { id: nextId, role: "customer", text: value };
    if (localReply) {
      setMessages((current) => [...current, customerMessage, { id: nextId + 1, role: "assistant", ...localReply }]);
      setNextId((current) => current + 2);
      setInput("");
      return;
    }
    const recentHistory = messages.slice(-6).map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      text: item.text,
    }));
    setMessages((current) => [...current, customerMessage]);
    setNextId((current) => current + 1);
    setInput("");
    setIsTyping(true);
    try {
      const result = await callFunction<AssistantApiResponse>("customer-ai-assistant", {
        message: value,
        history: recentHistory,
        language: language ? "Roman Urdu" : "English",
      });
      setMessages((current) => [...current, {
        id: nextId + 1,
        role: "assistant",
        text: result.answer || (language ? "Maazrat, main is sawal ka verified jawab nahin de saka." : "Sorry, I could not prepare a verified answer for that question."),
        sources: result.sources ?? [],
        searched: Boolean(result.searched),
      }]);
      setNextId((current) => current + 1);
    } catch {
      setMessages((current) => [...current, {
        id: nextId + 1,
        role: "assistant",
        text: language
          ? "Live AI research filhaal available nahin hai. Main current documents ki tasdeeq nahin kar sakta. Barah-e-karam BABA'S CYBER CAFE support se rabta karein."
          : "Live AI research is temporarily unavailable, so I cannot verify current document requirements right now. Please contact BABA'S CYBER CAFE support for confirmation.",
        links: [
          { label: "Contact Support", href: CONTACT_LINK },
          { label: "WhatsApp", href: "https://wa.me/917006865909" },
        ],
      }]);
      setNextId((current) => current + 1);
    } finally {
      setIsTyping(false);
    }
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
              <span><i/> AI SERVICE ASSISTANT · LIVE RESEARCH</span>
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
                  {message.sources && message.sources.length > 0 && (
                    <div className="customer-chat-sources">
                      <strong>{message.searched ? "Official sources checked" : "Sources"}</strong>
                      {message.sources.map((source) => (
                        <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                          {source.title}<ArrowUpRight size={12}/>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {isTyping && (
              <article className="customer-chat-message assistant customer-chat-typing">
                <div className="customer-chat-bubble"><p>Checking the service catalogue and official sources…</p><span className="customer-chat-dots"><i/><i/><i/></span></div>
              </article>
            )}
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
              placeholder="Ask about a service or required documents…"
              aria-label="Ask about BABA'S CYBER CAFE services"
              maxLength={500}
              autoComplete="off"
            />
            <button type="submit" disabled={!input.trim() || isTyping} aria-label="Send message"><Send size={17}/></button>
          </form>
          <div className="customer-chat-footnote"><FileText size={11}/> AI guidance · Public service questions only · Chat history stays in this session</div>
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
