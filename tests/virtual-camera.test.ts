import { describe, expect, it } from 'vitest'
import type { NarrativeBeatV1, SourceVisualAnalysisV1 } from '@mindmake/contracts'
import { solveVirtualCamera } from '@mindmake/core'

function analysis(overrides: Record<string, unknown> = {}): SourceVisualAnalysisV1 {
  return { schema_version: 1, analysis_id: 'analysis-1', job_id: 'job-1', source_bundle_hash: 'a'.repeat(64), coordinate_space: 'normalized_0_1', timebase: 'source_local_ms', generated_at: '2026-09-03T10:00:00.000Z', capabilities: { tier: 1, analyzers: {}, unavailable: [], fallbacks: [] }, sources: [{ source_id: 'camera-a', source_hash: 'b'.repeat(64), duration_ms: 2_000, width: 3_840, height: 2_160, fps: 30, audio_hz: 48_000, canonical_offset_ms: 0 }], shots: [{ shot_id: 'shot-1', source_id: 'camera-a', start_ms: 0, end_ms: 2_000, transition: 'hard_cut', confidence: 1 }], subjects: [], active_speakers: [], gestures: [], gaze: [], negative_space: [], protected_regions: [], sidecars: [], quality_issues: [], ...overrides } as unknown as SourceVisualAnalysisV1
}

function beat(overrides: Record<string, unknown> = {}): NarrativeBeatV1 {
  return { beat_id: 'beat-1', start_ms: 0, end_ms: 2_000, transcript: 'This is the point that changes the outcome.', source_spans: [{ source_id: 'camera-a', start_ms: 0, end_ms: 2_000 }], claim_ids: [], narrative_function: 'payoff', viewer_task: 'connect_with_speaker', emotional_function: 'reveal', visual_density: 'restraint', proof_dependency: 'none', primary_attention_target: { kind: 'presenter', target_id: 'krish-track' }, rationale: 'Keep attention on Krish while the implication lands.', ...overrides } as unknown as NarrativeBeatV1
}

const krishTrack = { track_id: 'krish-track', source_id: 'camera-a', role: 'krish', profile_id: 'krish-v1', start_ms: 0, end_ms: 2_000, face_keyframes: [{ at_ms: 0, bounds: { x: 0.4, y: 0.2, width: 0.14, height: 0.2 }, confidence: 0.96 }, { at_ms: 2_000, bounds: { x: 0.4, y: 0.2, width: 0.14, height: 0.2 }, confidence: 0.96 }], body_keyframes: [], hand_keyframes: [] }

describe('virtual camera solver', () => {
  it('uses a stable conservative fallback when no subject is reliable', () => {
    const solved = solveVirtualCamera({ analysis: analysis(), beat: beat(), sourceId: 'camera-a' })
    expect(solved.fallback_used).toBe(true)
    expect(solved.confidence).toBe(0)
    expect(solved.keyframes[0]?.crop).toEqual(solved.keyframes.at(-1)?.crop)
    expect(solved.keyframes.every((keyframe) => keyframe.zoom === 1)).toBe(true)
  })

  it('creates lead room in the direction of a reliable gesture', () => {
    const withoutGesture = solveVirtualCamera({ analysis: analysis({ subjects: [krishTrack] }), beat: beat(), sourceId: 'camera-a' })
    const withGesture = solveVirtualCamera({ analysis: analysis({ subjects: [krishTrack], gestures: [{ gesture_id: 'gesture-1', track_id: 'krish-track', start_ms: 0, end_ms: 2_000, hand: 'right', kind: 'point', direction: 'right', confidence: 0.95 }] }), beat: beat(), sourceId: 'camera-a' })
    expect(withGesture.fallback_used).toBe(false)
    expect(withGesture.lead_room).toBe('right')
    expect(withGesture.keyframes[0]!.crop.x).toBeGreaterThan(withoutGesture.keyframes[0]!.crop.x)
  })

  it('limits zoom according to source resolution', () => {
    const lowResolution = solveVirtualCamera({ analysis: analysis({ sources: [{ source_id: 'camera-a', source_hash: 'b'.repeat(64), duration_ms: 2_000, width: 1_080, height: 1_920, fps: 30, audio_hz: 48_000, canonical_offset_ms: 0 }], subjects: [krishTrack] }), beat: beat(), sourceId: 'camera-a', policy: { subjectZoom: 1.4, emphasisZoom: 1.4 } })
    const fourK = solveVirtualCamera({ analysis: analysis({ sources: [{ source_id: 'camera-a', source_hash: 'b'.repeat(64), duration_ms: 2_000, width: 2_160, height: 3_840, fps: 30, audio_hz: 48_000, canonical_offset_ms: 0 }], subjects: [krishTrack] }), beat: beat(), sourceId: 'camera-a', policy: { subjectZoom: 1.4, emphasisZoom: 1.4 } })
    expect(lowResolution.maximum_safe_zoom).toBeLessThan(fourK.maximum_safe_zoom)
    expect(lowResolution.keyframes.at(-1)!.zoom).toBeLessThan(fourK.keyframes.at(-1)!.zoom)
  })

  it('resets smoothing at a detected shot boundary', () => {
    const movingTrack = { ...krishTrack, face_keyframes: [{ at_ms: 0, bounds: { x: 0.12, y: 0.2, width: 0.14, height: 0.2 }, confidence: 0.96 }, { at_ms: 999, bounds: { x: 0.12, y: 0.2, width: 0.14, height: 0.2 }, confidence: 0.96 }, { at_ms: 1_000, bounds: { x: 0.74, y: 0.2, width: 0.14, height: 0.2 }, confidence: 0.96 }, { at_ms: 2_000, bounds: { x: 0.74, y: 0.2, width: 0.14, height: 0.2 }, confidence: 0.96 }] }
    const solved = solveVirtualCamera({ analysis: analysis({ subjects: [movingTrack], shots: [{ shot_id: 'shot-1', source_id: 'camera-a', start_ms: 0, end_ms: 1_000, transition: 'hard_cut', confidence: 1 }, { shot_id: 'shot-2', source_id: 'camera-a', start_ms: 1_000, end_ms: 2_000, transition: 'hard_cut', confidence: 1 }] }), beat: beat(), sourceId: 'camera-a' })
    const before = solved.keyframes.find((keyframe) => keyframe.at_ms === 750)!
    const after = solved.keyframes.find((keyframe) => keyframe.at_ms === 1_000)!
    expect(solved.reset_at_ms).toEqual([1_000])
    expect(Math.abs(after.crop.x - before.crop.x)).toBeGreaterThan(0.25)
  })
})
