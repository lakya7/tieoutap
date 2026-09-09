/** Wraps a shared handler in the Vercel-style (req, res) function signature. */
import type { ApiResponse as HandlerResponse } from './ai.js'

interface VercelRequest {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status(code: number): VercelResponse
  json(body: unknown): void
}

export function vercelHandler<T>(
  handle: (payload: unknown, authHeader?: string) => Promise<HandlerResponse<T>>,
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  return async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, reason: 'bad_request', detail: 'use POST' })
      return
    }
    const payload: unknown = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const auth = req.headers?.['authorization']
    const { status, body } = await handle(payload, Array.isArray(auth) ? auth[0] : auth)
    res.status(status).json(body)
  }
}
