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
    const frontmatter = `station_id: ${definition.station_id}\nstation_version: ${definition.station_version}\nstatus: ${definition.status}`
    if (!instructionSource.includes(frontmatter)) throw new Error(`station instructions do not match definition metadata: ${definition.station_id}`)
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
  return { registry, registry_hash: sha256(registrySource), stations }
}
