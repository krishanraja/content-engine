/** The producer supplies work. An independently provisioned reviewer signs evidence.
 * Public keys live in the verifier environment; no private signing key is loaded here.
 * Local verification is useful feedback. Server verification is the delivery boundary. */
import { createHash, createPublicKey, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import standard from '../../../config/media-standard.json' with { type: 'json' }
import studio from '../../../config/studio.json' with { type: 'json' }
import textPolicy from '../../../config/visual-clarity.json' with { type: 'json' }
import carouselDirection from '../../../config/carousel-visual-direction.json' with { type: 'json' }

export const canonicalMediaJson = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonicalMediaJson).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonicalMediaJson((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v)
}
export const mediaDigest = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex')
export const MEDIA_STANDARD = standard
// The studio's settings the standard binds: all of config/studio.json but local_roots, where the home computers keep
// their folders (W2.11). Folder layout is not a media standard, so it never changes the reviewed hash.
const { local_roots: _localRoots, ...identity } = studio as typeof studio & { local_roots?: unknown }
// Bind actual inputs, not just a version label that a stale client can copy.
export const MEDIA_STANDARD_HASH = mediaDigest(canonicalMediaJson({ standard, identity, textPolicy, carouselDirection }))
const Sha = z.string().regex(/^[a-f0-9]{64}$/)
const Text = z.string().trim().min(1).max(2000)
const Id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/)
export const MediaRefSchema = z.object({ path: Text, sha256: Sha }).strict()
export type MediaRef = z.infer<typeof MediaRefSchema>
const Artifact = MediaRefSchema.extend({ id: Id, role: z.enum(['video', 'slide', 'document', 'manifest']), content_type: Text }).strict()
const Asset = z.object({ id: Id, sha256: Sha, kind: z.enum(['piece', 'official_identity']), piece_id: Id.nullable(), source: Text, truth_role: z.enum(['evidence', 'illustration', 'identity']), relevance: Text }).strict()
const Unit = z.object({ id: Id, takeaway: Text, visual_cues: z.array(Text).min(1).max(30), asset_ids: z.array(Id).min(1).max(50), visible_words: z.array(Text).max(100), word_purpose: Text, motion_purpose: Text.nullable() }).strict()
export const MediaBriefSchema = z.object({
  schema_version: z.literal(1), standard_sha256: Sha, piece_id: Id,
  surface: z.enum(['video_voiceover', 'video_camera', 'carousel']),
  cut: z.enum(['short', 'long', 'feature']).nullable(),
  production_id: Id, producer_run_id: Id, subject: Text, assets: z.array(Asset).min(1).max(500), units: z.array(Unit).min(1).max(300),
}).strict()
export type MediaBrief = z.infer<typeof MediaBriefSchema>
const Finding = z.object({ criterion: Id, result: z.enum(['pass', 'fail', 'uncertain']), observation: Text, evidence_sha256: z.array(Sha).min(1).max(50) }).strict()
export const MediaReviewSchema = z.object({
  schema_version: z.literal(1), kind: z.literal('media_quality'), stage: z.enum(['proof', 'final']),
  standard_sha256: Sha, brief: MediaBriefSchema,
  reviewer_run_id: Id, reviewed_at: z.string().datetime(),
  artifacts: z.array(Artifact).min(1).max(350), evidence: z.array(MediaRefSchema).min(1).max(500),
  proof_roles: z.array(z.object({ role: z.enum(['opening', 'dense_explanation', 'transition_or_conclusion']), evidence_sha256: Sha }).strict()).min(3).max(3),
  proof_receipt_sha256: Sha.nullable(),
  coverage: z.object({ unit_ids: z.array(Id).min(1), artifact_sha256: z.array(Sha).min(1), continuous_playback: z.boolean(), all_slides: z.boolean(), audio_review: z.enum(['validated_audio_reviewer', 'human_listening', 'not_applicable', 'unavailable']), comprehension_method: z.enum(['model_prediction', 'timed_human_test']), comprehension_evidence_sha256: Sha }).strict(),
  findings: z.array(Finding).min(1).max(50),
}).strict()
export type MediaReview = z.infer<typeof MediaReviewSchema>
export const SignedMediaEnvelopeSchema = z.object({ key_id: Id, payload: MediaReviewSchema, signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/) }).strict()
export type SignedMediaEnvelope = z.infer<typeof SignedMediaEnvelopeSchema>
export type ReviewerKeys = Record<string, { public_key: string; reviewer_id: string }>

