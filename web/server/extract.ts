/** Server-side statement extraction endpoint, shared by the Vite dev server
 * and the deployed serverless function. The API key never reaches the
 * browser: the client posts document bytes here and gets back the same
 * ExtractionResult the Phase 2 module produces — including its refusals. */
import { anthropicVisionClient, buildExtractionResult, extractStatement } from '../../ts/src'
import type { ExtractionResult, RawExtraction, StatementDocument } from '../../ts/src'

const MEDIA_TYPES: StatementDocument['media_type'][] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]

/** Max decoded document size. Vision extraction of anything larger is both
 * slow and a sign the wrong file was picked. */
const MAX_BYTES = 12 * 1024 * 1024

export interface ExtractResponse {
  status: number
  body: ExtractionResult | { ok: false; reason: 'bad_request' | 'server_error'; detail: string }
}

function reject(
  status: number,
  reason: 'bad_request' | 'server_error',
  detail: string,
): ExtractResponse {
  return { status, body: { ok: false, reason, detail } }
}

function parseDocument(payload: unknown): StatementDocument | string {
  if (typeof payload !== 'object' || payload === null) return 'body must be a JSON object'
  const { media_type: mediaType, data } = payload as Record<string, unknown>
  if (typeof mediaType !== 'string' || !MEDIA_TYPES.includes(mediaType as never)) {
    return `media_type must be one of ${MEDIA_TYPES.join(', ')}`
  }
  if (typeof data !== 'string' || data === '') return 'data must be a base64 string'
  if (data.length * 0.75 > MAX_BYTES) return 'document exceeds the 12 MB limit'
  return { media_type: mediaType as StatementDocument['media_type'], data }
}

export async function handleExtract(payload: unknown): Promise<ExtractResponse> {
  const document = parseDocument(payload)
  if (typeof document === 'string') return reject(400, 'bad_request', document)

  const mock = process.env.TIEOUT_MOCK_EXTRACTION
  if (mock) {
    try {
      return { status: 200, body: buildExtractionResult(JSON.parse(mock) as RawExtraction) }
    } catch (e) {
      return reject(500, 'server_error', `TIEOUT_MOCK_EXTRACTION is not valid JSON: ${String(e)}`)
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return reject(
      503,
      'server_error',
      'statement extraction is not configured on this deployment (no ANTHROPIC_API_KEY)',
    )
  }

  try {
    const result = await extractStatement(
      document,
      anthropicVisionClient({ apiKey, workspaceId: process.env.ANTHROPIC_WORKSPACE_ID }),
    )
    return { status: 200, body: result }
  } catch (e) {
    return reject(502, 'server_error', e instanceof Error ? e.message : String(e))
  }
}
