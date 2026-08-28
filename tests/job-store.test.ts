import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { completeStage, createJob, invalidateAfter, loadJob, recordApproval } from '@mindmake/core'

describe('event-sourced jobs', () => {
  let root = ''
  let config = ''
  let skills: string[] = []

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'mindmake-job-'))
    process.env.MINDMAKE_RUNTIME_ROOT = join(root, 'runtime')
    config = join(root, 'studio.json')
    await writeFile(config, '{"schema_version":1}\n')
    skills = []
    for (const name of ['mindmake-video', 'krish-voice', 'content-corpus']) {
      const path = join(root, name, 'SKILL.md')
      await mkdir(join(root, name), { recursive: true })
      await writeFile(path, name)
      skills.push(path)
    }
  })

  afterEach(async () => {
    delete process.env.MINDMAKE_RUNTIME_ROOT
    await rm(root, { recursive: true, force: true })
  })

  it('pins all skill hashes and appends approvals', async () => {
    const job = await createJob({ series: 'money_of_ai', mode: 'solo', sourceRef: 'source.mp4', rights: 'owned', configPath: config, skillPaths: skills })
    expect(Object.keys(job.skill_hashes)).toHaveLength(3)
    expect(job.stages.brief.status).toBe('skipped')
    expect(await readFile(join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, job.pinned_inputs.config_path), 'utf8')).toContain('schema_version')
    const artifact = await completeStage(job.job_id, 'ingest', { ok: true }, { source: 'abc' }, { ffprobe: 'test' })
    await recordApproval(job.job_id, 'angle', 'approved', artifact.artifact_hash, undefined, 'system')
    const reloaded = await loadJob(job.job_id)
    expect(reloaded.stages.ingest.status).toBe('complete')
    expect(reloaded.approvals[0]?.artifact_hash).toBe(artifact.artifact_hash)
    expect(reloaded.approvals[0]?.actor).toBe('system')
    const events = await readFile(join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, 'events.jsonl'), 'utf8')
    expect(events.trim().split('\n')).toHaveLength(3)
  })

  it('uses semantic stage hashes and invalidates completed descendants only when a stage changes', async () => {
    const job = await createJob({ series: 'money_of_ai', mode: 'extract', sourceRef: 'source.mp4', rights: 'owned', configPath: config, skillPaths: skills })
    const first = await completeStage(job.job_id, 'ingest', { file: 'same' }, { source: 'abc' }, { ffprobe: 'test' })
    const same = await completeStage(job.job_id, 'ingest', { file: 'same' }, { source: 'abc' }, { ffprobe: 'test' })
    expect(same.artifact_hash).toBe(first.artifact_hash)
    expect(same.created_at).toBe(first.created_at)
    await completeStage(job.job_id, 'normalize', { file: 'normalized' }, { ingest: first.artifact_hash }, { ffmpeg: 'test' })
    await completeStage(job.job_id, 'ingest', { file: 'different' }, { source: 'def' }, { ffprobe: 'test' })
    expect((await loadJob(job.job_id)).stages.normalize.status).toBe('invalidated')
  })

  it('invalidates only downstream stages', async () => {
    const job = await createJob({ series: 'built_with_ai', mode: 'extract', sourceRef: 'source.mp4', rights: 'permissioned', configPath: config, skillPaths: skills })
    await completeStage(job.job_id, 'ingest', {}, {}, {})
    await completeStage(job.job_id, 'normalize', {}, {}, {})
    await completeStage(job.job_id, 'transcript', {}, {}, {})
    const updated = await invalidateAfter(job.job_id, 'normalize', 'caption-independent source changed')
    expect(updated.stages.ingest.status).toBe('complete')
    expect(updated.stages.normalize.status).toBe('complete')
    expect(updated.stages.transcript.status).toBe('invalidated')
    expect(updated.stages.render.status).toBe('pending')
  })
})
