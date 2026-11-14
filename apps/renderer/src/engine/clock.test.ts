import { Easing } from 'remotion'
import { afterEach, describe, expect, it } from 'vitest'
import { BACK, ENTER, EXIT, HERO, HOUSE_MOTION, MOTION, drift, motionProfile, onTwos, overshootEase, progress, setMotionProfile, stateAt } from './clock'
import { MOTION_PROFILES } from './kit/motionProfiles'
import type { EngineEvent } from './props'

const samples = Array.from({ length: 41 }, (_, i) => i / 40)
const peak = (curve: (t: number) => number) => Math.max(...Array.from({ length: 2001 }, (_, i) => curve(i / 2000)))

describe('the motion seam', () => {
  afterEach(() => setMotionProfile(undefined))

  it('gives exactly the house values with no profile', () => {
    setMotionProfile(undefined)
    expect(motionProfile()).toBeUndefined()
    // The literal numbers every frozen lock and approved key frame was rendered with.
    expect({ ...MOTION }).toEqual({ enterFrames: 12, exitFrames: 6, staggerFrames: 3, slapFrames: 5, dropFrames: 8,
      slideFrames: 12, driftPct: 1.5, risePx: 24, countFrames: 18 })
    expect({ ...MOTION }).toEqual(HOUSE_MOTION)
    const enter = Easing.bezier(0.05, 0.7, 0.1, 1.0), hero = Easing.bezier(0.16, 1, 0.3, 1), exit = Easing.bezier(0.3, 0.0, 0.8, 0.15)
    const back = (t: number) => 1 + 2.9 * Math.pow(t - 1, 3) + 1.9 * Math.pow(t - 1, 2)
    for (const t of samples) {
      expect(ENTER(t)).toBe(enter(t))
      expect(HERO(t)).toBe(hero(t))
      expect(EXIT(t)).toBe(exit(t))
      expect(BACK(t)).toBe(back(t))
    }
    expect(progress(5, MOTION.enterFrames)).toBe(enter(5 / 12))
    expect(drift(50, 0, 100)).toBeCloseTo(0.0075, 12)
  })

  it('restores the house values exactly after a profile', () => {
    setMotionProfile(MOTION_PROFILES['dark-keynote'])
    expect(MOTION.enterFrames).toBe(7)
    expect(HERO(0.5)).toBe(Easing.bezier(0.16, 1, 0.3, 1)(0.5))
    setMotionProfile(MOTION_PROFILES['living-ui'])
    expect(HERO(0.5)).toBe(Easing.bezier(0.2, 0, 0, 1)(0.5))
    setMotionProfile(undefined)
    expect({ ...MOTION }).toEqual(HOUSE_MOTION)
    expect(ENTER(0.3)).toBe(Easing.bezier(0.05, 0.7, 0.1, 1.0)(0.3))
  })

  it.each(Object.entries(MOTION_PROFILES))('%s: every entrance settles in 4 to 10 frames, overshoots at most 12%% and drifts (the floor widened 13 Nov 2026)', (_id, profile) => {
    setMotionProfile(profile)
    for (const frames of [MOTION.enterFrames, MOTION.slideFrames, MOTION.dropFrames, MOTION.slapFrames]) {
      expect(frames).toBeGreaterThanOrEqual(4)
      expect(frames).toBeLessThanOrEqual(10)
    }
    expect(MOTION.risePx).toBeGreaterThanOrEqual(0)
    expect(MOTION.risePx).toBeLessThanOrEqual(500)
    expect(MOTION.driftPct).toBeGreaterThan(0)
    expect(ENTER(0)).toBeCloseTo(0, 9)
    expect(ENTER(1)).toBeCloseTo(1, 9)
    expect(peak(ENTER)).toBeLessThanOrEqual(1 + profile.entrance.overshootPct / 100 + 1e-6)
    expect(peak(BACK)).toBeLessThanOrEqual(1.12 + 1e-6)
    expect(progress(MOTION.enterFrames, MOTION.enterFrames)).toBe(1)
  })

  it('solves the back curve for its exact overshoot', () => {
    for (const pct of [2, 3, 4, 6]) expect(peak(overshootEase(pct))).toBeCloseTo(1 + pct / 100, 4)
  })

  it('steps graphics on twos from the beat start, never before it', () => {
    expect([10, 11, 12, 13].map(f => onTwos(f, 10))).toEqual([10, 10, 12, 12])
    expect([11, 12, 13].map(f => onTwos(f, 11))).toEqual([11, 11, 13])
  })
})

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
