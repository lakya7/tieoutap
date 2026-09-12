import { useMemo } from 'react'
import statementSample from '../../../fixtures/meridian_stmt.csv?raw'
import ledgerSample from '../../../fixtures/acme_ledger.csv?raw'
import { formatCentsGrouped } from '../../../ts/src'
import { exceptionId, findingLabel, orderedFindings } from '../lib/labels'
import { deriveAsAt, deriveSupplier, executeRun } from '../lib/run'
import { SummaryBar } from './SummaryBar'

const SHOWN_ROWS = 4

const BUCKET_LABELS: Record<string, string> = {
  cash_at_risk: 'Cash at risk',
  unrecorded_liability: 'Unrecorded liability',
  investigate: 'Investigate',
  explained: 'Explained',
}

/** The actual results screen, live-rendered from the sample fixtures — the
 * same components and engine output the app shows, not a mock-up. */
export function ResultsShowcase({ onSampleRun }: { onSampleRun: () => void }) {
  const run = useMemo(
    () =>
      executeRun({
        statementCsv: statementSample,
        ledgerCsv: ledgerSample,
        supplier: deriveSupplier(ledgerSample),
        asAt: deriveAsAt(statementSample),
      }),
    [],
  )
  const findings = orderedFindings(run)

  return (
    <div className="border border-line bg-cream shadow-[0_1px_0_rgba(28,39,33,0.06)]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </span>
        <span className="ml-2 flex-1 truncate bg-paper px-3 py-1 font-mono text-xs text-ink-faint">
          tieoutap.com — sample reconciliation
        </span>
        <span className="shrink-0 rounded-full bg-moss px-2.5 py-0.5 text-xs font-semibold text-pine ring-1 ring-inset ring-pine/25">
          Live output
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        <SummaryBar run={run} />

        <div className="border border-line bg-paper">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
                  <th className="px-4 py-2.5 font-medium">ID</th>
                  <th className="px-4 py-2.5 font-medium">Exception</th>
                  <th className="px-4 py-2.5 font-medium">Bucket</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {findings.slice(0, SHOWN_ROWS).map((f, i) => (
                  <tr key={f.rule_id + f.amount}>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-faint">
                      {exceptionId(i)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-ink">{findingLabel(f.type)}</span>
                      <span className="mt-0.5 block font-mono text-xs uppercase tracking-wide text-ink-faint">
                        {f.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {BUCKET_LABELS[f.bucket] ?? f.bucket}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-ink">
                      {formatCentsGrouped(f.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {findings.length > SHOWN_ROWS && (
            <p className="border-t border-line px-4 py-2.5 text-sm text-ink-faint">
              + {findings.length - SHOWN_ROWS} more exception
              {findings.length - SHOWN_ROWS === 1 ? '' : 's'} — plus the signed bridge, the
              drafted supplier email, and the Excel audit pack in the live run.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onSampleRun}
          className="w-full rounded-sm bg-ink px-4 py-3 text-sm font-semibold text-paper transition-colors hover:bg-pine-deep"
        >
          Open this exact run live — no signup
        </button>
      </div>
    </div>
  )
}
