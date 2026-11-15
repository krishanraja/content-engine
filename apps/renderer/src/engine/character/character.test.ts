import { expect, it } from 'vitest'
import { characterState, Device } from './index'
const track = { poses: [{ fromFrame: 60, pose: 'neutral', spot: 'centre', sinkPx: 40, x: 540, width: 564 }], mouth: Array.from({ length: 200 }, (_, f) => f >= 64 && f < 70), blinks: [160], images: { neutral: { closed: 'c', open: 'o', blink: 'b' } }, seed: 'piece:short' }
it('holds one image, closes in pauses and gives blinks priority', () => {
  expect(characterState(track, 59)).toBeNull()
  expect(characterState(track, 60)?.src).toBe('c')
  expect(characterState(track, 64)?.src).toBe('o')
  expect(characterState(track, 74)?.src).toBe('c')
  expect(characterState(track, 161)?.src).toBe('b')
  expect(characterState(track, 164)?.src).toBe('c')
  expect(characterState(track, 100)).toEqual(characterState(track, 100))
})
it('refuses beat objects', () => { expect(Device).toThrow('never a beat object') })
