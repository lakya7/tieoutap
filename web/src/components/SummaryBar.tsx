import { useEffect, useState } from 'react'
import { formatCentsGrouped } from '../../../ts/src'
import { exceptionId, orderedFindings, runId, runStorageKey } from '../lib/labels'
import type { Run } from '../lib/run'
import { DEFAULT_STATUS, loadStatuses, subscribeStatuses } from '../lib/statuses'
import type { RunStatuses } from '../lib/statuses'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">{label}</div>
      <div className="mt-0.5 font-mono text-lg tabular-nums text-ink">{value}</div>
    </div>
  )
}

export function SummaryBar({ run }: { run: Run }) {
  const { result } = run
  const { bridge } = result
  const storageId = runStorageKey(run)
  const [statuses, setStatuses] = useState<RunStatuses>(() => loadStatuses(storageId))
  useEffect(() => {
    setStatuses(loadStatuses(storageId))
    return subscribeStatuses(() => setStatuses(loadStatuses(storageId)))
  }, [storageId])
  const initialVariance = bridge.statement_total - bridge.ledger_open_total
  const explained = bridge.adjustments.reduce((sum, adj) => sum + adj.amount, 0)
  const unexplained = initialVariance - explained
  const cashAtRisk = result.findings
    .filter((f) => f.bucket === 'cash_at_risk')
    .reduce((sum, f) => sum + f.amount, 0)
  const openActions = orderedFindings(run).filter((_, i) => {
    const s = statuses[exceptionId(i)] ?? DEFAULT_STATUS
    return s !== 'resolved' && s !== 'accepted'
  }).length
  const singleCurrency = (values: string[]): string | null => {
    const set = [...new Set(values.filter((c) => c !== ''))]
    return set.length === 1 ? set[0] : null
  }
  const stmtCurrency = singleCurrency(run.statement.map((l) => l.currency))
  const ledgerCurrency = singleCurrency(
    run.ledger.filter((l) => l.supplier === result.supplier).map((l) => l.currency),
  )
  return (
    <div className="border border-line bg-cream p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-medium tracking-tight text-ink">{result.supplier}</h2>
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
            Statement as at {result.as_at} · Run {runId(run)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <Stat
            label={stmtCurrency ? `Statement balance (${stmtCurrency})` : 'Statement balance'}
            value={formatCentsGrouped(bridge.statement_total)}
          />
          <Stat
            label={ledgerCurrency ? `Ledger open balance (${ledgerCurrency})` : 'Ledger open balance'}
            value={formatCentsGrouped(bridge.ledger_open_total)}
          />
          <Stat label="Initial variance" value={formatCentsGrouped(initialVariance)} />
          <Stat label="Explained" value={formatCentsGrouped(explained)} />
          <Stat label="Unexplained" value={formatCentsGrouped(unexplained)} />
          {bridge.ties_out ? (
            <span className="bg-moss px-3 py-1 text-sm font-semibold text-pine-deep">
              Variance fully explained
            </span>
          ) : (
            <span className="bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
              Unexplained variance
            </span>
          )}
        </div>
      </div>
      {(result.findings.length > 0 || cashAtRisk > 0) && (
        <p className="mt-3 text-sm text-ink-soft">
          {result.findings.length} exception{result.findings.length === 1 ? '' : 's'}
          {' · '}
          <span className={openActions > 0 ? 'font-semibold text-ink' : ''}>
            {openActions} open action{openActions === 1 ? '' : 's'}
          </span>
          {' · review '}
          {openActions === 0 ? (
            <span className="font-semibold text-pine-deep">complete</span>
          ) : (
            'in progress'
          )}
          {cashAtRisk > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-red-800">
                {formatCentsGrouped(cashAtRisk)} cash at risk
              </span>
            </>
          )}
        </p>
      )}
      {(result.warnings.length > 0 || run.inputWarnings.length > 0) && (
        <ul className="mt-3 space-y-1">
          {[...result.warnings, ...run.inputWarnings].map((w) => (
            <li
              key={w}
              className="border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800"
            >
              {w}
            </li>
          ))}
        </ul>
      )}
      {result.diagnostic && (
        <p className="mt-3 border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">
          {result.diagnostic}
        </p>
      )}
    </div>
  )
}
