import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardVideoStudioRunner, videoStudioRunnerIdentity } from '../_videoStudioAuth.js'
import { supabase } from '../_supabase.js'
import { SHA256_RE, VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from '../video-studio/_contracts.js'
import { enforceVideoStudioRateLimit } from '../video-studio/_data.js'
import { isSignedPreviewUrlAllowed } from '../video-studio/_previewStorage.js'
import {
  checkLibraryPath,
  configuredLibraryStore,
  isLibraryObjectKey,
  libraryPurpose,
  parseLibraryPendingQuery,
} from './_library.js'

// GET /api/library/pending?machine=<id>&limit=<1..100>, on the runner bearer.
//
// What Krish's machine has still to write into the library folder: for each
// path, the newest ready version, when this machine has not written it yet.
// `previous_sha256` is what this machine last wrote at that path (null for a
// new path), so the sync can tell its own earlier copy, which it may replace,
// from a file Krish changed, which it never overwrites. Each file comes with a
// signed download URL that lasts half an hour; the sync asks again for the
// rest.

const SIGNED_DOWNLOAD_TTL_SECONDS = 30 * 60

interface PendingRow {
  path: string
  sha256: string
  bytes: number
  content_type: string
  object_key: string
  purpose: string
  sent_by: string
  sent_at: string
  ready_at: string
  previous_sha256: string | null
}

function pendingRow(value: unknown): PendingRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const path = checkLibraryPath(row.path)
  const purpose = libraryPurpose(row.purpose)
  if (
    !path.ok
    || typeof row.sha256 !== 'string' || !SHA256_RE.test(row.sha256)
    || !Number.isSafeInteger(Number(row.bytes)) || Number(row.bytes) < 1
    || row.content_type !== path.contentType
    || !isLibraryObjectKey(row.object_key)
    || !purpose
    || typeof row.sent_by !== 'string'
    || typeof row.sent_at !== 'string'
    || typeof row.ready_at !== 'string'
    || !(row.previous_sha256 === null || (typeof row.previous_sha256 === 'string' && SHA256_RE.test(row.previous_sha256)))
  ) return null
  return {
    path: path.path,
    sha256: row.sha256,
    bytes: Number(row.bytes),
    content_type: path.contentType,
    object_key: row.object_key,
    purpose,
    sent_by: row.sent_by,
    sent_at: row.sent_at,
    ready_at: row.ready_at,
    previous_sha256: row.previous_sha256 as string | null,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardVideoStudioRunner(req, res, ['GET'])) return
  const query = parseLibraryPendingQuery(req.query)
  if (!query) return sendVideoStudioError(res, 400, 'invalid_library_pending_request')
  const machineHash = videoStudioRunnerIdentity(query.machine)
  if (await enforceVideoStudioRateLimit(res, 'library:pending', machineHash, 120, 60)) return

  const store = await configuredLibraryStore()
  if (!store.config) return sendVideoStudioError(res, 503, store.error || 'library_store_unavailable')

  const { data, error } = await supabase.rpc('content_library_pending', {
    p_machine_hash: machineHash,
    p_limit: query.limit + 1,
  })
  if (error || !Array.isArray(data)) return sendVideoStudioError(res, 503, 'library_index_unavailable')
  const more = data.length > query.limit
  const rows: PendingRow[] = []
  let skipped = 0
  for (const raw of data.slice(0, query.limit)) {
    // A row that breaks the path rule never reaches Drive. It is counted, so
    // the sync says so, and never retried as though it could pass.
    const row = pendingRow(raw)
    if (row) rows.push(row)
    else skipped += 1
  }

  const urls = new Map<string, string>()
  const keys = [...new Set(rows.map((row) => row.object_key))]
  if (keys.length) {
    const signed = await supabase.storage.from(store.config.bucket).createSignedUrls(keys, SIGNED_DOWNLOAD_TTL_SECONDS)
    if (signed.error || !Array.isArray(signed.data)) return sendVideoStudioError(res, 503, 'library_store_unavailable')
    for (const item of signed.data) {
      const url = item?.signedUrl
      if (!item?.error && typeof item?.path === 'string' && typeof url === 'string' && isSignedPreviewUrlAllowed(url, store.config.supabaseOrigin)) {
        urls.set(item.path, url)
      }
    }
  }
  const expiresAt = new Date(Date.now() + SIGNED_DOWNLOAD_TTL_SECONDS * 1000).toISOString()
  const files = []
  for (const row of rows) {
    const url = urls.get(row.object_key)
    if (!url) { skipped += 1; continue }
    files.push({
      path: row.path,
      sha256: row.sha256,
      bytes: row.bytes,
      content_type: row.content_type,
      purpose: row.purpose,
      sent_by: row.sent_by,
      sent_at: row.sent_at,
      ready_at: row.ready_at,
      previous_sha256: row.previous_sha256,
      download: { method: 'GET', url, expires_at: expiresAt },
    })
  }

  return res.status(200).json({
    ok: true,
    schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
    machine: machineHash.slice(0, 8),
    files,
    skipped,
    more,
  })
}
