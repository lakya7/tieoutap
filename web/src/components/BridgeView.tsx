import { formatCentsGrouped } from '../../../ts/src'
import type { Bridge } from '../../../ts/src'

export function BridgeView({ bridge }: { bridge: Bridge }) {
  let running = bridge.ledger_open_total
  const rows = bridge.adjustments.map((adj) => {
    running += adj.amount
    return { adj, running }
  })

  return (
    <div className="overflow-hidden border border-line bg-cream">
      <table className="w-full text-left text-sm">
        <tbody>
          <tr className="border-b border-line bg-paper font-semibold">
            <td className="px-4 py-3">Ledger open total</td>
            <td className="px-4 py-3 font-mono text-xs" />
            <td className="px-4 py-3 text-right font-mono tabular-nums" />
            <td className="px-4 py-3 text-right font-mono tabular-nums">
              {formatCentsGrouped(bridge.ledger_open_total)}
            </td>
          </tr>
          {rows.map(({ adj, running }, i) => (
            <tr key={i} className="border-b border-line/60">
              <td className="px-4 py-3">{adj.label}</td>
              <td className="px-4 py-3 font-mono text-xs text-ink-faint">{adj.ref}</td>
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
          <tr className="bg-paper font-semibold">
            <td className="px-4 py-3">Statement total</td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3 text-right">
              {bridge.ties_out ? (
                <span className="bg-moss px-2 py-0.5 text-xs font-semibold text-pine-deep">
                  ties out
                </span>
              ) : (
                <span className="bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                  does not tie
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
        </tbody>
      </table>
    </div>
  )
}
