// What the Drive scan decides, with no Drive, no model and no database.
//
// The inspiration lane was 100% n8n: it listed a folder twice a day, sent what
// it found to Sonnet as native image blocks, and wrote seeds through
// upsert_inspiration_seed. It worked. What it could not do was be tested, and
// three of its four known faults were decisions rather than plumbing:
//
//   The ledger key is the file, so the same LinkedIn post screenshotted twice
//   became two ideas. The story is the thing that repeats, not the JPEG.
//
//   A transient download failure was written to the ledger as processed, which
//   made it permanent. A file that failed once should be tried again; a file
//   that is not readable at all should not.
//
//   Files cut by the request budget were silently dropped from the run and
//   invisible until they happened to fit a later one.
//
// Everything here is a function of its arguments. It imports nothing, which is
// what lets scripts/check-inspiration-lane.ts and the tests run it in CI.

import { createHash } from 'node:crypto'

/** What the vision call can actually read. Anything else is listed and left. */
export const READABLE_MIMES = new Set([
  'application/vnd.google-apps.document',
  'text/plain',
  'text/markdown',
  'application/vnd.google-apps.spreadsheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

export const TEXT_MIMES = new Set([
  'application/vnd.google-apps.document',
  'text/plain',
  'text/markdown',
  'application/vnd.google-apps.spreadsheet',
])
export const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
export const PDF_MIME = 'application/pdf'

/** Bytes and count that one Anthropic request survives. Fifteen phone
 *  screenshots build a ~24MB body; nothing survives that. */
export const DEFAULT_MAX_IMAGE_BYTES = 4_500_000
export const DEFAULT_MAX_IMAGES = 6
export const DEFAULT_LOOKBACK_DAYS = 14

/** How long a file that failed to download waits before the next scan tries it
 *  again. Short enough to recover inside a day, long enough that a genuinely
 *  broken file is not re-fetched every two hours forever. */
export const RETRY_AFTER_MINUTES = 180
/** After this many consecutive failures the file is left alone and said out
 *  loud, rather than retried until the end of time. */
export const MAX_DOWNLOAD_ATTEMPTS = 4

/** A failure worth trying again, as opposed to a file that will never read. */
export const TRANSIENT_SKIPS = new Set(['download_failed', 'rate_limited'])

export interface DriveFile {
  id: string
  name?: string
  mimeType?: string
  modifiedTime?: string
  size?: string
}

export interface Candidate {
  id: string
  name: string
  mime_type: string
  modified: string
  size_bytes: number
  /** The ledger key. modifiedTime is part of it so an EDITED file legitimately
   *  re-enters the sweep while an untouched one never does. */
  file_key: string
}

export function toCandidates(files: DriveFile[]): { candidates: Candidate[]; listed: number; unreadable: number } {
  const listed = files.length
  const candidates = files
    .filter(f => f.id && READABLE_MIMES.has(f.mimeType || ''))
    .map(f => ({
      id: f.id,
      name: f.name || '',
      mime_type: f.mimeType || '',
      modified: f.modifiedTime || '',
      // Native Google types report no size; they export as text and are small.
      size_bytes: parseInt(f.size || '0', 10) || 0,
      file_key: `${f.id}:${f.modifiedTime || ''}`,
    }))
  return { candidates, listed, unreadable: listed - candidates.length }
}

export interface SelectionInput {
  candidates: Candidate[]
  /** file_key of every row already in the ledger that is not due for a retry. */
  settled: Set<string>
  maxImageBytes?: number
  maxImages?: number
}

export interface Selection {
  selected: Candidate[]
  deferred: Candidate[]
  seen_before: number
  fresh: number
  selected_bytes: number
}

/** Subtract the ledger, then fit what is left inside one request.
 *
 *  Newest first, because Drive is listed by modifiedTime desc: the freshest
 *  drop wins the budget and anything cut is picked up by the next scan. A
 *  deferred file is deliberately NOT written to the ledger, and unlike the n8n
 *  version it is returned by name so the run can say what is waiting. */
export function selectWithinBudget(input: SelectionInput): Selection {
  const maxBytes = input.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES
  const maxImages = input.maxImages ?? DEFAULT_MAX_IMAGES
  const fresh = input.candidates.filter(c => !input.settled.has(c.file_key))

  const selected: Candidate[] = []
  const deferred: Candidate[] = []
  let bytes = 0
  let heavy = 0
  for (const c of fresh) {
    const isHeavy = IMAGE_MIMES.has(c.mime_type) || c.mime_type === PDF_MIME
    if (isHeavy) {
      if (heavy >= maxImages || bytes + c.size_bytes > maxBytes) { deferred.push(c); continue }
      heavy++
      bytes += c.size_bytes
    }
    selected.push(c)
  }
  return {
    selected,
    deferred,
    seen_before: input.candidates.length - fresh.length,
    fresh: fresh.length,
    selected_bytes: bytes,
  }
}

/** The artifact store's own CHECK constraints, restated here because the route
 *  cannot see them and a wrong value fails only in production. Verified against
 *  content_inspiration_artifacts_input_kind_check, _status_check and
 *  _scope_check on 2026-09-08. Widening one of these means altering the
 *  constraint first.
 *
 *  This lane predates none of it: the table was created for a general capture
 *  route, so a screenshot is an 'image' and a PDF is a 'file'. */
export const ARTIFACT_INPUT_KINDS = ['url', 'collection', 'image', 'text', 'file'] as const
export const ARTIFACT_STATUSES = ['queued', 'processing', 'complete', 'failed'] as const
export const ARTIFACT_SCOPES = ['everything', 'money_of_ai', 'built_with_ai'] as const

export type ArtifactInputKind = (typeof ARTIFACT_INPUT_KINDS)[number]

/** Which of those a downloaded file is. */
export function artifactInputKind(mime: string): ArtifactInputKind {
  if (IMAGE_MIMES.has(mime)) return 'image'
  if (mime === PDF_MIME) return 'file'
  if (TEXT_MIMES.has(mime)) return 'text'
  return 'file'
}

export function fileHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Where the original lands in the private bucket. Keyed by content, so the
 *  same screenshot dropped twice is one object. */
export function artifactKey(hash: string, mime: string): string {
  const ext = mime === 'application/pdf' ? 'pdf'
    : mime === 'image/png' ? 'png'
    : mime === 'image/webp' ? 'webp'
    : mime === 'image/gif' ? 'gif'
    : mime === 'image/jpeg' ? 'jpg'
    : 'bin'
  return `inspiration/${hash.slice(0, 2)}/${hash}.${ext}`
}

const HTTP_URL = /^https?:\/\/[^\s"'<>]{6,600}$/i

/** The dedupe key that matters.
 *
 *  The n8n lane set source_url to the Drive file URL, so the same LinkedIn post
 *  screenshotted on a phone and again on a laptop was two ideas, and
 *  content_ideas_inspiration_url_live_uq (which already exists on source_url)
 *  never fired. When the model can read the post's own URL out of the image, the
 *  story is what dedupes. When it cannot, the file's content hash is the next
 *  best identity: the same bytes are the same story, a re-screenshot is not.
 *
 *  Never the Drive URL. That identifies the copy, which is the one thing we do
 *  not want to count. */
export function storyUrl(extractedUrl: unknown, hash: string | null): string {
  const url = typeof extractedUrl === 'string' ? extractedUrl.trim() : ''
  if (url && HTTP_URL.test(url) && !url.includes('drive.google.com') && !url.includes('docs.google.com')) return url
  return hash ? `screenshot:${hash}` : ''
}

export interface Seed {
  is_idea?: boolean
  idea?: string
  thesis?: string
  pillar_id?: string
  distribution?: unknown
  brand_fit_score?: number
  confidence?: number
  quality_score?: string
  temporal_class?: string
  expires_in_days?: number
  source_label?: string
  source_url?: string
  source_excerpt?: string
  evidence_present?: unknown
  image_source?: string | null
  poster_name?: string | null
  poster_handle?: string | null
  rejection_reason?: string | null
}

/** Framings that read as content and say nothing. Carried verbatim from the
 *  n8n lane: these were learned from rejected output, not invented here. */
export const BLACKLISTED_FRAMINGS = [
  /^how i /i,
  /^the (top|best) \d/i,
  /^\d+ ways /i,
  /^lessons (from|i learned)/i,
  /the future of /i,
  /^why .* matters$/i,
]

export function parseSeedArray(raw: string): Seed[] {
  const text = String(raw || '')
  try {
    const m = text.match(/\[[\s\S]*\]/)
    if (m) {
      const arr = JSON.parse(m[0])
      if (Array.isArray(arr)) return arr
    }
  } catch { /* fall through to the truncation repair below */ }
  // A response cut off mid-array still carries whole objects. Close it rather
  // than discard a run's worth of reading.
  const start = text.indexOf('[')
  const lastObj = text.lastIndexOf('}')
  if (start !== -1 && lastObj > start) {
    try {
      const arr = JSON.parse(`${text.slice(start, lastObj + 1)}]`)
      if (Array.isArray(arr)) return arr
    } catch { /* genuinely unparseable */ }
  }
  return []
}

export interface Survivors {
  survivors: Seed[]
  rejected: number
  reasons: Record<string, number>
  raw_count: number
}

/** The floors, in the order the n8n lane applied them. Every rejection is
 *  counted by reason: a run that reads twelve screenshots and keeps none must
 *  say why, or the lane looks broken when it is being strict. */
export function filterSeeds(seeds: Seed[], minBrandFit: number): Survivors {
  const reasons: Record<string, number> = {}
  const bump = (k: string) => { reasons[k] = (reasons[k] || 0) + 1 }
  const survivors: Seed[] = []
  for (const r of seeds) {
    if (!r || r.is_idea === false) { bump(r?.rejection_reason === 'duplicate_angle' ? 'duplicate_angle' : 'not_idea'); continue }
    if (!r.idea || String(r.idea).trim().length < 12) { bump('title_too_short'); continue }
    if (BLACKLISTED_FRAMINGS.some(rx => rx.test(String(r.idea)))) { bump('blacklisted_framing'); continue }
    if (!r.pillar_id) { bump('no_pillar'); continue }
    if (typeof r.brand_fit_score !== 'number' || r.brand_fit_score < minBrandFit) { bump('below_min_fit'); continue }
    if (!Array.isArray(r.evidence_present) || r.evidence_present.length === 0) { bump('no_evidence_listed'); continue }
    survivors.push(r)
  }
  return { survivors, rejected: seeds.length - survivors.length, reasons, raw_count: seeds.length }
}

/** Normalise a handle so 'in/krishraja', '@KrishRaja' and 'krishraja' are one
 *  person. Used to join a screenshot to the curated creator registry. */
export function normaliseHandle(handle: unknown): string {
  const h = typeof handle === 'string' ? handle.trim().toLowerCase() : ''
  if (!h) return ''
  return h
    .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')
    .replace(/^@/, '')
    .replace(/^in\//, '')
    .replace(/\/+$/, '')
    .slice(0, 120)
}
