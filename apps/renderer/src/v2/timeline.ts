import type { V2RenderProps, V2RuntimeLayer, V2RuntimeShot } from './props'

export interface CropFrame {
  x: number
  y: number
  width: number
  height: number
  rotationDegrees: number
}

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value))

const smoothstep = (value: number): number => {
  const bounded = clamp(value, 0, 1)
  return bounded * bounded * (3 - 2 * bounded)
}

const easingProgress = (progress: number, easing: V2RuntimeShot['camera']['easing']): number => {
  if (easing === 'hold') return 0
  if (easing === 'ease_in') return progress * progress
  if (easing === 'ease_out') return 1 - (1 - progress) * (1 - progress)
  if (easing === 'ease_in_out' || easing === 'spring') return smoothstep(progress)
  return progress
}

export function cameraCropAt(shot: V2RuntimeShot, atMs: number): CropFrame {
  const ordered = shot.camera.keyframes
  const before = [...ordered].reverse().find((keyframe) => keyframe.atMs <= atMs) ?? ordered[0]!
  const after = ordered.find((keyframe) => keyframe.atMs >= atMs) ?? ordered.at(-1)!
  const span = after.atMs - before.atMs
  const rawProgress = span <= 0 ? 0 : (atMs - before.atMs) / span
  const progress = easingProgress(rawProgress, shot.camera.easing)
  const between = (left: number, right: number) => left + (right - left) * progress
  return {
    x: between(before.crop.x, after.crop.x),
    y: between(before.crop.y, after.crop.y),
    width: between(before.crop.width, after.crop.width),
    height: between(before.crop.height, after.crop.height),
    rotationDegrees: between(before.rotationDegrees, after.rotationDegrees),
  }
}

export function defaultLayerBounds(layer: V2RuntimeLayer): CropFrame {
  if (layer.bounds) return { ...layer.bounds, rotationDegrees: 0 }
  switch (layer.anchor) {
    case 'top_left': return { x: 0.045, y: 0.11, width: 0.46, height: 0.38, rotationDegrees: 0 }
    case 'top_right': return { x: 0.495, y: 0.11, width: 0.46, height: 0.38, rotationDegrees: 0 }
    case 'left': return { x: 0.035, y: 0.18, width: 0.47, height: 0.58, rotationDegrees: 0 }
    case 'right': return { x: 0.495, y: 0.18, width: 0.47, height: 0.58, rotationDegrees: 0 }
    case 'center': return { x: 0.065, y: 0.2, width: 0.87, height: 0.52, rotationDegrees: 0 }
    case 'bottom': return { x: 0.055, y: 0.57, width: 0.89, height: 0.27, rotationDegrees: 0 }
    case 'gesture': return { x: 0.51, y: 0.2, width: 0.43, height: 0.42, rotationDegrees: 0 }
    case 'tracked_region': return { x: 0.08, y: 0.18, width: 0.84, height: 0.56, rotationDegrees: 0 }
    default: return { x: 0, y: 0, width: 1, height: 1, rotationDegrees: 0 }
  }
}

export function primaryAttentionLayerId(shot: V2RuntimeShot): string | null {
  if (shot.primaryAttentionTarget.kind === 'none') return null
  const explicitTarget = shot.primaryAttentionTarget.targetId
  if (explicitTarget) {
    const matched = shot.layers
      .filter((layer) => layer.targetId === explicitTarget)
      .sort((left, right) => right.zIndex - left.zIndex)[0]?.layerId
    if (matched) return matched
  }
  if (shot.primaryAttentionTarget.kind === 'presenter' || shot.primaryAttentionTarget.kind === 'guest') {
    return shot.layers
      .filter((layer) => (layer.kind === 'source' || layer.kind === 'subject_cutout') && (layer.targetId === shot.sourceId || !layer.targetId))
      .sort((left, right) => right.zIndex - left.zIndex)[0]?.layerId ?? null
  }
  if (shot.primaryAttentionTarget.kind === 'typography') return shot.layers.find((layer) => layer.kind === 'caption' || layer.kind === 'annotation')?.layerId ?? null
  if (shot.primaryAttentionTarget.kind === 'environment') return shot.layers.find((layer) => layer.kind === 'source' || layer.kind === 'background')?.layerId ?? null
  return null
}

export function transitionOpacity(shot: V2RuntimeShot, atMs: number, transitionMs = 160): number {
  const local = atMs - shot.startMs
  const remaining = shot.endMs - atMs
  const fadesIn = ['dissolve', 'fade', 'whip', 'portal'].includes(shot.transitionIn)
  const fadesOut = ['dissolve', 'fade', 'whip', 'portal'].includes(shot.transitionOut)
  const entrance = fadesIn ? clamp(local / transitionMs, 0, 1) : 1
  const exit = fadesOut ? clamp(remaining / transitionMs, 0, 1) : 1
  return Math.min(entrance, exit)
}

export function deterministicUnit(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

export function sourceStartForShot(shot: V2RuntimeShot, targetSourceId: string, sources: V2RenderProps['sources']): number {
  const primary = sources.find((source) => source.sourceId === shot.sourceId)
  const target = sources.find((source) => source.sourceId === targetSourceId)
  if (!primary || !target) throw new Error(`cannot synchronize unknown source ${targetSourceId}`)
  const canonicalStartMs = shot.sourceStartMs + primary.canonicalOffsetMs
  return Math.max(0, canonicalStartMs - target.canonicalOffsetMs)
}
