import { formatCentsGrouped } from '../../../ts/src'
import type { ReconcileResult } from '../../../ts/src'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-faint">{label}</div>
      <div className="mt-0.5 font-mono text-lg tabular-nums text-ink">{value}</div>
    </div>
  )
}

export function SummaryBar({ result }: { result: ReconcileResult }) {
  const { bridge } = result
  const gap = bridge.statement_total - bridge.ledger_open_total
  return (
    <div className="border border-line bg-cream p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-medium tracking-tight text-ink">{result.supplier}</h2>
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">Statement as at {result.as_at}</p>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <Stat label="Statement total" value={formatCentsGrouped(bridge.statement_total)} />
          <Stat label="Ledger open total" value={formatCentsGrouped(bridge.ledger_open_total)} />
          <Stat label="Gap" value={formatCentsGrouped(gap)} />
          {bridge.ties_out ? (
            <span className="bg-moss px-3 py-1 text-sm font-semibold text-pine-deep">
              Ties out exactly
            </span>
          ) : (
            <span className="bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
              Does not tie
            </span>
          )}
        </div>
      </div>
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
