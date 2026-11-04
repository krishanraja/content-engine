import { readFileSync } from 'node:fs'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FormatMaster } from '../FormatMaster'
import { BrandFrame } from '../BrandFrame'
import { setMotionProfile } from '../clock'
import { DEVICES } from '../devices/registry'
import { EngineRenderPropsSchema, type EngineRenderProps } from '../props'
import { chromeZone } from '../geometry'
import { FWP_SPLIT_SEAM_Y } from '../mocks/face-with-proof'
import { LEAD, LeadCaption, leadBox, leadCards } from '../chrome/LeadCaption'
import { WORD_CAPTION, WordCaption } from '../chrome/WordCaption'
import { MOTION_PROFILES, clampToFloor, floorProblems, resolveMotion, type MotionProfile } from './motionProfiles'
import { SAFE_TALL, insideRoom } from './focus'
import { HeroType, heroArea, heroLayout } from './heroType'
import { Brackets, CARD_DEVICES, CUTOUT_TILT, PaperTexture, SketchFrame, TORN_DEVICES, TornFilter, TornSeam, boilSeed, cutoutPose, deepen, paperStock, tileLean, tokensFor } from './overlays'
import { font } from './typeRole'
import { HOUSE_FONTS } from '../../house/geometry'

/** The five look-alike styles given a look of their own (Krish, 2026-11-04: "start the five styles now, don't wait
 *  for Friday"): each ground, overlay, type and caption mode draws only from its own profile, inside the channel safe
 *  area and off his face, and the same on every render of a frame. The house holds byte-identical in
 *  houseGolden.test.ts. */

const clockFrame = vi.hoisted(() => ({ value: 0 }))
vi.mock('../clock', async (importOriginal) => ({ ...await importOriginal<typeof import('../clock')>(), useEngineFrame: () => clockFrame.value }))
afterEach(() => setMotionProfile(undefined))

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
const ofType = (nodes: ReturnType<typeof elements>, type: unknown) => nodes.filter(n => n.type === type)
const DEVICE_TYPES = new Set<unknown>(Object.values(DEVICES))
/** Every device on the frame rendered to markup, with the profile the composition set. */
const deviceMarkup = (nodes: ReturnType<typeof elements>) => nodes.filter(n => DEVICE_TYPES.has(n.type))
  .map(n => renderToStaticMarkup(React.createElement(n.type as React.FC, n.props)))
const FIVE = ['swiss-kinetic-type', 'hud-terminal', 'paper-cutout', 'vertical-captions', 'line-boil'] as const
const beatAt = (props: EngineRenderProps, frame: number) => props.beats.find(b => b.fromFrame <= frame && frame < b.toFrame)!
const OVERLAYS = [PaperTexture, Brackets, SketchFrame, TornFilter, TornSeam, HeroType] as const

