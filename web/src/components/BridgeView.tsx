import { formatCentsGrouped } from '../../../ts/src'
import type { Bridge } from '../../../ts/src'

/** Horizontal waterfall bar: totals draw from zero, adjustments draw the
 * span between the previous and new running balance. */
function Bar({
  from,
  to,
  max,
  tone,
}: {
  from: number
  to: number
  max: number
  tone: 'total' | 'up' | 'down'
}) {
  if (max <= 0) return null
  const lo = Math.max(0, Math.min(from, to))
  const hi = Math.max(from, to)
  const left = (lo / max) * 100
  const width = Math.max(((hi - lo) / max) * 100, 0.75)
  const color =
    tone === 'total' ? 'bg-ink' : tone === 'up' ? 'bg-pine' : 'bg-red-400'
  return (
    <div aria-hidden="true" className="relative h-3 w-full min-w-24 bg-paper">
      <div
        className={`absolute inset-y-0 ${color}`}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </div>
  )
}

export function BridgeView({ bridge }: { bridge: Bridge }) {
  let running = bridge.ledger_open_total
  const rows = bridge.adjustments.map((adj) => {
    const from = running
    running += adj.amount
    return { adj, from, running }
  })
  const explained = bridge.adjustments.reduce((sum, adj) => sum + adj.amount, 0)
  const unexplained = bridge.statement_total - running
  const max = Math.max(
    bridge.ledger_open_total,
    bridge.statement_total,
    ...rows.map((r) => Math.max(r.from, r.running)),
    1,
  )

  return (
    <div className="space-y-4">
      <p className="border border-line bg-cream px-4 py-3 font-mono text-xs text-ink-soft sm:text-sm">
        <span className="text-ink">AP ledger open {formatCentsGrouped(bridge.ledger_open_total)}</span>
        {' '}{explained >= 0 ? '+' : '−'} explained adjustments{' '}
        <span className="text-ink">{formatCentsGrouped(Math.abs(explained))}</span>
        {' '}={' '}
        <span className="text-ink">supplier statement {formatCentsGrouped(bridge.statement_total)}</span>
        <span className={unexplained === 0 ? 'text-pine-deep' : 'text-red-800'}>
          {' '}· Unexplained {formatCentsGrouped(unexplained)}
        </span>
      </p>

      <div className="overflow-hidden border border-line bg-cream">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              <tr className="border-b border-line bg-paper font-semibold">
                <td className="px-4 py-3">Ledger open total</td>
                <td className="px-4 py-3 font-mono text-xs" />
                <td className="hidden w-28 px-4 py-3 align-middle sm:table-cell md:w-44">
                  <Bar from={0} to={bridge.ledger_open_total} max={max} tone="total" />
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums" />
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {formatCentsGrouped(bridge.ledger_open_total)}
                </td>
              </tr>
              {rows.map(({ adj, from, running }, i) => (
                <tr key={i} className="border-b border-line/60">
                  <td className="px-4 py-3">{adj.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-faint">{adj.ref}</td>
                  <td className="hidden w-28 px-4 py-3 align-middle sm:table-cell md:w-44">
                    <Bar
                      from={from}
                      to={running}
                      max={max}
                      tone={adj.amount >= 0 ? 'up' : 'down'}
                    />
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular-nums ${
                      adj.amount < 0 ? 'text-red-700' : 'text-pine'
                    }`}
                  >
                    {adj.amount >= 0 ? '+' : ''}
                    {formatCentsGrouped(adj.amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-faint">
                    {formatCentsGrouped(running)}
                  </td>
                </tr>
              ))}
              <tr className="border-b border-line bg-paper font-semibold">
                <td className="px-4 py-3">Statement total</td>
                <td className="px-4 py-3" />
                <td className="hidden w-28 px-4 py-3 align-middle sm:table-cell md:w-44">
                  <Bar from={0} to={bridge.statement_total} max={max} tone="total" />
                </td>
                <td className="px-4 py-3 text-right">
                  {bridge.ties_out ? (
                    <span className="bg-moss px-2 py-0.5 text-xs font-semibold text-pine-deep">
                      fully explained
                    </span>
                  ) : (
                    <span className="bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      does not reconcile
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-block font-mono tabular-nums">
                    {formatCentsGrouped(bridge.statement_total)}
                    {bridge.ties_out && <span className="double-rule mt-1 block text-pine" />}
                  </span>
                </td>
              </tr>
              <tr className="bg-paper">
                <td className="px-4 py-3 text-sm text-ink-soft">Unexplained variance</td>
                <td className="px-4 py-3" />
                <td className="hidden px-4 py-3 sm:table-cell" />
                <td className="px-4 py-3" />
                <td
                  className={`px-4 py-3 text-right font-mono tabular-nums ${
                    bridge.ties_out ? 'text-pine-deep' : 'text-red-800'
                  }`}
                >
                  {formatCentsGrouped(unexplained)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
