/** Shared plumbing for the AI endpoints: Supabase session validation and a
 * forced-tool-call Anthropic text request. API keys stay server-side. */

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const MODEL = 'claude-sonnet-4-5'

export type ErrorReason = 'bad_request' | 'unauthorized' | 'payment_required' | 'server_error'

export interface ApiResponse<T> {
  status: number
  body: T | { ok: false; reason: ErrorReason; detail: string }
}

export function reject<T>(status: number, reason: ErrorReason, detail: string): ApiResponse<T> {
  return { status, body: { ok: false, reason, detail } }
}

export type AuthCheck =
  | { kind: 'disabled' }
  | { kind: 'denied'; detail: string }
  | { kind: 'user'; id: string; email: string; createdAt: string | null }

/** When the deployment has Supabase configured, protected endpoints require a
 * valid signed-in session; the resolved user identifies the Stripe customer. */
export async function checkAuth(
  authHeader: string | undefined,
  what: string,
): Promise<AuthCheck> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { kind: 'disabled' }
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return { kind: 'denied', detail: `sign in to ${what}` }
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization: `Bearer ${token}` },
  })
  if (!response.ok) return { kind: 'denied', detail: 'your session has expired — sign in again' }
  const user = (await response.json()) as { id?: string; email?: string; created_at?: string }
  if (typeof user.id !== 'string' || typeof user.email !== 'string') {
    return { kind: 'denied', detail: 'your session has expired — sign in again' }
  }
  return {
    kind: 'user',
    id: user.id,
    email: user.email,
    createdAt: typeof user.created_at === 'string' ? user.created_at : null,
  }
}

/** AI endpoints require a valid signed-in session so anonymous callers cannot
 * spend the model quota. */
export async function authError(
  authHeader: string | undefined,
  what: string,
): Promise<string | null> {
  const auth = await checkAuth(authHeader, what)
  return auth.kind === 'denied' ? auth.detail : null
}

interface ContentBlock {
  type: string
  name?: string
  input?: unknown
}

/** Sends a text prompt with a single forced tool call and returns the tool
 * input, so responses always match the given JSON schema shape. */
export async function anthropicToolCall(options: {
  system: string
  user: string
  toolName: string
  toolDescription: string
  schema: object
  maxTokens?: number
}): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('not configured on this deployment (no ANTHROPIC_API_KEY)')
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': API_VERSION,
  }
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID
  if (workspaceId) headers['anthropic-workspace-id'] = workspaceId
  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: options.maxTokens ?? 4096,
      temperature: 0,
      system: options.system,
      tools: [
        {
          name: options.toolName,
          description: options.toolDescription,
          input_schema: options.schema,
        },
      ],
      tool_choice: { type: 'tool', name: options.toolName },
      messages: [{ role: 'user', content: options.user }],
    }),
  })
  if (!response.ok) {
    throw new Error(`anthropic API error ${response.status}: ${await response.text()}`)
  }
  const data = (await response.json()) as { content?: ContentBlock[] }
  const toolUse = (data.content ?? []).find(
    (b) => b.type === 'tool_use' && b.name === options.toolName,
  )
  if (!toolUse) throw new Error('anthropic response contained no tool call')
  return toolUse.input
}
