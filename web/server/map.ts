/** AI column mapping: given the header row and a few sample values from an
 * uploaded table whose columns the loaders don't recognise, ask the model
 * which source column corresponds to each engine column. Only headers and
 * samples ever reach the server — never the full file. The mapping is applied
 * deterministically back in the browser. */
import { anthropicToolCall, authError, reject } from './ai.js'
import type { ApiResponse } from './ai.js'

export const TARGET_COLUMNS = {
  statement: ['ref', 'date', 'type', 'amount', 'po', 'currency'],
  ledger: ['supplier', 'ref', 'date', 'type', 'original', 'open', 'po', 'currency'],
} as const

const REQUIRED: Record<Kind, string[]> = {
  statement: ['ref', 'date', 'amount'],
  ledger: ['ref', 'date', 'open'],
}

const COLUMN_MEANINGS = `Column meanings:
- ref: document reference / invoice number / voucher number
- date: document date
- type: document type (invoice, credit note, payment...)
- amount: the statement line amount
- original: the document's original amount on the AP ledger
- open: the document's remaining open/outstanding amount on the AP ledger
- supplier: supplier/vendor name
- po: purchase order number
- currency: currency code`

export type Kind = keyof typeof TARGET_COLUMNS

export interface MapRequest {
  kind: Kind
  headers: string[]
  samples: string[][]
}

export interface MapSuccess {
  ok: true
  /** source header -> engine column */
  mapping: Record<string, string>
}

export type MapResponse = ApiResponse<MapSuccess>

const MAX_HEADERS = 64
const MAX_SAMPLE_ROWS = 5
const MAX_CELL_CHARS = 200

function parsePayload(payload: unknown): MapRequest | string {
  if (typeof payload !== 'object' || payload === null) return 'body must be a JSON object'
  const { kind, headers, samples } = payload as Record<string, unknown>
  if (kind !== 'statement' && kind !== 'ledger') {
    return 'kind must be "statement" or "ledger"'
  }
  const isStringMatrix = (v: unknown): v is string[][] =>
    Array.isArray(v) && v.every((r) => Array.isArray(r) && r.every((c) => typeof c === 'string'))
  if (
    !Array.isArray(headers) ||
    headers.length === 0 ||
    headers.length > MAX_HEADERS ||
    !headers.every((h) => typeof h === 'string' && h.length <= MAX_CELL_CHARS)
  ) {
    return `headers must be 1-${MAX_HEADERS} strings of at most ${MAX_CELL_CHARS} characters`
  }
  if (
    !isStringMatrix(samples) ||
    samples.length > MAX_SAMPLE_ROWS ||
    samples.some((r) => r.length > MAX_HEADERS || r.some((c) => c.length > MAX_CELL_CHARS))
  ) {
    return `samples must be at most ${MAX_SAMPLE_ROWS} rows of short strings`
  }
  return { kind, headers: headers as string[], samples }
}

/** Keeps only entries that name a real source header and an allowed target,
 * each target at most once; requires the essential targets to be present. */
function validateMapping(
  raw: unknown,
  request: MapRequest,
): Record<string, string> | string {
  const pairs = (raw as { columns?: unknown })?.columns
  if (!Array.isArray(pairs)) return 'model returned no column list'
  const allowed: readonly string[] = TARGET_COLUMNS[request.kind]
  const mapping: Record<string, string> = {}
  const used = new Set<string>()
  for (const pair of pairs) {
    const { source, target } = (pair ?? {}) as Record<string, unknown>
    if (typeof source !== 'string' || typeof target !== 'string') continue
    if (!request.headers.includes(source)) continue
    if (!allowed.includes(target) || used.has(target)) continue
    mapping[source] = target
    used.add(target)
  }
  const missing = REQUIRED[request.kind].filter((t) => !used.has(t))
  if (missing.length > 0) {
    return `could not identify the ${missing.join(', ')} column${missing.length > 1 ? 's' : ''}`
  }
  return mapping
}

export async function handleMap(payload: unknown, authHeader?: string): Promise<MapResponse> {
  const denied = await authError(authHeader, 'map columns with AI')
  if (denied) return reject(401, 'unauthorized', denied)

  const request = parsePayload(payload)
  if (typeof request === 'string') return reject(400, 'bad_request', request)

  const mock = process.env.TIEOUT_MOCK_MAPPING
  let raw: unknown
  if (mock) {
    try {
      raw = JSON.parse(mock)
    } catch (e) {
      return reject(500, 'server_error', `TIEOUT_MOCK_MAPPING is not valid JSON: ${String(e)}`)
    }
  } else {
    try {
      raw = await anthropicToolCall({
        system:
          `You map spreadsheet columns from accounts-payable exports onto a fixed schema. ` +
          `Only map a column when its header or sample values make the meaning clear; ` +
          `omit columns you are not sure about. Never map two source columns to the same target.\n\n` +
          COLUMN_MEANINGS,
        user:
          `File kind: ${request.kind === 'statement' ? 'supplier statement' : 'AP open-items ledger export'}\n` +
          `Target columns: ${TARGET_COLUMNS[request.kind].join(', ')}\n` +
          `Source headers: ${JSON.stringify(request.headers)}\n` +
          `Sample rows: ${JSON.stringify(request.samples)}\n` +
          `Map each source header to a target column using the map_columns tool.`,
        toolName: 'map_columns',
        toolDescription: 'Record which source column corresponds to each target column.',
        schema: {
          type: 'object',
          properties: {
            columns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  source: { type: 'string', description: 'a source header, verbatim' },
                  target: { type: 'string', enum: [...TARGET_COLUMNS[request.kind]] },
                },
                required: ['source', 'target'],
              },
            },
          },
          required: ['columns'],
        },
      })
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      return reject(detail.includes('not configured') ? 503 : 502, 'server_error', detail)
    }
  }

  const mapping = validateMapping(raw, request)
  if (typeof mapping === 'string') return reject(422, 'bad_request', mapping)
  return { status: 200, body: { ok: true, mapping } }
}
