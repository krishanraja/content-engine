import { describe, expect, it } from 'vitest'
import fixture from '../fixtures/ve/my-test-19s/spec.json'
import { ProductionSpecV2Schema } from '../packages/contracts/src/production-spec'

describe('STAGE production spec', () => {
  it.each(['hand-held-screen', 'two-passports'])('accepts %s at schema version 2', (format) => {
    const spec = structuredClone(fixture)
    spec.format = format
    Object.values(spec.cuts)[0]!.beats[0]!.layout = 'STAGE'
    expect(ProductionSpecV2Schema.parse(spec).schema_version).toBe(2)
  })

  it('rejects unknown layouts', () => {
    const spec = structuredClone(fixture)
    Object.values(spec.cuts)[0]!.beats[0]!.layout = 'XX'
    expect(ProductionSpecV2Schema.safeParse(spec).success).toBe(false)
  })
})
