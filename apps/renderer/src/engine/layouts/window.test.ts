import { expect, it } from 'vitest'
import { slotsFor, windowCameraBox, windowCameraState } from './index'
import type { EngineBeat } from '../props'
const beat = (fromFrame: number, toFrame: number, face: EngineBeat['face']): EngineBeat => ({
  id: `b${fromFrame}`, role: 'anchor', layout: 'WINDOW', fromFrame, toFrame, face,
  uses: [], transitionOut: 'cut', sectionBeat: false,
})
it('uses the signed window boxes and keeps device slots clear in both aspects', () => {
  expect(windowCameraBox('16:9')).toEqual({ left: 1452, top: 676, width: 400, height: 340 })
  expect(windowCameraBox('9:16')).toEqual({ left: 48, top: 1250, width: 330, height: 420 })
  for (const aspect of ['16:9', '9:16'] as const) {
    const win = windowCameraBox(aspect)
    for (const box of slotsFor('WINDOW', aspect, 3)) {
      expect(box.left + box.width <= win.left || box.top + box.height <= win.top || box.left >= win.left + win.width || box.top >= win.top + win.height).toBe(true)
    }
  }
})
it('moves one camera to the window by frame 12 without overshoot, and back', () => {
  for (const aspect of ['16:9', '9:16'] as const) {
    const beats = [beat(0, 30, 'full'), beat(30, 60, 'window'), beat(60, 90, 'full')]
    const start = windowCameraState(beats, aspect, 30).box
    const end = windowCameraBox(aspect)
    expect(windowCameraState(beats, aspect, 42).box).toEqual(end)
    for (let frame = 30; frame <= 42; frame++) {
      const box = windowCameraState(beats, aspect, frame).box
      for (const key of ['left', 'top', 'width', 'height'] as const) {
        expect(box[key]).toBeGreaterThanOrEqual(Math.min(start[key], end[key]))
        expect(box[key]).toBeLessThanOrEqual(Math.max(start[key], end[key]))
      }
    }
    expect(windowCameraState(beats, aspect, 72).box).toEqual(start)
  }
})
it('scales off and on over six frames', () => {
  const beats = [beat(0, 30, 'window'), beat(30, 60, 'off'), beat(60, 90, 'window')]
  expect(windowCameraState(beats, '16:9', 30).scale).toBe(1)
  expect(windowCameraState(beats, '16:9', 33).scale).toBeGreaterThan(0)
  expect(windowCameraState(beats, '16:9', 36).scale).toBe(0)
  expect(windowCameraState(beats, '16:9', 66).scale).toBe(1)
})
