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
}

export interface Run {
  input: RunInput
  statement: StatementLine[]
  ledger: LedgerLine[]
  result: ReconcileResult
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
  return { input, statement, ledger, result }
}
