import { describe, expect, it } from 'vitest'
import { createShotBoundaries } from '@mindmake/core'

describe('source analysis timeline helpers', () => {
  it('creates deterministic complete shot intervals and ignores invalid cuts', () => {
    expect(createShotBoundaries('camera-main', 10_000, [5_000, 5_000, 0, 12_000, 2_000])).toEqual([
      { shot_id: 'camera-main-shot-1', source_id: 'camera-main', start_ms: 0, end_ms: 2_000, transition: 'source_start', confidence: 1 },
      { shot_id: 'camera-main-shot-2', source_id: 'camera-main', start_ms: 2_000, end_ms: 5_000, transition: 'hard_cut', confidence: 0.85 },
      { shot_id: 'camera-main-shot-3', source_id: 'camera-main', start_ms: 5_000, end_ms: 10_000, transition: 'hard_cut', confidence: 0.85 },
    ])
  })
})
