/** Invoices-on-hold workbench: upload the ERP "Invoices On Hold" report, see
 * the holds supplier-wise with deterministic classification and aging, get an
 * AI read of the hold reasons and buyer comments, and review the email or
 * internal-action drafts. Nothing is sent automatically and the hold itself
 * is only ever released by the buyer, in the ERP. */
import { useEffect, useRef, useState } from 'react'
import onHoldSample from '../../../fixtures/onhold_sample.csv?raw'
import { formatCentsGrouped } from '../../../ts/src'
import {
  CATEGORY_AUDIENCE,
  CATEGORY_LABELS,
  agingSummary,
  categorySummary,
  compareProofQuantity,
  daysSince,
  followUpDraft,
  internalActionDraft,
  parseHoldsReport,
  supplierEmailDraft,
} from '../lib/holds'
import type { HoldCategory, HoldInvoice, HoldsReport, SupplierHolds } from '../lib/holds'
import { proofMediaType, proofQuantityFor, requestHoldsRead, requestProofRead } from '../lib/holdsAi'
import type { SupplierRead } from '../lib/holdsAi'
import { downloadHoldPackXlsx } from '../lib/holdsExport'
import {
  DEFAULT_HOLD_STATUS,
  HOLD_STATUSES,
  HOLD_STATUS_LABELS,
  loadEmailSentAt,
  loadHoldStatuses,
  markEmailSent,
  recordActivity,
  saveHoldStatus,
  subscribeHolds,
} from '../lib/holdsStore'
import type { HoldStatus } from '../lib/holdsStore'
import { fileToRawCsv } from '../lib/tabular'

const GUEST_HOLDS_KEY = 'tieout-guest-holds-run-used'

function readGuestHoldsUsed(): boolean {
  try {
    return localStorage.getItem(GUEST_HOLDS_KEY) === '1'
  } catch {
    return false
  }
}

function persistGuestHoldsUsed(): void {
  try {
    localStorage.setItem(GUEST_HOLDS_KEY, '1')
  } catch {
    // Storage unavailable — the in-memory flag still gates this tab.
  }
}

// Keeps the loaded report across mode switches within the tab, so leaving the
// workbench and coming back does not lose the run. Never persisted to storage.
let lastReport: HoldsReport | null = null

// Per-tab guest gating that survives panel remounts, including when
// localStorage is unavailable. Never persisted to storage.
let guestRunUsedInTab = false
let guestRunPending = false

const CATEGORY_CHIP: Record<HoldCategory, string> = {
  quantity: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  price: 'bg-burgundy/20 text-gold-light border-burgundy/40',
  tax: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  admin: 'bg-cream text-ink-soft border-line',
  other: 'bg-cream text-ink-soft border-line',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="border border-line bg-cream px-3 py-1.5 text-sm font-medium text-ink hover:border-ink-faint"
    >
      {copied ? 'Copied' : 'Copy draft'}
    </button>
  )
}

