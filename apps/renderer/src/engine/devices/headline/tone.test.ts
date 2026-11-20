import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { ParamsSchema } from './schema'

/** The platform walkthrough's two-tone headline (kept as it is: Krish, 2026-11-20): cream lines, one word in mint with no
 *  box, each word sharpening from blur 4 frames apart, never a move. */
const object = EngineObjectSchema.parse({
  obj: 'h', device: 'headline', meaning: 'two-tone platform-walkthrough headline',
  params: { lines: ['IT FILED', 'CHAPTER 11'], tone: [{ line: 1, word: 1 }], reveal: 'blur', shadow: true },
  fromFrame: 0, toFrame: 120,
})
const events = [{ id: 'in', obj: 'h', verb: 'enter', toState: 'visible', atFrame: 10 }].map(e => EngineEventSchema.parse(e))
const html = (frame: number) => renderToStaticMarkup(React.createElement(Device, { ...overlayTestProps, object, events, frame, aspect: '9:16',
  box: { left: 0, top: 0, width: 1080, height: 1920 } }))

describe('headline: per-word tone and the word blur-in', () => {
  it('draws the toned word in mint, with no box behind it', () => {
    const markup = html(60)
    expect(markup).toContain('data-tone="mint"')
    expect(markup).toContain(`color:${overlayTestProps.tokens.mint}`)
    expect(markup).not.toContain('skewX(') // the swipe box is not drawn
  })
  it('sharpens each word from 8 px over 3 frames, 4 frames apart', () => {
    expect(html(10)).toContain('blur(8.00px)')
    const later = html(10 + 4 * 3 + 1) // the fourth word, one frame in
    expect(later).toContain('blur(5.33px)')
    expect(html(60)).not.toContain('blur(')
  })
  it('refuses a tone on a word that is not there, and is off by default', () => {
    expect(() => ParamsSchema.parse({ lines: ['ONE'], tone: [{ line: 0, word: 3 }] })).toThrow()
    expect(ParamsSchema.parse({ lines: ['ONE'] }).tone).toBeUndefined()
  })
})
