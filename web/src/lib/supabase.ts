import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Null when auth is not configured for this build; the app then runs without a login gate. */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null
