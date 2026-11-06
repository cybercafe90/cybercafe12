import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { callFunction, isSupabaseConfigured, supabase } from "../lib/supabase";

type Grievance = { id: string; reference_id: string; full_name: string; mobile: string; email: string; subject: string; description: string; status: string; created_at: string; updated_at: string };
type Draft = { status: string; publicRemark: string; internalRemark: string };
const statuses = ["Received", "Under Review", "More Information Required", "Resolved", "Closed"];

export default function AdminGrievancePage() {
  const [items,setItems]=useState<Grievance[]>([]);
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const [search,setSearch]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [authorized,setAuthorized]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      if(!supabase)throw new Error("Secure backend is not configured.");
      const {data}=await supabase.auth.getSession();
      if(!data.session){setAuthorized(false);throw new Error("Sign in with the owner account to manage grievances.");}
      const result=await callFunction<{grievances:Grievance[];total:number}>("admin-grievances",{action:"list",page:0,search},data.session.access_token);
      setAuthorized(true);setItems(result.grievances);
      setDrafts(current=>{const next={...current};for(const g of result.grievances)if(!next[g.id])next[g.id]={status:g.status,publicRemark:"",internalRemark:""};return next;});
    }catch(reason){setError(reason instanceof Error?reason.message:"Grievances could not be loaded.");}
    finally{setLoading(false);}
  },[search]);

  useEffect(()=>{void load();},[load]);

  async function save(item:Grievance){
    if(!supabase)return;const draft=drafts[item.id];if(!draft)return;
    setBusy(true);setError("");setNotice("");
    try{
      const {data}=await supabase.auth.getSession();
      const result=await callFunction<{updated:boolean;emailSent:boolean}>("admin-grievances",{action:"update",id:item.id,status:draft.status,publicRemark:draft.publicRemark,internalRemark:draft.internalRemark},data.session?.access_token);
      setNotice(result.emailSent?"Grievance updated and customer email sent.":"Grievance updated. Customer email delivery was not confirmed; check provider configuration.");
      setDrafts(current=>({...current,[item.id]:{...current[item.id],publicRemark:"",internalRemark:""}}));
      await load();
    }catch(reason){setError(reason instanceof Error?reason.message:"Grievance update failed.");}
    finally{setBusy(false);}
  }

  return (
    <main className="content-page grievance-admin-page">
      <div className="investigation-heading"><div><span className="eyebrow">OWNER-ONLY WORKSPACE</span><h1>Grievance management</h1><p>Review complaints, update status, and keep public and internal remarks separate.</p></div><button className="button button-outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
      {!isSupabaseConfigured&&<div className="notice notice-warn">Secure backend configuration is required.</div>}
      {error&&<div className="notice notice-error">{error} {!authorized&&<Link to="/admin/login">Owner sign-in</Link>}</div>}
      {notice&&<div className="notice notice-success">{notice}</div>}
      <div className="grievance-admin-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by grievance reference or name"/><span><ShieldCheck size={15}/> Owner access required</span></div>
      {loading?<div className="investigation-empty">Loading grievances…</div>:items.length===0?<div className="investigation-empty"><h2>No grievances found</h2><p>New public submissions will appear here.</p></div>:items.map(item=>{
        const draft=drafts[item.id]??{status:item.status,publicRemark:"",internalRemark:""};
        return <article className="grievance-admin-card" key={item.id}>
          <div className="grievance-admin-head"><div><span className="eyebrow">{item.reference_id}</span><h2>{item.subject}</h2><small>{item.full_name} · {item.mobile} · {item.email}</small></div><span className="grievance-status">{item.status}</span></div>
          <p className="grievance-description">{item.description}</p>
          <div className="grievance-admin-grid">
            <label className="field"><span>Status</span><select value={draft.status} onChange={e=>setDrafts(current=>({...current,[item.id]:{...draft,status:e.target.value}}))}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label>
            <label className="field"><span>Public remark (visible to customer)</span><textarea rows={3} maxLength={1500} value={draft.publicRemark} onChange={e=>setDrafts(current=>({...current,[item.id]:{...draft,publicRemark:e.target.value}}))} placeholder="Share an update with the customer"/></label>
            <label className="field"><span>Internal remark (owner only)</span><textarea rows={3} maxLength={1500} value={draft.internalRemark} onChange={e=>setDrafts(current=>({...current,[item.id]:{...draft,internalRemark:e.target.value}}))} placeholder="Internal handling notes"/></label>
          </div>
          <button className="button button-dark" disabled={busy||!authorized} onClick={()=>void save(item)}>{busy?"Saving…":"Save grievance update"}</button>
        </article>;
      })}
    </main>
  );
}
