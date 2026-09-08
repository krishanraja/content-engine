import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  IdentifierV1Schema,
  ProductionBriefV1Schema,
  SourceBundleV1Schema,
  normalizeEditorialFormatV1,
  type JobManifestV2,
  type ProductionBriefV1,
  type SourceBundleV1,
} from '@mindmake/contracts'
import { withDurableFileLock } from './durable-lock.js'
import { hashValue, stableJson } from './hash.js'
import { completeStageV2, createJobV2 } from './job-store-v2.js'
import { studioPaths } from './paths.js'

interface ProductionBriefPointerV1 {
  schema_version: 1
  brief_id: string
  brief_hash: string
  imported_at: string
}

export interface ImportedProductionBriefV1 {
  brief: ProductionBriefV1
  brief_hash: string
  path: string
  created: boolean
}

function briefRoot(briefId: string): string {
  return join(studioPaths().runtimeRoot, 'production-briefs', IdentifierV1Schema.parse(briefId))
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, `${stableJson(value)}\n`, { encoding: 'utf8', flag: 'wx' })
  await rename(temp, path)
}

export async function importProductionBrief(input: unknown): Promise<ImportedProductionBriefV1> {
  const normalizedInput = input && typeof input === 'object' && !Array.isArray(input) && typeof (input as { editorial_format?: unknown }).editorial_format === 'string'
    ? { ...input, editorial_format: normalizeEditorialFormatV1((input as { editorial_format: string }).editorial_format) }
    : input
  const brief = ProductionBriefV1Schema.parse(normalizedInput)
  const briefHash = hashValue(brief)
  const root = briefRoot(brief.brief_id)
  await mkdir(root, { recursive: true })
  return withDurableFileLock(join(root, '.import.lock'), async () => {
    const pointerPath = join(root, 'active.json')
    const artifactPath = join(root, `${briefHash}.json`)
    try {
      const pointer = JSON.parse(await readFile(pointerPath, 'utf8')) as ProductionBriefPointerV1
      if (pointer.schema_version !== 1 || pointer.brief_id !== brief.brief_id || pointer.brief_hash !== briefHash) {
        throw new Error('production brief id is already bound to different semantic content')
      }
      const existing = ProductionBriefV1Schema.parse(JSON.parse(await readFile(artifactPath, 'utf8')))
      if (hashValue(existing) !== briefHash) throw new Error('stored production brief failed its content-address check')
      return { brief: existing, brief_hash: briefHash, path: artifactPath, created: false }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await writeJsonAtomic(artifactPath, brief)
    await writeJsonAtomic(pointerPath, {
      schema_version: 1,
      brief_id: brief.brief_id,
      brief_hash: briefHash,
      imported_at: new Date().toISOString(),
    } satisfies ProductionBriefPointerV1)
    return { brief, brief_hash: briefHash, path: artifactPath, created: true }
  })
}

export async function loadImportedProductionBrief(briefId: string): Promise<ImportedProductionBriefV1> {
  const root = briefRoot(briefId)
  const pointer = JSON.parse(await readFile(join(root, 'active.json'), 'utf8')) as ProductionBriefPointerV1
  if (pointer.schema_version !== 1 || pointer.brief_id !== briefId || !/^[a-f0-9]{64}$/.test(pointer.brief_hash)) {
    throw new Error('production brief pointer is invalid')
  }
  const path = join(root, `${pointer.brief_hash}.json`)
  const brief = ProductionBriefV1Schema.parse(JSON.parse(await readFile(path, 'utf8')))
  if (brief.brief_id !== briefId || hashValue(brief) !== pointer.brief_hash) throw new Error('stored production brief failed its content-address check')
  return { brief, brief_hash: pointer.brief_hash, path, created: false }
}

export async function materializeProductionBriefJob(input: {
  imported: ImportedProductionBriefV1
  sourceBundle?: SourceBundleV1
  configPath: string
  skillPaths: string[]
  techniqueRegistryPath?: string
}): Promise<{ job: JobManifestV2; brief_artifact_hash: string; created: boolean }> {
  const { brief } = input.imported
  if (!brief.production_kinds.includes('video')) throw new Error('production brief does not request video production')
  if (brief.source_mode === 'written') throw new Error('written production briefs cannot create a video job')
  const sourceBundle = input.sourceBundle ? SourceBundleV1Schema.parse(input.sourceBundle) : undefined
  if (brief.source_mode !== 'short_native' && !sourceBundle) throw new Error('extract and solo production briefs need a reviewed SourceBundleV1 before job creation')

  const jobId = `production-${hashValue({ brief_id: brief.brief_id }).slice(0, 24)}`
  const job = await createJobV2({
    jobId,
    series: brief.series,
    mode: brief.source_mode,
    purpose: 'production',
    ...(sourceBundle ? { sourceBundle } : {}),
    presenterName: 'Krish',
    configPath: input.configPath,
    skillPaths: input.skillPaths,
    ...(input.techniqueRegistryPath ? { techniqueRegistryPath: input.techniqueRegistryPath } : {}),
  })
  const briefArtifact = await completeStageV2(job.job_id, 'brief', {
    production_brief: brief,
    production_brief_hash: input.imported.brief_hash,
  }, {
    production_brief: input.imported.brief_hash,
  }, {
    importer: 'control-center-production-brief-v1',
  })
  return { job, brief_artifact_hash: briefArtifact.artifact_hash, created: input.imported.created }
}
