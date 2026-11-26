import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { VIRTUAL_CAMERA_POLICY, baseCropForSource, maximumSafeZoom } from '@mindmake/core'

/** ve's impact zoom (config/ve/impact-zoom.json, scripts/velib/impact.py safe_zoom) never upscales his take past the
 *  virtual camera's quality floor: the same rule, the same numbers. tests/ve_impact_test.py holds the Python to the same
 *  table. Krish, 2026-11-26: "Zoom for impact ... classy and subtle rather than too aggressive". */
const config = JSON.parse(readFileSync('config/ve/impact-zoom.json', 'utf8'))

const CASES: Array<[number, number, number, number, number]> = [
  // source w, source h, output w, output h, the safe zoom before the virtual camera's 1 to 1.5 clamp
  [3840, 2160, 1080, 1920, 1.25],      // a 4K wide take cropped tall: room for 1.06, and for the strong 1.10
  [1920, 1080, 1080, 1920, 0.625],     // a 1080p wide take cropped tall: already upscaled, so no push at all
  [1920, 1080, 1920, 1080, 1.1111],    // a 1080p wide take on a wide cut: 1.05 fits, the strong push shrinks to 1.11
  [3840, 2160, 1920, 1080, 2.2222],
]

describe('impact zoom reads the virtual camera quality floor', () => {
  it('uses the virtual camera\'s quality floor', () => {
    expect(config.face.quality_floor).toBe(VIRTUAL_CAMERA_POLICY.qualityFloor)
    expect(config.scale.library_cap).toBe(VIRTUAL_CAMERA_POLICY.absoluteMaxZoom)
  })
  it('gets the same safe zoom as maximumSafeZoom for each case', () => {
    for (const [sw, sh, ow, oh, unclamped] of CASES) {
      const policy = { ...VIRTUAL_CAMERA_POLICY, outputWidth: ow, outputHeight: oh }
      const safe = maximumSafeZoom(baseCropForSource(sw, sh, ow, oh), sw, sh, policy)
      expect(safe).toBeCloseTo(Math.max(1, Math.min(policy.absoluteMaxZoom, unclamped)), 3)
    }
  })
})
