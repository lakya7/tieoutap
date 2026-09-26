/** Browser side of the holds-workbench AI assists. The AI read posts only the
 * report's text fields and amounts already formatted deterministically here;
 * proof reading posts the document bytes and gets back a verbatim
 * transcription — whether the proof supports the invoice is decided by
 * compareProofQuantity in holds.ts, never by the model. */
import { formatCentsGrouped } from '../../../ts/src'
import { postJson } from './ai'
import type { AiError } from './ai'
import type { HoldsReport } from './holds'
import { supabase } from './supabase'

export interface SupplierRead {
  supplier: string
  read: string
  needs_supplier_email: boolean
  email: string
}

export type HoldsReadResult = { ok: true; reads: SupplierRead[] } | AiError

const MAX_FIELD = 600

function clip(s: string): string {
  return s.slice(0, MAX_FIELD)
}

/** Asks the server for the per-supplier AI read of the loaded report. */
export async function requestHoldsRead(report: HoldsReport): Promise<HoldsReadResult> {
  const body = await postJson('/api/holds-read', {
    suppliers: report.suppliers.map((s) => ({
      name: clip(s.supplier),
      invoices: s.invoices.map((inv) => ({
        invoice: clip(inv.invoice),
        po: clip(inv.po),
        hold_reason: clip(inv.holdReason),
        comments: clip(inv.comments),
        amount: inv.amount === null ? '' : `${formatCentsGrouped(inv.amount)}${inv.currency ? ` ${inv.currency}` : ''}`,
        qty_invoiced: inv.qtyInvoiced === null ? '' : String(inv.qtyInvoiced),
        qty_received: inv.qtyReceived === null ? '' : String(inv.qtyReceived),
      })),
    })),
  })
  if (typeof body === 'object' && body !== null && (body as HoldsReadResult).ok !== undefined) {
    return body as HoldsReadResult
  }
  return { ok: false, detail: 'unexpected server response' }
}

export interface ProofLine {
  reference: string
  description: string
  quantity_text: string
}

export type ProofReadResult =
  | { ok: true; document_type: string; references: string[]; lines: ProofLine[]; notes: string }
  | AiError

const PROOF_MEDIA_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

export function proofMediaType(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return PROOF_MEDIA_TYPES[ext] ?? null
}

function toBase64(bytes: ArrayBuffer): string {
  const chunk = 0x8000
  const view = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Posts a proof document for transcription. */
export async function requestProofRead(file: File, mediaType: string): Promise<ProofReadResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (supabase) {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    if (token) headers['authorization'] = `Bearer ${token}`
  }
  let response: Response
  try {
    response = await fetch('/api/proof-read', {
      method: 'POST',
      headers,
      body: JSON.stringify({ media_type: mediaType, data: toBase64(await file.arrayBuffer()) }),
    })
  } catch (e) {
    return { ok: false, detail: `could not reach the server: ${e instanceof Error ? e.message : String(e)}` }
  }
  const body = (await response.json().catch(() => ({}))) as { detail?: string; ok?: boolean }
  if (!response.ok) {
    return { ok: false, detail: body.detail ?? `request failed (HTTP ${response.status})` }
  }
  return body as ProofReadResult
}

/** Total quantity the proof shows shipped for this invoice/PO: sums the
 * lines whose reference matches the invoice or PO, falling back to all lines
 * when none match. Returns null when no line carries a parseable quantity. */
export function proofQuantityFor(
  result: Extract<ProofReadResult, { ok: true }>,
  invoice: string,
  po: string,
): number | null {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '')
  const targets = [norm(invoice), norm(po)].filter((t) => t.length >= 3)
  const qty = (text: string): number | null => {
    const m = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/)
    return m ? Number(m[0]) : null
  }
  const matching = result.lines.filter((l) => {
    const r = norm(l.reference)
    return r !== '' && targets.some((t) => r.includes(t) || t.includes(r))
  })
  const pool = matching.length > 0 ? matching : result.lines
  const quantities = pool.map((l) => qty(l.quantity_text)).filter((q): q is number => q !== null)
  if (quantities.length === 0) return null
  return quantities.reduce((total, q) => total + q, 0)
}
