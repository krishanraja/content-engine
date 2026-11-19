import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { DRIVE_READONLY_SCOPE, googleAccessToken, googleConfigured } from '../_google.js'
import { supabase } from '../_supabase.js'
import { hashVideoStudioIdentity } from '../_videoStudioAuth.js'
import { sendVideoStudioError } from '../video-studio/_contracts.js'
import { enforceVideoStudioRateLimit } from '../video-studio/_data.js'
import { isSignedPreviewUrlAllowed } from '../video-studio/_previewStorage.js'
import { copyDriveFile } from './_inboxDrive.js'
import { LIBRARY_MAX_BYTES, configuredLibraryStore } from './_library.js'

// POST /api/library/drive-review, on the engine key.
//
//   { file_id }   a file in Krish's Drive, by its ID (the part after /file/d/ in a Drive link)
//
// Lets any session watch a video Krish points at, whatever its size. The
// Drive connector downloads nothing over 10 MB, so a session handed a 268 MB
// long cut could not see it (Krish, 2026-11-19: "you need to figure out how to
// watch the long video"). The engine reads the file as its owner, read only,
// streams it into the private library bucket under review/drive/, and answers
// with a signed download URL that lasts an hour.
//
// It reads Drive and never writes it. The copy is a working copy for review:
// it is not a library file (no content_library_files row), never filed on a
// post and never placed as a take. The same file ID and size is copied once.

const SIGNED_DOWNLOAD_TTL_SECONDS = 60 * 60
const COPY_BUDGET_MS = 540_000
const READER_IDENTITY = hashVideoStudioIdentity('library', 'drive-review')
const DRIVE_ID = /^[A-Za-z0-9_-]{10,120}$/

export const REVIEW_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}

export interface DriveMeta { id?: string; name?: string; mimeType?: string; size?: string | number; trashed?: boolean }

export type ReviewPlan =
  | { ok: true; objectKey: string; contentType: string; bytes: number; name: string }
  | { ok: false; status: number; error: string }

/** What one Drive file becomes in the review area, or why it cannot. Pure, so it is tested without Drive. */
export function planDriveReview(fileId: unknown, meta: DriveMeta | null, allowedTypes: readonly string[]): ReviewPlan {
  if (typeof fileId !== 'string' || !DRIVE_ID.test(fileId)) return { ok: false, status: 400, error: 'invalid_drive_file_id' }
  if (!meta) return { ok: false, status: 404, error: 'drive_file_not_found' }
  if (meta.trashed) return { ok: false, status: 404, error: 'drive_file_trashed' }
  const contentType = String(meta.mimeType || '')
  const ext = REVIEW_TYPES[contentType]
  if (!ext) return { ok: false, status: 415, error: 'drive_file_type_not_reviewable' }
  if (!allowedTypes.includes(contentType)) return { ok: false, status: 415, error: 'library_store_does_not_take_this_type' }
  const bytes = Number(meta.size)
  if (!Number.isSafeInteger(bytes) || bytes <= 0) return { ok: false, status: 422, error: 'drive_file_has_no_size' }
  if (bytes > LIBRARY_MAX_BYTES) return { ok: false, status: 413, error: 'drive_file_too_large' }
  return { ok: true, objectKey: `review/drive/${fileId}-${bytes}.${ext}`, contentType, bytes, name: String(meta.name || fileId) }
}

async function driveMeta(fileId: string, token: string): Promise<DriveMeta | null> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,trashed&supportsAllDrives=true`
  const answer = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (answer.status === 404) return null
  if (!answer.ok) throw new Error(`Drive answered ${answer.status} for the file`)
  return (await answer.json()) as DriveMeta
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return
  if (!googleConfigured()) return sendVideoStudioError(res, 503, 'google_unconfigured')
  if (await enforceVideoStudioRateLimit(res, 'library:drive-review', READER_IDENTITY, 30, 60)) return
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>
  const fileId = body.file_id
  if (typeof fileId !== 'string' || !DRIVE_ID.test(fileId)) return sendVideoStudioError(res, 400, 'invalid_drive_file_id')

  const store = await configuredLibraryStore()
  if (!store.config) return sendVideoStudioError(res, 503, store.error || 'library_store_unavailable')

  // Read as the Drive's owner, as the board reads a post's files (board/_drivePosts.ts).
  const token = await googleAccessToken([DRIVE_READONLY_SCOPE], { subject: process.env.GOOGLE_DRIVE_OWNER || 'krish@mindmake.co' })
  if (!token) return sendVideoStudioError(res, 503, 'google_sign_in_failed')

  let meta: DriveMeta | null
  try {
    meta = await driveMeta(fileId, token)
  } catch {
    return sendVideoStudioError(res, 502, 'drive_unreadable')
  }
  const plan = planDriveReview(fileId, meta, store.config.allowedTypes)
  if (plan.ok === false) return sendVideoStudioError(res, plan.status, plan.error)

  const bucket = store.config.bucket
  const folder = plan.objectKey.slice(0, plan.objectKey.lastIndexOf('/'))
  const leaf = plan.objectKey.slice(folder.length + 1)
  const listed = await supabase.storage.from(bucket).list(folder, { search: leaf, limit: 5 })
  const already = !listed.error && (listed.data || []).some((o: any) => o?.name === leaf && Number(o?.metadata?.size) === plan.bytes)

  let sha256: string | null = null
  if (!already) {
    const signed = await supabase.storage.from(bucket).createSignedUploadUrl(plan.objectKey, { upsert: true })
    if (signed.error || !signed.data?.signedUrl || !isSignedPreviewUrlAllowed(signed.data.signedUrl, store.config.supabaseOrigin)) {
      return sendVideoStudioError(res, 503, 'library_store_unavailable')
    }
    try {
      const sent = await copyDriveFile(fileId, signed.data.signedUrl, plan.contentType, plan.bytes, COPY_BUDGET_MS, token)
      if (sent.status < 200 || sent.status >= 300) return sendVideoStudioError(res, 502, 'review_copy_failed')
      sha256 = sent.sha256
    } catch {
      return sendVideoStudioError(res, 502, 'review_copy_failed')
    }
  }

  const download = await supabase.storage.from(bucket).createSignedUrl(plan.objectKey, SIGNED_DOWNLOAD_TTL_SECONDS)
  const url = download.data?.signedUrl
  if (download.error || typeof url !== 'string' || !isSignedPreviewUrlAllowed(url, store.config.supabaseOrigin)) {
    return sendVideoStudioError(res, 503, 'library_store_unavailable')
  }
  return res.status(200).json({
    ok: true,
    file: { id: fileId, name: plan.name, type: plan.contentType, bytes: plan.bytes, sha256 },
    already_copied: already,
    download: { method: 'GET', url, expires_at: new Date(Date.now() + SIGNED_DOWNLOAD_TTL_SECONDS * 1000).toISOString() },
  })
}
