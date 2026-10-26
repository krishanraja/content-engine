import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MEDIA_STANDARD, MEDIA_STANDARD_HASH, MediaQualityError, QualificationRequest, qualifyMedia } from '../_mediaQuality.js'
import { reviewerKeys } from '../../../../packages/core/src/media-quality.js'

// Read the standard or verify a review already stored in the immutable library.
// There is deliberately no sign, register-key, override, or producer-pass endpoint.
export function createMediaQualityHandler(getDb: () => Promise<SupabaseClient>) { return async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  if (req.method === 'GET') return res.status(200).json({ ok: true, standard: MEDIA_STANDARD,
    standard_sha256: MEDIA_STANDARD_HASH, reviewer_available: Object.keys(reviewerKeys()).length > 0 })
  const parsed = QualificationRequest.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_qualification_request' })
  try { return res.status(200).json({ ok: true, qualification: await qualifyMedia(await getDb(), parsed.data) }) }
  catch (e) { return res.status(e instanceof MediaQualityError ? 409 : 503).json({ ok: false, error: 'media_unqualified', problems: [e instanceof MediaQualityError ? e.message : 'review verification unavailable'] }) }
} }
export default createMediaQualityHandler(async () => (await import('../_supabase.js')).supabase)
