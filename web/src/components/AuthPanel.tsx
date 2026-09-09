import { type FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'

export function AuthPanel() {
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
    <div className="mx-auto max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-bold tracking-tight">
        {mode === 'signin' ? 'Sign in to reconcile' : 'Create your account'}
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        Your files still never leave the browser — the account only unlocks the
        reconciliation screen.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="auth-email" className="block text-sm font-medium text-stone-700">
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="block text-sm font-medium text-stone-700">
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {notice && (
          <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{notice}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-stone-500">
        {mode === 'signin' ? (
          <>
            New here?{' '}
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setNotice(null) }}
              className="font-medium text-blue-700 hover:underline"
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
              className="font-medium text-blue-700 hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  )
}
