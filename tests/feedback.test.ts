import { describe, expect, it } from 'vitest'
import { FeedbackEventV1Schema } from '@mindmake/contracts'
import { diffArtifacts, inferRationale, proposeRule } from '@mindmake/core'

describe('feedback inference', () => {
  it('detects exact structural edits and proposes a concise reason', () => {
    const deltas = diffArtifacts(
      { hook: 'A slow opening', captions: [{ text: 'everything is emphasised' }] },
      { hook: 'Proof first', captions: [{ text: 'selective emphasis' }] },
    )
    expect(deltas.map((delta) => delta.feature)).toContain('hook')
    const inferred = inferRationale(deltas)
    expect(inferred.rationale).toContain('opening')
    expect(inferred.confidence).toBeLessThan(1)
  })

  it('treats the user reason as authoritative', () => {
    const inferred = inferRationale([], 'The graphic competed with the proof.')
    expect(inferred).toEqual({ rationale: 'The graphic competed with the proof.', confidence: 1 })
  })

  it('diffs fields added by a new treatment without failing on missing values', () => {
    const deltas = diffArtifacts(
      { style: { caption_position: 'lower' } },
      { style: { caption_position: 'lower', caption_personality: 'kinetic' }, evidence_overlays: [{ overlay_id: 'proof-card' }] },
    )
    expect(deltas.map((delta) => delta.feature)).toEqual(expect.arrayContaining(['style.caption_personality', 'evidence_overlays[0].overlay_id']))
  })

  it('never promotes system diagnostics into taste memory', async () => {
    const event = FeedbackEventV1Schema.parse({
      schema_version: 1,
      feedback_id: 'system-diagnostic',
      job_id: 'job-1',
      artifact_id: 'artifact-1',
      stage: 'candidates',
      action: 'reject',
      origin: 'system',
      before_hash: 'before',
      delta_features: [],
      inferred_rationale: 'Transcript quality failed.',
      confidence: 1,
      scope: { level: 'job', key: 'job-1' },
      confirmation: 'confirmed',
      occurred_at: new Date().toISOString(),
    })
    await expect(proposeRule(event)).rejects.toThrow('cannot become taste preferences')
  })
})
