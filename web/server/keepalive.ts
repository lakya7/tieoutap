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
  const paths = ['/auth/v1/health', '/rest/v1/']
  const statuses = await Promise.all(
    paths.map((path) =>
      fetch(`${url}${path}`, { headers, signal: AbortSignal.timeout(10_000) }).then(
        (response) => response.status,
        () => 0,
      ),
    ),
  )
  const checks = Object.fromEntries(paths.map((path, i) => [path, statuses[i]]))
  const reached = statuses.some((status) => status >= 200 && status < 300)
  return { ok: reached, detail: reached ? 'Supabase pinged' : 'Supabase unreachable', checks }
}
