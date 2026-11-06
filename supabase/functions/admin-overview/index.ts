import { serviceClient, verifyOwner } from '../_shared/auth.ts'
import { preflight, response } from '../_shared/http.ts'

const documentStatus = 'Documents Required'

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const admin = serviceClient()
    await verifyOwner(request, admin)
    const raw = await request.text()
    if (raw.length > 3000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    const page = Number.isInteger(body.page) ? Math.min(Math.max(body.page, 1), 10000) : 1
    const pageSize = 25
    const status = typeof body.status === 'string' ? body.status : 'all'
    const validStatuses = ['Application Received', 'Under Review', 'Documents Required', 'Processing', 'Submitted to Department', 'Approved', 'Rejected', 'Completed']
    if (status !== 'all' && !validStatuses.includes(status)) return response(request, { error: 'Invalid status filter.' }, 400)
    const term = typeof body.search === 'string' ? body.search.trim().replace(/[^a-zA-Z0-9 +().-]/g, '').slice(0, 60) : ''
    let query = admin.from('applications').select('id, tracking_id, full_name, mobile, email, category_slug, service_name, status, created_at', { count: 'exact' }).order('created_at', { ascending: false })
    if (status !== 'all') query = query.eq('status', status)
    if (term) {
      const safe = term.replace(/[(),]/g, ' ').trim()
      if (safe) query = query.or(`full_name.ilike.%${safe}%,mobile.ilike.%${safe}%,tracking_id.ilike.%${safe}%`)
    }
    const [applications, total, pending, completed, documents] = await Promise.all([
      query.range((page - 1) * pageSize, page * pageSize - 1),
      admin.from('applications').select('id', { count: 'exact', head: true }),
      admin.from('applications').select('id', { count: 'exact', head: true }).not('status', 'in', '("Completed","Rejected")'),
      admin.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'Completed'),
      admin.from('applications').select('id', { count: 'exact', head: true }).eq('status', documentStatus),
    ])
    if (applications.error || total.error || pending.error || completed.error || documents.error) throw new Error('Overview could not be loaded.')
    return response(request, {
      items: applications.data ?? [],
      count: applications.count ?? 0,
      page,
      pageSize,
      stats: { total: total.count ?? 0, pending: pending.count ?? 0, completed: completed.count ?? 0, documentsRequired: documents.count ?? 0 },
    }, 200, { 'Cache-Control': 'no-store' })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    const status = message.includes('Unauthorized') || message.includes('Verified owner') ? 401 : message.includes('Owner authorization') || message.includes('Owner MFA') ? 403 : 500
    console.error('admin-overview failed:', status, message.slice(0, 120))
    return response(request, { error: status === 401 ? 'Verified owner sign-in required.' : status === 403 ? (message.includes('Owner MFA') ? 'Google Authenticator verification is required.' : 'Owner authorization required.') : 'Admin overview could not be loaded.' }, status)
  }
})