export function reviewerKeys(): ReviewerKeys {
  try {
    const raw = JSON.parse(process.env.MEDIA_REVIEW_PUBLIC_KEYS || '{}')
    return z.record(Id, z.object({ public_key: Text, reviewer_id: Id }).strict()).parse(raw)
  } catch { return {} }
}
function signatureProblems(envelope: { key_id: string; signature: string; payload: unknown }, keys: ReviewerKeys): string[] {
  const trusted = keys[envelope.key_id]
  if (!trusted) return ['trusted independent reviewer unavailable']
  try {
    const key = createPublicKey(trusted.public_key)
    if (key.asymmetricKeyType !== 'ed25519' || !verify(null, Buffer.from(canonicalMediaJson(envelope.payload)), key, Buffer.from(envelope.signature, 'base64'))) return ['review signature invalid']
  } catch { return ['review signature invalid'] }
  return []
}
export function briefProblems(input: unknown): string[] {
  const parsed = MediaBriefSchema.safeParse(input)
  if (!parsed.success) return ['media brief missing or malformed']
  const b = parsed.data, problems: string[] = []
  if (b.standard_sha256 !== MEDIA_STANDARD_HASH) problems.push('media standard changed or was not loaded')
  if ((b.surface === 'carousel') !== (b.cut === null)) problems.push('video cut or carousel identity missing')
  const assets = new Map(b.assets.map(a => [a.id, a]))
  if (assets.size !== b.assets.length || new Set(b.units.map(u => u.id)).size !== b.units.length) problems.push('duplicate asset or unit identity')
  for (const a of b.assets) {
    if (a.kind === 'piece' && a.piece_id !== b.piece_id) problems.push(`${a.id}: previous-piece asset is not eligible`)
    if (a.kind === 'official_identity' && (a.piece_id !== null || a.truth_role !== 'identity')) problems.push(`${a.id}: official identity cannot disguise piece imagery`)
    if (standard.exemplars.some(e => e.sha256 === a.sha256)) problems.push(`${a.id}: evaluation exemplar is not a production input`)
  }
  for (const u of b.units) {
    if (u.asset_ids.some(id => !assets.has(id))) problems.push(`${u.id}: unknown asset`)
    if (b.surface === 'video_voiceover' && !u.motion_purpose) problems.push(`${u.id}: explanatory motion purpose missing`)
    // Final OCR and semantic redundancy remain an independently evidenced review.
    if (b.surface !== 'carousel' && u.visible_words.join(' ').split(/\s+/).filter(Boolean).length > textPolicy.max_total_words) problems.push(`${u.id}: visual word budget exceeded`)
  }
  return problems
}
export function mediaReviewProblems(input: unknown, expected: { piece_id?: string; production_id?: string; role?: 'video' | 'slide' | 'document' | 'manifest'; cut?: MediaBrief['cut']; surface?: MediaBrief['surface']; stage?: 'proof' | 'final'; artifacts?: MediaRef[] } = {}, keys = reviewerKeys(), now = Date.now()): string[] {
  const parsed = SignedMediaEnvelopeSchema.safeParse(input)
  if (!parsed.success) return ['signed independent review missing or malformed']
  const e = parsed.data, p = e.payload, problems = signatureProblems(e, keys)
  if (problems.length) return problems
  problems.push(...briefProblems(p.brief))
  if (p.standard_sha256 !== MEDIA_STANDARD_HASH) problems.push('review uses a stale standard')
  if (p.reviewer_run_id === p.brief.producer_run_id) problems.push('producer cannot review its own work')
  if (Date.parse(p.reviewed_at) > now + 60000) problems.push('review timestamp is in the future')
  if (expected.piece_id && p.brief.piece_id !== expected.piece_id) problems.push('review belongs to another piece')
  if (expected.production_id && p.brief.production_id !== expected.production_id) problems.push('review belongs to another production job')
  if (expected.surface && p.brief.surface !== expected.surface) problems.push('review belongs to another surface')
  if (expected.cut !== undefined && p.brief.cut !== expected.cut) problems.push('review belongs to another cut')
  if (expected.stage && p.stage !== expected.stage) problems.push('review is for a different stage')
  if (p.stage === 'final' && !p.proof_receipt_sha256) problems.push('representative proof receipt missing')
  if (new Set(p.artifacts.map(a => a.path)).size !== p.artifacts.length) problems.push('duplicate artifact path')
  for (const a of expected.artifacts || []) if (!p.artifacts.some(r => r.path === a.path && r.sha256 === a.sha256 && (!expected.role || r.role === expected.role))) problems.push('review does not bind the exact delivered role, bytes and destination')
  for (const a of p.artifacts) {
    const valid = a.role === 'video' ? /^video\/(mp4|webm|quicktime)$/.test(a.content_type) && p.brief.surface !== 'carousel'
      : a.role === 'slide' ? /^image\/(png|jpeg|webp)$/.test(a.content_type) && p.brief.surface === 'carousel'
      : a.role === 'document' ? a.content_type === 'application/pdf' && p.brief.surface === 'carousel' : a.content_type === 'application/json'
    if (!valid) problems.push('artifact role does not match its surface and media type')
  }
  const evidence = new Set(p.evidence.map(r => r.sha256))
  if (!evidence.has(p.coverage.comprehension_evidence_sha256)) problems.push('comprehension evidence missing')
  if (new Set(p.proof_roles.map(r => r.role)).size !== 3 || p.proof_roles.some(r => !evidence.has(r.evidence_sha256))) problems.push('representative proof coverage incomplete')
  if (p.coverage.unit_ids.length !== p.brief.units.length || p.brief.units.some(u => !p.coverage.unit_ids.includes(u.id))) problems.push('review omits a scene or slide')
  if (p.coverage.artifact_sha256.length !== p.artifacts.length || p.artifacts.some(a => !p.coverage.artifact_sha256.includes(a.sha256))) problems.push('review omits an output artifact')
  const video = p.brief.surface !== 'carousel'
  if (p.stage === 'final' && (video ? !p.coverage.continuous_playback : !p.coverage.all_slides)) problems.push('complete output review missing')
  if (video && !['validated_audio_reviewer', 'human_listening'].includes(p.coverage.audio_review)) problems.push('actual audio review unavailable')
  const required = [...standard.criteria, ...(video ? standard.video_criteria : standard.carousel_criteria)]
  if (new Set(p.findings.map(f => f.criterion)).size !== p.findings.length) problems.push('duplicate criterion verdict')
  for (const c of required) {
    const f = p.findings.find(f => f.criterion === c)
    if (!f || f.result !== 'pass' || f.evidence_sha256.some(h => !evidence.has(h))) problems.push(`${c}: qualifying evidence missing or failed`)
  }
  if (p.findings.some(f => f.result !== 'pass')) problems.push('a failed or uncertain minimum cannot be averaged away')
  return [...new Set(problems)]
}

