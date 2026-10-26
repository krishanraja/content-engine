import { afterEach, describe, expect, it, vi } from 'vitest'
import { MEDIA_STANDARD_HASH } from '../packages/core/src/media-quality.js'
import { mediaQualityEnforced, mediaQualityRollout, parseMediaQualityRollout } from '../packages/core/src/media-rollout.js'

afterEach(() => vi.unstubAllEnvs())
const pending = { schema_version: 1, status: 'candidate_pending_calibration', standard_sha256: MEDIA_STANDARD_HASH, activation: null }
const evidence = { path: 'docs/plans/synthetic-test-evidence.json', sha256: 'a'.repeat(64) }
const passed = { verdict: 'passed', standard_sha256: MEDIA_STANDARD_HASH, evidence: [evidence] }
const activation = { approved_by: 'Krish', approved_at: '2026-10-26T00:00:00Z', repository_review: evidence, reviewer_key_ids: ['synthetic-fixture-reviewer'], calibration: passed, regression: passed, readiness: passed }

describe('repository-controlled media-quality rollout', () => {
  it('ships pending and cannot be activated by producer environment variables', () => {
    vi.stubEnv('MEDIA_QUALITY_ENFORCED', 'true')
    vi.stubEnv('MEDIA_QUALITY_ROLLOUT', 'active')
    vi.stubEnv('MEDIA_REVIEW_PUBLIC_KEYS', '{"producer":"not activation"}')
    expect(mediaQualityRollout()).toEqual(pending)
    expect(mediaQualityEnforced()).toBe(false)
  })
  it('accepts only a structurally complete reviewed activation bound to the current standard', () => {
    expect(parseMediaQualityRollout({ ...pending, status: 'active', activation }).status).toBe('active')
    for (const field of ['calibration', 'regression', 'readiness', 'repository_review', 'reviewer_key_ids'] as const) {
      const incomplete = { ...activation }; delete (incomplete as Record<string, unknown>)[field]
      expect(() => parseMediaQualityRollout({ ...pending, status: 'active', activation: incomplete })).toThrow(/Invalid media quality rollout/)
    }
  })
  it('fails closed on absent, malformed, stale, unreviewed or contradictory configuration', () => {
    for (const value of [undefined, {}, { ...pending, status: 'disabled' }, { ...pending, standard_sha256: 'b'.repeat(64) },
      { ...pending, activation }, { ...pending, status: 'active' }, { ...pending, request_override: true },
      { ...pending, status: 'active', activation: { ...activation, approved_by: 'producer' } },
      { ...pending, status: 'active', activation: { ...activation, reviewer_key_ids: ['same', 'same'] } },
      { ...pending, status: 'active', activation: { ...activation, calibration: { ...passed, verdict: 'failed' } } },
      { ...pending, status: 'active', activation: { ...activation, readiness: { ...passed, evidence: [] } } },
      { ...pending, status: 'active', activation: { ...activation, regression: { ...passed, standard_sha256: 'b'.repeat(64) } } },
      { ...pending, status: 'active', activation: { ...activation, repository_review: { ...evidence, path: 'docs/../secret' } } },
    ]) expect(() => parseMediaQualityRollout(value)).toThrow(/Invalid media quality rollout/)
  })
})
