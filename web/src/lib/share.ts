/** Shareable run URLs: the whole run input is encoded into the URL hash, so a
 * link reproduces the run exactly (the engine is deterministic) with no
 * server or database. */
import type { RunInput } from './run'

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function encodeRun(input: RunInput): string {
  const json = JSON.stringify([
    input.supplier,
    input.asAt,
    input.statementCsv,
    input.ledgerCsv,
  ])
  return toBase64Url(new TextEncoder().encode(json))
}

export function decodeRun(hash: string): RunInput | null {
  try {
    const json = new TextDecoder().decode(fromBase64Url(hash))
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed) || parsed.length !== 4) return null
    const [supplier, asAt, statementCsv, ledgerCsv] = parsed as string[]
    if (
      typeof supplier !== 'string' ||
      typeof asAt !== 'string' ||
      typeof statementCsv !== 'string' ||
      typeof ledgerCsv !== 'string'
    ) {
      return null
    }
    return { supplier, asAt, statementCsv, ledgerCsv }
  } catch {
    return null
  }
}

export function shareUrl(input: RunInput): string {
  return `${location.origin}${location.pathname}#run=${encodeRun(input)}`
}

export function runFromLocation(): RunInput | null {
  const m = location.hash.match(/^#run=(.+)$/)
  return m ? decodeRun(m[1]!) : null
}
