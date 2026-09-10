import { useEffect } from 'react'
import { ContactSection } from './ContactSection'
import { HeroDemo } from './HeroDemo'

interface LandingProps {
  onOpenApp: () => void
  onSampleRun: () => void
}

const STATS = [
  { value: '0.00', label: 'unexplained — the bridge ties exactly or the tool refuses' },
  { value: '6 kinds', label: 'of difference, named in AP language' },
  { value: '100%', label: 'deterministic — same files, same answer' },
  { value: 'None', label: 'ERP integration, credentials, or auto-emails' },
]

const FEATURES = [
  {
    title: 'Every difference, named',
    body: 'Duplicate payments, invoices missing from your ledger, credits you haven\u2019t claimed, payments the supplier hasn\u2019t applied, amounts keyed differently, timing — sorted largest first, each with the evidence behind it.',
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

const STEPS = [
  {
    n: '1',
    title: 'Match',
    body: 'Drop in the supplier statement — PDF, scan, Excel, or CSV — and your AP export. The engine matches invoices, payments, and credits line by line, in your browser.',
  },
  {
    n: '2',
    title: 'Explain',
    body: 'Every unmatched line is classified in AP language, and the two balances are bridged exactly — 0.00 unexplained, or the tool tells you why it refused.',
  },
  {
    n: '3',
    title: 'Investigate',
    body: 'Work the exception queue largest-first. Uncertain matches are flagged for your confirmation, never quietly applied.',
  },
  {
    n: '4',
    title: 'Resolve',
    body: 'Copy the drafted supplier email, share the run with a link, and sign the statement off.',
  },
]

const AI_SPLIT = [
  {
    label: 'AI reads the paperwork',
    body: 'A PDF or scanned statement is read into lines by a vision model — then every extracted line is checked against the statement’s own printed closing balance. If the lines don’t add up, TieOut refuses to reconcile rather than guess.',
  },
  {
    label: 'AI maps messy exports',
    body: 'ERP exports name columns however they like — “Doc Ref”, “Vch No”, “Betrag”. When headers don’t match, AI maps them onto TieOut’s schema from just the header row and three sample values; the file itself never leaves your browser.',
  },
  {
    label: 'AI explains the outcome',
    body: 'After the deterministic run, AI turns the findings into a plain-English summary and a better-worded supplier email — from the findings alone, never your files. Every figure it words comes straight from the engine.',
  },
  {
    label: 'Determinism does the maths',
    body: 'Matching, arithmetic, classification and the bridge run in a deterministic six-pass cascade — no model anywhere in the numbers. The same two files always produce the same findings and the same bridge.',
  },
]

export function Landing({ onOpenApp, onSampleRun }: LandingProps) {
  useEffect(() => {
    if (location.hash === '#contact') {
      document.getElementById('contact')?.scrollIntoView()
    }
  }, [])

  return (
    <div className="bg-white">
      {/* Hero */}
      <div className="border-b border-slate-200 bg-gradient-to-b from-blue-50/70 via-white to-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-xl font-bold tracking-tight text-slate-900">
            TieOut <span className="text-blue-700">AP</span>
          </span>
          <div className="flex items-center gap-3">
            <a
              href="#contact"
              className="px-2 py-2 text-sm font-medium text-slate-700 hover:text-blue-700"
            >
              Contact
            </a>
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
              Know exactly why your supplier balance doesn&rsquo;t match.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Upload a supplier statement and your AP ledger export. TieOut matches
              invoices, payments, and credits, classifies every difference, and
              bridges the two balances exactly &mdash; down to 0.00 unexplained.
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
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              {[
                'No ERP integration required',
                'AI reads PDF statements',
                'Your ledger never leaves your browser',
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="text-emerald-600">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 justify-center lg:justify-end">
            <HeroDemo onSampleRun={onSampleRun} />
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

      {/* No AI in the numbers */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-display text-center text-3xl font-bold tracking-tight text-slate-900">
            AI where it helps. Determinism where it counts.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center leading-relaxed text-slate-600">
            AI is great at reading documents and wording explanations — and terrible at
            being right every time. So TieOut uses it to read PDF statements, map messy
            column names, and explain the findings — while every number stays in a
            deterministic engine that never guesses.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {AI_SPLIT.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-7">
                <h3 className="font-display text-lg font-bold text-slate-900">{item.label}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.body}</p>
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
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Formats & privacy */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-1 w-10 rounded-full bg-blue-700" />
            <h3 className="font-display mt-4 text-xl font-bold text-slate-900">
              No ERP integration required
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Works with the files you already have: PDF and scanned statements (read for
              you by AI), plus Excel (.xlsx, .xls), CSV, TSV, and semicolon-delimited
              exports from any ERP or accounting system. No connectors, no IT project, no
              credentials &mdash; export, upload, reconcile.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-1 w-10 rounded-full bg-blue-700" />
            <h3 className="font-display mt-4 text-xl font-bold text-slate-900">
              Your ledger never leaves your browser
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Parsing, matching, and every calculation run locally on your machine. Your
              AP ledger and any Excel or CSV statement are never uploaded. A PDF or image
              statement makes one trip to the server to be read into lines, then is
              discarded &mdash; never stored. Nothing is ever written to your ERP or sent
              on your behalf.
            </p>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto max-w-4xl px-6 pb-16 text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Built for controllers who need to trust the number
        </h2>
        <p className="mt-4 text-slate-600">
          The engine is deterministic: the same two files always produce the same
          findings, the same bridge, the same email. Uncertain matches are surfaced
          for human review, never quietly applied.
        </p>
      </section>

      {/* Pricing */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            Simple pricing
          </h2>
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-blue-200 bg-blue-50/50 p-8 text-left shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              Everything included
            </p>
            <p className="mt-3 font-display text-4xl font-bold text-slate-900">
              $19<span className="text-lg font-medium text-slate-500">/month</span>
            </p>
            <p className="mt-1 text-sm font-medium text-emerald-700">14-day free trial</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              <li>Unlimited reconciliations</li>
              <li>PDF, scan, Excel, CSV and TSV statements</li>
              <li>AI column mapping and AI summaries</li>
              <li>Drafted supplier emails and shareable runs</li>
              <li>Cancel anytime — no charge until the trial ends</li>
            </ul>
            <button
              type="button"
              onClick={onOpenApp}
              className="mt-6 w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Start free trial
            </button>
          </div>
        </div>
      </section>

      {/* Contact */}
      <ContactSection />

      {/* Final CTA */}
      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center text-white">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Find out why it doesn&rsquo;t match &mdash; in minutes
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
            <span className="flex items-center gap-4">
              <a href="#contact" className="text-slate-300 hover:text-white">
                Contact
              </a>
              <span>
                Never writes to your ERP. Holds no credentials. Sends nothing on your behalf.
              </span>
            </span>
          </div>
        </footer>
      </section>
    </div>
  )
}
