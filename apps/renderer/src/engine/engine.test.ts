import { z } from 'zod'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Audio, Composition, OffthreadVideo, Sequence } from 'remotion'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../../fixtures/ve/engine-core/props.json'
import { FormatMaster } from './FormatMaster'
import { VeCut } from './VeCut'
import { RemotionRoot } from '../Root'
import { BrandFrame } from './BrandFrame'
import { EngineAudio } from './audio'
import { HOUSE_MOTION, MOTION, useEngineFrame } from './clock'
import { DEVICES } from './devices/registry'
import { chromeZone } from './geometry'
import { CallCard } from './chrome/CallCard'
import { EndingBand } from './chrome/EndingBand'
import { CaptionTrack } from './chrome/CaptionTrack'
import { ChannelPill } from './chrome/ChannelPill'
import { MarkTile } from './chrome/MarkTile'
import { StageHeader } from './chrome/StageHeader'
import { slotsFor } from './layouts'
import { MOTION_PROFILES } from './kit/motionProfiles'
import { EngineRenderPropsSchema, type EngineBeat, type EngineRenderProps } from './props'

vi.mock('./clock', async (importOriginal) => ({ ...await importOriginal<typeof import('./clock')>(), useEngineFrame: vi.fn(() => 75) }))
vi.mock('./devices/registry', () => ({ DEVICES: { 'fixture-device': () => null } }))

// Inspect element descriptions only: no React renderer or media decoding.
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

const layouts: Exclude<EngineBeat['layout'], 'STAGE' | 'SPLIT' | 'WINDOW'>[] = ['P1', 'P3', 'P6', 'F1', 'F3']
const aspects: EngineRenderProps['aspect'][] = ['9:16', '16:9']

describe('ve layouts', () => {
  for (const aspect of aspects) {
    for (const layout of layouts) {
      it(`${layout} stays inside ${aspect} content safe bounds`, () => {
        // Tall: key content in every channel's safe column (config/channel-safe-zones.json): X 60-860, clear of the
        // action rail from X 880, from Y 270 under the top bar, ending by Y 1050 so the caption block (top 1060) is
        // never covered. Wide: title-safe.
        const slots = slotsFor(layout, aspect)
        expect(slots).toHaveLength({ P1: 2, P3: 3, P6: 2, F1: 3, F3: 2 }[layout])
        for (const box of slots) {
          expect(box.width).toBeGreaterThan(0)
          expect(box.height).toBeGreaterThan(0)
          const zone = chromeZone(aspect)
          expect(box.left >= zone.left + zone.width || box.left + box.width <= zone.left
            || box.top >= zone.top + zone.height || box.top + box.height <= zone.top).toBe(true)
          const right = box.left + box.width
          const bottom = box.top + box.height
          if (aspect === '9:16') {
            expect(box.left).toBeGreaterThanOrEqual(60)
            expect(box.top).toBeGreaterThanOrEqual(270)
            expect(right).toBeLessThanOrEqual(860)
            expect(bottom).toBeLessThanOrEqual(1050)
          } else {
            expect(box.left).toBeGreaterThanOrEqual(96)
            expect(box.top).toBeGreaterThanOrEqual(54)
            expect(right).toBeLessThanOrEqual(1824)
            expect(bottom).toBeLessThanOrEqual(780) // above the wide caption band
          }
        }
      })
    }

    it(`P3 has a 60/40 split and P6 has a 40-45% card in ${aspect}`, () => {
      const [graphic, plate] = slotsFor('P3', aspect)
      if (!graphic || !plate) throw new Error('missing P3 slots')
      const graphicSize = aspect === '9:16' ? graphic.height : graphic.width
      const plateSize = aspect === '9:16' ? plate.height : plate.width
      expect(graphicSize / plateSize).toBeCloseTo(1.5)
      if (aspect === '9:16') expect(graphic.top + graphic.height).toBeLessThan(plate.top)
      else expect(graphic.left + graphic.width).toBeLessThan(plate.left)
      const card = slotsFor('P6', aspect)[1]!
      const fraction = card.width / (aspect === '9:16' ? 1080 : 1920)
      expect(fraction).toBeGreaterThanOrEqual(0.4)
      expect(fraction).toBeLessThanOrEqual(0.45)
    })
  }

  it('returns independent slot boxes', () => {
    slotsFor('P1', '9:16')[0]!.left = 0
    expect(slotsFor('P1', '9:16')[0]!.left).toBe(60)
  })

  // Krish, 2026-11-11: "all vertical video templates should be adjusted to make maximum use of the full screen, as
  // opposed to the current situation where a third of the screen at the top is now cut off". Every tall layout's key
  // content starts just under the channels' top bar, never lower than y 340.
  it('uses the top of the tall screen: every layout starts its content between y 270 and 340', () => {
    for (const layout of layouts) {
      const top = Math.min(...slotsFor(layout, '9:16').map((box) => box.top))
      expect(top, layout).toBeGreaterThanOrEqual(270)
      expect(top, layout).toBeLessThanOrEqual(340)
    }
  })
})

