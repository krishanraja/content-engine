import { StageNameV2Schema, type StationSourceModeV1 } from '@mindmake/contracts'
import {
  loadStationHarnessRegistry,
  stationArtifactTopologyIssues,
  v2DescendantsFor,
  v2PrerequisitesFor,
  v2StageOrder,
} from '@mindmake/core'

const loaded = loadStationHarnessRegistry(process.cwd())
const expectedStations = new Set(StageNameV2Schema.options)
const registeredStations = new Set(loaded.registry.station_contracts.map((entry) => entry.station_id))

const topologyIssues = stationArtifactTopologyIssues(loaded.registry, [...loaded.stations.values()].map((station) => station.definition))
if (topologyIssues.length > 0) throw new Error(`station artifact topology is invalid:\n- ${topologyIssues.join('\n- ')}`)

if (expectedStations.size !== registeredStations.size || [...expectedStations].some((stage) => !registeredStations.has(stage))) {
  throw new Error('station registry must cover every V2 production stage exactly once')
}

for (const mode of ['extract', 'solo', 'short_native'] as const satisfies readonly StationSourceModeV1[]) {
  const expectedOrder = [...v2StageOrder(mode)]
  const registeredOrder = loaded.registry.assemblies[mode]
  if (JSON.stringify(registeredOrder) !== JSON.stringify(expectedOrder)) throw new Error(`${mode} station assembly does not match the executable stage order`)

  for (const stage of expectedOrder) {
    const station = loaded.stations.get(stage)?.definition
    if (!station) throw new Error(`station definition is missing: ${stage}`)
    if (JSON.stringify(station.prerequisites[mode]) !== JSON.stringify(v2PrerequisitesFor(stage, mode))) {
      throw new Error(`${stage} prerequisites do not match the executable ${mode} graph`)
    }
    if (JSON.stringify(station.invalidates_on_change[mode]) !== JSON.stringify(v2DescendantsFor(stage, mode))) {
      throw new Error(`${stage} invalidation map does not match the executable ${mode} graph`)
    }
  }
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  registry_id: loaded.registry.registry_id,
  registry_version: loaded.registry.registry_version,
  registry_hash: loaded.registry_hash,
  stations: loaded.stations.size,
})}\n`)
