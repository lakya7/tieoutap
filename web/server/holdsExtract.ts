/** AI transcription of a PDF/image "Invoices On Hold" report: the model
 * transcribes each hold row exactly as printed — nothing else. The rows are
 * turned into the same CSV the deterministic holds parser already consumes,
 * classification and grouping stay in the browser, and the buyer reviews the
 * extracted rows (with a deterministic total check) before loading them. */
import { authError, reject } from './ai.js'
import type { ApiResponse } from './ai.js'
import { billingError } from './billing.js'

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const MODEL = 'claude-sonnet-4-5'

const MEDIA_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

type MediaType = (typeof MEDIA_TYPES)[number]

/** Max decoded document size, matching the statement extraction endpoint. */
const MAX_BYTES = 12 * 1024 * 1024

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

interface HoldsDocument {
  media_type: MediaType
  data: string
}

export interface HoldRowExtract {
  supplier: string
  invoice: string
  po: string
  hold_reason: string
  comments: string
  amount_text: string
  currency: string
  qty_invoiced_text: string
  qty_received_text: string
  hold_date_text: string
  supplier_email: string
}

export interface HoldsExtractSuccess {
  ok: true
  rows: HoldRowExtract[]
  report_total_text: string
  notes: string
}

export type HoldsExtractResponse = ApiResponse<HoldsExtractSuccess>

/** Leading-byte signatures per media type, so mislabelled bytes are rejected
 * before the document leaves for the transcription provider. */
const SIGNATURES: Record<MediaType, (b: Buffer) => boolean> = {
  'application/pdf': (b) => b.subarray(0, 4).toString('latin1') === '%PDF',
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/gif': (b) => b.subarray(0, 4).toString('latin1') === 'GIF8',
  'image/webp': (b) =>
    b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
}

function parseDocument(payload: unknown): HoldsDocument | string {
  if (typeof payload !== 'object' || payload === null) return 'body must be a JSON object'
  const { media_type: mediaType, data } = payload as Record<string, unknown>
  if (typeof mediaType !== 'string' || !MEDIA_TYPES.includes(mediaType as MediaType)) {
    return `media_type must be one of ${MEDIA_TYPES.join(', ')}`
  }
  if (typeof data !== 'string' || data === '' || data.length % 4 !== 0 || !BASE64_RE.test(data)) {
    return 'data must be a base64 string'
  }
  if (data.length * 0.75 > MAX_BYTES) return 'document exceeds the 12 MB limit'
  const head = Buffer.from(data.slice(0, 24), 'base64')
  if (head.length < 12 || !SIGNATURES[mediaType as MediaType](head)) {
    return `document content does not look like ${mediaType}`
  }
  return { media_type: mediaType as MediaType, data }
}

const SYSTEM_PROMPT =
  'You transcribe ERP "Invoices On Hold" reports (Oracle, SAP, and similar AP exports printed ' +
  'to PDF or image). Transcribe exactly what is printed — do not compute, correct, infer, or ' +
  'omit anything. Record one row per held invoice line with: supplier (the supplier/vendor ' +
  'name), invoice (invoice number), po (purchase order number), hold_reason (the hold name, ' +
  'reason, or code), comments (any buyer comment, note, or description printed for the row), ' +
  'amount_text (the amount on hold exactly as printed, without currency symbols), currency ' +
  '(the ISO code when printed), qty_invoiced_text and qty_received_text (quantities exactly as ' +
  'printed), hold_date_text (the hold or invoice date exactly as printed), and supplier_email ' +
  '(when printed). Also record report_total_text (the report\u2019s own printed grand total, if ' +
  'any) and notes (any printed report-level remark, verbatim). Use empty strings for anything ' +
  'not printed.'

const TOOL_NAME = 'record_holds_transcription'

const ROW_STRINGS = [
  'supplier',
  'invoice',
  'po',
  'hold_reason',
  'comments',
  'amount_text',
  'currency',
  'qty_invoiced_text',
  'qty_received_text',
  'hold_date_text',
  'supplier_email',
] as const

const SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: Object.fromEntries(ROW_STRINGS.map((f) => [f, { type: 'string' }])),
        required: [...ROW_STRINGS],
      },
    },
    report_total_text: { type: 'string', description: 'the printed grand total, exactly as printed' },
    notes: { type: 'string' },
  },
  required: ['rows', 'report_total_text', 'notes'],
}

interface ContentBlock {
  type: string
  name?: string
  input?: unknown
}

async function transcribe(document: HoldsDocument): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('not configured on this deployment (no ANTHROPIC_API_KEY)')
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': API_VERSION,
  }
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID
  if (workspaceId) headers['anthropic-workspace-id'] = workspaceId
  const source = { type: 'base64', media_type: document.media_type, data: document.data }
  const block = document.media_type === 'application/pdf' ? { type: 'document', source } : { type: 'image', source }
  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      temperature: 0,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: TOOL_NAME,
          description: 'Record the exact transcription of the invoices-on-hold report.',
          input_schema: SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [
        {
          role: 'user',
          content: [block, { type: 'text', text: `Transcribe this report using the ${TOOL_NAME} tool.` }],
        },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`anthropic API error ${response.status}: ${await response.text()}`)
  }
  const data = (await response.json()) as { content?: ContentBlock[] }
  const toolUse = (data.content ?? []).find((b) => b.type === 'tool_use' && b.name === TOOL_NAME)
  if (!toolUse) throw new Error('anthropic response contained no tool call')
  return toolUse.input
}

function validateResult(raw: unknown): HoldsExtractSuccess | string {
  const x = (raw ?? {}) as Record<string, unknown>
  if (typeof x.report_total_text !== 'string' || typeof x.notes !== 'string') {
    return 'model returned a malformed transcription'
  }
  if (
    !Array.isArray(x.rows) ||
    !x.rows.every((r) => {
      const row = (r ?? {}) as Record<string, unknown>
      return ROW_STRINGS.every((f) => typeof row[f] === 'string')
    })
  ) {
    return 'model returned malformed rows'
  }
  if (x.rows.length === 0) return 'no hold rows could be read from the document'
  return {
    ok: true,
    rows: x.rows as HoldRowExtract[],
    report_total_text: x.report_total_text,
    notes: x.notes,
  }
}

export async function handleHoldsExtract(
  payload: unknown,
  authHeader?: string,
): Promise<HoldsExtractResponse> {
  const denied = await authError(authHeader, 'read PDF on-hold reports with AI')
  if (denied) return reject(401, 'unauthorized', denied)
  const unpaid = await billingError(authHeader)
  if (unpaid) return reject(402, 'payment_required', unpaid)

  const document = parseDocument(payload)
  if (typeof document === 'string') return reject(400, 'bad_request', document)

  const mock = process.env.TIEOUT_MOCK_HOLDS_EXTRACT
  let raw: unknown
  if (mock) {
    try {
      raw = JSON.parse(mock)
    } catch (e) {
      return reject(500, 'server_error', `TIEOUT_MOCK_HOLDS_EXTRACT is not valid JSON: ${String(e)}`)
    }
  } else {
    try {
      raw = await transcribe(document)
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      return reject(detail.includes('not configured') ? 503 : 502, 'server_error', detail)
    }
  }

  const result = validateResult(raw)
  if (typeof result === 'string') return reject(502, 'server_error', result)
  return { status: 200, body: result }
}
