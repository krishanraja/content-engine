import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { hashVideoStudioIdentity } from '../_videoStudioAuth.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from '../video-studio/_contracts.js'
import { enforceVideoStudioRateLimit } from '../video-studio/_data.js'
import { isSignedPreviewUrlAllowed } from '../video-studio/_previewStorage.js'
import { LIBRARY_BUCKET, checkLibraryPath, configuredLibraryStore, libraryFileRow, libraryFileView, parseLibraryName } from './_library.js'

// GET /api/library/file?path=<library path>[&library=heartside], on the engine key (or Krish's cookie).
//
// The newest ready copy of one library file, with a signed download URL that
// lasts an hour. It lets any machine that renders (GitHub's, a cloud session,
// either home computer) read what the home computers sent, without H:: the
// licensed music under "1 Brand kit (permanent)/Music" (scripts/quick-edit/
// music.py fetch), and a post's pictures. Krish, 2026-10-12, on a session that
// could not reach his music: "the audio is literally in the drive ... record
// this capability of yours so you do not whine about this ever again".
//
// GET /api/library/file?sha256=<hex> (no path), on the same key: where those
// exact bytes already are in the library, so Control Center can mint a
// SendLinks file link straight onto the stored object, with no bytes moved
// (I-07, 14 Nov). The answer names the newest ready copy's library, path and
// storage object (bucket and key), and every other library path holding the
// same bytes. Nothing is signed or moved here; 404 when the bytes are not in
// the library.

const SIGNED_DOWNLOAD_TTL_SECONDS = 60 * 60
const READER_IDENTITY = hashVideoStudioIdentity('library', 'file-reader')

const SHA256 = /^[a-f0-9]{64}$/

/** Where the bytes with this sha256 already are: the newest ready copy first. */
async function findBySha(res: VercelResponse, sha: string) {
  if (await enforceVideoStudioRateLimit(res, 'library:file', READER_IDENTITY, 120, 60)) return
  const { data, error } = await supabase
    .from('content_library_files')
    .select('*')
    .eq('sha256', sha)
    .eq('state', 'ready')
    .order('ready_at', { ascending: false })
    .limit(20)
  if (error || !Array.isArray(data)) return sendVideoStudioError(res, 503, 'library_index_unavailable')
  const rows = data.map(libraryFileRow).filter((row): row is NonNullable<typeof row> => row !== null && row.sha256 === sha)
  const newest = rows[0]
  if (!newest) return sendVideoStudioError(res, 404, 'library_file_not_found')
  return res.status(200).json({
    ok: true,
    schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
    file: { ...libraryFileView(newest), library: newest.library },
    object: { bucket: LIBRARY_BUCKET, key: newest.object_key },
    also_at: rows.slice(1).map((row) => ({ library: row.library, path: row.path })),
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET'])) return
  const raw = Array.isArray(req.query?.path) ? req.query.path[0] : req.query?.path
  if (raw === undefined && req.query?.library === undefined) {
    const sha = req.query?.sha256
    if (typeof sha !== 'string' || !SHA256.test(sha)) return sendVideoStudioError(res, 400, 'invalid_library_hash')
    return findBySha(res, sha)
  }
  const library = parseLibraryName(Array.isArray(req.query?.library) ? req.query.library[0] : req.query?.library)
  if (!library) return sendVideoStudioError(res, 400, 'invalid_library')
  const checked = checkLibraryPath(raw, library)
  if (!checked.ok) return sendVideoStudioError(res, 400, 'invalid_library_path')
  const sha = req.query?.sha256
  if (sha !== undefined && (typeof sha !== 'string' || !/^[a-f0-9]{64}$/.test(sha))) return sendVideoStudioError(res, 400, 'invalid_library_hash')
  if (await enforceVideoStudioRateLimit(res, 'library:file', READER_IDENTITY, 120, 60)) return

  const store = await configuredLibraryStore()
  if (!store.config) return sendVideoStudioError(res, 503, store.error || 'library_store_unavailable')

  let query = supabase
    .from('content_library_files')
    .select('*')
    .eq('library', library)
    .eq('path', checked.path)
    .eq('state', 'ready')
  if (sha) query = query.eq('sha256', sha)
  const { data, error } = await query.order('ready_at', { ascending: false }).limit(1)
  if (error || !Array.isArray(data)) return sendVideoStudioError(res, 503, 'library_index_unavailable')
  const row = data.length ? libraryFileRow(data[0]) : null
  if (!row) return sendVideoStudioError(res, 404, 'library_file_not_found')

  const signed = await supabase.storage.from(store.config.bucket).createSignedUrl(row.object_key, SIGNED_DOWNLOAD_TTL_SECONDS)
  const url = signed.data?.signedUrl
  if (signed.error || typeof url !== 'string' || !isSignedPreviewUrlAllowed(url, store.config.supabaseOrigin)) {
    return sendVideoStudioError(res, 503, 'library_store_unavailable')
  }
  if (req.query.download === '1' && sha) return res.redirect(302, url)
  return res.status(200).json({
    ok: true,
    schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
    file: libraryFileView(row),
    download: { method: 'GET', url, expires_at: new Date(Date.now() + SIGNED_DOWNLOAD_TTL_SECONDS * 1000).toISOString() },
  })
}
