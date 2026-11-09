import {serviceClient,checkRateLimit} from '../_shared/auth.ts'
import {preflight,response} from '../_shared/http.ts'

Deno.serve(async(req)=>{
 const early=preflight(req);if(early)return early;
 try{
  const db=serviceClient();
  if(!await checkRateLimit(db,req,'feedback-submit','all',5,30))return response(req,{error:'Too many feedback submissions. Please try again later.'},429);
  const raw=await req.text();if(raw.length>10000)return response(req,{error:'Request too large.'},413);
  const b=JSON.parse(raw);
  const fullName=typeof b.fullName==='string'?b.fullName.trim().replace(/\s+/g,' ').slice(0,120):'';
  const email=typeof b.email==='string'?b.email.trim().toLowerCase().slice(0,254):'';
  const mobile=typeof b.mobile==='string'?b.mobile.trim().replace(/[^+\d]/g,'').slice(0,20):'';
  const serviceName=typeof b.serviceName==='string'?b.serviceName.trim().slice(0,160):'';
  const message=typeof b.message==='string'?b.message.trim().slice(0,2000):'';
  const type=['compliment','suggestion','complaint'].includes(b.feedbackType)?b.feedbackType:'';
  const rating=Number(b.rating),anonymous=b.isAnonymous===true;
  if(b.consent!==true||!type||serviceName.length<2||message.length<10||message.length>2000||!Number.isInteger(rating)||rating<1||rating>5||(!anonymous&&!fullName&&!email&&!mobile)|| (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return response(req,{error:'Please check the required fields and consent.'},400);
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(10)),referenceId='FBK-'+Array.from(bytes,x=>alphabet[x&31]).join('');
  const {data:row,error}=await db.from('customer_feedback').insert({reference_id:referenceId,full_name:anonymous?null:(fullName||null),email:anonymous?null:(email||null),mobile:anonymous?null:(mobile||null),feedback_type:type,service_name:serviceName,rating,message,is_anonymous:anonymous,consent_at:new Date().toISOString()}).select('reference_id,created_at').single();
  if(error)throw error;
  let emailSent=false;
  const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('EMAIL_FROM');
  if(!anonymous&&email&&key&&from){
   try{const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[email],subject:'Feedback received · '+referenceId,text:'Thank you for sharing your feedback with BABA\'S CYBER CAFE.\n\nReference: '+referenceId+'\nRating: '+rating+'/5\n\nWe appreciate your time.'})});emailSent=mail.ok;}catch{emailSent=false;}
  }
  const notify=Deno.env.get('BUSINESS_NOTIFICATION_EMAIL')??'support@babacybercafe.in';
  if(key&&from){try{await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[notify],subject:'New customer feedback · '+referenceId,text:'New feedback received.\nReference: '+referenceId+'\nType: '+type+'\nService: '+serviceName+'\nRating: '+rating+'/5\nMessage: '+message+'\nReview in the owner dashboard.'})});}catch{/* Feedback remains saved even if email is unavailable. */}}
  return response(req,{referenceId:row.reference_id,submittedAt:row.created_at,emailSent},201,{'Cache-Control':'no-store'});
 }catch(e){console.error('feedback-submit:',e instanceof Error?e.message:'unknown');return response(req,{error:'Feedback could not be submitted. Please try again.'},503)}
});
