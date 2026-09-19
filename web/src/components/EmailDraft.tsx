import { useState } from 'react'
import { draftEmail } from '../lib/email'
import type { Run } from '../lib/run'

export function EmailDraft({ run }: { run: Run }) {
  const [copied, setCopied] = useState(false)

  if (run.result.diagnostic !== null) {
    return (
      <p className="border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
        No email drafted — reconciliation failed (the variance cannot be fully explained),
        so there is nothing safe to send the supplier. Diagnostic:{' '}
        <span className="font-mono">{run.result.diagnostic}</span>
      </p>
    )
  }

  const text = draftEmail(run)
  const firstLine = text.split('\n', 1)[0] ?? ''
  const subject = firstLine.startsWith('Subject: ') ? firstLine.slice(9) : firstLine
  const bodyStart = text.indexOf('\n\n')
  const body = bodyStart === -1 ? text : text.slice(bodyStart + 2)
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-line bg-cream p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Drafted from the findings — review, edit, and send it yourself. Nothing is sent
          automatically.
        </p>
        <div className="flex shrink-0 gap-2">
          <a
            href={mailto}
            className="btn-gold px-3 py-1.5 text-sm font-semibold"
            title="Opens your email app with the subject and draft filled in — add the supplier's address and send from there. Very long drafts may be cut off by some email apps; use Copy if so."
          >
            Open in email app
          </a>
          <button
            type="button"
            onClick={copy}
            className="border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink hover:border-ink-faint"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="mt-4 whitespace-pre-wrap border border-line bg-paper p-4 font-mono text-xs leading-relaxed">
        {text}
      </pre>
    </div>
  )
}
