import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { BoardDeliverySchema, MEDIA_STANDARD, MEDIA_STANDARD_HASH, MediaRefSchema, SignedMediaEnvelopeSchema, boardDeliveryProblems, canonicalMediaJson, mediaDigest, mediaReviewProblems, reviewerKeys, type MediaRef } from '../../../packages/core/src/media-quality.js'

export { MEDIA_STANDARD, MEDIA_STANDARD_HASH }
export const QualificationRequest = z.object({
  piece_id: z.string().min(1).max(160), artifact: MediaRefSchema, receipt: MediaRefSchema,
  role: z.enum(['video', 'slide', 'document', 'manifest']),
  production_id: z.string().min(1).max(160).optional(),
  cut: z.enum(['short', 'long', 'feature']).optional(),
  stage: z.enum(['proof', 'final']).optional(),
}).strict()
export type QualificationInput = z.infer<typeof QualificationRequest>
export class MediaQualityError extends Error {}
type Verified = { text: string | null; contentType: string }
export type MediaReadCache = Map<string, Promise<Verified>>

/** Hash actual stored bytes. Neither the filename nor Storage's ready flag is proof.
 * Signed URLs originate only from the configured private bucket; callers supply no URL. */
export async function readMediaRef(db: SupabaseClient, ref: MediaRef, cache: MediaReadCache, json = false): Promise<Verified> {
  const key = `${ref.path}:${ref.sha256}:${json}`
  if (cache.has(key)) return cache.get(key)!
  const promise = (async () => {
    const { libraryObjectKey, checkLibraryPath } = await import('./library/_library.js')
    const parsed = checkLibraryPath(ref.path)
    if (!parsed.ok) throw new MediaQualityError('evidence path is outside the library')
    const found = await db.from('content_library_files').select('path,sha256,object_key,bytes,content_type,state').eq('path', ref.path).eq('sha256', ref.sha256).eq('state', 'ready').maybeSingle()
    const row = found.data
    if (found.error || !row || row.object_key !== libraryObjectKey(ref.sha256, parsed.extension)) throw new MediaQualityError('exact media or evidence version unavailable')
    const limit = json ? 2 * 1024 * 1024 : 2 * 1024 ** 3
    if (!Number.isSafeInteger(row.bytes) || row.bytes < 1 || row.bytes > limit) throw new MediaQualityError('media or evidence size invalid')
    const signed = await db.storage.from('content-library').createSignedUrl(row.object_key, 180)
    if (signed.error || !signed.data?.signedUrl) throw new MediaQualityError('media storage unavailable')
    const response = await fetch(signed.data.signedUrl, { redirect: 'error', signal: AbortSignal.timeout(120000) })
    if (!response.ok || !response.body) throw new MediaQualityError('media bytes unavailable')
    let size = 0; const hash = createHash('sha256'), chunks: Buffer[] = []
    const reader = response.body.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break
        size += value.byteLength
        if (size > row.bytes || size > limit) throw new MediaQualityError('media size mismatch')
        hash.update(value)
        if (json) chunks.push(Buffer.from(value))
      }
    } finally { await reader.cancel() }
    if (size !== row.bytes || hash.digest('hex') !== ref.sha256) throw new MediaQualityError('stored media hash mismatch')
    return { text: json ? Buffer.concat(chunks).toString('utf8') : null, contentType: String(row.content_type) }
  })()
  cache.set(key, promise)
  return promise
}
async function jsonRef(db: SupabaseClient, ref: MediaRef, cache: MediaReadCache): Promise<unknown> {
  try { return JSON.parse((await readMediaRef(db, ref, cache, true)).text!) }
  catch (e) { if (e instanceof MediaQualityError) throw e; throw new MediaQualityError('review evidence is not readable JSON') }
}
async function proofByHash(db: SupabaseClient, sha256: string, cache: MediaReadCache): Promise<unknown> {
  const found = await db.from('content_library_files').select('path,sha256').eq('sha256', sha256).eq('state', 'ready').limit(1)
  if (found.error || !found.data?.[0]) throw new MediaQualityError('representative proof receipt unavailable')
  return jsonRef(db, found.data[0] as MediaRef, cache)
}
export async function qualifyMedia(db: SupabaseClient, input: QualificationInput, cache: MediaReadCache = new Map()) {
  if (!Object.keys(reviewerKeys()).length) throw new MediaQualityError('trusted independent reviewer unavailable')
  const envelope = await jsonRef(db, input.receipt, cache)
  const stage = input.stage || 'final'
  const problems = mediaReviewProblems(envelope, { piece_id: input.piece_id, role: input.role, ...(input.production_id ? { production_id: input.production_id } : {}), ...(input.cut ? { cut: input.cut } : {}), stage, artifacts: [input.artifact] })
  if (problems.length) throw new MediaQualityError(problems.join('; '))
  const review = SignedMediaEnvelopeSchema.parse(envelope).payload
  const proofEnvelope = stage === 'final' ? await proofByHash(db, review.proof_receipt_sha256!, cache) : envelope
  const proofProblems = mediaReviewProblems(proofEnvelope, { piece_id: input.piece_id, cut: review.brief.cut, surface: review.brief.surface, stage: 'proof' })
  if (proofProblems.length) throw new MediaQualityError(`representative proof: ${proofProblems.join('; ')}`)
  const proof = SignedMediaEnvelopeSchema.parse(proofEnvelope).payload
  if (canonicalMediaJson(proof.brief) !== canonicalMediaJson(review.brief)) throw new MediaQualityError('representative proof belongs to a different creative brief')
  // Verify all evidence and outputs, not only the one item the caller selected.
  for (const ref of [...proof.evidence, ...proof.artifacts, ...review.evidence, ...review.artifacts]) await readMediaRef(db, ref, cache)
  for (const a of [...proof.artifacts, ...review.artifacts]) if ((await readMediaRef(db, a, cache)).contentType !== a.content_type) throw new MediaQualityError('stored media type differs from reviewed artifact')
  return { qualified: true as const, qualification_id: input.receipt.sha256, piece_id: input.piece_id,
    surface: review.brief.surface, cut: review.brief.cut, artifact: input.artifact, role: input.role, production_id: review.brief.production_id, stage,
    brief_sha256: mediaDigest(canonicalMediaJson(review.brief)),
    standard_sha256: MEDIA_STANDARD_HASH, reviewer_key_id: SignedMediaEnvelopeSchema.parse(envelope).key_id }
}
export async function qualifyBoard(db: SupabaseClient, manifest: unknown, signedReview: unknown) {
  const problems = boardDeliveryProblems(signedReview, manifest)
  if (problems.length) throw new MediaQualityError(problems.join('; '))
  const payload = BoardDeliverySchema.parse(signedReview).payload, cache: MediaReadCache = new Map()
  for (const evidence of payload.evidence) await readMediaRef(db, evidence, cache)
  for (const q of payload.qualifications) await qualifyMedia(db, q, cache)
  return { standard_sha256: MEDIA_STANDARD_HASH, delivery_review_sha256: mediaDigest(canonicalMediaJson(signedReview)) }
}
