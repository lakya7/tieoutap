import { useEffect, useState } from 'react'
import { formatCentsGrouped } from '../../../ts/src'
import type { Finding, LedgerLine, Match, StatementLine } from '../../../ts/src'
import { findingRefs } from '../lib/email'
import {
  findingLedgerLines,
  findingNarrative,
  findingStatementLines,
} from '../lib/evidence'
import { downloadExceptionsXlsx } from '../lib/export'
import {
  FINDING_TYPES,
  exceptionId,
  findingLabel,
  orderedFindings,
  runStorageKey,
} from '../lib/labels'
import {
  ASSESSMENT_LABELS,
  clearReview,
  loadReviews,
  saveReview,
  subscribeReviews,
} from '../lib/reviews'
import type { ExceptionReview, ReviewAssessment, RunReviews } from '../lib/reviews'
import type { Run } from '../lib/run'
import {
  DEFAULT_STATUS,
  EXCEPTION_STATUSES,
  STATUS_LABELS,
  STATUSES_STORAGE_KEY,
  loadStatuses,
  saveStatus,
} from '../lib/statuses'
import type { ExceptionStatus, RunStatuses } from '../lib/statuses'

const BUCKET_STYLES: Record<string, string> = {
  cash_at_risk: 'bg-red-100 text-red-800',
  unrecorded_liability: 'bg-amber-100 text-amber-800',
  investigate: 'bg-sky-100 text-sky-800',
  explained: 'bg-moss text-pine-deep',
}

const BUCKET_LABELS: Record<string, string> = {
  cash_at_risk: 'Cash at risk',
  unrecorded_liability: 'Unrecorded liability',
  investigate: 'Investigate',
  explained: 'Explained',
}

const METHOD_LABELS: Record<string, string> = {
  amount_date: 'Amount + date',
  subset_sum: 'Sum of lines',
}

const STATUS_STYLES: Record<ExceptionStatus, string> = {
  open: 'border-line bg-cream text-ink',
  investigating: 'border-sky-300 bg-sky-50 text-sky-900',
  awaiting_supplier: 'border-amber-300 bg-amber-50 text-amber-900',
  resolved: 'border-pine/40 bg-moss text-pine-deep',
  accepted: 'border-pine/40 bg-moss text-pine-deep',
}

