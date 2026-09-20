import { useEffect, useRef } from 'react'
import statementSample from '../../../fixtures/meridian_stmt.csv?raw'
import ledgerSample from '../../../fixtures/acme_ledger.csv?raw'
import { track } from '../lib/analytics'
import { ContactSection } from './ContactSection'
import { HeroDemo } from './HeroDemo'
import { LandingNav } from './LandingNav'
import { LeadCapture } from './LeadCapture'
import { ResultsShowcase } from './ResultsShowcase'

interface LandingProps {
  onOpenApp: () => void
  onSampleRun: () => void
}

const STATS = [
  { value: '0.00', label: 'unexplained — the variance is explained in full or the tool refuses' },
  { value: '6 kinds', label: 'of difference, named in AP language' },
  { value: '100%', label: 'repeatable — the same two files always produce the same answer' },
  { value: 'None', label: 'ERP integration, credentials, or auto-emails' },
]

const FEATURES = [
  {
    n: '01',
    title: 'Every difference, named',
    body: 'Duplicate payments, invoices missing from your ledger, credits you haven\u2019t claimed, payments the supplier hasn\u2019t applied, amounts keyed differently, timing — sorted largest first, each with the evidence behind it.',
  },
  {
    n: '02',
    title: 'An exact bridge',
    body: 'A signed waterfall from your ledger balance to the supplier statement balance. It either ties out to the penny or the tool tells you why it refused.',
  },
  {
    n: '03',
    title: 'A drafted supplier email',
    body: 'A ready-to-send query list built from the findings. You review, edit, and send it yourself — nothing ever goes out automatically.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Match',
    body: 'Drop in the supplier statement — PDF, scan, Excel, or CSV — and your AP export. The engine matches invoices, payments, and credits line by line, in your browser.',
  },
  {
    n: '02',
    title: 'Explain',
    body: 'Every unmatched line is classified in AP language, and the two balances are bridged exactly — 0.00 unexplained, or the tool tells you why it refused.',
  },
  {
    n: '03',
    title: 'Investigate',
    body: 'Work the exception queue largest-first. Uncertain matches are flagged for your confirmation, never quietly applied.',
  },
  {
    n: '04',
    title: 'Resolve',
    body: 'Copy the drafted supplier email, share the run with a link, and sign the statement off.',
  },
]

const AI_ITEMS = [
  {
    label: 'AI reads the paperwork',
    body: 'A PDF or scanned statement is read into lines by a vision model — then every extracted line is checked against the statement\u2019s own printed closing balance. If the lines don\u2019t add up, TieOut refuses to reconcile rather than guess.',
  },
  {
    label: 'AI maps messy exports',
    body: 'ERP exports name columns however they like — \u201cDoc Ref\u201d, \u201cVch No\u201d, \u201cBetrag\u201d. When headers don\u2019t match, AI maps them onto TieOut\u2019s schema from just the header row and three sample values; the file itself never leaves your browser.',
  },
  {
    label: 'AI explains the outcome',
    body: 'After the deterministic run, AI turns the findings into a plain-English summary and a better-worded supplier email — from the findings alone, never your files. Every figure it words comes straight from the engine.',
  },
]

