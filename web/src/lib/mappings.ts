/** Saved column mappings so a supplier's monthly file maps in one click.
 * Keyed by the exact header row (per file kind), stored only in this
 * browser's localStorage — nothing is sent anywhere. */
import { csvHeaders } from './ai'

const STORAGE_KEY = 'tieout-saved-mappings'

export interface SavedMapping {
  mapping: Record<string, string>
  savedAt: string // ISO timestamp
}

type Store = Record<string, SavedMapping>

function mappingKey(kind: 'statement' | 'ledger', headers: string[]): string {
  return `${kind}\u0001${headers.join('\u0001')}`
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
    // Storage unavailable — the mapping still applied for this run.
  }
}

/** Returns the saved mapping for this file's exact header row, or null.
 * Only mappings whose source columns all appear in the header are returned,
 * so a mapping is never silently applied to an unrelated layout. */
export function loadSavedMapping(
  kind: 'statement' | 'ledger',
  csv: string,
): Record<string, string> | null {
  const headers = csvHeaders(csv)
  const saved = readStore()[mappingKey(kind, headers)]
  if (!saved || typeof saved.mapping !== 'object' || saved.mapping === null) return null
  const headerSet = new Set(headers)
  const entries = Object.entries(saved.mapping)
  if (entries.length === 0) return null
  if (!entries.every(([source, target]) => headerSet.has(source) && typeof target === 'string')) {
    return null
  }
  return saved.mapping
}

/** Remembers an accepted AI mapping for this header layout. */
export function saveMapping(
  kind: 'statement' | 'ledger',
  csv: string,
  mapping: Record<string, string>,
): void {
  const store = readStore()
  store[mappingKey(kind, csvHeaders(csv))] = {
    mapping,
    savedAt: new Date().toISOString(),
  }
  writeStore(store)
}

/** Removes the saved mapping for this header layout. */
export function forgetMapping(kind: 'statement' | 'ledger', csv: string): void {
  const store = readStore()
  delete store[mappingKey(kind, csvHeaders(csv))]
  writeStore(store)
}
