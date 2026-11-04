import type { Box } from '../devices/types'
import { FWP_SPLIT_SEAM_Y } from '../mocks/face-with-proof'

/** The two channels a device reports to the camera, and the arithmetic the camera does with them.
 *
 *  - Focus (living-ui's zoomToFocus): the one line that proves the words, in frame pixels: the typed line of a
 *    typing_bubble, the chip of a query_chip. The camera zooms to it (up to the profile's scale), keeps it inside the
 *    channel safe area (config/channel-safe-zones.json, scripts/velib/qc_channel.py) and off his face, and lets the
 *    card's own edges leave the frame.
 *  - Pen (single-line-drawing's followPen): the tip of a scribble's line, frame by frame, measured along the path the
 *    scribble already draws. The camera follows it with a damped follow and never shows past the canvas.
 *
 *  Devices answer through pure functions (devices/focus.ts), so the composition reads them before it draws. */

export type Point = readonly [number, number]

/** A focus a device reports. `since`: frames since this focus began. `from`: the focus it moves on from (the line
 *  typed before), so the camera travels from one line to the next instead of jumping. */
export interface Focus { rect: Box; since: number; from?: Box }

/** Tall canvas, from config/channel-safe-zones.json (the strictest of Instagram, TikTok and YouTube Shorts): nothing to
 *  read above y 200 (top bars) or below y 1320 (handle and caption), nor right of x 860 below y 520 (the action rail).
 *  Wide: title safe, 5% each side. */
export const SAFE_TALL = { left: 60, top: 200, right: 1020, bottom: 1320, rail: { fromY: 520, right: 860 } } as const
export const SAFE_WIDE = { left: 96, top: 54, right: 1824, bottom: 1026 } as const

export interface Room { left: number; top: number; right: number; bottom: number; rail?: { fromY: number; right: number } }

/** Where a zoomed focus may sit on this beat: the channel safe area, cut to the band the graphics own. A SPLIT beat's
 *  graphics end at the seam and his face is below it (the captions.off_face rule: never on the face). On a beat that
 *  shows his take full frame behind graphics, the focus stays inside the layout's own slots, which the layouts keep
 *  off his face. */
export function focusRoom(aspect: '9:16' | '16:9', layout: string, takeBehind: boolean, slots: readonly Box[]): Room {
  const safe: Room = aspect === '9:16' ? { ...SAFE_TALL, rail: { ...SAFE_TALL.rail } } : { ...SAFE_WIDE }
  if (layout === 'SPLIT') return { ...safe, bottom: Math.min(safe.bottom, FWP_SPLIT_SEAM_Y) }
  if (takeBehind && layout !== 'STAGE' && slots.length) {
    const band = slots.reduce((a, s) => ({ left: Math.min(a.left, s.left), top: Math.min(a.top, s.top),
      right: Math.max(a.right, s.left + s.width), bottom: Math.max(a.bottom, s.top + s.height) }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })
    return { ...safe, left: Math.max(safe.left, band.left), top: Math.max(safe.top, band.top),
      right: Math.min(safe.right, band.right), bottom: Math.min(safe.bottom, band.bottom),
      ...(safe.rail ? { rail: { ...safe.rail, right: Math.min(safe.rail.right, band.right) } } : {}) }
  }
  return safe
}

/** The zoom a focus can take: as close to `scaleTo` as fits the room, never under 1, and where its centre lands so the
 *  scaled focus sits wholly inside the room (it zooms about its own centre and slides only as far as it must; a focus too big for the room at 1x stays
 *  where it was designed). */
export function zoomTarget(rect: Box, room: Room, scaleTo: number): { scale: number; centre: Point; mapped: Box } {
  const place = (right: number) => {
    const width = right - room.left, height = room.bottom - room.top
    const scale = Math.max(1, Math.min(scaleTo, width / rect.width, height / rect.height))
    const w = rect.width * scale, h = rect.height * scale
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
    const slide = (c: number, half: number, low: number, high: number) =>
      high - low < 2 * half ? c : Math.min(high - half, Math.max(low + half, c))
    const x = slide(cx, w / 2, room.left, right), y = slide(cy, h / 2, room.top, room.bottom)
    return { scale, centre: [x, y] as Point, mapped: { left: x - w / 2, top: y - h / 2, width: w, height: h } }
  }
  const open = place(room.right)
  // Below the rail's top, the right edge is the action rail's left.
  if (room.rail && open.mapped.top + open.mapped.height > room.rail.fromY) return place(Math.min(room.right, room.rail.right))
  return open
}

