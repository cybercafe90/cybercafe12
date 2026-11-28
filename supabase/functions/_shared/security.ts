import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type AdminClient = ReturnType<typeof createClient>

export function cleanText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
    : ''
}

export async function hasAdminRole(
  adminClient: AdminClient,
  userId: string,
): Promise<{ allowed: boolean; error?: string }> {
  const { data, error } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['owner', 'admin', 'staff'])
    .limit(1)
  if (error) return { allowed: false, error: 'Could not validate administrator access.' }
  return { allowed: Boolean(data?.length) }
}

export async function consumeRateLimit(
  adminClient: AdminClient,
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
): Promise<'allowed' | 'limited' | 'unavailable'> {
  const secret = Deno.env.get('RATE_LIMIT_SECRET')
  if (!secret) return 'unavailable'

  const forwarded = request.headers.get('x-forwarded-for')?.split(',').map((part) => part.trim()).filter(Boolean)
  const address = request.headers.get('cf-connecting-ip')?.trim() || forwarded?.at(-1) || ''
  if (!address) return 'unavailable'

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${secret}:${address}`),
  )
  const keyHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const { data, error } = await adminClient.rpc('consume_request_rate_limit', {
    p_scope: scope,
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error || typeof data !== 'boolean') {
    console.error('Rate-limit check failed:', error?.message ?? 'Unexpected database response.')
    return 'unavailable'
  }
  return data ? 'allowed' : 'limited'
}
