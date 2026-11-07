import { checkRateLimit, serviceClient, verifyOwner } from './auth.ts'
import { createTrackingReference, normalizeMobile, preflight, response } from './http.ts'
const statuses = ['received','partner_review','quotes_ready','customer_contacted','payment_pending','issued','closed']
const policyTypes = ['third_party','comprehensive','standalone_od','bundled','renewal']
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
const cleanList = (value: unknown) => Array.isArray(value) ? value.slice(0,12).map(v=>clean(v,100)).filter(v=>v.length>0) : []

function escapeHtml(value: string) {
 return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}
async function sendInsuranceEmail(admin: ReturnType<typeof serviceClient>, details: {
 requestId: string; recipient: string; type: 'customer_confirmation' | 'business_alert' | 'quote_ready';
 trackingId: string; customerName: string; vehicle: string;
}) {
 const apiKey=Deno.env.get('RESEND_API_KEY'), from=Deno.env.get('EMAIL_FROM')
 const subject=details.type==='customer_confirmation' ? `Insurance enquiry received · ${details.trackingId}`
  : details.type==='business_alert' ? `New insurance quotation request · ${details.trackingId}`
  : `Your insurance quotations are ready · ${details.trackingId}`
 const text=details.type==='customer_confirmation'
  ? `Hello ${details.customerName}, we received your motor insurance quotation request for ${details.vehicle}. Your reference is ${details.trackingId}. Keep this reference and your registered mobile number to check your quotations. BABA'S CYBER CAFE.`
  : details.type==='business_alert'
   ? `A new motor insurance quotation request was received. Customer: ${details.customerName}. Vehicle: ${details.vehicle}. Reference: ${details.trackingId}. Review it in the owner insurance quotation desk.`
   : `Hello ${details.customerName}, quotations have been added for your insurance request ${details.trackingId}. Visit https://babacybercafe.in/insurance and use your reference and registered mobile number to review them. Final cover and issuance are subject to insurer confirmation.`
 const log=async(status:'sent'|'failed'|'not_configured',providerId:string|null,errorMessage:string|null)=>{
  await admin.from('insurance_email_notifications').insert({request_id:details.requestId,recipient_email:details.recipient,notification_type:details.type,status,provider_id:providerId,error_message:errorMessage})
 }
 if(!apiKey||!from){await log('not_configured',null,'Set RESEND_API_KEY and EMAIL_FROM to enable insurance emails.');return {sent:false,warning:'The request was saved, but email confirmation is not configured. Keep your reference.'}}
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[details.recipient],subject,text,html:`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24241e"><p>${escapeHtml(text)}</p><p><strong>Reference:</strong> ${escapeHtml(details.trackingId)}</p><p>BABA'S CYBER CAFE · Your Trust, Our Service.</p></div>`})})
  const result=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(typeof result?.message==='string'?result.message:`Email provider returned ${response.status}.`)
  await log('sent',typeof result?.id==='string'?result.id:null,null)
  return {sent:true}
 }catch(reason){
  const message=reason instanceof Error?reason.message.slice(0,400):'Email provider request failed.'
  await log('failed',null,message)
  return {sent:false,warning:'Your request was saved, but the email could not be sent. Keep your reference.'}
 }
}

