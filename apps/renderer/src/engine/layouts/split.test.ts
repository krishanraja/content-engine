import { describe, expect, it } from 'vitest'
import { VeLayoutSchema } from '../../../../../packages/contracts/src/production-spec'
import { EngineBeatSchema, type EngineRenderProps } from '../props'
import { slotsFor, splitCameraBox, splitObjectPosition } from './index'
import { FWP_SPLIT_SEAM_Y, FWP_STAGE_SCALE, FWP_SPLIT_CAPTION_ZONE, FWP_POSTER_POSITIONS } from '../mocks/face-with-proof'
import { BeatCaptionTrack } from '../BrandFrame'
import { boxFor } from '../geometry'
import { readFileSync } from 'node:fs'

const beat = EngineBeatSchema.parse({ id: 'proof', role: 'anchor', layout: 'SPLIT', fromFrame: 0, toFrame: 90, uses: [], transitionOut: 'cut', plate: { crop: '50% 88%' } })
const props = { aspect: '9:16', beats: [beat], tokens: {}, captions: [{ fromFrame: 0, toFrame: 90, words: [{ text: 'Hello', atFrame: 0 }], swipeIndex: null }] } as unknown as EngineRenderProps

describe('frozen SPLIT layout', () => {
  it('accepts SPLIT in both schemas and refuses unknown layouts', () => {
    expect(VeLayoutSchema.parse('SPLIT')).toBe('SPLIT')
    expect(VeLayoutSchema.safeParse('unknown').success).toBe(false)
    expect(EngineBeatSchema.safeParse({ ...beat, layout: 'unknown' }).success).toBe(false)
  })
  it('fills the stage with independent boxes and refuses wide even with no devices', () => {
    const stage = { left: 0, top: 0, width: 1080, height: FWP_SPLIT_SEAM_Y }
    const slots = slotsFor('SPLIT', '9:16', 3)
    expect(slots).toEqual([stage, stage, stage])
    slots[0]!.top = 10
    expect(slots[1]).toEqual(stage)
    expect(slotsFor('SPLIT', '9:16', 0)).toEqual([])
    expect(() => slotsFor('SPLIT', '16:9', 0)).toThrow(/no wide design lock/)
    expect(() => splitCameraBox('16:9')).toThrow(/9:16/)
  })
  it('places the camera below the seam and resolves CSS crops', () => {
    expect(splitCameraBox('9:16')).toEqual({ left: 0, top: FWP_SPLIT_SEAM_Y, width: 1080, height: 1920 - FWP_SPLIT_SEAM_Y })
    expect(splitObjectPosition(beat.plate?.crop)).toBe('50% 88%')
    expect(splitObjectPosition('tight')).toBe(FWP_POSTER_POSITIONS.proof)
    expect(splitObjectPosition()).toBe(FWP_POSTER_POSITIONS.proof)
  })
  it('keeps one- and two-line captions within the split zone, away from the eyes', () => {
    for (const text of ['Hello', 'One two three four five six']) {
      const local = { ...props, captions: [{ ...props.captions[0]!, words: text.split(' ').map((text) => ({ text, atFrame: 0 })) }] }
      const caption = BeatCaptionTrack({ props: local, beat, frame: 0 })!
      const style = caption.props.style
      expect(style.left).toBe(FWP_SPLIT_CAPTION_ZONE.left)
      expect(style.top).toBe(FWP_SPLIT_CAPTION_ZONE.top)
      expect(style.width).toBe(FWP_SPLIT_CAPTION_ZONE.width)
      expect(Number(style.top) + Number(style.height)).toBeLessThanOrEqual(FWP_SPLIT_CAPTION_ZONE.top + FWP_SPLIT_CAPTION_ZONE.height)
      expect(style.top).toBeGreaterThanOrEqual(1260)
    }
    const normal = BeatCaptionTrack({ props, beat: { ...beat, layout: 'P1' }, frame: 0 })!
    expect(normal.props.style.top).toBe(boxFor('caption', '9:16').top)
    expect(normal.props.style.width).toBe(boxFor('caption', '9:16').width)
  })
  it('uses the frozen scale once on a wrapper and keeps chrome outside it', () => {
    const master = readFileSync('apps/renderer/src/engine/FormatMaster.tsx', 'utf8')
    expect(FWP_STAGE_SCALE).toBeGreaterThan(0)
    expect(master.match(/scale\(\$\{FWP_STAGE_SCALE\}\)/g)).toHaveLength(1)
    expect(master).toContain("transformOrigin: 'top center'")
    expect(master).toContain('splitCameraBox(props.aspect)')
    expect(master).toContain('splitObjectPosition(activeBeat?.plate?.crop)')
  })
})
