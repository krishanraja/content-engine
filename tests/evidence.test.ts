import { describe, expect, it } from 'vitest'
import type { OrchestratedEvidenceOverlayV1 } from '@mindmake/contracts'
import { validateEvidenceOrchestration } from '@mindmake/core'

function overlay(overrides: Partial<OrchestratedEvidenceOverlayV1> = {}): OrchestratedEvidenceOverlayV1 {
  return {
    overlay_id: 'proof',
    start_ms: 2_000,
    end_ms: 5_000,
    kind: 'screenshot',
    asset_path: 'proof.png',
    title: 'Publishers are taking control',
    source_label: 'Industry source',
    source_url: 'https://example.com/source',
    viewer_intent: 'verify_claim',
    presentation: 'evidence_cutaway',
    anchor: 'center',
    face_policy: 'intentional_substitution',
    placement: 'upper',
    fit: 'contain',
    attribution: 'Example source',
    rights_rationale: 'Brief transformative excerpt used to verify the spoken editorial claim.',
    approved: false,
    ...overrides,
  }
}

describe('evidence orchestration', () => {
  it('accepts deliberate proof cutaways that return to Krish for the ending', () => {
    expect(validateEvidenceOrchestration([overlay()], { durationMs: 8_000, endingReturnToPresenter: true })).toEqual([])
  })

  it('rejects accidental face coverage and evidence endings', () => {
    const issues = validateEvidenceOrchestration([
      overlay({ presentation: 'presenter_primary', anchor: 'center', face_policy: 'avoid', end_ms: 7_500 }),
    ], { durationMs: 8_000, endingReturnToPresenter: true })
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('corner anchor'),
      expect.stringContaining('final second must return to Krish'),
    ]))
  })

  it('rejects overlapping visual demands', () => {
    const issues = validateEvidenceOrchestration([
      overlay(),
      overlay({ overlay_id: 'second', start_ms: 4_500, end_ms: 6_500 }),
    ], { durationMs: 8_000, endingReturnToPresenter: true })
    expect(issues).toContain('second: evidence beats may not overlap')
  })
})
