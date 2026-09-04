import { useRef, useState } from 'react'
import statementSample from '../../../fixtures/meridian_stmt.csv?raw'
import ledgerSample from '../../../fixtures/acme_ledger.csv?raw'
import { deriveAsAt, deriveSupplier } from '../lib/run'
import type { RunInput } from '../lib/run'
import {
  documentMediaType,
  extractDocument,
  linesToStatementCsv,
  refusalMessage,
} from '../lib/extract'

interface FileDropProps {
  label: string
  hint: string
  fileName: string | null
  accept: string
  busy?: boolean
  onText: (name: string, text: string) => void
  onDocument?: (file: File, mediaType: string) => void
}

function FileDrop({
  label,
  hint,
  fileName,
  accept,
  busy,
  onText,
  onDocument,
}: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const readSeq = useRef(0)
  const [dragging, setDragging] = useState(false)

  const readFile = (file: File | undefined) => {
    if (!file) return
    const mediaType = onDocument ? documentMediaType(file) : null
    if (mediaType && onDocument) {
      onDocument(file, mediaType)
      return
    }
    const seq = ++readSeq.current
    const reader = new FileReader()
    reader.onload = () => {
      if (seq === readSeq.current) onText(file.name, String(reader.result))
    }
    reader.readAsText(file)
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        readFile(e.dataTransfer.files[0])
      }}
      className={`flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
        dragging
          ? 'border-emerald-500 bg-emerald-50'
          : fileName
            ? 'border-emerald-400 bg-emerald-50/50'
            : 'border-stone-300 bg-white hover:border-stone-400'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => readFile(e.target.files?.[0])}
      />
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      {busy ? (
        <span className="text-xs text-stone-500">Reading the statement…</span>
      ) : fileName ? (
        <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-xs text-emerald-800">
          {fileName}
        </span>
      ) : (
        <span className="text-xs text-stone-500">{hint}</span>
      )}
    </button>
  )
}

interface UploadPanelProps {
  onRun: (input: RunInput) => void
  error: string | null
}

export function UploadPanel({ onRun, error }: UploadPanelProps) {
  const [statement, setStatement] = useState<{ name: string; text: string } | null>(null)
  const [ledger, setLedger] = useState<{ name: string; text: string } | null>(null)
  const [supplier, setSupplier] = useState('')
  const [asAt, setAsAt] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractionNote, setExtractionNote] = useState<
    { kind: 'ok' | 'error'; text: string } | null
  >(null)
  const supplierAuto = useRef(true)
  const asAtAuto = useRef(true)
  const extractSeq = useRef(0)

  const runExtraction = (file: File, mediaType: string) => {
    const seq = ++extractSeq.current
    setExtracting(true)
    setExtractionNote(null)
    void extractDocument(file, mediaType)
      .then((result) => {
        if (seq !== extractSeq.current) return
        if (!result.ok) {
          setExtractionNote({ kind: 'error', text: refusalMessage(result) })
          return
        }
        setStatement({ name: file.name, text: linesToStatementCsv(result.lines) })
        if (supplierAuto.current || !supplier) setSupplier(result.supplier)
        if (asAtAuto.current || !asAt) setAsAt(result.as_at)
        setExtractionNote({
          kind: 'ok',
          text: `Read ${result.lines.length} lines from ${file.name}; they add up to the statement’s printed closing balance.`,
        })
      })
      .catch((e: unknown) => {
        if (seq !== extractSeq.current) return
        setExtractionNote({
          kind: 'error',
          text: `Could not reach the extraction service: ${e instanceof Error ? e.message : String(e)}`,
        })
      })
      .finally(() => {
        if (seq === extractSeq.current) setExtracting(false)
      })
  }

  const ready = statement !== null && ledger !== null && supplier !== '' && asAt !== ''

  const loadSample = () => {
    setStatement({ name: 'meridian_stmt.csv', text: statementSample })
    setLedger({ name: 'acme_ledger.csv', text: ledgerSample })
    setSupplier(deriveSupplier(ledgerSample))
    setAsAt(deriveAsAt(statementSample))
    supplierAuto.current = true
    asAtAuto.current = true
    extractSeq.current++
    setExtracting(false)
    setExtractionNote(null)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Start a reconciliation run</h2>
        <p className="mt-1 text-sm text-stone-500">
          Upload the supplier statement and your AP open-items export. Reconciliation runs
          in your browser; only a PDF or image statement is sent to the server, to be read
          into lines.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FileDrop
            label="Supplier statement (PDF, image or CSV)"
            hint="PDF/PNG/JPG are read for you; CSV columns: ref, date, type, amount, po, currency"
            accept=".csv,text/csv,.pdf,application/pdf,image/png,image/jpeg,image/gif,image/webp"
            busy={extracting}
            fileName={statement?.name ?? null}
            onDocument={runExtraction}
            onText={(name, text) => {
              extractSeq.current++
              setExtracting(false)
              setExtractionNote(null)
              setStatement({ name, text })
              if (asAtAuto.current || !asAt) setAsAt(deriveAsAt(text))
            }}
          />
          <FileDrop
            label="AP open-items export (CSV)"
            hint="columns: supplier, ref, date, type, original, open, po, currency"
            accept=".csv,text/csv"
            fileName={ledger?.name ?? null}
            onText={(name, text) => {
              setLedger({ name, text })
              if (supplierAuto.current || !supplier) setSupplier(deriveSupplier(text))
            }}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Supplier
            </span>
            <input
              type="text"
              value={supplier}
              onChange={(e) => {
                supplierAuto.current = false
                setSupplier(e.target.value)
              }}
              placeholder="MERIDIAN IND SUPPLIES"
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Statement as-at date
            </span>
            <input
              type="date"
              value={asAt}
              onChange={(e) => {
                asAtAuto.current = false
                setAsAt(e.target.value)
              }}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </label>
        </div>
        {extractionNote && (
          <p
            className={`mt-4 rounded-md border px-3 py-2 text-sm ${
              extractionNote.kind === 'ok'
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {extractionNote.text}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={loadSample}
            className="text-sm text-stone-500 underline decoration-dotted underline-offset-4 hover:text-stone-700"
          >
            Load sample data
          </button>
          <button
            type="button"
            disabled={!ready || extracting}
            onClick={() =>
              ready &&
              onRun({
                statementCsv: statement.text,
                ledgerCsv: ledger.text,
                supplier,
                asAt,
              })
            }
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            Reconcile
          </button>
        </div>
      </div>
    </div>
  )
}
