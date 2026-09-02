/** Deterministic supplier email draft built from the reconciliation result.
 * Nothing is ever sent — this is copy-paste material for the AP clerk. */
import { formatCentsGrouped } from '../../../ts/src'
import type { Finding } from '../../../ts/src'
import type { Run } from './run'

function money(cents: number): string {
  return formatCentsGrouped(cents)
}

/** Resolve a finding's document references from its line ids. */
export function findingRefs(run: Run, f: Finding): string {
  const byId = new Map<string, string>()
  for (const l of run.statement) byId.set(l.id, l.raw_ref)
  for (const l of run.ledger) byId.set(l.id, l.raw_ref)
  const refs = [...f.statement_line_ids, ...f.ledger_line_ids]
    .map((id) => byId.get(id) ?? id)
  return [...new Set(refs)].join(', ')
}

const ITEM_BUILDERS: Record<string, (ref: string, f: Finding) => string> = {
  UNRECORDED_LIABILITY: (ref, f) =>
    `Your statement shows ${ref} for ${money(f.amount)} which we have no record of. Please send a copy of this invoice so we can verify and register it.`,
  UNCLAIMED_CREDIT: (ref, f) =>
    `Your statement shows a credit of ${money(f.amount)} (${ref}) that is not on our ledger. Please confirm this credit is available to us and send the credit note.`,
  AMOUNT_MISMATCH: (ref, f) =>
    `We show a different amount for ${ref} — a difference of ${money(f.amount)}. Please confirm the correct invoice amount.`,
  PART_PAYMENT: (ref, f) =>
    `We have part-paid ${ref} (${money(f.amount)} remaining unapplied on your side). Please confirm your allocation matches ours.`,
  PAYMENT_NOT_APPLIED: (ref, f) =>
    `Our payment of ${money(f.amount)} (${ref}) does not appear on your statement. Please confirm receipt and allocation.`,
  TIMING: (ref, f) =>
    `${ref} for ${money(f.amount)} appears to be a timing difference around the statement date. No action needed unless it persists on the next statement.`,
  SUPPLIER_OMISSION: (ref, f) =>
    `Our ledger shows ${ref} for ${money(f.amount)} which is missing from your statement. Please confirm it is still open on your side.`,
  CURRENCY_MISMATCH: (ref, f) =>
    `${ref} is stated in a different currency on your statement than on our ledger (${money(f.amount)}). Please confirm the invoice currency.`,
}

export function draftEmail(run: Run): string {
  const result = run.result
  const items = result.findings
    .filter((f) => f.type !== 'DUPLICATE')
    .slice()
    .sort((a, b) => b.amount - a.amount || a.rule_id.localeCompare(b.rule_id))
  const lines: string[] = []
  lines.push(`Subject: Statement reconciliation — ${result.supplier} as at ${result.as_at}`)
  lines.push('')
  lines.push('Hello,')
  lines.push('')
  lines.push(
    `We have reconciled your statement dated ${result.as_at} against our accounts payable ledger and have the following queries:`,
  )
  lines.push('')
  let n = 1
  for (const f of items) {
    const build = ITEM_BUILDERS[f.type]
    if (!build) continue
    lines.push(`${n}. ${build(findingRefs(run, f), f)}`)
    n += 1
  }
  if (n === 1) {
    lines.push('No queries — the statement reconciles to our ledger in full.')
  }
  lines.push('')
  lines.push('Could you please come back to us on the above so we can clear the remaining differences.')
  lines.push('')
  lines.push('Kind regards,')
  lines.push('Accounts Payable')
  return lines.join('\n')
}
