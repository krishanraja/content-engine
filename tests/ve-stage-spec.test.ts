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

describe('SPLIT production spec', () => {
  it('accepts SPLIT', () => {
    const spec = structuredClone(fixture)
    Object.values(spec.cuts)[0]!.beats[0]!.layout = 'SPLIT'
    expect(ProductionSpecV2Schema.safeParse(spec).success).toBe(true)
  })
})

describe('spec verbs', () => {
  it('accepts every verb the renderer accepts, so a spec can name any library device verb', async () => {
    const { VeVerbSchema } = await import('../packages/contracts/src/production-spec')
    const { EngineEventSchema } = await import('../apps/renderer/src/engine/props')
    expect([...VeVerbSchema.options].sort()).toEqual([...EngineEventSchema.shape.verb.options].sort())
  })
})
