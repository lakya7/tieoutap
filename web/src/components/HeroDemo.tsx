import { useEffect, useState } from 'react'

interface HeroDemoProps {
  onSampleRun: () => void
}

const STAGES = ['Upload', 'Match', 'Explain', 'Tie out'] as const
const STAGE_MS = 3600

const MATCH_ROWS = [
  ['INV-88112', '5,214.00'],
  ['INV-88129', '12,406.00'],
  ['PAY-1104', '−8,000.00'],
  ['CRN-3021', '−1,450.00'],
  ['INV-88140', '3,975.00'],
]

const FINDINGS = [
  ['Invoice missing from your ledger', '+15,780.00'],
  ['Your payment not yet applied', '+10,000.00'],
  ['Invoice in transit (timing)', '+9,120.00'],
  ['Duplicate posting in your ledger', '−7,905.00'],
  ['Credit you haven’t claimed', '−2,760.00'],
  ['Amount keyed differently', '+234.00'],
]

function FileChip({
  name,
  kind,
  amount,
  label,
  show,
  delay,
}: {
  name: string
  kind: string
  amount: string
  label: string
  show: boolean
  delay: string
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-sm border border-line bg-paper p-3 transition-all duration-500 motion-reduce:transition-none ${
        show ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
      style={{ transitionDelay: show ? delay : '0ms' }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-ink text-[11px] font-bold text-paper">
        {kind}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-ink">{name}</p>
        <p className="text-xs text-ink-faint">{label}</p>
      </div>
      <p className="shrink-0 font-mono text-xs font-semibold text-ink-soft">{amount}</p>
    </div>
  )
}

export function HeroDemo({ onSampleRun }: HeroDemoProps) {
  const [animate] = useState(
    () => !matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [stage, setStage] = useState(() => (animate ? 0 : STAGES.length - 1))
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    if (!animate) return
    const timer = setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length)
    }, STAGE_MS)
    return () => clearInterval(timer)
  }, [animate, cycle])

  const selectStage = (i: number) => {
    setStage(i)
    setCycle((c) => c + 1)
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-sm border border-line bg-cream p-5 shadow-xl shadow-ink/10">
        {/* Stage indicator */}
        <div className="flex items-center gap-1.5">
          {STAGES.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => selectStage(i)}
              aria-label={`Show step ${i + 1}: ${name}`}
              aria-pressed={i === stage}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-300 motion-reduce:transition-none ${
                i === stage
                  ? 'bg-ink text-paper'
                  : 'bg-ink/5 text-ink-soft hover:bg-ink/10'
              }`}
            >
              <span className="font-mono">{i + 1}</span>
              <span className="hidden sm:inline">{name}</span>
            </button>
          ))}
          <span className="ml-auto rounded-full bg-moss px-2.5 py-0.5 text-xs font-semibold text-pine ring-1 ring-inset ring-pine/25">
            Live demo
          </span>
        </div>

        <div className="relative mt-4 h-[300px] overflow-hidden">
          {/* Stage 1: Upload */}
          <div
            aria-hidden={stage !== 0}
            inert={stage !== 0}
            className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${
              stage === 0 ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-ink-faint">
              Two files in
            </p>
            <div className="mt-3 space-y-3">
              <FileChip
                name="meridian_statement.pdf"
                kind="PDF"
                amount="59,165.00"
                label="Supplier statement — read by AI"
                show={stage === 0}
                delay="150ms"
              />
              <FileChip
                name="ap_open_items.csv"
                kind="CSV"
                amount="34,696.00"
                label="Your AP export — stays in your browser"
                show={stage === 0}
                delay="500ms"
              />
            </div>
            <div
              className={`mt-4 flex justify-between rounded-sm border border-amber-300/60 bg-amber-50 p-3 font-mono text-xs font-semibold text-amber-900 transition-all duration-500 motion-reduce:transition-none ${
                stage === 0 ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
              }`}
              style={{ transitionDelay: stage === 0 ? '900ms' : '0ms' }}
            >
              <span>Difference to explain</span>
              <span>24,469.00</span>
            </div>
          </div>

          {/* Stage 2: Match */}
          <div
            aria-hidden={stage !== 1}
            inert={stage !== 1}
            className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${
              stage === 1 ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-ink-faint">
              Deterministic matching — no AI in the numbers
            </p>
            <div className="mt-3 space-y-2">
              {MATCH_ROWS.map(([ref, amount], i) => (
                <div
                  key={ref}
                  className={`flex items-center justify-between rounded-sm border border-line bg-paper px-3 py-2 font-mono text-xs transition-all duration-400 motion-reduce:transition-none ${
                    stage === 1 ? 'translate-x-0 opacity-100' : '-translate-x-3 opacity-0'
                  }`}
                  style={{ transitionDelay: stage === 1 ? `${150 + i * 350}ms` : '0ms' }}
                >
                  <span className="text-ink-soft">{ref}</span>
                  <span className="text-ink-faint">{amount}</span>
                  <span
                    className={`flex items-center gap-1 font-sans font-semibold text-pine transition-opacity duration-300 motion-reduce:transition-none ${
                      stage === 1 ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ transitionDelay: stage === 1 ? `${450 + i * 350}ms` : '0ms' }}
                  >
                    ✓ matched
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stage 3: Explain */}
          <div
            aria-hidden={stage !== 2}
            inert={stage !== 2}
            className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${
              stage === 2 ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-ink-faint">
              Every difference, named in AP language
            </p>
            <div className="mt-3 space-y-1.5">
              {FINDINGS.map(([label, amount], i) => (
                <div
                  key={label}
                  className={`flex justify-between font-mono text-xs transition-all duration-400 motion-reduce:transition-none sm:text-sm ${
                    stage === 2 ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                  }`}
                  style={{ transitionDelay: stage === 2 ? `${150 + i * 300}ms` : '0ms' }}
                >
                  <span className="min-w-0 truncate pr-4 text-ink-soft">{label}</span>
                  <span
                    className={`shrink-0 ${amount.startsWith('+') ? 'text-pine' : 'text-ink-faint'}`}
                  >
                    {amount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stage 4: Tie out */}
          <div
            aria-hidden={stage !== 3}
            inert={stage !== 3}
            className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${
              stage === 3 ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-ink-faint">
              The bridge ties exactly
            </p>
            <dl className="mt-3 space-y-1.5 font-mono text-xs sm:text-sm">
              <div className="flex justify-between text-ink-soft">
                <dt>Supplier statement balance</dt>
                <dd>59,165.00</dd>
              </div>
              <div className="flex justify-between text-ink-soft">
                <dt>Your AP ledger balance</dt>
                <dd>34,696.00</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold text-ink">
                <dt>Difference</dt>
                <dd>24,469.00</dd>
              </div>
              <div className="flex justify-between text-ink-faint">
                <dt>Explained by 6 findings</dt>
                <dd>24,469.00</dd>
              </div>
            </dl>
            <div
              className={`mt-5 rounded-sm border border-pine/30 bg-moss p-4 transition-all motion-reduce:transition-none ${
                animate ? 'duration-500' : ''
              } ${stage === 3 ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
              style={{ transitionDelay: stage === 3 && animate ? '600ms' : '0ms' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-pine-deep">Unexplained</span>
                <span className="font-mono text-lg font-bold text-pine">0.00</span>
              </div>
              <div aria-hidden="true" className="double-rule mt-1 text-pine/60" />
            </div>
            <p
              className={`mt-3 text-xs text-ink-faint transition-opacity duration-500 motion-reduce:transition-none ${
                stage === 3 ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ transitionDelay: stage === 3 && animate ? '1100ms' : '0ms' }}
            >
              Deterministic: the same two files always produce this exact answer.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={onSampleRun}
          className="text-sm font-semibold text-pine hover:text-pine-deep"
        >
          Explore this run live — real numbers, one click →
        </button>
      </div>
    </div>
  )
}
