import { serviceClient, verifyOwner } from '../_shared/auth.ts'
import { preflight, response } from '../_shared/http.ts'

const validId = (value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const admin = serviceClient()
    const actor = await verifyOwner(request, admin)
    const raw = await request.text()
    if (raw.length > 2000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    if (!validId(body.applicationId)) return response(request, { error: 'Invalid application.' }, 400)

    const { data: application, error: applicationError } = await admin
      .from('applications')
      .select('id, tracking_id, full_name, status')
      .eq('id', body.applicationId)
      .maybeSingle()
    if (applicationError || !application) return response(request, { error: 'Application not found.' }, 404)

    const [{ data: documents, error: documentsError }, { data: payment, error: paymentError }] = await Promise.all([
      admin.from('application_documents').select('storage_path').eq('application_id', application.id),
      admin.from('payment_orders').select('id, amount, status, utr, paid_at').eq('application_id', application.id).maybeSingle(),
    ])
    if (documentsError || paymentError) throw new Error('Application records could not be prepared for deletion.')

    let paymentHistory: unknown[] = []
    if (payment?.id) {
      const { data, error } = await admin.from('payment_audit_events')
        .select('action, metadata, created_at')
        .eq('payment_id', payment.id)
        .order('created_at', { ascending: true })
      if (error) throw new Error('Payment audit history could not be preserved.')
      paymentHistory = data ?? []
    }

    // Preserve a durable owner audit record before the cascading delete.
    const { error: auditError } = await admin.from('admin_audit_logs').insert({
      actor_id: actor.id,
      action: 'application_deleted',
      entity_type: 'application',
      entity_id: application.id,
      metadata: {
        tracking_id: application.tracking_id,
        previous_status: application.status,
        payment: payment ? { amount: payment.amount, status: payment.status, utr: payment.utr, paid_at: payment.paid_at } : null,
        payment_audit_history: paymentHistory,
        document_count: documents?.length ?? 0,
      },
    })
    if (auditError) throw new Error('Deletion audit record could not be saved; nothing was deleted.')

    const { data: deleted, error: deleteError } = await admin.from('applications')
      .delete().eq('id', application.id).select('id').maybeSingle()
    if (deleteError || !deleted) throw new Error('Application deletion failed.')

    // The application/document metadata is now gone. Remove the associated
    // objects from the private bucket; keep a warning if Storage is unavailable.
    const paths = (documents ?? []).map(item => item.storage_path).filter((path): path is string => typeof path === 'string' && path.length > 0)
    let storageCleanupPending = false
    if (paths.length) {
      const { error } = await admin.storage.from('application-documents').remove(paths)
      storageCleanupPending = Boolean(error)
      if (error) console.error('application document cleanup pending:', error.message.slice(0, 120))
    }

    return response(request, { deleted: true, storageCleanupPending }, 200, { 'Cache-Control': 'no-store' })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    const status = message.includes('Unauthorized') ? 401 : message.includes('Owner authorization') ? 403 : 500
    console.error('admin-delete-application failed:', status, message.slice(0, 120))
    return response(request, { error: status === 401 ? 'Owner sign-in required.' : status === 403 ? 'Owner authorization required.' : 'Application could not be deleted.' }, status)
  }
})
