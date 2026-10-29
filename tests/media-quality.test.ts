import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { MEDIA_STANDARD, MEDIA_STANDARD_HASH, briefProblems, boardDeliveryProblems, canonicalMediaJson, mediaDigest, mediaReviewProblems, type MediaBrief, type MediaReview } from '../packages/core/src/media-quality.js'

const key = generateKeyPairSync('ed25519')
const keys = { independent: { public_key: key.publicKey.export({ type: 'spki', format: 'pem' }).toString(), reviewer_id: 'test-reviewer' } }
const hash = mediaDigest('synthetic fixture, never a production approval')
const ref = { path: '3 Posts/2026-10-26 Mon follow.the.money - Who gets paid/3 Video/fixture.json', sha256: hash }
const brief = (): MediaBrief => ({ schema_version: 1, standard_sha256: MEDIA_STANDARD_HASH, piece_id: 'different-topic', production_id: 'heat-pump-job', surface: 'video_voiceover', cut: 'short', producer_run_id: 'producer-A', subject: 'How a heat pump moves heat',
  assets: [{ id: 'house', sha256: hash, kind: 'piece', piece_id: 'different-topic', source: 'Synthetic test fixture', truth_role: 'illustration', relevance: 'Heat moving across the house boundary' }],
  units: [{ id: 'opening', takeaway: 'Heat is transferred into the house', visual_cues: ['House cross section and heat path'], asset_ids: ['house'], visible_words: ['OUTSIDE', 'INSIDE'], word_purpose: 'Identify spaces', motion_purpose: 'Transfer heat across boundary' }],
})
const review = (): MediaReview => ({ schema_version: 1, kind: 'media_quality', stage: 'final', standard_sha256: MEDIA_STANDARD_HASH, brief: brief(), reviewer_run_id: 'reviewer-B', reviewed_at: '2026-10-26T00:00:00.000Z',
  artifacts: [{ ...ref, id: 'short', role: 'video', content_type: 'video/mp4' }], evidence: [ref], proof_roles: ['opening', 'dense_explanation', 'transition_or_conclusion'].map(role => ({ role: role as MediaReview['proof_roles'][number]['role'], evidence_sha256: hash })), proof_receipt_sha256: hash,
  coverage: { unit_ids: ['opening'], artifact_sha256: [hash], continuous_playback: true, all_slides: false, audio_review: 'validated_audio_reviewer', comprehension_method: 'model_prediction', comprehension_evidence_sha256: hash },
  findings: [...MEDIA_STANDARD.criteria, ...MEDIA_STANDARD.video_criteria].map(criterion => ({ criterion, result: 'pass', observation: 'Synthetic passing observation for contract testing only', evidence_sha256: [hash] })),
})
const signed = (payload: unknown) => ({ key_id: 'independent', payload, signature: sign(null, Buffer.from(canonicalMediaJson(payload)), key.privateKey).toString('base64') })

