import { describe, expect, it } from 'vitest'
import { StageNameV2Schema } from '@mindmake/contracts'
import { loadStationHarnessRegistry, v2DescendantsFor, v2PrerequisitesFor, v2StageOrder } from '@mindmake/core'

describe('station harness registry', () => {
  const loaded = loadStationHarnessRegistry(process.cwd())

  it('gives every executable V2 stage one governed station', () => {
    expect([...loaded.stations.keys()].sort()).toEqual([...StageNameV2Schema.options].sort())
    expect(loaded.stations.size).toBe(17)
  })

  it.each(['extract', 'solo', 'short_native'] as const)('cannot drift from the %s runtime graph', (mode) => {
    expect(loaded.registry.assemblies[mode]).toEqual(v2StageOrder(mode))
    for (const stage of v2StageOrder(mode)) {
      const station = loaded.stations.get(stage)!.definition
      expect(station.prerequisites[mode]).toEqual(v2PrerequisitesFor(stage, mode))
      expect(station.invalidates_on_change[mode]).toEqual(v2DescendantsFor(stage, mode))
    }
  })

  it('prevents a station from silently activating learning rules', () => {
    for (const station of loaded.stations.values()) expect(station.definition.learning.may_activate_rules).toBe(false)
  })

  it('content-addresses every machine contract and instruction card', () => {
    expect(loaded.registry_hash).toMatch(/^[a-f0-9]{64}$/)
    for (const station of loaded.stations.values()) {
      expect(station.definition_hash).toMatch(/^[a-f0-9]{64}$/)
      expect(station.instruction_hash).toMatch(/^[a-f0-9]{64}$/)
    }
  })
})