describe('ve composition', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses the minimal two-beat voiceover fixture', () => {
    const props = EngineRenderPropsSchema.parse(fixture)
    expect(props.beats).toHaveLength(2)
    expect(props.segments).toEqual([])
    expect(props.beats.at(-1)?.toFrame).toBe(props.durationFrames)
  })

  it.each(['missing-device', 'toString'])('throws on unknown device %s', (device) => {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.objects = [{ obj: 'proof', device, meaning: 'Test proof', variants: {}, params: {}, fromFrame: 0, toFrame: 120 }]
    // The mocked clock reads frame 75, inside the second beat: the beat being drawn is the one that must refuse.
    props.beats[1]!.uses = ['proof']
    expect(() => FormatMaster(props)).toThrow(`ve: no device ${device}`)
  })

  it('uses one global clock, preserves slot order, and overlays brand after devices', () => {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.objects = ['first', 'second'].map((obj) => ({ obj, device: 'fixture-device', meaning: obj, variants: {}, params: {}, fromFrame: 0, toFrame: 120 }))
    props.beats[1]!.layout = 'P6'
    props.beats[1]!.uses = ['second', 'first']
    const tree = FormatMaster(props)
    const nodes = elements(tree)
    expect(useEngineFrame).toHaveBeenCalledTimes(1)
    expect(tree.props.style.backgroundColor).toBe(props.tokens.ink)
    const devices = nodes.filter((node) => node.type === DEVICES['fixture-device'])
    expect(devices.map((node) => node.props.object)).toEqual([props.objects[1], props.objects[0]])
    expect(devices.map((node) => node.props.box)).toEqual(slotsFor('P6', props.aspect))
    expect(devices.map((node) => node.props.frame)).toEqual([75, 75])
    // Only the beat active at this frame is mounted, with no time offset, so media nested in a device share the
    // global clock (a beat-offset Sequence once pushed the evidence recording past the end of the cut).
    const brands = nodes.filter((node) => node.type === BrandFrame)
    expect(brands).toHaveLength(1)
    expect((brands[0]!.props.beat as EngineBeat).id).toBe(props.beats[1]!.id)
    expect(brands[0]!.props.frame).toBe(75)
    expect(nodes.indexOf(brands[0]!)).toBeGreaterThan(nodes.indexOf(devices[1]!))
    expect(nodes.at(-1)?.type).toBe(EngineAudio)
    expect(nodes.some((node) => (node.props.style as { clipPath?: string } | undefined)?.clipPath?.endsWith('round 40px)'))).toBe(true)
    expect(nodes.filter((node) => node.type === Sequence)).toHaveLength(0)
  })

  it('preserves picture source offsets, placement and crop while muting source audio', () => {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.segments = [{ src: 'take.mp4', trimBeforeFrames: 90, fromFrame: 30, durationFrames: 45, crop: { x: -20, y: 15, scale: 1.2 } }]
    const nodes = elements(FormatMaster(props))
    const segment = nodes.find((node) => node.type === Sequence)!
    expect(segment.props.from).toBe(30)
    expect(segment.props.durationInFrames).toBe(45)
    const video = nodes.find((node) => node.type === OffthreadVideo)!
    expect(video.props).toMatchObject({ src: 'take.mp4', trimBefore: 90, muted: true })
    expect(video.props.style).toMatchObject({ objectFit: 'cover', transform: 'translate(-20px, 15px) scale(1.2)' })
  })

  it('places the trimmed stem at zero and converts SFX dB to linear volume', () => {
    const audio = { stem: { src: 'stem.wav', trimBeforeFrames: 12 }, sfx: [{ src: 'hit.wav', atFrame: 48, gainDb: -6 }] }
    const nodes = elements(EngineAudio({ audio }))
    const tracks = nodes.filter((node) => node.type === Audio)
    expect(tracks[0]!.props).toMatchObject({ src: 'stem.wav', trimBefore: 12 })
    expect(nodes.find((node) => node.type === Sequence)?.props.from).toBe(48)
    expect(tracks[1]!.props.src).toBe('hit.wav')
    expect(tracks[1]!.props.volume).toBeCloseTo(10 ** (-6 / 20))
    // stem={false}: the stem is the wrapper's (VeCut, under the sting); the sfx stay, on their own frames.
    const quiet = elements(EngineAudio({ audio, stem: false }))
    expect(quiet.filter((node) => node.type === Audio).map((node) => node.props.src)).toEqual(['hit.wav'])
    expect(quiet.find((node) => node.type === Sequence)?.props.from).toBe(48)
    const master = EngineRenderPropsSchema.parse(fixture)
    expect(elements(FormatMaster(master)).at(-1)?.props.stem).toBe(true)
    expect(elements(FormatMaster({ ...master, stem: false })).at(-1)?.props.stem).toBe(false)
  })
})

