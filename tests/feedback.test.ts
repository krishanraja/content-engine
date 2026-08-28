import { describe, expect, it } from 'vitest'
import { diffArtifacts, inferRationale } from '@mindmake/core'

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
})
