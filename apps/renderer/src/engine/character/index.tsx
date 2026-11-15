import { Img } from 'remotion'
import type { EngineRenderProps } from '../props'
import { drift, progress, MOTION } from '../clock'

export function Device(): never { throw new Error('character_layer is a cut layer, never a beat object') }
type Track = NonNullable<EngineRenderProps['character']>
function hash(s: string): number {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}
export function characterState(track: Track, frame: number) {
  const pose = [...track.poses].reverse().find(p => p.fromFrame <= frame)
  if (!pose) return null
  const blink = track.blinks.some(f => frame >= f && frame < f + 4)
  const state = blink ? 'blink' : track.mouth[frame] ? 'open' : 'closed'
  let start = track.poses[0]!.fromFrame, n = 0
  let length = 90 + hash(`${track.seed}:${n}`) / 4294967296 * 45
  while (start + length < frame) {
    start += length
    length = 90 + hash(`${track.seed}:${++n}`) / 4294967296 * 45
  }
  const breath = progress(frame-start, length, t => Math.sin(t*Math.PI)**2) * 3
  const rise = pose === track.poses[0] ? (1-progress(frame-pose.fromFrame, MOTION.enterFrames)) * 650 : 0
  const dip = pose === track.poses[0] ? 0 : (1-progress(frame-pose.fromFrame, MOTION.dropFrames)) * 6
  return { src: track.images[pose.pose]![state], left: pose.x-pose.width/2 + drift(frame, track.poses[0]!.fromFrame, track.mouth.length, 0.3) * 570,
    top: 1985+pose.sinkPx-570 + rise+dip-breath, width: pose.width }
}
export function CharacterLayer({ track, frame }: { track: Track; frame: number }) {
  const state = characterState(track, frame)
  if (!state) return null
  return <Img src={state.src} style={{ position: 'absolute', left: state.left, top: state.top, width: state.width, height: 570 }} />
}
