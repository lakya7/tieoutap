import { useState } from 'react'
import { requestSummary } from '../lib/ai'
import type { SummaryResult } from '../lib/ai'
import type { Run } from '../lib/run'

/** Opt-in AI narrative of a finished deterministic run, plus a reworded
 * supplier email. Only the findings (refs + amounts) are sent to the server —
 * never the uploaded files — and the engine's numbers stay authoritative.
 * Rendered with a per-run key, so state resets whenever the run changes. */
export function AiSummary({ run }: { run: Run }) {
  const [state, setState] = useState<'idle' | 'busy'>('idle')
  const [result, setResult] = useState<SummaryResult | null>(null)
  const [copied, setCopied] = useState(false)

  if (run.result.diagnostic !== null) return null

  const generate = () => {
    setState('busy')
    setResult(null)
    void requestSummary(run).then((res) => {
      setState('idle')
      setResult(res)
    })
  }

  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-blue-900">AI summary</h3>
          <p className="text-xs text-stone-500">
            A plain-English read of the findings and a reworded supplier email. Only the
            findings (refs and amounts) are sent — never your files. The numbers above stay
            the deterministic engine&rsquo;s.
          </p>
        </div>
        <button
          type="button"
          disabled={state === 'busy'}
          onClick={generate}
          className="rounded-md bg-blue-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {state === 'busy'
            ? 'Summarising…'
            : result?.ok
              ? 'Regenerate'
              : 'Generate AI summary'}
        </button>
      </div>
      {result && !result.ok && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Could not generate the summary: {result.detail}
        </p>
      )}
      {result?.ok && (
        <div className="mt-4 space-y-4">
          <div className="whitespace-pre-wrap rounded-lg border border-blue-200 bg-white p-4 text-sm leading-relaxed">
            {result.narrative}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                AI-reworded supplier email
              </h4>
              <button
                type="button"
                onClick={() => void copyEmail(result.email)}
                className="rounded-md border border-stone-300 px-3 py-1 text-xs font-medium hover:bg-stone-50"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-stone-200 bg-white p-4 font-mono text-xs leading-relaxed">
              {result.email}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
