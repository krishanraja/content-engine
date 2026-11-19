import { describe, expect, it } from 'vitest'
import { isOffDayLabel } from './offDay'

// Krish, 2026-11-18 and 19: no off-day tag on any post, however it is spelled.
describe('an off day wears no tag', () => {
  it('every spelling of the label is an off day', () => {
    for (const l of ['off.day', 'Off.day', 'OFF DAY', 'off-day', 'offday', 'off_day']) expect(isOffDayLabel(l)).toBe(true)
  })
  it('a series label is not', () => {
    for (const l of ['follow.the.money', 'under.the.hood', 'mind.the.gap', '', null, undefined]) expect(isOffDayLabel(l)).toBe(false)
  })
})