describe('BrandFrame call and ending routing', () => {
  it.each(['9:16', '16:9'] as const)('routes cards and suppresses captions in %s', (aspect) => {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.aspect = aspect
    const beat = { ...props.beats[0]!, role: 'call' as const, fromFrame: 0, toFrame: 120 }
    props.beats = [beat]
    props.call = { statement: 'A checked call.', due: '2026-12-31', confidencePercent: 90 }
    props.ending = { fromFrame: 90, url: 'makeyourmindup.ai', ticker: true }
    for (const [frame, card] of [[30, CallCard], [90, EndingBand], [100, EndingBand]] as const) {
      const nodes = elements(BrandFrame({ props, beat, frame }))
      expect(nodes.filter((node) => node.type === card)).toHaveLength(1)
      expect(nodes.filter((node) => node.type === CaptionTrack)).toHaveLength(0)
      expect(CaptionTrack({ props, frame })).toBeNull()
    }
    const normal = { ...beat, role: 'anchor' as const }
    expect(elements(BrandFrame({ props, beat: normal, frame: 89 })).some((node) => node.type === CaptionTrack)).toBe(true)
    expect(elements(BrandFrame({ props, beat: normal, frame: 90 })).some((node) => node.type === EndingBand)).toBe(true)
    delete props.call
    expect(() => BrandFrame({ props, beat, frame: 30 })).toThrow('ve: call beat without props.call')
  })
})

describe('the hook is the intro', () => {
  // Under test (Krish, 29 Oct 2026: "Let's go with number one for now."): the first frame is the hook in the brand's
  // dress, the logo and the series tag in its corners from the start, with no story card or logo sting before it.
  it.each(aspects)('opens on the hook at frame 0 in %s: the wide cut with its logo and series tag, the tall one with neither', (aspect) => {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.aspect = aspect
    expect(props.beats[0]).toMatchObject({ fromFrame: 0, sectionBeat: true })
    vi.mocked(useEngineFrame).mockReturnValueOnce(0)
    const brands = elements(FormatMaster(props)).filter((node) => node.type === BrandFrame)
    expect(brands.map((node) => (node.props.beat as EngineBeat).id)).toEqual([props.beats[0]!.id])
    for (const layout of ['STAGE', 'P1', 'P3', 'P6', 'F3'] as const) {
      const beat = { ...props.beats[0]!, layout }
      const nodes = elements(BrandFrame({ props, beat, frame: 0 }))
      if (aspect === '9:16') {
        // Vertical video carries no wordmark, mark tile or series pill (Ruling, Krish, 2026-11-11).
        expect(nodes.filter((node) => node.type === StageHeader || node.type === MarkTile || node.type === ChannelPill)).toHaveLength(0)
      } else if (layout === 'STAGE') {
        expect(nodes.filter((node) => node.type === StageHeader)).toHaveLength(1)
      } else {
        expect(nodes.filter((node) => node.type === MarkTile)).toHaveLength(1)
        expect(ChannelPill({ props, beat })).not.toBeNull()
      }
    }
  })
})

