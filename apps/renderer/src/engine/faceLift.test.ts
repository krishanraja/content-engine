import { describe, expect, it } from 'vitest'
import { FACE_LIFT, faceLift } from './FormatMaster'
import { overTake } from './BrandFrame'

describe('his face on a tall cut (Ruling, Krish, 2026-11-19: "Halo + frame me higher")', () => {
  it('frames the full-frame take higher on 9:16 only', () => {
    expect(faceLift('9:16', 0)).toBeCloseTo(FACE_LIFT)
    expect(faceLift('16:9', 0)).toBe(1)
  })
  it('eases the lift out as the take shrinks into its window, so the two meet without a jump', () => {
    expect(faceLift('9:16', 1)).toBe(1)
    expect(faceLift('9:16', 0.5)).toBeCloseTo(1 + (FACE_LIFT - 1) / 2)
  })
  it('a caption over his take wears the halo whatever its style', () => {
    expect(overTake({ plate: { source: 'take' } })).toBe(true)
    expect(overTake({ plate: { source: 'none' } })).toBe(false)
    expect(overTake(undefined)).toBe(false)
  })
})
