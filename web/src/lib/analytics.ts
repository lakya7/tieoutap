import { inject, track as vercelTrack } from '@vercel/analytics'

/** Anonymous funnel events. Names only — no properties, so no user or file
 * data can ever ride along. Delivered to Vercel Web Analytics (cookie-free). */
export type FunnelEvent =
  | 'sample_run_started'
  | 'own_file_run_started'
  | 'run_completed'
  | 'pricing_viewed'
  | 'contact_submitted'
  | 'lead_submitted'

let injected = false

/** Load the cookie-free page-view beacon once per page. No-op outside
 * production builds so local dev sends nothing. */
export function initAnalytics(): void {
  if (injected || !import.meta.env.PROD) return
  injected = true
  try {
    inject()
  } catch {
    // Analytics must never break the app.
  }
}

export function track(event: FunnelEvent): void {
  if (!import.meta.env.PROD) return
  try {
    vercelTrack(event)
  } catch {
    // Analytics must never break the app.
  }
}
