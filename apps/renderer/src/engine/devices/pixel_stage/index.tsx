import React, { useEffect, useState } from 'react'
import { cancelRender, continueRender, delayRender } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { stageState } from './state'
export { stageLayout, stageState } from './state'

type Raster = { width: number; height: number; data: ArrayLike<number> }
type Pixel = { x: number; y: number; color: string }
/** Map each downsampled evidence pixel to one of the three brand roles, without interpolation. */
export function palettePixels(raster: Raster, tokens: DeviceProps['tokens']): Pixel[] {
  const out: Pixel[] = []
  for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
    const i = (y * raster.width + x) * 4
    if (raster.data[i + 3]! < 128) continue
    const light = .2126 * raster.data[i]! + .7152 * raster.data[i + 1]! + .0722 * raster.data[i + 2]!
    out.push({ x, y, color: light < 85 ? tokens.ink : light < 170 ? tokens.mint : tokens.cream })
  }
  return out
}
export type Rasters = Readonly<Record<string, Raster>>
export function pixelGeometry(p: DeviceProps, rasters: Rasters) {
  const s = stageState(p)
  const pixels = s.sprites.flatMap(sprite => {
    const raster = rasters[sprite.id]
    if (!raster) return []
    return palettePixels(raster, p.tokens).filter(q => q.y < Math.round(sprite.h * sprite.pop)).map(q => ({
      x: sprite.x + q.x, y: sprite.y + q.y + sprite.pose,
      color: sprite.mint ? p.tokens.mint : q.color,
    }))
  }).filter(q => q.x >= 0 && q.x < s.width && q.y >= (s.height * (1 - s.power) / 2) && q.y < s.height * (1 + s.power) / 2)
  return { ...s, pixels, labelX: Math.max(60 - p.box.left, s.x + 12), labelY: Math.max(300 - p.box.top, s.y + 42) }
}

/** Decode once per source/size. Remotion waits for the exact evidence pixels before capturing a frame. */
export function Device(p: DeviceProps) {
  const layout = stageState(p)
  const key = JSON.stringify(layout.sprites.map(s => [s.id, s.image.src, s.w, s.h]))
  const [loaded, setLoaded] = useState<{ key: string; rasters: Rasters }>({ key: '', rasters: {} })
  const [handle] = useState(() => delayRender('pixel_stage evidence'))
  useEffect(() => {
    let live = true
    const gate = delayRender('pixel_stage sampling')
    Promise.all(layout.sprites.map(async s => {
      const image = new Image(); image.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error(`Cannot decode pixel_stage evidence: ${s.image.src}`)); image.src = s.image.src })
      const canvas = document.createElement('canvas'); canvas.width = s.w; canvas.height = s.h
      const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0, s.w, s.h)
      return [s.id, ctx.getImageData(0, 0, s.w, s.h)] as const
    })).then(entries => { if (live) setLoaded({ key, rasters: Object.fromEntries(entries) }); continueRender(gate); continueRender(handle) }).catch(cancelRender)
    return () => { live = false; continueRender(gate) }
  }, [key, handle])
  return <StageSVG {...p} rasters={loaded.key === key ? loaded.rasters : {}} />
}
export function StageSVG(p: DeviceProps & { rasters: Rasters }) {
  const g = pixelGeometry(p, p.rasters)
  if (!g.visible) return null
  return <svg data-device="pixel_stage" width={p.box.width} height={p.box.height} style={{ position: 'absolute', left: p.box.left, top: p.box.top, overflow: 'hidden' }}>
    <g transform={`translate(${g.x} ${g.y}) scale(6)`} shapeRendering="crispEdges">
      <rect x={0} y={Math.ceil(g.height * (1 - g.power) / 2)} width={g.width} height={Math.floor(g.height * g.power)} fill={p.tokens.inkDeep} />
      {g.pixels.map((q, i) => <rect key={i} x={q.x} y={q.y} width={1} height={1} fill={q.color} />)}
    </g>
    {g.dataset && <g fill={p.tokens.cream} fontFamily={HOUSE_FONTS.data}>
      <text x={g.labelX} y={g.labelY} fontSize={30}>{g.score}{g.dataset.unit}</text>
      <text x={g.labelX} y={g.labelY + 30} fontSize={20} textLength={Math.min(760, g.dataset.producerLabel.length * 12)} lengthAdjust="spacingAndGlyphs">{g.dataset.producerLabel}</text>
    </g>}
  </svg>
}
/** Same sampled image data, palette, cell placement and sixfold logical grid as SVG. */
export function drawCanvas(ctx: CanvasRenderingContext2D, p: DeviceProps, rasters: Rasters) {
  const g = pixelGeometry(p, rasters)
  if (!g.visible) return
  ctx.save(); ctx.beginPath(); ctx.rect(p.box.left, p.box.top, p.box.width, p.box.height); ctx.clip()
  ctx.translate(p.box.left + g.x, p.box.top + g.y); ctx.scale(6, 6); ctx.imageSmoothingEnabled = false
  ctx.fillStyle = p.tokens.inkDeep; ctx.fillRect(0, Math.ceil(g.height * (1 - g.power) / 2), g.width, Math.floor(g.height * g.power))
  for (const q of g.pixels) { ctx.fillStyle = q.color; ctx.fillRect(q.x, q.y, 1, 1) }
  ctx.restore()
  if (g.dataset) {
    ctx.save(); ctx.fillStyle = p.tokens.cream; ctx.font = `30px "${HOUSE_FONTS.data}"`
    ctx.fillText(`${g.score}${g.dataset.unit}`, p.box.left + g.labelX, p.box.top + g.labelY)
    ctx.font = `20px "${HOUSE_FONTS.data}"`; ctx.fillText(g.dataset.producerLabel, p.box.left + g.labelX, p.box.top + g.labelY + 30, 760); ctx.restore()
  }
}
