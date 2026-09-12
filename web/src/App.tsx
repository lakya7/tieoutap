import { useEffect, useState } from 'react'
import statementSample from '../../fixtures/meridian_stmt.csv?raw'
import ledgerSample from '../../fixtures/acme_ledger.csv?raw'
import { AiSummary } from './components/AiSummary'
import { AuthPanel } from './components/AuthPanel'
import { BridgeView } from './components/BridgeView'
import { EmailDraft } from './components/EmailDraft'
import { ExceptionQueue } from './components/ExceptionQueue'
import { Landing } from './components/Landing'
import { SubscriptionGate } from './components/SubscriptionGate'
import { SummaryBar } from './components/SummaryBar'
import { TrustPage } from './components/TrustPages'
import type { TrustPageId } from './components/TrustPages'
import { UploadPanel } from './components/UploadPanel'
import { deriveAsAt, deriveSupplier, executeRun } from './lib/run'
import type { Run, RunInput } from './lib/run'
import { runFromLocation, shareUrl } from './lib/share'
import { useAuth } from './lib/auth'

type Tab = 'queue' | 'bridge' | 'email'
type View = 'landing' | 'app' | TrustPageId

const TRUST_PAGES: TrustPageId[] = ['privacy-policy', 'terms', 'security']

function isTrustPage(hash: string): hash is TrustPageId {
  return (TRUST_PAGES as string[]).includes(hash)
}

const GUEST_RUN_KEY = 'tieout-guest-run-used'

const runKeys = new WeakMap<Run, number>()
let nextRunKey = 1

function runKey(run: Run): number {
  let key = runKeys.get(run)
  if (key === undefined) {
    key = nextRunKey++
    runKeys.set(run, key)
  }
  return key
}

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
  const [view, setView] = useState<View>(() => {
    const hash = location.hash.slice(1)
    if (isTrustPage(hash)) return hash
    return hash === '' || hash === 'contact' ? 'landing' : 'app'
  })
  const [guestRunUsed, setGuestRunUsed] = useState(
    () => localStorage.getItem(GUEST_RUN_KEY) === '1',
  )
  const [showAuth, setShowAuth] = useState(false)
  const { session, loading: authLoading, enabled: authEnabled, signOut } = useAuth()

  const start = (input: RunInput): boolean => {
    try {
      setRun(executeRun(input))
      setError(null)
      setTab('queue')
      history.replaceState(null, '', `#run=${shareUrl(input).split('#run=')[1]}`)
      return true
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      setError(`Could not read the CSV files (${detail}). Check the column layout against the hints on each upload box.`)
      return false
    }
  }

  const startGuest = (input: RunInput) => {
    if (start(input)) {
      localStorage.setItem(GUEST_RUN_KEY, '1')
      setGuestRunUsed(true)
    }
  }

  useEffect(() => {
    const onHashChange = () => {
      const hash = location.hash.slice(1)
      if (isTrustPage(hash)) {
        setView(hash)
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const fromUrl = runFromLocation()
    if (fromUrl.kind === 'invalid') {
      setError('The shared run link is malformed or incomplete — ask the sender to copy it again.')
    } else if (fromUrl.kind === 'run') {
      try {
        setRun(executeRun(fromUrl.input))
      } catch {
        setError('The shared run link could not be loaded.')
      }
    }
  }, [])

  const reset = () => {
    setRun(null)
    setError(null)
    history.replaceState(null, '', `${location.pathname}#app`)
  }

  const openApp = () => {
    setView('app')
    history.replaceState(null, '', `${location.pathname}#app`)
  }

  const sampleRun = () => {
    setView('app')
    start({
      statementCsv: statementSample,
      ledgerCsv: ledgerSample,
      supplier: deriveSupplier(ledgerSample),
      asAt: deriveAsAt(statementSample),
    })
  }

  const goHome = () => {
    setView('landing')
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

  if (view === 'landing') {
    return <Landing onOpenApp={openApp} onSampleRun={sampleRun} />
  }

  if (view !== 'app') {
    return <TrustPage page={view} onHome={goHome} />
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-3">
            <button
              type="button"
              onClick={goHome}
              className="text-xl font-bold tracking-tight hover:text-blue-700"
              title="Back to home page"
            >
              TieOut <span className="text-blue-700">AP</span>
            </button>
            <span className="hidden text-sm text-stone-500 sm:inline">
              supplier statement reconciliation
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goHome}
              className="text-sm font-medium text-stone-600 hover:text-blue-700"
            >
              &larr; Home
            </button>
            {authEnabled && session && (
              <>
                <span className="hidden text-sm text-stone-500 sm:inline">
                  {session.user.email}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
                >
                  Sign out
                </button>
              </>
            )}
            {run && (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {!run ? (
          authEnabled && !session ? (
            authLoading ? (
              <p className="py-16 text-center text-sm text-stone-500">Loading…</p>
            ) : guestRunUsed || showAuth ? (
              <div className="space-y-4">
                {guestRunUsed && (
                  <p className="mx-auto max-w-md rounded-md bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
                    You&rsquo;ve used your free run. Create a free account to keep
                    reconciling &mdash; 14-day trial, no card needed.
                  </p>
                )}
                <AuthPanel onSampleRun={sampleRun} />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Trying without an account &mdash; you get one free reconciliation
                  with your own files. Nothing you upload leaves your browser.{' '}
                  <button
                    type="button"
                    onClick={() => setShowAuth(true)}
                    className="font-semibold underline hover:text-emerald-900"
                  >
                    Sign in instead
                  </button>
                </p>
                <UploadPanel onRun={startGuest} error={error} />
              </div>
            )
          ) : (
            <SubscriptionGate>
              <UploadPanel onRun={start} error={error} />
            </SubscriptionGate>
          )
        ) : (
          <div className="space-y-6">
            <SummaryBar result={run.result} />
            {(!authEnabled || session) && <AiSummary key={runKey(run)} run={run} />}
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
