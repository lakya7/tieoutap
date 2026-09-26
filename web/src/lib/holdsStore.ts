/** Browser-local state for the invoices-on-hold workbench: per-invoice hold
 * statuses and a per-invoice activity log, keyed by report ID so re-uploading
 * the same report finds its history. Nothing here leaves the browser; the
 * activity log is stamped into the hold review pack export. */

const STORAGE_KEY = 'tieout-hold-workbench'

export const HOLD_STATUSES = [
  'open',
  'email_sent',
  'proof_received',
  'internal_action',
  'credit_requested',
  'ready_to_release',
  'resolved',
] as const

export type HoldStatus = (typeof HOLD_STATUSES)[number]

export const HOLD_STATUS_LABELS: Record<HoldStatus, string> = {
  open: 'Open',
  email_sent: 'Email sent',
  proof_received: 'Proof received',
  internal_action: 'Internal action',
  credit_requested: 'Credit requested',
  ready_to_release: 'Ready to release',
  resolved: 'Resolved',
}

export const DEFAULT_HOLD_STATUS: HoldStatus = 'open'

export interface ActivityEntry {
  /** Invoice key ('' for supplier-level events like sending the email). */
  invoiceKey: string
  supplier: string
  event: string
  at: string
}

interface ReportState {
  statuses: Record<string, { status: string; updatedAt: string }>
  /** Supplier name -> ISO timestamp the request email was marked sent. */
  emailSentAt: Record<string, string>
  activity: ActivityEntry[]
}

type Store = Record<string, ReportState>

const MAX_REPORTS = 20
const MAX_ACTIVITY = 500

function emptyState(): ReportState {
  return { statuses: {}, emailSentAt: {}, activity: [] }
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
  const ids = Object.keys(store)
  if (ids.length > MAX_REPORTS) {
    for (const id of ids.slice(0, ids.length - MAX_REPORTS)) delete store[id]
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Storage unavailable — state still applies for this page view.
  }
  for (const listener of listeners) listener()
}

const listeners = new Set<() => void>()

/** Notifies on any workbench state change in this tab and, via the storage
 * event, in others. Returns an unsubscribe function. */
export function subscribeHolds(listener: () => void): () => void {
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

function stateFor(reportId: string): ReportState {
  const state = readStore()[reportId]
  if (!state || typeof state !== 'object') return emptyState()
  return {
    statuses: state.statuses ?? {},
    emailSentAt: state.emailSentAt ?? {},
    activity: Array.isArray(state.activity) ? state.activity : [],
  }
}

function isHoldStatus(value: string): value is HoldStatus {
  return (HOLD_STATUSES as readonly string[]).includes(value)
}

export function loadHoldStatuses(reportId: string): Record<string, HoldStatus> {
  const out: Record<string, HoldStatus> = {}
  for (const [key, entry] of Object.entries(stateFor(reportId).statuses)) {
    if (entry && typeof entry.status === 'string' && isHoldStatus(entry.status)) out[key] = entry.status
  }
  return out
}

export function loadEmailSentAt(reportId: string): Record<string, string> {
  return stateFor(reportId).emailSentAt
}

export function loadActivity(reportId: string): ActivityEntry[] {
  return stateFor(reportId).activity
}

export function recordActivity(reportId: string, entry: Omit<ActivityEntry, 'at'>): void {
  const store = readStore()
  const state = store[reportId] ?? emptyState()
  state.activity = [...(state.activity ?? []), { ...entry, at: new Date().toISOString() }].slice(-MAX_ACTIVITY)
  store[reportId] = state
  writeStore(store)
}

export function saveHoldStatus(
  reportId: string,
  invoiceKey: string,
  supplier: string,
  status: HoldStatus,
): void {
  const store = readStore()
  const state = store[reportId] ?? emptyState()
  state.statuses = { ...(state.statuses ?? {}), [invoiceKey]: { status, updatedAt: new Date().toISOString() } }
  state.activity = [
    ...(state.activity ?? []),
    { invoiceKey, supplier, event: `Status set to ${HOLD_STATUS_LABELS[status]}`, at: new Date().toISOString() },
  ].slice(-MAX_ACTIVITY)
  store[reportId] = state
  writeStore(store)
}

/** Marks the supplier's request email as sent now: stamps the timestamp used
 * for chase aging, moves the supplier's open holds to "Email sent", and logs
 * the activity. */
export function markEmailSent(reportId: string, supplier: string, invoiceKeys: string[]): void {
  const store = readStore()
  const state = store[reportId] ?? emptyState()
  const now = new Date().toISOString()
  state.emailSentAt = { ...(state.emailSentAt ?? {}), [supplier]: now }
  state.statuses = { ...(state.statuses ?? {}) }
  for (const key of invoiceKeys) {
    const current = state.statuses[key]?.status
    if (!current || current === 'open') state.statuses[key] = { status: 'email_sent', updatedAt: now }
  }
  state.activity = [
    ...(state.activity ?? []),
    { invoiceKey: '', supplier, event: 'Request email marked sent', at: now },
  ].slice(-MAX_ACTIVITY)
  store[reportId] = state
  writeStore(store)
}

export const HOLDS_STORAGE_KEY = STORAGE_KEY
