/** Client-side reconciliation run: parse both CSVs, derive defaults, and run
 * the deterministic engine entirely in the browser. */
import {
  DEFAULT_CONFIG,
  loadLedgerCsv,
  loadStatementCsv,
  reconcile,
} from '../../../ts/src'
import type { LedgerLine, ReconcileResult, StatementLine } from '../../../ts/src'

export interface RunInput {
  statementCsv: string
  ledgerCsv: string
  supplier: string
  asAt: string
  /** Original file names, when the run came from local uploads. Not encoded
   * into share links, so runs opened from a link have neither. */
  statementName?: string
  ledgerName?: string
}

export interface Run {
  input: RunInput
  statement: StatementLine[]
  ledger: LedgerLine[]
  result: ReconcileResult
  /** Sanity warnings about the inputs themselves (supplier name, currency,
   * cutoff date), computed alongside — never inside — the deterministic
   * engine. */
  inputWarnings: string[]
}

/** Supplier default: the most common supplier value in the ledger CSV. */
export function deriveSupplier(ledgerCsv: string): string {
  try {
    const counts = new Map<string, number>()
    for (const line of loadLedgerCsv(ledgerCsv)) {
      if (line.supplier) {
        counts.set(line.supplier, (counts.get(line.supplier) ?? 0) + 1)
      }
    }
    let best = ''
    let bestCount = 0
    for (const [supplier, count] of counts) {
      if (count > bestCount) {
        best = supplier
        bestCount = count
      }
    }
    return best
  } catch {
    return ''
  }
}

/** As-at default: the latest document date on the statement. */
export function deriveAsAt(statementCsv: string): string {
  try {
    const dates = loadStatementCsv(statementCsv).map((l) => l.doc_date)
    return dates.sort()[dates.length - 1] ?? ''
  } catch {
    return ''
  }
}

function checkInputs(
  input: RunInput,
  statement: StatementLine[],
  ledger: LedgerLine[],
): string[] {
  const warnings: string[] = []
  if (statement.length === 0) {
    warnings.push(
      'The statement file parsed to zero lines — it may be empty, truncated, or missing pages.',
    )
  }
  if (ledger.length === 0) {
    warnings.push(
      'The ledger file parsed to zero lines — it may be an empty or truncated export.',
    )
  }
  const supplierRows = ledger.filter((l) => l.supplier === input.supplier)
  if (ledger.length > 0 && supplierRows.length === 0) {
    const wanted = input.supplier.trim().toLowerCase()
    const near = ledger.find((l) => l.supplier.trim().toLowerCase() === wanted)
    warnings.push(
      near
        ? `No ledger rows exactly match supplier “${input.supplier}” — the ledger spells it “${near.supplier}”, so the run compared against zero ledger lines.`
        : `No ledger rows match supplier “${input.supplier}” — check the name against the ledger's supplier column; the run compared against zero ledger lines.`,
    )
  }
  const dates = statement
    .map((l) => l.doc_date)
    .filter((d) => d !== '')
    .sort()
  if (dates.length > 0 && input.asAt !== '' && input.asAt < dates[0]) {
    warnings.push(
      `The as-at date ${input.asAt} is earlier than every statement line (earliest ${dates[0]}) — check the cutoff date; differences may be cutoff artefacts.`,
    )
  }
  const stmtCurrencies = [...new Set(statement.map((l) => l.currency).filter((c) => c !== ''))]
  const ledgerCurrencies = [
    ...new Set(supplierRows.map((l) => l.currency).filter((c) => c !== '')),
  ]
  if (stmtCurrencies.length > 1) {
    warnings.push(
      `The statement mixes currencies (${stmtCurrencies.sort().join(', ')}) — its total combines unlike units.`,
    )
  }
  if (
    stmtCurrencies.length === 1 &&
    ledgerCurrencies.length === 1 &&
    stmtCurrencies[0] !== ledgerCurrencies[0]
  ) {
    warnings.push(
      `The statement is in ${stmtCurrencies[0]} but the ledger rows are in ${ledgerCurrencies[0]} — the two balances are not directly comparable.`,
    )
  }
  return warnings
}

export function executeRun(input: RunInput): Run {
  const statement = loadStatementCsv(input.statementCsv)
  const ledger = loadLedgerCsv(input.ledgerCsv)
  const result = reconcile(
    statement,
    ledger,
    input.supplier,
    input.asAt,
    DEFAULT_CONFIG,
    null,
  )
  return { input, statement, ledger, result, inputWarnings: checkInputs(input, statement, ledger) }
}
