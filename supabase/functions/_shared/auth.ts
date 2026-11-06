import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Backend is not configured.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function verifyOwner(request: Request, admin: SupabaseClient): Promise<User> {
  const authorization = request.headers.get('authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!token || !anonKey) throw new Error('Unauthorized.')
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error } = await userClient.auth.getUser(token)
  if (error || !user) throw new Error('Owner sign-in required.')
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
  if (claimsError || claimsData?.claims?.aal !== 'aal2') throw new Error('Owner MFA verification required.')
  const { data: role, error: roleError } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'owner').maybeSingle()
  if (roleError || role?.role !== 'owner') throw new Error('Owner authorization required.')
  return user
}

export async function checkRateLimit(admin: SupabaseClient, request: Request, purpose: string, identifier: string, limit: number, windowMinutes: number) {
  const secret = Deno.env.get('TRACK_RATE_SECRET')
  if (!secret) throw new Error('Rate-limit secret is not configured.')
  const clientIp = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? 'unknown'
  const value = `${secret}:${purpose}:${clientIp}:${identifier}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const scopeHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const windowMs = windowMinutes * 60_000
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString()
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_scope_hash: scopeHash,
    p_window_start: windowStart,
    p_limit: limit,
  })
  if (error) throw new Error('Rate-limit storage is unavailable.')
  return data === true
}
