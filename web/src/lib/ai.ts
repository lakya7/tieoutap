/** Browser side of the AI assists (column mapping and findings summaries).
 * Only headers + a few sample values, or the finished findings, are posted —
 * never the uploaded files. The results are applied deterministically here. */
import { formatCentsGrouped, parseCsv } from '../../../ts/src'
import { findingRefs } from './email'
import type { Run } from './run'
import { supabase } from './supabase'

export interface AiError {
  ok: false
  detail: string
}

export type MappingResult = { ok: true; mapping: Record<string, string> } | AiError

export type SummaryResult = { ok: true; narrative: string; email: string } | AiError

export async function postJson(path: string, payload: unknown): Promise<unknown | AiError> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (supabase) {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    if (token) headers['authorization'] = `Bearer ${token}`
  }
  let response: Response
  try {
    response = await fetch(path, { method: 'POST', headers, body: JSON.stringify(payload) })
  } catch (e) {
    return { ok: false, detail: `could not reach the server: ${e instanceof Error ? e.message : String(e)}` }
  }
  const body = (await response.json().catch(() => ({}))) as { detail?: string }
  if (!response.ok) {
    return { ok: false, detail: body.detail ?? `request failed (HTTP ${response.status})` }
  }
  return body
}

/** Splits one already-normalised CSV line into fields (quoted "" escapes). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      fields.push(field)
      field = ''
    } else {
      field += c
    }
  }
  fields.push(field)
  return fields
}

function csvEscape(field: string): string {
  return /[",\n\r]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field
}

export function csvHeaders(csv: string): string[] {
  const noBom = csv.startsWith('\uFEFF') ? csv.slice(1) : csv
  const end = noBom.indexOf('\n')
  return splitCsvLine(noBom.slice(0, end === -1 ? noBom.length : end).replace(/\r$/, ''))
}

const MAX_SAMPLE_ROWS = 3
const MAX_CELL_CHARS = 80

/** Asks the server to map this table's columns onto the engine's schema,
 * sending only the header row and a few truncated sample values. */
export async function requestMapping(
  kind: 'statement' | 'ledger',
  csv: string,
): Promise<MappingResult> {
  const headers = csvHeaders(csv)
  const samples = parseCsv(csv)
    .slice(0, MAX_SAMPLE_ROWS)
    .map((row) => headers.map((h) => (row[h] ?? '').slice(0, MAX_CELL_CHARS)))
  const body = await postJson('/api/map', { kind, headers, samples })
  if (typeof body === 'object' && body !== null && (body as MappingResult).ok !== undefined) {
    return body as MappingResult
  }
  return { ok: false, detail: 'unexpected server response' }
}

/** Rewrites the CSV header row with the mapped engine column names; data rows
 * and unmapped columns are untouched. */
export function applyMapping(csv: string, mapping: Record<string, string>): string {
  const noBom = csv.startsWith('\uFEFF') ? csv.slice(1) : csv
  const end = noBom.indexOf('\n')
  const headerLine = noBom.slice(0, end === -1 ? noBom.length : end).replace(/\r$/, '')
  const rest = end === -1 ? '' : noBom.slice(end)
  const mapped = splitCsvLine(headerLine)
    .map((h) => csvEscape(mapping[h] ?? h))
    .join(',')
  return mapped + rest
}

/** Human-readable "old -> new" description of an applied mapping. */
export function describeMapping(mapping: Record<string, string>): string {
  return Object.entries(mapping)
    .map(([source, target]) => `${source} → ${target}`)
    .join(', ')
}

/** Asks the server for a plain-English narrative and reworded supplier email.
 * Sends only the findings (types, refs, formatted amounts) and bridge labels
 * the deterministic engine produced — never the uploaded files. */
export async function requestSummary(run: Run): Promise<SummaryResult> {
  const { result } = run
  const body = await postJson('/api/summarize', {
    supplier: result.supplier,
    as_at: result.as_at,
    statement_total: formatCentsGrouped(result.bridge.statement_total),
    ledger_open_total: formatCentsGrouped(result.bridge.ledger_open_total),
    gap: formatCentsGrouped(result.bridge.statement_total - result.bridge.ledger_open_total),
    ties_out: result.bridge.ties_out,
    findings: result.findings.map((f) => ({
      type: f.type,
      bucket: f.bucket,
      refs: findingRefs(run, f).slice(0, 400),
      amount: formatCentsGrouped(f.amount),
    })),
    bridge: result.bridge.adjustments.map(
      (a) => `${a.label} (${a.ref}): ${formatCentsGrouped(a.amount)}`,
    ),
  })
  if (typeof body === 'object' && body !== null && (body as SummaryResult).ok !== undefined) {
    return body as SummaryResult
  }
  return { ok: false, detail: 'unexpected server response' }
}
