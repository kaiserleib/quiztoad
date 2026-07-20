import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { VercelRequest } from '@vercel/node'

// Service-role client. This key has full DB access and MUST only ever be used
// server-side (it is never sent to the browser).
export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface Caller {
  id: string
  email: string | null
  isAdmin: boolean
  canGenerate: boolean
}

// Validates the caller's Supabase JWT (from the Authorization header) and loads
// their profile flags. Returns null if the token is missing or invalid.
export async function getCaller(req: VercelRequest): Promise<Caller | null> {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null

  const admin = serviceClient()
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return null

  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin, can_generate')
    .eq('id', userData.user.id)
    .single()

  return {
    id: userData.user.id,
    email: userData.user.email ?? null,
    isAdmin: profile?.is_admin ?? false,
    canGenerate: profile?.can_generate ?? false,
  }
}
