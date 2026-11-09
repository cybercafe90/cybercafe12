import {serviceClient,verifyOwner} from '../_shared/auth.ts'
import {preflight,response} from '../_shared/http.ts'
Deno.serve(async(req)=>{
 const early=preflight(req);if(early)return early;
 try{
  const db=serviceClient(),owner=await verifyOwner(req,db),b=await req.json();
  if(b.action==='list'){
   const page=Math.max(0,Math.min(100,Number(b.page)||0)),size=25;
   let q=db.from('customer_feedback').select('id,reference_id,full_name,email,mobile,feedback_type,service_name,rating,message,is_anonymous,status,priority,internal_note,created_at,updated_at,resolved_at',{count:'exact'}).order('created_at',{ascending:false}).range(page*size,page*size+size-1);
   if(typeof b.search==='string'&&b.search.trim()){const term=b.search.trim().replace(/[,%()]/g,'');q=q.or('reference_id.ilike.%'+term+'%,service_name.ilike.%'+term+'%,full_name.ilike.%'+term+'%');}
   if(['new','under_review','resolved','closed'].includes(b.status))q=q.eq('status',b.status);
   const {data,error,count}=await q;if(error)throw error;
   const {data:stats,error:statsError}=await db.from('customer_feedback').select('rating,status');
   if(statsError)throw statsError;
   const rows=stats??[],total=rows.length,average=total?Math.round(rows.reduce((s,x)=>s+x.rating,0)/total*10)/10:0;
   return response(req,{items:data??[],count:count??0,pageSize:size,stats:{total,average,open:rows.filter(x=>['new','under_review'].includes(x.status)).length,resolved:rows.filter(x=>['resolved','closed'].includes(x.status)).length}});
  }
  if(b.action==='update'){
   const id=typeof b.id==='string'?b.id:'',status=['new','under_review','resolved','closed'].includes(b.status)?b.status:'',priority=['low','normal','high','urgent'].includes(b.priority)?b.priority:'normal',note=typeof b.internalNote==='string'?b.internalNote.trim().slice(0,2000):'';
   if(!id||!status)return response(req,{error:'Invalid feedback update.'},400);
   const {data:old,error:readError}=await db.from('customer_feedback').select('status').eq('id',id).single();if(readError)throw readError;
   const {error}=await db.from('customer_feedback').update({status,priority,internal_note:note,updated_at:new Date().toISOString(),resolved_at:status==='resolved'||status==='closed'?new Date().toISOString():null}).eq('id',id);if(error)throw error;
   const {error:historyError}=await db.from('customer_feedback_history').insert({feedback_id:id,actor_id:owner.id,action:'owner_update',old_status:old.status,new_status:status,note});if(historyError)throw historyError;
   return response(req,{updated:true});
  }
  return response(req,{error:'Unknown action.'},400);
 }catch(e){const m=e instanceof Error?e.message:'',s=m.includes('Unauthorized')||m.includes('sign-in required')?401:m.includes('Owner authorization')?403:500;console.error('feedback-admin:',s,m.slice(0,120));return response(req,{error:s===401?'Verified owner sign-in required.':s===403?'Owner authorization required.':'Feedback could not be loaded.'},s)}
});