describe('independent media qualification boundary', () => {
  it('accepts a complete authenticated fixture for exact piece, cut and bytes', () => {
    expect(mediaReviewProblems(signed(review()), { piece_id: 'different-topic', cut: 'short', stage: 'final', artifacts: [ref] }, keys)).toEqual([])
  })
  it('rejects producer-written pass, unknown keys and modified signed content', () => {
    expect(mediaReviewProblems({ status: 'pass' }, {}, keys).length).toBeGreaterThan(0)
    expect(mediaReviewProblems(signed(review()), {}, {})).toContain('trusted independent reviewer unavailable')
    const envelope = signed(review()); (envelope.payload as MediaReview).brief.subject = 'Changed'
    expect(mediaReviewProblems(envelope, {}, keys)).toContain('review signature invalid')
  })
  it('rejects wrong piece, cut, destination and changed bytes', () => {
    for (const expected of [{ piece_id: 'other' }, { production_id: 'other-job' }, { role: 'slide' as const, artifacts: [ref] }, { cut: 'long' as const }, { artifacts: [{ ...ref, sha256: 'f'.repeat(64) }] }, { artifacts: [{ ...ref, path: 'renamed-working-file.mp4' }] }]) {
      expect(mediaReviewProblems(signed(review()), expected, keys).length).toBeGreaterThan(0)
    }
  })
  it('does not average away a failed or uncertain minimum', () => {
    for (const result of ['fail', 'uncertain'] as const) {
      const p = review(); p.findings[0]!.result = result
      expect(mediaReviewProblems(signed(p), {}, keys)).toContain('a failed or uncertain minimum cannot be averaged away')
    }
  })
  it('fails closed for omitted evidence, missing proof and producer self-review', () => {
    const variants = [review(), review(), review(), review()]
    variants[0]!.findings.pop(); variants[1]!.proof_receipt_sha256 = null
    variants[2]!.reviewer_run_id = variants[2]!.brief.producer_run_id
    variants[3]!.coverage.audio_review = 'unavailable'
    for (const p of variants) expect(mediaReviewProblems(signed(p), {}, keys).length).toBeGreaterThan(0)
  })
  it('invalidates old policy, omitted scenes and incomplete playback', () => {
    const variants = [review(), review(), review()]
    variants[0]!.standard_sha256 = 'f'.repeat(64); variants[1]!.coverage.unit_ids = ['unrelated']; variants[2]!.coverage.continuous_playback = false
    for (const p of variants) expect(mediaReviewProblems(signed(p), {}, keys).length).toBeGreaterThan(0)
  })
  it('requires story-specific inputs and explanatory motion', () => {
    const b = brief(); b.assets[0]!.piece_id = 'previous-piece'
    expect(briefProblems(b)).toContain('house: previous-piece asset is not eligible')
    b.assets[0]!.piece_id = b.piece_id; b.units[0]!.motion_purpose = null
    expect(briefProblems(b)).toContain('opening: explanatory motion purpose missing')
  })
  it('rejects an evaluation example as a production asset', () => {
    const b = brief(); b.assets[0]!.sha256 = MEDIA_STANDARD.exemplars[0]!.sha256
    expect(briefProblems(b)).toContain('house: evaluation exemplar is not a production input')
  })
  it('rejects text-heavy video without imposing that budget on reading slides', () => {
    const b = brief(); b.units[0]!.visible_words = Array(17).fill('word')
    expect(briefProblems(b)).toContain('opening: visual word budget exceeded')
    b.surface = 'carousel'; b.cut = null
    expect(briefProblems(b)).toEqual([])
  })
  it('requires carousel-specific review of every slide', () => {
    const p = review(); p.brief.surface = 'carousel'; p.brief.cut = null
    p.artifacts[0]!.role = 'slide'; p.artifacts[0]!.content_type = 'image/png'
    p.coverage.audio_review = 'not_applicable'; p.coverage.all_slides = true
    p.findings = [...MEDIA_STANDARD.criteria, ...MEDIA_STANDARD.carousel_criteria].map(criterion => ({ criterion, result: 'pass', observation: 'Synthetic carousel fixture', evidence_sha256: [hash] }))
    expect(mediaReviewProblems(signed(p), { surface: 'carousel' }, keys)).toEqual([])
    p.coverage.all_slides = false
    expect(mediaReviewProblems(signed(p), {}, keys)).toContain('complete output review missing')
  })
  it('binds the complete board including an empty asset list, HTML and replay', () => {
    const manifest = { html: { sha256: hash }, assets: {} }
    expect(boardDeliveryProblems(undefined, manifest, keys)).toContain('signed board delivery review required')
    const p = { schema_version: 1, kind: 'board_delivery', standard_sha256: MEDIA_STANDARD_HASH, manifest_sha256: mediaDigest(canonicalMediaJson(manifest)), reviewer_run_id: 'delivery-check', reviewed_at: '2026-10-26T00:00:00.000Z', evidence: [ref], all_media_bound: true, no_unqualified_ready_claims: true, qualifications: [] }
    expect(boardDeliveryProblems(signed(p), manifest, keys)).toEqual([])
    expect(boardDeliveryProblems(signed(p), { ...manifest, html: { sha256: 'f'.repeat(64) } }, keys)).toContain('board review does not bind this exact HTML and asset manifest')
    expect(boardDeliveryProblems(signed(p), manifest, {})).toContain('trusted independent reviewer unavailable')
  })
})
