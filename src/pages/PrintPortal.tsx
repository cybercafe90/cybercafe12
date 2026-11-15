import { useMemo, useState, type FormEvent } from "react";
import { callFunction, supabase } from "../lib/supabase";
import { ArrowRight, CheckCircle2, FileText, LockKeyhole, Printer, ShieldCheck, UploadCloud } from "lucide-react";
import "./PrintPortal.css";

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void }; }
}
type Kind = "document" | "photo" | "id" | "resume";
type OrderDetails = { kind: Kind; copies: number; colour: "mono" | "colour"; sides: "single" | "manual-duplex"; pageCount: number; selectedPageCount: number; photoCount: number; photoWidth: number; photoHeight: number };
type Created = { jobId: string; jobNumber: string; storagePath: string; uploadToken: string; amount: number; currency: string; keyId: string };
type CheckoutOrder = { orderId: string; amount: number; currency: string; keyId: string };
type Tracked = { jobNumber: string; customerName: string; fileName: string; amount: number; paymentStatus: string; status: string };
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

let razorpayScript: Promise<void> | null = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScript) return razorpayScript;
  razorpayScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => window.Razorpay ? resolve() : reject(new Error("Razorpay checkout could not be loaded."));
    script.onerror = () => reject(new Error("Razorpay could not be loaded. Check your internet connection."));
    document.head.appendChild(script);
  }).catch(error => { razorpayScript = null; throw error; });
  return razorpayScript;
}

