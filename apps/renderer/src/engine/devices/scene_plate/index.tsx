import React from 'react'
import { Img, OffthreadVideo, Sequence } from 'remotion'
import { FPS } from '../../clock'
import type { DeviceProps } from '../types'
import { cameraPose, coverRect, sceneState } from './state'
export { coverRect } from './state'

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = sceneState(object, events, frame)
  if (!s.visible) return null
  const canvas = aspect === '9:16' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }
  const area = s.params.full ? { left: 0, top: 0, ...canvas } : box
  const { width: w, height: h } = area, shot = s.params.shots[s.index]!
  const crop = coverRect(shot, w, h), pose = cameraPose(s.params.camera, s.cameraProgress, frame - s.start, w, h, shot.focus)
  const style: React.CSSProperties = { position: 'absolute', left: crop.x, top: crop.y, width: crop.width, height: crop.height, maxWidth: 'none' }
  const ox = crop.x + shot.focus.x * crop.width, oy = crop.y + shot.focus.y * crop.height
  // Clamp translation after the focus-centred zoom so even edge focuses cannot uncover the box.
  const margin = s.params.camera === 'handheld' ? .007 * Math.max(w, h) : 0
  const tx = Math.min(-margin - crop.x * pose.scale, Math.max(w + margin - (crop.x + crop.width) * pose.scale, ox * (1 - pose.scale) + pose.x))
  const ty = Math.min(-margin - crop.y * pose.scale, Math.max(h + margin - (crop.y + crop.height) * pose.scale, oy * (1 - pose.scale) + pose.y))
  return <div data-device="scene_plate" data-shot={s.index} style={{ position: 'absolute', ...area, overflow: 'hidden', background: tokens.inkDeep }}>
    <div data-camera="" style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${pose.scale})` }}>
      <div style={{ position: 'absolute', inset: 0, transform: `rotate(${pose.rotation}deg)` }}>
        {shot.kind === 'image' ? <Img src={shot.src} style={style} /> : <Sequence key={`${s.index}-${s.start}`} from={s.start} layout="none"><OffthreadVideo src={shot.src} muted trimBefore={Math.round(shot.from_s * FPS)} style={style} /></Sequence>}
      </div>
    </div>
    <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
      {s.params.grade === 'hud' && <>
        <g stroke={tokens.inkDeep} opacity={.1}>{Array.from({ length: Math.ceil(h / 4) }, (_, i) => <path key={i} d={`M0 ${i * 4} H${w}`} />)}</g>
        <path d={`M40 88 V40 H88 M${w - 88} 40 H${w - 40} V88 M40 ${h - 88} V${h - 40} H88 M${w - 88} ${h - 40} H${w - 40} V${h - 88}`} fill="none" stroke={tokens.mint} strokeWidth={2} />
      </>}
      {s.wipe && <rect data-wipe="" y={s.wipeProgress * (h - 4)} width={w} height={4} fill={tokens.mint} opacity={.3} />}
    </svg>
  </div>
}
