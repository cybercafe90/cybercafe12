import { serviceClient, verifyOwner } from '../_shared/auth.ts'
import { preflight, response } from '../_shared/http.ts'

function bool(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (['true', '1', 'yes'].includes(value.trim().toLowerCase())) return true
    if (['false', '0', 'no'].includes(value.trim().toLowerCase())) return false
  }
  return fallback
}

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const admin = serviceClient()
    const actor = await verifyOwner(request, admin)
    const raw = await request.text()
    if (raw.length > 1_500_000) return response(request, { error: 'CSV import is too large.' }, 413)
    const body = JSON.parse(raw)
    if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 1000) return response(request, { error: 'Import between 1 and 1,000 service rows at a time.' }, 400)
    const { data: categoryRows, error: categoryError } = await admin.from('service_categories').select('slug').eq('is_active', true)
    if (categoryError) throw categoryError
    const allowedCategories = new Set((categoryRows ?? []).map((item) => item.slug))
    const validRows: Record<string, unknown>[] = []
    let skipped = 0
    for (const candidate of body.rows) {
      if (!candidate || typeof candidate !== 'object') { skipped += 1; continue }
      const row = candidate as Record<string, unknown>
      const name = typeof row.name === 'string' ? row.name.trim().replace(/\s+/g, ' ') : ''
      const categorySlug = typeof row.category_slug === 'string' ? row.category_slug.trim() : ''
      const description = typeof row.description === 'string' ? row.description.trim() : ''
      const eligibility = typeof row.eligibility === 'string' ? row.eligibility.trim() : ''
      const applicationMethod = typeof row.application_method === 'string' ? row.application_method.trim() : ''
      const url = typeof row.official_url === 'string' ? row.official_url.trim() : ''
      const urlVerified = bool(row.official_url_verified, false)
      const docs = Array.isArray(row.required_documents)
        ? row.required_documents.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
        : typeof row.required_documents === 'string' ? row.required_documents.split('|').map((value) => value.trim()).filter(Boolean) : []
      if (name.length < 2 || name.length > 160 || !allowedCategories.has(categorySlug) || description.length > 2000 || eligibility.length > 1000 || applicationMethod.length > 1000 || docs.length > 40 || docs.some((item) => item.length > 160)) { skipped += 1; continue }
      let officialUrl: string | null = null
      if (url) {
        try {
          const parsed = new URL(url)
          if (parsed.protocol !== 'https:' || !urlVerified) { skipped += 1; continue }
          officialUrl = parsed.toString()
        } catch { skipped += 1; continue }
      }
      validRows.push({
        category_slug: categorySlug,
        name,
        description,
        required_documents: docs,
        eligibility,
        application_method: applicationMethod,
        official_url: officialUrl,
        official_url_verified: Boolean(officialUrl && urlVerified),
        is_active: bool(row.is_active, true),
        is_featured: bool(row.is_featured, false),
      })
    }
    const uniqueRows = new Map<string, Record<string, unknown>>()
    for (const row of validRows) uniqueRows.set(`${row.category_slug}:${String(row.name).toLowerCase()}`, row)
    skipped += validRows.length - uniqueRows.size
    if (!uniqueRows.size) return response(request, { error: 'No valid rows to import.', imported: 0, skipped: body.rows.length }, 400)
    const { data, error } = await admin.from('services').upsert([...uniqueRows.values()], { onConflict: 'category_slug,name' }).select('id')
    if (error) throw error
    await admin.from('admin_audit_logs').insert({ actor_id: actor.id, action: 'import', entity_type: 'services', metadata: { imported: data?.length ?? 0, skipped } })
    return response(request, { imported: data?.length ?? 0, skipped }, 200, { 'Cache-Control': 'no-store' })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    const status = message.includes('Unauthorized') || message.includes('Verified owner') ? 401 : message.includes('Owner authorization') ? 403 : 500
    console.error('import-services failed:', status, message.slice(0, 120))
    return response(request, { error: status === 401 ? 'Verified owner sign-in required.' : status === 403 ? 'Owner authorization required.' : 'Service import could not be completed.' }, status)
  }
})