function downloadSample(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function SectionHead({
  n,
  eyebrow,
  title,
  center,
}: {
  n: string
  eyebrow: string
  title: string
  center?: boolean
}) {
  return (
    <div className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <p
        className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-pine ${
          center ? 'justify-center' : ''
        }`}
      >
        <span className="font-mono">{n}</span>
        <span aria-hidden="true" className="h-px w-8 bg-pine/40" />
        {eyebrow}
      </p>
      <h2 className="mt-4 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
    </div>
  )
}

export function Landing({ onOpenApp, onSampleRun }: LandingProps) {
  const pricingRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (location.hash === '#contact') {
      document.getElementById('contact')?.scrollIntoView()
    }
  }, [])

  useEffect(() => {
    const el = pricingRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          track('pricing_viewed')
          observer.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="bg-paper text-ink">
      {/* Hero */}
      <div className="border-b border-line bg-gradient-to-br from-burgundy/50 via-night to-night">
        <header className="border-b border-line/60">
          <LandingNav onOpenApp={onOpenApp} onSampleRun={onSampleRun} />
        </header>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-16 lg:grid-cols-2">
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-pine">
              Supplier statement reconciliation
              <span aria-hidden="true" className="h-px w-10 bg-pine/40" />
            </p>
            <h1 className="mt-5 font-serif text-[2.65rem] font-medium leading-[1.06] tracking-tight text-pine sm:text-6xl">
              Know exactly why your supplier balance{' '}
              <span className="font-accent italic text-pine-deep">doesn&rsquo;t match</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Turn a supplier-statement mismatch into an auditable explanation in
              minutes. Upload the statement and your AP export &mdash; TieOut matches
              the lines, classifies the differences with supporting evidence, and
              shows whether the remaining variance is fully explained &mdash; or
              tells you plainly that it is not.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={onSampleRun}
                className="rounded-sm btn-gold px-7 py-3.5 text-sm font-semibold transition-colors"
              >
                Try the sample reconciliation &mdash; no signup
              </button>
              <button
                type="button"
                onClick={onOpenApp}
                className="group text-sm font-semibold text-pine"
              >
                Reconcile your own statement{' '}
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform group-hover:translate-x-0.5"
                >
                  &rarr;
                </span>
              </button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              {[
                'No ERP integration required',
                'AI reads PDF statements',
                'Your ledger never leaves your browser',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-pine">✓</span>
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

      {/* Stats ledger strip */}
      <div className="border-b border-line bg-cream">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-line px-6 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <div
              key={s.value}
              className={`py-8 sm:px-6 ${i > 0 ? 'lg:border-l lg:border-line' : ''} ${
                i % 2 === 1 ? 'sm:border-l sm:border-line' : ''
              } sm:first:pl-0`}
            >
              <p className="font-serif text-3xl font-medium text-ink">{s.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-6 px-6 py-24">
        <SectionHead
          n="01"
          eyebrow="What you get"
          title="Everything you need to clear a statement"
        />
        <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
          {FEATURES.map((f) => (
            <div key={f.n} className="md:px-8 md:first:pl-0 md:last:pr-0">
              <p className="font-mono text-sm text-pine">{f.n}</p>
              <h3 className="mt-3 font-serif text-xl font-medium text-ink">{f.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI vs determinism */}
      <section id="ai" className="scroll-mt-6 border-y border-line bg-gradient-to-br from-night-card via-night to-night-warm text-ink">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-pine">
            <span className="font-mono">02</span>
            <span aria-hidden="true" className="h-px w-8 bg-gold/40" />
            Where the AI stops
          </p>
          <h2 className="mt-4 max-w-2xl font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            AI where it helps. Determinism where it counts.
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-ink-soft">
            AI is great at reading documents and wording explanations — and terrible at
            being right every time. So TieOut draws a hard line: AI touches the
            paperwork and the prose, never the numbers.
          </p>

          <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="divide-y divide-line">
              {AI_ITEMS.map((item) => (
                <div key={item.label} className="py-6 first:pt-0 last:pb-0">
                  <h3 className="font-serif text-lg font-medium text-ink">{item.label}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="border border-gold/25 bg-night/60 p-8 sm:p-10">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-pine">
                And then — no AI at all
              </p>
              <h3 className="mt-4 font-serif text-2xl font-medium leading-snug text-ink">
                Determinism does the maths
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                Matching, arithmetic, classification and the bridge run in a
                deterministic six-pass cascade — no model anywhere in the numbers.
                The same two files always produce the same findings and the same
                bridge.
              </p>
              <div className="mt-8 space-y-1.5 font-mono text-sm text-ink-soft">
                <div className="flex justify-between">
                  <span>Same two files in</span>
                  <span>every time</span>
                </div>
                <div className="flex justify-between">
                  <span>Same answer out</span>
                  <span>every time</span>
                </div>
                <div className="mt-3 flex justify-between border-t border-gold/30 pt-3 font-semibold text-ink">
                  <span>Unexplained</span>
                  <span>0.00</span>
                </div>
                <div aria-hidden="true" className="double-rule text-ink-soft" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-6 border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead
            n="03"
            eyebrow="How it works"
            title="From statement to signed-off in minutes"
          />
          <div className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="border-t border-ink/25 pt-5">
                <p className="font-mono text-sm text-pine">{s.n}</p>
                <h3 className="mt-3 font-serif text-xl font-medium text-ink">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The actual results screen */}
      <section id="results" className="scroll-mt-6 border-b border-line bg-cream">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead
            n="04"
            eyebrow="The actual screen"
            title="This is the real output — not a mock-up"
          />
          <p className="mt-5 max-w-3xl leading-relaxed text-ink-soft">
            Rendered below by the same engine and the same components the app uses, from
            the sample supplier statement and AP export. Every figure is computed live on
            this page.
          </p>
          <div className="mt-10">
            <ResultsShowcase onSampleRun={onSampleRun} />
          </div>

          <div className="mt-16 border-t border-line pt-12">
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
                Watch a real run
              </p>
              <h3 className="mt-3 font-serif text-2xl font-medium text-ink">
                From two files to a worked exception queue
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                A real reconciliation, recorded in the app: upload a supplier statement
                and an AP export, reconcile, and review the exceptions &mdash; each with
                its evidence, the context carried from the AP export, and the drafted
                supplier email.
              </p>
            </div>
            <video
              className="mt-8 w-full max-w-4xl border border-line bg-night shadow-sm"
              src="/demo-run.mp4"
              poster="/demo-run-poster.jpg"
              controls
              muted
              loop
              playsInline
              autoPlay
              aria-label="Screen recording of a reconciliation run in TieOut AP"
            />
          </div>
        </div>
      </section>

      {/* Monthly workflow: batch, history, recurring */}
      <section id="monthly" className="scroll-mt-6 border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead
            n="05"
            eyebrow="Month after month"
            title="Built for the close that comes back every month"
          />
          <p className="mt-5 max-w-3xl leading-relaxed text-ink-soft">
            A statement reconciliation is rarely a one-off. TieOut treats it as the
            recurring control it is &mdash; across your whole supplier list, and across
            closes.
          </p>
          <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
            {[
              {
                title: 'Batch runs',
                body: 'Drop in several supplier statements against one AP export. TieOut works out which supplier each statement belongs to from its document references \u2014 you only pick manually when it can\u2019t be certain \u2014 and reconciles every statement through the same deterministic engine, with a per-supplier summary of what tied out and what needs attention.',
              },
              {
                title: 'Run history',
                body: 'Your recent runs are saved in your browser \u2014 never on a server. Reopen any past reconciliation and the engine re-computes the same findings and the same bridge from the same files, so last month\u2019s answer is always one click away.',
              },
              {
                title: 'Recurring exceptions',
                body: 'An exception still open from the previous saved run is flagged: \u201cRecurring \u2014 also open on the \u2026 run\u201d. Items you resolved or accepted stay resolved. The statement stops being re-discovered from scratch every close \u2014 you see exactly what has been sitting there since last month.',
              },
            ].map((p) => (
              <div key={p.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
                <h3 className="font-serif text-xl font-medium text-ink">{p.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 max-w-xl border border-line bg-cream p-5">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
              How it looks in the queue
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink">
              <span className="font-medium">Invoice missing from your ledger</span>
              <span className="whitespace-nowrap bg-red-500/15 px-1.5 py-0.5 text-xs font-medium text-red-400">
                Recurring &mdash; also open on the 2026-08-31 run
              </span>
            </p>
            <p className="mt-2 text-xs text-ink-faint">
              Carried forward automatically from your saved run history &mdash; all in your browser.
            </p>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead
            n="06"
            eyebrow="Who it's for"
            title="For the teams still reconciling statements in spreadsheets"
          />
          <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
            {[
              {
                title: 'Controllers',
                body: 'Who need to trust — and evidence — the number before signing a statement off, without waiting on an IT project.',
              },
              {
                title: 'AP teams',
                body: 'At 20–500-person businesses running QuickBooks, Xero, NetSuite, Sage, SAP or Oracle — anything that can export a spreadsheet works.',
              },
              {
                title: 'Accounting firms & fractional finance',
                body: 'Clearing supplier statements across many clients — each run is self-contained and shareable with a link.',
              },
            ].map((p) => (
              <div key={p.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
                <h3 className="font-serif text-xl font-medium text-ink">{p.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 border-t border-line pt-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
              When it earns its keep
            </p>
            <ul className="mt-4 grid gap-x-8 gap-y-2 text-[15px] text-ink-soft sm:grid-cols-2">
              {[
                'Month-end close — clearing supplier statements before sign-off',
                'Duplicate prevention — catching double-entered or double-paid invoices',
                'Credit recovery — finding supplier credits never applied to your account',
                'ERP migration — proving supplier balances match before and after cutover',
                'Audit preparation — an evidence-backed pack for every reconciled statement',
                'Supplier disputes — a drafted query email built from the findings',
              ].map((item) => (
                <li key={item} className="flex items-baseline gap-2">
                  <span aria-hidden="true" className="text-pine">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Formats & privacy */}
      <section id="privacy" className="scroll-mt-6 border-b border-line bg-cream">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead n="07" eyebrow="No IT project" title="Your files, your browser" />
          <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-0 md:divide-x md:divide-line">
            <div className="md:pr-12">
              <h3 className="font-serif text-xl font-medium text-ink">
                No ERP integration required
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                Works with the files you already have: PDF and scanned statements (read
                for you by AI), plus Excel (.xlsx, .xls), CSV, TSV, and
                semicolon-delimited exports from any ERP or accounting system. No
                connectors, no IT project, no credentials &mdash; export, upload,
                reconcile.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                Each statement line needs a reference, date, type, and amount; each ledger
                line needs the supplier, reference, date, type, original amount, and open
                (remaining) amount. Column names don&rsquo;t have to match &mdash; AI maps
                them for you.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                Extra AP columns in your export &mdash; due dates, AP comments, hold
                reasons, payment details &mdash; are carried through into the review and
                exports as evidence.
              </p>
              <p className="mt-4 text-sm text-ink-soft">
                Want to see the expected shape?{' '}
                <button
                  type="button"
                  onClick={() => downloadSample('sample_supplier_statement.csv', statementSample)}
                  className="font-semibold text-pine underline decoration-pine/40 underline-offset-2 hover:text-pine-deep"
                >
                  Download the sample statement
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => downloadSample('sample_ap_ledger_export.csv', ledgerSample)}
                  className="font-semibold text-pine underline decoration-pine/40 underline-offset-2 hover:text-pine-deep"
                >
                  the sample AP export
                </button>
                &nbsp;&mdash; the same files behind the sample run.
              </p>
            </div>
            <div className="md:pl-12">
              <h3 className="font-serif text-xl font-medium text-ink">
                Your ledger never leaves your browser
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                Parsing, matching, and every calculation run locally on your machine.
                Your AP ledger and any Excel or CSV statement are never uploaded. A PDF
                or image statement makes one trip to the server to be read into lines,
                then is discarded &mdash; never stored. Nothing is ever written to your
                ERP or sent on your behalf.
              </p>
              <a href="#security" className="mt-4 inline-block text-sm font-semibold text-pine hover:text-pine-deep">
                Read the full security &amp; data-handling page &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div aria-hidden="true" className="double-rule mx-auto w-16 text-pine" />
        <p className="mt-8 font-serif text-2xl font-medium leading-snug tracking-tight text-ink sm:text-[1.7rem]">
          Built for controllers who need to trust the number: the same two files always
          produce the same findings, the same bridge, the same email.
        </p>
        <p className="mt-4 text-sm text-ink-soft">
          Uncertain matches are surfaced for human review, never quietly applied.
        </p>
      </section>

      {/* Pricing */}
      <section ref={pricingRef} id="pricing" className="scroll-mt-6 border-t border-line bg-cream">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <SectionHead n="08" eyebrow="Pricing" title="Simple pricing, no surprises" center />
          <div className="mx-auto mt-12 grid max-w-3xl gap-8 text-left md:grid-cols-2 md:gap-6">
            {/* Solo */}
            <div className="border border-line bg-paper p-8">
              <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
                <span>Solo</span>
                <span>Per user, monthly</span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <p className="font-serif text-4xl font-medium text-ink">$49</p>
                <p className="text-sm text-ink-soft">/ month</p>
              </div>
              <ul className="mt-6 divide-y divide-line text-sm text-ink-soft">
                {[
                  'Unlimited reconciliations & batch runs (Excel, CSV, TSV — all in your browser)',
                  '25 AI statement reads / month (PDF & scanned statements)',
                  'AI column mapping and AI summaries (fair use)',
                  'Run history, recurring-exception tracking, drafted supplier emails',
                  'Excel exception exports, audit packs, shareable runs',
                ].map((item) => (
                  <li key={item} className="flex items-baseline gap-2.5 py-2.5">
                    <span aria-hidden="true" className="shrink-0 text-pine">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div aria-hidden="true" className="double-rule mt-5 text-ink/50" />
              <p className="mt-4 text-sm font-medium text-pine">
                14-day free trial — no card required
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                Full access during the trial, including AI statement reading and
                summaries — nothing is charged automatically.
              </p>
              <button
                type="button"
                onClick={onOpenApp}
                className="mt-6 w-full rounded-sm btn-gold px-4 py-3 text-sm font-semibold transition-colors"
              >
                Start free trial
              </button>
            </div>
            {/* Team / Firm */}
            <div className="border border-line bg-paper p-8">
              <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
                <span>Team &amp; Firm</span>
                <span>By agreement</span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <p className="font-serif text-4xl font-medium text-ink">Let&rsquo;s talk</p>
              </div>
              <ul className="mt-6 divide-y divide-line text-sm text-ink-soft">
                {[
                  'Everything in Solo',
                  'Multiple users',
                  'Higher AI statement-read volumes',
                  'Onboarding for your statement and export formats',
                  'Priority support',
                ].map((item) => (
                  <li key={item} className="flex items-baseline gap-2.5 py-2.5">
                    <span aria-hidden="true" className="shrink-0 text-pine">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div aria-hidden="true" className="double-rule mt-5 text-ink/50" />
              <p className="mt-4 text-sm font-medium text-pine">
                For AP teams and accounting firms
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                Tell us how many statements you clear a month and we&rsquo;ll come
                back with a price.
              </p>
              <a
                href="#contact"
                className="mt-6 block w-full rounded-sm border border-gold/40 px-4 py-3 text-center text-sm font-semibold text-pine transition-colors hover:bg-gold/10"
              >
                Contact us
              </a>
            </div>
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-ink-faint">
            Reconciliation itself runs in your browser and is never metered. The AI
            statement-read allowance covers PDF and scanned statements, which are read
            server-side — spreadsheet statements don&rsquo;t count against it.
          </p>
        </div>
      </section>

      {/* Design-partner lead capture */}
      <LeadCapture />

      {/* Contact */}
      <ContactSection />

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-burgundy via-night-warm to-night text-ink">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            Find out why it doesn&rsquo;t match &mdash; in minutes
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-5">
            <button
              type="button"
              onClick={onOpenApp}
              className="rounded-sm btn-gold px-7 py-3.5 text-sm font-semibold transition-colors"
            >
              Reconcile a statement
            </button>
            <button
              type="button"
              onClick={onSampleRun}
              className="rounded-sm border border-gold/40 px-7 py-3.5 text-sm font-semibold text-pine hover:bg-gold/10"
            >
              See a sample run
            </button>
          </div>
        </div>
        <footer className="border-t border-ink/15">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-ink-faint sm:flex-row">
            <span className="font-serif text-sm text-ink-soft">
              TieOut <span className="text-pine">AP</span> — tieoutap.com
            </span>
            <span className="flex flex-wrap items-center justify-center gap-4">
              <a href="#privacy-policy" className="text-ink-soft hover:text-pine">
                Privacy Policy
              </a>
              <a href="#terms" className="text-ink-soft hover:text-pine">
                Terms
              </a>
              <a href="#security" className="text-ink-soft hover:text-pine">
                Security
              </a>
              <a href="#contact" className="text-ink-soft hover:text-pine">
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
