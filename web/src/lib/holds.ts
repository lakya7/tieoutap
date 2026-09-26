/** Invoices-on-hold workbench: parses an ERP "Invoices On Hold" report,
 * classifies each hold from its hold reason and buyer comments, groups the
 * queue supplier-wise, and builds the deterministic email drafts. Everything
 * here runs in the browser; AI only words the advisory read (see holdsAi.ts).
 * All amounts are integer cents. */
import { formatCentsGrouped, parseAmount, parseCsv } from '../../../ts/src'

export type HoldCategory = 'quantity' | 'price' | 'tax' | 'admin' | 'other'

export const CATEGORY_LABELS: Record<HoldCategory, string> = {
  quantity: 'Quantity hold',
  price: 'Price hold',
  tax: 'Tax hold',
  admin: 'Administrative hold',
  other: 'Other hold',
}

/** Whose action the hold most likely needs, judged only from the hold reason
 * keywords. The buyer always takes the final call. */
export const CATEGORY_AUDIENCE: Record<HoldCategory, 'supplier' | 'internal'> = {
  quantity: 'supplier',
  price: 'supplier',
  tax: 'supplier',
  admin: 'internal',
  other: 'supplier',
}

export interface HoldInvoice {
  /** Stable identity within a report: supplier + invoice, normalised. */
  key: string
  supplier: string
  invoice: string
  po: string
  holdReason: string
  comments: string
  /** Amount on hold in cents; null when the report has no amount column or
   * the cell could not be parsed. */
  amount: number | null
  currency: string
  qtyInvoiced: number | null
  qtyReceived: number | null
  /** ISO date the hold was placed (or the invoice date), '' when absent. */
  holdDate: string
  supplierEmail: string
  category: HoldCategory
}

export interface SupplierHolds {
  supplier: string
  email: string
  invoices: HoldInvoice[]
  /** Sum of the known amounts on hold, in cents. */
  total: number
  /** Whether any hold looks like it needs the supplier's action. */
  needsSupplier: boolean
}

export interface HoldsReport {
  /** Stable identity for status/activity storage: derived from the content. */
  id: string
  fileName: string
  loadedAt: string
  suppliers: SupplierHolds[]
  invoiceCount: number
  /** Sum of all known amounts on hold, in cents. */
  total: number
  currencies: string[]
}

const HEADER_ALIASES: Record<string, string[]> = {
  supplier: ['supplier', 'suppliername', 'vendor', 'vendorname', 'tradingpartner'],
  invoice: ['invoice', 'invoicenumber', 'invoicenum', 'invoiceno', 'invoiceid', 'docnumber', 'documentnumber'],
  po: ['po', 'ponumber', 'ponum', 'purchaseorder', 'purchaseordernumber', 'poref'],
  holdReason: ['holdreason', 'hold', 'holdname', 'holdtype', 'holdcode', 'reason', 'holdlookupcode'],
  comments: ['comments', 'comment', 'buyercomments', 'notes', 'note', 'remarks', 'holdcomments', 'description'],
  amount: ['amount', 'amountonhold', 'holdamount', 'invoiceamount', 'grossamount', 'total', 'invoicetotal'],
  currency: ['currency', 'curr', 'currencycode', 'invoicecurrency'],
  qtyInvoiced: ['qtyinvoiced', 'quantityinvoiced', 'invoicedqty', 'invoiceqty', 'billedqty', 'qtybilled'],
  qtyReceived: ['qtyreceived', 'quantityreceived', 'receivedqty', 'receiptqty', 'qtydelivered'],
  holdDate: ['holddate', 'holdplaceddate', 'dateplaced', 'invoicedate', 'date'],
  supplierEmail: ['supplieremail', 'vendoremail', 'email', 'contactemail', 'supplercontact'],
}

const REQUIRED_FIELDS = ['supplier', 'invoice', 'holdReason'] as const

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Maps this report's headers onto the fields above; each field takes the
 * first header whose normalised form matches one of its aliases. */
function mapHeaders(headers: string[]): Partial<Record<keyof typeof HEADER_ALIASES, string>> {
  const mapping: Partial<Record<keyof typeof HEADER_ALIASES, string>> = {}
  const taken = new Set<string>()
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const header = headers.find((h) => !taken.has(h) && normHeader(h) === alias)
      if (header !== undefined) {
        mapping[field as keyof typeof HEADER_ALIASES] = header
        taken.add(header)
        break
      }
    }
  }
  return mapping
}

