/** Optional AP-export passthrough fields: ERP context columns (due date,
 * AP status, holds, payment details, ...) that some ledger exports carry
 * beyond the engine's required columns. They are recognised by name, carried
 * through for display and export, and never touch matching, classification,
 * or the bridge — files without them work exactly as before. */
import { parseCsv } from '../../../ts/src'
import type { LedgerLine } from '../../../ts/src'

export interface FieldSpec {
  key: string
  label: string
  aliases: string[]
}

/** Recognised optional ledger columns, in display/export order. Aliases are
 * matched case-insensitively with punctuation collapsed to spaces. */
export const PASSTHROUGH_FIELDS: FieldSpec[] = [
  { key: 'ap_comment', label: 'AP status', aliases: ['ap comment', 'ap comments', 'ap status'] },
  { key: 'hold_reason', label: 'Hold reason', aliases: ['hold reason', 'hold reasons', 'holds'] },
  { key: 'invoice_payment_status', label: 'Invoice payment status', aliases: ['invoice payment status', 'paid status'] },
  { key: 'paid_amount', label: 'Paid amount', aliases: ['invoice paid amount', 'paid amount', 'amount paid'] },
  { key: 'discount_amount', label: 'Discount amount', aliases: ['discount amount', 'discount'] },
  { key: 'payment_number', label: 'Payment number', aliases: ['payment number', 'payment ref', 'payment reference', 'check number', 'cheque number'] },
  { key: 'payment_date', label: 'Payment date', aliases: ['payment date'] },
  { key: 'payment_status', label: 'Payment status', aliases: ['payment status'] },
  { key: 'payment_mode', label: 'Payment method', aliases: ['payment mode', 'payment method'] },
  { key: 'cleared_date', label: 'Cleared date', aliases: ['cleared date', 'clearing date'] },
  { key: 'due_date', label: 'Due date', aliases: ['due date'] },
  { key: 'due_date_status', label: 'Due date status', aliases: ['due date status', 'due status'] },
  { key: 'payment_terms', label: 'Payment terms', aliases: ['payment terms', 'terms'] },
  { key: 'validation_status', label: 'Validation status', aliases: ['validation status'] },
  { key: 'approval_status', label: 'Approval status', aliases: ['approval status'] },
  { key: 'coding_status', label: 'Account coding status', aliases: ['account coding status', 'coding status'] },
  { key: 'invoice_creation_date', label: 'Entered in ERP', aliases: ['invoice creation date', 'creation date', 'entered date', 'entry date'] },
  { key: 'invoice_type', label: 'Invoice type', aliases: ['invoice type'] },
  { key: 'invoice_source', label: 'Invoice source', aliases: ['invoice source', 'source'] },
  { key: 'invoice_id', label: 'ERP invoice ID', aliases: ['invoice id'] },
  { key: 'supplier_number', label: 'Supplier number', aliases: ['supplier number', 'supplier no', 'vendor number', 'vendor no'] },
]

const LABELS: Record<string, string> = Object.fromEntries(
  PASSTHROUGH_FIELDS.map((f) => [f.key, f.label]),
)

/** Display label for a passthrough field key. */
export function fieldLabel(key: string): string {
  return LABELS[key] ?? key
}

/** Values of the recognised optional fields for one ledger line, keyed by
 * field key; only non-empty values are stored. */
export type LedgerExtras = Record<string, string>

/** Extras for every ledger line, keyed by the line's engine id (L1, L2, ...). */
export type RunLedgerExtras = Record<string, LedgerExtras>

function normaliseHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const ALIAS_TO_KEY: Record<string, string> = Object.fromEntries(
  PASSTHROUGH_FIELDS.flatMap((f) => f.aliases.map((a) => [a, f.key])),
)

/** Reads the recognised optional columns out of the ledger CSV, keyed by the
 * same positional line ids the engine loader assigns. Unrecognised columns
 * are ignored; a file without any recognised column yields empty extras. */
export function parseLedgerExtras(ledgerCsv: string): RunLedgerExtras {
  const out: RunLedgerExtras = {}
  try {
    const rows = parseCsv(ledgerCsv)
    rows.forEach((row, i) => {
      const extras: LedgerExtras = {}
      for (const [header, value] of Object.entries(row)) {
        const key = ALIAS_TO_KEY[normaliseHeader(header)]
        if (key && value.trim() !== '') extras[key] = value.trim()
      }
      if (Object.keys(extras).length > 0) out[`L${i + 1}`] = extras
    })
  } catch {
    return {}
  }
  return out
}

/** The passthrough fields present anywhere in the run, in canonical order. */
export function presentFields(extras: RunLedgerExtras): FieldSpec[] {
  const seen = new Set<string>()
  for (const lineExtras of Object.values(extras)) {
    for (const key of Object.keys(lineExtras)) seen.add(key)
  }
  return PASSTHROUGH_FIELDS.filter((f) => seen.has(f.key))
}

