import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, readJson } from '../_shared/http.ts'
import { cleanText, consumeRateLimit, hasAdminRole } from '../_shared/security.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const resendApiKey = Deno.env.get('RESEND_API_KEY')
const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL')

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !resendApiKey || !fromEmail) {
    console.error('Email notification function is missing configuration.')
    return jsonResponse({ error: 'Email notifications are not configured.' }, 503)
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Owner sign-in is required.' }, 401)
  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const { data: userData, error: authError } = await userClient.auth.getUser(authorization.slice('Bearer '.length))
  if (authError || !userData.user) return jsonResponse({ error: 'Owner sign-in is required.' }, 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const role = await hasAdminRole(adminClient, userData.user.id)
  if (role.error) {
    console.error(role.error)
    return jsonResponse({ error: 'Could not verify owner access.' }, 500)
  }
  if (!role.allowed) return jsonResponse({ error: 'This account is not authorized to send notifications.' }, 403)

  const rateLimit = await consumeRateLimit(adminClient, request, 'admin_email_notification', 60, 3600)
  if (rateLimit === 'unavailable') return jsonResponse({ error: 'Email security checks are unavailable.' }, 503)
  if (rateLimit === 'limited') return jsonResponse({ error: 'Too many notification attempts. Please wait and try again.' }, 429)

  const body = await readJson(request)
  const trackingId = cleanText(body?.tracking_id).toUpperCase()
  if (!/^BBC-[0-9]{4}-[A-Z0-9]{5}$/.test(trackingId)) return jsonResponse({ error: 'Enter a valid tracking ID.' }, 400)
  const { data: application, error } = await adminClient.from('applications')
    .select('id,tracking_id,customer_name,email,service_name_snapshot,status,public_remark')
    .eq('tracking_id', trackingId)
    .maybeSingle()
  if (error) {
    console.error('Could not load application for notification:', error.message)
    return jsonResponse({ error: 'Could not load the application.' }, 500)
  }
  if (!application?.email) return jsonResponse({ error: 'This application has no email address on file.' }, 400)

  const remark = application.public_remark ? `\n\nUpdate from our team: ${application.public_remark}` : ''
  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [application.email],
        subject: `Application update: ${application.tracking_id}`,
        text: `Hello ${application.customer_name},\n\nThere is an update for your ${application.service_name_snapshot} application.\nStatus: ${application.status}${remark}\n\nYou can check your progress at https://babacybercafe.in/track.\n\nBABA'S CYBER CAFE\n+91 7006865909`,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!emailResponse.ok) {
      console.error('Email provider rejected notification:', emailResponse.status)
      const { error: logError } = await adminClient.from('email_notifications').insert({
        application_id: application.id,
        recipient_email: application.email,
        notification_type: 'status_update',
        status: 'failed',
        error_code: `provider_http_${emailResponse.status}`,
      })
      if (logError) console.error('Could not record email notification status:', logError.message)
      return jsonResponse({ error: 'The email provider could not accept this notification.' }, 502)
    }

    let providerMessageId: string | null = null
    try {
      const providerResponse: unknown = await emailResponse.json()
      if (providerResponse && typeof providerResponse === 'object' && 'id' in providerResponse && typeof providerResponse.id === 'string') {
        providerMessageId = providerResponse.id.slice(0, 200)
      }
    } catch (error) {
      console.error('Email provider accepted the request but returned an unreadable response:', error)
    }
    const { error: logError } = await adminClient.from('email_notifications').insert({
      application_id: application.id,
      recipient_email: application.email,
      notification_type: 'status_update',
      status: 'accepted',
      provider_message_id: providerMessageId,
    })
    if (logError) console.error('Could not record email notification status:', logError.message)
    return jsonResponse({ accepted: true, delivery_confirmed: false })
  } catch (error) {
    console.error('Email provider request failed:', error)
    const { error: logError } = await adminClient.from('email_notifications').insert({
      application_id: application.id,
      recipient_email: application.email,
      notification_type: 'status_update',
      status: 'failed',
      error_code: 'provider_request_failed',
    })
    if (logError) console.error('Could not record email notification status:', logError.message)
    return jsonResponse({ error: 'The email provider could not accept this notification.' }, 502)
  }
})
