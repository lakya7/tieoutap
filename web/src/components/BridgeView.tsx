import { formatCentsGrouped } from '../../../ts/src'
import type { Bridge } from '../../../ts/src'

export function BridgeView({ bridge }: { bridge: Bridge }) {
  let running = bridge.ledger_open_total
  const rows = bridge.adjustments.map((adj) => {
    running += adj.amount
    return { adj, running }
  })

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <tbody>
          <tr className="border-b border-stone-200 bg-stone-50 font-semibold">
            <td className="px-4 py-3">Ledger open total</td>
            <td className="px-4 py-3 font-mono text-xs" />
            <td className="px-4 py-3 text-right font-mono tabular-nums" />
            <td className="px-4 py-3 text-right font-mono tabular-nums">
              {formatCentsGrouped(bridge.ledger_open_total)}
            </td>
          </tr>
          {rows.map(({ adj, running }, i) => (
            <tr key={i} className="border-b border-stone-100">
              <td className="px-4 py-3">{adj.label}</td>
              <td className="px-4 py-3 font-mono text-xs text-stone-500">{adj.ref}</td>
              <td
                className={`px-4 py-3 text-right font-mono tabular-nums ${
                  adj.amount < 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {adj.amount >= 0 ? '+' : ''}
                {formatCentsGrouped(adj.amount)}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-400">
                {formatCentsGrouped(running)}
              </td>
            </tr>
          ))}
          <tr className="bg-stone-50 font-semibold">
            <td className="px-4 py-3">Statement total</td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3 text-right">
              {bridge.ties_out ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  ties out
                </span>
              ) : (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                  does not tie
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-right font-mono tabular-nums">
              {formatCentsGrouped(bridge.statement_total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
