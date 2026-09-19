import { useEffect, useState } from 'react'
import { formatCentsGrouped } from '../../../ts/src'
import {
  clearHistory,
  loadHistory,
  removeHistoryEntry,
  subscribeHistory,
} from '../lib/history'
import type { HistoryEntry } from '../lib/history'
import type { RunInput } from '../lib/run'
import { decodeRun } from '../lib/share'

export function RunHistory({ onOpen }: { onOpen: (input: RunInput) => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory)
  useEffect(() => subscribeHistory(() => setEntries(loadHistory())), [])

  if (entries.length === 0) return null

  const open = (entry: HistoryEntry) => {
    const input = decodeRun(entry.encoded)
    if (input) onOpen(input)
    else removeHistoryEntry(entry.key)
  }

  return (
    <div className="mx-auto mt-6 max-w-3xl border border-line bg-cream p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
            Past runs
          </p>
          <h3 className="mt-1 font-serif text-lg font-medium text-ink">
            Reopen a previous reconciliation
          </h3>
        </div>
        <button
          type="button"
          onClick={clearHistory}
          className="text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
        >
          Clear history
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        Saved in this browser only — reopening re-runs the same files through the
        deterministic engine.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
              <th className="py-2 pr-4 font-medium">Supplier</th>
              <th className="py-2 pr-4 font-medium">As at</th>
              <th className="py-2 pr-4 text-right font-medium">Statement</th>
              <th className="py-2 pr-4 text-right font-medium">Unexplained</th>
              <th className="py-2 pr-4 text-right font-medium">Exceptions</th>
              <th className="py-2 pr-4 font-medium">Run</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.key} className="border-b border-line/50 last:border-b-0">
                <td className="py-2 pr-4 font-medium text-ink">{e.supplier || '—'}</td>
                <td className="py-2 pr-4 font-mono text-xs">{e.asAt || '—'}</td>
                <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums">
                  {formatCentsGrouped(e.statementTotal)}
                </td>
                <td
                  className={`py-2 pr-4 text-right font-mono text-xs tabular-nums ${
                    e.unexplained === 0 ? 'text-pine-deep' : 'text-red-300'
                  }`}
                >
                  {formatCentsGrouped(e.unexplained)}
                </td>
                <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums">
                  {e.exceptions}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-ink-faint">
                  {e.id}
                  <span className="block">{e.savedAt.slice(0, 10)}</span>
                </td>
                <td className="whitespace-nowrap py-2 text-right">
                  <button
                    type="button"
                    onClick={() => open(e)}
                    className="btn-gold px-3 py-1 text-xs font-semibold"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => removeHistoryEntry(e.key)}
                    className="ml-2 text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
                    aria-label={`Remove ${e.id} from history`}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
