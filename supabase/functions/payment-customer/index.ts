import { checkRateLimit, serviceClient } from '../_shared/auth.ts'
import { normalizeMobile, preflight, response } from '../_shared/http.ts'

const validTracking = (value: unknown) => typeof value === 'string' && /^BABA-[A-Z0-9]{10}$/.test(value.trim().toUpperCase())

async function getRecord(admin: ReturnType<typeof serviceClient>, trackingId: string, mobile: string) {
  const { data: app, error } = await admin.from('applications')
    .select('id, tracking_id, full_name, mobile, service_name, status, created_at')
    .eq('tracking_id', trackingId).eq('mobile', mobile).maybeSingle()
  if (error || !app) return null
  const { data: payment } = await admin.from('payment_orders')
    .select('id, amount, currency, status, razorpay_payment_id, payment_provider, paid_at, created_at')
    .eq('application_id', app.id).maybeSingle()
  return { application: app, payment: payment ?? { id: undefined, amount: 0, currency: 'INR', status: 'pending', razorpay_payment_id: null, payment_provider: null, paid_at: null } }
}

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const raw = await request.text()
    if (raw.length > 3000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    const action = typeof body.action === 'string' ? body.action : ''
    const trackingId = validTracking(body.trackingId) ? body.trackingId.trim().toUpperCase() : ''
    const mobile = normalizeMobile(body.mobile)
    if (!trackingId || !mobile) return response(request, { error: 'We could not verify those details. Check the tracking ID and registered mobile number.' }, 404, { 'Cache-Control': 'no-store' })
    const admin = serviceClient()
    const ipLimit = action === 'status' ? 3000 : 60
    const referenceLimit = action === 'status' ? 300 : 8
    const [ipAllowed, referenceAllowed] = await Promise.all([
      checkRateLimit(admin, request, `payment-${action}-ip`, 'all', ipLimit, 15),
      checkRateLimit(admin, request, `payment-${action}-reference`, trackingId, referenceLimit, 15),
    ])
    if (!ipAllowed || !referenceAllowed) return response(request, { error: 'Too many payment lookups. Please wait and try again.' }, 429, { 'Cache-Control': 'no-store' })
    const record = await getRecord(admin, trackingId, mobile)
    if (!record) return response(request, { error: 'We could not verify those details. Check the tracking ID and registered mobile number.' }, 404, { 'Cache-Control': 'no-store' })

    if (action === 'lookup' || action === 'status') {
      return response(request, record, 200, { 'Cache-Control': 'no-store, private', 'Pragma': 'no-cache' })
    }
    return response(request, { error: 'Unsupported payment action.' }, 400)
  } catch (reason) {
    console.error('payment-customer failed:', reason instanceof Error ? reason.message.slice(0, 120) : 'unknown error')
    return response(request, { error: 'Payment details are temporarily unavailable.' }, 503, { 'Cache-Control': 'no-store' })
  }
})
