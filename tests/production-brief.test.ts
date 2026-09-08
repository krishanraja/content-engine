import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  importProductionBrief,
  loadImportedProductionBrief,
  materializeProductionBriefJob,
  processClaimedProductionBrief,
  readStageArtifactV2,
  hashValue,
} from '@mindmake/core'
import type { RunnerControlPlane } from '@mindmake/core'

const revisionHash = 'a'.repeat(64)
const base = {
  schema_version: 1 as const,
  brief_id: 'brief_control_center_1',
  content_idea_id: '00000000-0000-4000-8000-000000000001',
  content_revision_hash: revisionHash,
  series: 'money_of_ai' as const,
  production_kinds: ['video', 'carousel'] as ('video' | 'carousel')[],
  source_mode: 'short_native' as const,
  content: {
    title: 'When AI cuts implementation labour, who gets the saving?',
    thesis: 'The commercial mechanism decides whether the saving changes price, margin or scope.',
    approved_text: 'Lower implementation effort changes what buyers should pay for and what suppliers can keep as margin.',
    audience: 'Enterprise leaders buying or selling AI implementation work.',
    intended_payoff: 'A practical way to inspect where the saved implementation effort lands.',
  },
  claims: [{ claim_id: 'claim-1', text: 'Implementation effort can fall.', evidence_urls: ['https://example.com/evidence'], verification: 'human_required' as const, approved_case_material: false }],
  visual_opportunities: [{ opportunity_id: 'visual-1', description: 'Show the cited task trace beside the commercial before and after.', proof_role: 'evidence' as const, source_urls: ['https://example.com/evidence'] }],
  hard_gates: { truth: 'passed' as const, rights: 'passed' as const, confidentiality: 'passed' as const, meaning: 'passed' as const, naming: 'passed' as const },
  editorial_approval: { approved_by: 'Krish' as const, approved_at: '2026-09-07T12:00:00.000Z', approval_revision_hash: revisionHash },
}

describe('Control Center production brief intake', () => {
  let root = ''
  let configPath = ''
  let techniquesPath = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'mindmake-production-brief-'))
    process.env.MINDMAKE_RUNTIME_ROOT = join(root, 'runtime')
    configPath = join(root, 'studio.json')
    techniquesPath = join(root, 'techniques.json')
    await writeFile(configPath, '{"schema_version":1}\n')
    await writeFile(techniquesPath, '{"schema_version":1,"techniques":[]}\n')
  })

  afterEach(async () => {
    delete process.env.MINDMAKE_RUNTIME_ROOT
    await rm(root, { recursive: true, force: true })
  })

  it('stores one immutable content-addressed brief and rejects id reuse', async () => {
    const first = await importProductionBrief(base)
    const retry = await importProductionBrief(base)
    expect(first.created).toBe(true)
    expect(retry.created).toBe(false)
    expect(retry.brief_hash).toBe(first.brief_hash)
    expect((await loadImportedProductionBrief(base.brief_id)).brief.content.title).toBe(base.content.title)

    await expect(importProductionBrief({
      ...base,
      content: { ...base.content, approved_text: `${base.content.approved_text} A changed revision.` },
    })).rejects.toThrow(/already bound to different semantic content/)
  }, 15_000)

  it('normalises retired format aliases before storing the authoritative brief', async () => {
    const imported = await importProductionBrief({ ...base, brief_id: 'brief_retired_alias_1', editorial_format: 'The Teardown' })
    expect(imported.brief.editorial_format).toBe('artifact')
    expect(JSON.parse(await readFile(imported.path, 'utf8')).editorial_format).toBe('artifact')
  })

  it('accepts the exact shared Control Center contract fixture and hash', async () => {
    const fixture = JSON.parse(await readFile(join(process.cwd(), 'fixtures', 'contracts', 'production-brief-v1.json'), 'utf8'))
    expect(hashValue(fixture)).toBe('93ca6cd821a3d2faa50002474ca6ddbd50e3cb85f7b26e903a5b147108f355d9')
    await expect(importProductionBrief(fixture)).resolves.toMatchObject({ brief_hash: '93ca6cd821a3d2faa50002474ca6ddbd50e3cb85f7b26e903a5b147108f355d9' })
  })

  it('materializes a short-native job once and pins the exact brief artifact', async () => {
    const imported = await importProductionBrief(base)
    const first = await materializeProductionBriefJob({ imported, configPath, skillPaths: [], techniqueRegistryPath: techniquesPath })
    const retry = await materializeProductionBriefJob({ imported: { ...imported, created: false }, configPath, skillPaths: [], techniqueRegistryPath: techniquesPath })
    expect(retry.job.job_id).toBe(first.job.job_id)
    expect(retry.brief_artifact_hash).toBe(first.brief_artifact_hash)
    const artifact = await readStageArtifactV2<{ production_brief_hash: string }>(first.job.job_id, 'brief')
    expect(artifact.payload.production_brief_hash).toBe(imported.brief_hash)
    expect(first.job.presenter_name).toBe('Krish')
  }, 15_000)

  it('waits for reviewed media before an extract or solo job exists', async () => {
    const imported = await importProductionBrief({ ...base, brief_id: 'brief_solo_1', production_kinds: ['video'], source_mode: 'solo' })
    await expect(materializeProductionBriefJob({ imported, configPath, skillPaths: [], techniqueRegistryPath: techniquesPath })).rejects.toThrow(/reviewed SourceBundleV1/)
  })

  it('lets the unattended runner import and materialize an exact short-native brief', async () => {
    const repoRoot = join(root, 'repo')
    await mkdir(join(repoRoot, 'config'), { recursive: true })
    await writeFile(join(repoRoot, 'config', 'studio.json'), '{"schema_version":1}\n')
    await writeFile(join(repoRoot, 'config', 'techniques.json'), '{"schema_version":1,"techniques":[]}\n')
    for (const name of ['mindmake-video', 'krish-voice', 'content-corpus', 'video-engine']) {
      await mkdir(join(repoRoot, '.agents', 'skills', name), { recursive: true })
    }
    const acknowledgements: unknown[] = []
    const client = {
      claim: async () => null,
      heartbeat: async () => ({}),
      complete: async () => ({ duplicate: false, command_id: '', receipt_hash: '', command_status: 'succeeded' as const }),
      completeProductionBrief: async (input: unknown) => {
        acknowledgements.push(input)
        const request = input as { brief_id: string; status: 'imported'; job_id: string | null }
        return { duplicate: false, brief_id: request.brief_id, status: request.status, job_id: request.job_id }
      },
    } satisfies RunnerControlPlane
    const result = await processClaimedProductionBrief({
      content_idea_id: base.content_idea_id,
      brief: base,
      brief_hash: hashValue(base),
      lease: { token: 'lease-token-long-enough-for-production', expires_at: new Date(Date.now() + 60_000).toISOString() },
    }, { client, runnerId: 'runner-production-test', repoRoot })
    expect(result.production_brief_status).toBe('imported')
    expect(result.production_job_id).toMatch(/^production-/)
    expect(acknowledgements).toHaveLength(1)
    expect(acknowledgements[0]).toMatchObject({ brief_id: base.brief_id, status: 'imported', safe_code: null })
  }, 20_000)
})
