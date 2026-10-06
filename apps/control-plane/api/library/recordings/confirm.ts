import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardVideoStudioRunner } from '../../_videoStudioAuth.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from '../../video-studio/_contracts.js'
import { enforceVideoStudioRateLimit } from '../../video-studio/_data.js'
import { configuredLibraryStore, verifyStoredLibraryObject } from '../_library.js'
import {
  RECORDINGS_SENDER,
  parseRecordingRequest,
  readRecordingManifest,
  recordingObjectKey,
  recordingView,
  withName,
  writeRecordingManifest,
} from '../_recordings.js'

// POST /api/library/recordings/confirm, on the runner bearer.
//
//   { name, sha256, md5?, bytes }
//
// After the PUT: checks the stored object has the size, type and (where both
// sides have one) the MD5 the sync declared, the same check the library's
// files get, then writes the manifest beside it so sessions see it in
// GET /api/library/recordings. Confirming a recording already listed under
// this name changes nothing.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardVideoStudioRunner(req, res, ['POST'])) return
  const parsed = parseRecordingRequest(req.body)
  if (parsed.ok === false) {
    return sendVideoStudioError(res, parsed.code === 'recording_too_large' ? 413 : 400, parsed.code, parsed.refusal ? { reason: parsed.refusal } : {})
  }
  const body = parsed.value
  if (await enforceVideoStudioRateLimit(res, 'library:recordings', RECORDINGS_SENDER, 120, 60)) return

  const store = await configuredLibraryStore()
  if (!store.config) return sendVideoStudioError(res, 503, store.error || 'library_store_unavailable')

  const objectKey = recordingObjectKey(body.sha256, body.recording.extension)
  const stored = await verifyStoredLibraryObject(store.config.bucket, objectKey, body.bytes, body.recording.contentType, body.md5)
  if (stored === 'missing') return sendVideoStudioError(res, 409, 'recording_object_missing')
  if (stored === 'mismatch') return sendVideoStudioError(res, 409, 'recording_object_conflict')
  if (stored === 'unavailable') return sendVideoStudioError(res, 503, 'library_store_unavailable')

  const found = await readRecordingManifest(store.config.bucket, body.sha256)
  if (found.error) return sendVideoStudioError(res, 503, 'library_store_unavailable')
  if (found.manifest && (found.manifest.bytes !== body.bytes || found.manifest.object_key !== objectKey)) {
    return sendVideoStudioError(res, 409, 'recording_object_conflict')
  }
  if (found.manifest && found.manifest.names[0] === body.recording.name) {
    return res.status(200).json({ ok: true, schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, already_listed: true, recording: recordingView(found.manifest) })
  }
  const manifest = withName(found.manifest, body, new Date().toISOString())
  if (!(await writeRecordingManifest(store.config.bucket, manifest))) return sendVideoStudioError(res, 503, 'library_store_unavailable')
  return res.status(200).json({ ok: true, schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, already_listed: false, recording: recordingView(manifest) })
}
