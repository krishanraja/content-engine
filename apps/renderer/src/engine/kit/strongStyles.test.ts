import { readFileSync } from 'node:fs'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FormatMaster } from '../FormatMaster'
import { BrandFrame } from '../BrandFrame'
import { ENTER, progress, setMotionProfile, typingProgress } from '../clock'
import { FOCUS, PEN, TYPED } from '../devices/focus'
import { Device as Bubble, bubbleFocus, bubbleState } from '../devices/typing_bubble'
import { Device as Chip } from '../devices/query_chip'
import { scribblePen } from '../devices/scribble/state'
import { scribbleState } from '../devices/scribble/state'
import { EngineEventSchema, EngineObjectSchema, EngineRenderPropsSchema, type EngineEvent, type EngineObject, type EngineRenderProps } from '../props'
import { SCRIBBLE } from './lock'
import { MOTION_PROFILES } from './motionProfiles'
import { typedText } from './reveal'
import { SAFE_TALL, focusRoom, insideRoom, pathTrack, pointAlong, zoomTarget } from './focus'
import { FWP_SPLIT_SEAM_Y } from '../mocks/face-with-proof'

/** The four weak spots of the motion styles, strengthened (Krish, 2026-11-04: "strengthen the weak styles before
 *  Friday"): typing follows the style, living-ui zooms to the typed line, single-line-drawing follows the pen, and a
 *  crossfade keeps the outgoing beat. Each with no style draws exactly the house (houseGolden.test.ts holds that). */

const clockFrame = vi.hoisted(() => ({ value: 0 }))
vi.mock('../clock', async (importOriginal) => ({ ...await importOriginal<typeof import('../clock')>(), useEngineFrame: () => clockFrame.value }))

afterEach(() => setMotionProfile(undefined))

const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const THURSDAY = JSON.parse(readFileSync('docs/plans/2026-11-05-thursday-no-spending/ve/props.short.json', 'utf8'))
const thursday = (style?: string): EngineRenderProps => {
  const props = EngineRenderPropsSchema.parse(JSON.parse(JSON.stringify(THURSDAY)))
  delete props.motion
  if (style) props.motion = { style }
  return props
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}
const draw = (props: EngineRenderProps, frame: number) => { clockFrame.value = frame; return elements(FormatMaster(props)) }
const beatFill = (nodes: ReturnType<typeof elements>, id: string) => nodes.find(n => n.key === `devices-${id}`)
/** The beat's graphics layer: the first child of its outer fill (the sweep, when there is one, comes before it). */
const layerOf = (fill: ReactElement<Record<string, unknown>>) => elements(fill.props.children as ReactNode)
  .find(n => n !== fill && !(n.props.style as { background?: string } | undefined)?.background && (n.props.style as object | undefined) !== undefined
    && Object.hasOwn(n.props.style as object, 'transform'))
/** Where a frame point lands under `translate(tx, ty) scale(s)` about the layer centre. */
function camera(transform: string, width: number, height: number) {
  const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(transform)
  if (!m) throw new Error(`no camera in ${transform}`)
  const [tx, ty, s] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const ox = width / 2, oy = height / 2
  return { s, tx, ty, map: (b: { left: number; top: number; width: number; height: number }) =>
    ({ left: ox + tx + s * (b.left - ox), top: oy + ty + s * (b.top - oy), width: b.width * s, height: b.height * s }) }
}

