import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1'

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Backend is not configured.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
function normalizeMobile(value: unknown) {
  if (typeof value !== 'string') return null
  const raw = value.trim(); let digits = raw.replace(/\\D/g, '')
  if (digits.length === 10) digits = '91' + digits
  else if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1)
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits
  if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return '+' + digits
  return null
}
function cors(request: Request): HeadersInit {
  const origin = request.headers.get('origin') || ''
  const allowed = ['https://babacybercafe.in','https://www.babacybercafe.in']
  let ok = allowed.includes(origin)
  try { const u = new URL(origin); ok ||= u.protocol === 'https:' && (u.hostname === 'babacybercafe.pages.dev' || u.hostname.endsWith('.babacybercafe.pages.dev')) } catch {}
  return { 'Access-Control-Allow-Origin': ok ? origin : 'https://babacybercafe.in', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
}
function response(request: Request, body: unknown, status=200, extra: Record<string,string>={}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(request), 'Content-Type':'application/json; charset=utf-8', ...extra } })
}
function preflight(request: Request) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(request) })
  const origin = request.headers.get('origin') || ''
  if (origin && cors(request)['Access-Control-Allow-Origin'] !== origin) return response(request,{error:'Origin not allowed.'},403)
  if (request.method !== 'POST') return response(request,{error:'Method not allowed.'},405)
  return null
}
async function checkRateLimit(admin: ReturnType<typeof serviceClient>, request: Request, purpose: string, identifier: string, limit: number, windowMinutes: number) {
  const secret = Deno.env.get('TRACK_RATE_SECRET')
  if (!secret) throw new Error('Rate-limit service is not configured.')
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}:${purpose}:${ip}:${identifier}`))
  const scopeHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('')
  const ms = windowMinutes * 60000
  const windowStart = new Date(Math.floor(Date.now()/ms)*ms).toISOString()
  const { data, error } = await admin.rpc('consume_rate_limit', { p_scope_hash: scopeHash, p_window_start: windowStart, p_limit: limit })
  if (error) throw new Error('Rate-limit storage is unavailable.')
  return data === true
}

const encoder = new TextEncoder()
const validName = (v: unknown) => typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 120
const validJob = (v: unknown) => typeof v === 'string' && /^PRN-[A-F0-9]{10}$/i.test(v.trim())
const safeFileName = (v: unknown) => {
  if (typeof v !== 'string') return ''
  return v.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180)
}
function hex(bytes: ArrayBuffer) { return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('') }
async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
async function razorpay(path: string, method: string, body?: unknown) {
  const id = Deno.env.get('RAZORPAY_KEY_ID'), secret = Deno.env.get('RAZORPAY_KEY_SECRET')
  if (!id || !secret) throw new Error('Razorpay credentials are not configured.')
  const res = await fetch('https://api.razorpay.com/v1' + path, {
    method, headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) { console.error('print Razorpay API error', res.status); throw new Error('Razorpay could not process this request.') }
  return data
}
function price(d: Record<string, unknown>) {
  const kind = d.kind
  const copies = Number(d.copies)
  if (!Number.isInteger(copies) || copies < 1 || copies > 100) throw new Error('Copies must be between 1 and 100.')
  if (kind === 'document' || kind === 'resume') {
    const pages = Number(d.selectedPageCount)
    const pageCount = Number(d.pageCount)
    if (!Number.isInteger(pages) || pages < 1 || pages > 1000 || !Number.isInteger(pageCount) || pageCount < pages || pageCount > 1000) throw new Error('Enter a valid PDF page count and selected page count.')
    const colour = d.colour === 'colour'
    const duplex = d.sides === 'manual-duplex'
    const rate = duplex ? (colour ? 15 : 9) : (colour ? 9 : 5)
    return Math.round(Math.ceil(pages / (duplex ? 2 : 1)) * rate * copies)
  }
  if (kind === 'id') return 10 * copies
  if (kind === 'photo') {
    const count = Number(d.photoCount), width = Number(d.photoWidth), height = Number(d.photoHeight)
    const base = count === 6 ? 30 : count === 8 ? 40 : count === 12 ? 60 : 0
    if (!base || !Number.isFinite(width) || !Number.isFinite(height) || width < 15 || width > 80 || height < 15 || height > 100) throw new Error('Select a valid photo quantity and size.')
    return Math.ceil((base * width * height / (35 * 45)) / 5) * 5
  }
  throw new Error('Select a supported print service.')
}
Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  try {
    const raw = await request.text()
    if (raw.length > 12000) return response(request, { error: 'Request is too large.' }, 413)
    const body = JSON.parse(raw)
    const action = typeof body.action === 'string' ? body.action : ''
    const admin = serviceClient()
    if (action === 'create_job') {
      if (!validName(body.customerName)) return response(request, { error: 'Enter your name.' }, 400)
      const mobile = normalizeMobile(body.mobile)
      const fileName = safeFileName(body.fileName)
      const size = Number(body.fileSize)
      if (!mobile || !fileName.toLowerCase().endsWith('.pdf') || body.contentType !== 'application/pdf' || !Number.isSafeInteger(size) || size < 1 || size > 26214400) return response(request, { error: 'Use a PDF file up to 25 MB and a valid mobile number.' }, 400)
      const details = body.details && typeof body.details === 'object' && !Array.isArray(body.details) ? body.details as Record<string, unknown> : {}
      const amount = price(details)
      const ipOk = await checkRateLimit(admin, request, 'print-create-ip', 'all', 10, 15)
      const mobileOk = await checkRateLimit(admin, request, 'print-create-mobile', mobile, 3, 30)
      if (!ipOk || !mobileOk) return response(request, { error: 'Too many print requests. Please wait before trying again.' }, 429)
      const id = crypto.randomUUID()
      const storagePath = id + '/' + fileName
      const insert = await admin.from('print_jobs').insert({
        id, customer_name: body.customerName.trim(), customer_mobile: mobile, file_name: fileName,
        storage_path: storagePath, file_size_bytes: size, copies: Number(details.copies), color_mode: details.colour === 'colour' ? 'color' : 'bw',
        paper_size: 'A4', page_count: Number(details.pageCount) || null, payment_amount: amount,
        payment_status: 'pending', status: 'awaiting_payment', order_details: details,
      }).select('id,job_number').single()
      if (insert.error || !insert.data) throw new Error('Your print request could not be saved.')
      const signed = await admin.storage.from('print-jobs').createSignedUploadUrl(storagePath, { upsert: false })
      if (signed.error || !signed.data?.token) {
        await admin.from('print_jobs').delete().eq('id', id)
        throw new Error('Secure document upload could not be started.')
      }
      await admin.from('print_job_events').insert({ print_job_id: id, actor_type: 'customer', event_type: 'print_request_created', details: { file_name: fileName, amount, service: details.kind } })
      return response(request, { jobId: id, jobNumber: insert.data.job_number, storagePath, uploadToken: signed.data.token, amount, currency: 'INR', keyId: Deno.env.get('RAZORPAY_KEY_ID') }, 200, { 'Cache-Control': 'no-store' })
    }
    if (action === 'create_order' || action === 'verify_payment' || action === 'track') {
      const mobile = normalizeMobile(body.mobile)
      const jobNumber = validJob(body.jobNumber) ? body.jobNumber.trim().toUpperCase() : ''
      if (!mobile || !jobNumber) return response(request, { error: 'Check the print job reference and mobile number.' }, 404, { 'Cache-Control': 'no-store' })
      const [ipOk, jobOk] = await Promise.all([
        checkRateLimit(admin, request, 'print-' + action + '-ip', 'all', 30, 15),
        checkRateLimit(admin, request, 'print-' + action + '-job', jobNumber, action === 'track' ? 30 : 8, 15),
      ])
      if (!ipOk || !jobOk) return response(request, { error: 'Too many attempts. Please wait and try again.' }, 429)
      const { data: job, error } = await admin.from('print_jobs').select('id,job_number,customer_name,customer_mobile,file_name,storage_path,file_size_bytes,payment_amount,payment_status,status,razorpay_order_id,razorpay_payment_id,order_details').eq('job_number', jobNumber).eq('customer_mobile', mobile).maybeSingle()
      if (error || !job) return response(request, { error: 'We could not find that print request.' }, 404, { 'Cache-Control': 'no-store' })
      if (action === 'track') return response(request, { job: { jobNumber: job.job_number, customerName: job.customer_name, fileName: job.file_name, amount: job.payment_amount, paymentStatus: job.payment_status, status: job.status, createdAt: undefined } }, 200, { 'Cache-Control': 'no-store' })
      if (action === 'create_order') {
        if (job.payment_status === 'paid') return response(request, { error: 'This print job is already paid.' }, 409)
        if (job.status !== 'awaiting_payment') return response(request, { error: 'This print job is not available for payment.' }, 409)
        const { data: uploadedPdf, error: downloadError } = await admin.storage.from('print-jobs').download(job.storage_path)
        if (downloadError || !uploadedPdf || uploadedPdf.size !== Number(job.file_size_bytes) || uploadedPdf.type !== 'application/pdf') return response(request, { error: 'The PDF upload is incomplete or invalid. Upload it again before paying.' }, 409)
        const pdfBytes = new Uint8Array(await uploadedPdf.arrayBuffer())
        if (new TextDecoder().decode(pdfBytes.slice(0, 5)) !== '%PDF-') return response(request, { error: 'The uploaded file is not a valid PDF document.' }, 415)
        let actualPages = 1
        try { actualPages = (await PDFDocument.load(pdfBytes, { ignoreEncryption: true })).getPageCount() } catch { return response(request, { error: 'The PDF could not be opened. Please upload an unlocked PDF.' }, 415) }
        if (actualPages < 1 || actualPages > 1000) return response(request, { error: 'PDFs must contain between 1 and 1,000 pages.' }, 413)
        const details = { ...(job.order_details as Record<string, unknown>), pageCount: actualPages, selectedPageCount: actualPages }
        const verifiedAmount = price(details)
        if (verifiedAmount < 1 || verifiedAmount > 100000) return response(request, { error: 'The calculated print amount is invalid.' }, 409)
        const amountUpdate = await admin.from('print_jobs').update({ page_count: actualPages, payment_amount: verifiedAmount, order_details: details, updated_at: new Date().toISOString() }).eq('id', job.id).eq('payment_status', 'pending')
        if (amountUpdate.error) throw new Error('The verified print total could not be saved.')
        job.payment_amount = verifiedAmount
        if (job.razorpay_order_id) {
          const existing = await razorpay('/orders/' + encodeURIComponent(job.razorpay_order_id), 'GET')
          if (existing.status === 'created' || existing.status === 'attempted') return response(request, { orderId: existing.id, amount: existing.amount, currency: existing.currency, keyId: Deno.env.get('RAZORPAY_KEY_ID') }, 200, { 'Cache-Control': 'no-store' })
        }
        const amountPaise = Math.round(Number(job.payment_amount) * 100)
        if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) return response(request, { error: 'The print amount is invalid.' }, 409)
        const order = await razorpay('/orders', 'POST', { amount: amountPaise, currency: 'INR', receipt: job.id, notes: { print_job_number: job.job_number, print_job_id: job.id } })
        if (order.amount !== amountPaise || order.currency !== 'INR' || typeof order.id !== 'string') throw new Error('Razorpay returned an invalid order.')
        const saved = await admin.from('print_jobs').update({ razorpay_order_id: order.id, updated_at: new Date().toISOString() }).eq('id', job.id).eq('payment_status', 'pending')
        if (saved.error) throw new Error('The Razorpay order could not be linked to your print job.')
        await admin.from('print_job_events').insert({ print_job_id: job.id, actor_type: 'system', event_type: 'razorpay_order_created', details: { order_id: order.id, amount_paise: amountPaise } })
        return response(request, { orderId: order.id, amount: order.amount, currency: order.currency, keyId: Deno.env.get('RAZORPAY_KEY_ID') }, 200, { 'Cache-Control': 'no-store' })
      }
      const orderId = typeof body.razorpayOrderId === 'string' ? body.razorpayOrderId : ''
      const paymentId = typeof body.razorpayPaymentId === 'string' ? body.razorpayPaymentId : ''
      const signature = typeof body.razorpaySignature === 'string' ? body.razorpaySignature : ''
      if (!orderId || !paymentId || !/^[a-f0-9]{64}$/i.test(signature) || orderId !== job.razorpay_order_id) return response(request, { error: 'Payment verification details are invalid.' }, 400)
      const secret = Deno.env.get('RAZORPAY_KEY_SECRET')
      if (!secret) throw new Error('Razorpay credentials are not configured.')
      const expected = await hmac(secret, orderId + '|' + paymentId)
      if (!equal(expected, signature.toLowerCase())) return response(request, { error: 'The payment signature could not be verified.' }, 400)
      const remote = await razorpay('/payments/' + encodeURIComponent(paymentId), 'GET')
      if (remote.order_id !== orderId || Number(remote.amount) !== Math.round(Number(job.payment_amount) * 100) || remote.currency !== 'INR') return response(request, { error: 'Payment amount does not match this print job.' }, 409)
      if (remote.status !== 'captured' || remote.captured !== true) return response(request, { verified: true, paid: false, message: 'Payment is awaiting capture confirmation. Do not pay again.' }, 202, { 'Cache-Control': 'no-store' })
      const update = await admin.from('print_jobs').update({ payment_status: 'paid', razorpay_payment_id: paymentId, status: 'queued', updated_at: new Date().toISOString() }).eq('id', job.id).eq('payment_status', 'pending').eq('razorpay_order_id', orderId).select('id').maybeSingle()
      if (update.error) throw update.error
      if (update.data) await admin.from('print_job_events').insert({ print_job_id: job.id, actor_type: 'system', event_type: 'razorpay_payment_captured', details: { order_id: orderId, payment_id: paymentId, amount_paise: remote.amount } })
      return response(request, { verified: true, paid: true, message: 'Payment verified. Your print request is now queued.' }, 200, { 'Cache-Control': 'no-store' })
    }
    return response(request, { error: 'Unsupported print action.' }, 400)
  } catch (error) {
    console.error('print-orders failed:', error instanceof Error ? error.message.slice(0, 160) : 'unknown')
    return response(request, { error: error instanceof Error ? error.message : 'Print service is temporarily unavailable.' }, 503, { 'Cache-Control': 'no-store' })
  }
})
