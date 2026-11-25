import { useState } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { callApiExpress } from "../lib/apiExpressClient";

export default function ApiExpressBankVerify() {
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [vpa, setVpa] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [verified, setVerified] = useState(false);

  async function verify() {
    const useVpa = vpa.trim().length > 0;
    if (useVpa ? !/^[\w.-]+@[\w.-]+$/.test(vpa.trim()) : (!accountNumber.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc.trim()))) {
      setVerified(false);
      setStatus("Enter a valid VPA, or account number and IFSC.");
      return;
    }
    setBusy(true); setVerified(false); setStatus("");
    try {
      const payload = useVpa ? { vpa: vpa.trim() } : { account_number: accountNumber.trim(), ifsc: ifsc.trim().toUpperCase() };
      const result = await callApiExpress("bank_verify", payload);
      if (!result.ok) { setStatus(result.error ?? "Bank verification is unavailable."); return; }
      const data = result.data as Record<string, unknown> | null;
      const confirmed = !!data && (data.verified === true || data.is_valid === true || data.valid === true || data.account_exists === true);
      setVerified(confirmed);
      setStatus(confirmed ? "Provider returned a positive bank verification result. Match beneficiary details before authorising any payout." : "Response received, but no explicit verified flag was returned. Do not authorise payout until manually confirmed.");
    } catch {
      setStatus("Verification unavailable. No payout details were saved.");
    } finally { setBusy(false); }
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head"><div><span className="eyebrow">AGENT PAYOUT SAFETY</span><h2>Verify bank / IFSC</h2><p>Verification only. This panel does not save payout details or initiate transfers.</p></div></div>
      <div className="field-grid">
        <label className="field"><span>Account number (optional if using VPA)</span><input type="password" value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} autoComplete="off" maxLength={34}/></label>
        <label className="field"><span>IFSC code</span><input value={ifsc} onChange={e=>setIfsc(e.target.value.toUpperCase())} autoComplete="off" maxLength={11}/></label>
        <label className="field"><span>UPI VPA (alternative)</span><input value={vpa} onChange={e=>setVpa(e.target.value)} autoComplete="off" maxLength={120}/></label>
      </div>
      <button type="button" className="button button-outline" onClick={()=>void verify()} disabled={busy}><ShieldCheck size={15}/>{busy ? " Verifying…" : " Verify bank details"}</button>
      {status && <p className={verified ? "notice notice-success" : "form-footnote"} role="status">{verified && <BadgeCheck size={14}/>} {status}</p>}
    </section>
  );
}