describe('1. typing follows the style', () => {
  const long = 'This line is long enough to show the typing rate clearly at a glance'

  it('types at the profile cps with a caret, and never slower than the span allows', () => {
    setMotionProfile(MOTION_PROFILES['living-ui'])
    expect(typedText(long, 30, 1000, 0.1)).toEqual({ text: Array.from(long).slice(0, 30).join(''), caret: true, done: false })
    setMotionProfile(MOTION_PROFILES['hud-terminal'])
    // 32 characters a second: 15 frames type 16 characters.
    expect(typedText(long, 15, 1000, 0.1).text).toHaveLength(16)
    expect(typedText(long, -1, 1000, 0).text).toBe('')
    // A span too short for 32 a second: it still finishes as the span ends.
    expect(typedText(long, 20, 20, 1)).toEqual({ text: long, caret: false, done: true })
    expect(typedText(long, Number.POSITIVE_INFINITY, 20, 1).text).toBe(long)
  })

  it('rolls figures up under a rolling style and lands on the real figure', () => {
    setMotionProfile(MOTION_PROFILES['data-story'])
    const early = typedText('Saved 940 a year', 4, 30, 0.2)
    expect(early.text).toMatch(/^Saved \d\d\d a year$/)
    expect(early.text).not.toBe('Saved 940 a year')
    expect(typedText('Saved 940 a year', 24, 30, 1).text).toBe('Saved 940 a year')
  })

  it('makes typing_bubble type at the style rate with a caret, and the house spread its text exactly as before', () => {
    const object = EngineObjectSchema.parse({ obj: 'b', device: 'typing_bubble', meaning: 'm', variants: {}, fromFrame: 0, toFrame: 400,
      params: { kind: 'notification', rows: [{ text: long }] } })
    const events = [{ id: 'in', obj: 'b', verb: 'enter', toState: 'visible', atFrame: 10 }, { id: 't', obj: 'b', verb: 'type', toState: '0', atFrame: 20 }]
      .map(e => EngineEventSchema.parse(e))
    const props = (frame: number) => ({ object, events, frame, aspect: '9:16' as const, tokens, box: { left: 0, top: 0, width: 1080, height: 1920 } })
    // House: the text spreads over the span (to the object's end), exactly the old arithmetic, and no caret.
    for (const frame of [20, 40, 90, 200, 399]) {
      const p = typingProgress(frame, events[1]!, 380, 0)
      expect(bubbleState(props(frame))!.rows[0]!.text).toBe(Array.from(long).slice(0, Math.floor(Array.from(long).length * p)).join(''))
      expect(renderToStaticMarkup(React.createElement(Bubble, props(frame)))).not.toContain('data-caret')
    }
    setMotionProfile(MOTION_PROFILES['living-ui'])
    expect(bubbleState(props(40))!.rows[0]!.text).toHaveLength(20) // 20 frames at 30 a second
    expect(renderToStaticMarkup(React.createElement(Bubble, props(40)))).toContain('data-caret')
    expect(bubbleState(props(20 + 68))!.rows[0]!.text).toBe(long)
    expect(renderToStaticMarkup(React.createElement(Bubble, props(20 + 68)))).not.toContain('data-caret')
  })

  it('makes query_chip type with a caret under a typing style and show whole under the house', () => {
    const object = EngineObjectSchema.parse({ obj: 'q', device: 'query_chip', meaning: 'm', variants: {}, fromFrame: 0, toFrame: 200, params: { text: 'best phone under 300' } })
    const events = [EngineEventSchema.parse({ id: 'in', obj: 'q', verb: 'enter', toState: 'on', atFrame: 5 })]
    const p = { object, events, frame: 20, aspect: '9:16' as const, tokens, box: { left: 120, top: 288, width: 768, height: 552 } }
    const house = renderToStaticMarkup(React.createElement(Chip, p))
    expect(house).toContain('best phone under 300</div>')
    setMotionProfile(MOTION_PROFILES['hud-terminal'])
    const typing = renderToStaticMarkup(React.createElement(Chip, p))
    expect(typing).toContain('data-caret')
    expect(typing).not.toBe(house)
  })
})

