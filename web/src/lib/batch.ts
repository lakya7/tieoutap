/** Batch reconciliation: many supplier statements against one AP open-items
 * export, entirely in the browser. Each statement becomes an ordinary
 * deterministic run against the supplier's rows in the shared ledger — batch
 * mode only decides which supplier each statement belongs to and collects the
 * per-supplier results. */
import { loadLedgerCsv, loadStatementCsv } from '../../../ts/src'
import { deriveAsAt, executeRun } from './run'
import type { Run } from './run'

export interface BatchStatement {
  /** Stable identity for this selection — filenames can repeat. */
  id: string
  name: string
  csv: string
}

/** The whole batch-mode working state, owned by App so it survives opening an
 * individual run and coming back to the summary. */
export interface BatchSession {
  statements: BatchStatement[]
  ledger: { name: string; text: string } | null
  items: BatchItem[] | null
}

export const EMPTY_BATCH: BatchSession = { statements: [], ledger: null, items: null }

export interface BatchItem {
  statement: BatchStatement
  /** Supplier the statement was reconciled against ('' when unidentified). */
  supplier: string
  asAt: string
  run: Run | null
  error: string | null
}

/** Parses the ledger export fully, returning the error message when it isn't
 * a valid AP open-items table (e.g. a statement-shaped file whose header check
 * passed but that lacks the ledger's amount columns). */
export function checkLedger(ledgerCsv: string): string | null {
  try {
    loadLedgerCsv(ledgerCsv)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

/** Distinct supplier names in the ledger export, in first-seen order. */
export function ledgerSuppliers(ledgerCsv: string): string[] {
  const seen = new Set<string>()
  const suppliers: string[] = []
  for (const line of loadLedgerCsv(ledgerCsv)) {
    if (line.supplier !== '' && !seen.has(line.supplier)) {
      seen.add(line.supplier)
      suppliers.push(line.supplier)
    }
  }
  return suppliers
}

function normRef(ref: string): string {
  return ref.toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

/** Whether two normalised references refer to the same document: equal, or
 * one is a suffix of the other (ledger refs often carry a supplier prefix,
 * e.g. CDW-INV-1001 vs INV-1001). Short refs must match exactly. */
function refsMatch(a: string, b: string): boolean {
  if (a === '' || b === '') return false
  if (a === b) return true
  if (a.length < 4 || b.length < 4) return false
  return a.endsWith(b) || b.endsWith(a)
}

/** Picks the ledger supplier whose document references overlap the statement's
 * the most. Deterministic: on zero overlap or a tie, returns null so the user
 * chooses instead of the tool guessing. */
export function identifySupplier(statementCsv: string, ledgerCsv: string): string | null {
  let statementRefs: string[]
  try {
    statementRefs = loadStatementCsv(statementCsv).map((l) => normRef(l.raw_ref))
  } catch {
    return null
  }
  const bySupplier = new Map<string, string[]>()
  for (const line of loadLedgerCsv(ledgerCsv)) {
    if (line.supplier === '') continue
    const refs = bySupplier.get(line.supplier)
    if (refs) refs.push(normRef(line.raw_ref))
    else bySupplier.set(line.supplier, [normRef(line.raw_ref)])
  }
  let best: string | null = null
  let bestCount = 0
  let tied = false
  for (const [supplier, refs] of bySupplier) {
    const count = statementRefs.filter((s) => refs.some((r) => refsMatch(s, r))).length
    if (count > bestCount) {
      best = supplier
      bestCount = count
      tied = false
    } else if (count === bestCount && count > 0) {
      tied = true
    }
  }
  return bestCount > 0 && !tied ? best : null
}

/** Reconciles one statement of a batch against the shared ledger export. */
export function runBatchItem(
  statement: BatchStatement,
  ledgerCsv: string,
  ledgerName: string | undefined,
  supplier: string,
): BatchItem {
  const asAt = deriveAsAt(statement.csv)
  if (supplier === '') {
    return {
      statement,
      supplier,
      asAt,
      run: null,
      error:
        'Could not tell which ledger supplier this statement belongs to — pick the supplier to reconcile it.',
    }
  }
  try {
    const run = executeRun({
      statementCsv: statement.csv,
      ledgerCsv,
      supplier,
      asAt,
      statementName: statement.name,
      ...(ledgerName ? { ledgerName } : {}),
    })
    return { statement, supplier, asAt, run, error: null }
  } catch (e) {
    return {
      statement,
      supplier,
      asAt,
      run: null,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/** Reconciles every statement against the shared ledger export, identifying
 * each statement's supplier by document-reference overlap. */
export function runBatch(
  statements: BatchStatement[],
  ledgerCsv: string,
  ledgerName?: string,
): BatchItem[] {
  return statements.map((s) =>
    runBatchItem(s, ledgerCsv, ledgerName, identifySupplier(s.csv, ledgerCsv) ?? ''),
  )
}