const QUANTITY_WORDS = ['qty', 'quantity', 'short', 'receipt', 'received', 'receiving', 'grn', 'shipment', 'shipped']
const PRICE_WORDS = ['price', 'rate', 'cost', 'freight', 'overcharge', 'ppv']
const TAX_WORDS = ['tax', 'vat', 'gst', 'hst', 'withholding']
const ADMIN_WORDS = [
  'approval', 'approver', 'budget', 'duplicate', 'admin', 'validation', 'dist',
  'accounting', 'nopo', 'missingpo', 'invalidpo', 'matchrequired', 'site', 'supplierhold',
  'compliance', 'w9', 'w8', 'insurance', 'certificate',
]
/** Phrases meaning the goods arrived but our own receiving hasn't posted them
 * — an internal action, even when the hold reason itself mentions quantity. */
const RECEIPT_PENDING_WORDS = ['notposted', 'notyetposted', 'unposted', 'missingreceipt', 'awaitingreceipt']

/** Classifies one hold from its hold-reason text (comments break the tie for
 * otherwise-unrecognised reasons, and flag unposted receipts as internal).
 * Pure keyword matching — no AI. */
export function classifyHold(holdReason: string, comments: string): HoldCategory {
  const reason = normHeader(holdReason)
  const combined = normHeader(holdReason + ' ' + comments)
  const inReason = (words: string[]) => words.some((w) => reason.includes(w))
  if (RECEIPT_PENDING_WORDS.some((w) => combined.includes(w))) return 'admin'
  if (inReason(ADMIN_WORDS)) return 'admin'
  if (inReason(QUANTITY_WORDS)) return 'quantity'
  if (inReason(PRICE_WORDS)) return 'price'
  if (inReason(TAX_WORDS)) return 'tax'
  const inBoth = (words: string[]) => words.some((w) => combined.includes(w))
  if (inBoth(ADMIN_WORDS)) return 'admin'
  if (inBoth(QUANTITY_WORDS)) return 'quantity'
  if (inBoth(PRICE_WORDS)) return 'price'
  if (inBoth(TAX_WORDS)) return 'tax'
  return 'other'
}

function parseOptionalAmount(raw: string): number | null {
  const s = raw.trim().replace(/[()]/g, (c) => (c === '(' ? '-' : ''))
  if (s === '') return null
  try {
    return parseAmount(s)
  } catch {
    return null
  }
}

function parseOptionalQty(raw: string): number | null {
  const s = raw.trim().replace(/,/g, '')
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return null
  return Number(s)
}

function parseOptionalDate(raw: string): string {
  const s = raw.trim()
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''
}

/** Cheap deterministic content hash so statuses survive re-uploading the
 * same report (djb2 over the normalised rows). */
function contentId(rows: string[]): string {
  let h = 5381
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) h = ((h << 5) + h + row.charCodeAt(i)) | 0
  }
  return `HR-${(h >>> 0).toString(36).toUpperCase()}`
}

export function invoiceKey(supplier: string, invoice: string): string {
  return `${supplier.trim().toUpperCase()}\u0001${invoice.trim().toUpperCase()}`
}

/** Parses an Invoices On Hold report from normalised CSV text. Throws with a
 * message naming the missing columns when the header row doesn't carry the
 * minimum fields (supplier, invoice, hold reason). */
