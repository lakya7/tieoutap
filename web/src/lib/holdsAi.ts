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

export type HoldsExtractResult =
  | { ok: true; rows: HoldRowExtract[]; report_total_text: string; notes: string }
  | AiError

/** Posts a PDF/image on-hold report for transcription into hold rows. */
export async function requestHoldsExtract(file: File, mediaType: string): Promise<HoldsExtractResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (supabase) {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    if (token) headers['authorization'] = `Bearer ${token}`
  }
  let response: Response
  try {
    response = await fetch('/api/holds-extract', {
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
  return body as HoldsExtractResult
}

const HOLDS_CSV_HEADER =
  'supplier,invoice,po,hold reason,comments,amount,currency,qty invoiced,qty received,hold date,supplier email'

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

function isoDate(year: string, month: string, day: string): string | null {
  const y = year.length === 2 ? `20${year}` : year
  const m = Number(month)
  const d = Number(day)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Deterministically rewrites a printed hold date into the ISO form the holds
 * parser reads, covering the formats ERP reports print (`20-SEP-2026`,
 * `2026/09/20`, `Sep 20, 2026`, and numeric dates like `09/20/2026` when the
 * day makes month/day order unambiguous). Anything ambiguous or unrecognised
 * passes through as printed. */
export function normaliseHoldDate(raw: string): string {
  const s = raw.trim()
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) return isoDate(m[1], m[2], m[3]) ?? s
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ,]+(\d{2}(?:\d{2})?)$/)
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (month) return isoDate(m[3], month, m[1]) ?? s
  }
  m = s.match(/^([A-Za-z]{3,9})[. ]+(\d{1,2}),?\s+(\d{2}(?:\d{2})?)$/)
  if (m) {
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()]
    if (month) return isoDate(m[3], month, m[2]) ?? s
  }
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a > 12 && b <= 12) return isoDate(m[3], m[2], m[1]) ?? s
    if (b > 12 && a <= 12) return isoDate(m[3], m[1], m[2]) ?? s
  }
  return s
}

function csvField(field: string): string {
  return /[",\n\r]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field
}

/** Extracted rows -> the on-hold CSV format parseHoldsReport reads, so the
 * deterministic classification/grouping pipeline is unchanged. */
export function extractedRowsToHoldsCsv(rows: HoldRowExtract[]): string {
  const lines = rows.map((r) =>
    [
      r.supplier,
      r.invoice,
      r.po,
      r.hold_reason,
      r.comments,
      r.amount_text,
      r.currency,
      r.qty_invoiced_text,
      r.qty_received_text,
      normaliseHoldDate(r.hold_date_text),
      r.supplier_email,
    ]
      .map(csvField)
      .join(','),
  )
  return [HOLDS_CSV_HEADER, ...lines, ''].join('\n')
}

/** Total quantity the proof shows shipped for this invoice/PO: sums the
 * lines whose reference matches the invoice or PO. When no line carries a
 * matching reference, all lines are summed only if the document itself
 * references the invoice or PO; otherwise the proof cannot be tied to this
 * invoice and null is returned for the buyer to compare manually. */
export function proofQuantityFor(
  result: Extract<ProofReadResult, { ok: true }>,
  invoice: string,
  po: string,
): number | null {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '')
  const targets = [norm(invoice), norm(po)].filter((t) => t.length >= 3)
  const matches = (raw: string): boolean => {
    const r = norm(raw)
    return r !== '' && targets.some((t) => r.includes(t) || t.includes(r))
  }
  const qty = (text: string): number | null => {
    const m = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/)
    return m ? Number(m[0]) : null
  }
  const matching = result.lines.filter((l) => matches(l.reference))
  let pool = matching
  if (pool.length === 0) {
    if (!result.references.some(matches)) return null
    pool = result.lines
  }
  const quantities = pool.map((l) => qty(l.quantity_text)).filter((q): q is number => q !== null)
  if (quantities.length === 0) return null
  return quantities.reduce((total, q) => total + q, 0)
}
