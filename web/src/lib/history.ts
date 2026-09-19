/** Browser-local run history: each completed run is saved (as its encoded
 * input plus summary figures) so past reconciliations can be reopened and
 * compared across cycles. Nothing leaves the browser — reopening a run
 * re-executes the deterministic engine on the stored input. */
import { findingRefs } from './email'
import { exceptionId, orderedFindings, runId, runStorageKey } from './labels'
import type { Run } from './run'
import { encodeRun } from './share'
import { DEFAULT_STATUS, loadStatuses } from './statuses'

const STORAGE_KEY = 'tieout-run-history'
const MAX_ENTRIES = 20

export interface HistoryEntry {
  /** Collision-safe identity (display run ID + input digest). */
  key: string
  /** Display run ID, e.g. TA-20260831-CDW. */
  id: string
  supplier: string
  asAt: string
  savedAt: string
  statementName?: string
  ledgerName?: string
  statementTotal: number
  ledgerTotal: number
  unexplained: number
  exceptions: number
  /** Finding fingerprints (type + refs) for carry-over detection. */
  fingerprints: string[]
  /** encodeRun(input) — the same encoding as share links. */
  encoded: string
}

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  return (
    typeof e.key === 'string' &&
    typeof e.id === 'string' &&
    typeof e.supplier === 'string' &&
    typeof e.asAt === 'string' &&
    typeof e.savedAt === 'string' &&
    typeof e.statementTotal === 'number' &&
    typeof e.ledgerTotal === 'number' &&
    typeof e.unexplained === 'number' &&
    typeof e.exceptions === 'number' &&
    Array.isArray(e.fingerprints) &&
    e.fingerprints.every((f) => typeof f === 'string') &&
    typeof e.encoded === 'string'
  )
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry)
  } catch {
    return []
  }
}

const listeners = new Set<() => void>()

/** Notifies on history changes in this tab and, via the storage event, from
 * other tabs. Returns an unsubscribe function. */
export function subscribeHistory(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function notify(): void {
  for (const listener of listeners) listener()
}

function writeHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota or storage unavailable: retry with the smallest useful history
    // rather than losing the newest run.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 5)))
    } catch {
      // Storage genuinely unavailable — history is best-effort.
    }
  }
  notify()
}

/** A finding's identity across runs: its classification plus the document
 * references involved, independent of position in the queue. */
export function findingFingerprint(run: Run, findingIndex: number): string {
  const f = orderedFindings(run)[findingIndex]
  return `${f.type}|${findingRefs(run, f)}`
}

/** Saves (or refreshes) a run in history. Diagnostic-failure runs are kept
 * too — knowing a cycle failed is part of the record. */
export function recordRun(run: Run): void {
  const { bridge } = run.result
  const initialVariance = bridge.statement_total - bridge.ledger_open_total
  const explained = bridge.adjustments.reduce((sum, adj) => sum + adj.amount, 0)
  const entry: HistoryEntry = {
    key: runStorageKey(run),
    id: runId(run),
    supplier: run.result.supplier,
    asAt: run.result.as_at,
    savedAt: new Date().toISOString(),
    ...(run.input.statementName ? { statementName: run.input.statementName } : {}),
    ...(run.input.ledgerName ? { ledgerName: run.input.ledgerName } : {}),
    statementTotal: bridge.statement_total,
    ledgerTotal: bridge.ledger_open_total,
    unexplained: initialVariance - explained,
    exceptions: run.result.findings.length,
    fingerprints: orderedFindings(run).map((_, i) => findingFingerprint(run, i)),
    encoded: encodeRun(run.input),
  }
  const rest = loadHistory().filter((e) => e.key !== entry.key)
  writeHistory([entry, ...rest].slice(0, MAX_ENTRIES))
}

export function removeHistoryEntry(key: string): void {
  writeHistory(loadHistory().filter((e) => e.key !== key))
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable — nothing to clear.
  }
  notify()
}

function supplierKey(name: string): string {
  return name.trim().toLowerCase()
}

/** The most recent earlier cycle in history for the same supplier — the
 * previous reconciliation to compare exceptions against. Only runs with an
 * as-at date strictly before this run's count as earlier cycles. */
export function previousRun(run: Run): HistoryEntry | null {
  const key = runStorageKey(run)
  const supplier = supplierKey(run.result.supplier)
  const asAt = run.result.as_at
  const candidates = loadHistory().filter(
    (e) =>
      e.key !== key &&
      supplierKey(e.supplier) === supplier &&
      e.asAt !== '' &&
      asAt !== '' &&
      e.asAt < asAt,
  )
  if (candidates.length === 0) return null
  return candidates.reduce((best, e) => {
    if (e.asAt !== best.asAt) return e.asAt > best.asAt ? e : best
    return e.savedAt > best.savedAt ? e : best
  })
}

/** Indices of this run's findings that were still open on the previous saved
 * run for the same supplier — recurring exceptions to chase harder. Prior
 * findings the reviewer marked resolved or accepted don't count, and each
 * prior occurrence matches at most one current finding, so duplicates with
 * identical fingerprints are counted one-to-one. */
export function carryOvers(run: Run): { prior: HistoryEntry; recurring: Set<number> } | null {
  const prior = previousRun(run)
  if (!prior) return null
  const statuses = loadStatuses(prior.key)
  const remaining = new Map<string, number>()
  prior.fingerprints.forEach((fp, i) => {
    const status = statuses[exceptionId(i)] ?? DEFAULT_STATUS
    if (status === 'resolved' || status === 'accepted') return
    remaining.set(fp, (remaining.get(fp) ?? 0) + 1)
  })
  const recurring = new Set<number>()
  orderedFindings(run).forEach((_, i) => {
    const fp = findingFingerprint(run, i)
    const count = remaining.get(fp) ?? 0
    if (count > 0) {
      recurring.add(i)
      remaining.set(fp, count - 1)
    }
  })
  return { prior, recurring }
}
