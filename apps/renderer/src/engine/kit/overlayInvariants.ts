import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect } from 'vitest'
import { HOUSE_FONTS } from '../../house/geometry'
import type { EngineObject, EngineEvent } from '../props'
import type { DeviceComponent, DeviceProps } from '../devices/types'

export const overlayTestProps: Pick<DeviceProps, 'box' | 'tokens' | 'aspect'> = {
  box: { left: 0, top: 0, width: 1080, height: 1920 }, aspect: '9:16',
  tokens: { ink: 'black', inkDeep: 'navy', inkSoft: 'gray', cream: 'ivory', mint: 'aquamarine', channel: 'coral' },
}
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

/** One static-render contract for all overlays, including inherited type roles.
 * Marquee children can exceed the canvas only inside their clipped band. */
export function assertOverlayMarkup(markup: string, id: string) {
  const tokens = Object.values(overlayTestProps.tokens)
  expect(markup).not.toMatch(/blur\(/i)
  expect(markup).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
  const stack: { font: string | undefined; uppercase: boolean; x: number; y: number; clipped: boolean }[] = []
  for (const match of markup.matchAll(/<\/?[^>]+>|[^<]+/g)) {
    const tag = match[0]
    if (tag.startsWith('</')) { stack.pop(); continue }
    if (!tag.startsWith('<')) {
      const context = stack.at(-1)
      if (context?.font === HOUSE_FONTS.display && !context.uppercase)
        expect(decode(tag)).toBe(decode(tag).toUpperCase())
      continue
    }
    const css = decode(tag.match(/style="([^"]*)"/)?.[1] ?? '')
    const styles = Object.fromEntries(css.split(';').filter(Boolean).map(s => { const i = s.indexOf(':'); return [s.slice(0, i), s.slice(i + 1)] }))
    const parent = stack.at(-1)
    const font = styles['font-family'] ?? parent?.font
    if (styles['font-family']) expect(Object.values(HOUSE_FONTS)).toContain(styles['font-family'])
    if (styles['font-size']) expect(parseFloat(styles['font-size'])).toBeGreaterThanOrEqual(30)
    for (const key of ['color', 'background', 'background-color', 'border-color'])
      if (styles[key]) expect(tokens).toContain(styles[key])
    for (const key of ['fill', 'stroke']) {
      const color = tag.match(new RegExp(`\\s${key}="([^"]+)"`))?.[1]
      if (color) expect(tokens).toContain(color)
    }
    if (styles['box-shadow']) {
      const lengths = styles['box-shadow'].match(/-?\d+(?:\.\d+)?(?:px)?/g) ?? []
      expect(parseFloat(lengths[2] ?? '0')).toBe(0)
    }
    if (id === 'headline') expect(styles.transform ?? '').not.toContain('rotate')
    const rotation = styles.transform?.match(/rotate\((-?[\d.]+)deg\)/)
    if (rotation) {
      expect(Number(rotation[1])).toBeGreaterThanOrEqual(id === 'sticker' ? -8 : -6)
      expect(Number(rotation[1])).toBeLessThanOrEqual(id === 'sticker' ? 5 : 6)
    }
    if (id === 'stamp' && styles.border) expect(styles.border).toMatch(/^3px /)
    const x = (parent?.x ?? 0) + parseFloat(styles.left ?? '0')
    const y = (parent?.y ?? 0) + parseFloat(styles.top ?? '0')
    if (styles.position === 'absolute' && !parent?.clipped) {
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0)
      expect(x + parseFloat(styles.width ?? '0')).toBeLessThanOrEqual(1080)
      expect(y + parseFloat(styles.height ?? '0')).toBeLessThanOrEqual(1920)
    }
    stack.push({ font, uppercase: styles['text-transform'] === 'uppercase' || !!parent?.uppercase,
      x, y, clipped: styles.overflow === 'hidden' || !!parent?.clipped })
  }
}

export function assertOverlayInvariants(Device: DeviceComponent, object: EngineObject, events: readonly EngineEvent[], id: string) {
  const render = (frame: number) => renderToStaticMarkup(React.createElement(Device, { ...overlayTestProps, object, events, frame }))
  expect(render(9)).toBe('')
  expect(render(40)).not.toBe('')
  assertOverlayMarkup(render(40), id)
  expect(render(106)).toBe('')
  expect(renderToStaticMarkup(React.createElement(Device, { ...overlayTestProps, object, events: [], frame: 40 }))).toBe('')
}
