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
    <section id="contact" className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h2 className="font-display text-center text-3xl font-bold tracking-tight text-slate-900">
          Get in touch
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center leading-relaxed text-slate-600">
          Questions, a statement format we should support, or a walkthrough for your team —
          send a message and we&rsquo;ll reply by email.
        </p>
        {status === 'sent' ? (
          <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <p className="font-display text-lg font-bold text-emerald-800">Message sent</p>
            <p className="mt-2 text-sm text-emerald-700">
              Thanks for reaching out — we&rsquo;ll get back to you shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700">
                  Name
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  placeholder="jane@company.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                placeholder="How can we help?"
              />
            </div>
            {status === 'error' && (
              <p className="text-sm font-medium text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                Only what you type here is sent — your reconciliation files stay in your browser.
              </p>
              <button
                type="submit"
                disabled={status === 'sending'}
                className="shrink-0 rounded-md bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
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
