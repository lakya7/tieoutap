/** AI findings summary: turns a finished deterministic run's findings and
 * bridge into a plain-English narrative and a better-worded supplier email.
 * Only the findings (types, references, formatted amounts) and bridge labels
 * reach the server — never the uploaded files. The numbers themselves are
 * produced by the engine; the model only words them. */
import { anthropicToolCall, authError, reject } from './ai.js'
import type { ApiResponse } from './ai.js'

export interface SummarizeRequest {
  supplier: string
  as_at: string
  statement_total: string
  ledger_open_total: string
  gap: string
  ties_out: boolean
  findings: { type: string; bucket: string; refs: string; amount: string }[]
  bridge: string[]
}

export interface SummarizeSuccess {
  ok: true
  narrative: string
  email: string
}

export type SummarizeResponse = ApiResponse<SummarizeSuccess>

const MAX_FINDINGS = 300
const MAX_CHARS = 400

function parsePayload(payload: unknown): SummarizeRequest | string {
  if (typeof payload !== 'object' || payload === null) return 'body must be a JSON object'
  const p = payload as Record<string, unknown>
  const shortString = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_CHARS
  if (!shortString(p.supplier) || !shortString(p.as_at)) return 'supplier and as_at must be short strings'
  if (!shortString(p.statement_total) || !shortString(p.ledger_open_total) || !shortString(p.gap)) {
    return 'statement_total, ledger_open_total and gap must be short strings'
  }
  if (typeof p.ties_out !== 'boolean') return 'ties_out must be a boolean'
  if (
    !Array.isArray(p.findings) ||
    p.findings.length > MAX_FINDINGS ||
    !p.findings.every((f) => {
      const x = (f ?? {}) as Record<string, unknown>
      return shortString(x.type) && shortString(x.bucket) && shortString(x.refs) && shortString(x.amount)
    })
  ) {
    return `findings must be at most ${MAX_FINDINGS} entries of short strings`
  }
  if (!Array.isArray(p.bridge) || p.bridge.length > MAX_FINDINGS || !p.bridge.every(shortString)) {
    return 'bridge must be a list of short strings'
  }
  return p as unknown as SummarizeRequest
}

function validateResult(raw: unknown): SummarizeSuccess | string {
  const { narrative, email } = (raw ?? {}) as Record<string, unknown>
  if (typeof narrative !== 'string' || narrative.trim() === '') return 'model returned no narrative'
  if (typeof email !== 'string' || email.trim() === '') return 'model returned no email'
  return { ok: true, narrative: narrative.trim(), email: email.trim() }
}

export async function handleSummarize(
  payload: unknown,
  authHeader?: string,
): Promise<SummarizeResponse> {
  const denied = await authError(authHeader, 'generate AI summaries')
  if (denied) return reject(401, 'unauthorized', denied)

  const request = parsePayload(payload)
  if (typeof request === 'string') return reject(400, 'bad_request', request)

  const mock = process.env.TIEOUT_MOCK_SUMMARY
  let raw: unknown
  if (mock) {
    try {
      raw = JSON.parse(mock)
    } catch (e) {
      return reject(500, 'server_error', `TIEOUT_MOCK_SUMMARY is not valid JSON: ${String(e)}`)
    }
  } else {
    try {
      raw = await anthropicToolCall({
        system:
          'You write plain-English summaries of supplier statement reconciliations for ' +
          'accounts-payable teams. Use ONLY the figures given — never compute, estimate, ' +
          'or invent amounts, references, or dates. The narrative should explain in a few ' +
          'short paragraphs why the balances differ and what to do next, leading with the ' +
          'largest items. The email is a courteous, concise message to the supplier ' +
          'covering every query that needs their answer; it must be ready to send after ' +
          'the sender adds their name, and must not promise payment or admit liability.',
        user: JSON.stringify(request),
        toolName: 'write_summary',
        toolDescription: 'Record the reconciliation narrative and the supplier email draft.',
        schema: {
          type: 'object',
          properties: {
            narrative: {
              type: 'string',
              description: 'plain-English explanation of the reconciliation outcome',
            },
            email: {
              type: 'string',
              description: 'complete supplier email including a Subject: line',
            },
          },
          required: ['narrative', 'email'],
        },
      })
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      return reject(detail.includes('not configured') ? 503 : 502, 'server_error', detail)
    }
  }

  const result = validateResult(raw)
  if (typeof result === 'string') return reject(502, 'server_error', result)
  return { status: 200, body: result }
}
