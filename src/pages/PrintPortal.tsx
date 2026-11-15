import { useMemo, useState, type ChangeEvent } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, Clock3, FileImage, FileText, IdCard, Printer, ShieldCheck, UploadCloud, Wallet, X, WandSparkles, UserRound, Camera } from "lucide-react";
import "./PrintPortal.css";

type PrintKind = "document" | "photo" | "id" | "resume";
const kinds: { id: PrintKind; title: string; description: string; icon: typeof FileText }[] = [
  { id: "document", title: "Document printing", description: "PDF documents · page range · copies", icon: FileText },
  { id: "photo", title: "Passport photographs", description: "Photo sheet with cut guides", icon: FileImage },
  { id: "id", title: "ID card / Aadhaar", description: "Front and back on one sheet", icon: IdCard },
  { id: "resume", title: "Resume printing", description: "CV and job application documents", icon: FileText },
];

export default function PrintPortal() {
  const [kind, setKind] = useState<PrintKind>("document");
  const [file, setFile] = useState<File | null>(null);
  const [copies, setCopies] = useState(1);
  const [colour, setColour] = useState<"mono" | "colour">("mono");
  const [sides, setSides] = useState<"single" | "manual-duplex">("single");
  const [pages, setPages] = useState("all");
  const [pageCount, setPageCount] = useState(1);
  const [idSides, setIdSides] = useState<"both" | "front">("both");
  const [photoPrintSize, setPhotoPrintSize] = useState<"35x45" | "2x2" | "custom">("35x45");
  const [printPhotoWidth, setPrintPhotoWidth] = useState(35);
  const [printPhotoHeight, setPrintPhotoHeight] = useState(45);
  const [showReview, setShowReview] = useState(false);
  const [photoCount, setPhotoCount] = useState("8");
  const [notice, setNotice] = useState("");
  const [studioMode, setStudioMode] = useState<"resume" | "photo">("resume");
  const [resumeName, setResumeName] = useState("");
  const [resumeRole, setResumeRole] = useState("");
  const [resumeSkills, setResumeSkills] = useState("");
  const [photoSize, setPhotoSize] = useState("35 × 45 mm");
  const [photoLayout, setPhotoLayout] = useState("8");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [customPhotoWidth, setCustomPhotoWidth] = useState("35");
  const [customPhotoHeight, setCustomPhotoHeight] = useState("45");
  const [studioNotice, setStudioNotice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [submittedOrder, setSubmittedOrder] = useState<{ id: string; createdAt: string } | null>(null);

  const accept = kind === "document" || kind === "resume" ? ".pdf,application/pdf" : "image/jpeg,image/png,.jpg,.jpeg,.png,.pdf";
  const allowed = useMemo(() => {
    if (!file) return false;
    const ext = file.name.split(".").pop()?.toLowerCase();
    return (kind === "document" || kind === "resume") ? ext === "pdf" : ["jpg", "jpeg", "png", "pdf"].includes(ext ?? "");
  }, [file, kind]);

  function changeKind(next: PrintKind) {
    setKind(next);
    setFile(null);
    setNotice("");
    setShowReview(false);
    setPages("all");
  }
  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setNotice("");
  }
  const selectedPageCount = useMemo(() => {
    if (!pages.trim() || pages.trim().toLowerCase() === "all") return pageCount;
    const selected = new Set<number>();
    for (const part of pages.split(",")) {
      const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) return 0;
      const start = Number(match[1]);
      const end = Number(match[2] || match[1]);
      if (start < 1 || end < start || end > pageCount || end - start > 500) return 0;
      for (let n = start; n <= end; n++) selected.add(n);
    }
    return selected.size;
  }, [pages, pageCount]);

  const estimate = useMemo(() => {
    if (kind === "document" || kind === "resume") {
      const rate = sides === "manual-duplex" ? (colour === "mono" ? 9 : 15) : (colour === "mono" ? 5 : 9);
      const sheets = sides === "manual-duplex" ? Math.ceil(selectedPageCount / 2) : selectedPageCount;
      return { amount: selectedPageCount > 0 ? sheets * rate * copies + (kind === "resume" ? 40 : 0) : 0, detail: selectedPageCount + " page(s) · " + copies + " cop" + (copies === 1 ? "y" : "ies") + " · " + (sides === "manual-duplex" ? "two-sided" : "single-sided") + " · " + (colour === "mono" ? "B&W" : "colour") + (kind === "resume" ? " · includes ₹40 resume formatting" : "") };
    }
    if (kind === "id") return { amount: 10 * copies, detail: (idSides === "both" ? "Front + back" : "Front only") + " · " + copies + " cop" + (copies === 1 ? "y" : "ies") };
    const base = Number(photoCount) === 6 ? 30 : Number(photoCount) === 12 ? 60 : 40;
    const w = photoPrintSize === "2x2" ? 50.8 : photoPrintSize === "custom" ? printPhotoWidth : 35;
    const h = photoPrintSize === "2x2" ? 50.8 : photoPrintSize === "custom" ? printPhotoHeight : 45;
    const valid = Number.isFinite(w) && Number.isFinite(h) && w >= 15 && h >= 15 && w <= 80 && h <= 100;
    return { amount: valid ? Math.ceil((base * (w * h) / (35 * 45)) / 5) * 5 : 0, detail: photoCount + " photos · " + w + " × " + h + " mm · per sheet · rounded up to nearest ₹5", valid };
  }, [kind, sides, colour, selectedPageCount, copies, idSides, photoCount, photoPrintSize, printPhotoWidth, printPhotoHeight]);

  function submitPreview() {
    setNotice("");
    if (!file || !allowed) return;
    if ((kind === "document" || kind === "resume") && selectedPageCount < 1) {
      setNotice("Check the page count and selection. Use “all” or valid page numbers such as 1-3, 5.");
      return;
    }
    if (kind === "photo" && "valid" in estimate && !estimate.valid) {
      setNotice("Custom photo dimensions must be 15–80 mm wide and 15–100 mm high.");
      return;
    }
    setShowReview(true);
  }

  function sendWhatsAppRequest() {
    if (!customerName.trim()) {
      setNotice("Enter your name before continuing to WhatsApp.");
      return;
    }
    const mobile = customerMobile.replace(/\\D/g, "");
    if (mobile.length !== 10) {
      setNotice("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!file || !allowed || estimate.amount <= 0) {
      setNotice("Please check your file and print settings first.");
      return;
    }
    const id = "BABA-PRN-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const createdAt = new Date().toISOString();
    const order = {
      id, createdAt, customerName: customerName.trim(), mobile,
      service: kinds.find(item => item.id === kind)?.title ?? kind,
      fileName: file.name, estimate: estimate.amount, detail: estimate.detail,
      status: "WhatsApp confirmation pending"
    };
    try {
      const key = "baba_print_requests_v1";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([order, ...existing].slice(0, 20)));
    } catch {
      setNotice("This browser could not save a local reference. Please contact the shop directly.");
      return;
    }
    setSubmittedOrder({ id, createdAt });
    const message = [
      "Hello BABA'S CYBER CAFE, I want to place a print request.",
      "Reference: " + id,
      "Name: " + order.customerName,
      "Mobile: +91 " + mobile,
      "Service: " + order.service,
      "File name: " + file.name,
      "Settings: " + estimate.detail,
      "Estimated amount: ₹" + estimate.amount,
      "Please confirm the final amount and payment/collection details. I will attach my document here."
    ].join("\\n");
    const url = "https://wa.me/917006865909?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openPrintDocument(title: string, body: string, pageCss: string) {
    const popup = window.open("", "_blank");
    if (!popup) {
      setStudioNotice("Please allow pop-ups for this site, then try downloading your PDF again.");
      return;
    }
    popup.opener = null;
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
      *{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#172a32;background:#fff}
      .toolbar{position:sticky;top:0;padding:12px 18px;background:#09202b;color:#eafcff;display:flex;align-items:center;justify-content:space-between;gap:12px;font:13px Arial}
      .toolbar button{border:0;border-radius:7px;padding:10px 16px;background:#5be5f4;color:#06202a;font-weight:700;cursor:pointer}
      .sheet{margin:22px auto;background:white}
      ${pageCss}
      @page{size:A4;margin:0}
      @media print{.toolbar{display:none!important}.sheet{margin:0!important;box-shadow:none!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body><div class="toolbar"><span>${title} · Check the preview, then choose “Save as PDF” in the print dialog.</span><button onclick="window.print()">Save / Print PDF</button></div>${body}</body></html>`);
    popup.document.close();
    setStudioNotice("Your print-ready layout is open in a new tab. Choose “Save as PDF” in the print destination. This does not submit a job to the shop; shop approval is still required before printing.");
  }

  function downloadResumePdf() {
    if (!resumeName.trim()) {
      setStudioNotice("Enter your full name before preparing your resume PDF.");
      return;
    }
    const safe = (value: string) => value.replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch] ?? ch));
    const body = `<main class="sheet"><header><h1>${safe(resumeName)}</h1><h2>${safe(resumeRole || "Professional Profile")}</h2></header><section><h3>PROFILE</h3><p>${safe(resumeSkills || "Add your education, skills and experience.")}</p></section><footer>Resume draft prepared with BABA'S CYBER CAFE · Review all details before submission</footer></main>`;
    const css = `.sheet{width:210mm;min-height:297mm;padding:22mm 20mm;box-shadow:0 3px 20px #0002}.sheet header{border-bottom:3px solid #1596a4;padding-bottom:12mm;margin-bottom:12mm}.sheet h1{font:700 27pt Georgia,serif;margin:0 0 5mm;color:#122f3a;overflow-wrap:anywhere}.sheet h2{font:600 12pt Arial;color:#16899a;margin:0}.sheet h3{font-size:10pt;letter-spacing:2px;color:#16899a}.sheet p{font:11pt/1.8 Arial;white-space:pre-wrap;overflow-wrap:anywhere}.sheet footer{margin-top:35mm;padding-top:5mm;border-top:1px solid #d8e2e3;color:#71838a;font-size:8pt}@media print{.sheet{min-height:297mm}}`;
    openPrintDocument("BABA'S CYBER CAFE · Resume", body, css);
  }

  function downloadPhotoPdf() {
    if (!photoDataUrl || !photoFile) {
      setStudioNotice("Choose a JPG or PNG photo first.");
      return;
    }
    if (photoFile.size > 10 * 1024 * 1024) {
      setStudioNotice("Please choose a photo smaller than 10 MB.");
      return;
    }
    const dims = photoSize === "2 × 2 inches" ? {w:50.8,h:50.8} : photoSize === "Custom size" ? {w:Number(customPhotoWidth),h:Number(customPhotoHeight)} : {w:35,h:45};
    if (!Number.isFinite(dims.w) || !Number.isFinite(dims.h) || dims.w < 15 || dims.h < 15 || dims.w > 80 || dims.h > 100) {
      setStudioNotice("Custom dimensions must be between 15–80 mm wide and 15–100 mm high.");
      return;
    }
    const count = Number(photoLayout);
    const cols = 4;
    const photo = `<img src="${photoDataUrl}" alt="Passport photograph">`;
    const body = `<main class="sheet"><div class="photo-grid">${Array.from({length:count},()=>`<div class="photo">${photo}</div>`).join("")}</div></main>`;
    const css = `.sheet{width:210mm;height:297mm;padding:12mm;display:flex;align-items:flex-start;justify-content:center}.photo-grid{display:grid;grid-template-columns:repeat(${cols},${dims.w}mm);grid-auto-rows:${dims.h}mm;gap:5mm 4mm;justify-content:center;align-content:start}.photo{width:${dims.w}mm;height:${dims.h}mm;border:.2mm dashed #84969b;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;display:block}@media print{.sheet{width:210mm;height:297mm}}`;
    openPrintDocument("BABA'S CYBER CAFE · Passport Photo Sheet", body, css);
  }

  return (
    <main className="print-portal">
      <section className="print-hero">
        <div className="print-hero-inner">
          <div className="print-brandline"><span className="print-brandmark"><Printer size={19}/></span><span>BABA'S CYBER CAFE <i>· DIGITAL PRINT DESK</i></span><span className="preview-pill">DESIGN PREVIEW</span></div>
          <div className="print-hero-copy">
            <span className="print-eyebrow">SCAN · UPLOAD · COLLECT</span>
            <h1>Printing, made <em>simple.</em></h1>
            <p>Send your documents from your phone. Choose your print preferences and collect your finished pages at BABA'S CYBER CAFE.</p>
            <div className="print-trust"><span><ShieldCheck size={15}/> Private by design</span><span><Clock3 size={15}/> Shop-assisted service</span></div>
            <div className="print-quick-actions"><button type="button" onClick={() => { setStudioMode("resume"); document.getElementById("personal-document-studio")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}> <FileText size={16}/> Create a resume <ArrowRight size={15}/></button><button type="button" onClick={() => { setStudioMode("photo"); document.getElementById("personal-document-studio")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Camera size={16}/> Make passport photos <ArrowRight size={15}/></button></div>
          </div>
          <div className="print-hero-art" aria-hidden="true"><div className="paper-stack"><div className="paper paper-back"></div><div className="paper paper-front"><span></span><span></span><span></span><b>PRINT<br/>READY</b></div><div className="paper-seal"><Printer size={25}/></div></div></div>
        </div>
      </section>

      <div className="print-content">
        <div className="print-step-heading"><div><span className="print-eyebrow">01 / SELECT A SERVICE</span><h2>What would you like to print?</h2></div><span className="step-counter">STEP 1 OF 3</span></div>
        <div className="print-kind-grid">
          {kinds.map(({ id, title, description, icon: Icon }) => (
            <button key={id} type="button" className={kind === id ? "print-kind is-selected" : "print-kind"} onClick={() => changeKind(id)} aria-pressed={kind === id}>
              <span className="print-kind-icon"><Icon size={21}/></span><span className="print-kind-copy"><b>{title}</b><small>{description}</small></span><span className="print-kind-check">{kind === id ? <CheckCircle2 size={19}/> : <ChevronRight size={18}/>}</span>
            </button>
          ))}
        </div>

        <div className="print-work-grid">
          <section className="print-panel print-upload-panel">
            <div className="print-panel-title"><span className="print-eyebrow">02 / ADD YOUR FILE</span><h2>Upload your document</h2><p>Your file stays on this preview page. No upload takes place yet.</p></div>
            <label className={file ? "print-dropzone has-file" : "print-dropzone"}>
              <input type="file" accept={accept} onChange={onFile}/>
              {file ? <><span className="print-upload-icon"><CheckCircle2 size={25}/></span><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB · Selected on this device</small><span className="print-change-file">Choose another file</span></> : <><span className="print-upload-icon"><UploadCloud size={26}/></span><b>Choose a file to print</b><small>{kind === "document" || kind === "resume" ? "PDF only" : "JPG, PNG or PDF"} · Maximum size will be confirmed before launch</small><span className="print-browse">Browse files</span></>}
            </label>
            {file && <button type="button" className="print-remove-file" onClick={() => setFile(null)}><X size={14}/> Remove file</button>}
            {file && !allowed && <p className="print-error">This file type is not supported for the selected service.</p>}
            <div className="print-privacy-note"><ShieldCheck size={17}/><span><b>Your documents are sensitive.</b> The final service will use private storage, short-lived access links and an automatic deletion policy.</span></div>
          </section>

          <section className="print-panel print-options-panel">
            <div className="print-panel-title"><span className="print-eyebrow">03 / PRINT PREFERENCES</span><h2>Set your preferences</h2><p>Choose how you want your pages prepared.</p></div>
            {kind === "document" || kind === "resume" ? <>
              <label className="print-field"><span>Total pages in your PDF</span><input type="number" min="1" max="500" value={pageCount} onChange={e => setPageCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}/></label>
              <label className="print-field"><span>Page selection</span><input value={pages} onChange={e => setPages(e.target.value)} placeholder="all or e.g. 1-3, 5"/></label>
              <label className="print-field"><span>Number of copies</span><div className="print-number"><button type="button" onClick={() => setCopies(v => Math.max(1, v - 1))} aria-label="Decrease copies">−</button><b>{copies}</b><button type="button" onClick={() => setCopies(v => Math.min(50, v + 1))} aria-label="Increase copies">+</button></div></label>
              <div className="print-field"><span>Print colour</span><div className="print-choice-row"><button type="button" className={colour === "mono" ? "is-active" : ""} onClick={() => setColour("mono")}><span className="colour-dot mono-dot"></span>Black &amp; white</button><button type="button" className={colour === "colour" ? "is-active" : ""} onClick={() => setColour("colour")}><span className="colour-dot colour-dot-full"></span>Colour</button></div></div>
              <div className="print-field"><span>Paper sides</span><div className="print-choice-row"><button type="button" className={sides === "single" ? "is-active" : ""} onClick={() => setSides("single")}>Single-sided</button><button type="button" className={sides === "manual-duplex" ? "is-active" : ""} onClick={() => setSides("manual-duplex")}>Two-sided*</button></div><small className="print-hint">*Two-sided jobs require manual paper handling on the current shop printer.</small></div>
            </> : kind === "photo" ? <>
              <div className="print-field"><span>Passport photo layout</span><div className="print-choice-row">{["6","8","12"].map(n => <button key={n} type="button" className={photoCount === n ? "is-active" : ""} onClick={() => setPhotoCount(n)}>{n} photos · ₹{n === "6" ? 30 : n === "8" ? 40 : 60}</button>)}</div></div>
              <label className="print-field"><span>Photo size</span><select value={photoPrintSize} onChange={e => setPhotoPrintSize(e.target.value as "35x45" | "2x2" | "custom")}><option value="35x45">35 × 45 mm</option><option value="2x2">2 × 2 inches</option><option value="custom">Custom size</option></select></label>
              {photoPrintSize === "custom" && <div className="print-choice-row"><label className="print-field"><span>Width (mm)</span><input type="number" min="15" max="80" value={printPhotoWidth} onChange={e => setPrintPhotoWidth(Number(e.target.value))}/></label><label className="print-field"><span>Height (mm)</span><input type="number" min="15" max="100" value={printPhotoHeight} onChange={e => setPrintPhotoHeight(Number(e.target.value))}/></label></div>}
              <div className="print-privacy-note"><FileImage size={17}/><span>Final layout will use 35 × 45 mm photo sizing on A4 with cut guides, subject to image review.</span></div>
            </> : <>
              <div className="print-field"><span>Document sides</span><div className="print-choice-row"><button type="button" className={idSides === "both" ? "is-active" : ""} onClick={() => setIdSides("both")}>Front + back</button><button type="button" className={idSides === "front" ? "is-active" : ""} onClick={() => setIdSides("front")}>Front only</button></div></div>
              <div className="print-privacy-note"><IdCard size={17}/><span>We'll arrange the ID images at a suitable card size on an A4 sheet after checking the uploaded file.</span></div>
            </>}
            <div className="print-routing-note">{kind === "photo" || kind === "resume" ? <><ShieldCheck size={16}/><span><b>Admin approval required</b> — externally prepared photos and resumes are reviewed before printing.</span></> : <><CheckCircle2 size={16}/><span><b>Fast copy workflow</b> — standard B&amp;W and colour copies can enter the automatic queue after verified payment.</span></>}</div>
            <div className="print-preview-total"><div><small>ESTIMATED TOTAL</small><b>{estimate.amount > 0 ? "₹" + estimate.amount.toFixed(2) : "Check your configuration"}</b><small>{estimate.detail}</small></div><Wallet size={21}/></div>
            <button type="button" className="print-continue" onClick={submitPreview} disabled={!file || !allowed || estimate.amount <= 0}>Review print request <ArrowRight size={17}/></button>
            {notice && <p className="print-preview-notice" role="status">{notice}</p>}
            {showReview && <div className="print-review-card"><span className="print-eyebrow">ORDER SUMMARY · CHECK BEFORE PAYMENT</span><h3>Review print request</h3><p><b>Service:</b> {kinds.find(item => item.id === kind)?.title}</p><p><b>File:</b> {file?.name}</p><p><b>Configuration:</b> {estimate.detail}</p><div className="print-review-total"><span>Estimated total</span><strong>₹{estimate.amount.toFixed(2)}</strong></div><p className="print-review-note">{kind === "photo" ? "Photo orders require shop/admin approval before printing." : kind === "resume" ? "Resume print orders require shop review. Resume formatting is ₹40, separate from printing." : "Payment must be verified before the print job enters the shop queue."}</p><p className="print-review-note">This free preview saves a reference on this device and opens WhatsApp with your request details. Your document is not uploaded automatically; attach it in the WhatsApp chat. The shop must confirm the final price and order.</p>
              {submittedOrder ? <div className="print-local-order" role="status"><b>Request prepared</b><strong>{submittedOrder.id}</strong><small>Saved only in this browser · Awaiting WhatsApp confirmation</small><a href={"https://wa.me/917006865909?text=" + encodeURIComponent("Hello, please help me with print request " + submittedOrder.id + ".")} target="_blank" rel="noreferrer">Reopen WhatsApp chat</a></div> : <div className="print-order-contact"><label className="print-field"><span>Your name</span><input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Full name" maxLength={80}/></label><label className="print-field"><span>Mobile number</span><input value={customerMobile} onChange={e => setCustomerMobile(e.target.value.replace(/\\D/g, "").slice(0,10))} placeholder="10-digit mobile number" inputMode="numeric" maxLength={10}/></label><button type="button" className="print-continue" onClick={sendWhatsAppRequest}>Continue with WhatsApp <ArrowRight size={17}/></button></div>}
              <button type="button" className="print-remove-file" onClick={() => { setShowReview(false); setSubmittedOrder(null); }}>Back to edit request</button></div>}
            <small className="print-no-charge">Estimate only · No payment collected · No print job created</small>
          </section>
        </div>

        <section className="print-studio" id="personal-document-studio">
          <div className="print-studio-heading">
            <span className="print-eyebrow">YOUR PERSONAL DOCUMENT STUDIO</span>
            <h2>Create it here. Get it shop-approved.</h2>
            <p>Prepare a clean resume or passport-photo sheet. Nothing is sent to print until the shop reviews and approves it.</p>
          </div>
          <div className="print-studio-tabs" role="tablist" aria-label="Document studio">
            <button type="button" className={studioMode === "resume" ? "is-active" : ""} onClick={() => { setStudioMode("resume"); setStudioNotice(""); }}><WandSparkles size={17}/> Resume creator</button>
            <button type="button" className={studioMode === "photo" ? "is-active" : ""} onClick={() => { setStudioMode("photo"); setStudioNotice(""); }}><Camera size={17}/> Passport photo studio</button>
          </div>
          {studioMode === "resume" ? (
            <div className="print-studio-grid">
              <div className="print-studio-form">
                <label className="print-field"><span>Full name</span><input value={resumeName} onChange={e => setResumeName(e.target.value)} placeholder="Enter your full name"/></label>
                <label className="print-field"><span>Career goal / applying for</span><input value={resumeRole} onChange={e => setResumeRole(e.target.value)} placeholder="e.g. Office assistant"/></label>
                <label className="print-field"><span>Skills, education and experience</span><textarea value={resumeSkills} onChange={e => setResumeSkills(e.target.value)} placeholder="Add your education, skills and work experience..." rows={5}/></label>
                <small className="print-hint">Resume creation and formatting: ₹40 per resume. Printing, if requested, is charged separately at ₹5 per A4 page.</small>
                <button type="button" className="print-continue" onClick={downloadResumePdf}>Create resume PDF <ArrowRight size={17}/></button>
              </div>
              <div className="print-resume-preview">
                <span className="print-eyebrow">LIVE RESUME PREVIEW</span>
                <div className="print-resume-paper">
                  <h3>{resumeName.trim() || "Your Full Name"}</h3>
                  <b>{resumeRole.trim() || "Career objective"}</b>
                  <hr/>
                  <h4>PROFILE &amp; EXPERIENCE</h4>
                  <p>{resumeSkills.trim() || "Your education, skills and experience will appear here as you type."}</p>
                  <small>Prepared with BABA'S CYBER CAFE · Draft for review</small>
                </div>
              </div>
            </div>
          ) : (
            <div className="print-studio-grid">
              <div className="print-studio-form">
                <label className="print-field"><span>Choose your photo</span><input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={e => { const selected = e.target.files?.[0] ?? null; setPhotoFile(selected); setStudioNotice(""); if (selected && selected.size <= 10 * 1024 * 1024 && ["image/jpeg","image/png"].includes(selected.type)) { const reader = new FileReader(); reader.onload = () => setPhotoDataUrl(String(reader.result ?? "")); reader.readAsDataURL(selected); } else { setPhotoDataUrl(""); if (selected) setStudioNotice("Choose a JPG or PNG image up to 10 MB."); } }}/></label>
                <label className="print-field"><span>Photo size</span><select value={photoSize} onChange={e => setPhotoSize(e.target.value)}><option>35 × 45 mm</option><option>2 × 2 inches</option><option>Custom size</option></select></label>
                {photoSize === "Custom size" && <><label className="print-field"><span>Width (mm)</span><input type="number" min="15" max="80" value={customPhotoWidth} onChange={e => setCustomPhotoWidth(e.target.value)}/></label><label className="print-field"><span>Height (mm)</span><input type="number" min="15" max="100" value={customPhotoHeight} onChange={e => setCustomPhotoHeight(e.target.value)}/></label></>}
                <label className="print-field"><span>Photos per sheet</span><select value={photoLayout} onChange={e => setPhotoLayout(e.target.value)}><option value="6">6 photos</option><option value="8">8 photos</option><option value="12">12 photos</option></select></label>
                <button type="button" className="print-continue" onClick={downloadPhotoPdf} disabled={!photoDataUrl}>Create passport photo PDF <ArrowRight size={17}/></button>
              </div>
              <div className="print-photo-preview">
                <span className="print-eyebrow">PHOTO SHEET PREVIEW</span>
                <div className="print-photo-sheet">{Array.from({length: Number(photoLayout)}, (_, i) => <div key={i} className="print-photo-placeholder">{photoDataUrl ? <img src={photoDataUrl} alt={`Passport photo preview ${i + 1}`}/> : <UserRound size={22}/>}</div>)}</div>
                <small>{photoSize} · {photoLayout} photos · {photoDataUrl ? "Your photo preview" : "Live sheet preview"} · A4 concept</small>
              </div>
            </div>
          )}
          {studioNotice && <p className="print-preview-notice" role="status">{studioNotice}</p>}
          <div className="print-routing-note"><ShieldCheck size={16}/><span><b>Shop approval required</b> — all created resumes and passport-photo sheets are reviewed before printing. PDF drafts can be created on your device. Check photo positioning and dimensions before use; shop approval is required before printing.</span></div>
        </section>

        <section className="print-how"><div><span className="print-eyebrow">HOW IT WILL WORK</span><h2>From your phone to our printer.</h2></div><div className="print-how-steps"><span><b>01</b><small>Scan the shop QR</small></span><i></i><span><b>02</b><small>Upload &amp; choose</small></span><i></i><span><b>03</b><small>Pay securely</small></span><i></i><span><b>04</b><small>Collect at the cafe</small></span></div></section>
        <footer className="print-footer"><span>BABA'S CYBER CAFE · SRINAGAR</span><span>Questions? <a href="https://wa.me/917006865909" target="_blank" rel="noreferrer">WhatsApp the shop</a></span></footer>
      </div>
    </main>
  );
}
