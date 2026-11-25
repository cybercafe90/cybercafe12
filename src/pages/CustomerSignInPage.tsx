import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import "./customer-sign-in.css";

type Mode = "signin" | "signup";

export default function CustomerSignInPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedNext = params.get("next") || "/instant-services";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/instant-services";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    if (!supabase) { setConfigured(false); return; }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate(next, { replace: true });
    });
    return () => { active = false; };
  }, [navigate, next]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!supabase) { setConfigured(false); return; }
    setBusy(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (authError) throw authError;
        navigate(next, { replace: true });
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: window.location.origin + next },
        });
        if (authError) throw authError;
        if (data.session) navigate(next, { replace: true });
        else setNotice("Your account request is created. If email confirmation is enabled for this project, open the confirmation link sent to your email, then return here to sign in.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not complete sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError("");
    setNotice("");
    if (!supabase) { setConfigured(false); return; }
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin + "/sign-in",
      });
      if (resetError) throw resetError;
      setNotice("If an account exists for that email, password reset instructions have been sent.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password reset could not be requested.");
    } finally { setBusy(false); }
  }

  return (
    <main className="customer-auth-page">
      <section className="customer-auth-shell">
        <div className="customer-auth-brand">
          <span className="customer-auth-mark"><ShieldCheck size={27}/></span>
          <span><b>BABA'S CYBER CAFE</b><small>SECURE CUSTOMER ACCESS</small></span>
        </div>
        <div className="customer-auth-content">
          <div className="customer-auth-copy">
            <span className="customer-auth-eyebrow">YOUR DIGITAL SERVICE DESK</span>
            <h1>Services made<br/><em>simple and secure.</em></h1>
            <p>Sign in once, then enter your service details and request available checks directly from the Instant Services page.</p>
            <ul>
              <li><ShieldCheck size={17}/> Secure sign-in through Supabase</li>
              <li><ArrowRight size={17}/> Quick access to vehicle RC and other checks</li>
              <li><LockKeyhole size={17}/> Your account is separate from the owner portal</li>
            </ul>
          </div>
          <div className="customer-auth-card">
            <div className="customer-auth-tabs" role="tablist" aria-label="Customer account options">
              <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "is-active" : ""} onClick={() => { setMode("signin"); setError(""); setNotice(""); }}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "is-active" : ""} onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>Create account</button>
            </div>
            <div className="customer-auth-heading">
              <span className="customer-auth-user"><UserRound size={20}/></span>
              <h2>{mode === "signin" ? "Welcome back" : "Create your customer account"}</h2>
              <p>{mode === "signin" ? "Enter your email and password to continue." : "Use an email address you can access and create a strong password."}</p>
            </div>
            {!configured && <div className="customer-auth-message is-error" role="alert">Secure sign-in is not configured. Please contact the service desk.</div>}
            {error && <div className="customer-auth-message is-error" role="alert">{error}</div>}
            {notice && <div className="customer-auth-message is-success" role="status">{notice}</div>}
            <form onSubmit={(event) => void submit(event)} className="customer-auth-form">
              <label><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} placeholder="you@example.com" required/></label>
              <label><span>Password</span><div className="customer-auth-password"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} maxLength={72} placeholder="At least 8 characters" required/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
              <button className="customer-auth-submit" type="submit" disabled={busy || !configured}>{busy ? "Please wait…" : mode === "signin" ? "Sign in securely" : "Create account"} <ArrowRight size={17}/></button>
            </form>
            {mode === "signin" && <button type="button" className="customer-auth-reset" disabled={busy || !configured} onClick={() => void resetPassword()}>Forgot password?</button>}
            <p className="customer-auth-privacy">Never share your password, OTP or payment PIN with anyone. BABA'S CYBER CAFE staff will never ask for them.</p>
          </div>
        </div>
        <div className="customer-auth-bottom"><Link to="/">Back to website</Link><span>Independent digital assistance · Srinagar, J&K</span><a href="https://wa.me/917006865909" target="_blank" rel="noreferrer">Need help?</a></div>
      </section>
    </main>
  );
}