/** Whether a box lies inside the room (with the rail rule). */
export function insideRoom(box: Box, room: Room, slack = 0.5): boolean {
  const right = room.rail && box.top + box.height > room.rail.fromY ? Math.min(room.right, room.rail.right) : room.right
  return box.left >= room.left - slack && box.top >= room.top - slack && box.left + box.width <= right + slack
    && box.top + box.height <= room.bottom + slack
}

// --- The pen: a path's points by distance travelled ---

interface Track { points: Point[]; at: number[]; length: number }
const tracks = new Map<string, Track>()

/** The polyline of an SVG path made of M, L and C commands (scribblePath's output), each cubic sampled at 16 steps.
 *  A move (M) starts a new stroke and adds no length, as the dash a scribble draws with counts it. */
export function pathTrack(d: string): Track {
  const known = tracks.get(d)
  if (known) return known
  const tokens = d.match(/[MLC]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []
  const points: Point[] = [], at: number[] = []
  let length = 0, pen: Point = [0, 0], i = 0, command = 'M'
  const num = () => Number(tokens[i++])
  const add = (p: Point, move: boolean) => {
    if (!move && points.length) length += Math.hypot(p[0] - pen[0], p[1] - pen[1])
    points.push(p); at.push(length); pen = p
  }
  while (i < tokens.length) {
    if (/^[MLC]$/i.test(tokens[i]!)) command = tokens[i++]!.toUpperCase()
    if (command === 'M') { add([num(), num()], true); command = 'L' }
    else if (command === 'L') add([num(), num()], false)
    else {
      const p0 = pen, c1: Point = [num(), num()], c2: Point = [num(), num()], p3: Point = [num(), num()]
      for (let s = 1; s <= 16; s++) {
        const t = s / 16, u = 1 - t
        add([u ** 3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p3[0],
          u ** 3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p3[1]], false)
      }
    }
  }
  const track = { points, at, length }
  if (tracks.size > 256) tracks.clear()
  tracks.set(d, track)
  return track
}

/** The point `fraction` (0 to 1) of the way along a path by length: where the pen is when that much has drawn. */
export function pointAlong(d: string, fraction: number): Point {
  const { points, at, length } = pathTrack(d)
  if (!points.length) return [0, 0]
  const want = Math.min(1, Math.max(0, fraction)) * length
  let low = 0, high = at.length - 1
  while (low < high) { const mid = (low + high) >> 1; if (at[mid]! < want) low = mid + 1; else high = mid }
  if (low === 0) return points[0]!
  const span = at[low]! - at[low - 1]!
  const t = span > 0 ? (want - at[low - 1]!) / span : 1
  const a = points[low - 1]!, b = points[low]!
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** How quickly the camera closes on the pen each frame (a damped follow, never a snap). */
export const PEN_FOLLOW = 0.2

/** The camera over a beat that follows a pen: centre and amount (0 to 1) after `frames` frames, from the beat's first
 *  frame, given the pen tip each frame (undefined before the pen starts). Deterministic: replayed from the beat start. */
export function followPen(pen: (frame: number) => Point | undefined, fromFrame: number, frame: number, centre: Point):
  { centre: Point; amount: number } {
  let x = centre[0], y = centre[1], amount = 0, last: Point | undefined
  for (let f = fromFrame; f <= frame; f++) {
    const tip = pen(f) ?? last
    if (!tip) continue
    last = tip
    x += PEN_FOLLOW * (tip[0] - x); y += PEN_FOLLOW * (tip[1] - y); amount += PEN_FOLLOW * (1 - amount)
  }
  return { centre: [x, y], amount }
}

/** Map a box from a device's own coordinates through its SPLIT placement into frame pixels. */
export function placed(box: Box, place?: { left: number; top: number; scale: number }): Box {
  if (!place) return box
  return { left: place.left + box.left * place.scale, top: place.top + box.top * place.scale,
    width: box.width * place.scale, height: box.height * place.scale }
}
