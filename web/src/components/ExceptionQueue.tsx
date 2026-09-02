import { useState } from 'react'
import { formatCentsGrouped } from '../../../ts/src'
import type { Finding, Match } from '../../../ts/src'
import { findingRefs } from '../lib/email'
import type { Run } from '../lib/run'

const BUCKET_STYLES: Record<string, string> = {
  cash_at_risk: 'bg-red-100 text-red-800',
  unrecorded_liability: 'bg-amber-100 text-amber-800',
  investigate: 'bg-sky-100 text-sky-800',
  explained: 'bg-stone-100 text-stone-600',
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

function EvidenceRow({ finding }: { finding: Finding }) {
  return (
    <tr>
      <td colSpan={5} className="bg-stone-50 px-4 py-3">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-400">Rule</dt>
            <dd className="font-mono text-xs">{finding.rule_id}</dd>
          </div>
          {Object.entries(finding.evidence).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-stone-400">
                {k.replace(/_/g, ' ')}
              </dt>
              <dd className="font-mono text-xs">
                {Array.isArray(v) ? v.join(', ') : String(v)}
              </dd>
            </div>
          ))}
        </dl>
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
  const findings = run.result.findings
    .slice()
    .sort((a, b) => b.amount - a.amount || a.rule_id.localeCompare(b.rule_id))
  const tentative = run.result.matches
    .filter((m) => m.requires_human_confirmation)
    .slice()
    .sort((a, b) => matchAmount(run, b) - matchAmount(run, a))

  if (findings.length === 0 && tentative.length === 0) {
    return (
      <p className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500 shadow-sm">
        No exceptions — every statement line matched the ledger.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {findings.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Bucket</th>
                  <th className="px-4 py-3 font-medium">References</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {findings.map((f, i) => (
                  <FindingRows
                    key={`f-${i}`}
                    run={run}
                    finding={f}
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
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-4 py-3">
            <h3 className="text-sm font-semibold">Matches needing confirmation</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Matched without a reference — confirm each pairing before relying on it.
            </p>
          </div>
          <div className="overflow-x-auto rounded-b-xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                  <th className="px-4 py-3 font-medium">Statement refs</th>
                  <th className="px-4 py-3 font-medium">Ledger refs</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {tentative.map((m, i) => (
                  <tr key={`m-${i}`} className="border-b border-stone-100 last:border-b-0">
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
  open,
  onToggle,
}: {
  run: Run
  finding: Finding
  open: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-stone-100 last:border-b-0 hover:bg-stone-50"
        onClick={onToggle}
      >
        <td className="px-4 py-3 font-mono text-xs font-semibold">{finding.type}</td>
        <td className="px-4 py-3">
          <span
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
              BUCKET_STYLES[finding.bucket] ?? 'bg-stone-100 text-stone-600'
            }`}
          >
            {BUCKET_LABELS[finding.bucket] ?? finding.bucket}
          </span>
        </td>
        <td className="px-4 py-3 font-mono text-xs">{findingRefs(run, finding)}</td>
        <td className="px-4 py-3 text-right font-mono tabular-nums">
          {formatCentsGrouped(finding.amount)}
        </td>
        <td className="px-4 py-3 text-right text-xs text-stone-400">
          {open ? 'Hide' : 'Evidence'}
        </td>
      </tr>
      {open && <EvidenceRow finding={finding} />}
    </>
  )
}