describe('vertical video carries no wordmark (Ruling, Krish, 2026-11-11)', () => {
  it('draws no mark tile, series pill or header on any 9:16 beat, of any format or layout', () => {
    const base = { ...EngineRenderPropsSchema.parse(fixture), aspect: '9:16' as const }
    for (const format of ['face-with-proof', 'two-passports'] as const) {
      const props = { ...base, format }
      for (const layout of ['STAGE', 'P1', 'P3', 'P6', 'F1', 'F3', 'SPLIT', 'WINDOW'] as const) {
        const beat = { ...props.beats[0]!, layout, plate: { source: 'none' as const } }
        const nodes = elements(BrandFrame({ props, beat, frame: 0 }))
        expect(nodes.filter((node) => node.type === StageHeader || node.type === MarkTile || node.type === ChannelPill)).toHaveLength(0)
      }
    }
  })

  it('keeps the brand on the closing outro card (Krish, 2026-11-11: "not the closing outro card")', () => {
    const props = EngineRenderPropsSchema.parse({ ...fixture, aspect: '9:16', ending: { fromFrame: 90, url: 'makeyourmindup.ai' } })
    const nodes = elements(BrandFrame({ props, beat: props.beats[0]!, frame: 100 }))
    const band = nodes.find((node) => node.type === EndingBand)
    expect(band).toBeTruthy()
    expect(JSON.stringify(elements(EndingBand({ props, frame: 100 }) as ReactElement).map((n) => (n.props as { image?: { src?: string } }).image?.src ?? null))).toContain(props.brand.stacked.src)
  })
})

describe('face-with-proof wears one brand treatment', () => {
  // Krish, 2026-11-03: "The branding is wrong". Its STAGE graphics sit on the light wash of its SPLIT stage, with the
  // same mark tile and pill; the held title shows over a STAGE beat on the take, never over one with no plate.
  it('draws the mark tile, never the ink header, on a face-with-proof STAGE beat on the wide cut', () => {
    const props = { ...EngineRenderPropsSchema.parse(fixture), format: 'face-with-proof' as const, aspect: '16:9' as const }
    const graphics = { ...props.beats[0]!, layout: 'STAGE' as const, plate: { source: 'none' as const } }
    const nodes = elements(BrandFrame({ props, beat: graphics, frame: 0 }))
    expect(nodes.filter((node) => node.type === MarkTile)).toHaveLength(1)
    expect(nodes.filter((node) => node.type === StageHeader)).toHaveLength(0)
    const other = { ...props, format: 'two-passports' as const }
    expect(elements(BrandFrame({ props: other, beat: graphics, frame: 0 })).filter((node) => node.type === StageHeader)).toHaveLength(1)
  })
})

describe('STAGE render props', () => {
  it('accepts STAGE, both approved formats and optional keyFrame', () => {
    for (const format of ['two-passports', 'hand-held-screen']) {
      const props = structuredClone(fixture)
      props.format = format
      props.beats[0]!.layout = 'STAGE'
      expect(EngineRenderPropsSchema.safeParse(props).success).toBe(true)
      expect(EngineRenderPropsSchema.safeParse({ ...props, beats: [{ ...props.beats[0], keyFrame: 24 }] }).success).toBe(true)
      for (const keyFrame of [-1, 1.5]) {
        expect(EngineRenderPropsSchema.safeParse({ ...props, beats: [{ ...props.beats[0], keyFrame }] }).success).toBe(false)
      }
      expect(EngineRenderPropsSchema.safeParse({ ...props, beats: [{ ...props.beats[0], unknown: true }] }).success).toBe(false)
    }
    expect(EngineRenderPropsSchema.safeParse({ ...fixture, format: 'unknown' }).success).toBe(false)
  })

  it('gives three devices full-canvas boxes and clips', () => {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.objects = ['a', 'b', 'c'].map((obj) => ({ obj, device: 'fixture-device', meaning: obj, variants: {}, params: {}, fromFrame: 0, toFrame: 120 }))
    props.beats[1]!.layout = 'STAGE'
    props.beats[1]!.uses = ['a', 'b', 'c']
    const nodes = elements(FormatMaster(props))
    const devices = nodes.filter((node) => node.type === DEVICES['fixture-device'])
    expect(devices.map((node) => node.props.box)).toEqual(slotsFor('STAGE', props.aspect, 3))
    const clips = nodes.filter((node) => (node.props.style as { clipPath?: string } | undefined)?.clipPath)
    expect(clips).toHaveLength(3)
    for (const clip of clips) expect(clip.props.style).toEqual({ clipPath: 'inset(0px 0px 0px 0px)' })
  })
})