Deno.serve(async (request) => {
 const early=preflight(request); if(early) return early
 try {
  const admin=serviceClient(), raw=await request.text()
  if(raw.length>10000) return response(request,{error:'Request is too large.'},413)
  const body=JSON.parse(raw)
  if(body.action==='create_request'){
   if(!await checkRateLimit(admin,request,'insurance-quote-request','all',6,15)) return response(request,{error:'Too many quote requests. Please wait before trying again.'},429)
   const customerName=clean(body.customerName,120), mobile=normalizeMobile(body.mobile), email=clean(body.email,254).toLowerCase()
   const vehicleType=clean(body.vehicleType,32), registrationNumber=clean(body.registrationNumber,20).toUpperCase().replace(/[^A-Z0-9 -]/g,'')
   const makeModel=clean(body.makeModel,120), variant=clean(body.variant,120), registrationYear=Number(body.registrationYear)
   const fuelType=clean(body.fuelType,16), policyType=clean(body.policyType,32), previousInsurer=clean(body.previousInsurer,120)
   const policyExpiry=clean(body.policyExpiry,10), customerNotes=clean(body.customerNotes,800)
   if(body.consent!==true||customerName.length<2||!mobile||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
    !['two_wheeler','private_car','commercial_vehicle'].includes(vehicleType)||makeModel.length<2||
    !Number.isInteger(registrationYear)||registrationYear<1980||registrationYear>new Date().getFullYear()+1||
    !['petrol','diesel','cng','electric','other'].includes(fuelType)||
    !['third_party','comprehensive','standalone_od','renewal'].includes(policyType)||
    (policyExpiry&&!/^\d{4}-\d{2}-\d{2}$/.test(policyExpiry))) return response(request,{error:'Please check the required vehicle, contact and consent details.'},400)
   let saved:{tracking_id:string}|null=null
   for(let attempt=0;attempt<3&&!saved;attempt++){
    const {data,error}=await admin.from('insurance_quote_requests').insert({
     tracking_id:createTrackingReference(),customer_name:customerName,mobile,email,vehicle_type:vehicleType,
     registration_number:registrationNumber||null,make_model:makeModel,variant:variant||null,registration_year:registrationYear,
     fuel_type:fuelType,policy_type:policyType,previous_insurer:previousInsurer||null,policy_expiry:policyExpiry||null,
     claims_last_year:body.claimsLastYear===true,customer_notes:customerNotes||null,status:'received'
    }).select('id,email,tracking_id').single()
    if(!error&&data) saved=data; else if(error?.code!=='23505') throw error??new Error('Could not save quote request.')
   }
   if(!saved) return response(request,{error:'A reference could not be generated. Please try again.'},503)
   const [customerMail,businessMail]=await Promise.all([
    sendInsuranceEmail(admin,{requestId:saved.id,recipient:saved.email,type:'customer_confirmation',trackingId:saved.tracking_id,customerName:customerName,vehicle:makeModel}),
    sendInsuranceEmail(admin,{requestId:saved.id,recipient:Deno.env.get('BUSINESS_NOTIFICATION_EMAIL')??'support@babacybercafe.in',type:'business_alert',trackingId:saved.tracking_id,customerName:customerName,vehicle:makeModel})
   ])
   const emailWarning=customerMail.warning??(!businessMail.sent?'The request was saved, but the business email alert was not confirmed.':undefined)
   return response(request,{trackingId:saved.tracking_id,status:'received',emailSent:customerMail.sent,emailWarning},201,{'Cache-Control':'no-store'})
  }
  if(body.action==='get_quotes'){
   if(!await checkRateLimit(admin,request,'insurance-quote-lookup','all',10,15)) return response(request,{error:'Too many attempts. Please wait and try again.'},429)
   const trackingId=clean(body.trackingId,24).toUpperCase(), mobile=normalizeMobile(body.mobile)
   if(!/^BABA-[A-HJ-NP-Z2-9]{10}$/.test(trackingId)||!mobile) return response(request,{error:'Enter a valid tracking reference and registered mobile number.'},400)
   const {data:record,error}=await admin.from('insurance_quote_requests').select('id,status').eq('tracking_id',trackingId).eq('mobile',mobile).maybeSingle()
   if(error) throw error
   if(!record) return response(request,{error:'We could not find a matching insurance request.'},404)
   const {data:quotes,error:quoteError}=await admin.from('insurance_quotes').select('id,insurer_name,product_name,policy_type,premium,idv,cover_summary,add_ons,exclusions,payment_url,valid_until,created_at').eq('request_id',record.id).eq('is_available',true).order('premium',{ascending:true})
   if(quoteError) throw quoteError
   const now=Date.now(), available=(quotes??[]).filter(q=>!q.valid_until||new Date(q.valid_until).getTime()>now).map(q=>({...q,payment_url:q.payment_url&&q.payment_url.startsWith('https://')?q.payment_url:null}))
   return response(request,{trackingId,status:record.status,quotes:available},200,{'Cache-Control':'no-store'})
  }
  await verifyOwner(request,admin)
  if(body.action==='list_requests'){
   const status=clean(body.status,32), search=clean(body.search,80).replace(/[^a-zA-Z0-9 +().-]/g,'')
   let query=admin.from('insurance_quote_requests').select('id,tracking_id,customer_name,mobile,email,vehicle_type,registration_number,make_model,variant,registration_year,fuel_type,policy_type,previous_insurer,policy_expiry,claims_last_year,customer_notes,status,created_at',{count:'exact'}).order('created_at',{ascending:false}).limit(100)
   if(status&&status!=='all'){if(!statuses.includes(status))return response(request,{error:'Invalid status filter.'},400);query=query.eq('status',status)}
   if(search) query=query.or(`tracking_id.ilike.%${search}%,customer_name.ilike.%${search}%,mobile.ilike.%${search}%,registration_number.ilike.%${search}%`)
   const {data,error,count}=await query; if(error)throw error
   return response(request,{items:data??[],count:count??0},200,{'Cache-Control':'no-store'})
  }
  if(body.action==='list_quotes'){
   const requestId=clean(body.requestId,40)
   if(!/^[0-9a-f-]{36}$/i.test(requestId)) return response(request,{error:'Invalid request.'},400)
   const {data,error}=await admin.from('insurance_quotes').select('id,insurer_name,product_name,policy_type,premium,idv,cover_summary,add_ons,exclusions,payment_url,valid_until,created_at').eq('request_id',requestId).order('premium',{ascending:true})
   if(error)throw error
   return response(request,{quotes:data??[]},200,{'Cache-Control':'no-store'})
  }
  if(body.action==='create_quote'){
   const requestId=clean(body.requestId,40), insurerName=clean(body.insurerName,120), productName=clean(body.productName,160)
   const policyType=clean(body.policyType,32), premium=Number(body.premium), idv=body.idv===''||body.idv==null?null:Number(body.idv)
   const coverSummary=clean(body.coverSummary,1600), addOns=cleanList(body.addOns), exclusions=cleanList(body.exclusions)
   const paymentUrl=clean(body.paymentUrl,1000), validUntil=clean(body.validUntil,40)
   let safeUrl:string|null=null
   if(paymentUrl){try{const parsed=new URL(paymentUrl);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hostname==='localhost'||!parsed.hostname.includes('.'))throw new Error();safeUrl=parsed.toString()}catch{return response(request,{error:'Payment link must be a valid HTTPS insurer/partner checkout URL.'},400)}}
   if(!/^[0-9a-f-]{36}$/i.test(requestId)||insurerName.length<2||productName.length<2||!policyTypes.includes(policyType)||!Number.isFinite(premium)||premium<=0||premium>10000000||(idv!==null&&(!Number.isFinite(idv)||idv<0||idv>100000000))||coverSummary.length<5||(validUntil&&!Number.isFinite(Date.parse(validUntil)))) return response(request,{error:'Review the insurer quote details and try again.'},400)
   const {data:requestRecord,error:requestError}=await admin.from('insurance_quote_requests').select('id,tracking_id,customer_name,email,make_model').eq('id',requestId).maybeSingle()
   if(requestError)throw requestError;if(!requestRecord)return response(request,{error:'Insurance request not found.'},404)
   const {data,error}=await admin.from('insurance_quotes').insert({request_id:requestId,insurer_name:insurerName,product_name:productName,policy_type:policyType,premium,idv,cover_summary:coverSummary,add_ons:addOns,exclusions,payment_url:safeUrl,valid_until:validUntil||null,is_available:true}).select('id').single()
   if(error)throw error
   await admin.from('insurance_quote_requests').update({status:'quotes_ready',updated_at:new Date().toISOString()}).eq('id',requestId)
   const mail=await sendInsuranceEmail(admin,{requestId,recipient:requestRecord.email,type:'quote_ready',trackingId:requestRecord.tracking_id,customerName:requestRecord.customer_name,vehicle:requestRecord.make_model})
   return response(request,{saved:true,id:data.id,emailSent:mail.sent,emailWarning:mail.warning},201)
  }
  if(body.action==='update_status'){
   const id=clean(body.id,40),status=clean(body.status,32)
   if(!/^[0-9a-f-]{36}$/i.test(id)||!statuses.includes(status))return response(request,{error:'Invalid request update.'},400)
   const {error}=await admin.from('insurance_quote_requests').update({status,updated_at:new Date().toISOString()}).eq('id',id)
   if(error)throw error
   return response(request,{updated:true})
  }
  return response(request,{error:'Unknown action.'},400)
 }catch(reason){
  const message=reason instanceof Error?reason.message:''
  const status=message.includes('Unauthorized')||message.includes('Verified owner')?401:message.includes('Owner authorization')?403:500
  console.error('insurance-portal failed:',status,message.slice(0,140))
  return response(request,{error:status===401?'Owner sign-in required.':status===403?'Owner authorization required.':'The insurance request could not be processed right now.'},status)
 }
})