describe('each mode draws only from its own profile', () => {
  it('the five profiles name their own looks, inside the signed floor', () => {
    expect(MOTION_PROFILES['hud-terminal']!.ground.kind).toBe('dark')
    expect(MOTION_PROFILES['hud-terminal']!.overlays).toEqual(['brackets', 'scanLines'])
    expect(MOTION_PROFILES['hud-terminal']!.type?.font).toBe('data')
    expect(MOTION_PROFILES['paper-cutout']!.ground.texture).toBe('paper')
    expect(MOTION_PROFILES['paper-cutout']!.overlays).toEqual(['torn'])
    expect(MOTION_PROFILES['swiss-kinetic-type']!.type?.hero).toBe(true)
    expect(MOTION_PROFILES['vertical-captions']!.captions?.mode).toBe('lead')
    expect(MOTION_PROFILES['line-boil']!.boil).toEqual({ amplitudePx: 2, everyFrames: 2 })
    for (const id of FIVE) expect(floorProblems(MOTION_PROFILES[id]!)).toEqual([])
  })

  it('clamps a hand-edited boil or lead card inside the floor', () => {
    const wild: MotionProfile = { ...MOTION_PROFILES['line-boil']!, boil: { amplitudePx: 9, everyFrames: 1 },
      captions: { mode: 'lead', wordsPerCard: 9 } }
    expect(floorProblems(wild)).toHaveLength(2)
    const held = clampToFloor(wild)
    expect(held.boil).toEqual({ amplitudePx: 2, everyFrames: 2 })
    expect(held.captions?.wordsPerCard).toBe(4)
    expect(floorProblems(held)).toEqual([])
  })

  it('draws none of the new modes with no style, nor under the five strong styles', () => {
    for (const style of [undefined, 'riso-halftone', 'single-line-drawing', 'dark-keynote', 'living-ui', 'data-story']) {
      const props = thursday(style)
      for (const frame of [40, 200, 420, 520, 600, 900]) {
        const nodes = draw(props, frame)
        for (const type of OVERLAYS) expect(ofType(nodes, type), `${style} ${frame}`).toHaveLength(0)
        expect(nodes.some(n => (n.props as { 'data-scan-lines'?: boolean })['data-scan-lines'])).toBe(false)
        expect(nodes.some(n => String((n.props.style as { filter?: string } | undefined)?.filter ?? '').includes('torn'))).toBe(false)
      }
    }
  })

  it('hud-terminal: ink_deep under the split stage, inverted cards in the mono face, scan lines, brackets on the typed line', () => {
    const props = thursday('hud-terminal')
    const nodes = draw(props, 200)
    const fill = nodes.find(n => n.key === 'devices-face')!
    expect((fill.props.style as { backgroundColor: string }).backgroundColor).toBe(props.tokens.inkDeep)
    expect(nodes.some(n => (n.props as { 'data-scan-lines'?: boolean })['data-scan-lines'])).toBe(true)
    const markup = deviceMarkup(nodes).join('')
    expect(markup).toContain('MYMU Plex Mono')
    expect(markup).not.toContain('MYMU Archivo')
    // The card is ink_soft with cream type.
    expect(markup).toContain(`background:${props.tokens.inkSoft}`)
    expect(markup).toContain(`color:${props.tokens.cream}`)
    // Brackets lock onto the line the bubble reports, in mint.
    const later = draw(props, 540)
    const brackets = ofType(later, Brackets)
    expect(brackets).toHaveLength(1)
    expect(renderToStaticMarkup(React.createElement(Brackets, brackets[0]!.props as never))).toContain(`stroke="${props.tokens.mint}"`)
  })

  it('the mono face and inverted tokens follow the profile and leave logos alone', () => {
    expect(font('structure')).toBe(HOUSE_FONTS.structure)
    setMotionProfile(MOTION_PROFILES['hud-terminal'])
    expect(font('structure')).toBe(HOUSE_FONTS.data)
    const tokens = thursday().tokens
    expect(tokensFor('logo_card', tokens, MOTION_PROFILES['hud-terminal'])).toBe(tokens)
    expect(tokensFor('typing_bubble', tokens, MOTION_PROFILES['hud-terminal']).cream).toBe(tokens.inkSoft)
    // line-boil keeps its cards cream on the ink ground; type set straight on the ground still inverts.
    expect(tokensFor('typing_bubble', tokens, MOTION_PROFILES['line-boil'])).toBe(tokens)
    expect(tokensFor('headline', tokens, MOTION_PROFILES['line-boil']).ink).toBe(tokens.cream)
    expect(tokensFor('typing_bubble', tokens, undefined)).toBe(tokens)
  })

  it('paper-cutout: a seeded paper stock, and cards and logo tiles cut out with a torn edge', () => {
    const props = thursday('paper-cutout')
    const nodes = draw(props, 420)
    expect(ofType(nodes, PaperTexture)).toHaveLength(1)
    const filter = ofType(nodes, TornFilter)
    expect(filter).toHaveLength(1)
    const wrapped = nodes.filter(n => String((n.props.style as { filter?: string } | undefined)?.filter ?? '') === 'url(#torn-proof)')
    // The logo tiles are torn; the scribble (a drawn line) is not.
    expect(wrapped).toHaveLength(1)
    const paper = renderToStaticMarkup(React.createElement(PaperTexture, ofType(nodes, PaperTexture)[0]!.props as never))
    expect(paper).toContain('feTurbulence')
    expect(paper).not.toContain('<image')
    // A thick torn rim (two seeded tears) and a hard shadow 4 px off with almost no blur, the same on every render.
    const filter1 = renderToStaticMarkup(React.createElement(TornFilter, { id: 'proof', tokens: props.tokens }))
    expect(filter1).toBe(renderToStaticMarkup(React.createElement(TornFilter, { id: 'proof', tokens: props.tokens })))
    expect(Number(/operator="dilate" radius="(\d+)"/.exec(filter1)![1])).toBeGreaterThanOrEqual(10)
    expect(filter1.match(/<feTurbulence/g)).toHaveLength(2)
    expect(filter1).toMatch(/stdDeviation="1"[^>]*><\/feGaussianBlur><feOffset[^>]*dx="4" dy="4"/)
  })

  it('paper-cutout: a warm stock from the cream alone, visibly textured at half size', () => {
    const tokens = thursday().tokens
    const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
    const [cr, , cb] = rgb(tokens.cream), [pr, pg, pb] = rgb(paperStock(tokens))
    // Deeper than the cream and warmer (red over blue grows), in the cream's own hue order.
    expect(pr).toBeLessThan(cr)
    expect(pr - pb).toBeGreaterThan(cr - cb)
    expect(pr > pg && pg > pb).toBe(true)
    expect(deepen('not-a-hex', 2, 90, '#16221D')).toBe('color-mix(in srgb, not-a-hex 90%, #16221D)')
    const paper = renderToStaticMarkup(React.createElement(PaperTexture, { id: 'proof', width: 1080, height: 960, tokens }))
    // Grain no finer than 0.5 a canvas px, so it survives a 540 px frame; fibres and flecks too.
    const freqs = [...paper.matchAll(/baseFrequency="([\d. ]+)"/g)].map(m => Math.max(...m[1]!.split(' ').map(Number)))
    expect(freqs.length).toBeGreaterThanOrEqual(5)
    expect(Math.max(...freqs)).toBeLessThanOrEqual(0.5)
  })

  it('paper-cutout: only cards and logo tiles lean and are nudged, within 2 degrees and 1 px, never a caption', () => {
    const props = thursday('paper-cutout')
    const seen = new Map<string, number>()
    for (const frame of [30, 200, 300, 420, 470, 520, 600, 700, 900, 1200]) {
      const nodes = draw(props, frame)
      const cutouts = nodes.filter(n => typeof n.props['data-cutout'] === 'string')
      for (const c of cutouts) {
        const id = c.props['data-cutout'] as string
        const device = props.objects.find(o => o.obj === id)!.device
        expect(TORN_DEVICES).toContain(device)
        const transform = String((c.props.style as { transform: string }).transform)
        const [, dx, dy, deg] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) rotate\((-?[\d.]+)deg\)/.exec(transform)!.map(Number)
        expect(Math.abs(dx!)).toBeLessThanOrEqual(1)
        expect(Math.abs(dy!)).toBeLessThanOrEqual(1)
        expect(Math.abs(deg!)).toBeLessThanOrEqual(CARD_DEVICES.includes(device) ? CUTOUT_TILT.card : CUTOUT_TILT.tile)
        // Logo tiles lean one by one inside the device; every other cut-out leans as one piece.
        if (id === 'logos') expect(deg).toBe(0)
        else expect(Math.abs(deg!)).toBeGreaterThan(0.4)
        // The lean is the object's own and fixed; only the nudge steps.
        if (seen.has(id)) expect(deg).toBe(seen.get(id))
        seen.set(id, deg!)
      }
      // The scribble is a drawn line, never a cut-out; the captions and the mark tile sit in BrandFrame, untouched.
      expect(cutouts.some(c => c.props['data-cutout'] === 'amazon_loop')).toBe(false)
      expect(ofType(nodes, BrandFrame).length).toBeGreaterThan(0)
      for (const c of cutouts) expect(ofType(elements(c.props.children as ReactNode), BrandFrame)).toHaveLength(0)
      const brandLayers = nodes.filter(n => String(n.key ?? '').startsWith('brand-'))
      expect(brandLayers.length).toBeGreaterThan(0)
      for (const layer of brandLayers) expect(layer.props.style).toBeUndefined()
    }
    // Every card and the logo tiles of the cut were seen as cut-outs.
    expect(seen.has('logos') && seen.has('verdict') && seen.has('chat')).toBe(true)
    expect(seen.size).toBeGreaterThanOrEqual(6)
    // Each logo tile leans on its own seed under paper-cutout, within 2 degrees, and under no other style.
    const leans = [0, 1, 2].map(i => tileLean('logos', i, MOTION_PROFILES['paper-cutout']))
    for (const l of leans) expect(Math.abs(l) > 0.4 && Math.abs(l) <= CUTOUT_TILT.tile).toBe(true)
    expect(new Set(leans).size).toBe(3)
    setMotionProfile(undefined)
    expect(tileLean('logos', 0)).toBe(0)
    for (const style of FIVE.filter(s => s !== 'paper-cutout')) expect(tileLean('logos', 0, MOTION_PROFILES[style])).toBe(0)
    // The nudge steps on twos: both frames of a step agree, and it moves from step to step.
    expect(cutoutPose('logos', 'logo_card', 7)).toEqual(cutoutPose('logos', 'logo_card', 7))
    expect(new Set([0, 1, 2, 3, 4, 5].map(s => JSON.stringify(cutoutPose('logos', 'logo_card', s)))).size).toBeGreaterThan(3)
  })

  it('paper-cutout: the stock tears white along the SPLIT seam, nowhere else and under no other style', () => {
    const props = thursday('paper-cutout')
    expect(ofType(draw(props, 420), TornSeam)).toHaveLength(1)
    expect(ofType(draw(props, 30), TornSeam)).toHaveLength(0)
    const seam = renderToStaticMarkup(React.createElement(TornSeam, ofType(draw(props, 420), TornSeam)[0]!.props as never))
    expect(seam).toBe(renderToStaticMarkup(React.createElement(TornSeam, ofType(draw(props, 421), TornSeam)[0]!.props as never)))
    for (const style of [undefined, ...FIVE.filter(s => s !== 'paper-cutout')]) {
      expect(ofType(draw(thursday(style), 420), TornSeam)).toHaveLength(0)
      expect(draw(thursday(style), 420).some(n => n.props['data-cutout'] !== undefined)).toBe(false)
    }
  })

  it('swiss-kinetic-type: the key phrase as hero type, standing in for the text card, clear of the mark tile and safe', () => {
    const props = thursday('swiss-kinetic-type')
    const face = draw(props, 200)
    const hero = ofType(face, HeroType)
    expect(hero).toHaveLength(1)
    // The notification card is replaced by its own words; its sender becomes the mono label.
    expect(face.filter(n => DEVICE_TYPES.has(n.type))).toHaveLength(0)
    const layout = (hero[0]!.props as { layout: ReturnType<typeof heroLayout> }).layout
    expect(layout.words.map(w => w.text).join(' ')).toBe('Really helpful. A bit dangerous.')
    expect(layout.label?.text).toBe('AI that acts first')
    expect(layout.words.filter(w => w.accent)).toHaveLength(1)
    const chrome = chromeZone('9:16')
    for (const w of layout.words) {
      const box = { left: w.x, top: w.y, width: w.width, height: layout.size * layout.lineHeight }
      expect(insideRoom(box, { ...SAFE_TALL, bottom: FWP_SPLIT_SEAM_Y })).toBe(true)
      expect(box.top).toBeGreaterThanOrEqual(chrome.top + chrome.height)
    }
    expect(layout.size).toBeGreaterThanOrEqual(96) // the standard's headline floor
    // A beat with no text device keeps its logos and sets the clause he is saying above them.
    const proof = draw(props, 420)
    expect(proof.filter(n => DEVICE_TYPES.has(n.type)).length).toBe(2)
    const words = (ofType(proof, HeroType)[0]!.props as { layout: ReturnType<typeof heroLayout> }).layout.words
    const area = heroArea('9:16', FWP_SPLIT_SEAM_Y, true)
    for (const w of words) expect(w.y + 1).toBeGreaterThanOrEqual(area.top)
  })

  it('vertical-captions: lead captions replace the house captions, 2 to 4 words, one word in mint', () => {
    const props = thursday('vertical-captions')
    for (const frame of [40, 200, 420, 600, 900, 1200]) {
      clockFrame.value = frame
      const tree = elements(BrandFrame({ props, beat: beatAt(props, frame), frame }))
      expect(ofType(tree, WordCaption)).toHaveLength(0)
      const lead = ofType(tree, LeadCaption)
      expect(lead).toHaveLength(1)
      const markup = renderToStaticMarkup(React.createElement(LeadCaption, lead[0]!.props as never))
      if (!markup) continue
      expect(markup.match(/data-current/g)?.length ?? 0).toBeLessThanOrEqual(1)
      const words = markup.match(/data-lead-word/g)?.length ?? 0
      expect(words).toBeGreaterThanOrEqual(1)
      expect(words).toBeLessThanOrEqual(3)
    }
    // With no style the house word caption stays.
    const house = thursday()
    clockFrame.value = 200
    expect(ofType(elements(BrandFrame({ props: house, beat: beatAt(house, 200), frame: 200 })), LeadCaption)).toHaveLength(0)
  })

  it('every lead card sits inside the channel safe area and off his face', () => {
    const props = thursday('vertical-captions')
    const cards = leadCards(props.captions, props.beats, 3)
    expect(cards.length).toBeGreaterThan(20)
    for (const card of cards) {
      expect(card.words.length).toBeGreaterThanOrEqual(1)
      expect(card.words.length).toBeLessThanOrEqual(3)
      const beat = beatAt(props, card.from)
      const box = leadBox(card, beat, props.aspect)
      // Inside the safe area (with the action rail rule), and never smaller than the house word.
      expect(insideRoom(box, { ...SAFE_TALL, bottom: Math.max(SAFE_TALL.bottom, FWP_SPLIT_SEAM_Y + WORD_CAPTION.tall.size * 0.6) }), card.words.map(w => w.text).join(' ')).toBe(true)
      expect(box.size).toBeGreaterThanOrEqual(LEAD.minSize)
      if (beat.layout === 'SPLIT') {
        // On the seam, never further below it than the house word caption reaches.
        expect(box.top + box.height).toBeLessThanOrEqual(FWP_SPLIT_SEAM_Y + WORD_CAPTION.tall.size * 0.6 + 0.5)
      } else {
        // His take full frame or a graphics beat: in the face beats' off-face caption zone, inside the safe bottom.
        expect(box.top).toBeGreaterThanOrEqual(LEAD.tallFaceTop)
        expect(box.top + box.height).toBeLessThanOrEqual(SAFE_TALL.bottom + 0.5)
      }
    }
  })

  it('line-boil: boils stroked shapes only, never text, a new seed every 2 frames', () => {
    const props = thursday('line-boil')
    for (let frame = 0; frame < props.durationFrames; frame += 37) {
      const nodes = draw(props, frame)
      const markup = [...deviceMarkup(nodes), ...ofType(nodes, SketchFrame).map(n => renderToStaticMarkup(React.createElement(SketchFrame, n.props as never)))].join('')
      // Every element that takes the boil is a path; no CSS filter boils an HTML box of type.
      for (const m of markup.matchAll(/<(\w+)[^>]*filter="url\(#boil[^"]*\)"/g)) expect(m[1]).toBe('path')
      expect(markup).not.toMatch(/filter:\s*url\(#boil/)
      expect(markup).not.toMatch(/<text[^>]*filter=/)
    }
    // The scribble boils while it draws.
    const proof = deviceMarkup(draw(props, 470)).join('')
    expect(proof).toContain('data-boil')
    expect(ofType(draw(props, 470), SketchFrame)).toHaveLength(1)
    expect(boilSeed(10, 0, 2)).toBe(boilSeed(10, 1, 2))
    expect(boilSeed(10, 2, 2)).toBe(11)
    expect(new Set(Array.from({ length: 40 }, (_, f) => boilSeed(10, f, 2))).size).toBe(20)
  })

  it('every new mode is the same on every render of the same frame', () => {
    for (const style of FIVE) {
      const props = thursday(style)
      for (const frame of [30, 210, 430, 610]) {
        const once = draw(props, frame)
        const twice = draw(props, frame)
        const render = (nodes: ReturnType<typeof elements>) => [...deviceMarkup(nodes),
          ...nodes.filter(n => (OVERLAYS as readonly unknown[]).includes(n.type)).map(n => renderToStaticMarkup(React.createElement(n.type as React.FC, n.props)))].join('')
        expect(render(once)).toBe(render(twice))
      }
    }
  })

  it('resolves each of the five from its style id', () => {
    for (const id of FIVE) expect(resolveMotion({ style: id })).toEqual(MOTION_PROFILES[id])
  })
})
