/** Deterministic structured narratives for each exception: what was found,
 * why the engine classified it this way, and the suggested next action.
 * All wording is templated per rule from the finding's own evidence — no AI
 * is involved, so the explanation is as auditable as the number. */
import { formatCentsGrouped } from '../../../ts/src'
import type { Finding, LedgerLine, StatementLine } from '../../../ts/src'
import type { Run } from './run'

export interface FindingNarrative {
  what: string
  why: string
  nextAction: string
}

function money(cents: number): string {
  return formatCentsGrouped(cents)
}

function first(refs: string[]): string {
  return refs[0] ?? 'this item'
}

function statementLines(run: Run, f: Finding): StatementLine[] {
  const byId = new Map(run.statement.map((l) => [l.id, l]))
  return f.statement_line_ids
    .map((id) => byId.get(id))
    .filter((l): l is StatementLine => l !== undefined)
}

function ledgerLines(run: Run, f: Finding): LedgerLine[] {
  const byId = new Map(run.ledger.map((l) => [l.id, l]))
  return f.ledger_line_ids
    .map((id) => byId.get(id))
    .filter((l): l is LedgerLine => l !== undefined)
}

/** The statement lines a finding points at, in the finding's own order. */
export function findingStatementLines(run: Run, f: Finding): StatementLine[] {
  return statementLines(run, f)
}

/** The ledger lines a finding points at. For duplicates this includes the
 * original the duplicate was compared against, so both rows are visible. */
export function findingLedgerLines(run: Run, f: Finding): LedgerLine[] {
  const lines = ledgerLines(run, f)
  const originalId = f.evidence['original_ledger_line_id']
  if (typeof originalId === 'string') {
    const original = run.ledger.find((l) => l.id === originalId)
    if (original && !lines.some((l) => l.id === original.id)) {
      return [original, ...lines]
    }
  }
  return lines
}

const SIGNAL_LABELS: Record<string, string> = {
  near_identical_refs: 'near-identical references',
  po_match: 'the same PO number',
  dates_within_tight_window: 'dates within a week of each other',
}

type Narrator = (run: Run, f: Finding) => FindingNarrative