function LinesTable({
  title,
  head,
  rows,
}: {
  title: string
  head: string[]
  rows: (string | number)[][]
}) {
  return (
    <div className="min-w-0 border border-line bg-cream">
      <p className="border-b border-line px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
        {title}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line/60 font-mono text-xs text-ink-faint">
              {head.map((h) => (
                <th
                  key={h}
                  className={`px-3 py-1.5 font-medium ${h === 'Amount' || h === 'Original' || h === 'Open' ? 'text-right' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr key={i} className="border-b border-line/40 last:border-b-0">
                {cells.map((cell, j) => (
                  <td
                    key={j}
                    className={`whitespace-nowrap px-3 py-1.5 font-mono text-xs ${
                      typeof cell === 'number' ? 'text-right tabular-nums' : ''
                    }`}
                  >
                    {typeof cell === 'number' ? formatCentsGrouped(cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function statementRows(lines: StatementLine[]): (string | number)[][] {
  return lines.map((l) => [l.raw_ref, l.doc_date, l.doc_type, l.amount])
}

function ledgerRows(lines: LedgerLine[]): (string | number)[][] {
  return lines.map((l) => [l.raw_ref, l.doc_date, l.doc_type, l.original_amount, l.open_amount])
}

function ReviewPanel({
  finding,
  review,
  onSave,
  onClear,
}: {
  finding: Finding
  review: ExceptionReview | undefined
  onSave: (review: Omit<ExceptionReview, 'updatedAt'>) => void
  onClear: () => void
}) {
  const [assessment, setAssessment] = useState<ReviewAssessment>(
    review?.assessment ?? 'confirmed',
  )
  const [reclassifiedTo, setReclassifiedTo] = useState(review?.reclassifiedTo ?? '')
  const [reason, setReason] = useState(review?.reason ?? '')
  const needsTarget = assessment === 'reclassified'
  const canSave = reason.trim() !== '' && (!needsTarget || reclassifiedTo !== '')
  return (
    <div className="border border-line bg-cream px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
          Reviewer assessment
        </p>
        {review && (
          <p className="font-mono text-xs text-ink-faint">
            Recorded {review.updatedAt.slice(0, 10)} in this browser
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {(Object.keys(ASSESSMENT_LABELS) as ReviewAssessment[]).map((a) => (
          <label key={a} className="flex items-center gap-1.5 text-sm text-ink">
            <input
              type="radio"
              name={`assessment-${finding.rule_id}-${finding.statement_line_ids.join('-')}-${finding.ledger_line_ids.join('-')}`}
              checked={assessment === a}
              onChange={() => setAssessment(a)}
              className="accent-pine"
            />
            {ASSESSMENT_LABELS[a]}
          </label>
        ))}
        {needsTarget && (
          <select
            value={reclassifiedTo}
            onChange={(e) => setReclassifiedTo(e.target.value)}
            className="border border-line bg-paper px-2 py-1 text-xs"
            aria-label="Reclassify as"
          >
            <option value="">Reclassify as…</option>
            {FINDING_TYPES.filter((t) => t !== finding.type).map((t) => (
              <option key={t} value={t}>
                {findingLabel(t)}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-start gap-2">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required) — recorded with the assessment and stamped into exports"
          rows={2}
          className="min-w-0 flex-1 border border-line bg-paper px-2 py-1.5 text-sm"
          aria-label="Reviewer reason"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave({
                assessment,
                reason: reason.trim(),
                ...(needsTarget ? { reclassifiedTo } : {}),
              })
            }
            className="bg-ink px-3 py-1.5 text-xs font-semibold text-paper hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {review ? 'Update' : 'Record'}
          </button>
          {review && (
            <button
              type="button"
              onClick={onClear}
              className="border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-ink-faint"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-ink-faint">
        Assessments are working notes stored in your browser — the deterministic
        classification above is never changed by them.
      </p>
    </div>
  )
}

function EvidenceRow({
  run,
  finding,
  review,
  onSaveReview,
  onClearReview,
}: {
  run: Run
  finding: Finding
  review: ExceptionReview | undefined
  onSaveReview: (review: Omit<ExceptionReview, 'updatedAt'>) => void
  onClearReview: () => void
}) {
  const narrative = findingNarrative(run, finding)
  const sLines = findingStatementLines(run, finding)
  const lLines = findingLedgerLines(run, finding)
  return (
    <tr>
      <td colSpan={7} className="bg-paper px-4 py-4">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
                What was found
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{narrative.what}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
                Why this category
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{narrative.why}</p>
            </div>
          </div>

          {(sLines.length > 0 || lLines.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {sLines.length > 0 && (
                <LinesTable
                  title="Statement lines"
                  head={['Reference', 'Date', 'Type', 'Amount']}
                  rows={statementRows(sLines)}
                />
              )}
              {lLines.length > 0 && (
                <LinesTable
                  title="Ledger lines"
                  head={['Reference', 'Date', 'Type', 'Original', 'Open']}
                  rows={ledgerRows(lLines)}
                />
              )}
            </div>
          )}

          <div className="border border-pine/30 bg-moss px-3 py-2">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-pine">
              Suggested next action
            </p>
            <p className="mt-1 text-sm leading-relaxed text-pine-deep">{narrative.nextAction}</p>
          </div>

          <ReviewPanel
            finding={finding}
            review={review}
            onSave={onSaveReview}
            onClear={onClearReview}
          />

          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 border-t border-line pt-3 sm:grid-cols-3">
            <div>
              <dt className="font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">Rule</dt>
              <dd className="font-mono text-xs">{finding.rule_id}</dd>
            </div>
            {Object.entries(finding.evidence).map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
                  {k.replace(/_/g, ' ')}
                </dt>
                <dd className="font-mono text-xs">
                  {Array.isArray(v) ? v.join(', ') : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </td>
    </tr>
  )
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

export function ExceptionQueue({ run }: { run: Run }) {
  const [open, setOpen] = useState<string | null>(null)
  const id = runStorageKey(run)
  const [statuses, setStatuses] = useState<RunStatuses>(() => loadStatuses(id))
  const [reviews, setReviews] = useState<RunReviews>(() => loadReviews(id))
  useEffect(() => {
    setStatuses(loadStatuses(id))
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATUSES_STORAGE_KEY || e.key === null) setStatuses(loadStatuses(id))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [id])
  useEffect(() => {
    setReviews(loadReviews(id))
    return subscribeReviews(() => setReviews(loadReviews(id)))
  }, [id])
  const setStatus = (exceptionId: string, status: ExceptionStatus) => {
    saveStatus(id, exceptionId, status)
    setStatuses(loadStatuses(id))
  }
  const { diagnostic } = run.result
  const findings = orderedFindings(run)
  const tentative = run.result.matches
    .filter((m) => m.requires_human_confirmation)
    .slice()
    .sort((a, b) => matchAmount(run, b) - matchAmount(run, a))

  if (diagnostic !== null) {
    return (
      <p className="border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Reconciliation failed — the variance cannot be fully explained, so
        findings are suppressed. Diagnostic: <span className="font-mono">{diagnostic}</span>
      </p>
    )
  }

  if (findings.length === 0 && tentative.length === 0) {
    return (
      <p className="border border-line bg-cream p-6 text-sm text-ink-soft">
        No exceptions — every statement line matched the ledger.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => downloadExceptionsXlsx(run)}
          className="border border-line bg-cream px-3 py-1.5 text-sm font-medium text-ink hover:border-ink-faint"
          title="Download the exception queue as a spreadsheet"
        >
          Export to Excel
        </button>
      </div>
      {findings.length > 0 && (
        <div className="border border-line bg-cream">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Exception</th>
                  <th className="px-4 py-3 font-medium">Bucket</th>
                  <th className="px-4 py-3 font-medium">References</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {findings.map((f, i) => (
                  <FindingRows
                    key={`f-${i}`}
                    run={run}
                    finding={f}
                    id={exceptionId(i)}
                    status={statuses[exceptionId(i)] ?? DEFAULT_STATUS}
                    onStatus={(s) => setStatus(exceptionId(i), s)}
                    review={reviews[exceptionId(i)]}
                    onSaveReview={(r) => saveReview(id, exceptionId(i), r)}
                    onClearReview={() => clearReview(id, exceptionId(i))}
                    open={open === `f-${i}`}
                    onToggle={() => setOpen(open === `f-${i}` ? null : `f-${i}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tentative.length > 0 && (
        <div className="border border-line bg-cream">
          <div className="border-b border-line px-4 py-3">
            <h3 className="font-serif text-base font-medium text-ink">Matches needing confirmation</h3>
            <p className="mt-0.5 text-xs text-ink-faint">
              Matched without a reference — confirm each pairing before relying on it.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                  <th className="px-4 py-3 font-medium">Statement refs</th>
                  <th className="px-4 py-3 font-medium">Ledger refs</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {tentative.map((m, i) => (
                  <tr key={`m-${i}`} className="border-b border-line/60 last:border-b-0">
                    <td className="px-4 py-3 text-xs">
                      {METHOD_LABELS[m.method] ?? m.method}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{m.confidence}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {refsFor(run, m.statement_line_ids)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {refsFor(run, m.ledger_line_ids)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatCentsGrouped(matchAmount(run, m))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function FindingRows({
  run,
  finding,
  id,
  status,
  onStatus,
  review,
  onSaveReview,
  onClearReview,
  open,
  onToggle,
}: {
  run: Run
  finding: Finding
  id: string
  status: ExceptionStatus
  onStatus: (status: ExceptionStatus) => void
  review: ExceptionReview | undefined
  onSaveReview: (review: Omit<ExceptionReview, 'updatedAt'>) => void
  onClearReview: () => void
  open: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-line/60 last:border-b-0 hover:bg-paper"
        onClick={onToggle}
      >
        <td className="px-4 py-3 font-mono text-xs text-ink-faint">{id}</td>
        <td className="px-4 py-3">
          <span className="text-sm font-medium text-ink">{findingLabel(finding.type)}</span>
          <span className="mt-0.5 block font-mono text-xs uppercase tracking-wide text-ink-faint">
            {finding.type}
          </span>
          {review && (
            <span className="mt-0.5 block text-xs text-pine-deep">
              Reviewer: {ASSESSMENT_LABELS[review.assessment].toLowerCase()}
              {review.assessment === 'reclassified' && review.reclassifiedTo
                ? ` as “${findingLabel(review.reclassifiedTo)}”`
                : ''}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={`whitespace-nowrap px-2 py-0.5 text-xs font-medium ${
              BUCKET_STYLES[finding.bucket] ?? 'bg-paper text-ink-soft'
            }`}
          >
            {BUCKET_LABELS[finding.bucket] ?? finding.bucket}
          </span>
        </td>
        <td className="px-4 py-3 font-mono text-xs">{findingRefs(run, finding)}</td>
        <td className="px-4 py-3 text-right font-mono tabular-nums">
          {formatCentsGrouped(finding.amount)}
        </td>
        <td className="px-4 py-3">
          <select
            value={status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onStatus(e.target.value as ExceptionStatus)}
            className={`border px-2 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
            aria-label={`Status of exception ${id}`}
          >
            {EXCEPTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 text-right text-xs text-ink-faint">
          {open ? 'Hide' : 'Evidence'}
        </td>
      </tr>
      {open && (
        <EvidenceRow
          run={run}
          finding={finding}
          review={review}
          onSaveReview={onSaveReview}
          onClearReview={onClearReview}
        />
      )}
    </>
  )
}
