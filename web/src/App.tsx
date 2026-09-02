import { useEffect, useState } from 'react'
import { BridgeView } from './components/BridgeView'
import { EmailDraft } from './components/EmailDraft'
import { ExceptionQueue } from './components/ExceptionQueue'
import { SummaryBar } from './components/SummaryBar'
import { UploadPanel } from './components/UploadPanel'
import { executeRun } from './lib/run'
import type { Run, RunInput } from './lib/run'
import { runFromLocation, shareUrl } from './lib/share'

type Tab = 'queue' | 'bridge' | 'email'

const TABS: { id: Tab; label: string }[] = [
  { id: 'queue', label: 'Exception queue' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'email', label: 'Email draft' },
]

export default function App() {
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('queue')
  const [linkCopied, setLinkCopied] = useState(false)

  const start = (input: RunInput) => {
    try {
      setRun(executeRun(input))
      setError(null)
      setTab('queue')
      history.replaceState(null, '', `#run=${shareUrl(input).split('#run=')[1]}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    const fromUrl = runFromLocation()
    if (fromUrl) {
      try {
        setRun(executeRun(fromUrl))
      } catch {
        setError('The shared run link could not be loaded.')
      }
    }
  }, [])

  const reset = () => {
    setRun(null)
    setError(null)
    history.replaceState(null, '', location.pathname)
  }

  const copyLink = async () => {
    if (!run) return
    await navigator.clipboard.writeText(shareUrl(run.input))
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight">
              TieOut <span className="text-emerald-600">AP</span>
            </h1>
            <span className="hidden text-sm text-stone-500 sm:inline">
              supplier statement reconciliation
            </span>
          </div>
          {run && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={copyLink}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
              >
                {linkCopied ? 'Link copied' : 'Copy run link'}
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                New run
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {!run ? (
          <UploadPanel onRun={start} error={error} />
        ) : (
          <div className="space-y-6">
            <SummaryBar result={run.result} />
            <nav className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1 shadow-sm">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            {tab === 'queue' && <ExceptionQueue run={run} />}
            {tab === 'bridge' && <BridgeView bridge={run.result.bridge} />}
            {tab === 'email' && <EmailDraft run={run} />}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-6 pb-8 text-xs text-stone-400">
        TieOut AP never writes to your ERP, holds no credentials, and sends nothing on
        your behalf. Reconciliation runs entirely in your browser.
      </footer>
    </div>
  )
}
