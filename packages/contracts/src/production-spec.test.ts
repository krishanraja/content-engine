import { expect, it } from 'vitest'
import { VeBeatSchema } from './production-spec'
import fixture from '../../../fixtures/ve/my-test-19s/spec.json'
it('accepts WINDOW and all face modes as additive v2 beat fields', () => {
  const beat = Object.values(fixture.cuts)[0]!.beats[0]!
  for (const face of ['full', 'window', 'off', undefined]) {
    expect(VeBeatSchema.safeParse({ ...beat, layout: 'WINDOW', face }).success).toBe(true)
  }
  expect(VeBeatSchema.safeParse({ ...beat, layout: 'WINDOW', face: 'unknown' }).success).toBe(false)
})
