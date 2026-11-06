import { checkRateLimit, serviceClient } from '../_shared/auth.ts'
import { normalizeMobile, preflight, response } from '../_shared/http.ts'

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
  try {
    const admin = serviceClient()
    const raw = await request.text()
    if (raw.length > 2000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    const trackingId = typeof body.trackingId === 'string' ? body.trackingId.trim().toUpperCase() : ''
    const mobile = normalizeMobile(body.mobile)
    if (!/^BABA-[A-Z0-9]{10}$/.test(trackingId) || !mobile) return response(request, { error: 'We could not verify those details. Check your reference and registered mobile number.' }, 404, { 'Cache-Control': 'no-store' })

    const ipAllowed = await checkRateLimit(admin, request, 'application-track-ip', 'all', 15, 15)
    const referenceAllowed = await checkRateLimit(admin, request, 'application-track-reference', trackingId, 6, 15)
    if (!ipAllowed || !referenceAllowed) {
      await recordSecurityEvent(admin, request, 'application_track_rate_limited', 'Application tracking verification rate limit exceeded.', '/track')
      return response(request, { error: 'Too many verification attempts. Please wait before trying again.' }, 429, { 'Cache-Control': 'no-store' })
    }

    const { data: application, error } = await admin.from('applications')
      .select('id, tracking_id, mobile, category_slug, service_name, status, created_at')
      .eq('tracking_id', trackingId).eq('mobile', mobile).maybeSingle()
    if (error || !application) return response(request, { error: 'We could not verify those details. Check your reference and registered mobile number.' }, 404, { 'Cache-Control': 'no-store' })

    const [{ data: history }, { data: remarks }] = await Promise.all([
      admin.from('application_status_history').select('status, created_at').eq('application_id', application.id).order('created_at', { ascending: true }),
      admin.from('application_remarks').select('body').eq('application_id', application.id).eq('visibility', 'customer').order('created_at', { ascending: false }).limit(5),
    ])
    const documents: { name: string; url: string; expiresAt: string }[] = []
    if (['Approved', 'Completed'].includes(application.status)) {
      const { data: files } = await admin.from('application_documents').select('file_name, storage_path').eq('application_id', application.id).eq('is_customer_visible', true).order('created_at', { ascending: false }).limit(10)
      for (const file of files ?? []) {
        const { data: signed } = await admin.storage.from('application-documents').createSignedUrl(file.storage_path, 300, { download: file.file_name })
        if (signed?.signedUrl) documents.push({ name: file.file_name, url: signed.signedUrl, expiresAt: new Date(Date.now() + 300_000).toISOString() })
      }
    }

    return response(request, {
      trackingId: application.tracking_id,
      service: application.service_name,
      category: application.category_slug,
      status: application.status,
      submittedAt: application.created_at,
      history: history ?? [{ status: application.status, created_at: application.created_at }],
      remarks: (remarks ?? []).map((item) => item.body),
      documents,
    }, 200, { 'Cache-Control': 'no-store, private', 'Pragma': 'no-cache' })
  } catch (reason) {
    console.error('track-application failed:', reason instanceof Error ? reason.message : 'unknown error')
    return response(request, { error: 'Tracking is temporarily unavailable. Please try again later.' }, 503, { 'Cache-Control': 'no-store' })
  }
})
