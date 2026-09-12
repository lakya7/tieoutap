/** Excel exports built entirely in the browser: the exception queue on its
 * own, and a full audit pack (summary, exceptions, matches, bridge, inputs).
 * Nothing leaves the browser — the workbook is assembled and downloaded
 * client-side. */
import * as XLSX from 'xlsx'
import type { Finding, Match } from '../../../ts/src'
import { findingRefs } from './email'
import { exceptionId, findingLabel, orderedFindings, runId, runStorageKey } from './labels'
import { ASSESSMENT_LABELS, loadReviews } from './reviews'
import type { Run } from './run'
import { DEFAULT_STATUS, STATUS_LABELS, loadStatuses } from './statuses'

const MONEY_FORMAT = '#,##0.00;[Red]-#,##0.00'

type Cell = string | number | boolean

function money(cents: number): number {
  return cents / 100
}

/** Applies the money number format to the given zero-based columns of a
 * sheet, skipping the header row. */
function formatMoneyColumns(ws: XLSX.WorkSheet, columns: number[], headerRows = 1): void {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let r = range.s.r + headerRows; r <= range.e.r; r++) {
    for (const c of columns) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined
      if (cell && cell.t === 'n') cell.z = MONEY_FORMAT
    }
  }
}

function sheet(rows: Cell[][], moneyColumns: number[] = [], headerRows = 1): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  formatMoneyColumns(ws, moneyColumns, headerRows)
  ws['!cols'] = rows[0]?.map((_, c) => ({
    wch: Math.min(50, Math.max(...rows.map((r) => String(r[c] ?? '').length), 8) + 2),
  }))
  if (headerRows === 1 && rows.length > 1) ws['!autofilter'] = { ref: ws['!ref'] ?? 'A1' }
  return ws
}

function evidenceText(f: Finding): string {
  return Object.entries(f.evidence)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : String(v)}`)
    .join('; ')
}

function refsFor(run: Run, ids: string[]): string {
  const byId = new Map<string, string>()
  for (const l of run.statement) byId.set(l.id, l.raw_ref)
  for (const l of run.ledger) byId.set(l.id, l.raw_ref)
  return [...new Set(ids.map((id) => byId.get(id) ?? id))].join(', ')
}

function matchAmount(run: Run, m: Match): number {
  const byId = new Map(run.statement.map((l) => [l.id, l.amount]))
  return m.statement_line_ids.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0)
}

function exceptionsSheet(run: Run): XLSX.WorkSheet {
  const statuses = loadStatuses(runStorageKey(run))
  const reviews = loadReviews(runStorageKey(run))
  const rows: Cell[][] = [
    [
      'ID',
      'Exception',
      'Status',
      'Category code',
      'Bucket',
      'References',
      'Amount',
      'Rule',
      'Evidence',
      'Reviewer assessment',
      'Reclassified as',
      'Reviewer reason',
    ],
  ]
  orderedFindings(run).forEach((f, i) => {
    const review = reviews[exceptionId(i)]
    rows.push([
      exceptionId(i),
      findingLabel(f.type),
      STATUS_LABELS[statuses[exceptionId(i)] ?? DEFAULT_STATUS],
      f.type,
      f.bucket,
      findingRefs(run, f),
      money(f.amount),
      f.rule_id,
      evidenceText(f),
      review ? ASSESSMENT_LABELS[review.assessment] : '',
      review?.reclassifiedTo ? findingLabel(review.reclassifiedTo) : '',
      review?.reason ?? '',
    ])
  })
  return sheet(rows, [6])
}

function matchesSheet(run: Run): XLSX.WorkSheet {
  const rows: Cell[][] = [
    ['Method', 'Confidence', 'Statement refs', 'Ledger refs', 'Amount', 'Needs confirmation'],
  ]
  for (const m of run.result.matches) {
    rows.push([
      m.method,
      m.confidence,
      refsFor(run, m.statement_line_ids),
      refsFor(run, m.ledger_line_ids),
      money(matchAmount(run, m)),
      m.requires_human_confirmation ? 'yes' : 'no',
    ])
  }
  return sheet(rows, [4])
}

function bridgeSheet(run: Run): XLSX.WorkSheet {
  const { bridge } = run.result
  const rows: Cell[][] = [['Step', 'Reference', 'Adjustment', 'Running balance']]
  rows.push(['Ledger open total', '', '', money(bridge.ledger_open_total)])
  let running = bridge.ledger_open_total
  for (const adj of bridge.adjustments) {
    running += adj.amount
    rows.push([adj.label, adj.ref, money(adj.amount), money(running)])
  }
  rows.push([
    `Statement total (${bridge.ties_out ? 'variance fully explained' : 'does not reconcile'})`,
    '',
    '',
    money(bridge.statement_total),
  ])
  rows.push(['Unexplained variance', '', '', money(bridge.statement_total - running)])
  return sheet(rows, [2, 3])
}

function statementSheet(run: Run): XLSX.WorkSheet {
  const rows: Cell[][] = [['Reference', 'Date', 'Type', 'Amount', 'Currency', 'PO number']]
  for (const l of run.statement) {
    rows.push([l.raw_ref, l.doc_date, l.doc_type, money(l.amount), l.currency, l.po_number])
  }
  return sheet(rows, [3])
}

function ledgerSheet(run: Run): XLSX.WorkSheet {
  const rows: Cell[][] = [
    ['Supplier', 'Reference', 'Date', 'Type', 'Original amount', 'Open amount', 'Currency', 'PO number'],
  ]
  for (const l of run.ledger) {
    rows.push([
      l.supplier,
      l.raw_ref,
      l.doc_date,
      l.doc_type,
      money(l.original_amount),
      money(l.open_amount),
      l.currency,
      l.po_number,
    ])
  }
  return sheet(rows, [4, 5])
}

function summarySheet(run: Run, generatedAt: Date): XLSX.WorkSheet {
  const { result } = run
  const { bridge } = result
  const initialVariance = bridge.statement_total - bridge.ledger_open_total
  const explained = bridge.adjustments.reduce((sum, adj) => sum + adj.amount, 0)
  const rows: Cell[][] = [
    ['Run ID', runId(run)],
    ['Supplier', result.supplier],
    ['Statement as at', result.as_at],
    ['Statement file', run.input.statementName ?? 'not recorded'],
    ['Ledger file', run.input.ledgerName ?? 'not recorded'],
    ['Supplier statement balance', money(bridge.statement_total)],
    ['AP ledger open balance', money(bridge.ledger_open_total)],
    ['Initial variance', money(initialVariance)],
    ['Explained variance', money(explained)],
    ['Unexplained variance', money(initialVariance - explained)],
    ['Status', bridge.ties_out ? 'Variance fully explained' : 'Does not reconcile'],
    ['Exceptions', result.findings.length],
    ['Exceptions still open', openExceptions(run)],
    ['Exceptions with reviewer assessments', Object.keys(loadReviews(runStorageKey(run))).length],
    ['Matches', result.matches.length],
    ['Generated', generatedAt.toISOString()],
    ['Generated by', 'TieOut AP — deterministic reconciliation, run in the browser'],
  ]
  for (const w of result.warnings) rows.push(['Warning', w])
  if (result.diagnostic) rows.push(['Diagnostic', result.diagnostic])
  const moneyRows = new Set([5, 6, 7, 8, 9])
  const ws = sheet(rows, [], 0)
  for (const r of moneyRows) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })] as XLSX.CellObject | undefined
    if (cell && cell.t === 'n') cell.z = MONEY_FORMAT
  }
  return ws
}

function openExceptions(run: Run): number {
  const statuses = loadStatuses(runStorageKey(run))
  return orderedFindings(run).filter((_, i) => {
    const s = statuses[exceptionId(i)] ?? DEFAULT_STATUS
    return s !== 'resolved' && s !== 'accepted'
  }).length
}

function readMeSheet(run: Run): XLSX.WorkSheet {
  const rows: Cell[][] = [
    [`TieOut AP audit pack — run ${runId(run)}`],
    [''],
    ['Sheets in this workbook:'],
    ['Summary', 'Balances, variance explained/unexplained, status, and generation details.'],
    ['Exceptions', 'Every classified difference, with stable IDs, statuses, references, amounts, and evidence.'],
    ['Matches', 'Every matched pairing, including any flagged for human confirmation.'],
    ['Bridge', 'The signed walk from the AP ledger open balance to the supplier statement balance.'],
    ['Statement input', 'The supplier statement lines as parsed for this run.'],
    ['Ledger input', 'The AP ledger lines as parsed for this run.'],
    [''],
    ['How this pack was produced:'],
    ['The reconciliation is deterministic: the same two files always produce the same'],
    ['matches, exceptions, and bridge, using integer-cent arithmetic throughout.'],
    ['The workbook was assembled in the browser at the time shown on the Summary sheet.'],
    ['Exception statuses and reviewer assessments are working notes recorded in the'],
    ['preparer\u2019s browser; they track follow-up and human judgement and are not part'],
    ['of the deterministic reconciliation result, which they never alter.'],
    [''],
    ['TieOut AP reads exported files only. It holds no ERP credentials, writes to no'],
    ['accounting system, and sends no emails on your behalf.'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 18 }, { wch: 90 }]
  return ws
}

function fileSlug(run: Run): string {
  const supplier = run.result.supplier.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${supplier || 'run'}-${run.result.as_at || 'undated'}`
}

