import crypto from 'node:crypto'

// Direct Google integration (no n8n) for Gmail drafts and Drive docs. Uses a
// service-account JWT → OAuth access token; no extra npm deps. Everything is
// GATED on env: with the service account unset, every function returns null and
// callers fall back to their existing behaviour. Gmail requires domain-wide
// delegation + GOOGLE_IMPERSONATE_SUBJECT (the Workspace user to act as).
//
// Required env to activate:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL      (the …@….iam.gserviceaccount.com address)
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (the PEM; literal \n are unescaped)
//   GOOGLE_IMPERSONATE_SUBJECT        (e.g. krish@themindmaker.ai — Gmail only)

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Tiny per-scope token cache (warm across calls in a single function instance).
const tokenCache = new Map<string, { token: string; exp: number }>()

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
}

export interface TokenOptions {
  /** Act as GOOGLE_IMPERSONATE_SUBJECT rather than as the service account
   *  itself. Gmail needs this: a service account has no mailbox, so it must
   *  borrow a Workspace user's, which requires domain-wide delegation.
   *
   *  Drive does not, and must not. A folder shared directly with the service
   *  account address is readable AS that account; asking for an impersonated
   *  token when delegation is not configured for the Drive scope fails the
   *  whole request with unauthorized_client, which reads as "no service
   *  account" and sends you looking in the wrong place. */
  impersonate?: boolean
  /** Surface why a token could not be issued. Callers that report to a human
   *  pass this; the ones that fall back silently do not. */
  onError?: (reason: string) => void
}

export async function googleAccessToken(scopes: string[], options: TokenOptions = {}): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  const subject = options.impersonate === false ? undefined : process.env.GOOGLE_IMPERSONATE_SUBJECT
  const fail = (reason: string) => { options.onError?.(reason); return null }
  if (!email || !key) return fail('service account email or private key is unset')
  key = key.replace(/\\n/g, '\n') // env stores PEM newlines escaped

  const scopeKey = scopes.join(' ') + (subject ? `|${subject}` : '')
  const now = Math.floor(Date.now() / 1000)
  const cached = tokenCache.get(scopeKey)
  if (cached && cached.exp > now + 60) return cached.token

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim: Record<string, any> = {
    iss: email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  if (subject) claim.sub = subject
  const payload = b64url(JSON.stringify(claim))

  let assertion: string
  try {
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(`${header}.${payload}`)
    assertion = `${header}.${payload}.${b64url(signer.sign(key))}`
  } catch (e) {
    return fail(`private key would not sign: ${(e as Error)?.message?.slice(0, 120)}`)
  }

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || !j?.access_token) {
      // The two that actually happen: unauthorized_client means domain-wide
      // delegation is not configured for these scopes (so stop impersonating),
      // invalid_grant usually means the clock or the key is wrong.
      return fail(`google_oauth_${r.status}:${j?.error || 'no_access_token'}${j?.error_description ? ` (${String(j.error_description).slice(0, 120)})` : ''}`)
    }
    tokenCache.set(scopeKey, { token: j.access_token, exp: now + (j.expires_in || 3600) })
    return j.access_token
  } catch (e) {
    return fail(`token request failed: ${(e as Error)?.message?.slice(0, 120)}`)
  }
}

/** Create a Gmail draft as the impersonated user. Returns { id, url } or null. */
export async function createGmailDraft(input: { to: string; subject: string; body: string }): Promise<{ id: string; url: string } | null> {
  const token = await googleAccessToken(['https://www.googleapis.com/auth/gmail.compose'])
  if (!token) return null
  // A draft may have no recipient yet (no address on record); Gmail accepts a
  // draft without a To header and shows the field empty for the sender to fill.
  const headers = [
    input.to ? `To: ${input.to}` : '',
    `Subject: ${input.subject || ''}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
  ].filter(Boolean).join('\r\n')
  const raw = b64url(`${headers}\r\n\r\n${input.body || ''}`)
  try {
    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { raw } }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || !j?.id) return null
    return { id: j.id, url: 'https://mail.google.com/mail/u/0/#drafts' }
  } catch {
    return null
  }
}

/**
 * Send a plain-text email as the impersonated user. Returns { id } or null.
 *
 * Separate from createGmailDraft because the two need different scopes and
 * differ in what they promise: a draft waits for a human, a send has already
 * left. Alerts have to leave — a draft nobody opens is the same as no alert.
 * gmail.send must be in the domain-wide delegation for this to work; when it
 * is not, the caller falls back to a draft rather than failing silently.
 */
export async function sendGmail(input: { to: string; subject: string; body: string }): Promise<{ id: string } | null> {
  const token = await googleAccessToken(['https://www.googleapis.com/auth/gmail.send'])
  if (!token) return null
  const headers = [
    `To: ${input.to}`,
    `Subject: ${input.subject || ''}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
  ].join('\r\n')
  const raw = b64url(`${headers}\r\n\r\n${input.body || ''}`)
  try {
    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || !j?.id) return null
    return { id: j.id }
  } catch {
    return null
  }
}

