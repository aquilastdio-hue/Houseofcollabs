import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False when the public env vars are missing — the app then shows a setup screen. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * The single Supabase client for the whole app. Only the public anon /
 * publishable key is ever used in the browser; RLS enforces access.
 */
export const supabase = createClient<Database>(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'house-of-collabs-auth',
  },
  global: { headers: { 'x-client-info': 'house-of-collabs-web' } },
  realtime: { params: { eventsPerSecond: 10 } },
})

export type SupabaseClient = typeof supabase
