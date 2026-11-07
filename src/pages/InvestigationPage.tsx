import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, RefreshCw, ShieldCheck, Ban, Globe2 } from "lucide-react";
import { callFunction, isSupabaseConfigured, supabase } from "../lib/supabase";

type SecurityEvent = {
  id: string; occurred_at: string; source: string; event_type: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  status: "new" | "investigating" | "contained" | "resolved" | "false_positive";
  source_ip: string | null; route: string | null; summary: string;
  customer_reference: string | null; details?: { user_agent?: string; country_code?: string; device_hint?: string } | null;
};
type Block = { id: string; target_ip: string; reason: string; performed_at: string; provider_rule_id: string };
type Overview = {
  events: SecurityEvent[]; active_blocks: Block[];
  actor: { role: "owner" | "investigator"; permissions: string[] };
  monitoring: { event_count: number; note: string; telemetry_sources: string[] };
};
type Investigator = { user_id: string; email: string; enabled: boolean; permissions: string[]; granted_at: string; revoked_at: string | null };
const severityClass = (severity: SecurityEvent["severity"]) => `incident-severity severity-${severity}`;
function browserLabel(ua = "") {
  if (/Edg\//.test(ua)) return "Microsoft Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return ua ? "Other / unknown browser" : "Not supplied";
}
export default function InvestigationPage() {
  const [data,setData]=useState<Overview|null>(null),[loading,setLoading]=useState(true);
  const [busyId,setBusyId]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [reasons,setReasons]=useState<Record<string,string>>({}),[investigators,setInvestigators]=useState<Investigator[]>([]);
  const [investigatorEmail,setInvestigatorEmail]=useState(""),[grantBusy,setGrantBusy]=useState(false);
  const [targetIp,setTargetIp]=useState(""),[blockReason,setBlockReason]=useState(""),[ipBusy,setIpBusy]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      if(!supabase) throw new Error("Secure services are not configured.");
      const {data:sessionData}=await supabase.auth.getSession();
      if(!sessionData.session){setData(null);setError("Sign in with an approved owner or investigator account to continue.");return;}
      const overview=await callFunction<Overview>("investigation-overview",{},sessionData.session.access_token);
      setData(overview);
      if(overview.actor.role==="owner"){
        const grants=await callFunction<{investigators:Investigator[]}>("investigation-manage-investigator",{action:"list"},sessionData.session.access_token);
        setInvestigators(grants.investigators);
      }else setInvestigators([]);
    }catch(reason){setData(null);setError(reason instanceof Error?reason.message:"Investigation data could not be loaded.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{const timer=window.setTimeout(()=>{void load();},0);return()=>window.clearTimeout(timer);},[load]);
  async function manageInvestigator(action:"grant"|"revoke",target?:Investigator){
    if(!supabase)return;setGrantBusy(true);setError("");setMessage("");
    try{
      const {data:s}=await supabase.auth.getSession();
      const payload=action==="grant"?{action,email:investigatorEmail,permissions:["view_events","investigate"]}:{action,user_id:target?.user_id};
      await callFunction("investigation-manage-investigator",payload,s.session?.access_token);
      setMessage(action==="grant"?"Verified account granted investigator access.":"Investigator access revoked.");
      setInvestigatorEmail("");await load();
    }catch(reason){setError(reason instanceof Error?reason.message:"Investigator access could not be updated.");}
    finally{setGrantBusy(false);}
  }
  async function updateStatus(event:SecurityEvent,status:SecurityEvent["status"]){
    const reason=(reasons[event.id]??"").trim();
    if(!reason){setError("Enter a short investigation note before changing an incident status.");return;}
    if(!supabase)return;setBusyId(event.id);setError("");setMessage("");
    try{const {data:s}=await supabase.auth.getSession();await callFunction("investigation-update-event",{id:event.id,status,reason},s.session?.access_token);setMessage("Incident status updated and recorded.");setReasons(v=>({...v,[event.id]:""}));await load();}
    catch(reason){setError(reason instanceof Error?reason.message:"Incident update failed.");}finally{setBusyId("");}
  }
  async function controlIp(action:"block"|"unblock",ip:string,reason:string){
    if(!supabase)return;
    if(action==="block"&&!window.confirm(`Block ${ip} at Cloudflare for the entire website? This can affect legitimate visitors using the same public IP.`))return;
    if(action==="unblock"&&!window.confirm(`Remove the Cloudflare block for ${ip}?`))return;
    setIpBusy(true);setError("");setMessage("");
    try{const {data:s}=await supabase.auth.getSession();const result=await callFunction<{blocked?:boolean;unblocked?:boolean}>("investigation-ip-control",{action,ip,reason},s.session?.access_token);setMessage(result.blocked?`Cloudflare confirmed the block for ${ip}.`:`Cloudflare confirmed the unblock for ${ip}.`);setTargetIp("");setBlockReason("");await load();}
    catch(reason){setError(reason instanceof Error?reason.message:"IP restriction operation failed.");}finally{setIpBusy(false);}
  }
  const visits=useMemo(()=>data?.events.filter(e=>e.event_type==="page_view")??[],[data]);
  const uniqueIps=useMemo(()=>new Set(visits.map(e=>e.source_ip).filter(Boolean)).size,[visits]);
  const isOwner=data?.actor.role==="owner";
  return <main className="content-page investigation-page">
    <div className="investigation-heading"><div><span className="eyebrow">RESTRICTED SECURITY WORKSPACE</span><h1>Investigation portal</h1><p>Review recorded visitor activity, suspicious events and owner-managed IP restrictions. Only server-observed request metadata is shown.</p></div><button className="button button-outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?"Refreshing…":"Refresh"}</button></div>
    {!isSupabaseConfigured&&<div className="notice notice-warn">The secure backend is not configured.</div>}
    {error&&<div className="notice notice-error" role="alert">{error} <Link to="/admin/login">Open secure sign-in</Link></div>}
    {message&&<div className="notice notice-success" role="status">{message}</div>}
    {loading?<div className="investigation-empty"><Activity size={22}/> Loading security data…</div>:data?<>
      <section className="investigation-summary">
        <div><span className="eyebrow">RECORDED EVENTS</span><strong>{data.monitoring.event_count}</strong><small>Latest 100 events</small></div>
        <div><span className="eyebrow">UNIQUE VISITOR IPS</span><strong>{uniqueIps}</strong><small>From captured page visits</small></div>
        <div><span className="eyebrow">ACTIVE IP BLOCKS</span><strong>{data.active_blocks.length}</strong><small>Cloudflare rules recorded by this portal</small></div>
      </section>
      <div className="notice notice-warn investigation-warning"><AlertTriangle size={17}/>{data.monitoring.note} Browser and country details depend on headers supplied by the edge network; an IP address does not prove a person's identity.</div>
      {isOwner&&<section className="investigator-management">
        <div className="admin-section-head"><div><span className="eyebrow">OWNER CONTROL</span><h2>Investigator access</h2></div></div>
        <p>Only an existing email-verified account can be granted access. Public registration is disabled. Investigators can review incidents but cannot block IP addresses or manage accounts.</p>
        <form className="investigator-grant-form" onSubmit={e=>{e.preventDefault();void manageInvestigator("grant");}}>
          <input type="email" value={investigatorEmail} onChange={e=>setInvestigatorEmail(e.target.value)} required maxLength={254} placeholder="Existing verified account email"/>
          <button className="button button-dark" disabled={grantBusy}>{grantBusy?"Saving…":"Grant access"}</button>
        </form>
        {investigators.length===0?<p className="investigator-empty-note">No investigator grants exist.</p>:investigators.map(person=><div className="investigator-row" key={person.user_id}><div><strong>{person.email}</strong><small>{person.permissions.join(" · ")} · {person.enabled?"Enabled":"Revoked"}</small></div>{person.enabled&&<button className="button button-outline" disabled={grantBusy} onClick={()=>void manageInvestigator("revoke",person)}>Revoke</button>}</div>)}
      </section>}
      <section className="investigator-management">
        <div className="admin-section-head"><div><span className="eyebrow">VISITOR ACTIVITY</span><h2>IP address register</h2></div><span className="investigation-access"><Globe2 size={15}/> {visits.length} captured visits</span></div>
        <p>Only requests that reach the telemetry endpoint are recorded. Query strings, form contents and customer documents are not collected by this page-view logger.</p>
        {visits.length===0?<div className="investigation-empty">No visitor page-view telemetry has been recorded yet. Refresh after visiting public pages.</div>:visits.map(event=><article className="incident-card" key={event.id}>
          <div className="incident-topline"><span className="incident-severity">VISIT</span><time>{new Date(event.occurred_at).toLocaleString("en-IN")}</time></div>
          <h3>{event.source_ip??"IP unavailable"}</h3>
          <div className="incident-meta"><span><b>Page</b> {event.route??"/"}</span><span><b>Browser</b> {browserLabel(event.details?.user_agent)}</span><span><b>Device</b> {event.details?.device_hint??"Unknown"}</span><span><b>Country</b> {event.details?.country_code??"Not provided"}</span></div>
          {isOwner&&event.source_ip&&<div className="incident-controls"><button className="button button-outline" disabled={ipBusy||data.active_blocks.some(b=>b.target_ip===event.source_ip)} onClick={()=>{setTargetIp(event.source_ip!);document.getElementById("ip-control-form")?.scrollIntoView({behavior:"smooth"});}}>Prepare IP restriction</button></div>}
        </article>)}
      </section>
      {isOwner&&<section className="investigator-management" id="ip-control-form">
        <div className="admin-section-head"><div><span className="eyebrow">CLOUDFLARE FIREWALL</span><h2>Block / unblock IP</h2></div><Ban size={20}/></div>
        <p>Owner-only. Blocks apply at Cloudflare to the whole website. Use only for clearly abusive public IPs; shared networks and VPNs may affect innocent visitors.</p>
        <form className="investigator-grant-form" onSubmit={e=>{e.preventDefault();void controlIp("block",targetIp.trim(),blockReason.trim());}}>
          <input value={targetIp} onChange={e=>setTargetIp(e.target.value)} required placeholder="Public IP address (IPv4 or IPv6)"/>
          <input value={blockReason} onChange={e=>setBlockReason(e.target.value)} required minLength={8} maxLength={300} placeholder="Reason (at least 8 characters)"/>
          <button className="button button-dark" disabled={ipBusy||!targetIp.trim()||blockReason.trim().length<8}>{ipBusy?"Working…":"Block IP"}</button>
        </form>
        {data.active_blocks.length===0?<p className="investigator-empty-note">No active blocks recorded by this portal.</p>:data.active_blocks.map(block=><div className="investigator-row" key={block.id}><div><strong>{block.target_ip}</strong><small>{block.reason} · {new Date(block.performed_at).toLocaleString("en-IN")}</small></div><button className="button button-outline" disabled={ipBusy} onClick={()=>void controlIp("unblock",block.target_ip,"Owner reviewed and approved removal of this IP restriction.")}>Unblock</button></div>)}
        <small className="investigator-empty-note">Cloudflare API integration requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID secrets in Supabase Edge Functions. Until configured, the portal will refuse to claim that an IP has been blocked.</small>
      </section>}
      <section className="investigation-events"><div className="admin-section-head"><div><span className="eyebrow">INCIDENT REGISTER</span><h2>Security events</h2></div><span className="investigation-access"><ShieldCheck size={15}/>{data.actor.role} access</span></div>
        {data.events.filter(e=>e.event_type!=="page_view").length===0?<div className="investigation-empty"><ShieldCheck size={25}/><h2>No non-visit events recorded</h2><p>This is not proof that no attack occurred. It means no such event is currently in the recorded feed.</p></div>:data.events.filter(e=>e.event_type!=="page_view").map(event=><article className="incident-card" key={event.id}>
          <div className="incident-topline"><span className={severityClass(event.severity)}>{event.severity}</span><span className="incident-status">{event.status.replace("_"," ")}</span><time>{new Date(event.occurred_at).toLocaleString("en-IN")}</time></div>
          <h3>{event.summary}</h3><div className="incident-meta"><span><b>Source</b> {event.source}</span><span><b>Event</b> {event.event_type}</span>{event.route&&<span><b>Route</b> {event.route}</span>}{event.source_ip&&<span><b>IP</b> {event.source_ip}</span>}</div>
          {data.actor.permissions.includes("investigate")&&<div className="incident-controls"><input aria-label="Investigation note" value={reasons[event.id]??""} onChange={e=>setReasons(v=>({...v,[event.id]:e.target.value}))} placeholder="Investigation note (required)" maxLength={500}/><select aria-label="New incident status" defaultValue={event.status} id={`status-${event.id}`}><option value="new">New</option><option value="investigating">Investigating</option><option value="contained">Contained</option><option value="resolved">Resolved</option><option value="false_positive">False positive</option></select><button className="button button-dark" disabled={busyId===event.id} onClick={()=>{const s=document.getElementById(`status-${event.id}`) as HTMLSelectElement|null;if(s)void updateStatus(event,s.value as SecurityEvent["status"]);}}>{busyId===event.id?"Saving…":"Record update"}</button></div>}
        </article>)}
      </section>
    </>:<div className="investigation-empty"><ShieldCheck size={25}/><h2>Restricted access</h2><p>Only the verified owner or an investigator explicitly granted access can view this workspace.</p><Link className="button button-dark" to="/admin/login">Go to secure sign-in</Link></div>}
  </main>;
}
