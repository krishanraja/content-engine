import { describe, expect, it } from 'vitest'
import { StageNameV2Schema } from '@mindmake/contracts'
import { loadStationHarnessRegistry, stationArtifactTopologyIssues, stationInstructionMetadataMatches, v2DescendantsFor, v2PrerequisitesFor, v2StageOrder } from '@mindmake/core'

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

  it('proves every handoff has exactly one producer or an explicit external source', () => {
    const definitions = [...loaded.stations.values()].map((station) => station.definition)
    expect(stationArtifactTopologyIssues(loaded.registry, definitions)).toEqual([])
  })

  it('rejects a consumed artifact with no producer or external declaration', () => {
    const definitions = [...loaded.stations.values()].map((station) => structuredClone(station.definition))
    definitions.find((station) => station.station_id === 'qa')!.consumes.push('unowned_verdict')
    expect(stationArtifactTopologyIssues(loaded.registry, definitions)).toContain('station input unowned_verdict has no producer or external declaration: qa')
  })

  it('rejects duplicate producers and unconsumed outputs', () => {
    const definitions = [...loaded.stations.values()].map((station) => structuredClone(station.definition))
    definitions.find((station) => station.station_id === 'qa')!.produces.push('render_artifact', 'orphaned_qa_output')
    expect(stationArtifactTopologyIssues(loaded.registry, definitions)).toEqual(expect.arrayContaining([
      'artifact render_artifact must have exactly one producing station: render, qa',
      'station output orphaned_qa_output has no consumer or terminal declaration',
    ]))
  })

  it('rejects a terminal output without a producer', () => {
    const registry = structuredClone(loaded.registry)
    registry.terminal_outputs.push('missing_delivery')
    const definitions = [...loaded.stations.values()].map((station) => station.definition)
    expect(stationArtifactTopologyIssues(registry, definitions)).toContain('terminal output missing_delivery has no producing station')
  })

  it('content-addresses every machine contract and instruction card', () => {
    expect(loaded.registry_hash).toMatch(/^[a-f0-9]{64}$/)
    for (const station of loaded.stations.values()) {
      expect(station.definition_hash).toMatch(/^[a-f0-9]{64}$/)
      expect(station.instruction_hash).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('validates station metadata with Git checkout line endings on Windows', () => {
    const definition = loaded.stations.get('brief')!.definition
    expect(stationInstructionMetadataMatches('---\r\nstation_id: brief\r\nstation_version: 1\r\nstatus: active\r\n---\r\n', definition)).toBe(true)
  })
})
