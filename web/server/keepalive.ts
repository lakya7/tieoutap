/** Pings the Supabase project so the free tier does not pause it after 7 days
 * without activity. Run daily by the Vercel cron in vercel.json. */

export interface KeepaliveResult {
  ok: boolean
  detail: string
  checks?: Record<string, number>
}

export async function pingSupabase(): Promise<KeepaliveResult> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { ok: true, detail: 'Supabase not configured on this deployment' }
  const headers = { apikey: anonKey, authorization: `Bearer ${anonKey}` }
  const checks: Record<string, number> = {}
  for (const path of ['/auth/v1/health', '/rest/v1/']) {
    try {
      checks[path] = (await fetch(`${url}${path}`, { headers })).status
    } catch {
      checks[path] = 0
    }
  }
  const reached = Object.values(checks).some((status) => status > 0 && status < 500)
  return { ok: reached, detail: reached ? 'Supabase pinged' : 'Supabase unreachable', checks }
}
