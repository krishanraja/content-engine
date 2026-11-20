import React from 'react'
import { Img, OffthreadVideo, Sequence } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import { MOTION } from '../../clock'
import { isRegion } from '../../kit/layout'
import { RegionFit } from '../../kit/regionFit'
import type { DeviceProps } from '../types'
import { videoWallState } from './state'

/** The tiled UI wall (mode 'tiles'): his own screen grabs cycled across the whole box in rows, drifting up 0.6 px a frame
 *  (never still), under an ink scrim 55% to 72%, the mono source line under it. It fades in on its entrance; no tilt, no
 *  slam: the platform walkthrough's grammar is fade and rise. */
export const TILES = { drift: 0.6, gap: 14, columns: { '9:16': 5, '16:9': 8 }, ratio: 0.78, scrim: [0.55, 0.72], fadeFrames: 8 } as const

function TileWall({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = videoWallState(object, events, frame)
  if (!s.visible) return null
  const region = isRegion(box)
  const natural = aspect === '9:16' ? { width: 1080, height: 1000 } : { width: 1312, height: 1080 }
  const w = region ? natural.width : box.width, h = region ? natural.height : box.height
  const columns = s.params.columns ?? TILES.columns[aspect]
  const tileW = (w - (columns + 1) * TILES.gap) / columns, tileH = tileW * TILES.ratio
  const pitch = tileH + TILES.gap
  const start = Math.min(...s.tiles.map(t => t.start))
  const age = Math.max(0, frame - start)
  const travel = age * TILES.drift
  const shift = Math.floor(travel / pitch)
  const rows = Math.ceil(h / pitch) + 1
  const clips = s.params.clips
  const tiles = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    // Each row is offset by half a clip, so the same grab never sits under itself.
    const clip = clips[((r + shift) * 3 + c + (r + shift) % 2) % clips.length]!
    tiles.push(<div key={`${r}-${c}`} data-tile={clip.id} style={{ position: 'absolute', left: TILES.gap + c * (tileW + TILES.gap),
      top: TILES.gap + r * pitch - (travel - shift * pitch), width: tileW, height: tileH, borderRadius: 10, overflow: 'hidden', background: tokens.inkSoft }}>
      <Img src={clip.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>)
  }
  const content = <div data-device="video_wall" data-mode="tiles" style={{ position: 'absolute', left: region ? 0 : box.left, top: region ? 0 : box.top,
    width: w, height: h, overflow: 'hidden', background: tokens.ink, opacity: s.opacity * Math.min(1, age / TILES.fadeFrames) }}>
    {tiles}
    <div data-scrim style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, color-mix(in srgb, ${tokens.ink} ${TILES.scrim[0] * 100}%, transparent), color-mix(in srgb, ${tokens.ink} ${TILES.scrim[1] * 100}%, transparent))` }} />
    <div data-source="" style={{ position: 'absolute', left: aspect === '9:16' ? 72 : 96, bottom: 24, color: tokens.cream, opacity: 0.75,
      fontFamily: HOUSE_FONTS.data, fontSize: 22, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{clips[0]!.source}</div>
  </div>
  return region ? <RegionFit natural={natural} box={box}>{content}</RegionFit> : content
}

export function Device(props: DeviceProps) {
  const { object, events, box, tokens, aspect, frame } = props
  const s = videoWallState(object, events, frame)
  if (s.params.mode === 'tiles') return <TileWall {...props} />
  if (!s.visible) return null
  // Independently authored stage sizes; padding includes the 4-degree tilt and hard drop.
  const natural = aspect === '9:16' ? { width: 800, height: 600 } : { width: 1440, height: 720 }
  const pad = aspect === '9:16' ? 36 : 48
  const gap = 24 // design-lock grid gutter
  const label = 36 // design-lock card-name role; sources remain legible at natural size
  const innerW = natural.width - 2 * pad
  const innerH = natural.height - 2 * pad - (object.dataset ? 42 : 0)
  const tileW = (innerW - 2 * gap) / 3
  const tileH = (innerH - gap) / 2
  const content = <div data-device="video_wall" style={{ position: 'relative', ...natural, ...(isRegion(box) ? { overflow: 'hidden' as const } : {}), opacity: s.opacity }}>
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${s.push})`, transformOrigin: 'center' }}>
      {s.params.clips.map((clip, i) => {
        const tile = s.tiles[i]!
        if (!tile.visible) return null
        const row = Math.floor(i / 3), col = i - row * 3
        const r = s.params.mode === 'placed' ? clip.placement! : undefined
        const width = r ? r.w * innerW : tileW
        const height = r ? r.h * innerH : tileH
        const mediaStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' }
        return <div key={clip.id} data-tile={clip.id} data-start={tile.start} style={{ position: 'absolute',
          left: pad + (r ? r.x * innerW : col * (tileW + gap)),
          top: pad + (r ? r.y * innerH : row * (tileH + gap)), width, height,
          boxSizing: 'border-box', border: `6px solid ${tokens.cream}`, background: tokens.ink,
          boxShadow: `8px 10px 0 ${tokens.inkDeep}`,
          transform: `translateY(${MOTION.risePx * (1 - tile.slam)}px) rotate(${clip.tilt * tile.slam}deg)`,
          overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, bottom: label + 6 }}>
            {clip.kind === 'image' ? <Img src={clip.src} style={mediaStyle} /> :
              <Sequence from={tile.start} layout="none">
                <OffthreadVideo src={clip.src} muted trimBefore={clip.trimBeforeFrames} style={mediaStyle} />
              </Sequence>}
          </div>
          <div data-source="" style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
            background: tokens.cream, color: tokens.ink, fontFamily: HOUSE_FONTS.data,
            fontSize: 30, lineHeight: `${label}px`, padding: '0 6px', whiteSpace: 'nowrap' }}>{clip.source}</div>
        </div>
      })}
    </div>
    {object.dataset && <div data-producer="" style={{ position: 'absolute', bottom: 0, left: pad,
      color: tokens.cream, fontFamily: HOUSE_FONTS.data, fontSize: 30 }}>{object.dataset.producerLabel}</div>}
  </div>
  // Ordinary slots shrink only; region slots may grow and centre through RegionFit.
  return <RegionFit natural={natural} box={box}>{content}</RegionFit>
}
