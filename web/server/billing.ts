/** Stripe subscription billing. Sign-up stays free and starts a no-card
 * 14-day trial measured from the Supabase account creation date; once it
 * ends, the reconcile screen and the AI endpoints require an active Stripe
 * subscription. The Stripe secret key stays server-side; the browser only
 * ever receives redirect URLs and a boolean status. When Stripe or Supabase
 * is not configured, billing is disabled and everything stays open (matching
 * the ungated auth build). */
import { checkAuth, reject } from './ai.js'
import type { ApiResponse, AuthCheck } from './ai.js'

const STRIPE_API = 'https://api.stripe.com/v1'

/** Subscription states that grant access. */
const ACTIVE_STATUSES = ['active', 'trialing']

const DEFAULT_ORIGIN = 'https://tieoutap.com'

/** Days of full access every new account gets before a card is needed. */
const TRIAL_DAYS = 14

export interface SubscriptionSuccess {
  ok: true
  /** True when billing is disabled or the user has an active subscription. */
  active: boolean
  /** Stripe subscription status, 'none', or 'disabled'. */
  status: string
  /** ISO date the trial ends, when trialing. */
  trial_end: string | null
}

export interface RedirectSuccess {
  ok: true
  url: string
}

interface StripeSubscription {
  id: string
  status: string
  trial_end: number | null
}

interface StripeList<T> {
  data: T[]
}

function stripeKey(): string | null {
  return process.env.STRIPE_SECRET_KEY ?? null
}

async function stripeRequest<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const key = stripeKey()
  if (!key) throw new Error('not configured on this deployment (no STRIPE_SECRET_KEY)')
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${key}`,
      ...(params ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  })
  const body = (await response.json()) as T & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(`stripe API error ${response.status}: ${body.error?.message ?? 'unknown'}`)
  }
  return body
}

/** End of the account's no-card trial, or null when it has already passed
 * (or the account creation date is unavailable). */
function accountTrialEnd(createdAt: string | null): Date | null {
  if (!createdAt) return null
  const created = Date.parse(createdAt)
  if (Number.isNaN(created)) return null
  const end = new Date(created + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  return end.getTime() > Date.now() ? end : null
}

/** Emails that bypass billing (owner and test accounts), comma-separated. */
function isFreeEmail(email: string): boolean {
  return (process.env.TIEOUT_FREE_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e !== '')
    .includes(email.toLowerCase())
}

async function findCustomerIds(email: string): Promise<string[]> {
  const list = await stripeRequest<StripeList<{ id: string }>>(
    `/customers?email=${encodeURIComponent(email)}&limit=100`,
  )
  return list.data.map((c) => c.id)
}

/** The user's most relevant subscription: an active/trialing one if any
 * exists, otherwise the first one found (for status display). */
async function findSubscription(email: string): Promise<StripeSubscription | null> {
  let fallback: StripeSubscription | null = null
  for (const customer of await findCustomerIds(email)) {
    const subs = await stripeRequest<StripeList<StripeSubscription>>(
      `/subscriptions?customer=${customer}&status=all&limit=100`,
    )
    for (const sub of subs.data) {
      if (ACTIVE_STATUSES.includes(sub.status)) return sub
      fallback = fallback ?? sub
    }
  }
  return fallback
}

/** Non-null when billing is enforced and this signed-in user has no active
 * subscription. AI endpoints call this after their auth check. */
export async function billingError(authHeader: string | undefined): Promise<string | null> {
  if (!stripeKey()) return null
  const auth = await checkAuth(authHeader, 'use TieOut AP')
  if (auth.kind === 'disabled') return null
  if (auth.kind === 'denied') return auth.detail
  if (isFreeEmail(auth.email)) return null
  if (accountTrialEnd(auth.createdAt)) return null
  const sub = await findSubscription(auth.email)
  if (sub && ACTIVE_STATUSES.includes(sub.status)) return null
  return 'your free trial has ended — subscribe to continue'
}

function requireUser(auth: AuthCheck): { id: string; email: string } | string {
  if (auth.kind === 'denied') return auth.detail
  if (auth.kind === 'disabled') return 'billing is not enabled on this deployment'
  return auth
}

/** Validates the browser-supplied return origin so checkout can only redirect
 * back to the app itself. */
function returnOrigin(payload: unknown): string {
  const origin = (payload as Record<string, unknown> | null)?.origin
  if (typeof origin !== 'string') return DEFAULT_ORIGIN
  if (
    origin === DEFAULT_ORIGIN ||
    origin === 'https://www.tieoutap.com' ||
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  ) {
    return origin
  }
  return DEFAULT_ORIGIN
}

export async function handleSubscription(
  payload: unknown,
  authHeader?: string,
): Promise<ApiResponse<SubscriptionSuccess>> {
  void payload
  const auth = await checkAuth(authHeader, 'check your subscription')
  if (auth.kind === 'denied') return reject(401, 'unauthorized', auth.detail)
  if (auth.kind === 'disabled' || !stripeKey()) {
    return { status: 200, body: { ok: true, active: true, status: 'disabled', trial_end: null } }
  }
  if (isFreeEmail(auth.email)) {
    return { status: 200, body: { ok: true, active: true, status: 'complimentary', trial_end: null } }
  }
  try {
    const sub = await findSubscription(auth.email)
    if (sub && ACTIVE_STATUSES.includes(sub.status)) {
      return {
        status: 200,
        body: {
          ok: true,
          active: true,
          status: sub.status,
          trial_end:
            sub.status === 'trialing' && sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString().slice(0, 10)
              : null,
        },
      }
    }
    const trialEnd = accountTrialEnd(auth.createdAt)
    if (trialEnd) {
      return {
        status: 200,
        body: {
          ok: true,
          active: true,
          status: 'free_trial',
          trial_end: trialEnd.toISOString().slice(0, 10),
        },
      }
    }
    return {
      status: 200,
      body: {
        ok: true,
        active: false,
        status: sub?.status ?? 'trial_ended',
        trial_end: null,
      },
    }
  } catch (e) {
    return reject(502, 'server_error', e instanceof Error ? e.message : String(e))
  }
}

export async function handleCheckout(
  payload: unknown,
  authHeader?: string,
): Promise<ApiResponse<RedirectSuccess>> {
  const auth = await checkAuth(authHeader, 'subscribe')
  if (auth.kind === 'denied') return reject(401, 'unauthorized', auth.detail)
  const user = requireUser(auth)
  if (typeof user === 'string') return reject(400, 'bad_request', user)
  const priceId = process.env.STRIPE_PRICE_ID
  if (!stripeKey() || !priceId) {
    return reject(503, 'server_error', 'billing is not configured on this deployment')
  }
  const origin = returnOrigin(payload)
  try {
    const existing = await findSubscription(user.email)
    if (existing && ACTIVE_STATUSES.includes(existing.status)) {
      return reject(409, 'bad_request', 'you already have an active subscription')
    }
    // Subscribing before the no-card trial ends keeps the remaining free days.
    const trialEnd = auth.kind === 'user' ? accountTrialEnd(auth.createdAt) : null
    const remainingDays = trialEnd
      ? Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : 0
    const session = await stripeRequest<{ url: string }>('/checkout/sessions', {
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: user.id,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      ...(remainingDays >= 1
        ? { 'subscription_data[trial_period_days]': String(remainingDays) }
        : {}),
      allow_promotion_codes: 'true',
      success_url: `${origin}/#app?checkout=success`,
      cancel_url: `${origin}/#app?checkout=cancelled`,
    })
    return { status: 200, body: { ok: true, url: session.url } }
  } catch (e) {
    return reject(502, 'server_error', e instanceof Error ? e.message : String(e))
  }
}