/** Create a Google Doc (in Drive) from plain text. Returns { id, url } or null. */
export async function createDriveDoc(input: { name: string; content: string }): Promise<{ id: string; url: string } | null> {
  const token = await googleAccessToken(['https://www.googleapis.com/auth/drive.file'])
  if (!token) return null
  const boundary = `cc${Date.now()}${Math.random().toString(16).slice(2)}`
  // Service accounts have no personal Drive quota: docs must land either in the
  // impersonated user's Drive (domain-wide delegation) or in a Shared Drive
  // (GOOGLE_DRIVE_FOLDER_ID). Set a folder parent when provided.
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  const metadata: Record<string, any> = { name: input.name, mimeType: 'application/vnd.google-apps.document' }
  if (folderId) metadata.parents = [folderId]
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${input.content}\r\n--${boundary}--`
  try {
    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || !j?.id) return null
    return { id: j.id, url: j.webViewLink || `https://docs.google.com/document/d/${j.id}/edit` }
  } catch {
    return null
  }
}

// ── Drive reads for the inspiration lane ────────────────────────────────────
//
// The n8n sweep used an OAuth Drive credential to list Krish's inspiration
// folder. The service account can do the same, but only once the folder has
// been SHARED with GOOGLE_SERVICE_ACCOUNT_EMAIL: drive.readonly grants the
// right to read what this identity can already see, not the right to see
// everything. An unshared folder lists zero files and does not error, so the
// scan reports the distinction rather than showing a quiet zero.

export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

export interface DriveListResult {
  ok: boolean
  files: Array<{ id: string; name?: string; mimeType?: string; modifiedTime?: string; size?: string }>
  reason?: string
}

/** Newest first, so the freshest drop wins the request budget. */
export async function driveListFolder(folderId: string, lookbackDays: number): Promise<DriveListResult> {
  // impersonate: false. The inspiration folder is shared directly with the
  // service account address, so it is readable as that account. Borrowing a
  // Workspace user's identity would need domain-wide delegation for the Drive
  // scope, which is not configured, and the failure looks like a missing
  // service account rather than a delegation problem.
  let why = 'google_service_account_not_configured'
  const token = await googleAccessToken([DRIVE_READONLY_SCOPE], { impersonate: false, onError: r => { why = r } })
  if (!token) return { ok: false, files: [], reason: why }
  const since = new Date(Date.now() - Math.max(1, lookbackDays) * 86_400_000).toISOString()
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false and modifiedTime > '${since}'`,
    fields: 'files(id,name,mimeType,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '100',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })
  try {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, files: [], reason: `drive_${r.status}:${String(j?.error?.message || '').slice(0, 160)}` }
    return { ok: true, files: Array.isArray(j?.files) ? j.files : [] }
  } catch (e) {
    return { ok: false, files: [], reason: (e as Error)?.message?.slice(0, 160) || 'drive_list_threw' }
  }
}

/** Bytes for a binary file, or the exported text of a native Google doc.
 *  Returns null on any failure so the caller can mark the file for retry
 *  rather than treat a transient 5xx as "this file is unreadable". */
export async function driveDownloadFile(fileId: string, mimeType: string): Promise<Uint8Array | null> {
  const token = await googleAccessToken([DRIVE_READONLY_SCOPE], { impersonate: false })
  if (!token) return null
  const native = mimeType.startsWith('application/vnd.google-apps.')
  const url = native
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain&supportsAllDrives=true`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    return new Uint8Array(await r.arrayBuffer())
  } catch {
    return null
  }
}
