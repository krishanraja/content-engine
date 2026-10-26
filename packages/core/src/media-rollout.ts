import { z } from 'zod'
import rollout from '../../../config/media-quality-rollout.json' with { type: 'json' }
import { MEDIA_STANDARD_HASH } from './media-quality.js'

const Sha = z.string().regex(/^[a-f0-9]{64}$/)
const Evidence = z.object({
  path: z.string().regex(/^docs\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/).refine(path => !path.split('/').some(part => part === '.' || part === '..')),
  sha256: Sha,
}).strict()
const PassedEvidence = z.object({ verdict: z.literal('passed'), standard_sha256: z.literal(MEDIA_STANDARD_HASH), evidence: z.array(Evidence).min(1).max(50) }).strict()
const Activation = z.object({
  approved_by: z.literal('Krish'), approved_at: z.string().datetime(),
  repository_review: Evidence,
  reviewer_key_ids: z.array(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/)).min(1).max(50)
    .refine(keys => new Set(keys).size === keys.length, 'reviewer key IDs must be distinct'),
  calibration: PassedEvidence, regression: PassedEvidence, readiness: PassedEvidence,
}).strict()
const Rollout = z.discriminatedUnion('status', [
  z.object({ schema_version: z.literal(1), status: z.literal('candidate_pending_calibration'), standard_sha256: z.literal(MEDIA_STANDARD_HASH), activation: z.null() }).strict(),
  z.object({ schema_version: z.literal(1), status: z.literal('active'), standard_sha256: z.literal(MEDIA_STANDARD_HASH), activation: Activation }).strict(),
])

/** Repository-reviewed activation only. This validates the recorded authority and
 * evidence bindings; it does not manufacture calibration or verify report contents.
 * Actual review and provisioning must precede the later activation change. */
export function parseMediaQualityRollout(value: unknown) {
  const parsed = Rollout.safeParse(value)
  if (!parsed.success) throw new Error('Invalid media quality rollout configuration; reviewed activation evidence for the current standard is required')
  return parsed.data
}

/** Never infer activation from producer inputs, environment variables or key presence. */
export function mediaQualityRollout() { return parseMediaQualityRollout(rollout) }
export function mediaQualityEnforced(): boolean { return mediaQualityRollout().status === 'active' }
