import { describe, expect, it } from 'vitest'
import { markClearance, slotsFor } from './index'
import { boxFor } from '../geometry'
import { FWP_PLACEMENTS } from '../mocks/face-with-proof'

describe('mark clearance', () => {
  for (const aspect of ['9:16', '16:9'] as const) {
    for (const layout of ['STAGE', 'SPLIT', 'P1', 'P3', 'P6', 'F1', 'F3'] as const) {
      if (layout === 'SPLIT' && aspect === '16:9') continue // no wide lock
      it(`${layout} ${aspect}`, () => {
        for (const box of slotsFor(layout, aspect, 3)) expect(markClearance(box, aspect)).toBe(0)
      })
    }
    it(`detects overlap and exact boundary in ${aspect}`, () => {
      const mark = boxFor('mark', aspect)
      expect(markClearance(mark, aspect)).toBeGreaterThan(0)
      const edge = { left: mark.left, top: mark.top + mark.height + 34, width: 100, height: 100 }
      expect(markClearance(edge, aspect)).toBe(0)
      expect(markClearance({ ...edge, top: edge.top - 1 }, aspect)).toBe(1)
    })
  }
  function walk(value: unknown, path: string): void {
    if (!value || typeof value !== 'object') return
    if ('left' in value && 'top' in value && 'width' in value && 'height' in value) {
      const place = value as { left: number; top: number; width: number; height: number; scale: number }
      it(path, () => expect(markClearance({ ...place, width: place.width * place.scale,
        height: place.height * place.scale }, '9:16')).toBe(0))
    } else for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`)
  }
  walk(FWP_PLACEMENTS, 'FWP_PLACEMENTS')
})