export default function PrintPortal() {
  const [kind, setKind] = useState<Kind>("document");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [copies, setCopies] = useState(1);
  const [colour, setColour] = useState<"mono" | "colour">("mono");
  const [sides, setSides] = useState<"single" | "manual-duplex">("single");
  const [pageCount, setPageCount] = useState(1);
  const [selectedPageCount] = useState(1);
  const [photoCount, setPhotoCount] = useState(8);
  const [photoWidth, setPhotoWidth] = useState(35);
  const [photoHeight, setPhotoHeight] = useState(45);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [paid, setPaid] = useState(false);
  const [trackJob, setTrackJob] = useState("");
  const [trackMobile, setTrackMobile] = useState("");
  const [tracked, setTracked] = useState<Tracked | null>(null);

  const details: OrderDetails = { kind, copies, colour, sides, pageCount, selectedPageCount: pageCount, photoCount, photoWidth, photoHeight };
  const estimate = useMemo(() => {
    if (kind === "document" || kind === "resume") {
      const rate = sides === "manual-duplex" ? (colour === "mono" ? 9 : 15) : (colour === "mono" ? 5 : 9);
      return Math.ceil(pageCount / (sides === "manual-duplex" ? 2 : 1)) * rate * copies;
    }
    if (kind === "id") return 10 * copies;
    const base = photoCount === 6 ? 30 : photoCount === 12 ? 60 : 40;
    return Math.ceil((base * photoWidth * photoHeight / (35 * 45)) / 5) * 5;
  }, [kind, sides, colour, selectedPageCount, copies, photoCount, photoWidth, photoHeight]);

  async function pay(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    if (!supabase) { setNotice("Secure ordering is temporarily unavailable. Please contact the cafe."); return; }
    if (!name.trim() || !/^[+0-9()\s-]{8,18}$/.test(mobile.trim())) { setNotice("Enter your name and a valid mobile number."); return; }
    if (!file || file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf") || file.size < 1 || file.size > 25 * 1024 * 1024) { setNotice("Choose a PDF file up to 25 MB."); return; }
    if ((kind === "document" || kind === "resume") && (pageCount < 1 || pageCount > 1000)) { setNotice("Enter a valid PDF page count."); return; }
    if (kind === "photo" && (photoWidth < 15 || photoWidth > 80 || photoHeight < 15 || photoHeight > 100)) { setNotice("Photo dimensions must be 15–80 mm wide and 15–100 mm high."); return; }
    setBusy(true);
    try {
      const created = await callFunction<Created>("print-orders", { action: "create_job", customerName: name, mobile, fileName: file.name, fileSize: file.size, contentType: "application/pdf", details });
      setJobNumber(created.jobNumber);
      const { error: uploadError } = await supabase.storage.from("print-jobs").uploadToSignedUrl(created.storagePath, created.uploadToken, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error("Your secure PDF upload failed: " + uploadError.message);
      const order = await callFunction<CheckoutOrder>("print-orders", { action: "create_order", jobNumber: created.jobNumber, mobile });
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay checkout is unavailable. Your job reference is " + created.jobNumber + ".");
      const checkout = new window.Razorpay({
        key: order.keyId || created.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
        name: "BABA'S CYBER CAFE", description: "Print order " + created.jobNumber,
        prefill: { name, contact: mobile }, theme: { color: "#c6a15b" },
        handler: async (result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          setBusy(true);
          try {
            const verified = await callFunction<{ verified: boolean; paid: boolean; message: string }>("print-orders", {
              action: "verify_payment", jobNumber: created.jobNumber, mobile,
              razorpayOrderId: result.razorpay_order_id, razorpayPaymentId: result.razorpay_payment_id, razorpaySignature: result.razorpay_signature,
            });
            if (verified.paid) setPaid(true);
            setNotice(verified.message + " Your reference: " + created.jobNumber);
          } catch {
            setNotice("Razorpay returned a response, but final confirmation is still processing. Do not pay again. Keep this reference: " + created.jobNumber);
          } finally { setBusy(false); }
        },
        modal: { ondismiss: () => { setBusy(false); setNotice("Checkout closed. If you completed payment, check your job status before trying again. Reference: " + created.jobNumber); } },
      });
      checkout.open();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your print order could not be started.");
    } finally { setBusy(false); }
  }

  async function track(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(""); setTracked(null);
    try {
      const result = await callFunction<{ job: Tracked }>("print-orders", { action: "track", jobNumber: trackJob, mobile: trackMobile });
      setTracked(result.job);
    } catch (error) { setNotice(error instanceof Error ? error.message : "We could not find this print job."); }
    finally { setBusy(false); }
  }

  return <main className="print-portal">
    <section className="print-hero"><div className="print-hero-inner">
      <div className="print-brandline"><span className="print-brandmark"><Printer size={19}/></span><span>BABA'S CYBER CAFE <i>· DIGITAL PRINT DESK</i></span><a href="/print/admin" style={{marginLeft:"auto",color:"inherit",fontWeight:700,textDecoration:"none"}}>Owner print desk <ArrowRight size={14}/></a></div>
      <div className="print-hero-copy"><span className="print-eyebrow">UPLOAD · PAY · COLLECT</span><h1>Printing, made <em>simple.</em></h1><p>Upload your PDF, pay securely through Razorpay, and collect your printouts at BABA'S CYBER CAFE.</p><div className="print-trust"><span><ShieldCheck size={15}/> Private PDF storage</span><span><LockKeyhole size={15}/> Secure Razorpay payment</span></div></div>
      <div className="print-hero-art" aria-hidden="true"><div className="paper-stack"><div className="paper paper-back"></div><div className="paper paper-front"><span></span><span></span><span></span><b>PRINT<br/>READY</b></div><div className="paper-seal"><Printer size={25}/></div></div></div>
    </div></section>
    <div className="print-content">
      <div className="print-step-heading"><div><span className="print-eyebrow">01 / SELECT SERVICE</span><h2>What would you like to print?</h2></div></div>
      <div className="print-kind-grid">
        {([["document","Document printing","PDF pages · B&W or colour"],["photo","Passport photographs","Photo sheet PDF"],["id","ID card / Aadhaar","Front and back PDF"],["resume","Resume printing","Print your existing resume PDF"]] as [Kind,string,string][]).map(([id,title,description])=><button key={id} type="button" className={kind===id?"print-kind is-selected":"print-kind"} onClick={()=>setKind(id)}><span className="print-kind-icon"><FileText size={21}/></span><span className="print-kind-copy"><b>{title}</b><small>{description}</small></span><span className="print-kind-check">{kind===id?<CheckCircle2 size={19}/>:<ArrowRight size={18}/>}</span></button>)}
      </div>
      <form className="print-panel" onSubmit={pay} style={{display:"grid",gap:18}}>
        <div className="print-panel-title"><span className="print-eyebrow">02 / ORDER DETAILS</span><h2>Prepare your print order</h2><p>PDF only · Maximum 25 MB · Your document is stored privately.</p></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
          <label className="print-field">Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Customer name"/></label>
          <label className="print-field">Mobile number<input required inputMode="tel" value={mobile} onChange={e=>setMobile(e.target.value)} placeholder="10-digit mobile number"/></label>
        </div>
        <label className="print-dropzone"><input type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]??null)}/><span className="print-upload-icon"><UploadCloud size={26}/></span><b>{file?file.name:"Choose your PDF file"}</b><small>{file?((file.size/1024/1024).toFixed(2)+" MB selected"):"Tap to browse files on your phone · PDF only"}</small></label>
        {(kind==="document"||kind==="resume")&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12}}>
          <label className="print-field">Total PDF pages<input type="number" min="1" max="1000" value={pageCount} onChange={e=>setPageCount(Number(e.target.value))}/></label>
          
          <label className="print-field">Copies<input type="number" min="1" max="100" value={copies} onChange={e=>setCopies(Number(e.target.value))}/></label>
        </div>}
        {(kind==="document"||kind==="resume")&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
          <label className="print-field">Print colour<select value={colour} onChange={e=>setColour(e.target.value as "mono"|"colour")}><option value="mono">Black &amp; white</option><option value="colour">Colour</option></select></label>
          <label className="print-field">Sides<select value={sides} onChange={e=>setSides(e.target.value as "single"|"manual-duplex")}><option value="single">Single-sided</option><option value="manual-duplex">Two-sided (manual)</option></select></label>
        </div>}
        {kind==="id"&&<label className="print-field">Copies<input type="number" min="1" max="100" value={copies} onChange={e=>setCopies(Number(e.target.value))}/></label>}
        {kind==="photo"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12}}>
          <label className="print-field">Photo quantity<select value={photoCount} onChange={e=>setPhotoCount(Number(e.target.value))}><option value="6">6 photos · ₹30 base</option><option value="8">8 photos · ₹40 base</option><option value="12">12 photos · ₹60 base</option></select></label>
          <label className="print-field">Width (mm)<input type="number" min="15" max="80" value={photoWidth} onChange={e=>setPhotoWidth(Number(e.target.value))}/></label>
          <label className="print-field">Height (mm)<input type="number" min="15" max="100" value={photoHeight} onChange={e=>setPhotoHeight(Number(e.target.value))}/></label>
        </div>}
        <div style={{padding:18,borderRadius:14,background:"#101b25",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><small style={{color:"#c6a15b",letterSpacing:1}}>ESTIMATED TOTAL</small><div style={{fontSize:26,fontWeight:800}}>{money(estimate)}</div><small style={{color:"#c3cbd2"}}>Final amount is recalculated securely by the server.</small></div><button type="submit" disabled={busy} className="print-submit">{busy?"Please wait…":"Upload & pay with Razorpay"} <ArrowRight size={16}/></button></div>
        {notice&&<p role="status" className="print-notice">{notice}</p>}
        {jobNumber&&<div className="print-success"><CheckCircle2 size={20}/><div><b>{paid?"Payment verified — job queued":"Print reference: "+jobNumber}</b><small>{paid?"Your order is in the shop print queue.":"Keep this reference to track your order. Check payment status before retrying checkout."}</small></div></div>}
      </form>
      <section className="print-panel" style={{marginTop:24}}><div className="print-panel-title"><span className="print-eyebrow">03 / TRACK YOUR ORDER</span><h2>Check print job status</h2><p>Enter the reference received after upload and the same mobile number.</p></div><form onSubmit={track} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}><label className="print-field">Print reference<input required value={trackJob} onChange={e=>setTrackJob(e.target.value.toUpperCase())} placeholder="PRN-XXXXXXXXXX"/></label><label className="print-field">Mobile number<input required value={trackMobile} onChange={e=>setTrackMobile(e.target.value)} placeholder="Registered mobile"/></label><button className="print-submit" disabled={busy}>Track order <ArrowRight size={16}/></button></form>{tracked&&<div className="print-success" style={{marginTop:16}}><CheckCircle2 size={20}/><div><b>{tracked.jobNumber} · {tracked.status.replaceAll("_"," ")}</b><small>{tracked.customerName} · {tracked.fileName} · {money(Number(tracked.amount))} · Payment: {tracked.paymentStatus}</small></div></div>}</section>
      <p className="print-footnote">Payments are processed by Razorpay. We never ask for your UPI PIN, bank password or OTP. Your PDF is private and is accessible to the owner only after payment is verified.</p>
    </div>
  </main>;
}
