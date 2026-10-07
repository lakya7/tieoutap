/** Deployed cron entry point that keeps the Supabase project from pausing. */
import { pingSupabase } from '../server/keepalive.js'

interface CronRequest {
  headers?: Record<string, string | string[] | undefined>
}

interface CronResponse {
  status(code: number): CronResponse
  json(body: unknown): void
}

export default async function handler(req: CronRequest, res: CronResponse): Promise<void> {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers?.['authorization'] !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, detail: 'unauthorized' })
    return
  }
  const result = await pingSupabase()
  res.status(result.ok ? 200 : 502).json(result)
}
