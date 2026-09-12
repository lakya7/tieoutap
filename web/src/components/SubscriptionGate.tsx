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
    return <p className="py-16 text-center text-sm text-ink-faint">Checking your subscription…</p>
  }

  if (state.kind === 'error') {
    return (
      <div className="mx-auto max-w-md border border-line bg-cream p-8 text-center">
        <p className="text-sm text-red-700">Could not check your subscription: {state.detail}</p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-4 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-ink-faint"
        >
          Try again
        </button>
      </div>
    )
  }

  const { info } = state
  const managed = info.status === 'active' || info.status === 'trialing'
  const onFreeTrial = info.status === 'free_trial'

  if (info.active) {
    return (
      <div className="space-y-4">
        {justSubscribed && (
          <p className="border border-pine/30 bg-moss px-4 py-3 text-sm text-pine-deep">
            You&rsquo;re in — your subscription is active.
          </p>
        )}
        {children}
        {onFreeTrial && (
          <p className="text-center text-xs text-ink-faint">
            {info.trial_end ? `Free trial until ${info.trial_end} · ` : ''}
            <button
              type="button"
              onClick={() => void redirect('checkout')}
              disabled={busy}
              className="underline hover:text-pine disabled:opacity-60"
            >
              Subscribe now
            </button>
            {actionError && <span className="ml-2 text-red-600">{actionError}</span>}
          </p>
        )}
        {managed && (
          <p className="text-center text-xs text-ink-faint">
            {info.status === 'trialing' && info.trial_end
              ? `Free trial until ${info.trial_end} · `
              : ''}
            <button
              type="button"
              onClick={() => void redirect('portal')}
              disabled={busy}
              className="underline hover:text-pine disabled:opacity-60"
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
    <div className="mx-auto max-w-md border border-line bg-cream p-8">
      <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">Your free trial has ended</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Keep full access to reconciliation, AI column mapping, AI summaries, and
        PDF statement reading for $19/month — cancel anytime.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-ink-soft">
        <li>— Your files still never leave the browser</li>
        <li>— Cancel in one click from Manage billing</li>
      </ul>
      {info.status === 'canceled' && (
        <p className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your previous subscription has ended — subscribe again to continue.
        </p>
      )}
      {actionError && (
        <p className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}
      <button
        type="button"
        onClick={() => void redirect('checkout')}
        disabled={busy}
        className="mt-6 w-full bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-pine-deep disabled:opacity-60"
      >
        {busy ? 'Opening checkout…' : 'Subscribe — $19/month'}
      </button>
      <p className="mt-3 text-center text-xs text-ink-faint">
        Secure payment by Stripe. TieOut AP never sees your card details.
      </p>
    </div>
  )
}
