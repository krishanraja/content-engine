import { EXIT, FPS, drift, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import type { Box } from '../types'
import { ParamsSchema } from './schema'

const WIPE_IN = 0.45 * FPS
const WIPE_OUT = 0.35 * FPS
const DRAW = 0.35 * FPS
const MOVE = 0.4 * FPS
const REGION_SHARE = 0.55
const MAX_ZOOM = 1.6
const CENTRE = { x: 0.5, y: 0.5 }

type Picture = { pixelWidth: number; pixelHeight: number }
type Size = Pick<Box, 'width' | 'height'>
type Focus = { x: number; y: number }
type Region = Focus & { w: number; h: number }
type Camera = { focus: Focus; zoom: number }

function coverScale(picture: Picture, box: Size): number {
  return Math.max(box.width / picture.pixelWidth, box.height / picture.pixelHeight)
}

/** A cover crop in box-local pixels, with the push anchored to the visible point of focus. */
export function coverCrop(picture: Picture, box: Size, focus = CENTRE, push = 0, zoom = 1): Box {
  const scale = coverScale(picture, box) * zoom
  const width = scale * picture.pixelWidth
  const height = scale * picture.pixelHeight
  const offset = (slot: number, picture: number, fraction: number) =>
    Math.min(0, Math.max(slot - picture, slot / 2 - fraction * picture))
  return {
    left: offset(box.width, width, focus.x) - push * focus.x * width,
    top: offset(box.height, height, focus.y) - push * focus.y * height,
    width: width * (1 + push),
    height: height * (1 + push),
  }
}

function moveCamera(from: Camera, to: Camera, elapsed: number): Camera {
  const t = progress(elapsed, MOVE)
  if (t <= 0) return from
  if (t >= 1) return to
  const mix = (a: number, b: number) => a + (b - a) * t
  return { focus: { x: mix(from.focus.x, to.focus.x), y: mix(from.focus.y, to.focus.y) },
    zoom: mix(from.zoom, to.zoom) }
}

/** Camera poses hold between cues. The ambient push runs on the plate's original clock. */
export function photoPlateCrop(box: Size, state: ReturnType<typeof photoPlateState>): Box {
  const { params, moves, cameraFrame, push } = state
  const picture = 'video' in params ? params.video : params.image
  const base = coverCrop(picture, box, params.focus, push)
  if (!moves.length) return base

  // Start at the actual crop centre, including any edge clamp and the push already in progress.
  const initial = {
    focus: { x: (box.width / 2 - base.left) / base.width, y: (box.height / 2 - base.top) / base.height },
    zoom: 1,
  }
  const cover = coverScale(picture, box)
  const shortIsWidth = box.width <= box.height
  const shortSide = shortIsWidth ? box.width : box.height
  let from = initial
  let to = from
  let start = state.playbackFrom
  for (const { atFrame, region } of moves) {
    from = moveCamera(from, to, atFrame - start)
    const regionSpan = shortIsWidth ? region.w * picture.pixelWidth : region.h * picture.pixelHeight
    const zoom = REGION_SHARE * shortSide / (regionSpan * cover)
    to = {
      focus: { x: region.x + region.w / 2, y: region.y + region.h / 2 },
      zoom: Math.min(MAX_ZOOM, Math.max(from.zoom, zoom)),
    }
    start = atFrame
  }
  const camera = moveCamera(from, to, cameraFrame - start)
  if (camera === initial) return base
  const zoom = Math.min(MAX_ZOOM, camera.zoom * (1 + push))
  return coverCrop(picture, box, camera.focus, 0, zoom)
}

export function photoPlateState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const { fired } = stateAt(events, object.obj, frame)
  const enter = fired.findLast(event => event.verb === 'enter')
  const cue = fired.findLast(event => event.verb === 'enter' || event.verb === 'exit')
  const exit = cue?.verb === 'exit' ? cue : undefined
  // stateAt pre-rolls opening entrances so they land on the hook. Playback and the push still start at frame zero.
  const playbackFrom = Math.max(0, enter?.atFrame ?? 0)
  const nextExit = exit ?? stateAt(events, object.obj, Infinity).fired.find(event =>
    event.verb === 'exit' && event.atFrame > frame)
  const pushEnd = Math.min(object.toFrame, nextExit?.atFrame ?? object.toFrame)
  const cameraFrame = Math.min(frame, pushEnd)
  const entered = enter?.toState === 'wipe'
    ? Math.min(1, progress(cameraFrame - enter.atFrame, WIPE_IN)) : 1
  const remaining = exit ? exit.toState === 'wipe' ? 1 - progress(frame - exit.atFrame, WIPE_OUT, EXIT) : 0 : 1
  const reveal = entered * remaining

  const mark = fired.findLast(event => event.verb === 'mark')
  const region = mark && mark.toState !== 'none' && Object.hasOwn(params.regions, mark.toState)
    ? params.regions[mark.toState] : undefined
  if (mark && mark.toState !== 'none' && !region) throw new Error('photo_plate mark needs a named region or none')

  const moves = fired.filter(event =>
    event.verb === 'move' && event.atFrame >= playbackFrom && event.atFrame <= cameraFrame).map(event => {
    const target: Region | undefined = Object.hasOwn(params.regions, event.toState) ? params.regions[event.toState] : undefined
    if (!target) throw new Error('photo_plate move needs a named region')
    return { atFrame: event.atFrame, region: target }
  })

  return {
    params,
    visible: !!enter && frame >= object.fromFrame && frame < object.toFrame && remaining > 0,
    playbackFrom,
    reveal,
    push: drift(frame, playbackFrom, pushEnd, params.push * 100),
    cameraFrame,
    moves,
    region,
    drawn: region && mark ? Math.min(1, progress(frame - mark.atFrame, DRAW)) : 0,
  }
}
