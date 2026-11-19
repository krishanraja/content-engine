import { describe, expect, it } from 'vitest'
import { lockupLayout } from './TitleLockup'

// Krish, 19 Nov 2026: "It should animate in and all be one feature, aligned properly. not a wordmark temporarily in the
// bottom right, disconnected from the title." The lockup is centred, fills the frame and carries the logo beneath it.
const said = 'Build or buy your tools in an AI world?'.split(' ').map((text, i) => ({ text, atFrame: i * 5 }))

describe('the full-frame title lockup', () => {
  for (const [w, h] of [[1920, 1080], [1080, 1920]] as const) {
    it(`is one centred unit with the logo under it at ${w}x${h}`, () => {
      const L = lockupLayout(said, w, h)
      expect(L.cut).toBe(3) // BUILD OR BUY on band one
      for (const g of L.glyphs) {
        expect(g.x).toBeGreaterThanOrEqual((w - L.bandW) / 2)
        expect(g.x + g.width).toBeLessThanOrEqual((w + L.bandW) / 2)
      }
      const band1 = L.glyphs.filter(g => g.index < L.cut)
      const mid = (band1[0]!.x + band1.at(-1)!.x + band1.at(-1)!.width) / 2
      expect(Math.abs(mid - w / 2)).toBeLessThan(2)
      expect(band1[0]!.size).toBeGreaterThanOrEqual((h > w ? w : h) * 0.12) // hero type, not a caption
      const bandBottom = L.bands[1]!.cy + L.bands[1]!.height / 2
      expect(L.logo.top).toBeGreaterThan(bandBottom)
      expect(L.logo.top).toBeLessThan(h * 0.9)
    })
  }
})