describe('2. living-ui zooms to the typed line', () => {
  it('reports the line being typed and moves to the next line when it starts', () => {
    const props = thursday()
    const verdict = props.objects.find(o => o.obj === 'verdict')!
    const { place: _place, ...params } = verdict.params
    const object = { ...verdict, params }
    const box = { left: 0, top: 0, width: 1080, height: 640 }
    setMotionProfile(MOTION_PROFILES['living-ui'])
    const at = (frame: number) => bubbleFocus({ object, events: props.events, box, aspect: '9:16', frame })
    expect(at(200)).toBeUndefined() // nothing typed yet: no line to zoom to
    const first = at(140 + 135)!
    expect(first.since).toBe(140 + 135 - 268)
    expect(first.from).toBeUndefined()
    const second = at(140 + 170)!
    expect(second.since).toBe(140 + 170 - 307)
    expect(second.from).toEqual(first.rect)
    expect(second.rect.top).toBeGreaterThan(first.rect.top)
    expect(first.rect.width).toBeLessThan(400) // the line ("Really helpful."), never the whole card
  })

  it('keeps the zoomed line inside the safe area and above the SPLIT seam, up to 1.5x, while the card edge leaves the frame', () => {
    const props = thursday('living-ui')
    const verdict = props.objects.find(o => o.obj === 'verdict')!
    const place = verdict.params.place as { left: number; top: number; width: number; height: number; scale: number }
    const room = focusRoom('9:16', 'SPLIT', true, [])
    let largest = 1
    for (let frame = 268; frame < 366; frame++) {
      const nodes = draw(props, frame)
      const layer = layerOf(beatFill(nodes, 'face')!)!
      const cam = camera((layer.props.style as { transform: string }).transform, 1080, FWP_SPLIT_SEAM_Y)
      largest = Math.max(largest, cam.s)
      expect(cam.s).toBeLessThanOrEqual(1.5)
      const { place: _p, ...params } = verdict.params
      const focus = bubbleFocus({ object: { ...verdict, params }, events: props.events, box: { left: 0, top: 0, width: place.width, height: place.height }, aspect: '9:16', frame })!
      const mapped = cam.map({ left: place.left + focus.rect.left * place.scale, top: place.top + focus.rect.top * place.scale,
        width: focus.rect.width * place.scale, height: focus.rect.height * place.scale })
      // Mid-move between two lines the camera travels; once settled the line is inside the room.
      if (focus.since >= 12) {
        expect(insideRoom(mapped, room)).toBe(true)
        expect(mapped.top + mapped.height).toBeLessThanOrEqual(FWP_SPLIT_SEAM_Y) // never on his face
        expect(mapped.top).toBeGreaterThanOrEqual(SAFE_TALL.top)
      }
    }
    expect(largest).toBe(1.5)
    // The card's own left edge leaves the frame at full zoom.
    const cam = camera((layerOf(beatFill(draw(props, 300), 'face')!)!.props.style as { transform: string }).transform, 1080, FWP_SPLIT_SEAM_Y)
    expect(cam.map({ left: place.left, top: place.top, width: 10, height: 10 }).left).toBeLessThan(0)
  })

  it('never lets a zoom target leave the room it fits in', () => {
    const tall = focusRoom('9:16', 'STAGE', false, [])
    const split = focusRoom('9:16', 'SPLIT', true, [])
    for (const room of [tall, split]) {
      for (let left = 0; left < 1000; left += 97) for (let top = 150; top < 1500; top += 113) for (const width of [120, 300, 520]) {
        const rect = { left, top, width, height: 57 }
        const z = zoomTarget(rect, room, 1.5)
        expect(z.scale).toBeGreaterThanOrEqual(1)
        expect(z.scale).toBeLessThanOrEqual(1.5)
        if (width * z.scale <= 800 && rect.height * z.scale <= room.bottom - room.top) expect(insideRoom(z.mapped, room)).toBe(true)
      }
    }
  })

  it('dims every device but the focus to 40% once the camera is on it', () => {
    const props = thursday('living-ui')
    props.objects.push(EngineObjectSchema.parse({ obj: 'tick', device: 'scribble', meaning: 'm', variants: {}, fromFrame: 176, toFrame: 366,
      params: { colour: 'mint', seed: 's', shape: 'tick', cx: 300, cy: 400, size: 60 } }))
    props.beats[1]!.uses = ['tick', 'verdict']
    const nodes = draw(props, 300)
    const wrappers = elements(beatFill(nodes, 'face')!.props.children as ReactNode).filter(n => n.key === 'tick' || n.key === 'verdict')
    expect((wrappers.find(n => n.key === 'tick')!.props.style as { opacity?: number }).opacity).toBeCloseTo(0.4, 5)
    expect((wrappers.find(n => n.key === 'verdict')!.props.style as { opacity?: number }).opacity).toBeUndefined()
  })
})

