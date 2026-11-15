import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'
const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-print-agent-token', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })
const encoder = new TextEncoder()
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('')
const sha256 = async (value: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Backend configuration is incomplete.')
  return createClient(url, key, { auth:{autoRefreshToken:false,persistSession:false} })
}
async function ownerId(request: Request, admin: SupabaseClient) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new Error('Owner sign-in required.')
  // Validate the caller's session with the server-side client. This avoids
  // depending on a publishable/anon key being present in Edge Function secrets.
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) throw new Error('Owner sign-in required.')
  const { data: role, error: roleError } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'owner').maybeSingle()
  if (roleError || !role) throw new Error('Owner authorization required.')
  return user.id
}
async function agentDevice(request: Request, admin: SupabaseClient) {
  const token = request.headers.get('x-print-agent-token') ?? ''
  if (!/^baba_print_[a-f0-9]{72}$/.test(token)) return null
  const {data,error} = await admin.from('print_agent_devices').select('id,device_name').eq('token_hash',await sha256(token)).eq('is_active',true).maybeSingle()
  if (error) throw error
  return data ?? null
}
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok',{headers:cors})
  if (request.method !== 'POST') return json({error:'Method not allowed.'},405)
  try {
    const admin = serviceClient(), body = await request.json(), action = typeof body.action === 'string' ? body.action : ''
    if (action === 'register_agent') {
      const owner = await ownerId(request,admin), deviceName = typeof body.deviceName === 'string' ? body.deviceName.trim().slice(0,100) : ''
      if (!deviceName) return json({error:'Enter a desktop device name.'},400)
      const token = 'baba_print_' + Array.from(crypto.getRandomValues(new Uint8Array(36)),b=>b.toString(16).padStart(2,'0')).join('')
      const {data,error} = await admin.from('print_agent_devices').insert({device_name:deviceName,token_hash:await sha256(token),created_by:owner}).select('id,device_name,created_at').single()
      if (error) throw error
      return json({device:data,agentToken:token,warning:'Copy this token into the Windows agent configuration. It is shown only once.'})
    }
    if (action === 'list_agents') {
      await ownerId(request,admin)
      const {data,error} = await admin.from('print_agent_devices').select('id,device_name,is_active,last_seen_at,last_error,created_at').order('created_at',{ascending:false})
      if (error) throw error
      return json({devices:data ?? []})
    }
    const device = await agentDevice(request,admin)
    if (!device) return json({error:'Invalid or inactive desktop agent token.'},401)
    await admin.from('print_agent_devices').update({last_seen_at:new Date().toISOString(),last_error:null}).eq('id',device.id)
    if (action === 'poll') {
      const {data:jobs,error} = await admin.from('print_jobs').select('id,job_number,file_name,storage_path,copies,color_mode,paper_size,page_count').eq('status','queued').in('payment_status',['paid','cash_approved']).order('created_at',{ascending:true}).limit(1)
      if (error) throw error
      const job = jobs?.[0]
      if (!job) return json({job:null,idle:true})
      const {data:claimed,error:claimError} = await admin.from('print_jobs').update({status:'printing',agent_id:device.id,print_started_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','queued').in('payment_status',['paid','cash_approved']).select('id,job_number,file_name,storage_path,copies,color_mode,paper_size,page_count').maybeSingle()
      if (claimError) throw claimError
      if (!claimed) return json({job:null,idle:true})
      const {data:signed,error:signError} = await admin.storage.from('print-jobs').createSignedUrl(claimed.storage_path,180)
      if (signError || !signed?.signedUrl) {
        await admin.from('print_jobs').update({status:'failed',error_message:'Unable to create secure document download link.',updated_at:new Date().toISOString()}).eq('id',claimed.id)
        throw new Error('Could not prepare the document download.')
      }
      await admin.from('print_job_events').insert({print_job_id:claimed.id,actor_type:'agent',actor_id:device.id,event_type:'agent_claimed_job',details:{device_name:device.device_name}})
      return json({job:{...claimed,downloadUrl:signed.signedUrl},idle:false})
    }
    if (action === 'sent' || action === 'fail') {
      const jobId = typeof body.jobId === 'string' ? body.jobId : ''
      if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({error:'Invalid print job.'},400)
      const nextStatus = action === 'sent' ? 'sent_to_printer' : 'failed'
      const message = action === 'fail' && typeof body.error === 'string' ? body.error.slice(0,500) : null
      const {data,error} = await admin.from('print_jobs').update({status:nextStatus,spooler_submitted_at:action === 'sent' ? new Date().toISOString() : null,error_message:message,updated_at:new Date().toISOString()}).eq('id',jobId).eq('agent_id',device.id).eq('status','printing').select('id,job_number,status').maybeSingle()
      if (error) throw error
      if (!data) return json({error:'Job is not assigned to this desktop agent.'},409)
      await admin.from('print_job_events').insert({print_job_id:jobId,actor_type:'agent',actor_id:device.id,event_type:nextStatus,details:{device_name:device.device_name,error:message,meaning:action === 'sent' ? 'Accepted by Windows print spooler; physical output still needs confirmation.' : null}})
      return json({job:data})
    }
    return json({error:'Unsupported action.'},400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    const status = /Owner sign-in|Owner authorization/.test(message) ? 403 : 500
    console.error('print-agent:',message.slice(0,180))
    return json({error:status === 403 ? message : 'Print agent request failed.'},status)
  }
})
