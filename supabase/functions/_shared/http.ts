const defaultOrigins = ['https://babacybercafe.in', 'https://www.babacybercafe.in']

function isAllowedOrigin(origin: string, configured: string[] = []) {
  return [...defaultOrigins, ...configured].includes(origin) || /^https:\/\/(?:[a-z0-9-]+\\.)?babacybercafe\\.pages\\.dev$/i.test(origin)
}

export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  const configured = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map((item) => item.trim()).filter(Boolean) ?? []
  return isAllowedOrigin(origin, configured)
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin')
  const configured = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map((item) => item.trim()).filter(Boolean) ?? []
  const origins = [...defaultOrigins, ...configured]
  return {
    'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin, configured) ? origin : 'https://babacybercafe.in',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

export function response(request: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  })
}

export function preflight(request: Request) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (!allowedOrigin(request)) return response(request, { error: 'Origin not allowed.' }, 403)
  if (request.method !== 'POST') return response(request, { error: 'Method not allowed.' }, 405)
  return null
}

export function normalizeMobile(value: unknown) {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 10) digits = `91${digits}`
  else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`
  return null
}

export function createTrackingReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return `BABA-${Array.from(bytes, (byte) => alphabet[byte & 31]).join('')}`
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
