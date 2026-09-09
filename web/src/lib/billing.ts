/** Browser side of subscription billing. The server only ever returns a
 * boolean status and Stripe-hosted redirect URLs — no card data or Stripe
 * keys touch this code. */
import { postJson } from './ai'
import type { AiError } from './ai'

export interface SubscriptionInfo {
  ok: true
  active: boolean
  status: string
  trial_end: string | null
}

export type SubscriptionResult = SubscriptionInfo | AiError

export type RedirectResult = { ok: true; url: string } | AiError

export async function requestSubscription(): Promise<SubscriptionResult> {
  const body = await postJson('/api/subscription', {})
  if (typeof body === 'object' && body !== null && (body as SubscriptionResult).ok !== undefined) {
    return body as SubscriptionResult
  }
  return { ok: false, detail: 'unexpected server response' }
}

async function requestRedirect(path: string): Promise<RedirectResult> {
  const body = await postJson(path, { origin: location.origin })
  if (typeof body === 'object' && body !== null && (body as RedirectResult).ok !== undefined) {
    const result = body as RedirectResult
    if (result.ok && typeof result.url !== 'string') {
      return { ok: false, detail: 'unexpected server response' }
    }
    return result
  }
  return { ok: false, detail: 'unexpected server response' }
}

/** Starts Stripe Checkout; on success the browser should navigate to the URL. */
export function requestCheckout(): Promise<RedirectResult> {
  return requestRedirect('/api/checkout')
}

/** Opens the Stripe billing portal for cancelling or updating payment. */
export function requestPortal(): Promise<RedirectResult> {
  return requestRedirect('/api/portal')
}