describe('SPLIT object placement', () => {
  const place = { left: 72, top: 230, width: 345, height: 68, scale: 2.4 }
  function placedProps(layout: EngineBeat['layout'] = 'SPLIT') {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.aspect = '9:16'
    props.objects = [{ obj: 'slab', device: 'fixture-device', meaning: 'slab', variants: {}, params: { main: 'Answer', place }, fromFrame: 0, toFrame: 120 }]
    props.beats[1]!.layout = layout
    props.beats[1]!.uses = ['slab']
    return props
  }
  it('strips place before strict parsing and gives the device a local box inside its transformed wrapper', () => {
    const props = placedProps()
    const nodes = elements(FormatMaster(props))
    const device = nodes.find(n => n.type === DEVICES['fixture-device'])!
    const object = device.props.object as EngineRenderProps['objects'][number]
    expect(z.object({ main: z.string() }).strict().parse(object.params)).toEqual({ main: 'Answer' })
    expect(device.props.box).toEqual({ left: 0, top: 0, width: 345, height: 68 })
    const wrapper = nodes.find(n => n.props.children === device)!
    expect(wrapper.props.style).toEqual({ left: 72, top: 230, width: 345, height: 68, transform: 'scale(2.4)', transformOrigin: 'top left' })
    expect(props.objects[0]!.params.place).toEqual(place)
  })
  it('preserves the whole stage and original object when unplaced', () => {
    const props = placedProps()
    delete props.objects[0]!.params.place
    const device = elements(FormatMaster(props)).find(n => n.type === DEVICES['fixture-device'])!
    expect(device.props.object).toBe(props.objects[0])
    expect(device.props.box).toEqual(slotsFor('SPLIT', '9:16')[0])
  })
  it('refuses placement on P1 naming the object', () => {
    expect(() => FormatMaster(placedProps('P1'))).toThrow('ve: place on non-SPLIT object slab')
  })
})

describe('motion styles in the composition', () => {
  // The mocked clock reads frame 75: fifteen frames into the second beat (60 to 120).
  function staged(motion?: EngineRenderProps['motion']) {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.objects = ['first', 'second'].map((obj) => ({ obj, device: 'fixture-device', meaning: obj, variants: {}, params: {}, fromFrame: 0, toFrame: 120 }))
    props.beats[1]!.layout = 'STAGE'
    props.beats[1]!.plate = { source: 'none' }
    props.beats[1]!.uses = ['first', 'second']
    if (motion) props.motion = motion
    return props
  }
  // What the composition draws, as data: element type, style and the frame each device was given.
  const drawn = (props: EngineRenderProps) => elements(FormatMaster(props)).map((node) => [
    typeof node.type === 'string' ? node.type : (node.type as { name?: string }).name,
    JSON.stringify(node.props.style ?? null), node.props.frame ?? null])

  it('parses props with and without a motion style', () => {
    expect(EngineRenderPropsSchema.safeParse(fixture).success).toBe(true)
    expect(EngineRenderPropsSchema.safeParse({ ...fixture, motion: { style: 'dark-keynote' } }).success).toBe(true)
    expect(EngineRenderPropsSchema.safeParse({ ...fixture, motion: { style: 'toy-3d' } }).success).toBe(true)
    const withProfile = { ...fixture, motion: { style: 'x', profile: { ...MOTION_PROFILES['riso-halftone'] } } }
    expect(EngineRenderPropsSchema.safeParse(withProfile).success).toBe(true)
    expect(EngineRenderPropsSchema.safeParse({ ...fixture, motion: { style: 'x', extra: 1 } }).success).toBe(false)
  })

  it('draws a cut with no style, or a style that needs a device, exactly as before', () => {
    const house = drawn(staged())
    expect(drawn(staged({ style: 'toy-3d' }))).toEqual(house)
    expect(house.flatMap(([, style]) => String(style).includes('scale(') ? [style] : [])).toEqual([])
    expect(house.some(([, style]) => String(style).includes('radial-gradient(ellipse at center'))).toBe(true)
    expect({ ...MOTION }).toEqual(HOUSE_MOTION)
  })

  it('draws a picked style differently, then restores the house motion for the next cut', () => {
    const keynote = drawn(staged({ style: 'dark-keynote' }))
    expect(keynote).not.toEqual(drawn(staged()))
    // ink_deep ground and a slow push over the beat.
    expect(keynote.some(([, style]) => String(style).includes(`"background":"${fixture.tokens.inkDeep}"`))).toBe(true)
    expect(keynote.some(([, style]) => /"transform":"scale\(1\.0\d+\)"/.test(String(style)))).toBe(true)
    // A style on twos steps its graphics: frame 75 is the fifteenth of the beat, so devices hold frame 74.
    expect(elements(FormatMaster(staged({ style: 'paper-cutout' }))).filter(n => n.type === DEVICES['fixture-device']).map(n => n.props.frame)).toEqual([74, 74])
    // living-ui dims everything but the proof (towards 40%) once the camera is on it; the proof stays whole.
    const living = elements(FormatMaster(staged({ style: 'living-ui' })))
    const wrappers = living.filter(n => isValidElement(n.props.children) && (n.props.children as ReactElement).type === DEVICES['fixture-device'])
    const dims = wrappers.map(n => (n.props.style as { opacity?: number }).opacity)
    expect(dims[0]).toBeUndefined()
    expect(dims[1]).toBeLessThan(1)
    expect(dims[1]).toBeGreaterThanOrEqual(0.4)
    FormatMaster(staged())
    expect({ ...MOTION }).toEqual(HOUSE_MOTION)
  })
})

