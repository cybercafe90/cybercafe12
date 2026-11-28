import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, readJson } from '../_shared/http.ts'
import { cleanText, consumeRateLimit, hasAdminRole } from '../_shared/security.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const resendApiKey = Deno.env.get('RESEND_API_KEY')
const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL')
const consentVersion = '2026-11-v1'

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required function secret: ${name}`)
  return value
}

function normalizeMobile(value: unknown): string {
  return cleanText(value).replace(/\D/g, '')
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function recordEmailNotification(
  adminClient: ReturnType<typeof createClient>,
  applicationId: string,
  email: string | null,
  status: 'skipped' | 'accepted' | 'failed',
  providerMessageId: string | null = null,
  errorCode: string | null = null,
) {
  const { error } = await adminClient.from('email_notifications').insert({
    application_id: applicationId,
    recipient_email: email,
    notification_type: 'application_confirmation',
    provider: 'resend',
    status,
    provider_message_id: providerMessageId,
    error_code: errorCode,
  })
  if (error) console.error('Could not record email notification status:', error.message)
}

async function sendCustomerConfirmation(
  adminClient: ReturnType<typeof createClient>,
  application: { id: string; tracking_id: string; customer_name: string; service_name_snapshot: string; email: string | null },
): Promise<'not_configured' | 'not_provided' | 'accepted' | 'failed'> {
  if (!application.email) {
    await recordEmailNotification(adminClient, application.id, null, 'skipped', null, 'email_not_provided')
    return 'not_provided'
  }
  if (!resendApiKey || !fromEmail) {
    await recordEmailNotification(adminClient, application.id, application.email, 'skipped', null, 'provider_not_configured')
    return 'not_configured'
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [application.email],
        subject: `Application received: ${application.tracking_id}`,
        text: `Hello ${application.customer_name},\n\nWe have received your request for ${application.service_name_snapshot}.\nTracking ID: ${application.tracking_id}\n\nYou can check its progress at https://babacybercafe.in/track. Keep your tracking ID private and use the mobile number provided with your application.\n\nBABA'S CYBER CAFE\n+91 7006865909`,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      console.error('Email provider rejected application confirmation:', response.status)
      await recordEmailNotification(adminClient, application.id, application.email, 'failed', null, `provider_http_${response.status}`)
      return 'failed'
    }

    let providerMessageId: string | null = null
    try {
      const providerResponse: unknown = await response.json()
      if (providerResponse && typeof providerResponse === 'object' && 'id' in providerResponse && typeof providerResponse.id === 'string') {
        providerMessageId = providerResponse.id.slice(0, 200)
      }
    } catch (error) {
      console.error('Email provider accepted the request but returned an unreadable response:', error)
    }
    await recordEmailNotification(adminClient, application.id, application.email, 'accepted', providerMessageId)
    return 'accepted'
  } catch (error) {
    console.error('Email provider request failed:', error)
    await recordEmailNotification(adminClient, application.id, application.email, 'failed', null, 'provider_request_failed')
    return 'failed'
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const body = await readJson(request)
  if (!body) return jsonResponse({ error: 'Invalid request body.' }, 400)
  const action = cleanText(body.action)
  let url: string
  let serviceKey: string
  try {
    url = requiredEnv('SUPABASE_URL', supabaseUrl)
    serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey)
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: 'Application service is not configured.' }, 500)
  }
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } })

  if (action === 'create') {
    const rateLimit = await consumeRateLimit(adminClient, request, 'application_create', 6, 900)
    if (rateLimit === 'unavailable') return jsonResponse({ error: 'Application security checks are unavailable. Please contact our team on WhatsApp.' }, 503)
    if (rateLimit === 'limited') return jsonResponse({ error: 'Too many application attempts. Please wait and try again.' }, 429)

    const customerName = cleanText(body.customer_name)
    const mobile = normalizeMobile(body.mobile)
    const email = cleanText(body.email).toLowerCase()
    const serviceNameInput = cleanText(body.service_name)
    const message = cleanText(body.message)
    const serviceId = cleanText(body.service_id)
    const departmentId = cleanText(body.department_id)

    if (customerName.length < 1 || customerName.length > 100) return jsonResponse({ error: 'Enter a name of 1 to 100 characters.' }, 400)
    if (!/^[0-9]{10,15}$/.test(mobile)) return jsonResponse({ error: 'Enter a valid mobile number.' }, 400)
    if (email && !validEmail(email)) return jsonResponse({ error: 'Enter a valid email address.' }, 400)
    if (serviceNameInput.length < 1 || serviceNameInput.length > 160) return jsonResponse({ error: 'Choose a service or describe what you need help with.' }, 400)
    if (message.length > 2000) return jsonResponse({ error: 'The message must be 2,000 characters or fewer.' }, 400)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentId)) return jsonResponse({ error: 'Choose a valid department.' }, 400)
    if (body.consent !== true) return jsonResponse({ error: 'Please confirm consent before submitting.' }, 400)

    let approvedServiceId: string | null = null
    let serviceName = serviceNameInput
    let categoryId = departmentId
    if (serviceId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId)) return jsonResponse({ error: 'Choose a valid service.' }, 400)
      const { data: service, error } = await adminClient.from('services')
        .select('id,name,category_id,is_active,is_published')
        .eq('id', serviceId)
        .maybeSingle()
      if (error) {
        console.error('Could not validate selected service:', error.message)
        return jsonResponse({ error: 'We could not validate the selected service. Please try again.' }, 500)
      }
      if (!service?.is_published || !service.is_active || service.category_id !== departmentId) {
        return jsonResponse({ error: 'That service is no longer available for the selected department.' }, 400)
      }
      approvedServiceId = service.id
      serviceName = service.name
      categoryId = service.category_id
    }

    const authorization = request.headers.get('Authorization')
    let customerUserId: string | null = null
    if (authorization?.startsWith('Bearer ') && anonKey) {
      const userClient = createClient(url, anonKey, { auth: { persistSession: false } })
      const { data: userData, error: authError } = await userClient.auth.getUser(authorization.slice('Bearer '.length))
      if (!authError) customerUserId = userData.user?.id ?? null
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const year = new Date().getUTCFullYear()
      const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 5).toUpperCase()
      const trackingId = `BBC-${year}-${suffix}`
      const { data, error } = await adminClient.rpc('create_customer_application', {
        p_tracking_id: trackingId,
        p_customer_name: customerName,
        p_mobile_digits: mobile,
        p_email: email || null,
        p_department_id: categoryId,
        p_service_id: approvedServiceId,
        p_service_name: serviceName,
        p_message: message || null,
        p_consent: body.consent === true,
        p_consent_version: consentVersion,
        p_customer_user_id: customerUserId,
      })
      if (!error) {
        const application = Array.isArray(data) ? data[0] : data
        if (!application || typeof application.application_id !== 'string' || typeof application.created_at !== 'string') {
          console.error('Application creation RPC returned an invalid response.')
          return jsonResponse({ error: 'The application service returned an unexpected response.' }, 500)
        }
        const emailNotification = await sendCustomerConfirmation(adminClient, {
          id: application.application_id,
          tracking_id: trackingId,
          customer_name: customerName,
          service_name_snapshot: serviceName,
          email: email || null,
        })
        return jsonResponse({
          tracking_id: trackingId,
          created_at: application.created_at,
          email_notification: emailNotification,
        }, 201)
      }
      if (error.code !== '23505') {
        console.error('Could not create application:', error.message)
        return jsonResponse({ error: 'We could not submit your application. Please review your details and try again.' }, 400)
      }
    }
    console.error('Could not allocate a unique tracking ID after retries.')
    return jsonResponse({ error: 'We could not create a tracking ID. Please try again shortly.' }, 503)
  }

  if (action === 'update') {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ') || !anonKey) return jsonResponse({ error: 'Sign in with an authorized owner account.' }, 401)
    const token = authorization.slice('Bearer '.length)
    const userClient = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: userData, error: authError } = await userClient.auth.getUser(token)
    if (authError || !userData.user) return jsonResponse({ error: 'Sign in with an authorized owner account.' }, 401)
    const role = await hasAdminRole(adminClient, userData.user.id)
    if (role.error) {
      console.error(role.error)
      return jsonResponse({ error: 'Could not verify owner access.' }, 500)
    }
    if (!role.allowed) return jsonResponse({ error: 'This account is not authorized to manage applications.' }, 403)

    const rateLimit = await consumeRateLimit(adminClient, request, 'application_admin_update', 120, 3600)
    if (rateLimit === 'unavailable') return jsonResponse({ error: 'Application security checks are unavailable.' }, 503)
    if (rateLimit === 'limited') return jsonResponse({ error: 'Too many update attempts. Please wait and try again.' }, 429)

    const applicationId = cleanText(body.application_id)
    const status = cleanText(body.status)
    const publicRemark = body.public_remark === null ? null : cleanText(body.public_remark)
    const internalNotes = body.internal_notes === null ? null : cleanText(body.internal_notes)
    const allowedStatuses = ['received', 'in_review', 'awaiting_customer', 'submitted', 'completed', 'rejected']
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) return jsonResponse({ error: 'Invalid application.' }, 400)
    if (!allowedStatuses.includes(status)) return jsonResponse({ error: 'Choose a valid application status.' }, 400)
    if (publicRemark && publicRemark.length > 1000) return jsonResponse({ error: 'Customer update must be 1,000 characters or fewer.' }, 400)
    if (internalNotes && internalNotes.length > 3000) return jsonResponse({ error: 'Internal notes must be 3,000 characters or fewer.' }, 400)

    const { data, error } = await adminClient.rpc('admin_update_application', {
      p_application_id: applicationId,
      p_actor_user_id: userData.user.id,
      p_status: status,
      p_public_remark: publicRemark || null,
      p_internal_notes: internalNotes || null,
    })
    if (error) {
      console.error('Could not update application:', error.message)
      return jsonResponse({ error: 'Could not save this application update.' }, 500)
    }
    if (data !== true) return jsonResponse({ error: 'The application could not be updated.' }, 404)
    return jsonResponse({ success: true })
  }

  return jsonResponse({ error: 'Choose a supported application action.' }, 400)
})
