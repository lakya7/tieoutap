import { useRef, useState } from 'react'
import statementSample from '../../../fixtures/meridian_stmt.csv?raw'
import ledgerSample from '../../../fixtures/acme_ledger.csv?raw'
import { deriveAsAt, deriveSupplier } from '../lib/run'
import type { RunInput } from '../lib/run'
import { fileToRawCsv, hasEngineColumns } from '../lib/tabular'
import { applyMapping, describeMapping, requestMapping } from '../lib/ai'
import { forgetMapping, loadSavedMapping, saveMapping } from '../lib/mappings'
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
  onUnmapped: (name: string, csv: string) => void
  onDocument?: (file: File, mediaType: string) => void
}

function FileDrop({
  label,
  hint,
  fileName,
  accept,
  busy,
  onText,
  onUnmapped,
  onDocument,
}: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const readSeq = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)

  const readFile = (file: File | undefined) => {
    if (!file) return
    const seq = ++readSeq.current
    const mediaType = onDocument ? documentMediaType(file) : null
    if (mediaType && onDocument) {
      setReadError(null)
      onDocument(file, mediaType)
      return
    }
    fileToRawCsv(file)
      .then((text) => {
        if (seq !== readSeq.current) return
        setReadError(null)
        if (hasEngineColumns(text)) onText(file.name, text)
        else onUnmapped(file.name, text)
      })
      .catch((e: unknown) => {
        if (seq !== readSeq.current) return
        setReadError(`Could not read ${file.name}: ${e instanceof Error ? e.message : String(e)}`)
      })
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
      className={`flex h-40 w-full flex-col items-center justify-center gap-2 border-2 border-dashed p-4 text-center transition-colors ${
        dragging
          ? 'border-pine bg-moss'
          : fileName
            ? 'border-pine/60 bg-moss/50'
            : 'border-line bg-paper hover:border-ink-faint'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => readFile(e.target.files?.[0])}
      />
      <span className="text-sm font-semibold text-ink">{label}</span>
      {busy ? (
        <span className="text-xs text-ink-faint">Reading the statement…</span>
      ) : readError ? (
        <span className="px-2 text-xs text-red-600">{readError}</span>
      ) : fileName ? (
        <span className="bg-moss px-2 py-0.5 font-mono text-xs text-pine-deep">
          {fileName}
        </span>
      ) : (
        <span className="text-xs text-ink-faint">{hint}</span>
      )}
    </button>
  )
}

const ERP_REPORTS: [string, string][] = [
  ['Oracle Fusion Cloud', 'Payables Trial Balance report, filtered to the supplier, exported to Excel'],
  ['Oracle EBS', 'Accounts Payable Trial Balance report, restricted to the supplier and as-of date'],
  ['SAP', 'Vendor Line Items (FBL1N) with the Open Items view, exported to a spreadsheet'],
  ['NetSuite', 'A/P Aging Detail report, or a saved search of open vendor bills'],
  ['QuickBooks', 'Accounts Payable Aging Detail report for the supplier'],
  ['Xero', 'Aged Payables Detail report for the supplier'],
]

/** Explains which ERP report produces the AP open-items file. */
function ReportHelp() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
      >
        Not sure which report to export from your ERP? {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-2 border border-line bg-paper px-4 py-3 text-sm text-ink-soft">
          <p>
            Any export works as long as each row is one <strong>open (unpaid or
            partially paid) document</strong> as of the statement date, and includes
            the supplier name, document reference, date, original amount, and
            remaining open amount. Common report names:
          </p>
          <ul className="mt-2 space-y-1">
            {ERP_REPORTS.map(([system, report]) => (
              <li key={system}>
                <span className="font-semibold text-ink">{system}:</span> {report}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-faint">
            Column names don&rsquo;t have to match &mdash; AI column mapping renames
            them for you from just the header row and three sample values.
          </p>
        </div>
      )}
    </div>
  )
}

interface UploadPanelProps {
  onRun: (input: RunInput, opts?: { sample?: boolean }) => void
  error: string | null
}

type MapKind = 'statement' | 'ledger'

interface MapOffer {
  name: string
  csv: string
  status: 'offer' | 'busy' | 'error'
  detail?: string
  saved?: Record<string, string>
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
  const [mapOffers, setMapOffers] = useState<Partial<Record<MapKind, MapOffer>>>({})
  const [isSample, setIsSample] = useState(false)
  const supplierAuto = useRef(true)
  const asAtAuto = useRef(true)
  const extractSeq = useRef(0)
  const mapSeq = useRef(0)

  const offerMapping = (kind: MapKind) => (name: string, csv: string) => {
    mapSeq.current++
    const saved = loadSavedMapping(kind, csv) ?? undefined
    setMapOffers((prev) => ({ ...prev, [kind]: { name, csv, status: 'offer', saved } }))
  }

  const clearMapOffer = (kind: MapKind) => {
    mapSeq.current++
    setMapOffers((prev) => ({ ...prev, [kind]: undefined }))
  }

  const acceptMapping = (
    kind: MapKind,
    offer: MapOffer,
    mapping: Record<string, string>,
    note: string,
  ) => {
    const mapped = applyMapping(offer.csv, mapping)
    setMapOffers((prev) => ({ ...prev, [kind]: undefined }))
    setIsSample(false)
    if (kind === 'statement') {
      setStatement({ name: offer.name, text: mapped })
      if (asAtAuto.current || !asAt) setAsAt(deriveAsAt(mapped))
    } else {
      setLedger({ name: offer.name, text: mapped })
      if (supplierAuto.current || !supplier) setSupplier(deriveSupplier(mapped))
    }
    setExtractionNote({ kind: 'ok', text: note })
  }

  const runMapping = (kind: MapKind) => {
    const offer = mapOffers[kind]
    if (!offer || offer.status === 'busy') return
    const seq = ++mapSeq.current
    setMapOffers((prev) => ({ ...prev, [kind]: { ...offer, status: 'busy' } }))
    void requestMapping(kind, offer.csv).then((res) => {
      if (seq !== mapSeq.current) return
      if (!res.ok) {
        setMapOffers((prev) => ({
          ...prev,
          [kind]: { ...offer, status: 'error', detail: res.detail },
        }))
        return
      }
      saveMapping(kind, offer.csv, res.mapping)
      acceptMapping(
        kind,
        offer,
        res.mapping,
        `AI mapped the columns in ${offer.name}: ${describeMapping(res.mapping)}. Saved for files with this layout — review before you rely on the run.`,
      )
    })
  }

  const applySavedMapping = (kind: MapKind) => {
    const offer = mapOffers[kind]
    if (!offer?.saved || offer.status === 'busy') return
    mapSeq.current++
    acceptMapping(
      kind,
      offer,
      offer.saved,
      `Applied your saved column mapping to ${offer.name}: ${describeMapping(offer.saved)}. Review before you rely on the run.`,
    )
  }

  const forgetSavedMapping = (kind: MapKind) => {
    const offer = mapOffers[kind]
    if (!offer?.saved) return
    forgetMapping(kind, offer.csv)
    setMapOffers((prev) => ({ ...prev, [kind]: { ...offer, saved: undefined } }))
  }

  const runExtraction = (file: File, mediaType: string) => {
    const seq = ++extractSeq.current
    setExtracting(true)
    setExtractionNote(null)
    setStatement(null)
    void extractDocument(file, mediaType)
      .then((result) => {
        if (seq !== extractSeq.current) return
        if (!result.ok) {
          setExtractionNote({ kind: 'error', text: refusalMessage(result) })
          return
        }
        setIsSample(false)
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
    setIsSample(true)
    setStatement({ name: 'meridian_stmt.csv', text: statementSample })
    setLedger({ name: 'acme_ledger.csv', text: ledgerSample })
    setSupplier(deriveSupplier(ledgerSample))
    setAsAt(deriveAsAt(statementSample))
    supplierAuto.current = true
    asAtAuto.current = true
    extractSeq.current++
    mapSeq.current++
    setExtracting(false)
    setExtractionNote(null)
    setMapOffers({})
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="border border-line bg-cream p-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">New run</p>
        <h2 className="mt-2 font-serif text-2xl font-medium tracking-tight text-ink">
          Start a reconciliation run
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Upload the supplier statement and your AP open-items export. Reconciliation runs
          in your browser. Server trips are opt-in and minimal: a PDF or image statement is
          read into lines then discarded, and AI column mapping sends only the header row
          plus three sample values — never the file.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FileDrop
            label="Supplier statement (PDF, image, CSV or Excel)"
            hint="PDF/PNG/JPG are read for you; CSV, TSV, or Excel — columns: ref, date, type, amount, po, currency"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.xlsb,.ods,text/csv,text/tab-separated-values,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.pdf,application/pdf,image/png,image/jpeg,image/gif,image/webp"
            busy={extracting}
            fileName={statement?.name ?? null}
            onUnmapped={offerMapping('statement')}
            onDocument={runExtraction}
            onText={(name, text) => {
              extractSeq.current++
              setExtracting(false)
              setExtractionNote(null)
              setIsSample(false)
              setStatement({ name, text })
              if (asAtAuto.current || !asAt) setAsAt(deriveAsAt(text))
            }}
          />
          <FileDrop
            label="AP open-items export (CSV / Excel)"
            hint="CSV, TSV, or Excel — columns: supplier, ref, date, type, original, open, po, currency"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.xlsb,.ods,text/csv,text/tab-separated-values,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            fileName={ledger?.name ?? null}
            onUnmapped={offerMapping('ledger')}
            onText={(name, text) => {
              setIsSample(false)
              setLedger({ name, text })
              if (supplierAuto.current || !supplier) setSupplier(deriveSupplier(text))
            }}
          />
        </div>
        <ReportHelp />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-faint">
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
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm focus:border-pine focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-faint">
              Statement as-at date
            </span>
            <input
              type="date"
              value={asAt}
              onChange={(e) => {
                asAtAuto.current = false
                setAsAt(e.target.value)
              }}
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm focus:border-pine focus:outline-none"
            />
          </label>
        </div>
        {(['statement', 'ledger'] as const).map((kind) => {
          const offer = mapOffers[kind]
          if (!offer) return null
          return (
            <div
              key={kind}
              className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              <p>
                <span className="font-mono">{offer.name}</span> doesn&rsquo;t use the standard
                column names.{' '}
                {offer.saved
                  ? 'It matches a column mapping you saved earlier: '
                  : 'AI can map them — only the header row and 3 sample values are sent, never the file.'}
                {offer.saved && (
                  <span className="font-mono text-xs">{describeMapping(offer.saved)}</span>
                )}
              </p>
              {offer.status === 'error' && (
                <p className="mt-1 text-red-700">Mapping failed: {offer.detail}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {offer.saved && (
                  <button
                    type="button"
                    disabled={offer.status === 'busy'}
                    onClick={() => applySavedMapping(kind)}
                    className="bg-ink px-3 py-1 text-xs font-semibold text-paper hover:bg-pine-deep disabled:cursor-not-allowed disabled:bg-ink-faint"
                  >
                    Apply saved mapping
                  </button>
                )}
                <button
                  type="button"
                  disabled={offer.status === 'busy'}
                  onClick={() => runMapping(kind)}
                  className={
                    offer.saved
                      ? 'text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine'
                      : 'bg-ink px-3 py-1 text-xs font-semibold text-paper hover:bg-pine-deep disabled:cursor-not-allowed disabled:bg-ink-faint'
                  }
                >
                  {offer.status === 'busy'
                    ? 'Mapping…'
                    : offer.status === 'error'
                      ? 'Try again'
                      : offer.saved
                        ? 'Remap with AI'
                        : 'Map columns with AI'}
                </button>
                {offer.saved && (
                  <button
                    type="button"
                    onClick={() => forgetSavedMapping(kind)}
                    className="text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
                  >
                    Forget saved mapping
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => clearMapOffer(kind)}
                  className="text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )
        })}
        {extractionNote && (
          <p
            className={`mt-4 border px-3 py-2 text-sm ${
              extractionNote.kind === 'ok'
                ? 'border-pine/30 bg-moss text-pine-deep'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {extractionNote.text}
          </p>
        )}
        {error && (
          <p className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={loadSample}
            className="text-sm text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
          >
            Load sample data
          </button>
          <button
            type="button"
            disabled={!ready || extracting}
            onClick={() =>
              ready &&
              onRun(
                {
                  statementCsv: statement.text,
                  ledgerCsv: ledger.text,
                  supplier,
                  asAt,
                },
                { sample: isSample },
              )
            }
            className="bg-ink px-6 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-pine-deep disabled:cursor-not-allowed disabled:bg-ink-faint"
          >
            Reconcile
          </button>
        </div>
      </div>
    </div>
  )
}