/** Downloads the exception queue (and any matches needing confirmation) as a
 * spreadsheet. */
export function downloadExceptionsXlsx(run: Run): void {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, exceptionsSheet(run), 'Exceptions')
  const tentative = run.result.matches.filter((m) => m.requires_human_confirmation)
  if (tentative.length > 0) {
    const rows: Cell[][] = [
      ['Method', 'Confidence', 'Statement refs', 'Ledger refs', 'Amount'],
      ...tentative.map((m): Cell[] => [
        m.method,
        m.confidence,
        refsFor(run, m.statement_line_ids),
        refsFor(run, m.ledger_line_ids),
        money(matchAmount(run, m)),
      ]),
    ]
    XLSX.utils.book_append_sheet(wb, sheet(rows, [4]), 'Matches to confirm')
  }
  XLSX.writeFile(wb, `tieout-exceptions-${fileSlug(run)}.xlsx`)
}

/** Downloads the full audit pack: summary, exceptions, every match, the
 * balance bridge, and both input files, with a generation timestamp. */
export function downloadAuditPackXlsx(run: Run): void {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, summarySheet(run, new Date()), 'Summary')
  XLSX.utils.book_append_sheet(wb, exceptionsSheet(run), 'Exceptions')
  XLSX.utils.book_append_sheet(wb, matchesSheet(run), 'Matches')
  XLSX.utils.book_append_sheet(wb, bridgeSheet(run), 'Bridge')
  XLSX.utils.book_append_sheet(wb, statementSheet(run), 'Statement input')
  XLSX.utils.book_append_sheet(wb, ledgerSheet(run), 'Ledger input')
  XLSX.utils.book_append_sheet(wb, readMeSheet(run), 'Read Me')
  XLSX.writeFile(wb, `tieout-audit-pack-${fileSlug(run)}.xlsx`)
}