const NARRATORS: Record<string, Narrator> = {
  UNRECORDED_LIABILITY: (run, f) => {
    const s = statementLines(run, f)
    return {
      what: `The supplier's statement shows ${first(s.map((l) => l.raw_ref))} for ${money(f.amount)}, and the AP ledger has no open item for it as at ${run.result.as_at}.`,
      why: 'Its reference matched nothing in the ledger, and it is dated before the timing cutoff — so it is a missing posting, not a document still in transit.',
      nextAction:
        'Request a copy invoice from the supplier, confirm the goods or services were received, and post it before relying on the ledger balance.',
    }
  },
  UNCLAIMED_CREDIT: (run, f) => {
    const s = statementLines(run, f)
    return {
      what: `The supplier's statement carries credit ${first(s.map((l) => l.raw_ref))} for ${money(f.amount)} that does not appear in the AP ledger.`,
      why: 'A negative statement line with no ledger counterpart is a credit the supplier has issued that has never been taken.',
      nextAction:
        'Verify the credit is valid, post the credit note to the ledger, and deduct it from the next payment run — this is money owed to you.',
    }
  },
  DUPLICATE: (_run, f) => {
    const originalRef = String(f.evidence['original_ref'] ?? 'the original')
    const duplicateRef = String(f.evidence['duplicate_ref'] ?? 'this item')
    const days = String(f.evidence['days_apart'] ?? '?')
    const signals = Array.isArray(f.evidence['signals'])
      ? (f.evidence['signals'] as string[]).map((sg) => SIGNAL_LABELS[sg] ?? sg)
      : []
    const corroboration =
      signals.length > 0 ? `, corroborated by ${signals.join(' and ')}` : ''
    return {
      what: `Ledger item ${duplicateRef} for ${money(f.amount)} repeats ${originalRef}: the same open amount, entered ${days} days apart.`,
      why: `Two ledger entries share the same open amount within the duplicate window${corroboration} — the later entry is flagged, the earlier kept as the original.`,
      nextAction:
        'Confirm only one invoice is genuine, then reverse or block the duplicate before the next payment run — paying both is an immediate cash loss.',
    }
  },
  PART_PAYMENT: (run, f) => {
    const s = statementLines(run, f)
    const original = f.evidence['ledger_original_amount']
    const open = f.evidence['ledger_open_amount']
    return {
      what: `The statement shows ${first(s.map((l) => l.raw_ref))} at its full amount ${typeof original === 'number' ? money(original) : ''}, while the ledger holds only ${typeof open === 'number' ? money(open) : 'a smaller amount'} open — a payment of ${money(f.amount)} has been applied on your side but not theirs.`,
      why: 'The statement amount equals the invoice\u2019s original amount and the ledger\u2019s open amount is lower, which is the signature of a partial payment the supplier has not yet allocated.',
      nextAction:
        'Send the supplier the remittance details for the payment so they can allocate it and restate the balance.',
    }
  },
  PAYMENT_NOT_APPLIED: (run, f) => {
    const l = ledgerLines(run, f)
    return {
      what: `Payment ${first(l.map((x) => x.raw_ref))} for ${money(f.amount)} is open in the AP ledger but does not appear on the supplier's statement.`,
      why: 'A payment-type ledger item with no statement counterpart means the supplier has not applied the payment to the account yet.',
      nextAction:
        'Send the supplier the remittance advice and ask them to confirm receipt and allocate the payment.',
    }
  },
  TIMING: (run, f) => {
    const s = statementLines(run, f)
    const docDate = String(f.evidence['doc_date'] ?? '')
    const cutoff = String(f.evidence['timing_cutoff'] ?? '')
    return {
      what: `${first(s.map((l) => l.raw_ref))} for ${money(f.amount)} is dated ${docDate} — inside the timing window ending ${run.result.as_at}.`,
      why: `The document is dated after the timing cutoff (${cutoff}), so it was most likely still in transit when the ledger export was taken.`,
      nextAction:
        'No action needed now — it should post in the next period. Re-run the reconciliation after month-end and investigate only if it is still outstanding.',
    }
  },
  AMOUNT_MISMATCH: (run, f) => {
    const s = statementLines(run, f)
    const sAmt = f.evidence['statement_amount']
    const lAmt = f.evidence['ledger_open_amount']
    return {
      what: `Both sides show ${first(s.map((l) => l.raw_ref))}, but at different values: ${typeof sAmt === 'number' ? money(sAmt) : 'the statement amount'} on the statement vs ${typeof lAmt === 'number' ? money(lAmt) : 'the open amount'} in the ledger — ${money(f.amount)} apart.`,
      why: 'The references agree but the amounts do not, and the statement amount does not equal the invoice\u2019s original amount, so this is not a partial payment.',
      nextAction:
        'Compare both sides against the physical invoice; correct whichever side keyed it wrongly, or request a credit note or supplementary invoice for the difference.',
    }
  },
  SUPPLIER_OMISSION: (run, f) => {
    const l = ledgerLines(run, f)
    return {
      what: `Ledger item ${first(l.map((x) => x.raw_ref))} for ${money(f.amount)} is open in the AP ledger but missing from the supplier's statement.`,
      why: 'A non-payment ledger item with no statement counterpart usually means the supplier has already cleared it, credited it, or left it off the statement.',
      nextAction:
        'Ask the supplier to confirm the item\u2019s status on their side — if they show it paid or credited, trace where the difference arose before adjusting.',
    }
  },
  CURRENCY_MISMATCH: (_run, f) => {
    const currencies = Array.isArray(f.evidence['currencies'])
      ? (f.evidence['currencies'] as string[]).join(' vs ')
      : 'different currencies'
    return {
      what: `The matched documents are stated in different currencies (${currencies}), for ${money(f.amount)} on the statement side.`,
      why: 'The engine never converts between currencies — a cross-currency pairing is always surfaced for a person to resolve rather than silently converted.',
      nextAction:
        'Reconcile this item manually in a single currency, checking the rate and date used on whichever side converted.',
    }
  },
}

/** The deterministic narrative for a finding; falls back to a generic
 * template for any classification without a bespoke one. */
export function findingNarrative(run: Run, f: Finding): FindingNarrative {
  const narrator = NARRATORS[f.type]
  if (narrator) return narrator(run, f)
  return {
    what: `A difference of ${money(f.amount)} was classified as ${f.type}.`,
    why: `Rule ${f.rule_id} classified this item from the evidence shown below.`,
    nextAction: 'Review the lines involved and the evidence below, then resolve manually.',
  }
}
