import { useEffect, useState, type ReactNode } from 'react'
import { requestCheckout, requestPortal, requestSubscription } from '../lib/billing'
import type { SubscriptionInfo } from '../lib/billing'

type GateState =
  | { kind: 'loading' }
  | { kind: 'error'; detail: string }
  | { kind: 'ready'; info: SubscriptionInfo }

/** Wraps the reconcile screen: renders it only when the signed-in user has an
 * active subscription or trial, otherwise shows the subscribe panel. When
 * billing is disabled on the deployment the server reports active. */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [justSubscribed] = useState(() => location.hash.includes('checkout=success'))

  useEffect(() => {
    let cancelled = false
    void requestSubscription().then((res) => {
      if (cancelled) return
      setState(res.ok ? { kind: 'ready', info: res } : { kind: 'error', detail: res.detail })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const redirect = async (kind: 'checkout' | 'portal') => {
    setBusy(true)
    setActionError(null)
    const res = await (kind === 'checkout' ? requestCheckout() : requestPortal())
    if (res.ok) {
      location.assign(res.url)
    } else {
      setActionError(res.detail)
      setBusy(false)
    }
  }

  if (state.kind === 'loading') {
    return <p className="py-16 text-center text-sm text-stone-500">Checking your subscription…</p>
  }

  if (state.kind === 'error') {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-red-700">Could not check your subscription: {state.detail}</p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-4 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
        >
          Try again
        </button>
      </div>
    )
  }

  const { info } = state
  const managed = info.status !== 'disabled' && info.status !== 'complimentary'

  if (info.active) {
    return (
      <div className="space-y-4">
        {justSubscribed && (
          <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            You&rsquo;re in — your free trial has started.
          </p>
        )}
        {children}
        {managed && (
          <p className="text-center text-xs text-stone-400">
            {info.status === 'trialing' && info.trial_end
              ? `Free trial until ${info.trial_end} · `
              : ''}
            <button
              type="button"
              onClick={() => void redirect('portal')}
              disabled={busy}
              className="underline hover:text-stone-600 disabled:opacity-60"
            >
              Manage billing
            </button>
            {actionError && <span className="ml-2 text-red-600">{actionError}</span>}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-bold tracking-tight">Start your 14-day free trial</h2>
      <p className="mt-1 text-sm text-stone-500">
        Full access to reconciliation, AI column mapping, AI summaries, and PDF
        statement reading. $19/month after the trial — cancel anytime.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-stone-600">
        <li>• Your files still never leave the browser</li>
        <li>• Card required to start; nothing is charged until the trial ends</li>
        <li>• Cancel in one click from Manage billing</li>
      </ul>
      {info.status === 'canceled' && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your previous subscription has ended — subscribe again to continue.
        </p>
      )}
      {actionError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}
      <button
        type="button"
        onClick={() => void redirect('checkout')}
        disabled={busy}
        className="mt-6 w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {busy ? 'Opening checkout…' : 'Start free trial'}
      </button>
      <p className="mt-3 text-center text-xs text-stone-400">
        Secure payment by Stripe. TieOut AP never sees your card details.
      </p>
    </div>
  )
}
