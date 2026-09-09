/** Serves /api/extract from the Vite dev server so local development uses the
 * exact handler the deployed function does. The handler is loaded through
 * Vite's module runner rather than imported directly, so the config bundle
 * stays free of the engine sources. */
import type { Plugin } from 'vite'
import type { ExtractResponse } from './extract.ts'

const MAX_BODY_BYTES = 24 * 1024 * 1024

interface ExtractModule {
  handleExtract(payload: unknown): Promise<ExtractResponse>
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
      server.middlewares.use('/api/extract', (req, res, next) => {
        if (req.method !== 'POST') return next()
        void (async () => {
          try {
            const payload: unknown = JSON.parse(await readBody(req))
            const mod = (await server.ssrLoadModule('/server/extract.ts')) as ExtractModule
            const { status, body } = await mod.handleExtract(payload)
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
    },
  }
}
