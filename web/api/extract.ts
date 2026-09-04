/** Deployed serverless entry point (Vercel-style signature) wrapping the
 * shared handler. */
import { handleExtract } from '../server/extract.ts'

interface ApiRequest {
  method?: string
  body?: unknown
}

interface ApiResponse {
  status(code: number): ApiResponse
  json(body: unknown): void
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'bad_request', detail: 'use POST' })
    return
  }
  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const { status, body } = await handleExtract(payload)
  res.status(status).json(body)
}
