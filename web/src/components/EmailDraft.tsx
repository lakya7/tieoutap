import { useState } from 'react'
import { draftEmail } from '../lib/email'
import type { Run } from '../lib/run'

export function EmailDraft({ run }: { run: Run }) {
  const [copied, setCopied] = useState(false)

  if (run.result.diagnostic !== null) {
    return (
      <p className="border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        No email drafted — reconciliation failed (the bridge does not tie out),
        so there is nothing safe to send the supplier. Diagnostic:{' '}
        <span className="font-mono">{run.result.diagnostic}</span>
      </p>
    )
  }

  const text = draftEmail(run)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-line bg-cream p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          Drafted from the findings — review, edit, and send it yourself. Nothing is sent
          automatically.
        </p>
        <button
          type="button"
          onClick={copy}
          className="border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink hover:border-ink-faint"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="mt-4 whitespace-pre-wrap border border-line bg-paper p-4 font-mono text-xs leading-relaxed">
        {text}
      </pre>
    </div>
  )
}
