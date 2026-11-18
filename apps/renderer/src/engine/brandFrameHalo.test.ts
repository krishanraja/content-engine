import { describe, expect, it } from 'vitest'
import { CAPTION_HALO, onFullPlate } from './BrandFrame'
import type { EngineBeat, EngineRenderProps } from './props'

// The caption halo goes only where a busy photograph fills the frame behind the words (Wed 18, 18 Nov 2026): a full
// scene plate on a STAGE beat. His take (F1, SPLIT), a plate held to its slot and the cream stage keep the plain lift.
const props = {
  objects: [
    { obj: 'croc', device: 'scene_plate', params: { shots: [], camera: 'push' } },
    { obj: 'stare', device: 'scene_plate', params: { shots: [], camera: 'push', full: false } },
    { obj: 'card', device: 'evidence_card', params: {} },
  ],
} as unknown as EngineRenderProps
const beat = (layout: string, uses: string[]) => ({ id: 'b', layout, uses } as unknown as EngineBeat)

describe('the caption halo over a full scene plate', () => {
  it('is on for a full scene plate on a STAGE beat', () => {
    expect(onFullPlate(props, beat('STAGE', ['croc']))).toBe(true)
    expect(onFullPlate(props, beat('STAGE', ['card', 'croc']))).toBe(true)
  })
  it('is off on his take, on a plate held to its slot and on the stage of cards', () => {
    expect(onFullPlate(props, beat('F1', []))).toBe(false)
    expect(onFullPlate(props, beat('SPLIT', ['croc']))).toBe(false)
    expect(onFullPlate(props, beat('STAGE', ['stare']))).toBe(false)
    expect(onFullPlate(props, beat('STAGE', ['card']))).toBe(false)
  })
  it('hugs the letters: drop shadows only, no box and no floor', () => {
    expect(CAPTION_HALO).toMatch(/^drop-shadow\(/)
    expect(CAPTION_HALO).not.toMatch(/gradient|background/)
  })
})