export function parseHoldsReport(csv: string, fileName: string): HoldsReport {
  const rows = parseCsv(csv)
  if (rows.length === 0) throw new Error('the report has no data rows')
  const headers = Object.keys(rows[0])
  const mapping = mapHeaders(headers)
  const missing = REQUIRED_FIELDS.filter((f) => mapping[f] === undefined)
  if (missing.length > 0) {
    const names: Record<string, string> = { supplier: 'supplier', invoice: 'invoice number', holdReason: 'hold reason' }
    throw new Error(
      `could not find ${missing.map((f) => names[f]).join(', ')} column(s) in the report header — ` +
        `found: ${headers.join(', ')}`,
    )
  }
  const cell = (row: Record<string, string>, field: keyof typeof HEADER_ALIASES): string => {
    const header = mapping[field]
    return header === undefined ? '' : (row[header] ?? '').trim()
  }

  const invoices: HoldInvoice[] = []
  const keyCounts = new Map<string, number>()
  for (const row of rows) {
    const supplier = cell(row, 'supplier')
    const invoice = cell(row, 'invoice')
    if (supplier === '' && invoice === '') continue
    const holdReason = cell(row, 'holdReason')
    const comments = cell(row, 'comments')
    const base = invoiceKey(supplier, invoice)
    const seq = keyCounts.get(base) ?? 0
    keyCounts.set(base, seq + 1)
    invoices.push({
      key: seq === 0 ? base : `${base}\u0001${seq}`,
      supplier,
      invoice,
      po: cell(row, 'po'),
      holdReason,
      comments,
      amount: parseOptionalAmount(cell(row, 'amount')),
      currency: cell(row, 'currency'),
      qtyInvoiced: parseOptionalQty(cell(row, 'qtyInvoiced')),
      qtyReceived: parseOptionalQty(cell(row, 'qtyReceived')),
      holdDate: parseOptionalDate(cell(row, 'holdDate')),
      supplierEmail: cell(row, 'supplierEmail'),
      category: classifyHold(holdReason, comments),
    })
  }
  if (invoices.length === 0) throw new Error('the report has no invoice rows')

  const bySupplier = new Map<string, HoldInvoice[]>()
  for (const inv of invoices) {
    const name = inv.supplier === '' ? '(no supplier)' : inv.supplier
    const list = bySupplier.get(name)
    if (list) list.push(inv)
    else bySupplier.set(name, [inv])
  }
  const suppliers: SupplierHolds[] = [...bySupplier.entries()]
    .map(([supplier, list]) => ({
      supplier,
      email: list.find((i) => i.supplierEmail !== '')?.supplierEmail ?? '',
      invoices: list,
      total: list.reduce((sum, i) => sum + (i.amount ?? 0), 0),
      needsSupplier: list.some((i) => CATEGORY_AUDIENCE[i.category] === 'supplier'),
    }))
    .sort((a, b) => b.total - a.total || a.supplier.localeCompare(b.supplier))

  return {
    id: contentId(
      invoices.map(
        (i) =>
          `${i.key}|${i.po}|${i.holdReason}|${i.comments}|${i.amount ?? ''}|` +
          `${i.qtyInvoiced ?? ''}|${i.qtyReceived ?? ''}|${i.holdDate}`,
      ),
    ),
    fileName,
    loadedAt: new Date().toISOString(),
    suppliers,
    invoiceCount: invoices.length,
    total: invoices.reduce((sum, i) => sum + (i.amount ?? 0), 0),
    currencies: [...new Set(invoices.map((i) => i.currency).filter((c) => c !== ''))],
  }
}

/** Whole days between an ISO date and today (local), null when unknown. */
export function daysSince(isoDate: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const then = new Date(`${isoDate}T00:00:00`)
  const days = Math.floor((today.getTime() - then.getTime()) / 86_400_000)
  return Number.isFinite(days) ? Math.max(0, days) : null
}

export interface AgeBucketRow {
  bucket: string
  count: number
  total: number
}

const AGE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '0–7 days', min: 0, max: 7 },
  { label: '8–14 days', min: 8, max: 14 },
  { label: '15–30 days', min: 15, max: 30 },
  { label: 'Over 30 days', min: 31, max: Infinity },
]

/** Count and value on hold per age bucket (needs a hold-date column; rows
 * without one land in "No hold date"). */
export function agingSummary(report: HoldsReport, today = new Date()): AgeBucketRow[] {
  const rows = AGE_BUCKETS.map((b) => ({ bucket: b.label, count: 0, total: 0 }))
  const unknown = { bucket: 'No hold date', count: 0, total: 0 }
  for (const s of report.suppliers) {
    for (const inv of s.invoices) {
      const age = daysSince(inv.holdDate, today)
      const row = age === null ? unknown : rows[AGE_BUCKETS.findIndex((b) => age >= b.min && age <= b.max)]
      row.count++
      row.total += inv.amount ?? 0
    }
  }
  return [...rows, unknown].filter((r) => r.count > 0)
}

/** Count and value on hold per hold category. */
export function categorySummary(report: HoldsReport): { category: HoldCategory; count: number; total: number }[] {
  const map = new Map<HoldCategory, { count: number; total: number }>()
  for (const s of report.suppliers) {
    for (const inv of s.invoices) {
      const entry = map.get(inv.category) ?? { count: 0, total: 0 }
      entry.count++
      entry.total += inv.amount ?? 0
      map.set(inv.category, entry)
    }
  }
  return [...map.entries()]
    .map(([category, { count, total }]) => ({ category, count, total }))
    .sort((a, b) => b.total - a.total || b.count - a.count)
}

function money(inv: HoldInvoice): string {
  if (inv.amount === null) return ''
  const cur = inv.currency !== '' ? ` ${inv.currency}` : ''
  return ` — ${formatCentsGrouped(inv.amount)}${cur} on hold`
}

function invoiceLine(inv: HoldInvoice): string {
  const po = inv.po !== '' ? ` (${inv.po})` : ''
  const note = inv.comments !== '' ? `\n    ${inv.comments}` : ''
  return `  ${inv.invoice}${po}${money(inv)}${note}`
}

/** The deterministic supplier email draft: grouped by hold type, built only
 * from the report's own values. AI may reword it; the buyer sends it. */