/** Ensures a billing-portal configuration exists (test projects have none
 * until one is created) and returns one to use. */
async function portalConfiguration(): Promise<string> {
  const configs = await stripeRequest<StripeList<{ id: string }>>(
    '/billing_portal/configurations?active=true&limit=1',
  )
  if (configs.data.length > 0) return configs.data[0].id
  const created = await stripeRequest<{ id: string }>('/billing_portal/configurations', {
    'business_profile[headline]': 'TieOut AP — manage your subscription',
    'features[invoice_history][enabled]': 'true',
    'features[payment_method_update][enabled]': 'true',
    'features[customer_update][enabled]': 'true',
    'features[customer_update][allowed_updates][0]': 'email',
    'features[subscription_cancel][enabled]': 'true',
  })
  return created.id
}

export async function handlePortal(
  payload: unknown,
  authHeader?: string,
): Promise<ApiResponse<RedirectSuccess>> {
  const auth = await checkAuth(authHeader, 'manage billing')
  if (auth.kind === 'denied') return reject(401, 'unauthorized', auth.detail)
  const user = requireUser(auth)
  if (typeof user === 'string') return reject(400, 'bad_request', user)
  if (!stripeKey()) return reject(503, 'server_error', 'billing is not configured on this deployment')
  const origin = returnOrigin(payload)
  try {
    const customers = await findCustomerIds(user.email)
    if (customers.length === 0) return reject(404, 'bad_request', 'no billing account found — subscribe first')
    const session = await stripeRequest<{ url: string }>('/billing_portal/sessions', {
      customer: customers[0],
      configuration: await portalConfiguration(),
      return_url: `${origin}/#app`,
    })
    return { status: 200, body: { ok: true, url: session.url } }
  } catch (e) {
    return reject(502, 'server_error', e instanceof Error ? e.message : String(e))
  }
}
