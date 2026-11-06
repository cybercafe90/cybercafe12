import { checkRateLimit, serviceClient } from '../_shared/auth.ts'
import { sendCustomerEmail } from '../_shared/email.ts'
import { createTrackingReference, normalizeMobile, preflight, response } from '../_shared/http.ts'

async function recordSecurityEvent(admin: any, request: Request, eventType: string, summary: string, route: string) {
  try {
    const ip = request.headers.get("cf-connecting-ip");
    const sourceIp = ip && ip.length <= 45 && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null;
    await admin.from("security_events").insert({
      source: "application",
      event_type: eventType,
      severity: "medium",
      status: "new",
      source_ip: sourceIp,
      route,
      summary,
      details: { detection: "server_rate_limit" },
    });
  } catch {
    // Telemetry must never interrupt the customer-facing request path.
  }
}

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  let admin
  try {
    admin = serviceClient()
    if (!await checkRateLimit(admin, request, 'application-submit', 'all', 8, 15)) {
      await recordSecurityEvent(admin, request, 'application_submit_rate_limited', 'Application submission rate limit exceeded.', '/apply')
      return response(request, { error: 'Too many requests. Please wait before trying again.' }, 429)
    }
    const raw = await request.text()
    if (raw.length > 12_000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim().replace(/\s+/g, ' ') : ''
    const mobile = normalizeMobile(body.mobile)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const category = typeof body.category === 'string' ? body.category : ''
    const service = typeof body.service === 'string' ? body.service.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const requiredDocuments = typeof body.requiredDocuments === 'string' ? body.requiredDocuments.trim() : ''
    if (body.consent !== true || fullName.length < 2 || fullName.length > 120 || !mobile || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || description.length < 10 || description.length > 2000 || requiredDocuments.length > 1000) {
      return response(request, { error: 'Please review the required fields and consent, then try again.' }, 400)
    }
    const { data: categoryRecord } = await admin.from('service_categories').select('slug').eq('slug', category).eq('is_active', true).maybeSingle()
    if (!categoryRecord || service.length < 2 || service.length > 160) return response(request, { error: 'The selected service is unavailable. Refresh the catalogue and try again.' }, 400)
    if (service !== 'Other enquiry') {
      const { data: serviceRecord } = await admin.from('services').select('id').eq('category_slug', category).eq('name', service).eq('is_active', true).maybeSingle()
      if (!serviceRecord) return response(request, { error: 'The selected service is unavailable. Refresh the catalogue and try again.' }, 400)
    }

    let userId: string | null = null
    const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (token) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (!anonKey) return response(request, { error: 'Secure authentication is not configured.' }, 503)
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.57.0')
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } })
      const { data: { user }, error } = await userClient.auth.getUser(token)
      if (error || !user || !(user.email_confirmed_at || user.confirmed_at) || user.email?.toLowerCase() !== email) return response(request, { error: 'Your signed-in email must match the email on this enquiry.' }, 403)
      userId = user.id
    }

    let saved: { id: string; tracking_id: string; email: string; full_name: string; service_name: string } | null = null
    for (let attempt = 0; attempt < 2 && !saved; attempt += 1) {
      const { data, error } = await admin.from('applications').insert({
        tracking_id: createTrackingReference(), user_id: userId, full_name: fullName, mobile, email, category_slug: category,
        service_name: service, description, required_documents: requiredDocuments, consent_at: new Date().toISOString(), status: 'Application Received',
      }).select('id, tracking_id, email, full_name, service_name').single()
      if (!error && data) saved = data
      else if (error?.code !== '23505') throw error ?? new Error('Application could not be saved.')
    }
    if (!saved) return response(request, { error: 'A reference could not be generated. Please try once more.' }, 503)

    const [mail, businessMail] = await Promise.all([
      sendCustomerEmail(admin, { applicationId: saved.id, recipient: saved.email, name: saved.full_name, trackingId: saved.tracking_id, service: saved.service_name, type: 'application_confirmation' }),
      sendCustomerEmail(admin, { applicationId: saved.id, recipient: Deno.env.get('BUSINESS_NOTIFICATION_EMAIL') ?? 'support@babacybercafe.in', name: saved.full_name, trackingId: saved.tracking_id, service: saved.service_name, type: 'customer_enquiry' }),
    ])
    const emailWarning = mail.warning ?? (!businessMail.sent ? 'The enquiry was saved, but business email notification was not confirmed. The owner dashboard contains the request.' : undefined)
    return response(request, { trackingId: saved.tracking_id, emailSent: mail.sent, emailWarning }, 201, { 'Cache-Control': 'no-store' })
  } catch (reason) {
    console.error('create-application failed:', reason instanceof Error ? reason.message : 'unknown error')
    return response(request, { error: 'We could not submit your enquiry right now. Please try again or contact the cafe.' }, 500)
  }
})
