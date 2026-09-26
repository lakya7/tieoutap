export function HoldsEntryCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="mx-auto mt-6 max-w-3xl border border-gold/40 bg-cream p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
            For buyers &amp; AP
          </p>
          <h3 className="mt-1 font-serif text-lg font-medium text-ink">
            Invoices on hold in your ERP?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Upload your Invoices On Hold report &mdash; TieOut reads each hold
            reason and comment, groups the queue supplier-wise, and drafts the
            supplier request or internal action for you to review. Nothing is
            sent automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="btn-gold px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          Open the holds workbench
        </button>
      </div>
    </div>
  )
}