describe('nothing goes before the hook on the wide long cut', () => {
  // Ruling (Krish, 2026-11-12): "Nothing before the hook, ever. Remove the sting exception for good." From 5 Nov the
  // 16:9 whole cut of a weekly series piece opened on its series' sting clip; now props that carry one never render.
  const STING = { src: 'makeyourmindup-sting-16x9-mind_the_gap.mp4', series: 'mind_the_gap' as const, frames: 56, sha256: 'a'.repeat(64) }
  const raw = () => ({ ...structuredClone(fixture), aspect: '16:9',
    segments: [{ src: 'take.mp4', trimBeforeFrames: 0, fromFrame: 0, durationFrames: 120 }],
    audio: { stem: { src: 'stem.wav', trimBeforeFrames: 0 }, sfx: [{ src: 'hit.wav', atFrame: 10, gainDb: -6 }] },
    ending: { fromFrame: 90, url: 'makeyourmindup.ai' } })
  const refused = (change: Record<string, unknown>) => {
    const result = EngineRenderPropsSchema.safeParse({ ...raw(), ...change })
    return result.success ? '' : result.error.issues.map((issue) => issue.message).join('; ')
  }

  it('refuses a sting in front of any cut, even the series wide whole cut it used to open', () => {
    expect(refused({ sting: STING })).toContain('Nothing before the hook, ever.')
    expect(refused({ sting: STING, aspect: '9:16' })).toContain('Nothing before the hook, ever.')
  })

  it('refuses an episode card in place of the sting', () => {
    expect(refused({ opening: { kind: 'episode_card', said: 'I want the episode card to come in.', on: '2026-11-09' } }))
      .toContain('an episode card in front of the cut')
  })

  it('opens the wide cut on its hook: VeCut is the cut itself, frame 0 his take', () => {
    const props = EngineRenderPropsSchema.parse(raw())
    const tree = VeCut(props)
    expect(tree.type).toBe(FormatMaster)
    expect(tree.props).toEqual(props)
    const compositions = elements(RemotionRoot()).filter((node) => node.type === Composition)
    const composition = compositions.find((node) => node.props.id === 'VeFormatMasterWide')!
    const length = (composition.props.calculateMetadata as (input: { props: unknown }) => { durationInFrames: number })({ props }).durationInFrames
    expect(length).toBe(120)
  })
})

it('validates WINDOW face states strictly', () => {
  const props = structuredClone(fixture)
  Object.assign(props.beats[0]!, { layout: 'WINDOW', face: 'off' })
  expect(EngineRenderPropsSchema.safeParse(props).success).toBe(true)
  Object.assign(props.beats[0]!, { face: 'unknown' })
  expect(EngineRenderPropsSchema.safeParse(props).success).toBe(false)
})

it('keeps one presenter layer above WINDOW plates and uses the signed window geometry', () => {
  const props = EngineRenderPropsSchema.parse(fixture)
  props.beats = [{ id: 'window', layout: 'WINDOW', role: 'anchor', fromFrame: 0, toFrame: 150,
    uses: [], transitionOut: 'cut', sectionBeat: false }]
  props.segments = [{ src: 'take.mp4', trimBeforeFrames: 0, fromFrame: 0, durationFrames: 150 }]
  vi.mocked(useEngineFrame).mockReturnValue(75)
  const tree = elements(FormatMaster(props))
  expect(tree.filter(node => node.type === OffthreadVideo)).toHaveLength(1)
  expect(tree.some(node => {
    const style = node.props.style as Record<string, unknown> | undefined
    return style?.left === 48 && style?.top === 1250 && style?.width === 330 && style?.height === 420
  })).toBe(true)
})