describe('3. single-line-drawing follows the pen', () => {
  const loop = () => {
    const props = thursday()
    return { props, object: props.objects.find(o => o.obj === 'amazon_loop')! as EngineObject, events: props.events as EngineEvent[] }
  }

  it('moves the pen tip along the scribble path, monotonically in path length, from its start to its end', () => {
    const { object, events } = loop()
    const d = scribbleState(object, events, 420).d
    const { points, length } = pathTrack(d)
    const pen = scribblePen(object, events)
    expect(pen(411)).toBeUndefined()
    let travelled = -1
    for (let frame = 412; frame <= 430; frame++) {
      const share = progress(frame - 412, SCRIBBLE.draw_on_frames, ENTER)
      const tip = pen(frame)
      if (share === 0) { expect(tip).toBeUndefined(); continue }
      expect(tip).toEqual(pointAlong(d, share))
      expect(share * length).toBeGreaterThanOrEqual(travelled)
      travelled = share * length
    }
    expect(pen(430)).toEqual(points.at(-1))
    expect(pen(460)).toBeUndefined() // gone after its exit
    // pointAlong walks the track by distance: chord steps never exceed the path length between them.
    let last = pointAlong(d, 0)
    for (let f = 0.05; f <= 1.0001; f += 0.05) {
      const next = pointAlong(d, f)
      expect(Math.hypot(next[0] - last[0], next[1] - last[1])).toBeLessThanOrEqual(0.05 * length + 1e-6)
      last = next
    }
  })

  it('centres the camera on the pen with a damped follow and never shows past the canvas', () => {
    const props = thursday('single-line-drawing')
    const { object, events } = loop()
    const pen = scribblePen(object, events)
    const h = FWP_SPLIT_SEAM_Y
    let before = Infinity
    for (let frame = 366; frame < 504; frame++) {
      const layer = layerOf(beatFill(draw(props, frame), 'proof')!)
      const transform = (layer?.props.style as { transform?: string } | undefined)?.transform ?? ''
      const cam = camera(transform.slice(transform.indexOf('translate(')), 1080, h)
      // Never past the canvas: the scaled layer always covers it.
      expect(Math.abs(cam.tx)).toBeLessThanOrEqual((cam.s - 1) * 540 + 0.05)
      expect(Math.abs(cam.ty)).toBeLessThanOrEqual((cam.s - 1) * (h / 2) + 0.05)
      if (frame < 412) expect(cam.s).toBe(1)
      const tip = pen(frame)
      if (tip && frame >= 426) {
        // Once the follow has closed in, the pen sits nearer the centre of the frame than it would with no camera.
        const mapped = cam.map({ left: tip[0], top: tip[1], width: 0, height: 0 })
        const off = Math.hypot(mapped.left - 540, mapped.top - h / 2)
        expect(off).toBeLessThan(Math.hypot(tip[0] - 540, tip[1] - h / 2))
        before = Math.min(before, off)
      }
    }
    expect(before).toBeLessThan(Infinity)
    expect(Object.keys(PEN)).toEqual(['scribble'])
  })
})

describe('4. a true crossfade', () => {
  const brandFrames = (nodes: ReturnType<typeof elements>) => nodes.filter(n => n.type === BrandFrame).length

  it('keeps the outgoing beat for exactly the transition frames, fading under the incoming, with one caption layer', () => {
    const props = thursday('dark-keynote')
    expect(MOTION_PROFILES['dark-keynote']!.transitionFrames).toBe(8)
    for (let k = 0; k < 8; k++) {
      const nodes = draw(props, 176 + k)
      const out = beatFill(nodes, 'hook'), into = beatFill(nodes, 'face')
      expect(out).toBeDefined()
      expect(into).toBeDefined()
      expect(Number((out!.props.style as { opacity?: number }).opacity ?? 1)).toBeCloseTo(1 - k / 8, 5)
      expect(Number((into!.props.style as { opacity?: number }).opacity ?? 1)).toBeCloseTo(k / 8, 5)
      expect(nodes.indexOf(out!)).toBeLessThan(nodes.indexOf(into!)) // the outgoing beat is under the incoming
      expect(brandFrames(nodes)).toBe(1)
      // The outgoing beat holds its last frame.
      const held = elements(out!.props.children as ReactNode).filter(n => typeof n.props.frame === 'number').map(n => n.props.frame)
      expect(held.every(f => f === 175)).toBe(true)
    }
    const after = draw(props, 184)
    expect(beatFill(after, 'hook')).toBeUndefined()
    expect(brandFrames(after)).toBe(1)
  })

  it('keeps the outgoing beat of a carry under a cutting style, and cuts with no style', () => {
    const carried = thursday('riso-halftone')
    carried.beats[0]!.transitionOut = 'carry'
    const nodes = draw(carried, 178)
    expect(beatFill(nodes, 'hook')).toBeDefined()
    expect(beatFill(draw(carried, 176 + 6), 'hook')).toBeUndefined() // riso exits in 5 frames, held to 6
    const house = thursday()
    house.beats[0]!.transitionOut = 'carry'
    expect(beatFill(draw(house, 176), 'hook')).toBeUndefined()
    expect(beatFill(draw(thursday(), 176), 'hook')).toBeUndefined()
    expect(beatFill(draw(thursday('riso-halftone'), 176), 'hook')).toBeUndefined() // a plain cut stays a cut
  })
})

describe('the camera devices and ve styles agree', () => {
  it('names the same devices in config/ve/style-distinct.json as the renderer reports', () => {
    const rules = JSON.parse(readFileSync('config/ve/style-distinct.json', 'utf8'))
    expect([...rules.effects.zoomToFocus.devices].sort()).toEqual(Object.keys(FOCUS).sort())
    expect([...rules.effects.followPen.devices].sort()).toEqual(Object.keys(PEN).sort())
    expect([...rules.effects.typewriter.devices].sort()).toEqual([...TYPED].sort())
  })
})
