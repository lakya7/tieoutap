/** Browser side of statement extraction: post the document to the server
 * endpoint (which holds the API key) and turn a verified extraction back into
 * the statement CSV the deterministic engine already consumes, so every
 * downstream feature — runs, share links, the bridge — is unchanged. */
import { formatCents } from '../../../ts/src'
import type { ExtractionResult, StatementLine } from '../../../ts/src'

const DOCUMENT_MEDIA_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

/** The media type to extract this file as, or null if it should be read as
 * CSV text instead. */
export function documentMediaType(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return DOCUMENT_MEDIA_TYPES[ext] ?? null
}

function toBase64(bytes: ArrayBuffer): string {
  const chunk = 0x8000
  const view = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function extractDocument(
  file: File,
  mediaType: string,
): Promise<ExtractionResult> {
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ media_type: mediaType, data: toBase64(await file.arrayBuffer()) }),
  })
  if (response.ok) return (await response.json()) as ExtractionResult
  const body = (await response.json().catch(() => ({}))) as { detail?: string }
  return {
    ok: false,
    reason: 'invalid_model_output',
    detail: body.detail ?? `extraction failed (HTTP ${response.status})`,
    confidence: '0.00',
  }
}

/** Extracted lines -> the statement CSV format loadStatementCsv reads. */
export function linesToStatementCsv(lines: StatementLine[]): string {
  const rows = lines.map((l) =>
    [
      l.raw_ref,
      l.doc_date,
      l.doc_type,
      formatCents(l.amount),
      l.po_number,
      l.currency,
    ]
      .map((field) => (field.includes(',') || field.includes('"') ? `"${field.replaceAll('"', '""')}"` : field))
      .join(','),
  )
  return ['ref,date,type,amount,po,currency', ...rows, ''].join('\n')
}

/** Human-readable explanation of why extraction refused. */
export function refusalMessage(result: Extract<ExtractionResult, { ok: false }>): string {
  const prefix =
    result.reason === 'balance_forward_unsupported'
      ? 'This statement is balance-forward, not itemised'
      : result.reason === 'closing_balance_mismatch'
        ? 'The extracted lines do not add up to the statement’s own closing balance'
        : 'The statement could not be read reliably'
  return `${prefix} — ${result.detail} You can still upload the statement as CSV.`
}
