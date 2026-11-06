import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'
import { serviceClient } from '../_shared/auth.ts'
import { preflight, response } from '../_shared/http.ts'

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const url = Deno.env.get('SUPABASE_URL')
    if (!token || !anonKey || !url) return response(request, { error: 'Verified customer sign-in required.' }, 401)
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } })
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) return response(request, { error: 'Verified customer sign-in required.' }, 401, { 'Cache-Control': 'no-store' })

    const admin = serviceClient()
    const [{ data: profile }, { data: applications, error }] = await Promise.all([
      admin.from('profiles').select('full_name, mobile').eq('id', user.id).maybeSingle(),
      admin.from('applications').select('id, tracking_id, full_name, mobile, email, category_slug, service_name, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ])
    if (error) throw new Error('Customer records could not be loaded.')
    const items = await Promise.all((applications ?? []).map(async (application) => {
      const [{ data: history }, { data: remarks }] = await Promise.all([
        admin.from('application_status_history').select('status, created_at').eq('application_id', application.id).order('created_at', { ascending: true }),
        admin.from('application_remarks').select('body, created_at').eq('application_id', application.id).eq('visibility', 'customer').order('created_at', { ascending: false }).limit(5),
      ])
      const documents: { name: string; url: string; expiresAt: string }[] = []
      if (['Approved', 'Completed'].includes(application.status)) {
        const { data: files } = await admin.from('application_documents').select('file_name, storage_path').eq('application_id', application.id).eq('is_customer_visible', true).order('created_at', { ascending: false }).limit(10)
        for (const file of files ?? []) {
          const { data: signed } = await admin.storage.from('application-documents').createSignedUrl(file.storage_path, 300, { download: file.file_name })
          if (signed?.signedUrl) documents.push({ name: file.file_name, url: signed.signedUrl, expiresAt: new Date(Date.now() + 300_000).toISOString() })
        }
      }
      return { trackingId: application.tracking_id, fullName: application.full_name, mobile: application.mobile, email: application.email, category: application.category_slug, service: application.service_name, status: application.status, submittedAt: application.created_at, history: history ?? [], remarks: remarks ?? [], documents }
    }))
    return response(request, { profile: { fullName: profile?.full_name ?? '', mobile: profile?.mobile ?? '', email: user.email ?? '' }, applications: items }, 200, { 'Cache-Control': 'no-store, private', 'Pragma': 'no-cache' })
  } catch (reason) {
    console.error('customer-dashboard failed:', reason instanceof Error ? reason.message : 'unknown error')
    return response(request, { error: 'Customer dashboard is temporarily unavailable.' }, 503, { 'Cache-Control': 'no-store' })
  }
})
