interface LandingProps {
  onOpenApp: () => void
  onSampleRun: () => void
}

const STATS = [
  { value: '6-pass', label: 'matching cascade' },
  { value: '100%', label: 'deterministic — same files, same answer' },
  { value: 'To the penny', label: 'exact bridge between both balances' },
  { value: '0', label: 'ERP writes, credentials, or auto-emails' },
]

const FEATURES = [
  {
    title: 'Exception queue',
    body: 'Every difference classified and sorted by amount — duplicates, unrecorded liabilities, unclaimed credits, part payments, mismatches, timing — each with the evidence behind it.',
  },
  {
    title: 'Exact bridge',
    body: 'A signed waterfall from your ledger balance to the supplier statement balance. It either ties out to the penny or the tool tells you why it refused.',
  },
  {
    title: 'Drafted supplier email',
    body: 'A ready-to-send query list built from the findings. You review, edit, and send it yourself — nothing ever goes out automatically.',
  },
]

const AI_SPLIT = [
  {
    label: 'AI does the reading',
    body: 'A vision model transcribes the supplier’s PDF or scan into lines — reference, date, type, amount, PO — so nobody rekeys a statement again. It only ever reads; it never decides anything.',
    guard:
      'Guard rail: the extracted lines must add up to the statement’s own printed closing balance. If they do not, TieOut AP refuses to reconcile rather than hand you a plausible wrong number.',
  },
  {
    label: 'The engine does the accounting',
    body: 'Matching, arithmetic, classification and the bridge run in a deterministic six-pass cascade with no model anywhere in the path. The same lines always produce the same findings and the same bridge.',
    guard:
      'Low-confidence matches are surfaced as needing human confirmation, never quietly applied. You review and decide.',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Drop in two files',
    body: 'The supplier statement as a PDF, scan or CSV, plus your AP open-items export. Any ERP.',
  },
  {
    n: '2',
    title: 'Reconcile in the browser',
    body: 'The deterministic engine matches line by line, in the browser, on your own machine.',
  },
  {
    n: '3',
    title: 'Clear the differences',
    body: 'Work the queue, check the bridge, copy the drafted email, share the run with a link.',
  },
]

function MiniBridge() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Bridge</span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          Ties out
        </span>
      </div>
      <dl className="mt-4 space-y-2 font-mono text-xs sm:text-sm">
        <div className="flex justify-between text-slate-700">
          <dt className="min-w-0 truncate pr-4">AP ledger open balance</dt>
          <dd className="shrink-0">34,696.00</dd>
        </div>
        {[
          ['Invoice missing from ledger', '+15,780.00'],
          ['Part payment in transit', '+10,000.00'],
          ['Duplicate ledger posting', '\u22127,905.00'],
          ['Credit not yet claimed', '\u22122,760.00'],
        ].map(([label, amount]) => (
          <div key={label} className="flex justify-between text-slate-500">
            <dt className="min-w-0 truncate pr-4">{label}</dt>
            <dd
              className={`shrink-0 ${amount.startsWith('+') ? 'text-blue-700' : 'text-slate-400'}`}
            >
              {amount}
            </dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
          <dt className="min-w-0 truncate pr-4">Supplier statement balance</dt>
          <dd className="shrink-0">59,165.00</dd>
        </div>
      </dl>
    </div>
  )
}

export function Landing({ onOpenApp, onSampleRun }: LandingProps) {
  return (
    <div className="bg-white">
      {/* Hero */}
      <div className="border-b border-slate-200 bg-gradient-to-b from-blue-50/70 via-white to-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-xl font-bold tracking-tight text-slate-900">
            TieOut <span className="text-blue-700">AP</span>
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSampleRun}
              className="hidden rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:block"
            >
              See a sample run
            </button>
            <button
              type="button"
              onClick={onOpenApp}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Open the app
            </button>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-blue-700">
              Supplier statement reconciliation
            </p>
            <h1 className="font-display mt-4 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Tie out every supplier statement. To the penny.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              TieOut AP compares a supplier&rsquo;s statement against your AP ledger
              export and hands you the answer: every difference classified, every
              balance bridged exactly, and the query email already drafted.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={onOpenApp}
                className="rounded-md bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800"
              >
                Reconcile a statement
              </button>
              <button
                type="button"
                onClick={onSampleRun}
                className="rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                See a sample run
              </button>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Reconciliation runs in your browser — your AP ledger never leaves the
              machine. Only a PDF or scanned statement is sent out, to be read.
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <MiniBridge />
          </div>
        </div>
      </div>

      {/* Stats band */}
      <div className="bg-slate-900">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-center sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.value}>
              <p className="font-display text-2xl font-bold text-white">{s.value}</p>
              <p className="mt-1 text-sm text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-center text-3xl font-bold tracking-tight text-slate-900">
          Everything you need to clear a statement
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="h-1 w-10 rounded-full bg-blue-700" />
              <h3 className="font-display mt-4 text-xl font-bold text-slate-900">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI where it helps */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="font-display text-center text-3xl font-bold tracking-tight text-slate-900">
            AI where it helps, determinism where it counts
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">
            Reading a supplier statement is a document problem. Reconciling one is an
            arithmetic problem. TieOut AP uses AI for the first and refuses to use it for
            the second.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {AI_SPLIT.map((c) => (
              <div key={c.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-7">
                <h3 className="font-display text-xl font-bold text-slate-900">{c.label}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{c.body}</p>
                <p className="mt-4 border-l-2 border-blue-700 pl-4 text-sm leading-relaxed text-slate-700">
                  {c.guard}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-display text-center text-3xl font-bold tracking-tight text-slate-900">
            From statement to signed-off in minutes
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="font-display mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-700 text-lg font-bold text-white">
                  {s.n}
                </div>
                <h3 className="font-display mt-4 text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Built for controllers who need to trust the number
        </h2>
        <p className="mt-4 text-slate-600">
          The engine is deterministic: the same two files always produce the same
          findings, the same bridge, the same email. AI reads the statement and nothing
          else — no model in the matching path, no ERP writes, no stored credentials, and
          nothing is ever sent on your behalf.
        </p>
      </section>

      {/* Final CTA */}
      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center text-white">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Your next statement takes minutes, not an afternoon
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={onOpenApp}
              className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Reconcile a statement
            </button>
            <button
              type="button"
              onClick={onSampleRun}
              className="rounded-md border border-white/25 px-6 py-3 text-sm font-semibold hover:bg-white/10"
            >
              See a sample run
            </button>
          </div>
        </div>
        <footer className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-slate-400 sm:flex-row">
            <span>
              TieOut <span className="text-blue-400">AP</span> — tieoutap.com
            </span>
            <span>
              Never writes to your ERP. Holds no credentials. Sends nothing on your behalf.
            </span>
          </div>
        </footer>
      </section>
    </div>
  )
}
