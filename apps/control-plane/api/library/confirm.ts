import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { hashVideoStudioIdentity } from '../_videoStudioAuth.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from '../video-studio/_contracts.js'
import { enforceVideoStudioRateLimit } from '../video-studio/_data.js'
import {
  LIBRARY_FILE_COLUMNS,
  configuredLibraryStore,
  libraryFileRow,
  libraryFileView,
  libraryObjectKey,
  parseLibraryConfirmRequest,
  verifyStoredLibraryObject,
} from './_library.js'

// POST /api/library/confirm, on the engine key (or Krish's cookie).
//
//   { path, sha256 }
//
// After the PUT: checks the stored object has the size, type and (where
// Storage reports one) the MD5 the sender declared, then marks the file
// ready. Only a ready file is handed to the library sync on Krish's machine.
// Confirming a file that is already ready changes nothing.

const SENDER_IDENTITY = hashVideoStudioIdentity('library', 'sender')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return
  const parsed = parseLibraryConfirmRequest(req.body)
  if (parsed.ok === false) return sendVideoStudioError(res, 400, parsed.code, parsed.reason ? { reason: parsed.reason } : {})
  const body = parsed.value
  if (await enforceVideoStudioRateLimit(res, 'library:send', SENDER_IDENTITY, 600, 60)) return

  const store = await configuredLibraryStore()
  if (!store.config) return sendVideoStudioError(res, 503, store.error || 'library_store_unavailable')

  const found = await supabase
    .from('content_library_files')
    .select(LIBRARY_FILE_COLUMNS)
    .eq('path', body.path.path)
    .eq('sha256', body.sha256)
    .maybeSingle()
  if (found.error) return sendVideoStudioError(res, 503, 'library_index_unavailable')
  if (!found.data) return sendVideoStudioError(res, 404, 'library_file_not_found')
  const row = libraryFileRow(found.data)
  if (!row || row.object_key !== libraryObjectKey(body.sha256, body.path.extension)) {
    return sendVideoStudioError(res, 503, 'library_index_unavailable')
  }
  if (row.state === 'ready') {
    return res.status(200).json({ ok: true, schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, already_ready: true, file: libraryFileView(row) })
  }

  const stored = await verifyStoredLibraryObject(store.config.bucket, row.object_key, row.bytes, row.content_type, row.md5)
  if (stored === 'missing') return sendVideoStudioError(res, 409, 'library_object_missing')
  if (stored === 'mismatch') return sendVideoStudioError(res, 409, 'library_object_conflict')
  if (stored === 'unavailable') return sendVideoStudioError(res, 503, 'library_store_unavailable')

  const updated = await supabase
    .from('content_library_files')
    .update({ state: 'ready', ready_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('state', 'reserved')
    .select(LIBRARY_FILE_COLUMNS)
  if (updated.error) return sendVideoStudioError(res, 503, 'library_index_unavailable')
  let ready = Array.isArray(updated.data) ? libraryFileRow(updated.data[0]) : null
  if (!ready) {
    // A second confirm got there first: read the row it left.
    const again = await supabase
      .from('content_library_files')
      .select(LIBRARY_FILE_COLUMNS)
      .eq('id', row.id)
      .maybeSingle()
    ready = again.error ? null : libraryFileRow(again.data)
    if (!ready || ready.state !== 'ready') return sendVideoStudioError(res, 503, 'library_index_unavailable')
  }
  return res.status(200).json({ ok: true, schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, already_ready: false, file: libraryFileView(ready) })
}
