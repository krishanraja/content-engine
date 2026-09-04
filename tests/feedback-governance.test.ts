import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { captureFeedback, createJob, promoteRule } from '@mindmake/core'

describe('feedback and preference governance', () => {
  let root: string
  let previousRuntimeRoot: string | undefined

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'mindmake-feedback-governance-'))
    previousRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = join(root, 'runtime')
  })

  afterEach(async () => {
    if (previousRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
    else process.env.MINDMAKE_RUNTIME_ROOT = previousRuntimeRoot
    await rm(root, { recursive: true, force: true })
  })

  it('stores the exact accepted media file hash instead of the analysis object hash', async () => {
    const configPath = join(root, 'studio.json')
    const skillPath = join(root, 'skill')
    await mkdir(skillPath)
    await writeFile(configPath, '{"schema_version":1}\n', 'utf8')
    await writeFile(join(skillPath, 'SKILL.md'), '# Test\n', 'utf8')
    const job = await createJob({
      series: 'money_of_ai',
      mode: 'solo',
      sourceRef: 'source.mp4',
      configPath,
      skillPaths: [skillPath],
    })
    const exactHash = 'a'.repeat(64)
    const event = await captureFeedback({
      jobId: job.job_id,
      artifactId: 'external-final',
      stage: 'render',
      action: 'revise',
      before: { artifact_file_sha256: 'b'.repeat(64), duration_seconds: 40 },
      after: { artifact: { artifact_file_sha256: exactHash, duration_seconds: 32 }, sidecars: { srt: 'accepted captions' } },
      scope: { level: 'job', key: job.job_id },
    })
    expect(event.after_hash).toBe(exactHash)
    expect(event.after_hash).not.toBe(event.before_hash)
  })

  it('emits a content-addressed proposal and waits for Git config authority before activation', async () => {
    const learningRoot = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'learning')
    await mkdir(learningRoot, { recursive: true })
    const rule = {
      schema_version: 1 as const,
      rule_id: 'proof-before-context',
      assertion: 'Put proof before context for this treatment.',
      scope: { level: 'treatment' as const, key: 'evidence-story-v2' },
      evidence_feedback_ids: [],
      counterexamples: [],
      regression_cases: ['keep the presenter visible when the proof does not need the full frame'],
      status: 'user_approved' as const,
      approved_by: 'krish',
      approved_at: '2026-09-03T12:00:00.000Z',
    }
    await writeFile(join(learningRoot, 'rules.json'), `${JSON.stringify([rule], null, 2)}\n`, 'utf8')
    const configPath = join(root, 'studio.json')
    const originalConfig = `${JSON.stringify({ schema_version: 1, active_preferences: [] }, null, 2)}\n`
    await writeFile(configPath, originalConfig, 'utf8')

    const proposed = await promoteRule(rule.rule_id, 'active', configPath, 'krish')
    expect(proposed.status).toBe('user_approved')
    expect(proposed.activation_proposal?.activation_boundary).toBe('reviewed_git_commit')
    expect(proposed.activation_proposal_path).toContain(proposed.activation_proposal?.proposal_hash)
    expect(await readFile(configPath, 'utf8')).toBe(originalConfig)
    expect(JSON.parse(await readFile(proposed.activation_proposal_path!, 'utf8')).patch.value.status).toBe('active')

    await writeFile(configPath, `${JSON.stringify({ schema_version: 1, active_preferences: [proposed.activation_proposal!.patch.value] }, null, 2)}\n`, 'utf8')
    const activated = await promoteRule(rule.rule_id, 'active', configPath, 'krish')
    expect(activated.status).toBe('active')
    expect(activated.activation_proposal).toBeUndefined()
  })
})
