/** Serves the /api/* endpoints from the Vite dev server so local development
 * uses the exact handlers the deployed functions do. Handlers are loaded
 * through Vite's module runner rather than imported directly, so the config
 * bundle stays free of the engine sources. */
import type { Plugin } from 'vite'
import type { ApiResponse } from './ai.ts'

const MAX_BODY_BYTES = 24 * 1024 * 1024

type Handler = (payload: unknown, authHeader?: string) => Promise<ApiResponse<unknown>>

/** route -> [server module, exported handler name] */
const ROUTES: Record<string, [string, string]> = {
  '/api/extract': ['/server/extract.ts', 'handleExtract'],
  '/api/map': ['/server/map.ts', 'handleMap'],
  '/api/summarize': ['/server/summarize.ts', 'handleSummarize'],
}

function readBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk
      if (body.length > MAX_BODY_BYTES) reject(new Error('request body too large'))
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

export function devApiPlugin(): Plugin {
  return {
    name: 'tieout-dev-api',
    configureServer(server) {
      for (const [route, [modulePath, handlerName]] of Object.entries(ROUTES)) {
        server.middlewares.use(route, (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, reason: 'bad_request', detail: 'POST only' }))
            return
          }
          void (async () => {
            try {
              const payload: unknown = JSON.parse(await readBody(req))
              const mod = (await server.ssrLoadModule(modulePath)) as Record<string, Handler>
              const auth = req.headers['authorization']
              const { status, body } = await mod[handlerName](
                payload,
                Array.isArray(auth) ? auth[0] : auth,
              )
              res.statusCode = status
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify(body))
            } catch (e) {
              res.statusCode = 400
              res.setHeader('content-type', 'application/json')
              res.end(
                JSON.stringify({
                  ok: false,
                  reason: 'bad_request',
                  detail: e instanceof Error ? e.message : String(e),
                }),
              )
            }
          })()
        })
      }
    },
  }
}
