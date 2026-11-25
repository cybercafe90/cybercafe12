import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BarChart3, CheckCircle2, ExternalLink, LogOut, MapPin, MessageCircle, Phone, QrCode, ShieldCheck, Store, Wallet } from "lucide-react";
import "../smart-qr.css";
import { SMART_QR_PLANS, SMART_QR_MONTHLY_OPTIONS, type SmartQrPlanCode } from "../config/smartQrPlans";

type ApiError = { error?: string; message?: string };
type Shop = {
  shop_code:string; slug:string; shop_name:string; category?:string; description?:string;
  phone?:string; whatsapp?:string; address_text?:string; opening_hours?:string;
  social_links?:string; payment_url?:string; logo_url?:string; approval_status:string;
  plan_code:string; monthly_option:string; subscription_status:string;
};
type Analytics = {retentionDays:number;stats:{event_type:string;total:number}[]};
type SetupPayment = {status:string;amount_paise:number}|null;
type Subscription = {status:string;monthly_fee_paise:number;cancel_at_period_end:number;current_period_end:string|null}|null;
type SubscriptionCheckoutResult = {razorpay_subscription_id:string;razorpay_payment_id:string;razorpay_signature:string};
type CreateOrder = {orderId:string;amount:number;currency:"INR";keyId:string;shopName:string};
type CheckoutResult = {razorpay_order_id:string;razorpay_payment_id:string;razorpay_signature:string};
type RazorpayInstance = {open:()=>void;on?:(event:string,callback:(event:{error?:{description?:string}})=>void)=>void};
type SmartQrRazorpayWindow = Omit<Window,"Razorpay"> & {Razorpay?:new(options:Record<string,unknown>)=>RazorpayInstance};
function razorpayConstructor(){return (window as unknown as SmartQrRazorpayWindow).Razorpay;}
function loadRazorpay():Promise<void>{
  if(razorpayConstructor())return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector<HTMLScriptElement>('script[data-smartqr-razorpay="true"]');
    if(existing){existing.addEventListener("load",()=>resolve(),{once:true});existing.addEventListener("error",()=>reject(new Error("Razorpay checkout could not load.")),{once:true});return;}
    const script=document.createElement("script");script.src="https://checkout.razorpay.com/v1/checkout.js";script.async=true;script.dataset.smartqrRazorpay="true";
    script.onload=()=>razorpayConstructor()?resolve():reject(new Error("Razorpay checkout is unavailable."));
    script.onerror=()=>reject(new Error("Razorpay checkout could not load."));
    document.head.appendChild(script);
  });
}
const API="/api/smart-qr";
const plans = [
  {code:"starter" as const,name:SMART_QR_PLANS.starter.name,setup:SMART_QR_PLANS.starter.setupFeeInr,monthly:SMART_QR_PLANS.starter.monthlyFeeInr,qr:SMART_QR_PLANS.starter.qrLimit,locations:SMART_QR_PLANS.starter.locationLimit,retention:SMART_QR_PLANS.starter.analyticsRetentionDays,description:"A simple permanent shop QR."},
  {code:"growth" as const,name:SMART_QR_PLANS.growth.name,setup:SMART_QR_PLANS.growth.setupFeeInr,monthly:SMART_QR_PLANS.growth.monthlyFeeInr,qr:SMART_QR_PLANS.growth.qrLimit,locations:SMART_QR_PLANS.growth.locationLimit,retention:SMART_QR_PLANS.growth.analyticsRetentionDays,description:"Detailed engagement insights."},
  {code:"vip" as const,name:SMART_QR_PLANS.vip.name,setup:SMART_QR_PLANS.vip.setupFeeInr,monthly:SMART_QR_PLANS.vip.monthlyFeeInr,qr:SMART_QR_PLANS.vip.qrLimit,locations:SMART_QR_PLANS.vip.locationLimit,retention:SMART_QR_PLANS.vip.analyticsRetentionDays,description:"Multiple QR codes and locations."},
] as const;
async function api<T>(path:string, init:RequestInit={}):Promise<T>{
  const response=await fetch(API+"/"+path,{...init,credentials:"same-origin",headers:{"content-type":"application/json",...(init.headers||{})}});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error((result as ApiError).error||(result as ApiError).message||"The request could not be completed.");
  return result as T;
}
function safeUrl(value:string|undefined){
  if(!value) return "";
  try { const u=new URL(value); return u.protocol==="https:"?u.toString():""; } catch { return ""; }
}
function jsonValue(value:string|undefined):Record<string,string>{
  try { const parsed=JSON.parse(value||"{}"); return parsed&&typeof parsed==="object"?parsed:{}; } catch { return {}; }
}
function Shell({children,title="BABA'S SMART QR"}:{children:ReactNode;title?:string}){
  return <main className="smartqr-shell"><header className="smartqr-header"><Link to="/smart-qr" className="smartqr-brand"><span className="smartqr-brand-mark"><QrCode size={22}/></span><span><b>{title}</b><small>BY BABA'S CYBER CAFE</small></span></Link><Link className="smartqr-back" to="/"><ArrowLeft size={15}/> Main website</Link></header>{children}<footer className="smartqr-footer">Secure shop discovery · No customer app required · Srinagar, J&amp;K</footer></main>;
}
function Notice({children,error=false}:{children:string;error?:boolean}){
  return <div className={error?"smartqr-notice is-error":"smartqr-notice"} role="status">{error?<ShieldCheck size={17}/>:<CheckCircle2 size={17}/>}<span>{children}</span></div>;
}
function Register(){
  const [form,setForm]=useState({ownerName:"",email:"",shopName:"",category:"Retail",description:"",phone:"",whatsapp:"",address:"",plan:"starter",monthlyOption:"none",monthlyConsent:false});
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const plan=plans.find(p=>p.code===form.plan)!;
  const update=(key:string,value:string)=>setForm(current=>({...current,[key]:value,...(key==="plan"?{monthlyOption:"none",monthlyConsent:false}:key==="monthlyOption"&&value==="none"?{monthlyConsent:false}:{})}));
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");try{
    const result=await api<{message:string;shopCode:string}>("register",{method:"POST",body:JSON.stringify(form)});
    setMessage(result.message+" Your Shop ID is "+result.shopCode+".");
  }catch(reason){setError(reason instanceof Error?reason.message:"Registration failed.");}finally{setBusy(false);}}
  return <Shell><section className="smartqr-hero"><span className="smartqr-eyebrow">YOUR SHOP, ONE SCAN AWAY</span><h1>Make it easy for customers to find you.</h1><p>Create a permanent digital shop page with a QR destination customers can open instantly in their phone browser.</p><div className="smartqr-trust"><span><ShieldCheck size={15}/> Secure merchant access</span><span><Store size={15}/> No customer app</span><span><BarChart3 size={15}/> Plan-based analytics</span></div></section>
    <section className="smartqr-content-grid"><div className="smartqr-form-card"><div className="smartqr-card-heading"><span className="smartqr-step">01</span><div><h2>Merchant application</h2><p>Enter your shop details. Your application starts as pending.</p></div></div>
      {error&&<Notice error>{error}</Notice>}{message&&<Notice>{message}</Notice>}
      <form onSubmit={submit} className="smartqr-form">
        <label>Owner's full name<input required minLength={2} maxLength={120} value={form.ownerName} onChange={e=>update("ownerName",e.target.value)} autoComplete="name"/></label>
        <label>Email address<input required type="email" maxLength={254} value={form.email} onChange={e=>update("email",e.target.value)} autoComplete="email"/></label>
        <label>Shop name<input required minLength={2} maxLength={140} value={form.shopName} onChange={e=>update("shopName",e.target.value)}/></label>
        <label>Business category<select value={form.category} onChange={e=>update("category",e.target.value)}>{["Retail","Grocery","Restaurant / Cafe","Salon","Clothing","Electronics","Pharmacy","Services","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Short description<textarea maxLength={600} rows={3} value={form.description} onChange={e=>update("description",e.target.value)} placeholder="What should customers know about your shop?"/></label>
        <div className="smartqr-two-col"><label>Phone number<input type="tel" maxLength={24} value={form.phone} onChange={e=>update("phone",e.target.value)}/></label><label>WhatsApp number<input type="tel" maxLength={24} value={form.whatsapp} onChange={e=>update("whatsapp",e.target.value)}/></label></div>
        <label>Shop address<input maxLength={240} value={form.address} onChange={e=>update("address",e.target.value)} placeholder="Area, city"/></label>
        <div className="smartqr-divider"/><div className="smartqr-card-heading"><span className="smartqr-step">02</span><div><h2>Choose your plan</h2><p>Setup fee and optional recurring subscription are separate.</p></div></div>
        <div className="smartqr-plan-picker">{plans.map(p=><button type="button" key={p.code} className={form.plan===p.code?"smartqr-plan is-selected":"smartqr-plan"} onClick={()=>update("plan",p.code)}><span>{p.name}</span><b>₹{p.setup.toLocaleString("en-IN")}</b><small>one-time setup</small><small>{p.qr} QR · {p.locations} location · {p.retention} days analytics</small><em>{p.description}</em></button>)}</div>
        <label>Monthly subscription<select value={form.monthlyOption} onChange={e=>update("monthlyOption",e.target.value)}>{SMART_QR_MONTHLY_OPTIONS[form.plan as SmartQrPlanCode].map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        {form.monthlyOption!=="none"&&<label className="smartqr-consent"><input type="checkbox" checked={form.monthlyConsent} onChange={e=>setForm(current=>({...current,monthlyConsent:e.target.checked}))}/><span>I explicitly agree to the selected recurring monthly subscription. Billing will begin only after a separate Razorpay authorization, and I can cancel according to the subscription terms.</span></label>}
        <div className="smartqr-price-summary"><div><span>One-time setup fee</span><b>₹{plan.setup.toLocaleString("en-IN")}</b></div><div><span>Monthly recurring fee</span><b>₹{form.monthlyOption==="growth"?99:form.monthlyOption==="vip"?199:0}</b></div><small>Recurring billing is optional. It will never start without your explicit consent and a separate payment authorization. No payment is collected by this application form.</small></div>
        <button className="smartqr-primary" disabled={busy||(form.monthlyOption!=="none"&&!form.monthlyConsent)}>{busy?"Submitting…":"Submit merchant application"} <ArrowRight size={17}/></button>
        <p className="smartqr-legal">By submitting, you confirm that you are authorised to represent this shop. Account activation and public listing require email setup, payment verification and owner approval.</p>
      </form></div>
      <aside className="smartqr-side-card"><div className="smartqr-side-icon"><QrCode size={26}/></div><h3>Simple for shop owners.</h3><p>One QR destination for customers. Manage your shop details, view scans and keep your permanent shop link in one dashboard.</p><ul><li>Starter: 1 QR · 1 location · 7-day analytics</li><li>Growth: 1 QR · 1 location · 365-day analytics</li><li>VIP: up to 3 QR codes · 3 locations · 730-day analytics</li></ul><Link to="/smart-qr/login">Already registered? Sign in <ArrowRight size={15}/></Link></aside></section></Shell>;
}
function AuthPage({mode}:{mode:"login"|"setup"|"reset"|"forgot"}){
  const [search]=useSearchParams(); const navigate=useNavigate();
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const token=search.get("token")||"";
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");try{
    if(mode==="login"){const result=await api<{user:{role:string}}>("login",{method:"POST",body:JSON.stringify({email,password})});navigate(result.user.role==="platform_admin"?"/smart-qr/admin":"/smart-qr/dashboard");return;}
    if(mode==="forgot"){const r=await api<{message:string}>("forgot-password",{method:"POST",body:JSON.stringify({email})});setMessage(r.message);}
    if(mode==="setup"){const r=await api<{message:string;user:{role:string}}>("setup",{method:"POST",body:JSON.stringify({token,password})});setMessage(r.message);navigate(r.user.role==="platform_admin"?"/smart-qr/admin":"/smart-qr/dashboard");return;}
    if(mode==="reset"){const r=await api<{message:string}>("reset-password",{method:"POST",body:JSON.stringify({token,password})});setMessage(r.message);navigate("/smart-qr/login");return;}
  }catch(reason){setError(reason instanceof Error?reason.message:"Request failed.");}finally{setBusy(false);}}
  const title=mode==="login"?"Merchant sign in":mode==="setup"?"Set your password":mode==="reset"?"Reset your password":"Recover account access";
  return <Shell><section className="smartqr-auth-wrap"><div className="smartqr-form-card"><span className="smartqr-eyebrow">SECURE ACCOUNT ACCESS</span><h1>{title}</h1><p>{mode==="login"?"Sign in to manage your shop and view its performance.":mode==="setup"?"Create a strong password using your one-time email link.":mode==="reset"?"Choose a new password using your one-time reset link.":"Enter your registered email to receive a password reset link."}</p>{error&&<Notice error>{error}</Notice>}{message&&<Notice>{message}</Notice>}
    <form className="smartqr-form" onSubmit={submit}>{(mode==="login"||mode==="forgot")&&<label>Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>}{(mode==="login"||mode==="setup"||mode==="reset")&&<label>{mode==="login"?"Password":"New password"}<input required type="password" minLength={mode==="login"?1:12} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="login"?"current-password":"new-password"}/></label>}{mode!=="login"&&mode!=="forgot"&&<small className="smartqr-help">At least 12 characters, including uppercase, lowercase and a number.</small>}<button className="smartqr-primary" disabled={busy||((mode==="setup"||mode==="reset")&&!token)}>{busy?"Please wait…":mode==="login"?"Sign in":mode==="forgot"?"Send reset link":mode==="setup"?"Create password":"Update password"} <ArrowRight size={17}/></button></form>
    {mode==="login"?<div className="smartqr-auth-links"><Link to="/smart-qr/forgot-password">Forgot password?</Link><Link to="/smart-qr">New merchant? Apply here</Link></div>:<Link className="smartqr-text-link" to="/smart-qr/login">Back to sign in</Link>}</div></section></Shell>;
}
function Dashboard(){
  const navigate=useNavigate(); const [shop,setShop]=useState<Shop|null>(null); const [analytics,setAnalytics]=useState<Analytics|null>(null); const [setupPayment,setSetupPayment]=useState<SetupPayment>(null); const [subscription,setSubscription]=useState<Subscription>(null); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [busy,setBusy]=useState(false);
  const [draft,setDraft]=useState({shop_name:"",category:"",description:"",phone:"",whatsapp:"",address_text:"",opening_hours:"",facebook_url:"",instagram_url:"",website_url:"",payment_url:"",logo_url:""});
  useEffect(()=>{void Promise.all([api<{shop:Shop;setupPayment:SetupPayment;subscription:Subscription}>("shop"),api<Analytics>("analytics")]).then(([s,a])=>{const social=jsonValue(s.shop.social_links);setShop(s.shop);setSetupPayment(s.setupPayment||null);setSubscription(s.subscription||null);setDraft({shop_name:s.shop.shop_name,category:s.shop.category||"",description:s.shop.description||"",phone:s.shop.phone||"",whatsapp:s.shop.whatsapp||"",address_text:s.shop.address_text||"",opening_hours:s.shop.opening_hours||"",facebook_url:social.facebook||"",instagram_url:social.instagram||"",website_url:social.website||"",payment_url:s.shop.payment_url||"",logo_url:s.shop.logo_url||""});setAnalytics(a);}).catch(e=>{setError(e.message);if(e.message==="Authentication required.")navigate("/smart-qr/login");});},[navigate]);
  async function save(e:FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");try{await api("shop",{method:"PATCH",body:JSON.stringify({shop_name:draft.shop_name,category:draft.category,description:draft.description,phone:draft.phone,whatsapp:draft.whatsapp,address_text:draft.address_text,opening_hours:draft.opening_hours,social_links:{facebook:draft.facebook_url,instagram:draft.instagram_url,website:draft.website_url},payment_url:draft.payment_url,logo_url:draft.logo_url})});setNotice("Shop profile saved.");}catch(e){setError(e instanceof Error?e.message:"Could not save.");}finally{setBusy(false);}}
  async function logout(){await api("logout",{method:"POST",body:"{}"});navigate("/smart-qr/login");}
  async function authorizeMonthly(){
    setBusy(true);setError("");setNotice("");
    try{
      const data=await api<{subscriptionId:string;keyId:string;shopName:string}>("subscriptions/create",{method:"POST",body:"{}"});
      await loadRazorpay();
      const Razorpay=razorpayConstructor();if(!Razorpay)throw new Error("Razorpay checkout is unavailable.");
      const checkout=new Razorpay({key:data.keyId,subscription_id:data.subscriptionId,name:"BABA'S SMART QR",description:"Optional monthly subscription",theme:{color:"#b58a3b"},handler:async(rawResult:unknown)=>{
        try{
          const result=rawResult as SubscriptionCheckoutResult;
          const verified=await api<{authorized:boolean;status:string;message:string}>("subscriptions/verify",{method:"POST",body:JSON.stringify({razorpaySubscriptionId:result.razorpay_subscription_id,razorpayPaymentId:result.razorpay_payment_id,razorpaySignature:result.razorpay_signature})});
          setSubscription(current=>current?{...current,status:verified.status}:{status:verified.status,monthly_fee_paise:shop?.monthly_option==="vip"?19900:9900,cancel_at_period_end:0,current_period_end:null});
          setNotice(verified.message);
        }catch(reason){setError(reason instanceof Error?reason.message:"Subscription authorization is awaiting verification.");}
      }});
      checkout.on?.("payment.failed",event=>setError(event.error?.description||"Monthly authorization failed. You can retry."));
      checkout.open();
    }catch(reason){setError(reason instanceof Error?reason.message:"Monthly subscription could not be started.");}
    finally{setBusy(false);}
  }
  async function cancelMonthly(){
    setBusy(true);setError("");setNotice("");
    try{const result=await api<{message:string}>("subscriptions/cancel",{method:"POST",body:"{}"});setSubscription(current=>current?{...current,cancel_at_period_end:1}:current);setNotice(result.message);}
    catch(reason){setError(reason instanceof Error?reason.message:"Subscription cancellation could not be requested.");}
    finally{setBusy(false);}
  }
  async function paySetup(){
    setBusy(true);setError("");setNotice("");
    try{
      const order=await api<CreateOrder>("payments/create-order",{method:"POST",body:"{}"});
      await loadRazorpay();
      const Razorpay=razorpayConstructor();if(!Razorpay)throw new Error("Razorpay checkout is unavailable.");
      const checkout=new Razorpay({key:order.keyId,amount:order.amount,currency:order.currency,name:"BABA'S SMART QR",description:"One-time merchant setup fee",order_id:order.orderId,theme:{color:"#b58a3b"},handler:async (rawResult:unknown)=>{const result=rawResult as CheckoutResult;
        try{const verified=await api<{paid:boolean;message:string}>("payments/verify",{method:"POST",body:JSON.stringify({razorpayOrderId:result.razorpay_order_id,razorpayPaymentId:result.razorpay_payment_id,razorpaySignature:result.razorpay_signature})});setNotice(verified.message);if(verified.paid)setSetupPayment({status:"captured",amount_paise:order.amount});}
        catch(reason){setError(reason instanceof Error?reason.message:"Payment verification is pending. Do not pay again; contact support if this message remains.");}
      }});
      checkout.on?.("payment.failed",event=>setError(event.error?.description||"Payment failed. You can retry from this dashboard."));
      checkout.open();
    }catch(reason){setError(reason instanceof Error?reason.message:"Payment could not be started.");}
    finally{setBusy(false);}
  }
  const stats=useMemo(()=>Object.fromEntries((analytics?.stats||[]).map(x=>[x.event_type,x.total])),[analytics]);
  if(error&&!shop)return <Shell><div className="smartqr-auth-wrap"><Notice error>{error}</Notice><Link to="/smart-qr/login">Return to sign in</Link></div></Shell>;
  return <Shell><section className="smartqr-dashboard-head"><div><span className="smartqr-eyebrow">MERCHANT WORKSPACE</span><h1>{shop?.shop_name||"Your shop dashboard"}</h1><p>Shop ID: <b>{shop?.shop_code||"Loading…"}</b></p></div><button className="smartqr-outline" onClick={logout}><LogOut size={16}/> Sign out</button></section>
    {notice&&<Notice>{notice}</Notice>}{error&&<Notice error>{error}</Notice>}
    {shop&&<div className="smartqr-status-row"><span className={"smartqr-status status-"+shop.approval_status}>{shop.approval_status}</span><span>Plan: <b>{shop.plan_code.toUpperCase()}</b></span><span>Monthly: <b>{shop.monthly_option==="none"?"None":shop.monthly_option==="growth"?"₹99":"₹199"}</b></span><span>Subscription: <b>{shop.subscription_status}</b></span></div>}
    <div className="smartqr-metrics">{[{label:"Scans",value:stats.scan||0},{label:"WhatsApp clicks",value:stats.whatsapp||0},{label:"Calls",value:stats.call||0},{label:"Directions",value:stats.directions||0}].map(x=><div key={x.label}><small>{x.label}</small><b>{x.value}</b></div>)}</div>
    <section className="smartqr-dashboard-grid"><div className="smartqr-form-card"><div className="smartqr-card-heading"><div><h2>Shop profile</h2><p>These details appear on your public shop page after approval.</p></div></div><form className="smartqr-form" onSubmit={save}><label>Shop name<input value={draft.shop_name} onChange={e=>setDraft({...draft,shop_name:e.target.value})} required maxLength={140}/></label><label>Category<input value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})} maxLength={80}/></label><label>Description<textarea rows={3} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} maxLength={600}/></label><div className="smartqr-two-col"><label>Phone<input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label><label>WhatsApp<input value={draft.whatsapp} onChange={e=>setDraft({...draft,whatsapp:e.target.value})}/></label></div><label>Address<input value={draft.address_text} onChange={e=>setDraft({...draft,address_text:e.target.value})}/></label><label>Opening hours<input value={draft.opening_hours} onChange={e=>setDraft({...draft,opening_hours:e.target.value})} maxLength={300} placeholder="Mon–Sat, 10 AM–8 PM"/></label><label>Payment link (HTTPS)<input type="url" value={draft.payment_url} onChange={e=>setDraft({...draft,payment_url:e.target.value})} placeholder="https://…"/></label><label>Shop logo image URL (HTTPS)<input type="url" value={draft.logo_url} onChange={e=>setDraft({...draft,logo_url:e.target.value})} placeholder="https://…"/></label><div className="smartqr-two-col"><label>Facebook URL<input type="url" value={draft.facebook_url} onChange={e=>setDraft({...draft,facebook_url:e.target.value})}/></label><label>Instagram URL<input type="url" value={draft.instagram_url} onChange={e=>setDraft({...draft,instagram_url:e.target.value})}/></label></div><label>Website URL<input type="url" value={draft.website_url} onChange={e=>setDraft({...draft,website_url:e.target.value})}/></label><button className="smartqr-primary" disabled={busy}>{busy?"Saving…":"Save shop details"}</button></form></div>
      <aside className="smartqr-side-card"><h3>Permanent shop destination</h3>{shop?.slug&&<><code>babacybercafe.in/s/{shop.slug}</code><p>Your page becomes publicly visible only after payment verification and owner approval.</p><a className="smartqr-text-link" href={"/s/"+shop.slug} target="_blank" rel="noreferrer">Preview public destination <ExternalLink size={14}/></a>{shop.approval_status==="approved"?<div className="smartqr-qr-preview"><img src={API+"/qr/"+encodeURIComponent(shop.slug)} alt={"QR code for "+shop.shop_name} loading="lazy"/><a className="smartqr-text-link" href={API+"/qr/"+encodeURIComponent(shop.slug)} download={"BABA-SMART-QR-"+shop.shop_code+".png"}><QrCode size={15}/> Download QR image</a><small>Print at actual size. The QR opens your permanent shop page.</small></div>:<p className="smartqr-help">Your QR image becomes available after owner approval.</p>}</>}<div className="smartqr-divider"/><h3>Plan limits</h3><p>{shop?.plan_code==="vip"?"Up to 3 QR codes and 3 locations.":shop?.plan_code==="growth"?"1 QR code and 1 location.":"1 QR code and 1 location."}</p><small>Analytics retention: {analytics?.retentionDays??"—"} days</small><div className="smartqr-divider"/><div className="smartqr-divider"/><h3>Setup payment</h3>{setupPayment?.status==="captured"?<Notice>Setup fee paid and verified. Your application is ready for owner review.</Notice>:<><p>One-time setup fee: <b>₹{shop?.plan_code==="vip"?"1,999":shop?.plan_code==="growth"?"999":"499"}</b>. Payment is verified by the server before the owner can approve your shop.</p><button type="button" className="smartqr-primary" onClick={paySetup} disabled={busy}>{busy?"Preparing secure checkout…":"Pay setup fee with Razorpay"} <ArrowRight size={16}/></button></>}{shop?.monthly_option!=="none"&&<><div className="smartqr-divider"/><h3>Optional monthly subscription</h3><p>₹{shop?.monthly_option==="vip"?"199":"99"} per month. Recurring billing requires your separate Razorpay mandate authorization.</p>{subscription&&<p className="smartqr-help">Status: <b>{subscription.status}</b>{subscription.cancel_at_period_end===1?" · Cancellation scheduled":""}{subscription.current_period_end?" · Current period ends "+new Date(subscription.current_period_end).toLocaleDateString("en-IN"):""}</p>}{setupPayment?.status!=="captured"?<p className="smartqr-help">Pay the one-time setup fee before authorizing monthly billing.</p>:subscription&&["active","authenticated","past_due"].includes(subscription.status)?<button type="button" className="smartqr-outline" onClick={cancelMonthly} disabled={busy}>Cancel monthly renewal</button>:<button type="button" className="smartqr-primary" onClick={authorizeMonthly} disabled={busy}>{busy?"Preparing…":"Authorize ₹"+(shop?.monthly_option==="vip"?"199":"99")+"/month"} <ArrowRight size={16}/></button>}</>}</aside></section></Shell>;
}
function Admin(){
  const [shops,setShops]=useState<Record<string,unknown>[]>([]);
  const [events,setEvents]=useState<Record<string,unknown>[]>([]);
  const [search,setSearch]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busyCode,setBusyCode]=useState("");
  const load=()=>void Promise.all([
    api<{shops:Record<string,unknown>[]}>("admin/shops"),
    api<{events:Record<string,unknown>[]}>("admin/audit")
  ]).then(([s,a])=>{setShops(s.shops);setEvents(a.events);}).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  async function change(code:string,status:string){
    setError("");setNotice("");setBusyCode(code);
    try{await api("admin/shops/"+encodeURIComponent(code)+"/status",{method:"PATCH",body:JSON.stringify({status})});setNotice("Merchant status updated.");load();}
    catch(e){setError(e instanceof Error?e.message:"Update failed.");}
    finally{setBusyCode("");}
  }
  async function logout(){await api("logout",{method:"POST",body:"{}"});window.location.assign("/smart-qr/login");}
  const filtered=shops.filter(s=>[s.shop_name,s.shop_code,s.email,s.full_name,s.approval_status].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase())));
  const count=(status:string)=>shops.filter(s=>s.approval_status===status).length;
  return <Shell><section className="smartqr-dashboard-head"><div><span className="smartqr-eyebrow">PLATFORM OWNER</span><h1>Merchant administration</h1><p>Review applications, payments and shop status.</p></div><button className="smartqr-outline" onClick={logout}><LogOut size={16}/> Sign out</button></section>
    {error&&<Notice error>{error}</Notice>}{notice&&<Notice>{notice}</Notice>}
    <div className="smartqr-admin-stats"><div><small>Total merchants</small><b>{shops.length}</b></div><div><small>Pending review</small><b>{count("pending")}</b></div><div><small>Approved</small><b>{count("approved")}</b></div><div><small>Suspended</small><b>{count("suspended")}</b></div></div>
    <div className="smartqr-admin-toolbar"><input aria-label="Search merchants" placeholder="Search shop, Shop ID, owner or status…" value={search} onChange={e=>setSearch(e.target.value)}/><span>{filtered.length} merchants</span></div>
    <div className="smartqr-table-wrap"><table><thead><tr><th>Shop</th><th>Merchant</th><th>Plan</th><th>Setup payment</th><th>Status</th><th>Review</th></tr></thead><tbody>{filtered.map((s,i)=>{
      const status=String(s.approval_status||"pending"),code=String(s.shop_code||"");
      return <tr key={code||i}><td><b>{String(s.shop_name)}</b><small>{code}</small></td><td>{String(s.full_name)}<small>{String(s.email)}</small></td><td>{String(s.plan_code)} / {String(s.monthly_option)}</td><td>{String(s.setup_payment_status||"not paid")}</td><td><span className={"smartqr-status status-"+status}>{status}</span></td><td>
        {status==="pending"&&<><button className="smartqr-small-button" disabled={busyCode===code} onClick={()=>change(code,"approved")}>Approve</button> <button className="smartqr-small-button" disabled={busyCode===code} onClick={()=>change(code,"rejected")}>Reject</button></>}
        {status==="approved"&&<button className="smartqr-small-button" disabled={busyCode===code} onClick={()=>change(code,"suspended")}>Suspend</button>}
        {status==="suspended"&&<button className="smartqr-small-button" disabled={busyCode===code} onClick={()=>change(code,"approved")}>Reactivate</button>}
        {status==="rejected"&&<button className="smartqr-small-button" disabled={busyCode===code} onClick={()=>change(code,"pending")}>Reopen</button>}
      </td></tr>;
    })}</tbody></table>{filtered.length===0&&<p className="smartqr-empty">No matching merchant applications found.</p>}</div>
    <section className="smartqr-audit-card"><div className="smartqr-card-heading"><div><h2>Recent owner activity</h2><p>Security and merchant-management actions, newest first.</p></div></div>
      {events.length===0?<p className="smartqr-empty">No audit activity has been recorded yet.</p>:<div className="smartqr-audit-list">{events.map((event,i)=><div className="smartqr-audit-item" key={String(event.created_at)+i}><span className="smartqr-audit-dot"/><div><b>{String(event.action||"Activity")}</b><small>{String(event.actor_email||"System")}{event.shop_code?" · "+String(event.shop_code):""}</small></div><time>{event.created_at?new Date(String(event.created_at)+"Z").toLocaleString("en-IN"):"—"}</time></div>)}</div>}
    </section>
  </Shell>;
}
function PublicShop(){
  const {slug=""}=useParams();const [shop,setShop]=useState<Record<string,unknown>|null>(null);const [error,setError]=useState("");
  useEffect(()=>{void api<{shop:Record<string,unknown>}>("public/"+encodeURIComponent(slug)).then(x=>setShop(x.shop)).catch(e=>setError(e.message));},[slug]);
  useEffect(()=>{if(shop)void api("event/"+encodeURIComponent(slug),{method:"POST",body:JSON.stringify({type:"scan"})}).catch(()=>{});},[shop,slug]);
  const links=jsonValue(typeof shop?.social_links==="string"?shop.social_links:undefined);
  const address=String(shop?.address_text||"");
  const hours=String(shop?.opening_hours||"");
  const phone=String(shop?.phone||"");
  const wa=String(shop?.whatsapp||"").replace(/\D/g,"");
  const pay=safeUrl(typeof shop?.payment_url==="string"?shop.payment_url:undefined);
  const track=(type:string)=>void api("event/"+encodeURIComponent(slug),{method:"POST",body:JSON.stringify({type})}).catch(()=>{});
  if(error)return <Shell><section className="smartqr-auth-wrap"><Notice error>{error}</Notice><Link to="/">Visit BABA'S CYBER CAFE</Link></section></Shell>;
  if(!shop)return <Shell><div className="smartqr-auth-wrap">Loading shop…</div></Shell>;
  return <Shell title="SHOP PROFILE"><section className="smartqr-public-card">{typeof shop.logo_url==="string"&&shop.logo_url&&<img className="smartqr-shop-logo" src={safeUrl(shop.logo_url)} alt="Shop logo"/>}<span className="smartqr-eyebrow">VERIFIED SHOP LISTING</span><h1>{String(shop.shop_name)}</h1>{typeof shop.category==="string"&&shop.category&&<span className="smartqr-category">{shop.category}</span>}<p>{String(shop.description||"Welcome. Contact this shop for more information.")}</p><div className="smartqr-public-actions">{phone&&<a href={"tel:"+phone.replace(/[^+\d]/g,"")} onClick={()=>track("call")}><Phone size={18}/> Call shop</a>}{wa&&<a href={"https://wa.me/"+wa} target="_blank" rel="noreferrer" onClick={()=>track("whatsapp")}><MessageCircle size={18}/> WhatsApp</a>}{address&&<a href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(address)} target="_blank" rel="noreferrer" onClick={()=>track("directions")}><MapPin size={18}/> Directions</a>}{pay&&<a href={pay} target="_blank" rel="noreferrer" onClick={()=>track("payment_tap")}><Wallet size={18}/> Payment</a>}</div>{address&&<p className="smartqr-public-address"><MapPin size={16}/>{address}</p>}{hours&&<p className="smartqr-public-address"><span>Opening hours:</span> {hours}</p>}{Object.entries(links).filter(([,v])=>safeUrl(v)).map(([k,v])=><a className="smartqr-social-link" key={k} href={safeUrl(v)} target="_blank" rel="noreferrer" onClick={()=>track("share")}>{k} <ExternalLink size={14}/></a>)}<small>Shop ID: {String(shop.shop_code)}</small></section></Shell>;
}
export default function SmartQrPortal(){
  const location=useLocation();const path=location.pathname;
  if(path.startsWith("/s/"))return <PublicShop/>;
  if(path==="/smart-qr/login")return <AuthPage mode="login"/>;
  if(path==="/smart-qr/setup"||path==="/smart-qr/owner-setup")return <AuthPage mode="setup"/>;
  if(path==="/smart-qr/reset-password")return <AuthPage mode="reset"/>;
  if(path==="/smart-qr/forgot-password")return <AuthPage mode="forgot"/>;
  if(path==="/smart-qr/dashboard")return <Dashboard/>;
  if(path==="/smart-qr/admin")return <Admin/>;
  return <Register/>;
}
