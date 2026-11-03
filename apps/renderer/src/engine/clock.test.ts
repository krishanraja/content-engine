import { describe, expect, it } from 'vitest'
import { MOTION, progress, stateAt } from './clock'
import type { EngineEvent } from './props'

const enter: EngineEvent = { id: 'in', obj: 'hook', verb: 'enter', toState: 'visible', atFrame: 0 }
describe('opening cues', () => {
  it('lands an opening entrance without changing props or later entrances', () => {
    const opening = stateAt([enter], 'hook', 0)
    expect(progress(opening.sinceFrames, MOTION.enterFrames)).toBe(1)
    expect(enter.atFrame).toBe(0)
    expect(stateAt([enter], 'hook', -1).current).toBeNull()
    const later = { ...enter, atFrame: 10 }
    expect(progress(stateAt([later], 'hook', 10).sinceFrames, MOTION.enterFrames)).toBe(0)
    expect(progress(stateAt([later], 'hook', 22).sinceFrames, MOTION.enterFrames)).toBe(1)
  })
  it('keeps exits on their exact cue, including frame zero', () => {
    for (const atFrame of [0, 30]) {
      const exit: EngineEvent = { ...enter, id: 'out', verb: 'exit', atFrame }
      expect(stateAt([enter, exit], 'hook', atFrame).current).toEqual(exit)
      expect(progress(stateAt([enter, exit], 'hook', atFrame).sinceFrames, MOTION.exitFrames)).toBe(0)
    }
  })
})
