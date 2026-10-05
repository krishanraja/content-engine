import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ArtDirectorRepertoireV1Schema,
  DeviceInventionProposalV1Schema,
  DeviceSelectionTraceV1Schema,
  ReferenceObservationV1Schema,
} from '@mindmake/contracts'
import {
  aggregateDeviceLearning,
  createDeviceUsageEvent,
  inferDevicePreference,
  loadArtDirectorRepertoire,
  resolveVisualRecipe,
  selectDevicesForBeat,
  validateShortDeviceSelections,
} from '@mindmake/core'

const baseContext = {
  traceId: 'trace-beat-one',
  beatId: 'beat-one',
  series: 'money_of_ai' as const,
  sourceMode: 'solo' as const,
  narrativeFunction: 'evidence',
  viewerTask: 'verify_claim',
  narrativeJob: 'prove' as const,
  treatmentLane: 'premium' as const,
  availableInputs: ['approved_asset', 'narrative_beats', 'approved_evidence', 'claim_link', 'protected_regions', 'focal_regions'],
  proofRequired: true,
}

describe('art director repertoire', () => {
  it('loads the single enriched registry and preserves the analysis-only reference boundary', async () => {
    const repertoire = await loadArtDirectorRepertoire(resolve('config/techniques.json'))
    expect(repertoire.version).toBe(2)
    expect(repertoire.techniques.map((device) => device.technique_id)).toEqual(expect.arrayContaining([
      'noun-to-proof-cut',
      'tracked-object-label',
      'progressive-value-reveal',
      'embodied-closing-action',
    ]))
    expect(repertoire.recipes.find((recipe) => recipe.recipe_id === 'evidence-walkthrough')?.device_sequence).toEqual([
      'noun-to-proof-cut',
      'guided-evidence-pan',
      'progressive-value-reveal',
      'stable-semantic-crop',
    ])
    const reference = repertoire.reference_observations[0]!
    expect(ReferenceObservationV1Schema.parse(reference).rights_role).toBe('analysis_only')
    expect(reference.prohibited_uses.join(' ')).toMatch(/Do not publish/)
  })

  it('keeps older pinned technique registries resumable through conservative defaults', async () => {
    const repertoire = await loadArtDirectorRepertoire(resolve('config/techniques.json'))
    const legacy = JSON.parse(JSON.stringify(repertoire))
    legacy.version = 1
    delete legacy.selection_policy
    delete legacy.recipes
    delete legacy.reference_observations
    legacy.techniques = legacy.techniques.slice(0, 2).map((device: Record<string, unknown>) => {
      const copy = { ...device }
      delete copy.narrative_jobs
      delete copy.eligibility
      delete copy.implementation_state
      delete copy.render_adapter
      delete copy.qa_checks
      return copy
    })
    const parsed = ArtDirectorRepertoireV1Schema.parse(legacy)
    expect(parsed.selection_policy.minimum_score).toBe(68)
    expect(parsed.techniques.every((device) => device.eligibility.series.length === 2)).toBe(true)
  })

  it('makes the same eligible choice every time and records rejected candidates', async () => {
    const repertoire = await loadArtDirectorRepertoire(resolve('config/techniques.json'))
    const first = selectDevicesForBeat(repertoire, baseContext)
    const second = selectDevicesForBeat(repertoire, baseContext)
    expect(second).toEqual(first)
    expect(first.selected_primary).not.toBeNull()
    expect(first.selected_support.length).toBeLessThanOrEqual(2)
    expect(validateShortDeviceSelections(repertoire, [first])).toEqual([])
    expect(first.candidates.some((candidate) => !candidate.eligible && candidate.hard_rejections.length)).toBe(true)
    const sorted = first.candidates.filter((candidate) => candidate.eligible).map((candidate) => candidate.score!.total)
    expect(sorted).toEqual([...sorted].sort((left, right) => right - left))
  })

  it('expands an eligible recipe into an executable ordered device sequence', async () => {
    const repertoire = await loadArtDirectorRepertoire(resolve('config/techniques.json'))
    const recipe = resolveVisualRecipe(repertoire, 'evidence-walkthrough', {
      series: 'built_with_ai',
      treatmentLane: 'premium',
      availableInputs: ['approved_asset', 'approved_evidence', 'claim_link', 'focal_regions', 'narrative_beats', 'verified_values', 'subject_tracks', 'shot_boundaries'],
    })
    expect(recipe.eligible).toBe(true)
    expect(recipe.steps.map((step) => step.technique_id)).toEqual([
      'noun-to-proof-cut',
      'guided-evidence-pan',
      'progressive-value-reveal',
      'stable-semantic-crop',
    ])
    const missingInputResolution = resolveVisualRecipe(repertoire, 'evidence-walkthrough', {
      series: 'built_with_ai',
      treatmentLane: 'premium',
      availableInputs: [],
    })
    expect(missingInputResolution.hard_rejections[0]).toContain('approved_evidence')
    expect(missingInputResolution.hard_rejections[0]).toContain('shot_boundaries')
    expect(resolveVisualRecipe(repertoire, 'evidence-walkthrough', {
      series: 'built_with_ai',
      treatmentLane: 'premium',
      availableInputs: ['approved_asset', 'approved_evidence', 'claim_link', 'focal_regions', 'narrative_beats', 'verified_values', 'subject_tracks', 'shot_boundaries'],
      recentUseCount: 4,
    }).hard_rejections).toContain('recurrence cap reached: 4 recent jobs')
  })

  it('uses a stable device ID to break score ties', async () => {
    const repertoire = await loadArtDirectorRepertoire(resolve('config/techniques.json'))
    const eligible = repertoire.techniques.find((device) => device.technique_id === 'stable-semantic-crop')!
    const twinA = { ...eligible, technique_id: 'tie-a', name: 'Tie A' }
    const twinB = { ...eligible, technique_id: 'tie-b', name: 'Tie B' }
    const tied = { ...repertoire, selection_policy: { ...repertoire.selection_policy, minimum_score: 1 }, techniques: [twinB, twinA], recipes: [] }
    const trace = selectDevicesForBeat(tied, {
      ...baseContext,
      narrativeJob: 'orient',
      narrativeFunction: 'context',
      viewerTask: 'orient',
      proofRequired: false,
      availableInputs: ['subject_tracks', 'shot_boundaries'],
    })
    expect(trace.selected_primary).toBe('tie-a')
  })

  it('rejects forged selections that did not clear the recorded threshold', async () => {
    const repertoire = await loadArtDirectorRepertoire(resolve('config/techniques.json'))
    const trace = selectDevicesForBeat(repertoire, baseContext)
    const rejected = trace.candidates.find((candidate) => !candidate.eligible)!
    expect(() => DeviceSelectionTraceV1Schema.parse({ ...trace, selected_primary: rejected.technique_id, selected_support: [] })).toThrow(/eligible candidates/)
  })

  it('opens only one governed invention proposal when no existing device can do the job', async () => {
    const repertoire = await loadArtDirectorRepertoire(resolve('config/techniques.json'))
    const trace = selectDevicesForBeat(repertoire, {
      ...baseContext,
      traceId: 'trace-invention',
      availableInputs: [],
      treatmentLane: 'experimental',
      inventionBrief: {
        name: 'Receipt constellation',
        mechanism: 'Arrange approved receipts around Krish only as their causal relationships are spoken, then collapse them into one verdict frame.',
      },
    })
    expect(trace.selected_primary).toBeNull()
    expect(trace.invention).toMatchObject({
      name: 'Receipt constellation',
      treatment_lane: 'experimental',
      requires_styleframes: true,
      requires_animatic: true,
      approval_state: 'proposed',
    })
    expect(validateShortDeviceSelections(repertoire, [trace])).toContain('invented devices cannot enter treatment before exact Krish approval')
    expect(() => DeviceInventionProposalV1Schema.parse({ ...trace.invention, approval_state: 'approved' })).toThrow(/Krish approval/)
  })

  it('keeps device feedback scoped and unable to activate itself', () => {
    const event = createDeviceUsageEvent({
      session_id: 'session-one',
      job_id: 'job-one',
      beat_id: 'beat-one',
      technique_id: 'guided-evidence-pan',
      technique_version: 1,
      action: 'replaced',
      replacement_technique_id: 'noun-to-proof-cut',
      reason: 'the full document made the first beat slower than the spoken claim',
      scope: { level: 'series', key: 'money_of_ai' },
      evidence_strength: 'strong',
      confirmation: 'confirmed',
      eventId: '9b8530c5-8c9d-4f70-9f66-e159f7db05f4',
      occurredAt: '2026-09-13T10:00:00.000Z',
    })
    expect(inferDevicePreference(event)).toMatchObject({ confidence: 0.86, activation_allowed: false })
    expect(inferDevicePreference(event).assertion).toContain('only for series money_of_ai')
  })

  it('promotes only repeated cross-job and cross-session patterns, never active rules', () => {
    const events = [
      ['11111111-1111-4111-8111-111111111111', 'session-one', 'job-one'],
      ['22222222-2222-4222-8222-222222222222', 'session-two', 'job-two'],
      ['33333333-3333-4333-8333-333333333333', 'session-three', 'job-two'],
    ].map(([eventId, sessionId, jobId], index) => createDeviceUsageEvent({
      session_id: sessionId!,
      job_id: jobId!,
      beat_id: `beat-${index + 1}`,
      technique_id: 'progressive-value-reveal',
      technique_version: 1,
      action: 'praised',
      reason: 'the staged reveal made the causal sequence easier to follow',
      scope: { level: 'series', key: 'built_with_ai' },
      evidence_strength: 'strong',
      confirmation: 'confirmed',
      eventId: eventId!,
      occurredAt: `2026-09-1${index + 1}T10:00:00.000Z`,
    }))
    expect(aggregateDeviceLearning(events)).toEqual([
      expect.objectContaining({
        lifecycle_state: 'eligible',
        independent_job_count: 2,
        independent_session_count: 3,
        requires_krish_approval: true,
        activation_allowed: false,
      }),
    ])
  })

  it('keeps conflicting device evidence observational', () => {
    const approved = createDeviceUsageEvent({
      session_id: 'session-one',
      job_id: 'job-one',
      beat_id: 'beat-one',
      technique_id: 'tracked-object-label',
      technique_version: 1,
      action: 'praised',
      scope: { level: 'mode', key: 'solo' },
      evidence_strength: 'strong',
      confirmation: 'confirmed',
      eventId: '44444444-4444-4444-8444-444444444444',
      occurredAt: '2026-09-13T10:00:00.000Z',
    })
    const rejected = createDeviceUsageEvent({
      session_id: 'session-two',
      job_id: 'job-two',
      beat_id: 'beat-two',
      technique_id: 'tracked-object-label',
      technique_version: 1,
      action: 'rejected',
      reason: 'the label competed with the evidence being shown',
      scope: { level: 'mode', key: 'solo' },
      evidence_strength: 'strong',
      confirmation: 'confirmed',
      eventId: '55555555-5555-4555-8555-555555555555',
      occurredAt: '2026-09-13T11:00:00.000Z',
    })
    expect(aggregateDeviceLearning([approved, rejected]).every((proposal) => proposal.lifecycle_state === 'observed')).toBe(true)
    expect(aggregateDeviceLearning([approved, rejected]).every((proposal) => proposal.counterexample_event_ids.length === 1)).toBe(true)
  })
})
