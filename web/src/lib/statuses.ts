/** Operational statuses for exceptions: the financial classification says
 * what a difference IS; the status tracks what has been DONE about it.
 * Statuses live only in this browser's localStorage, keyed by run ID, and
 * are stamped into the Excel and audit-pack exports. */
const STORAGE_KEY = 'tieout-exception-statuses'

export const EXCEPTION_STATUSES = [
  'open',
  'investigating',
  'awaiting_supplier',
  'resolved',
  'accepted',
] as const

export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number]

export const STATUS_LABELS: Record<ExceptionStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  awaiting_supplier: 'Awaiting supplier',
  resolved: 'Resolved',
  accepted: 'Accepted',
}

export const DEFAULT_STATUS: ExceptionStatus = 'open'

export type RunStatuses = Record<string, ExceptionStatus>

type Store = Record<string, Record<string, { status: string; updatedAt: string }>>

function isStatus(value: string): value is ExceptionStatus {
  return (EXCEPTION_STATUSES as readonly string[]).includes(value)
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    return parsed as Store
  } catch {
    return {}
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Storage unavailable — statuses still apply for this page view.
  }
}

/** Statuses recorded for a run, keyed by exception ID (E-001, ...). */
export function loadStatuses(runId: string): RunStatuses {
  const entries = readStore()[runId]
  if (!entries || typeof entries !== 'object') return {}
  const out: RunStatuses = {}
  for (const [id, entry] of Object.entries(entries)) {
    if (entry && typeof entry.status === 'string' && isStatus(entry.status)) {
      out[id] = entry.status
    }
  }
  return out
}

/** Records the status of one exception in a run. */
export function saveStatus(
  runId: string,
  exceptionId: string,
  status: ExceptionStatus,
): void {
  const store = readStore()
  const entries = store[runId] ?? {}
  entries[exceptionId] = { status, updatedAt: new Date().toISOString() }
  store[runId] = entries
  writeStore(store)
}

export const STATUSES_STORAGE_KEY = STORAGE_KEY
