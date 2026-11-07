const origins=['https://babacybercafe.in','https://www.babacybercafe.in']
export function corsHeaders(req:Request):HeadersInit{
 const origin=req.headers.get('origin'), configured=Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(x=>x.trim()).filter(Boolean)??[], allowed=[...origins,...configured]
 return {'Access-Control-Allow-Origin':origin&&allowed.includes(origin)?origin:origins[0],'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'}
}
export function response(req:Request,body:unknown,status=200,extra:Record<string,string>={}){
 return new Response(JSON.stringify(body),{status,headers:{...corsHeaders(req),'Content-Type':'application/json; charset=utf-8',...extra}})
}
export function preflight(req:Request){
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders(req)})
 const origin=req.headers.get('origin'), configured=Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(x=>x.trim()).filter(Boolean)??[]
 if(origin&&!['https://babacybercafe.in','https://www.babacybercafe.in',...configured].includes(origin)) return response(req,{error:'Origin not allowed.'},403)
 if(req.method!=='POST') return response(req,{error:'Method not allowed.'},405)
 return null
}
export function normalizeMobile(value:unknown){
 if(typeof value!=='string') return null
 const raw=value.trim(); let digits=raw.replace(/\D/g,'')
 if(digits.length===10) digits='91'+digits
 else if(digits.length===11&&digits.startsWith('0')) digits='91'+digits.slice(1)
 if(digits.length===12&&digits.startsWith('91')) return '+'+digits
 if(raw.startsWith('+')&&digits.length>=8&&digits.length<=15) return '+'+digits
 return null
}
export function createTrackingReference(){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', bytes=crypto.getRandomValues(new Uint8Array(10))
 return 'BABA-'+Array.from(bytes,b=>alphabet[b&31]).join('')
}