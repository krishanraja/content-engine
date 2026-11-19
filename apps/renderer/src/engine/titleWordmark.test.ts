import { describe, expect, it } from 'vitest'
import { titleWordmarkBox } from './FormatMaster'
import { titleLayout } from './title/TitleMoment'

// Krish, 19 Nov 2026: "As I think I've told you 400,000 times, the word mark needs to be aligned with the title."
describe('the title wordmark', () => {
  const words = 'where does AI get built when the residents of towns say no?'.split(' ').map((text, i) => ({ text, atFrame: i * 6 }))
  for (const [aspect, stage] of [['9:16', { left: 60, top: 290, width: 800, height: 1030 }], ['16:9', { left: 0, top: 0, width: 960, height: 1080 }]] as const) {
    it(`starts on the title's left edge and sits under its last line (${aspect})`, () => {
      const placed = titleLayout(words, stage, aspect)
      const box = titleWordmarkBox(words, stage, aspect, true, 0.12)!
      expect(box.left).toBe(Math.min(...placed.map((p) => p.x)))
      expect(box.top).toBeGreaterThan(Math.max(...placed.map((p) => p.y)))
      expect(box.top + box.height).toBeLessThanOrEqual(stage.top + stage.height)
    })
  }
})
