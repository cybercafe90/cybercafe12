import { sendCustomerEmail } from '../_shared/email.ts'
import { serviceClient, verifyOwner } from '../_shared/auth.ts'
import { preflight, response } from '../_shared/http.ts'

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const admin = serviceClient()
    await verifyOwner(request, admin)
    const raw = await request.text()
    if (raw.length > 2000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    if (body.type !== 'document_available' || typeof body.applicationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.applicationId)) {
      return response(request, { error: 'Invalid notification request.' }, 400)
    }
    const { data: application, error } = await admin.from('applications').select('id, email, full_name, tracking_id, service_name, status').eq('id', body.applicationId).maybeSingle()
    if (error || !application) return response(request, { error: 'Application not found.' }, 404)
    if (!['Approved', 'Completed'].includes(application.status)) return response(request, { emailSent: false, emailWarning: 'The document is stored privately. Mark the application Approved or Completed before notifying the customer.' }, 200)
    const { count } = await admin.from('application_documents').select('id', { count: 'exact', head: true }).eq('application_id', application.id).eq('is_customer_visible', true)
    if (!count) return response(request, { error: 'No customer-visible document is ready.' }, 400)
    const result = await sendCustomerEmail(admin, {
      applicationId: application.id,
      recipient: application.email,
      name: application.full_name,
      trackingId: application.tracking_id,
      service: application.service_name,
      type: 'document_available',
    })
    return response(request, { emailSent: result.sent, emailWarning: result.warning }, 200, { 'Cache-Control': 'no-store' })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    const status = message.includes('Unauthorized') || message.includes('Verified owner') ? 401 : message.includes('Owner authorization') || message.includes('Owner MFA') ? 403 : 500
    console.error('notify-customer failed:', status, message.slice(0, 120))
    return response(request, { error: status === 401 ? 'Verified owner sign-in required.' : status === 403 ? (message.includes('Owner MFA') ? 'Google Authenticator verification is required.' : 'Owner authorization required.') : 'Customer notification could not be sent.' }, status)
  }
})