export type ChipTone = 'alert' | 'warn' | 'info' | 'ok'

export interface Chip {
  label: string
  tone: ChipTone
}

function has(value: string | undefined, needle: string): boolean {
  return value !== undefined && value.toLowerCase().includes(needle)
}

/** Triage chips for the ledger lines a finding points at, derived only from
 * the AP export's own columns. */
export function ledgerChips(lines: LedgerLine[], extras: RunLedgerExtras): Chip[] {
  const chips: Chip[] = []
  const add = (label: string, tone: ChipTone) => {
    if (!chips.some((c) => c.label === label)) chips.push({ label, tone })
  }
  for (const line of lines) {
    const e = extras[line.id]
    if (!e) continue
    if (has(e.due_date_status, 'past due')) add('Past due', 'alert')
    if (e.hold_reason) add(`On hold: ${e.hold_reason}`, 'warn')
    if (e.ap_comment) add(e.ap_comment, 'info')
    if (has(e.invoice_payment_status, 'fully paid')) add('Fully paid in ERP', 'ok')
  }
  return chips
}

/** One deterministic context sentence per ledger line, assembled from the
 * line's own AP-export fields — shown in the evidence drawer and stamped into
 * exports. Empty when the export carried no recognised columns. */
export function ledgerContextNotes(
  lines: LedgerLine[],
  extras: RunLedgerExtras,
): string[] {
  const notes: string[] = []
  for (const line of lines) {
    const e = extras[line.id]
    if (!e) continue
    const parts: string[] = []
    if (e.ap_comment) parts.push(`AP status ${e.ap_comment}`)
    if (e.hold_reason) parts.push(`on hold (${e.hold_reason})`)
    if (e.invoice_payment_status) parts.push(e.invoice_payment_status.toLowerCase())
    if (e.paid_amount) parts.push(`paid ${e.paid_amount}`)
    if (e.discount_amount) parts.push(`discount ${e.discount_amount}`)
    if (e.payment_number || e.payment_date) {
      let p = 'payment'
      if (e.payment_number) p += ` ${e.payment_number}`
      if (e.payment_date) p += ` on ${e.payment_date}`
      if (e.payment_status) p += ` (${e.payment_status.toLowerCase()}${e.cleared_date ? ` ${e.cleared_date}` : ''})`
      else if (e.cleared_date) p += ` (cleared ${e.cleared_date})`
      if (e.payment_mode) p += ` by ${e.payment_mode}`
      parts.push(p)
    } else if (e.cleared_date) {
      parts.push(`cleared ${e.cleared_date}`)
    }
    if (e.due_date) {
      parts.push(`due ${e.due_date}${e.due_date_status ? ` (${e.due_date_status.toLowerCase()})` : ''}`)
    } else if (e.due_date_status) {
      parts.push(e.due_date_status.toLowerCase())
    }
    if (e.payment_terms) parts.push(`terms ${e.payment_terms}`)
    if (e.validation_status) parts.push(`validation ${e.validation_status.toLowerCase()}`)
    if (e.approval_status) parts.push(`approval ${e.approval_status.toLowerCase()}`)
    if (e.coding_status) parts.push(`coding ${e.coding_status.toLowerCase()}`)
    if (e.invoice_creation_date) parts.push(`entered ${e.invoice_creation_date}`)
    if (e.invoice_type) parts.push(`type ${e.invoice_type}`)
    if (parts.length > 0) notes.push(`${line.raw_ref}: ${parts.join('; ')}`)
  }
  return notes
}

/** A short remittance/status sentence for the supplier email, built from the
 * payment and status fields of a finding's ledger lines. Returns '' when the
 * export carries nothing worth telling the supplier. */
export function emailErpNote(lines: LedgerLine[], extras: RunLedgerExtras): string {
  for (const line of lines) {
    const e = extras[line.id]
    if (!e) continue
    if (e.payment_number || e.payment_date) {
      let note = 'Our payment reference is'
      if (e.payment_number) note += ` ${e.payment_number}`
      if (e.payment_date) note += `${e.payment_number ? ',' : ''} paid on ${e.payment_date}`
      if (e.cleared_date) note += `, cleared on ${e.cleared_date}`
      if (e.payment_mode) note += ` by ${e.payment_mode}`
      return note + '.'
    }
    if (has(e.invoice_payment_status, 'fully paid')) {
      return 'Our records show this invoice as fully paid.'
    }
    if (e.hold_reason) {
      return `This invoice is currently on hold on our side (${e.hold_reason}); we will release it once resolved.`
    }
    if (e.ap_comment) {
      return `Our AP system shows this as “${e.ap_comment}” on our side.`
    }
  }
  return ''
}
