import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardVideoStudioRunner } from '../../_videoStudioAuth.js'
import { supabase } from '../../_supabase.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from '../../video-studio/_contracts.js'
import { enforceVideoStudioRateLimit } from '../../video-studio/_data.js'
import { isSignedPreviewUrlAllowed } from '../../video-studio/_previewStorage.js'
import { configuredLibraryStore, verifyStoredLibraryObject } from '../_library.js'
import { RECORDINGS_SENDER, parseRecordingRequest, readRecordingManifest, recordingObjectKey, recordingView } from '../_recordings.js'

// POST /api/library/recordings/upload-url, on the runner bearer.
//
//   { name, sha256, md5?, bytes }
//
// One recording from the Video Engine Inbox, sent by the recordings upload on
// Krish's runner machines (api/library/_recordings.ts says why). The answer is one of
// three:
//
//   already_there: true    these bytes are stored under this name. Nothing to send.
//   upload: { url, ... }   PUT the bytes to the signed URL, then confirm.
//   upload: null           the bytes are stored (under another name, or a
//                          confirm did not finish); confirm and they are listed.
//
// The bytes never pass through this function: they go straight to the private
// bucket on a signed URL, as the library's files do.

const SIGNED_UPLOAD_TTL_SECONDS = 2 * 60 * 60

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
  if (!store.config.allowedTypes.includes(body.recording.contentType)) {
    // Matroska waits for its migration; every other recording type is in the
    // bucket from the start.
    return sendVideoStudioError(res, 415, 'recording_type_not_enabled', { content_type: body.recording.contentType })
  }

  const objectKey = recordingObjectKey(body.sha256, body.recording.extension)
  const stored = await verifyStoredLibraryObject(store.config.bucket, objectKey, body.bytes, body.recording.contentType, body.md5)
  if (stored === 'mismatch') return sendVideoStudioError(res, 409, 'recording_object_conflict')
  if (stored === 'unavailable') return sendVideoStudioError(res, 503, 'library_store_unavailable')

  if (stored === 'verified') {
    const found = await readRecordingManifest(store.config.bucket, body.sha256)
    if (found.error) return sendVideoStudioError(res, 503, 'library_store_unavailable')
    const named = found.manifest !== null && found.manifest.names.includes(body.recording.name)
    return res.status(200).json({
      ok: true,
      schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
      already_there: named,
      recording: found.manifest ? recordingView(found.manifest) : null,
      upload: null,
    })
  }

  const signed = await supabase.storage
    .from(store.config.bucket)
    .createSignedUploadUrl(objectKey, { upsert: false })
  if (
    signed.error
    || !signed.data?.signedUrl
    || !isSignedPreviewUrlAllowed(signed.data.signedUrl, store.config.supabaseOrigin)
  ) return sendVideoStudioError(res, 503, 'library_store_unavailable')
  return res.status(200).json({
    ok: true,
    schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
    already_there: false,
    recording: null,
    upload: {
      method: 'PUT',
      url: signed.data.signedUrl,
      headers: { 'Content-Type': body.recording.contentType },
      expires_at: new Date(Date.now() + SIGNED_UPLOAD_TTL_SECONDS * 1000).toISOString(),
    },
  })
}
