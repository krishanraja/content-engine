import React from 'react'
import { Img, OffthreadVideo, Sequence } from 'remotion'
import { z } from 'zod'
import { Screen, GW, GH } from '../phoneGlass'
import type { Point } from '../homography'
import type { GlassProps } from '../glassRegistry'
import { Frame, scale, Text } from './shared'

export const FootageParams = z.object({ src: Text, kind: z.enum(['image', 'recording', 'video']).optional(),
  pixelWidth: z.number().positive().default(1087), pixelHeight: z.number().positive().default(780),
  trimBefore: Frame.default(0), underline: z.object({ x: z.number().finite(), y: z.number().finite(), w: z.number().positive() }).optional(),
})
export type FootageInput = z.input<typeof FootageParams>
export function footageLayout(params: FootageInput, k: number) {
  const p = FootageParams.parse(params), s = 1.14, W = GW * scale(k), H = GH * k
  return { p, s, cx: W - 372 * s, cy: H / 2, width: p.pixelWidth * s, height: p.pixelHeight * s }
}
/** The exact same centre/scale/clockwise rotation as the source element. */
export function footagePointToCanvas(screen: Screen, params: FootageInput, x: number, y: number): Point {
  const l = footageLayout(params, screen.cam.k)
  return screen.u2c(l.cx - (y - l.p.pixelHeight / 2) * l.s, l.cy + (x - l.p.pixelWidth / 2) * l.s)
}
export function Footage({ params, frame, sinceFrames, k }: GlassProps) {
  const l = footageLayout(params as FootageInput, k), p = l.p
  const style: React.CSSProperties = { position: 'absolute', left: l.cx - l.width / 2, top: l.cy - l.height / 2,
    width: l.width, height: l.height, maxWidth: 'none', transform: 'rotate(90deg)', transformOrigin: '50% 50%' }
  const video = p.kind === 'recording' || p.kind === 'video' || (!p.kind && /\.(mp4|webm|mov)(?:[?\u0023]|$)/i.test(p.src))
  return <div data-glass="footage" data-grain-hole="" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
    {video ? <Sequence from={frame - sinceFrames} layout="none"><OffthreadVideo muted src={p.src} trimBefore={p.trimBefore} style={style} /></Sequence>
      : <Img src={p.src} style={style} />}
  </div>
}
