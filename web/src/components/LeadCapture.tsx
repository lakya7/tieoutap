import { useState } from 'react'
import { track } from '../lib/analytics'

/** Same Web3Forms inbox relay as the contact form — public by design; only
 * the email typed into this form is sent, never reconciliation data. */
const WEB3FORMS_ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_KEY as string | undefined

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function LeadCapture() {
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    if (!WEB3FORMS_ACCESS_KEY) {
      setStatus('error')
      return
    }
    setStatus('sending')
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: 'New design-partner interest from tieoutap.com',
          from_name: 'TieOut AP design-partner form',
          email: data.get('email'),
          message: 'Design-partner interest signup (email only).',
        }),
      })
      const json: { success?: boolean } = await res.json()
      if (json.success) {
        setStatus('sent')
        track('lead_submitted')
        form.reset()
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className="border-t border-line bg-gradient-to-br from-night-card via-night to-night-warm">
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-pine">
          Design partners
        </p>
        <h2 className="mt-3 font-serif text-2xl font-medium tracking-tight text-ink sm:text-3xl">
          Reconcile supplier statements every month? Help shape TieOut AP.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
          We&rsquo;re onboarding a small group of controllers, AP teams, and
          accounting firms as design partners — hands-on help with your real
          statements, and a direct line on what gets built next. Leave your
          email and we&rsquo;ll get in touch.
        </p>
        {status === 'sent' ? (
          <p className="mx-auto mt-6 max-w-md border border-pine/30 bg-moss px-4 py-3 text-sm font-medium text-pine-deep">
            Thanks — we&rsquo;ll be in touch shortly.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="lead-email" className="sr-only">
              Work email
            </label>
            <input
              id="lead-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="min-w-0 flex-1 rounded-sm border border-line bg-cream px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="shrink-0 rounded-sm btn-gold px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'sending' ? 'Sending…' : 'I\u2019m interested'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="mt-3 text-sm font-medium text-red-400" role="alert">
            Could not send — please try again, or use the contact form below.
          </p>
        )}
        <p className="mt-4 text-xs text-ink-faint">
          Only your email is sent — nothing else, and never any files.
        </p>
      </div>
    </section>
  )
}