function Draft({ title, text, mailto }: { title: string; text: string; mailto?: string }) {
  const subject = text.match(/^Subject: (.+)$/m)?.[1] ?? ''
  const body = text.replace(/^Subject: .+\n\n/, '')
  return (
    <div className="space-y-2 border border-line bg-paper p-4">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">{title}</p>
      <pre className="whitespace-pre-wrap font-sans text-sm text-ink-soft">{text}</pre>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={text} />
        {mailto !== undefined && mailto !== '' && (
          <a
            href={`mailto:${mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
            className="border border-line bg-cream px-3 py-1.5 text-sm font-medium text-ink hover:border-ink-faint"
          >
            Open in email app
          </a>
        )}
      </div>
    </div>
  )
}

interface ProofState {
  kind: 'reading' | 'error' | 'done'
  detail: string
  documentType?: string
}

function InvoiceRow({
  report,
  supplier,
  inv,
  status,
  onStatus,
  guest,
  onSignIn,
}: {
  report: HoldsReport
  supplier: SupplierHolds
  inv: HoldInvoice
  status: HoldStatus
  onStatus: (status: HoldStatus) => void
  guest: boolean
  onSignIn?: () => void
}) {
  const [proof, setProof] = useState<ProofState | null>(null)
  const proofInput = useRef<HTMLInputElement>(null)
  const age = daysSince(inv.holdDate)

  const onProofFile = async (file: File) => {
    const mediaType = proofMediaType(file)
    if (mediaType === null) {
      setProof({ kind: 'error', detail: 'Proof documents must be PDF or image files (PDF, PNG, JPG, GIF, WebP).' })
      return
    }
    setProof({ kind: 'reading', detail: 'AI is reading the document…' })
    const result = await requestProofRead(file, mediaType)
    if (!result.ok) {
      setProof({ kind: 'error', detail: `Could not read the proof: ${result.detail}` })
      return
    }
    recordActivity(report.id, {
      invoiceKey: inv.key,
      supplier: supplier.supplier,
      event: `Proof document received (${file.name}, read as ${result.document_type || 'document'})`,
    })
    const shipped = proofQuantityFor(result, inv.invoice, inv.po)
    if (shipped === null) {
      setProof({
        kind: 'done',
        detail:
          'The document was read but no shipped quantity could be tied to this invoice or PO — review it manually before deciding.',
        documentType: result.document_type,
      })
      return
    }
    const comparison = compareProofQuantity(inv, shipped)
    recordActivity(report.id, {
      invoiceKey: inv.key,
      supplier: supplier.supplier,
      event: `Proof reviewed: ${comparison.detail}`,
    })
    setProof({ kind: 'done', detail: comparison.detail, documentType: result.document_type })
  }

  return (
    <div className="space-y-2 border-t border-line py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-sm font-semibold text-ink">{inv.invoice}</span>
        {inv.po !== '' && <span className="font-mono text-xs text-ink-faint">{inv.po}</span>}
        <span className={`border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${CATEGORY_CHIP[inv.category]}`}>
          {CATEGORY_LABELS[inv.category]}
        </span>
        {inv.amount !== null && (
          <span className="font-mono text-sm text-ink">
            {formatCentsGrouped(inv.amount)}
            {inv.currency !== '' ? ` ${inv.currency}` : ''}
          </span>
        )}
        {age !== null && (
          <span className={`font-mono text-xs ${age > 14 ? 'text-amber-300' : 'text-ink-faint'}`}>
            {age} day{age === 1 ? '' : 's'} on hold
          </span>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs text-ink-faint">
          Status
          <select
            value={status}
            onChange={(e) => onStatus(e.target.value as HoldStatus)}
            className="border border-line bg-cream px-2 py-1 text-xs text-ink"
          >
            {HOLD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {HOLD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-ink-soft">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-faint">Hold reason: </span>
        {inv.holdReason}
        {(inv.qtyInvoiced !== null || inv.qtyReceived !== null) && (
          <span className="ml-2 font-mono text-xs text-ink-faint">
            (qty invoiced {inv.qtyInvoiced ?? '?'}, received {inv.qtyReceived ?? '?'})
          </span>
        )}
      </p>
      {inv.comments !== '' && (
        <p className="text-sm text-ink-soft">
          <span className="font-mono text-xs uppercase tracking-wider text-ink-faint">Buyer comments: </span>
          {inv.comments}
        </p>
      )}
      {inv.category === 'quantity' && guest && (
        <p className="text-sm text-ink-faint">
          Supplier sent proof? Reading proof documents with AI needs an account &mdash;{' '}
          <button type="button" onClick={onSignIn} className="font-semibold underline hover:text-pine">
            sign in
          </button>{' '}
          to use it.
        </p>
      )}
      {inv.category === 'quantity' && !guest && (
        <div className="space-y-1">
          <input
            ref={proofInput}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onProofFile(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => proofInput.current?.click()}
            className="text-sm text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
          >
            Supplier sent proof? Upload it — AI reads it, the comparison is deterministic
          </button>
          {proof && (
            <p
              className={`border px-3 py-2 text-sm ${
                proof.kind === 'error'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : 'border-pine/30 bg-moss text-pine-deep'
              }`}
            >
              {proof.detail}
              {proof.kind === 'done' && ' You take the final call — TieOut AP never releases the hold itself.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function SupplierCard({
  report,
  supplier,
  read,
  guest,
  onSignIn,
}: {
  report: HoldsReport
  supplier: SupplierHolds
  read?: SupplierRead
  guest: boolean
  onSignIn?: () => void
}) {
  const [open, setOpen] = useState(false)
  const statuses = loadHoldStatuses(report.id)
  const emailSentAt = loadEmailSentAt(report.id)[supplier.supplier]
  const deterministicDraft = supplierEmailDraft(supplier)
  const aiEmail = read !== undefined && read.needs_supplier_email && read.email !== ''
  const emailDraft = aiEmail ? read.email : deterministicDraft
  const internalDraft = internalActionDraft(supplier)
  const supplierKeys = supplier.invoices
    .filter((i) => CATEGORY_AUDIENCE[i.category] === 'supplier')
    .map((i) => i.key)
  const sentDays = emailSentAt !== undefined ? daysSince(emailSentAt.slice(0, 10)) : null
  const showEmail = supplier.needsSupplier && (read === undefined || read.needs_supplier_email)

  return (
    <section className="border border-line bg-cream">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-paper"
      >
        <span className="font-serif text-lg font-semibold text-ink">{supplier.supplier}</span>
        <span className="text-sm text-ink-faint">
          {supplier.invoices.length} invoice{supplier.invoices.length === 1 ? '' : 's'} on hold
        </span>
        <span className="font-mono text-sm text-ink">{formatCentsGrouped(supplier.total)}</span>
        {emailSentAt !== undefined && (
          <span className="font-mono text-xs text-pine">
            request sent{sentDays !== null ? ` ${sentDays} day${sentDays === 1 ? '' : 's'} ago` : ''}
          </span>
        )}
        {!supplier.needsSupplier && (
          <span className="font-mono text-xs uppercase tracking-wider text-ink-faint">internal only</span>
        )}
        <span className="ml-auto text-sm text-ink-faint">{open ? 'Hide' : 'Review'}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-line px-4 py-4">
          {read !== undefined && (
            <div className="border border-pine/30 bg-moss px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-pine">AI read</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-pine-deep">{read.read}</p>
            </div>
          )}
          <div>
            {supplier.invoices.map((inv) => (
              <InvoiceRow
                key={inv.key}
                report={report}
                supplier={supplier}
                inv={inv}
                status={statuses[inv.key] ?? DEFAULT_HOLD_STATUS}
                onStatus={(s) => saveHoldStatus(report.id, inv.key, supplier.supplier, s)}
                guest={guest}
                onSignIn={onSignIn}
              />
            ))}
          </div>
          {showEmail && (
            <div className="space-y-2">
              <Draft
                title={aiEmail ? 'Supplier email draft — AI-worded, review before sending' : 'Supplier email draft — review before sending'}
                text={emailDraft}
                mailto={supplier.email}
              />
              <div className="flex flex-wrap items-center gap-3">
                {emailSentAt === undefined ? (
                  <button
                    type="button"
                    onClick={() => markEmailSent(report.id, supplier.supplier, supplierKeys)}
                    className="btn-gold px-3 py-1.5 text-sm font-semibold"
                  >
                    Mark request as sent
                  </button>
                ) : (
                  <span className="text-sm text-ink-faint">
                    Request marked sent on {emailSentAt.slice(0, 10)}
                    {sentDays !== null && sentDays > 0 ? ` — ${sentDays} day${sentDays === 1 ? '' : 's'} without a recorded reply` : ''}
                  </span>
                )}
              </div>
            </div>
          )}
          {emailSentAt !== undefined && sentDays !== null && showEmail && (
            <Draft
              title={`Follow-up draft — original request ${sentDays} day${sentDays === 1 ? '' : 's'} old`}
              text={followUpDraft(supplier, emailSentAt.slice(0, 10), sentDays)}
              mailto={supplier.email}
            />
          )}
          {internalDraft !== '' && (
            <Draft title="Internal action draft — for your own team, not the supplier" text={internalDraft} />
          )}
        </div>
      )}
    </section>
  )
}

export function HoldsPanel({
  onSingle,
  guest = false,
  onSignIn,
}: {
  onSingle: () => void
  guest?: boolean
  onSignIn?: () => void
}) {
  const [report, setReportState] = useState<HoldsReport | null>(() => lastReport)
  const [error, setError] = useState<string | null>(null)
  const [guestUsed, setGuestUsed] = useState(() => guestRunUsedInTab || readGuestHoldsUsed())

  const setReport = (r: HoldsReport | null) => {
    lastReport = r
    setReportState(r)
  }
  const [reads, setReads] = useState<Record<string, SupplierRead> | null>(null)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [, setVersion] = useState(0)
  const reportIdRef = useRef(report?.id)

  useEffect(() => {
    reportIdRef.current = report?.id
  }, [report])

  useEffect(() => subscribeHolds(() => setVersion((v) => v + 1)), [])

  const loadCsv = (csv: string, fileName: string): boolean => {
    try {
      const parsed = parseHoldsReport(csv, fileName)
      setReport(parsed)
      setError(null)
      setReads(null)
      setReadError(null)
      recordActivity(parsed.id, {
        invoiceKey: '',
        supplier: '',
        event: `Report ${fileName} loaded — ${parsed.invoiceCount} invoice(s) on hold across ${parsed.suppliers.length} supplier(s)`,
      })
      return true
    } catch (e) {
      setError(`Could not read the report (${e instanceof Error ? e.message : String(e)}).`)
      return false
    }
  }

  const onFile = async (file: File) => {
    if (guest) {
      if (guestRunPending) return
      if (guestRunUsedInTab || guestUsed || readGuestHoldsUsed()) {
        setGuestUsed(true)
        return
      }
      guestRunPending = true
    }
    try {
      if (loadCsv(await fileToRawCsv(file), file.name) && guest) {
        guestRunUsedInTab = true
        persistGuestHoldsUsed()
        setGuestUsed(true)
      }
    } catch (e) {
      setError(`Could not read the file (${e instanceof Error ? e.message : String(e)}).`)
    } finally {
      if (guest) guestRunPending = false
    }
  }

  const aiRead = async () => {
    if (!report) return
    const requestedId = report.id
    setReading(true)
    setReadError(null)
    const result = await requestHoldsRead(report)
    if (reportIdRef.current !== requestedId) return
    setReading(false)
    if (!result.ok) {
      setReadError(`AI read failed: ${result.detail}`)
      return
    }
    const byName: Record<string, SupplierRead> = {}
    for (const r of result.reads) byName[r.supplier] = r
    setReads(byName)
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {guest && guestUsed && (
          <p className="mx-auto max-w-md border border-pine/30 bg-moss px-4 py-3 text-center text-sm text-pine-deep">
            You&rsquo;ve used your free holds run. Create a free account to keep
            working the queue &mdash; 14-day trial, no card needed.{' '}
            <button type="button" onClick={onSignIn} className="font-semibold underline hover:text-ink">
              Sign in
            </button>
          </p>
        )}
        <div className="border border-line bg-cream p-6">
          <h2 className="font-serif text-2xl font-semibold text-ink">Invoices on hold</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Upload the Invoices On Hold report from your ERP (CSV, TSV, or Excel). TieOut AP groups
            the holds supplier-wise, reads each hold reason and your comments, and drafts the
            supplier email or internal action for you to review. Drafts are never sent
            automatically, and releasing a hold stays in your ERP, with you.
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            Needs columns for supplier, invoice number, and hold reason; buyer comments, amounts,
            quantities, hold dates, and supplier emails are used when present. The report stays in
            your browser — only the AI read you explicitly request sends its text fields to the
            server.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="btn-gold cursor-pointer px-4 py-2 text-sm font-semibold">
              Upload on-hold report
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.xlsb,.ods"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void onFile(file)
                  e.target.value = ''
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => loadCsv(onHoldSample, 'onhold_sample.csv')}
              className="border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-ink-faint"
            >
              Load sample report
            </button>
          </div>
          {error && (
            <p className="mt-3 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{error}</p>
          )}
        </div>
        <p className="text-right">
          <button
            type="button"
            onClick={onSingle}
            className="text-sm text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
          >
            &larr; Back to statement reconciliation
          </button>
        </p>
      </div>
    )
  }

  const aging = agingSummary(report)
  const byCategory = categorySummary(report)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h2 className="font-serif text-2xl font-semibold text-ink">Invoices on hold</h2>
        <span className="text-sm text-ink-faint">
          {report.fileName} — {report.invoiceCount} invoice{report.invoiceCount === 1 ? '' : 's'} across{' '}
          {report.suppliers.length} supplier{report.suppliers.length === 1 ? '' : 's'}
        </span>
        <span className="font-mono text-sm text-ink">
          {formatCentsGrouped(report.total)}
          {report.currencies.length === 1 ? ` ${report.currencies[0]}` : ''} on hold
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadHoldPackXlsx(report)}
            className="border border-line bg-cream px-3 py-1.5 text-sm font-medium text-ink hover:border-ink-faint"
            title="Download the hold review pack: summary, aging, every invoice with status, and the activity log"
          >
            Hold pack
          </button>
          <button
            type="button"
            onClick={() => {
              setReport(null)
              setReads(null)
              setError(null)
              setReadError(null)
            }}
            className="btn-gold px-3 py-1.5 text-sm font-semibold"
          >
            New report
          </button>
        </div>
      </div>
      {report.currencies.length > 1 && (
        <p className="border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          The report mixes currencies ({report.currencies.join(', ')}) — the totals above add them
          without conversion, so read them per currency.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border border-line bg-cream p-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">Hold aging</p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {aging.map((row) => (
                <tr key={row.bucket} className="border-t border-line first:border-t-0">
                  <td className="py-1 text-ink-soft">{row.bucket}</td>
                  <td className="py-1 text-right font-mono text-ink-faint">{row.count}</td>
                  <td className="py-1 text-right font-mono text-ink">{formatCentsGrouped(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border border-line bg-cream p-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">By hold reason</p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {byCategory.map((row) => (
                <tr key={row.category} className="border-t border-line first:border-t-0">
                  <td className="py-1 text-ink-soft">{CATEGORY_LABELS[row.category]}</td>
                  <td className="py-1 text-right font-mono text-ink-faint">{row.count}</td>
                  <td className="py-1 text-right font-mono text-ink">{formatCentsGrouped(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-line bg-cream px-4 py-3">
        <p className="text-sm text-ink-soft">
          AI can read each hold reason and your comments, explain who needs to act, and word the
          supplier emails. Every figure in the drafts comes from the report itself.
        </p>
        {guest ? (
          <button
            type="button"
            onClick={onSignIn}
            className="btn-gold ml-auto shrink-0 px-4 py-2 text-sm font-semibold"
          >
            Sign in for the AI read
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void aiRead()}
            disabled={reading}
            className="btn-gold ml-auto shrink-0 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {reading ? 'Reading…' : reads ? 'Re-run AI read' : 'AI read of this report'}
          </button>
        )}
      </div>
      {readError && (
        <p className="border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{readError}</p>
      )}

      <div className="space-y-3">
        {report.suppliers.map((s) => (
          <SupplierCard
            key={s.supplier}
            report={report}
            supplier={s}
            read={reads?.[s.supplier]}
            guest={guest}
            onSignIn={onSignIn}
          />
        ))}
      </div>

      <p className="text-right">
        <button
          type="button"
          onClick={onSingle}
          className="text-sm text-ink-faint underline decoration-dotted underline-offset-4 hover:text-pine"
        >
          &larr; Back to statement reconciliation
        </button>
      </p>
    </div>
  )
}
