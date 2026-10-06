import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../../_auth.js'
import { supabase } from '../../_supabase.js'
import { hashVideoStudioIdentity } from '../../_videoStudioAuth.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from '../../video-studio/_contracts.js'
import { enforceVideoStudioRateLimit } from '../../video-studio/_data.js'
import { isSignedPreviewUrlAllowed } from '../../video-studio/_previewStorage.js'
import { configuredLibraryStore } from '../_library.js'
import {
  RECORDING_PREFIX,
  isRecordingManifestName,
  parseRecordingsQuery,
  readRecordingManifest,
  recordingView,
  type RecordingManifest,
} from '../_recordings.js'

// GET /api/library/recordings?limit=<1..200>, on the engine key (or Krish's cookie).
//
// The recordings from the Video Engine Inbox that reached the engine
// (api/library/_recordings.ts says why), the newest first, each with its
// name, size, sha256, when it arrived and a signed download URL that lasts an
// hour. scripts/post-pack/recording.py reads this. A manifest that cannot be
// read is counted in `skipped`, never guessed at.

const SIGNED_DOWNLOAD_TTL_SECONDS = 60 * 60
const LIST_WINDOW = 1000
const READ_AT_ONCE = 20
const READER_IDENTITY = hashVideoStudioIdentity('library', 'recordings-reader')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET'])) return
  const query = parseRecordingsQuery(req.query)
  if (!query) return sendVideoStudioError(res, 400, 'invalid_recordings_request')
  if (await enforceVideoStudioRateLimit(res, 'library:recordings-list', READER_IDENTITY, 120, 60)) return

  const store = await configuredLibraryStore()
  if (!store.config) return sendVideoStudioError(res, 503, store.error || 'library_store_unavailable')
  const bucket = store.config.bucket

  const listed = await supabase.storage.from(bucket).list(RECORDING_PREFIX, {
    limit: LIST_WINDOW,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (listed.error || !Array.isArray(listed.data)) return sendVideoStudioError(res, 503, 'library_store_unavailable')
  const shas = listed.data
    .map((item) => item?.name)
    .filter(isRecordingManifestName)
    .map((name) => name.slice(0, 64))

  const manifests: RecordingManifest[] = []
  let skipped = 0
  for (let start = 0; start < shas.length; start += READ_AT_ONCE) {
    const read = await Promise.all(shas.slice(start, start + READ_AT_ONCE).map((sha) => readRecordingManifest(bucket, sha)))
    for (const found of read) {
      if (found.manifest) manifests.push(found.manifest)
      else skipped += 1
    }
  }
  manifests.sort((a, b) => Date.parse(b.uploaded_at) - Date.parse(a.uploaded_at) || a.sha256.localeCompare(b.sha256))
  const shown = manifests.slice(0, query.limit)

  const urls = new Map<string, string>()
  if (shown.length) {
    const signed = await supabase.storage.from(bucket).createSignedUrls(shown.map((m) => m.object_key), SIGNED_DOWNLOAD_TTL_SECONDS)
    if (signed.error || !Array.isArray(signed.data)) return sendVideoStudioError(res, 503, 'library_store_unavailable')
    for (const item of signed.data) {
      const url = item?.signedUrl
      if (!item?.error && typeof item?.path === 'string' && typeof url === 'string' && isSignedPreviewUrlAllowed(url, store.config.supabaseOrigin)) {
        urls.set(item.path, url)
      }
    }
  }
  const expiresAt = new Date(Date.now() + SIGNED_DOWNLOAD_TTL_SECONDS * 1000).toISOString()
  const recordings = []
  for (const manifest of shown) {
    const url = urls.get(manifest.object_key)
    if (!url) { skipped += 1; continue }
    recordings.push({ ...recordingView(manifest), download: { method: 'GET', url, expires_at: expiresAt } })
  }

  return res.status(200).json({
    ok: true,
    schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
    recordings,
    skipped,
    more: manifests.length > query.limit,
  })
}
