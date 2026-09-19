import { useRef, useState } from 'react'
import { formatCentsGrouped } from '../../../ts/src'
import { checkLedger, ledgerSuppliers, runBatch, runBatchItem } from '../lib/batch'
import type { BatchSession, BatchStatement } from '../lib/batch'
import type { Run } from '../lib/run'
import { fileToRawCsv, hasEngineColumns } from '../lib/tabular'

const TABULAR_ACCEPT =
  '.csv,.tsv,.txt,.xlsx,.xls,.xlsm,.xlsb,.ods,text/csv,text/tab-separated-values,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

let nextStatementId = 1

interface BatchPanelProps {
  session: BatchSession
  onSession: (update: (prev: BatchSession) => BatchSession) => void
  onOpen: (run: Run) => void
  onSingle: () => void
}

export function BatchPanel({ session, onSession, onOpen, onSingle }: BatchPanelProps) {
  const { statements, ledger, items } = session
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const stmtInputRef = useRef<HTMLInputElement>(null)
  const ledgerInputRef = useRef<HTMLInputElement>(null)

  const addStatements = (files: FileList | null) => {
    if (!files || files.length === 0) return
    void Promise.allSettled(
      [...files].map(async (file) => {
        const text = await fileToRawCsv(file)
        if (!hasEngineColumns(text)) {
          throw new Error(
            `${file.name}: columns don't use the standard names — reconcile it in single-run mode, where AI column mapping is available.`,
          )
        }
        return { id: `s${nextStatementId++}`, name: file.name, csv: text }
      }),
    ).then((results) => {
      const ok: BatchStatement[] = []
      const errors: string[] = []
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') ok.push(r.value)
        else {
          const detail = r.reason instanceof Error ? r.reason.message : String(r.reason)
          errors.push(detail.includes(':') ? detail : `${files[i].name}: ${detail}`)
        }
      })
      onSession((prev) => ({ ...prev, statements: [...prev.statements, ...ok] }))
      setFileErrors(errors)
    })
  }

  const readLedger = (file: File | undefined) => {
    if (!file) return
    void fileToRawCsv(file)
      .then((text) => {
        if (!hasEngineColumns(text)) {
          setFileErrors([
            `${file.name}: columns don't use the standard names — map it once in single-run mode (the mapping is saved), or rename the columns in the export.`,
          ])
          return
        }
        const ledgerError = checkLedger(text)
        if (ledgerError !== null) {
          setFileErrors([
            `${file.name} doesn't parse as an AP open-items export (${ledgerError}) — it needs supplier, ref, date, type, original, open, po, and currency columns.`,
          ])
          return
        }
        setFileErrors([])
        onSession((prev) => ({ ...prev, ledger: { name: file.name, text } }))
      })
      .catch((e: unknown) => {
        setFileErrors([
          `Could not read ${file.name}: ${e instanceof Error ? e.message : String(e)}`,
        ])
      })
  }

  const ready = statements.length > 0 && ledger !== null

  const reconcileAll = () => {
    if (!ledger) return
    try {
      const nextItems = runBatch(statements, ledger.text, ledger.name)
      onSession((prev) => ({ ...prev, items: nextItems }))
    } catch (e) {
      setFileErrors([
        `Could not reconcile against ${ledger.name}: ${e instanceof Error ? e.message : String(e)}`,
      ])
    }
  }

  const overrideSupplier = (index: number, supplier: string) => {
    if (!items || !ledger) return
    const next = items.slice()
    next[index] = runBatchItem(items[index].statement, ledger.text, ledger.name, supplier)
    onSession((prev) => ({ ...prev, items: next }))
  }

  if (items !== null && ledger !== null) {
    const suppliers = ledgerSuppliers(ledger.text)
    return (
      <div className="mx-auto max-w-5xl">
        <div className="border border-line bg-cream p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
                Batch run
              </p>
              <h2 className="mt-2 font-serif text-2xl font-medium tracking-tight text-ink">
                {items.length} statement{items.length === 1 ? '' : 's'} against{' '}
                <span className="font-mono text-lg">{ledger.name}</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onSession((prev) => ({ ...prev, items: null }))}
              className="text-sm text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
            >
              Change files
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
                  <th className="py-2 pr-4 font-medium">Statement file</th>
                  <th className="py-2 pr-4 font-medium">Supplier</th>
                  <th className="py-2 pr-4 font-medium">As at</th>
                  <th className="py-2 pr-4 text-right font-medium">Statement</th>
                  <th className="py-2 pr-4 text-right font-medium">Ledger open</th>
                  <th className="py-2 pr-4 text-right font-medium">Unexplained</th>
                  <th className="py-2 pr-4 text-right font-medium">Exceptions</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const bridge = item.run?.result.bridge
                  const unexplained = bridge
                    ? bridge.statement_total -
                      bridge.ledger_open_total -
                      bridge.adjustments.reduce((sum, adj) => sum + adj.amount, 0)
                    : null
                  return (
                    <tr key={item.statement.id} className="border-b border-line/50 align-top last:border-b-0">
                      <td className="max-w-[16rem] truncate py-2 pr-4 font-mono text-xs" title={item.statement.name}>
                        {item.statement.name}
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={item.supplier}
                          onChange={(e) => overrideSupplier(i, e.target.value)}
                          className="max-w-[14rem] border border-line bg-paper px-2 py-1 text-xs"
                          aria-label={`Supplier for ${item.statement.name}`}
                        >
                          <option value="">Pick supplier…</option>
                          {suppliers.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {item.error !== null && (
                          <span className="mt-1 block max-w-[14rem] text-xs text-amber-300">
                            {item.error}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{item.asAt || '—'}</td>
                      <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums">
                        {bridge ? formatCentsGrouped(bridge.statement_total) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums">
                        {bridge ? formatCentsGrouped(bridge.ledger_open_total) : '—'}
                      </td>
                      <td
                        className={`py-2 pr-4 text-right font-mono text-xs tabular-nums ${
                          unexplained === null ? '' : unexplained === 0 ? 'text-pine-deep' : 'text-red-300'
                        }`}
                      >
                        {unexplained === null ? '—' : formatCentsGrouped(unexplained)}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums">
                        {item.run ? item.run.result.findings.length : '—'}
                      </td>
                      <td className="whitespace-nowrap py-2 text-right">
                        {item.run && (
                          <button
                            type="button"
                            onClick={() => onOpen(item.run as Run)}
                            className="btn-gold px-3 py-1 text-xs font-semibold"
                          >
                            Open
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Each row is a full deterministic reconciliation of that statement against the
            supplier&rsquo;s rows in the shared AP export — open one for its exception
            queue, bridge, and email draft. Suppliers are matched by document-reference
            overlap; where the tool couldn&rsquo;t tell, pick the supplier yourself.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="border border-line bg-cream p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
              Batch run
            </p>
            <h2 className="mt-2 font-serif text-2xl font-medium tracking-tight text-ink">
              Reconcile several suppliers at once
            </h2>
          </div>
          <button
            type="button"
            onClick={onSingle}
            className="text-sm text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
          >
            Single statement instead
          </button>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          Upload several supplier statements and one AP open-items export covering those
          suppliers. Everything runs in your browser. Statements must be CSV, TSV, or
          Excel with the standard columns — PDF reading and AI column mapping are
          available in single-run mode.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => stmtInputRef.current?.click()}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-line bg-paper p-4 text-center hover:border-ink-faint"
          >
            <input
              ref={stmtInputRef}
              type="file"
              multiple
              accept={TABULAR_ACCEPT}
              className="hidden"
              onChange={(e) => {
                addStatements(e.target.files)
                e.target.value = ''
              }}
            />
            <span className="text-sm font-semibold text-ink">
              Supplier statements (CSV / Excel, several at once)
            </span>
            {statements.length > 0 ? (
              <span className="bg-moss px-2 py-0.5 font-mono text-xs text-pine-deep">
                {statements.length} file{statements.length === 1 ? '' : 's'} selected
              </span>
            ) : (
              <span className="text-xs text-ink-faint">
                Columns: ref, date, type, amount, po, currency — one supplier per file
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => ledgerInputRef.current?.click()}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-line bg-paper p-4 text-center hover:border-ink-faint"
          >
            <input
              ref={ledgerInputRef}
              type="file"
              accept={TABULAR_ACCEPT}
              className="hidden"
              onChange={(e) => {
                readLedger(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <span className="text-sm font-semibold text-ink">
              AP open-items export (CSV / Excel, all suppliers)
            </span>
            {ledger ? (
              <span className="bg-moss px-2 py-0.5 font-mono text-xs text-pine-deep">
                {ledger.name}
              </span>
            ) : (
              <span className="text-xs text-ink-faint">
                Columns: supplier, ref, date, type, original, open, po, currency
              </span>
            )}
          </button>
        </div>
        {statements.length > 0 && (
          <ul className="mt-3 space-y-1">
            {statements.map((s) => (
              <li key={s.id} className="flex items-center gap-2 font-mono text-xs text-ink-soft">
                {s.name}
                <button
                  type="button"
                  onClick={() =>
                    onSession((prev) => ({
                      ...prev,
                      statements: prev.statements.filter((p) => p.id !== s.id),
                    }))
                  }
                  className="text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
                  aria-label={`Remove ${s.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {fileErrors.length > 0 && (
          <div className="mt-4 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            {fileErrors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={!ready}
            onClick={reconcileAll}
            className="btn-gold px-6 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
          >
            Reconcile all
          </button>
        </div>
      </div>
    </div>
  )
}
