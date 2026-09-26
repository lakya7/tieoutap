/** AI read of an Invoices On Hold report: for each supplier group the model
 * explains what the hold reasons and buyer comments mean, whether the
 * supplier's action is needed, and words a tailored email. Only the report's
 * text fields and pre-formatted amounts reach the model — every figure was
 * parsed and formatted deterministically in the browser, and the buyer
 * reviews everything before anything is sent. */
import { anthropicToolCall, authError, reject } from './ai.js'
import type { ApiResponse } from './ai.js'
import { billingError } from './billing.js'

export interface HoldsReadRequest {
  suppliers: {
    name: string
    invoices: {
      invoice: string
      po: string
      hold_reason: string
      comments: string
      amount: string
      qty_invoiced: string
      qty_received: string
    }[]
  }[]
}

export interface SupplierRead {
  supplier: string
  read: string
  needs_supplier_email: boolean
  email: string
}

export interface HoldsReadSuccess {
  ok: true
  reads: SupplierRead[]
}

export type HoldsReadResponse = ApiResponse<HoldsReadSuccess>

const MAX_SUPPLIERS = 40
const MAX_INVOICES = 200
const MAX_CHARS = 600

function parsePayload(payload: unknown): HoldsReadRequest | string {
  if (typeof payload !== 'object' || payload === null) return 'body must be a JSON object'
  const { suppliers } = payload as Record<string, unknown>
  if (!Array.isArray(suppliers) || suppliers.length === 0 || suppliers.length > MAX_SUPPLIERS) {
    return `suppliers must be 1–${MAX_SUPPLIERS} entries`
  }
  const shortString = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_CHARS
  let invoiceCount = 0
  for (const s of suppliers) {
    const x = (s ?? {}) as Record<string, unknown>
    if (!shortString(x.name) || !Array.isArray(x.invoices)) return 'each supplier needs a name and invoices'
    invoiceCount += x.invoices.length
    if (
      !x.invoices.every((inv) => {
        const i = (inv ?? {}) as Record<string, unknown>
        return (
          shortString(i.invoice) &&
          shortString(i.po) &&
          shortString(i.hold_reason) &&
          shortString(i.comments) &&
          shortString(i.amount) &&
          shortString(i.qty_invoiced) &&
          shortString(i.qty_received)
        )
      })
    ) {
      return 'each invoice must be short string fields'
    }
  }
  if (invoiceCount === 0 || invoiceCount > MAX_INVOICES) return `invoices must total 1–${MAX_INVOICES}`
  return { suppliers } as HoldsReadRequest
}

function validateResult(raw: unknown): HoldsReadSuccess | string {
  const { reads } = (raw ?? {}) as Record<string, unknown>
  if (!Array.isArray(reads) || reads.length === 0) return 'model returned no reads'
  const out: SupplierRead[] = []
  for (const r of reads) {
    const x = (r ?? {}) as Record<string, unknown>
    if (
      typeof x.supplier !== 'string' ||
      typeof x.read !== 'string' ||
      typeof x.needs_supplier_email !== 'boolean' ||
      typeof x.email !== 'string'
    ) {
      return 'model returned a malformed read'
    }
    out.push({
      supplier: x.supplier,
      read: x.read.trim(),
      needs_supplier_email: x.needs_supplier_email,
      email: x.email.trim(),
    })
  }
  return { ok: true, reads: out }
}

export async function handleHoldsRead(
  payload: unknown,
  authHeader?: string,
): Promise<HoldsReadResponse> {
  const denied = await authError(authHeader, 'read hold reports with AI')
  if (denied) return reject(401, 'unauthorized', denied)
  const unpaid = await billingError(authHeader)
  if (unpaid) return reject(402, 'payment_required', unpaid)

  const request = parsePayload(payload)
  if (typeof request === 'string') return reject(400, 'bad_request', request)

  const mock = process.env.TIEOUT_MOCK_HOLDS_READ
  let raw: unknown
  if (mock) {
    try {
      raw = JSON.parse(mock)
    } catch (e) {
      return reject(500, 'server_error', `TIEOUT_MOCK_HOLDS_READ is not valid JSON: ${String(e)}`)
    }
  } else {
    try {
      raw = await anthropicToolCall({
        system:
          'You help accounts-payable buyers work invoices that are on hold. For each supplier ' +
          'you are given the invoices on hold with their hold reason, the buyer\'s own comments, ' +
          'and pre-formatted amounts and quantities. For each supplier produce: (1) "read" — a ' +
          'short plain-English explanation of what each hold needs and who must act (the supplier, ' +
          'or the buyer\'s own team for internal matters like approvals, duplicates, or missing ' +
          'receipts); (2) "needs_supplier_email" — false when every hold is internal and emailing ' +
          'the supplier would not move anything forward; (3) "email" — when a supplier email helps, ' +
          'a complete courteous email with a Subject: line covering only the holds that need the ' +
          'supplier. For quantity differences ask for the related proof documents that confirm the ' +
          'full ordered quantity was shipped, and add that if only a partial quantity was shipped ' +
          'they should confirm it and issue a credit note or corrected invoice for the undelivered ' +
          'units. Never mention a specific document type as required (no "bill of lading"). Say ' +
          '"on hold", never "held". Use ONLY the figures, references, and dates given — never ' +
          'compute, estimate, or invent any. Do not promise payment or admit liability. When no ' +
          'email is needed, return an empty string for "email". Return one entry per supplier, in ' +
          'the order given.',
        user: JSON.stringify(request),
        toolName: 'record_holds_read',
        toolDescription: 'Record the per-supplier read and email drafts for the hold report.',
        schema: {
          type: 'object',
          properties: {
            reads: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  supplier: { type: 'string' },
                  read: { type: 'string', description: 'plain-English read of the holds and who must act' },
                  needs_supplier_email: { type: 'boolean' },
                  email: { type: 'string', description: 'complete supplier email with Subject: line, or empty' },
                },
                required: ['supplier', 'read', 'needs_supplier_email', 'email'],
              },
            },
          },
          required: ['reads'],
        },
        maxTokens: 8192,
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
