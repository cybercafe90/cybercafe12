import { sendCustomerEmail } from '../_shared/email.ts'
import { serviceClient, verifyOwner } from '../_shared/auth.ts'
import { preflight, response } from '../_shared/http.ts'

const validStatuses = new Set(['Application Received', 'Under Review', 'Documents Required', 'Processing', 'Submitted to Department', 'Approved', 'Rejected', 'Completed'])

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const admin = serviceClient()
    const actor = await verifyOwner(request, admin)
    const raw = await request.text()
    if (raw.length > 5000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    if (typeof body.applicationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.applicationId) || !validStatuses.has(body.status)) {
      return response(request, { error: 'Invalid application update.' }, 400)
    }
    const customerRemark = typeof body.customerRemark === 'string' ? body.customerRemark.trim() || null : null
    const internalRemark = typeof body.internalRemark === 'string' ? body.internalRemark.trim() || null : null
    if ((customerRemark && customerRemark.length > 1000) || (internalRemark && internalRemark.length > 1000)) return response(request, { error: 'Remarks must be 1,000 characters or fewer.' }, 400)

    const { data, error } = await admin.rpc('owner_update_application', {
      p_actor_id: actor.id,
      p_application_id: body.applicationId,
      p_status: body.status,
      p_customer_remark: customerRemark,
      p_internal_remark: internalRemark,
    })
    if (error || !data?.[0]) return response(request, { error: 'Application update could not be completed.' }, 400)
    const application = data[0]
    const email = application.previous_status !== application.updated_status
      ? await sendCustomerEmail(admin, {
        applicationId: body.applicationId,
        recipient: application.recipient_email,
        name: application.customer_name,
        trackingId: application.reference_id,
        service: application.service_label,
        status: application.updated_status,
        type: 'status_update',
      })
      : { sent: false, warning: undefined as string | undefined }
    return response(request, { updated: true, emailSent: email.sent, emailWarning: email.warning }, 200, { 'Cache-Control': 'no-store' })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    const status = message.includes('Unauthorized') || message.includes('Verified owner') ? 401 : message.includes('Owner authorization') ? 403 : 500
    console.error('admin-update-application failed:', status, message.slice(0, 120))
    return response(request, { error: status === 401 ? 'Verified owner sign-in required.' : status === 403 ? 'Owner authorization required.' : 'The application update could not be completed.' }, status)
  }
})
