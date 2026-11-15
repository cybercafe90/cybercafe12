import { useMemo, useState, type ChangeEvent } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, Clock3, FileImage, FileText, IdCard, Printer, ShieldCheck, UploadCloud, Wallet, X, WandSparkles, UserRound, Camera, Sparkles, ScanFace } from "lucide-react";
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
  const [photoCount, setPhotoCount] = useState("8");
  const [notice, setNotice] = useState("");
  const [studioMode, setStudioMode] = useState<"resume" | "photo">("resume");
  const [resumeName, setResumeName] = useState("");
  const [resumeRole, setResumeRole] = useState("");
  const [resumeSkills, setResumeSkills] = useState("");
  const [photoSize, setPhotoSize] = useState("35 × 45 mm");
  const [photoLayout, setPhotoLayout] = useState("8");
  const [studioNotice, setStudioNotice] = useState("");

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
    setPages("all");
  }
  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setNotice("");
  }
  function submitPreview() {
    setNotice("Preview only: your file has not been uploaded, charged or sent to a printer. Live ordering will be enabled only after approval and system testing.");
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
              <label className="print-field"><span>Page selection</span><input value={pages} onChange={e => setPages(e.target.value)} placeholder="All pages or e.g. 1-3, 5"/></label>
              <label className="print-field"><span>Number of copies</span><div className="print-number"><button type="button" onClick={() => setCopies(v => Math.max(1, v - 1))} aria-label="Decrease copies">−</button><b>{copies}</b><button type="button" onClick={() => setCopies(v => Math.min(50, v + 1))} aria-label="Increase copies">+</button></div></label>
              <div className="print-field"><span>Print colour</span><div className="print-choice-row"><button type="button" className={colour === "mono" ? "is-active" : ""} onClick={() => setColour("mono")}><span className="colour-dot mono-dot"></span>Black &amp; white</button><button type="button" className={colour === "colour" ? "is-active" : ""} onClick={() => setColour("colour")}><span className="colour-dot colour-dot-full"></span>Colour</button></div></div>
              <div className="print-field"><span>Paper sides</span><div className="print-choice-row"><button type="button" className={sides === "single" ? "is-active" : ""} onClick={() => setSides("single")}>Single-sided</button><button type="button" className={sides === "manual-duplex" ? "is-active" : ""} onClick={() => setSides("manual-duplex")}>Two-sided*</button></div><small className="print-hint">*Two-sided jobs require manual paper handling on the current shop printer.</small></div>
            </> : kind === "photo" ? <>
              <div className="print-field"><span>Passport photo layout</span><div className="print-choice-row">{["6","8","12"].map(n => <button key={n} type="button" className={photoCount === n ? "is-active" : ""} onClick={() => setPhotoCount(n)}>{n} photos</button>)}</div></div>
              <div className="print-privacy-note"><FileImage size={17}/><span>Final layout will use 35 × 45 mm photo sizing on A4 with cut guides, subject to image review.</span></div>
            </> : <>
              <div className="print-field"><span>Document sides</span><div className="print-choice-row"><button type="button" className="is-active">Front + back</button><button type="button">Front only</button></div></div>
              <div className="print-privacy-note"><IdCard size={17}/><span>We'll arrange the ID images at a suitable card size on an A4 sheet after checking the uploaded file.</span></div>
            </>}
            <div className="print-routing-note">{kind === "photo" || kind === "resume" ? <><ShieldCheck size={16}/><span><b>Admin approval required</b> — externally prepared photos and resumes are reviewed before printing.</span></> : <><CheckCircle2 size={16}/><span><b>Fast copy workflow</b> — standard B&amp;W and colour copies can enter the automatic queue after verified payment.</span></>}</div>
            <div className="print-preview-total"><div><small>ESTIMATED TOTAL</small><b>Price shown after configuration</b></div><Wallet size={21}/></div>
            <button type="button" className="print-continue" onClick={submitPreview} disabled={!file || !allowed}>Review print request <ArrowRight size={17}/></button>
            {notice && <p className="print-preview-notice" role="status">{notice}</p>}
            <small className="print-no-charge">Preview mode · No payment · No print job created</small>
          </section>
        </div>

        <section className="print-how"><div><span className="print-eyebrow">HOW IT WILL WORK</span><h2>From your phone to our printer.</h2></div><div className="print-how-steps"><span><b>01</b><small>Scan the shop QR</small></span><i></i><span><b>02</b><small>Upload &amp; choose</small></span><i></i><span><b>03</b><small>Pay securely</small></span><i></i><span><b>04</b><small>Collect at the cafe</small></span></div></section>
        <footer className="print-footer"><span>BABA'S CYBER CAFE · SRINAGAR</span><span>Questions? <a href="https://wa.me/917006865909" target="_blank" rel="noreferrer">WhatsApp the shop</a></span></footer>
      </div>
    </main>
  );
}
