/** Reviewer assessments for exceptions: a human's recorded judgement about a
 * deterministic finding — agree, reclassify, or mark as not an issue — with a
 * required written reason. Assessments never change the engine's result; they
 * are an annotation layer, stored only in this browser's localStorage keyed
 * by run ID, and stamped into the Excel and audit-pack exports as reviewer
 * changes. */
const STORAGE_KEY = 'tieout-exception-reviews'

export const REVIEW_ASSESSMENTS = ['confirmed', 'reclassified', 'not_an_issue'] as const

export type ReviewAssessment = (typeof REVIEW_ASSESSMENTS)[number]

export const ASSESSMENT_LABELS: Record<ReviewAssessment, string> = {
  confirmed: 'Confirmed',
  reclassified: 'Reclassified',
  not_an_issue: 'Not an issue',
}

export interface ExceptionReview {
  assessment: ReviewAssessment
  /** Classification code the reviewer believes is correct; only set when
   * assessment is 'reclassified'. */
  reclassifiedTo?: string
  reason: string
  updatedAt: string
}

export type RunReviews = Record<string, ExceptionReview>

type Store = Record<string, Record<string, ExceptionReview>>

function isAssessment(value: string): value is ReviewAssessment {
  return (REVIEW_ASSESSMENTS as readonly string[]).includes(value)
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
    // Storage unavailable — reviews still apply for this page view.
  }
}

const listeners = new Set<() => void>()

/** Notifies on any review change in this tab, and on changes from other
 * tabs via the storage event. Returns an unsubscribe function. */
export function subscribeReviews(listener: () => void): () => void {
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

/** Reviews recorded for a run, keyed by exception ID (E-001, ...). */
export function loadReviews(runId: string): RunReviews {
  const entries = readStore()[runId]
  if (!entries || typeof entries !== 'object') return {}
  const out: RunReviews = {}
  for (const [id, entry] of Object.entries(entries)) {
    if (
      entry &&
      typeof entry.assessment === 'string' &&
      isAssessment(entry.assessment) &&
      typeof entry.reason === 'string'
    ) {
      out[id] = entry
    }
  }
  return out
}

/** Records the reviewer's assessment of one exception in a run. */
export function saveReview(
  runId: string,
  exceptionId: string,
  review: Omit<ExceptionReview, 'updatedAt'>,
): void {
  const store = readStore()
  const entries = store[runId] ?? {}
  entries[exceptionId] = { ...review, updatedAt: new Date().toISOString() }
  store[runId] = entries
  writeStore(store)
  notify()
}

/** Removes the reviewer's assessment of one exception in a run. */
export function clearReview(runId: string, exceptionId: string): void {
  const store = readStore()
  const entries = store[runId]
  if (!entries || !(exceptionId in entries)) return
  delete entries[exceptionId]
  writeStore(store)
  notify()
}
