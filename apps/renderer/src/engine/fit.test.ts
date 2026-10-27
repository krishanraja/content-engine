import { describe, expect, it } from 'vitest'
import { fitScale } from './fit'

describe('fitScale', () => {
  it.each([
    [{ width: 200, height: 100 }, { left: 0, top: 0, width: 100, height: 25 }, 0.25],
    [{ width: 200, height: 100 }, { left: 0, top: 0, width: 400, height: 200 }, 1],
    [{ width: 200, height: 100 }, { left: 50, top: 20, width: 400, height: 50 }, 0.5],
  ])('fits without enlargement', (natural, box, expected) => expect(fitScale(natural, box)).toBe(expected))
})
