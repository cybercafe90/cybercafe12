import { useState } from "react";
import { ArrowUpRight, BadgeCheck, Banknote, Clock3, Heart, MapPin, MessageCircle, Phone, ShieldCheck, Store, X } from "lucide-react";
import "./SmartQrPage.css";
export default function SmartQrPage(){
 const [notice,setNotice]=useState(""),[saved,setSaved]=useState(false);
 const inform=(message:string)=>setNotice(message);
 return <main className="smartqr-page">
  <div className="smartqr-preview-banner"><span><i/> INTERACTIVE PREVIEW</span><span>Sample shop · No live payments</span></div>
  <div className="smartqr-device">
   <header className="smartqr-topbar"><a className="smartqr-brand" href="/" aria-label="BABA'S CYBER CAFE home"><span className="smartqr-brand-mark"><Store size={20}/></span><span><strong>BABA'S SMART QR</strong><small>POWERED BY BABA'S CYBER CAFE</small></span></a><button className="smartqr-icon-button" onClick={()=>setSaved(!saved)} aria-label="Save shop"><Heart size={19} fill={saved?"currentColor":"none"}/></button></header>
   <section className="smartqr-cover"><div className="smartqr-cover-glow"/><div className="smartqr-shop-logo"><Store size={30}/></div><span className="smartqr-verified"><BadgeCheck size={14}/> SAMPLE BUSINESS</span><h1>Kashmir Corner Market</h1><p>Your local shop. Simple ways to connect with us.</p><div className="smartqr-meta"><span><MapPin size={14}/> Srinagar, Kashmir</span><span><Clock3 size={14}/> Hours vary</span></div></section>
   {notice&&<div className="smartqr-notice" role="status"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss"><X size={16}/></button></div>}
   <section className="smartqr-action-grid smartqr-simple-actions">
    <button className="smartqr-action smartqr-action-pay" onClick={()=>inform("Demo only: the shop's verified payment link will open here. No payment was started.")}><span><Banknote/></span><strong>Pay Shop</strong><small>Secure payment link</small></button>
    <button className="smartqr-action" onClick={()=>inform("Demo only: the shopkeeper's WhatsApp will open here.")}><span><MessageCircle/></span><strong>WhatsApp</strong><small>Message the owner</small></button>
    <button className="smartqr-action" onClick={()=>inform("A verified Google Maps location will open here.")}><span><MapPin/></span><strong>Directions</strong><small>Find the shop</small></button>
    <button className="smartqr-action" onClick={()=>inform("The shop's verified phone number will be connected here.")}><span><Phone/></span><strong>Call shop</strong><small>Speak to the owner</small></button>
   </section>
   <section className="smartqr-section smartqr-about"><span className="smartqr-kicker">ABOUT THIS SHOP</span><h2>Everything important, in one place.</h2><p>No catalogue or complicated browsing. Scan the code to see the shop's details and choose how you want to connect.</p><div className="smartqr-info-row"><MapPin/><div><strong>Shop location</strong><small>Srinagar, Jammu & Kashmir · Sample only</small></div></div><div className="smartqr-info-row"><Clock3/><div><strong>Opening hours</strong><small>Set by the shop owner</small></div></div><div className="smartqr-info-row"><ShieldCheck/><div><strong>Business information</strong><small>Verification status shown on live profiles</small></div></div><div className="smartqr-social-actions"><button onClick={()=>inform("The verified Instagram page will open here.")}>Instagram ↗</button><button onClick={()=>inform("The verified Facebook page will open here.")}>Facebook ↗</button><button onClick={()=>inform("Shop link copied in the live version.")}>Share shop <ArrowUpRight size={13}/></button></div></section>
   <section className="smartqr-trust-strip"><span><ShieldCheck size={17}/> Merchant-supplied shop details</span><span><Heart size={17}/> One scan, simple connections</span></section>
   <footer className="smartqr-footer"><div className="smartqr-powered"><span className="smartqr-brand-mark"><Store size={17}/></span><div><strong>BABA'S SMART QR</strong><small>Digital shop identity</small></div></div><p>Powered by <strong>BABA'S CYBER CAFE</strong> · Srinagar</p><a href="https://babacybercafe.in" target="_blank" rel="noreferrer">Learn about the platform <ArrowUpRight size={13}/></a></footer>
  </div><div className="smartqr-preview-footnote"><ShieldCheck size={16}/><span>Preview only. Payments, live contacts, maps, merchant accounts and scan analytics are not connected.</span></div>
 </main>;
}