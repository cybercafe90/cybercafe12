import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, readJson } from '../_shared/http.ts'
import { cleanText, consumeRateLimit } from '../_shared/security.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing required function secrets for tracking verification.')
    return jsonResponse({ error: 'Tracking service is not configured.' }, 500)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const rateLimit = await consumeRateLimit(adminClient, request, 'tracking_verify', 30, 900)
  if (rateLimit === 'unavailable') return jsonResponse({ error: 'Tracking security checks are unavailable. Please contact our team on WhatsApp.' }, 503)
  if (rateLimit === 'limited') return jsonResponse({ error: 'Too many tracking attempts. Please wait and try again.' }, 429)

  const body = await readJson(request)
  if (!body) return jsonResponse({ error: 'Invalid request body.' }, 400)
  const trackingId = cleanText(body.tracking_id).toUpperCase()
  const mobile = cleanText(body.mobile).replace(/\D/g, '')
  if (!/^BBC-[0-9]{4}-[A-Z0-9]{5}$/.test(trackingId) || !/^[0-9]{10,15}$/.test(mobile)) {
    return jsonResponse({ application: null })
  }

  const { data, error } = await adminClient.from('applications')
    .select('id,tracking_id,service_name_snapshot,status,public_remark,created_at')
    .eq('tracking_id', trackingId)
    .eq('mobile_digits', mobile)
    .maybeSingle()
  if (error) {
    console.error('Tracking verification query failed:', error.message)
    return jsonResponse({ error: 'Tracking could not be checked. Please try again.' }, 500)
  }
  if (!data) return jsonResponse({ application: null })
  const { data: documents, error: documentError } = await adminClient.from('application_documents')
    .select('id,file_name,approval_status')
    .eq('application_id', data.id)
    .eq('upload_status', 'available')
    .order('created_at', { ascending: false })
  if (documentError) {
    console.error('Could not load verified application documents:', documentError.message)
    return jsonResponse({ error: 'Application documents could not be checked. Please try again.' }, 500)
  }
  return jsonResponse({
    application: {
      tracking_id: data.tracking_id,
      service_name: data.service_name_snapshot,
      status: data.status,
      public_remark: data.public_remark,
      created_at: data.created_at,
      documents: documents ?? [],
    },
  })
})
