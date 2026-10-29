import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('remotion', async (original) => ({
  ...await original<typeof import('remotion')>(),
  Img: (p: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', p),
}))
import { ACTIVE_CANVAS, setActiveCanvas } from './lock'
import { canvasRect } from './overlay'
import { Scribble } from './Scribble'

const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'green', channel: 'coral' }
afterEach(() => setActiveCanvas(1080, 1920))

describe('the active canvas', () => {
  it('is the tall canvas until a wide cut sets it', () => {
    expect([ACTIVE_CANVAS.w, ACTIVE_CANVAS.h]).toEqual([1080, 1920])
    expect(() => canvasRect(900, 100, 300, 100)).toThrow(/1080x1920/)
  })
  it('lets a wide cut place overlays on 1920x1080 and still refuses what leaves it', () => {
    setActiveCanvas(1920, 1080)
    expect(canvasRect(1500, 900, 300, 100).left).toBe(1500)
    expect(() => canvasRect(1700, 900, 300, 100)).toThrow(/1920x1080/)
    expect(() => canvasRect(100, 1000, 100, 100)).toThrow(/1920x1080/)
  })
  it('draws the scribble layer on the active canvas', () => {
    setActiveCanvas(1920, 1080)
    const markup = renderToStaticMarkup(React.createElement(Scribble, { d: 'M0 0 L10 10', colour: 'cream', tokens, sinceFrames: 20 }))
    expect(markup).toContain('width="1920"')
    expect(markup).toContain('viewBox="0 0 1920 1080"')
  })
})
