import { useState } from 'react'

/** Access key for the Web3Forms relay that forwards contact-form submissions
 * to the site owner's inbox. Public by design (it only identifies the inbox);
 * only the fields typed into this form are sent — never reconciliation data. */
const WEB3FORMS_ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_KEY as string | undefined

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function ContactSection() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    if (!WEB3FORMS_ACCESS_KEY) {
      setStatus('error')
      setError('Contact form is not configured yet — email us instead.')
      return
    }
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: 'New enquiry from tieoutap.com',
          from_name: 'TieOut AP contact form',
          name: data.get('name'),
          email: data.get('email'),
          message: data.get('message'),
        }),
      })
      const json: { success?: boolean; message?: string } = await res.json()
      if (json.success) {
        setStatus('sent')
        form.reset()
      } else {
        setStatus('error')
        setError(json.message || 'Something went wrong — please try again.')
      }
    } catch {
      setStatus('error')
      setError('Could not send — check your connection and try again.')
    }
  }

  return (
    <section id="contact" className="border-t border-line bg-paper">
      <div className="mx-auto max-w-2xl px-6 py-24">
        <p className="flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-pine">
          <span className="font-mono">06</span>
          <span aria-hidden="true" className="h-px w-8 bg-pine/40" />
          Contact
        </p>
        <h2 className="mt-4 text-center font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
          Get in touch
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center leading-relaxed text-ink-soft">
          Questions, a statement format we should support, or a walkthrough for your team —
          send a message and we&rsquo;ll reply by email.
        </p>
        {status === 'sent' ? (
          <div className="mt-10 border border-pine/30 bg-moss p-8 text-center">
            <p className="font-serif text-lg font-medium text-pine-deep">Message sent</p>
            <p className="mt-2 text-sm text-pine">
              Thanks for reaching out — we&rsquo;ll get back to you shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-ink">
                  Name
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  className="mt-1.5 w-full rounded-sm border border-line bg-cream px-3.5 py-2.5 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-ink">
                  Email
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1.5 w-full rounded-sm border border-line bg-cream px-3.5 py-2.5 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine"
                  placeholder="jane@company.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium text-ink">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                className="mt-1.5 w-full rounded-sm border border-line bg-cream px-3.5 py-2.5 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine"
                placeholder="How can we help?"
              />
            </div>
            {status === 'error' && (
              <p className="text-sm font-medium text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-ink-faint">
                Only what you type here is sent — your reconciliation files stay in your browser.
              </p>
              <button
                type="submit"
                disabled={status === 'sending'}
                className="shrink-0 rounded-sm bg-ink px-6 py-2.5 text-sm font-semibold text-paper shadow-sm transition-colors hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'sending' ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
