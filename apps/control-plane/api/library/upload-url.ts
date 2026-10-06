import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { operatorAttribution } from '../_editEvents.js'
import { supabase } from '../_supabase.js'
import { hashVideoStudioIdentity } from '../_videoStudioAuth.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from '../video-studio/_contracts.js'
import { enforceVideoStudioRateLimit } from '../video-studio/_data.js'
import { isSignedPreviewUrlAllowed } from '../video-studio/_previewStorage.js'
import {
  LIBRARY_FILE_COLUMNS,
  configuredLibraryStore,
  libraryFileRow,
  libraryFileView,
  libraryObjectKey,
  parseLibraryUploadRequest,
  verifyStoredLibraryObject,
  type LibraryFileRow,
} from './_library.js'

// POST /api/library/upload-url, on the engine key (or Krish's cookie).
//
//   { path, sha256, md5, bytes, purpose, client? }
//
// One file for Krish's asset library (api/library/_library.ts says why). The
// answer is one of three:
//
//   already_there: true    the library has these exact bytes at this path, and
//                          they are the newest for it. Nothing to send.
//   upload: { url, ... }   PUT the bytes to the signed URL, then confirm.
//   upload: null           the bytes are already stored (sent for another
//                          path); confirm and they are ready.
//
// The bytes never pass through this function: they go straight to the private
// bucket on a signed URL, as the Studio's previews do.

const SIGNED_UPLOAD_TTL_SECONDS = 2 * 60 * 60
// One identity for every sender: the engine key is one operator. A brand kit
// is about sixty files, two calls each.
const SENDER_IDENTITY = hashVideoStudioIdentity('library', 'sender')

async function findFile(path: string, sha256: string): Promise<{ row: LibraryFileRow | null; error: boolean }> {
  const found = await supabase
    .from('content_library_files')
    .select(LIBRARY_FILE_COLUMNS)
    .eq('path', path)
    .eq('sha256', sha256)
    .maybeSingle()
  if (found.error) return { row: null, error: true }
  if (!found.data) return { row: null, error: false }
  const row = libraryFileRow(found.data)
  return row ? { row, error: false } : { row: null, error: true }
}

/** The newest ready version of a path, by when it became ready. */
async function newestReady(path: string): Promise<{ sha256: string | null; error: boolean }> {
  const found = await supabase
    .from('content_library_files')
    .select('sha256')
    .eq('path', path)
    .eq('state', 'ready')
    .order('ready_at', { ascending: false })
    .limit(1)
  if (found.error) return { sha256: null, error: true }
  const first = Array.isArray(found.data) ? found.data[0] as { sha256?: unknown } | undefined : undefined
  return { sha256: typeof first?.sha256 === 'string' ? first.sha256 : null, error: false }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return
  const parsed = parseLibraryUploadRequest(req.body)
  if (parsed.ok === false) {
    return sendVideoStudioError(res, parsed.code === 'library_file_too_large' ? 413 : 400, parsed.code, parsed.reason ? { reason: parsed.reason } : {})
  }
  const body = parsed.value
  if (await enforceVideoStudioRateLimit(res, 'library:send', SENDER_IDENTITY, 600, 60)) return

  const store = await configuredLibraryStore()
  if (!store.config) return sendVideoStudioError(res, 503, store.error || 'library_store_unavailable')

  // Who sent it: the agent client on the engine key, Krish on his cookie.
  const sentBy = operatorAttribution(req.headers.authorization, req.body)?.client ?? 'Krish'
  const objectKey = libraryObjectKey(body.sha256, body.path.extension)

  let existing = await findFile(body.path.path, body.sha256)
  if (existing.error) return sendVideoStudioError(res, 503, 'library_index_unavailable')
  if (existing.row && (existing.row.bytes !== body.bytes || existing.row.md5 !== body.md5)) {
    // The same sha256 with a different size or MD5 is not the same file.
    return sendVideoStudioError(res, 409, 'library_file_conflict')
  }

  if (existing.row?.state === 'ready') {
    const newest = await newestReady(body.path.path)
    if (newest.error) return sendVideoStudioError(res, 503, 'library_index_unavailable')
    let row = existing.row
    let newestAgain = false
    if (newest.sha256 !== body.sha256) {
      // Sent again after a newer version: these bytes become the newest for
      // the path, so the library sync writes them back.
      const restored = await supabase
        .from('content_library_files')
        .update({ ready_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('state', 'ready')
        .select(LIBRARY_FILE_COLUMNS)
      const again = Array.isArray(restored.data) ? libraryFileRow(restored.data[0]) : null
      if (restored.error || !again) return sendVideoStudioError(res, 503, 'library_index_unavailable')
      row = again
      newestAgain = true
    }
    return res.status(200).json({
      ok: true,
      schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
      already_there: true,
      newest_again: newestAgain,
      file: libraryFileView(row),
      upload: null,
    })
  }

  if (!existing.row) {
    const inserted = await supabase
      .from('content_library_files')
      .upsert({
        path: body.path.path,
        sha256: body.sha256,
        md5: body.md5,
        bytes: body.bytes,
        content_type: body.path.contentType,
        object_key: objectKey,
        purpose: body.purpose,
        sent_by: sentBy,
        state: 'reserved',
      }, { onConflict: 'path,sha256', ignoreDuplicates: true })
    if (inserted.error) return sendVideoStudioError(res, 503, 'library_index_unavailable')
    // Read it back: a second sender may have reserved the same file first.
    existing = await findFile(body.path.path, body.sha256)
    if (existing.error || !existing.row) return sendVideoStudioError(res, 503, 'library_index_unavailable')
    if (existing.row.bytes !== body.bytes || existing.row.md5 !== body.md5) return sendVideoStudioError(res, 409, 'library_file_conflict')
  }
  const row = existing.row
  if (row.object_key !== objectKey || row.content_type !== body.path.contentType) {
    return sendVideoStudioError(res, 503, 'library_index_unavailable')
  }

  const stored = await verifyStoredLibraryObject(store.config.bucket, objectKey, body.bytes, body.path.contentType, body.md5)
  if (stored === 'mismatch') return sendVideoStudioError(res, 409, 'library_object_conflict')
  if (stored === 'unavailable') return sendVideoStudioError(res, 503, 'library_store_unavailable')

  let upload: { method: 'PUT'; url: string; headers: Record<string, string>; expires_at: string } | null = null
  if (stored === 'missing') {
    const signed = await supabase.storage
      .from(store.config.bucket)
      .createSignedUploadUrl(objectKey, { upsert: false })
    if (
      signed.error
      || !signed.data?.signedUrl
      || !isSignedPreviewUrlAllowed(signed.data.signedUrl, store.config.supabaseOrigin)
    ) return sendVideoStudioError(res, 503, 'library_store_unavailable')
    upload = {
      method: 'PUT',
      url: signed.data.signedUrl,
      headers: { 'Content-Type': body.path.contentType },
      expires_at: new Date(Date.now() + SIGNED_UPLOAD_TTL_SECONDS * 1000).toISOString(),
    }
  }

  return res.status(200).json({
    ok: true,
    schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
    already_there: false,
    newest_again: false,
    file: libraryFileView(row),
    upload,
  })
}
