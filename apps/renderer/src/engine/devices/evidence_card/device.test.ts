import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { OffthreadVideo } from 'remotion'
import { Device, evidenceLayout, evidenceMediaStyle } from './index'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import fixture from './fixture.json'
import { ParamsSchema } from './schema'
import { evidenceState } from './state'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map((event) => EngineEventSchema.parse(event))
const at = (frame: number) => evidenceState(object, events, frame)

describe('evidence_card frame state', () => {
  it('enters from its cell over twelve frames and fills only on cue', () => {
    expect(at(9).visible).toBe(false)
    expect(at(10)).toMatchObject({ visible: true, enter: 0, text: '' })
    expect(at(22).enter).toBe(1)
    expect(at(24).text).toBe('')
    expect(at(25).text).toBe('')
    expect(at(30).text).toBe('Checked so')
    expect(at(49).text).toBe('Checked source')
  })
  it('strikes and collapses in six frames, then types the marked replacement', () => {
    expect(at(50)).toMatchObject({ struck: true, collapse: 0, text: 'Checked source' })
    expect(at(53).collapse).toBeCloseTo(0.5)
    expect(at(56)).toMatchObject({ struck: true, collapse: 1, media: false })
    expect(at(65)).toMatchObject({ struck: true, collapse: 1, text: '' })
    expect(at(69).text).toBe('New ')
    expect(at(73).text).toBe('New line')
    expect(at(120).text).toBe('New line')
  })
  it('preserves provenance through all states and backward seeks', () => {
    for (const frame of [10, 25, 50, 56, 65, 100]) expect(at(frame).params).toMatchObject({ outlet: 'Fixture source', date: '2026-10-27' })
    at(120)
    expect(at(30).text).toBe('Checked so')
    expect(evidenceState(object, [...events].reverse(), 73)).toEqual(at(73))
    expect(at(180).visible).toBe(false)
  })
  it('starts recording playback at fill with its authored source trim', () => {
    const video = { ...object, params: { kind: 'recording', src: 'fixture.mp4', outlet: 'Fixture camera', date: '2026-10-27', trimBefore: 42 } }
    expect(evidenceState(video, events, 24).media).toBe(false)
    expect(evidenceState(video, events, 25)).toMatchObject({ media: true, playbackFrom: 25, params: { trimBefore: 42 } })
    expect(evidenceState(video, events, 56).media).toBe(false)
    expect(evidenceState(video, events, 73)).toMatchObject({ media: false, text: 'New line' })
  })
  it('requires provenance and the content appropriate to each kind', () => {
    expect(ParamsSchema.safeParse({ kind: 'screenshot', src: 'proof.png', date: 'today' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ kind: 'quote', outlet: 'Source', date: 'today' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ kind: 'recording', outlet: 'Source', date: 'today' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ kind: 'document', src: 'proof.png', outlet: 'Source', date: 'today' }).success).toBe(true)
  })
  it('shows still evidence on enter, keeps its source on stamp, and clears it for a mark', () => {
    const still = { ...object, params: { kind: 'screenshot', src: 'proof.png', outlet: 'Fixture source', date: '2026-10-27' } }
    expect(evidenceState(still, events, 9).media).toBe(false)
    expect(evidenceState(still, events, 22).media).toBe(true)
    expect(evidenceState(still, events, 56)).toMatchObject({ media: false, struck: true, params: { outlet: 'Fixture source' } })
    expect(evidenceState(still, events, 73)).toMatchObject({ media: false, text: 'New line' })
  })
  it('uses event order for a stamp and mark on the same frame', () => {
    const commands = events.map((event) => event.verb === 'mark' ? { ...event, atFrame: 50 } : event)
    expect(evidenceState(object, commands, 58)).toMatchObject({ struck: true, text: 'New line' })
    const exit = { ...events[0]!, id: 'exit', verb: 'exit' as const, atFrame: 80 }
    expect(evidenceState(object, [...events, exit], 90).visible).toBe(false)
  })
})

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'green', channel: 'coral' }

describe('evidence media and fitting', () => {
  it('mutes recording audio and crops the source at full viewport width', () => {
    const crop = { x: 0.17, y: 0.10, w: 0.73, h: 0.48 }
    const video = { ...object, params: { kind: 'recording', src: 'fixture.mp4', outlet: 'Camera', date: 'today', crop } }
    const box = { left: 96, top: 208, width: 1056, height: 572 }
    const nodes = elements(Device({ object: video, events, box, tokens, aspect: '16:9', frame: 30 }))
    const media = nodes.find((node) => node.type === OffthreadVideo)!
    expect(media.props.muted).toBe(true)
    expect(media.props.style).toEqual(evidenceMediaStyle(crop))
    const style = media.props.style as Record<string, string>
    expect(parseFloat(style.width!)).toBeCloseTo(100 / 0.73)
    expect(parseFloat(style.height!)).toBeCloseTo(100 / 0.48)
    expect(parseFloat(style.left!)).toBeCloseTo(-100 * 0.17 / 0.73)
    expect(parseFloat(style.top!)).toBeCloseTo(-100 * 0.10 / 0.48)
    const viewport = nodes.find((node) => node.props['data-media'] === 'viewport')!
    const rect = viewport.props.style as { width: number; height: number }
    expect(rect.width / rect.height).toBeCloseTo(16 / 9 * 0.73 / 0.48)
    expect(ParamsSchema.safeParse({ ...video.params, crop: { ...crop, x: 0.5 } }).success).toBe(false)
  })

  it('finishes fill typing six frames before the next object event', () => {
    const quote = { ...object, params: { ...object.params, quote: 'A long checked answer that must finish before the next event.' } }
    const timeline = events.map((event) => event.verb === 'stamp' ? { ...event, atFrame: 40 } : event)
    expect(evidenceState(quote, timeline, 33).text.length).toBeLessThan(String(quote.params.quote).length)
    expect(evidenceState(quote, timeline, 34).text).toBe(quote.params.quote)
    expect(evidenceState(quote, [...timeline, { ...events[0]!, id: 'other', obj: 'other', atFrame: 27 }], 34).text).toBe(quote.params.quote)
  })

  it.each(['9:16', '16:9'] as const)('wraps replacement text inside the fitted %s card', (aspect) => {
    const box = aspect === '9:16' ? { left: 120, top: 288, width: 768, height: 400 }
      : { left: 96, top: 208, width: 1056, height: 572 }
    const text = "Sorry, that's beyond my current scope. Let's talk about something else."
    const params = ParamsSchema.parse(object.params)
    const l = evidenceLayout(box, params, text, false, aspect)
    expect(l.rect.left).toBeGreaterThanOrEqual(box.left)
    expect(l.rect.top).toBe(box.top)
    expect(l.rect.left + l.rect.width).toBeLessThanOrEqual(box.left + box.width + 1e-8)
    expect(l.rect.top + l.rect.height).toBeLessThanOrEqual(box.top + box.height + 1e-8)
    expect(l.fontSize * l.scale).toBeGreaterThanOrEqual(aspect === '9:16' ? 28 : 24)
    const marked = events.map((event) => event.verb === 'mark' ? { ...event, toState: text } : event)
    const node = elements(Device({ object, events: marked, box, tokens, aspect, frame: 150 }))
      .find((node) => (node.props.style as { overflowWrap?: string } | undefined)?.overflowWrap === 'anywhere')!
    expect(node.props.children).toBe(text)
    expect(at(150).struck).toBe(true)
  })
})
