import { useState } from "react";
import { BadgeCheck, LoaderCircle, ShieldCheck } from "lucide-react";
import { callApiExpress, type ApiExpressService } from "../lib/apiExpressClient";

type VerifyService = Extract<ApiExpressService, "kyc_pan" | "rc_verify">;
type Props = {
  service: VerifyService;
  label: string;
  payloadKey: "pan" | "rc_number";
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
};

function hasPositiveVerification(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.verified === true || record.is_valid === true || record.valid === true) return true;
  const status = typeof record.status === "string" ? record.status.toLowerCase() : "";
  if (["verified", "valid", "success"].includes(status) && record.success !== false) return true;
  for (const key of ["data", "result", "details"]) {
    if (record[key] && hasPositiveVerification(record[key])) return true;
  }
  return false;
}

export default function ApiExpressVerify({ service, label, payloadKey, placeholder, value, onChange }: Props) {
  const [internalValue, setInternalValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [verified, setVerified] = useState(false);
  const inputValue = value ?? internalValue;
  function update(next: string) {
    if (onChange) onChange(next);
    else setInternalValue(next);
    setVerified(false);
    setMessage("");
  }
  async function verify() {
    if (!inputValue.trim()) { setMessage("Enter the document number first."); return; }
    setBusy(true); setMessage(""); setVerified(false);
    try {
      const result = await callApiExpress(service, { [payloadKey]: inputValue.trim().toUpperCase() });
      if (!result.ok) { setMessage(result.error ?? "Verification is temporarily unavailable."); return; }
      if (hasPositiveVerification(result.data)) {
        setVerified(true);
        setMessage("The provider returned a positive verification result. Confirm the returned details before proceeding.");
      } else {
        setMessage("A response was received, but it did not contain a confirmed verified status. Please review manually.");
      }
    } catch {
      setMessage("Verification is unavailable. You can continue with manual review.");
    } finally { setBusy(false); }
  }
  return (
    <div className="api-express-verify">
      <label className="field">
        <span>{label}</span>
        <input
          value={inputValue}
          onChange={(event) => update(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          maxLength={service === "kyc_pan" ? 10 : 24}
          aria-describedby={`${service}-verify-status`}
        />
      </label>
      <button type="button" className="button button-outline" onClick={() => void verify()} disabled={busy || !inputValue.trim()}>
        {busy ? <><LoaderCircle size={15}/> Verifying…</> : <><ShieldCheck size={15}/> Verify {service === "kyc_pan" ? "PAN" : "Vehicle RC"}</>}
      </button>
      {message && (
        <p id={`${service}-verify-status`} className={verified ? "notice notice-success" : "form-footnote"} role="status">
          {verified && <BadgeCheck size={14}/>} {message}
        </p>
      )}
    </div>
  );
}
