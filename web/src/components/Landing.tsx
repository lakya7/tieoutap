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
    accent: 'text-fuchsia-600',
    body: 'Every difference classified and sorted by amount — duplicates, unrecorded liabilities, unclaimed credits, part payments, mismatches, timing — each with the evidence behind it.',
  },
  {
    title: 'Exact bridge',
    accent: 'text-violet-600',
    body: 'A signed waterfall from your ledger balance to the supplier statement balance. It either ties out to the penny or the tool tells you why it refused.',
  },
  {
    title: 'Drafted supplier email',
    accent: 'text-sky-600',
    body: 'A ready-to-send query list built from the findings. You review, edit, and send it yourself — nothing ever goes out automatically.',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Drop in two files',
    body: 'The supplier statement and your AP open-items export. Any ERP — it is just CSV.',
  },
  {
    n: '2',
    title: 'Reconcile in the browser',
    body: 'The deterministic engine matches line by line. Your data never leaves the machine.',
  },
  {
    n: '3',
    title: 'Clear the differences',
    body: 'Work the queue, check the bridge, copy the drafted email, share the run with a link.',
  },
]

function MiniBridge() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
          Bridge
        </span>
        <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
          Ties out
        </span>
      </div>
      <dl className="mt-4 space-y-2 font-mono text-xs sm:text-sm">
        <div className="flex justify-between text-stone-300">
          <dt className="min-w-0 truncate pr-4">AP ledger open balance</dt>
          <dd className="shrink-0">34,696.00</dd>
        </div>
        {[
          ['Invoice missing from ledger', '+15,780.00'],
          ['Part payment in transit', '+10,000.00'],
          ['Duplicate ledger posting', '\u22127,905.00'],
          ['Credit not yet claimed', '\u22122,760.00'],
        ].map(([label, amount]) => (
          <div key={label} className="flex justify-between text-stone-400">
            <dt className="min-w-0 truncate pr-4">{label}</dt>
            <dd
              className={`shrink-0 ${amount.startsWith('+') ? 'text-emerald-300' : 'text-fuchsia-300'}`}
            >
              {amount}
            </dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-white">
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
      <div className="bg-gradient-to-br from-[#160b33] via-[#241252] to-[#3b1670] text-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-xl font-bold tracking-tight">
            TieOut <span className="text-fuchsia-400">AP</span>
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSampleRun}
              className="hidden rounded-md border border-white/25 px-4 py-2 text-sm font-medium hover:bg-white/10 sm:block"
            >
              See a sample run
            </button>
            <button
              type="button"
              onClick={onOpenApp}
              className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-400"
            >
              Open the app
            </button>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-fuchsia-400">
              Supplier statement reconciliation
            </p>
            <h1 className="font-display mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Tie out every supplier statement. To the penny.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-300">
              TieOut AP compares a supplier&rsquo;s statement against your AP ledger
              export and hands you the answer: every difference classified, every
              balance bridged exactly, and the query email already drafted.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={onOpenApp}
                className="rounded-md bg-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:bg-fuchsia-400"
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
            <p className="mt-6 text-sm text-stone-400">
              Runs entirely in your browser — your ledger never leaves the machine.
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <MiniBridge />
          </div>
        </div>

        {/* Stats band */}
        <div className="border-t border-white/10 bg-black/20">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-center sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.value}>
                <p className="font-display text-2xl font-bold text-fuchsia-400">{s.value}</p>
                <p className="mt-1 text-sm text-stone-300">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-center text-3xl font-bold tracking-tight text-stone-900">
          Everything you need to clear a statement
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-stone-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
            >
              <h3 className={`font-display text-xl font-bold ${f.accent}`}>{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-stone-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-display text-center text-3xl font-bold tracking-tight text-stone-900">
            From statement to signed-off in minutes
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 font-display text-lg font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-stone-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-stone-900">
          Built for controllers who need to trust the number
        </h2>
        <p className="mt-4 text-stone-600">
          The engine is deterministic: the same two files always produce the same
          findings, the same bridge, the same email. No model in the matching path, no
          ERP writes, no stored credentials, and nothing is ever sent on your behalf.
        </p>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-[#160b33] via-[#241252] to-[#3b1670]">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center text-white">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Your next statement takes minutes, not an afternoon
          </h2>
          <div className="mt-8 flex justify-center gap-4">
            <button
              type="button"
              onClick={onOpenApp}
              className="rounded-md bg-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:bg-fuchsia-400"
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
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-stone-400 sm:flex-row">
            <span>
              TieOut <span className="text-fuchsia-400">AP</span> — tieoutap.com
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
