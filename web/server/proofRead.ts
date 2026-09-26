/** AI transcription of a supplier's proof document (delivery confirmation,
 * carrier record, packing list, ...): the model transcribes references and
 * shipped quantities exactly as printed — nothing else. Whether the proof
 * supports the invoiced quantity is decided deterministically in the browser
 * (compareProofQuantity), and the buyer takes the final call. */
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

interface ProofDocument {
  media_type: MediaType
  data: string
}

export interface ProofLine {
  reference: string
  description: string
  quantity_text: string
}

export interface ProofReadSuccess {
  ok: true
  document_type: string
  references: string[]
  lines: ProofLine[]
  notes: string
}

export type ProofReadResponse = ApiResponse<ProofReadSuccess>

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

function parseDocument(payload: unknown): ProofDocument | string {
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
  'You transcribe supplier shipping and delivery documents (delivery confirmations, carrier ' +
  'records, packing lists, proof-of-delivery notes). Transcribe exactly what is printed — do ' +
  'not compute, correct, infer, or omit anything. Record: document_type (what the document ' +
  'calls itself), references (every order, invoice, PO, or shipment number printed), lines ' +
  '(each item line with its reference, description, and quantity_text exactly as printed), ' +
  'and notes (any printed remark about shortages, partial shipment, or backorder, verbatim; ' +
  'empty string when none). Use empty strings for anything not printed.'

const TOOL_NAME = 'record_proof_transcription'

const SCHEMA = {
  type: 'object',
  properties: {
    document_type: { type: 'string' },
    references: { type: 'array', items: { type: 'string' } },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          reference: { type: 'string' },
          description: { type: 'string' },
          quantity_text: { type: 'string', description: 'the quantity exactly as printed' },
        },
        required: ['reference', 'description', 'quantity_text'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['document_type', 'references', 'lines', 'notes'],
}

interface ContentBlock {
  type: string
  name?: string
  input?: unknown
}

async function transcribe(document: ProofDocument): Promise<unknown> {
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
          description: 'Record the exact transcription of the shipping/delivery document.',
          input_schema: SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [
        {
          role: 'user',
          content: [block, { type: 'text', text: `Transcribe this document using the ${TOOL_NAME} tool.` }],
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

function validateResult(raw: unknown): ProofReadSuccess | string {
  const x = (raw ?? {}) as Record<string, unknown>
  if (typeof x.document_type !== 'string' || typeof x.notes !== 'string') return 'model returned a malformed transcription'
  if (!Array.isArray(x.references) || !x.references.every((r) => typeof r === 'string')) {
    return 'model returned malformed references'
  }
  if (
    !Array.isArray(x.lines) ||
    !x.lines.every((l) => {
      const i = (l ?? {}) as Record<string, unknown>
      return typeof i.reference === 'string' && typeof i.description === 'string' && typeof i.quantity_text === 'string'
    })
  ) {
    return 'model returned malformed lines'
  }
  return {
    ok: true,
    document_type: x.document_type,
    references: x.references as string[],
    lines: x.lines as ProofLine[],
    notes: x.notes,
  }
}

export async function handleProofRead(
  payload: unknown,
  authHeader?: string,
): Promise<ProofReadResponse> {
  const denied = await authError(authHeader, 'read proof documents with AI')
  if (denied) return reject(401, 'unauthorized', denied)
  const unpaid = await billingError(authHeader)
  if (unpaid) return reject(402, 'payment_required', unpaid)

  const document = parseDocument(payload)
  if (typeof document === 'string') return reject(400, 'bad_request', document)

  const mock = process.env.TIEOUT_MOCK_PROOF_READ
  let raw: unknown
  if (mock) {
    try {
      raw = JSON.parse(mock)
    } catch (e) {
      return reject(500, 'server_error', `TIEOUT_MOCK_PROOF_READ is not valid JSON: ${String(e)}`)
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
