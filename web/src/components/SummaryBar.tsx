import { formatCentsGrouped } from '../../../ts/src'
import { runId } from '../lib/labels'
import type { Run } from '../lib/run'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-faint">{label}</div>
      <div className="mt-0.5 font-mono text-lg tabular-nums text-ink">{value}</div>
    </div>
  )
}

export function SummaryBar({ run }: { run: Run }) {
  const { result } = run
  const { bridge } = result
  const initialVariance = bridge.statement_total - bridge.ledger_open_total
  const explained = bridge.adjustments.reduce((sum, adj) => sum + adj.amount, 0)
  const unexplained = initialVariance - explained
  const cashAtRisk = result.findings
    .filter((f) => f.bucket === 'cash_at_risk')
    .reduce((sum, f) => sum + f.amount, 0)
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
          <Stat label="Statement balance" value={formatCentsGrouped(bridge.statement_total)} />
          <Stat label="Ledger open balance" value={formatCentsGrouped(bridge.ledger_open_total)} />
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
          {result.findings.length} exception{result.findings.length === 1 ? '' : 's'} to review
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
      {result.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {result.warnings.map((w) => (
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
