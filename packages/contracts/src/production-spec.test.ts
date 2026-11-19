import { expect, it } from 'vitest'
import { VeApprovalSchema, VeBeatSchema } from './production-spec'
import fixture from '../../../fixtures/ve/my-test-19s/spec.json'
it('accepts WINDOW and all face modes as additive v2 beat fields', () => {
  const beat = Object.values(fixture.cuts)[0]!.beats[0]!
  for (const face of ['full', 'window', 'off', undefined]) {
    expect(VeBeatSchema.safeParse({ ...beat, layout: 'WINDOW', face }).success).toBe(true)
  }
  expect(VeBeatSchema.safeParse({ ...beat, layout: 'WINDOW', face: 'unknown' }).success).toBe(false)
})

it('takes an approval with the moment he pressed and a standing engine-follows-main scope, and old date-only ones', () => {
  const base = { gate: 'final', by: 'Krish', said: 'go again', on: '2026-11-13', artifact_hash: 'b'.repeat(64) }
  expect(VeApprovalSchema.safeParse(base).success).toBe(true)
  expect(VeApprovalSchema.safeParse({ ...base, at: '2026-11-13T15:00:00Z' }).success).toBe(true)
  expect(VeApprovalSchema.safeParse({ ...base, at: '2026-11-13' }).success).toBe(false)
  expect(VeApprovalSchema.safeParse({ ...base, gate: 'exception', scope: 'engine-follows-main' }).success).toBe(true)
  expect(VeApprovalSchema.safeParse({ ...base, gate: 'exception', scope: 'anything' }).success).toBe(false)
})
