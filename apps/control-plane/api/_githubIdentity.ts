import { createPublicKey, verify as verifySignature, type JsonWebKey } from 'node:crypto'

// A GitHub Actions identity token (OIDC), checked here with no stored secret (I-31; Ruling, Krish, 2026-11-14).
//
// The one caller this admits is claude-archive's own workflow on its main branch, while that repository is private: the
// workflow asks GitHub for a short-lived token with this audience, and this file checks GitHub's signature against
// GitHub's published keys and every claim below. Anything else (another repository, another branch, a public
// repository, a pull request, an expired or unsigned token, keys that cannot be read) is refused. It fails closed:
// there is no fallback key, cookie or bearer.

export const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com'
export const GITHUB_OIDC_JWKS = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`
export const RESEARCH_EXPORT_AUDIENCE = 'content-engine-research-export'

export interface IdentityRule { repository: string; ref: string; audience: string; visibility: 'private' }
export const VAULT_RULE: IdentityRule = { repository: 'krishanraja/claude-archive', ref: 'refs/heads/main', audience: RESEARCH_EXPORT_AUDIENCE, visibility: 'private' }

export type Jwks = { keys: Array<JsonWebKey & { kid?: string }> }
export type JwksFetcher = () => Promise<Jwks>
export type IdentityResult = { ok: true; claims: Record<string, unknown> } | { ok: false; status: 401 | 503; why: string }

const b64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
const json = (s: string): Record<string, unknown> | null => {
  try { const v = JSON.parse(b64url(s).toString('utf8')); return v && typeof v === 'object' && !Array.isArray(v) ? v : null } catch { return null }
}

let cached: { at: number; jwks: Jwks } | null = null
const JWKS_TTL_MS = 60 * 60 * 1000

/** GitHub's published signing keys, kept an hour. */
export const fetchGithubJwks: JwksFetcher = async () => {
  if (cached && Date.now() - cached.at < JWKS_TTL_MS) return cached.jwks
  const r = await fetch(GITHUB_OIDC_JWKS, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`jwks_${r.status}`)
  const jwks = await r.json() as Jwks
  if (!jwks || !Array.isArray(jwks.keys)) throw new Error('jwks_shape')
  cached = { at: Date.now(), jwks }
  return jwks
}

/** Checks a bearer token against the rule: GitHub's RS256 signature, issuer, audience, repository, branch, visibility
 *  and time. Never throws. */
export async function verifyGithubIdentity(authorization: string | undefined, rule: IdentityRule, jwks: JwksFetcher = fetchGithubJwks, now = Date.now()): Promise<IdentityResult> {
  const m = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(authorization || ''))
  if (!m) return { ok: false, status: 401, why: 'no_identity_token' }
  const [, h, p, sig] = m
  const header = json(h), claims = json(p)
  if (!header || !claims) return { ok: false, status: 401, why: 'malformed_token' }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return { ok: false, status: 401, why: 'unexpected_algorithm' }
  let keys: Jwks
  try { keys = await jwks() } catch { return { ok: false, status: 503, why: 'identity_keys_unreadable' } }
  const jwk = keys.keys.find(k => k.kid === header.kid && (k.kty === 'RSA'))
  if (!jwk) return { ok: false, status: 401, why: 'unknown_signing_key' }
  let signed = false
  try {
    const key = createPublicKey({ key: jwk, format: 'jwk' })
    signed = verifySignature('RSA-SHA256', Buffer.from(`${h}.${p}`), key, b64url(sig))
  } catch { signed = false }
  if (!signed) return { ok: false, status: 401, why: 'bad_signature' }
  const sec = Math.floor(now / 1000)
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (claims.iss !== GITHUB_OIDC_ISSUER) return { ok: false, status: 401, why: 'wrong_issuer' }
  if (!aud.includes(rule.audience)) return { ok: false, status: 401, why: 'wrong_audience' }
  if (typeof claims.exp !== 'number' || claims.exp <= sec) return { ok: false, status: 401, why: 'expired' }
  if (typeof claims.nbf === 'number' && claims.nbf > sec + 60) return { ok: false, status: 401, why: 'not_yet_valid' }
  if (claims.repository !== rule.repository) return { ok: false, status: 401, why: 'wrong_repository' }
  if (claims.ref !== rule.ref) return { ok: false, status: 401, why: 'wrong_branch' }
  if (claims.repository_visibility !== rule.visibility) return { ok: false, status: 401, why: 'repository_not_private' }
  if (claims.event_name === 'pull_request' || claims.event_name === 'pull_request_target') return { ok: false, status: 401, why: 'pull_request' }
  return { ok: true, claims }
}
