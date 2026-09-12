import { useEffect } from 'react'
import { ContactSection } from './ContactSection'
import { HeroDemo } from './HeroDemo'
import { LandingNav } from './LandingNav'

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
  useEffect(() => {
    if (location.hash === '#contact') {
      document.getElementById('contact')?.scrollIntoView()
    }
  }, [])

  return (
    <div className="bg-paper text-ink">
      {/* Hero */}
      <div className="border-b border-line">
        <header className="border-b border-line">
          <LandingNav onOpenApp={onOpenApp} onSampleRun={onSampleRun} />
        </header>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-16 lg:grid-cols-2">
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-pine">
              Supplier statement reconciliation
              <span aria-hidden="true" className="h-px w-10 bg-pine/40" />
            </p>
            <h1 className="mt-5 font-serif text-[2.65rem] font-medium leading-[1.06] tracking-tight text-ink sm:text-6xl">
              Know exactly why your supplier balance doesn&rsquo;t match.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Upload a supplier statement and your AP ledger export. TieOut matches
              invoices, payments, and credits, classifies every difference, and
              bridges the two balances exactly &mdash; down to 0.00 unexplained.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={onOpenApp}
                className="rounded-sm bg-ink px-7 py-3.5 text-sm font-semibold text-paper transition-colors hover:bg-pine-deep"
              >
                Reconcile a statement
              </button>
              <button
                type="button"
                onClick={onSampleRun}
                className="group text-sm font-semibold text-pine"
              >
                See a sample run{' '}
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
      <section id="ai" className="scroll-mt-6 bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-moss">
            <span className="font-mono">02</span>
            <span aria-hidden="true" className="h-px w-8 bg-moss/40" />
            Where the AI stops
          </p>
          <h2 className="mt-4 max-w-2xl font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            AI where it helps. Determinism where it counts.
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-paper/70">
            AI is great at reading documents and wording explanations — and terrible at
            being right every time. So TieOut draws a hard line: AI touches the
            paperwork and the prose, never the numbers.
          </p>

          <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="divide-y divide-paper/15">
              {AI_ITEMS.map((item) => (
                <div key={item.label} className="py-6 first:pt-0 last:pb-0">
                  <h3 className="font-serif text-lg font-medium text-paper">{item.label}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-paper/70">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="border border-paper/20 bg-paper/5 p-8 sm:p-10">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-moss">
                And then — no AI at all
              </p>
              <h3 className="mt-4 font-serif text-2xl font-medium leading-snug text-paper">
                Determinism does the maths
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-paper/70">
                Matching, arithmetic, classification and the bridge run in a
                deterministic six-pass cascade — no model anywhere in the numbers.
                The same two files always produce the same findings and the same
                bridge.
              </p>
              <div className="mt-8 space-y-1.5 font-mono text-sm text-paper/80">
                <div className="flex justify-between">
                  <span>Same two files in</span>
                  <span>every time</span>
                </div>
                <div className="flex justify-between">
                  <span>Same answer out</span>
                  <span>every time</span>
                </div>
                <div className="mt-3 flex justify-between border-t border-paper/30 pt-3 font-semibold text-paper">
                  <span>Unexplained</span>
                  <span>0.00</span>
                </div>
                <div aria-hidden="true" className="double-rule text-paper/70" />
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

      {/* Formats & privacy */}
      <section id="privacy" className="scroll-mt-6 border-b border-line bg-cream">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead n="04" eyebrow="No IT project" title="Your files, your browser" />
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
      <section id="pricing" className="scroll-mt-6 border-t border-line bg-cream">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <SectionHead n="05" eyebrow="Pricing" title="One plan, everything included" center />
          <div className="mx-auto mt-12 max-w-md border border-line bg-paper p-8 text-left">
            <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
              <span>TieOut AP</span>
              <span>Monthly plan</span>
            </div>
            <ul className="mt-6 divide-y divide-line text-sm text-ink-soft">
              {[
                'Unlimited reconciliations',
                'PDF, scan, Excel, CSV and TSV statements',
                'AI column mapping and AI summaries',
                'Drafted supplier emails and shareable runs',
              ].map((item) => (
                <li key={item} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span>{item}</span>
                  <span className="shrink-0 font-mono text-xs text-pine">included</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-baseline justify-between border-t border-ink/60 pt-4">
              <span className="text-sm font-semibold text-ink">Total</span>
              <p className="font-serif text-4xl font-medium text-ink">
                $19<span className="text-base text-ink-faint">/month</span>
              </p>
            </div>
            <div aria-hidden="true" className="double-rule mt-1.5 text-ink/50" />
            <p className="mt-4 text-sm font-medium text-pine">
              14-day free trial — no card required
            </p>
            <button
              type="button"
              onClick={onOpenApp}
              className="mt-6 w-full rounded-sm bg-ink px-4 py-3 text-sm font-semibold text-paper transition-colors hover:bg-pine-deep"
            >
              Start free trial
            </button>
          </div>
        </div>
      </section>

      {/* Contact */}
      <ContactSection />

      {/* Final CTA */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            Find out why it doesn&rsquo;t match &mdash; in minutes
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-5">
            <button
              type="button"
              onClick={onOpenApp}
              className="rounded-sm bg-paper px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-moss"
            >
              Reconcile a statement
            </button>
            <button
              type="button"
              onClick={onSampleRun}
              className="rounded-sm border border-paper/30 px-7 py-3.5 text-sm font-semibold text-paper hover:bg-paper/10"
            >
              See a sample run
            </button>
          </div>
        </div>
        <footer className="border-t border-paper/15">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-paper/50 sm:flex-row">
            <span className="font-serif text-sm text-paper/80">
              TieOut <span className="text-moss">AP</span> — tieoutap.com
            </span>
            <span className="flex items-center gap-4">
              <a href="#contact" className="text-paper/70 hover:text-paper">
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
