import { type FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'

interface AuthPanelProps {
  onSampleRun: () => void
}

export function AuthPanel({ onSampleRun }: AuthPanelProps) {
  const [mode, setMode] = useState<Mode>('signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase) return
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(error.message)
      } else {
        const { data: result, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setError(error.message)
        } else if (!result.session) {
          setNotice('Check your email for a confirmation link, then sign in.')
          setMode('signin')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md border border-line bg-cream p-8">
      <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">
        {mode === 'signin' ? 'Sign in to reconcile' : 'Create your account'}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Your files still never leave the browser — the account only unlocks the
        reconciliation screen.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="auth-email" className="block font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm focus:border-pine focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="block font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm focus:border-pine focus:outline-none"
          />
        </div>
        {error && (
          <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {notice && (
          <p className="border border-pine/30 bg-moss px-3 py-2 text-sm text-pine-deep">{notice}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-pine-deep disabled:opacity-60"
        >
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-soft">
        {mode === 'signin' ? (
          <>
            New here?{' '}
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setNotice(null) }}
              className="font-semibold text-pine hover:underline"
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); setNotice(null) }}
              className="font-semibold text-pine hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </p>
      <div className="mt-6 border-t border-line pt-4 text-center">
        <p className="text-sm text-ink-soft">Want to see it work first?</p>
        <button
          type="button"
          onClick={onSampleRun}
          className="mt-1 text-sm font-semibold text-pine hover:underline"
        >
          Explore the sample reconciliation — no account needed
        </button>
      </div>
    </div>
  )
}
