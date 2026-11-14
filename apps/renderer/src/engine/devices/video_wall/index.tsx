import React from 'react'
import { Img, OffthreadVideo, Sequence } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import { MOTION } from '../../clock'
import { RegionFit } from '../../kit/regionFit'
import type { DeviceProps } from '../types'
import { videoWallState } from './state'

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = videoWallState(object, events, frame)
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
  const content = <div data-device="video_wall" style={{ position: 'relative', ...natural, opacity: s.opacity }}>
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
