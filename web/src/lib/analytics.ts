import { inject } from '@vercel/analytics'

/** Anonymous funnel events. Names only — no properties, so no user or file
 * data can ever ride along. Page views go to Vercel Web Analytics; funnel
 * events go to Umami (both cookie-free). */
export type FunnelEvent =
  | 'sample_run_started'
  | 'own_file_run_started'
  | 'run_completed'
  | 'pricing_viewed'
  | 'contact_submitted'
  | 'lead_submitted'

const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as
  | string
  | undefined
const UMAMI_SRC = 'https://cloud.umami.is/script.js'

declare global {
  interface Window {
    umami?: { track: (event: string) => void }
  }
}

let injected = false

/** Events fired before the Umami script finishes loading, flushed on its
 * `load` event and discarded if the script fails. */
let pending: FunnelEvent[] | null = []
const PENDING_LIMIT = 20

/** Load the cookie-free beacons once per page. No-op outside production
 * builds so local dev sends nothing. */
export function initAnalytics(): void {
  if (injected || !import.meta.env.PROD) return
  injected = true
  try {
    inject()
  } catch {
    // Analytics must never break the app.
  }
  if (!UMAMI_WEBSITE_ID) return
  try {
    const script = document.createElement('script')
    script.src = UMAMI_SRC
    script.defer = true
    script.dataset.websiteId = UMAMI_WEBSITE_ID
    // Events only — page views are already counted by Vercel.
    script.dataset.autoPageview = 'false'
    script.dataset.excludeHash = 'true'
    script.addEventListener('load', () => {
      const queued = pending
      pending = null
      queued?.forEach((event) => window.umami?.track(event))
    })
    script.addEventListener('error', () => {
      pending = null
    })
    document.head.appendChild(script)
  } catch {
    // Analytics must never break the app.
  }
}

export function track(event: FunnelEvent): void {
  if (!import.meta.env.PROD) return
  try {
    if (window.umami) {
      window.umami.track(event)
    } else if (pending && pending.length < PENDING_LIMIT) {
      pending.push(event)
    }
  } catch {
    // Analytics must never break the app.
  }
}
