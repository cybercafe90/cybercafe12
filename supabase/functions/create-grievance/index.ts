import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'
import {checkRateLimit,serviceClient} from '../_shared/auth.ts'
import {normalizeMobile,preflight,response} from '../_shared/http.ts'
async function sendMail(db:SupabaseClient, gid:string, to:string, type:string, subject:string, body:string){
 const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('EMAIL_FROM');
 if(!key||!from){await db.from('grievance_email_notifications').insert({grievance_id:gid,recipient_email:to,notification_type:type,status:'not_configured',error_message:'Set RESEND_API_KEY and EMAIL_FROM.'});return false}
 try{const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,text:body})});const result=await res.json().catch(()=>({}));if(!res.ok)throw new Error(typeof result.message==='string'?result.message:'Provider returned '+res.status);await db.from('grievance_email_notifications').insert({grievance_id:gid,recipient_email:to,notification_type:type,status:'sent',provider_id:result.id??null});return true}catch(e){await db.from('grievance_email_notifications').insert({grievance_id:gid,recipient_email:to,notification_type:type,status:'failed',error_message:e instanceof Error?e.message.slice(0,350):'Email failed'});return false}
}

async function recordSecurityEvent(db:SupabaseClient,req:Request,eventType:string,summary:string,route:string){
 try{const ip=req.headers.get('cf-connecting-ip'),sourceIp=ip&&ip.length<=45&&/^[0-9a-fA-F:.]+$/.test(ip)?ip:null;await db.from('security_events').insert({source:'application',event_type:eventType,severity:'medium',status:'new',source_ip:sourceIp,route,summary,details:{detection:'server_rate_limit'}})}catch{/* Keep telemetry failures out of the customer request path. */}
}
Deno.serve(async(req)=>{const early=preflight(req);if(early)return early;try{
 const db=serviceClient();if(!await checkRateLimit(db,req,'grievance-submit','all',5,30)){await recordSecurityEvent(db,req,'grievance_submit_rate_limited','Grievance submission rate limit exceeded.','/grievance');return response(req,{error:'Too many submissions. Please try later.'},429);}
 const raw=await req.text();if(raw.length>12000)return response(req,{error:'Request too large.'},413);const b=JSON.parse(raw);
 const name=typeof b.fullName==='string'?b.fullName.trim().replace(/\s+/g,' '):'',mobile=normalizeMobile(b.mobile),email=typeof b.email==='string'?b.email.trim().toLowerCase():'',subject=typeof b.subject==='string'?b.subject.trim():'',description=typeof b.description==='string'?b.description.trim():'';
 if(b.consent!==true||name.length<2||name.length>120||!mobile||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||subject.length<4||subject.length>160||description.length<20||description.length>4000)return response(req,{error:'Please check all fields and consent.'},400);
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(10)),ref='GRV-'+Array.from(bytes,x=>alphabet[x&31]).join('');
 const {data:g,error}=await db.from('grievances').insert({reference_id:ref,full_name:name,mobile,email,subject,description,consent_at:new Date().toISOString()}).select('id,reference_id,status,created_at').single();if(error)throw error;
 const customer=await sendMail(db,g.id,email,'customer_confirmation','Grievance received · '+ref,'Hello '+name+',\n\nWe received your grievance: '+subject+'. Your reference is '+ref+'. Keep it safe and use it with your registered mobile number to track progress.\n\nBABA\'S CYBER CAFE');
 const business=await sendMail(db,g.id,Deno.env.get('BUSINESS_NOTIFICATION_EMAIL')??'support@babacybercafe.in','business_alert','New grievance · '+ref,'A new grievance was submitted.\nReference: '+ref+'\nName: '+name+'\nSubject: '+subject+'\nEmail: '+email+'\nReview it in the owner portal.');
 return response(req,{referenceId:g.reference_id,status:g.status,submittedAt:g.created_at,emailSent:customer,businessNotificationSent:business,emailWarning:customer&&business?undefined:'Grievance saved; email delivery needs configuration or provider verification.'},201,{'Cache-Control':'no-store'});
}catch(e){console.error('create-grievance:',e instanceof Error?e.message:'unknown');return response(req,{error:'We could not submit your grievance. Please try again.'},503)}})
