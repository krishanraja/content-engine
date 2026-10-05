import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import {
  StationDefinitionV1Schema,
  StationRegistryV1Schema,
  type StationDefinitionV1,
  type StationRegistryV1,
} from '@mindmake/contracts'

export const STATION_REGISTRY_PATH = '.agents/skills/mindmake-video/stations/registry.json'

const REQUIRED_STATION_HEADINGS = [
  '## Responsibility',
  '## Inputs',
  '## Outputs',
  '## Quality gates',
  '## Failure and fallback',
  '## Handoff',
  '## Learning boundary',
  '## Change control',
] as const

function resolveRepoPath(repoRoot: string, relativePath: string): string {
  const root = resolve(repoRoot)
  const target = resolve(root, relativePath)
  if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error(`station path escapes repository root: ${relativePath}`)
  return target
}

function sha256(contents: string): string {
  return createHash('sha256').update(contents).digest('hex')
}

export type LoadedStationHarnessV1 = {
  definition: StationDefinitionV1
  definition_hash: string
  instruction_hash: string
}

export type LoadedStationRegistryV1 = {
  registry: StationRegistryV1
  registry_hash: string
  stations: Map<StationDefinitionV1['station_id'], LoadedStationHarnessV1>
}

export function stationArtifactTopologyIssues(
  registry: StationRegistryV1,
  definitions: Iterable<StationDefinitionV1>,
): string[] {
  const stations = [...definitions]
  const producers = new Map<string, string[]>()
  const consumers = new Map<string, string[]>()
  for (const station of stations) {
    for (const artifact of station.produces) producers.set(artifact, [...(producers.get(artifact) ?? []), station.station_id])
    for (const artifact of station.consumes) consumers.set(artifact, [...(consumers.get(artifact) ?? []), station.station_id])
  }

  const externalInputs = new Set(registry.external_inputs)
  const terminalOutputs = new Set(registry.terminal_outputs)
  const issues: string[] = []
  for (const [artifact, owners] of producers) {
    if (owners.length !== 1) issues.push(`artifact ${artifact} must have exactly one producing station: ${owners.join(', ')}`)
    if (externalInputs.has(artifact)) issues.push(`artifact ${artifact} cannot be both external and station-produced`)
    if (!consumers.has(artifact) && !terminalOutputs.has(artifact)) issues.push(`station output ${artifact} has no consumer or terminal declaration`)
  }
  for (const [artifact, owners] of consumers) {
    if (!producers.has(artifact) && !externalInputs.has(artifact)) issues.push(`station input ${artifact} has no producer or external declaration: ${owners.join(', ')}`)
  }
  for (const artifact of terminalOutputs) {
    if (!producers.has(artifact)) issues.push(`terminal output ${artifact} has no producing station`)
  }
  return [...new Set(issues)].sort()
}

export function stationInstructionMetadataMatches(instructionSource: string, definition: StationDefinitionV1): boolean {
  const normalized = instructionSource.replace(/\r\n?/g, '\n')
  const frontmatter = `station_id: ${definition.station_id}\nstation_version: ${definition.station_version}\nstatus: ${definition.status}`
  return normalized.includes(frontmatter)
}

export function loadStationHarnessRegistry(repoRoot: string): LoadedStationRegistryV1 {
  const registryPath = resolveRepoPath(repoRoot, STATION_REGISTRY_PATH)
  const registrySource = readFileSync(registryPath, 'utf8')
  const registry = StationRegistryV1Schema.parse(JSON.parse(registrySource) as unknown)
  const stations = new Map<StationDefinitionV1['station_id'], LoadedStationHarnessV1>()

  for (const entry of registry.station_contracts) {
    const definitionPath = resolveRepoPath(repoRoot, entry.definition_path)
    const definitionSource = readFileSync(definitionPath, 'utf8')
    const definition = StationDefinitionV1Schema.parse(JSON.parse(definitionSource) as unknown)
    if (definition.station_id !== entry.station_id) throw new Error(`station registry ID ${entry.station_id} does not match ${definition.station_id}`)

    const instructionPath = resolveRepoPath(repoRoot, definition.instruction_path)
    const instructionSource = readFileSync(instructionPath, 'utf8')
    if (!stationInstructionMetadataMatches(instructionSource, definition)) throw new Error(`station instructions do not match definition metadata: ${definition.station_id}`)
    for (const heading of REQUIRED_STATION_HEADINGS) {
      if (!instructionSource.includes(heading)) throw new Error(`station instructions are missing ${heading}: ${definition.station_id}`)
    }

    for (const ownerPath of [...definition.implementation_owners, ...definition.contract_owners, ...definition.validation.test_paths]) {
      if (!existsSync(resolveRepoPath(repoRoot, ownerPath))) throw new Error(`station ${definition.station_id} references missing repository path: ${ownerPath}`)
    }

    stations.set(definition.station_id, {
      definition,
      definition_hash: sha256(definitionSource),
      instruction_hash: sha256(instructionSource),
    })
  }

  if (stations.size !== registry.station_contracts.length) throw new Error('station registry did not load every station contract')
  const topologyIssues = stationArtifactTopologyIssues(registry, [...stations.values()].map((station) => station.definition))
  if (topologyIssues.length > 0) throw new Error(`station artifact topology is invalid:\n- ${topologyIssues.join('\n- ')}`)
  return { registry, registry_hash: sha256(registrySource), stations }
}