export function supplierEmailDraft(s: SupplierHolds): string {
  const groups: Record<HoldCategory, HoldInvoice[]> = { quantity: [], price: [], tax: [], admin: [], other: [] }
  for (const inv of s.invoices) groups[inv.category].push(inv)
  const actionable = s.invoices.filter((i) => CATEGORY_AUDIENCE[i.category] === 'supplier')
  let body =
    `Subject: ${actionable.length} invoice(s) on hold — information needed to release payment\n\n` +
    `Dear ${s.supplier} accounts team,\n\n` +
    `The following invoices are currently on hold in our system. To release them for payment we need the items below.\n\n`
  if (groups.quantity.length > 0) {
    body +=
      `QUANTITY DIFFERENCES\n${groups.quantity.map(invoiceLine).join('\n')}\n\n` +
      `Please send the related proof documents that confirm the full ordered quantity was shipped ` +
      `(delivery confirmation, carrier record, or equivalent). If only a partial quantity was shipped, ` +
      `please confirm the quantity actually shipped and issue a credit note or corrected invoice for the ` +
      `undelivered units so we can process payment for the quantity received.\n\n`
  }
  if (groups.price.length > 0) {
    body +=
      `PRICE DIFFERENCES\n${groups.price.map(invoiceLine).join('\n')}\n\n` +
      `Please share the agreed price basis for the above, or issue a corrected invoice at the purchase-order price.\n\n`
  }
  if (groups.tax.length > 0) {
    body +=
      `TAX DIFFERENCES\n${groups.tax.map(invoiceLine).join('\n')}\n\n` +
      `Please confirm the tax treatment applied to the above, or issue a corrected invoice with the agreed tax.\n\n`
  }
  if (groups.other.length > 0) {
    body +=
      `OTHER QUERIES\n${groups.other.map(invoiceLine).join('\n')}\n\n` +
      `Please review the notes above and send any documents that resolve them.\n\n`
  }
  body +=
    `Once we receive the above we will progress each invoice for payment.\n\n` +
    `Kind regards,\n`
  return body
}

/** Internal-action draft for holds your own team resolves (administrative
 * holds, or quantity holds once proof supports the full shipment). */
export function internalActionDraft(s: SupplierHolds): string {
  const internal = s.invoices.filter((i) => CATEGORY_AUDIENCE[i.category] === 'internal')
  if (internal.length === 0) return ''
  return (
    `Subject: Internal action needed — ${internal.length} invoice(s) on hold for ${s.supplier}\n\n` +
    `Team,\n\n` +
    `The following ${s.supplier} invoices are on holds that need our own action (not the supplier's):\n\n` +
    `${internal.map(invoiceLine).join('\n')}\n\n` +
    `Please action the above (approval, receipt posting, PO correction, or duplicate review as the notes indicate) ` +
    `so the holds can be released.\n\nThanks,\n`
  )
}

/** Follow-up draft referencing the original request. */
export function followUpDraft(s: SupplierHolds, sentDate: string, daysAgo: number): string {
  const open = s.invoices.filter((i) => CATEGORY_AUDIENCE[i.category] === 'supplier')
  return (
    `Subject: Follow-up — ${open.length} invoice(s) still on hold awaiting your reply\n\n` +
    `Dear ${s.supplier} accounts team,\n\n` +
    `On ${sentDate} (${daysAgo} day(s) ago) we asked for supporting information on the invoices below, ` +
    `which remain on hold:\n\n` +
    `${open.map(invoiceLine).join('\n')}\n\n` +
    `Could you send the requested documents or confirmation so we can release these for payment?\n\n` +
    `Kind regards,\n`
  )
}

export interface ProofComparison {
  verdict: 'supports_full' | 'supports_partial' | 'no_match'
  detail: string
}

/** Deterministic comparison of a proof document's shipped quantity against
 * the report's invoiced quantity for one invoice. The AI only transcribes
 * the quantity; this decides nothing beyond arithmetic. */
export function compareProofQuantity(inv: HoldInvoice, shippedQty: number): ProofComparison {
  if (inv.qtyInvoiced === null) {
    return {
      verdict: 'no_match',
      detail:
        `The proof shows ${shippedQty} shipped, but the report has no invoiced quantity for ${inv.invoice} — compare manually.`,
    }
  }
  if (shippedQty >= inv.qtyInvoiced) {
    return {
      verdict: 'supports_full',
      detail:
        `Proof supports the full invoiced quantity (${shippedQty} shipped vs ${inv.qtyInvoiced} invoiced). ` +
        `If your system still shows fewer received, ask receiving to post the missing receipt, then release the hold in your ERP.`,
    }
  }
  const undelivered = inv.qtyInvoiced - shippedQty
  return {
    verdict: 'supports_partial',
    detail:
      `Proof supports a partial shipment (${shippedQty} shipped vs ${inv.qtyInvoiced} invoiced — ${undelivered} undelivered). ` +
      `Request a credit note or corrected invoice for the ${undelivered} undelivered unit(s).`,
  }
}
