import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } })
  : null

// Capture PASSWORD_RECOVERY at client initialization. React may mount the
// admin route after Supabase has already processed the email redirect.
let passwordRecoveryPending = false
if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') passwordRecoveryPending = true
    if (event === 'SIGNED_OUT') passwordRecoveryPending = false
  })
}

export function hasPendingPasswordRecovery(): boolean {
  return passwordRecoveryPending
}

export function clearPasswordRecoveryPending(): void {
  passwordRecoveryPending = false
}

export async function callFunction<T>(name: string, body: object, accessToken?: string): Promise<T> {
  if (!supabase) throw new Error('Secure services are not configured yet. Please contact the cafe directly.')
  const { data, error } = await supabase.functions.invoke<T>(name, {
    body,
    ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
  })
  if (error) throw new Error(error.message)
  return data as T
}