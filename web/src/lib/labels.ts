/** Finance-friendly display names for the engine's classification codes, and
 * deterministic run/exception identifiers for referencing a run across the
 * screen and its exports. */
import type { Finding } from '../../../ts/src'
import type { Run } from './run'

const TYPE_LABELS: Record<string, string> = {
  UNRECORDED_LIABILITY: 'Supplier invoice missing from AP ledger',
  UNCLAIMED_CREDIT: 'Supplier credit not applied',
  DUPLICATE: 'Possible duplicate invoice',
  PART_PAYMENT: 'Partial payment applied',
  PAYMENT_NOT_APPLIED: 'Payment not applied by supplier',
  AMOUNT_MISMATCH: 'Invoice amount differs',
  TIMING: 'Timing difference',
  SUPPLIER_OMISSION: 'Ledger item missing from statement',
  CURRENCY_MISMATCH: 'Currency differs',
}

/** The business-language label for a finding type; falls back to the raw
 * classification code for any type without one. */
export function findingLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

/** Every classification code with a business-language label, for pickers. */
export const FINDING_TYPES: string[] = Object.keys(TYPE_LABELS)

/** Deterministic run identifier, e.g. TA-20260729-MERIDIAN-IND-SUPP: derived
 * from the as-at date and supplier, so re-running the same statement produces
 * the same identifier. */
export function runId(run: Run): string {
  const date = run.result.as_at.replace(/-/g, '') || 'UNDATED'
  const supplier =
    run.result.supplier
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 16)
      .replace(/-$/, '') || 'RUN'
  return `TA-${date}-${supplier}`
}

/** Stable exception identifier (E-001, E-002, ...) for a finding's position
 * in the deterministically sorted queue. */
export function exceptionId(index: number): string {
  return `E-${String(index + 1).padStart(3, '0')}`
}

/** Findings in the queue's display order: descending amount, then rule. */
export function orderedFindings(run: Run): Finding[] {
  return run.result.findings
    .slice()
    .sort((a, b) => b.amount - a.amount || a.rule_id.localeCompare(b.rule_id))
}