// Board HTML can otherwise hide external media or ready labels outside assets.
// An independent delivery validator must bind the WHOLE immutable manifest.
export const BoardDeliverySchema = z.object({
  key_id: Id, signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/),
  payload: z.object({ schema_version: z.literal(1), kind: z.literal('board_delivery'), standard_sha256: Sha,
    manifest_sha256: Sha, reviewer_run_id: Id, reviewed_at: z.string().datetime(),
    evidence: z.array(MediaRefSchema).min(1).max(100),
    all_media_bound: z.literal(true), no_unqualified_ready_claims: z.literal(true),
    qualifications: z.array(z.object({ piece_id: Id, role: z.enum(['video', 'slide', 'document', 'manifest']), artifact: MediaRefSchema, receipt: MediaRefSchema }).strict()).max(250),
  }).strict(),
}).strict()
export function boardDeliveryProblems(input: unknown, manifest: unknown, keys = reviewerKeys(), now = Date.now()): string[] {
  const p = BoardDeliverySchema.safeParse(input)
  if (!p.success) return ['signed board delivery review required']
  const problems = signatureProblems(p.data, keys)
  if (p.data.payload.standard_sha256 !== MEDIA_STANDARD_HASH) problems.push('board review uses a stale standard')
  if (p.data.payload.manifest_sha256 !== mediaDigest(canonicalMediaJson(manifest))) problems.push('board review does not bind this exact HTML and asset manifest')
  if (Date.parse(p.data.payload.reviewed_at) > now + 60000) problems.push('board review timestamp is in the future')
  return problems
}

export function localReviewProblems(receiptPath: string, artifactPath: string, expected: { piece_id?: string; surface?: MediaBrief['surface'] } = {}): string[] {
  try {
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'))
    const sha256 = mediaDigest(readFileSync(artifactPath))
    const parsed = SignedMediaEnvelopeSchema.safeParse(receipt)
    if (!parsed.success) return ['signed independent review missing or malformed']
    const artifact = parsed.data.payload.artifacts.find(a => a.sha256 === sha256)
    if (!artifact) return ['review does not bind these artifact bytes']
    return mediaReviewProblems(receipt, { ...expected, stage: 'final', artifacts: [artifact] })
  } catch { return ['media quality receipt cannot be read'] }
}
