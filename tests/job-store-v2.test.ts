import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { attachSourceBundleV2, completeStageV2, createJobV2, hasApprovalV2, hashValue, loadJobV2, readStageArtifactV2, recordApprovalV2, resetApprovalSigningKeyProviderForTests, setApprovalSigningKeyProviderForTests, withoutAuditTimestamps } from '@mindmake/core'

const H = 'a'.repeat(64)
const TEST_APPROVAL_KEY = 'unit-test-only-approval-key-material-with-at-least-32-bytes'

describe('V2 event-sourced jobs', () => {
  let root = ''
  let config = ''
  let techniques = ''
  let skills: string[] = []

  beforeEach(async () => {
    setApprovalSigningKeyProviderForTests(() => TEST_APPROVAL_KEY)
    root = await mkdtemp(join(tmpdir(), 'mindmake-job-v2-'))
    process.env.MINDMAKE_RUNTIME_ROOT = join(root, 'runtime')
    config = join(root, 'studio.json')
    techniques = join(root, 'techniques.json')
    await writeFile(config, '{"schema_version":1}\n')
    await writeFile(techniques, '{"schema_version":1,"techniques":[]}\n')
    skills = []
    for (const name of ['mindmake-video', 'krish-voice', 'content-corpus']) {
      const path = join(root, name, 'SKILL.md')
      await mkdir(join(root, name), { recursive: true })
      await writeFile(path, name)
      skills.push(path)
    }
  })

  afterEach(async () => {
    resetApprovalSigningKeyProviderForTests()
    delete process.env.MINDMAKE_RUNTIME_ROOT
    await rm(root, { recursive: true, force: true })
  })

  it('pins V2 inputs and keeps exact visual approvals', async () => {
    const job = await createJobV2({
      series: 'built_with_ai', mode: 'solo', presenterName: 'Krish', configPath: config, skillPaths: skills, techniqueRegistryPath: techniques,
      sourceBundle: { schema_version: 1, bundle_id: 'bundle-1', primary_source_id: 'camera-main', sources: [{ source_id: 'camera-main', kind: 'video', role: 'primary_camera', ref: 'source.mp4', rights: 'owned', sync: { strategy: 'already_mixed', offset_ms: 0 }, include_in_edit: true }] },
    })
    expect(job.schema_version).toBe(2)
    expect(job.target_platforms).toEqual(['youtube_shorts', 'linkedin', 'tiktok', 'instagram_reels'])
    expect(job.stages.source_analysis.status).toBe('pending')
    expect(job.pinned_inputs.technique_registry_hash).toMatch(/^[a-f0-9]{64}$/)
    await expect(recordApprovalV2(job.job_id, 'visual_plan', 'approved', H, undefined, 'krish')).rejects.toThrow('artifact-bound confirmation reference')
    await recordApprovalV2(job.job_id, 'visual_plan', 'approved', H, undefined, 'krish', `codex-user-confirmation:visual_plan:${H}:approved`)
    expect((await loadJobV2(job.job_id)).approvals[0]?.gate).toBe('visual_plan')
    await recordApprovalV2(job.job_id, 'visual_plan', 'rejected', H, 'The later review found a visual integrity problem.', 'system')
    expect(hasApprovalV2(await loadJobV2(job.job_id), 'visual_plan', H, 'krish')).toBe(false)
    await recordApprovalV2(job.job_id, 'visual_plan', 'approved', H, 'Krish approved the corrected review.', 'krish', `codex-user-confirmation:visual_plan:${H}:approved after correction`)
    expect(hasApprovalV2(await loadJobV2(job.job_id), 'visual_plan', H, 'krish')).toBe(true)
    const approvalEvent = (await readFile(join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, 'events.jsonl'), 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line)).findLast((event) => event.type === 'approval_recorded')
    expect(approvalEvent.payload).toMatchObject({ approval: { gate: 'visual_plan', artifact_hash: H }, receipt: { version: 1, algorithm: 'hmac-sha256', signature: expect.stringMatching(/^[a-f0-9]{64}$/) } })
    expect(JSON.stringify(approvalEvent)).not.toContain(TEST_APPROVAL_KEY)
    await expect(recordApprovalV2(job.job_id, 'animatic', 'approved', H, undefined, 'system')).rejects.toThrow('requires Krish approval')
    await expect(recordApprovalV2(job.job_id, 'package', 'approved', H, undefined, 'system')).rejects.toThrow('requires Krish approval')
  })

  it('accepts portable, legacy and Control Center confirmation receipts at the angle gate and rejects a malformed client', async () => {
    const job = await createJobV2({
      series: 'built_with_ai', mode: 'solo', presenterName: 'Krish', configPath: config, skillPaths: skills, techniqueRegistryPath: techniques,
      sourceBundle: { schema_version: 1, bundle_id: 'bundle-1', primary_source_id: 'camera-main', sources: [{ source_id: 'camera-main', kind: 'video', role: 'primary_camera', ref: 'source.mp4', rights: 'owned', sync: { strategy: 'already_mixed', offset_ms: 0 }, include_in_edit: true }] },
    })
    const portable = 'b'.repeat(64)
    const legacy = 'c'.repeat(64)
    const controlCenter = 'd'.repeat(64)
    await recordApprovalV2(job.job_id, 'angle', 'approved', portable, undefined, 'krish', `studio-user-confirmation:claude-code:angle:${portable}:Krish approved this angle`)
    await recordApprovalV2(job.job_id, 'angle', 'approved', legacy, undefined, 'krish', `codex-user-confirmation:angle:${legacy}:Krish approved this angle`)
    await recordApprovalV2(job.job_id, 'angle', 'approved', controlCenter, undefined, 'krish', `control-center-confirmation:angle:${controlCenter}:review:decision`)
    const reloaded = await loadJobV2(job.job_id)
    expect(hasApprovalV2(reloaded, 'angle', portable, 'krish')).toBe(true)
    expect(hasApprovalV2(reloaded, 'angle', legacy, 'krish')).toBe(true)
    expect(hasApprovalV2(reloaded, 'angle', controlCenter, 'krish')).toBe(true)

    const other = 'e'.repeat(64)
    for (const malformed of [
      `studio-user-confirmation:Claude-Code:angle:${other}:uppercase client`,
      `studio-user-confirmation:claude_code:angle:${other}:underscore client`,
      `studio-user-confirmation:1claude:angle:${other}:leading digit`,
      `studio-user-confirmation:c:angle:${other}:one character client`,
      `studio-user-confirmation:${'c'.repeat(41)}:angle:${other}:overlong client`,
      `studio-user-confirmation::angle:${other}:empty client`,
      `studio-user-confirmation:claude-code:angle:${other}:`,
      `studio-user-confirmation:claude-code:angle:${other}:   `,
      `studio-user-confirmation:claude-code:visual_plan:${other}:wrong gate`,
      `studio-user-confirmation:claude-code:angle:${'f'.repeat(64)}:wrong hash`,
      `studio-user-confirmation:angle:${other}:missing client segment`,
    ]) {
      await expect(recordApprovalV2(job.job_id, 'angle', 'approved', other, undefined, 'krish', malformed)).rejects.toThrow('artifact-bound confirmation reference')
    }
    expect(hasApprovalV2(await loadJobV2(job.job_id), 'angle', other, 'krish')).toBe(false)
  })

  it('serializes six concurrent signed appends without corrupting the authenticated event chain', async () => {
    const job = await createJobV2({ series: 'built_with_ai', mode: 'short_native', presenterName: 'Krish', configPath: config, skillPaths: skills })
    const hashes = ['1', '2', '3', '4', '5', '6'].map((digit) => digit.repeat(64))
    await Promise.all(hashes.map((artifactHash, index) => recordApprovalV2(
      job.job_id,
      'visual_plan',
      'approved',
      artifactHash,
      undefined,
      'krish',
      `codex-user-confirmation:visual_plan:${artifactHash}:concurrent approval ${index + 1}`,
    )))
    const reloaded = await loadJobV2(job.job_id)
    expect(reloaded.approvals.filter((approval) => hashes.includes(approval.artifact_hash))).toHaveLength(6)
    const events = (await readFile(join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, 'events.jsonl'), 'utf8'))
      .trim().split(/\r?\n/).map((line) => JSON.parse(line) as { event_id: string; type: string })
    const approvalEvents = events.filter((event) => event.type === 'approval_recorded')
    expect(approvalEvents).toHaveLength(6)
    expect(new Set(approvalEvents.map((event) => event.event_id)).size).toBe(6)
  })

  it('recovers an old empty or truncated event lock left before ownership was written', async () => {
    const job = await createJobV2({ series: 'built_with_ai', mode: 'short_native', presenterName: 'Krish', configPath: config, skillPaths: skills })
    const lockPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, '.events.lock')
    const old = new Date(Date.now() - 5_000)
    await writeFile(lockPath, '')
    await utimes(lockPath, old, old)
    await expect(recordApprovalV2(job.job_id, 'visual_plan', 'approved', H, undefined, 'krish', `codex-user-confirmation:visual_plan:${H}:empty lock recovery`)).resolves.toBeTruthy()
    await writeFile(lockPath, '{"schema_version":1')
    await utimes(lockPath, old, old)
    await expect(recordApprovalV2(job.job_id, 'storyboard', 'approved', H, undefined, 'krish', `codex-user-confirmation:storyboard:${H}:truncated lock recovery`)).resolves.toBeTruthy()
  })

  it('keeps unsigned legacy approval events readable but never grants them', async () => {
    const job = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills })
    const occurredAt = new Date().toISOString()
    await appendFile(join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, 'events.jsonl'), `${JSON.stringify({
      schema_version: 2,
      event_id: randomUUID(),
      job_id: job.job_id,
      type: 'approval_recorded',
      occurred_at: occurredAt,
      payload: { gate: 'package', decision: 'approved', artifact_hash: H, actor: 'krish', confirmation_ref: `codex-user-confirmation:package:${H}:unsigned legacy receipt`, occurred_at: occurredAt },
    })}\n`)

    const reloaded = await loadJobV2(job.job_id)
    expect(reloaded.approvals).toEqual([])
    expect(hasApprovalV2(reloaded, 'package', H, 'krish')).toBe(false)
  })

  it('ignores a manually appended schema-valid approval with a forged signature', async () => {
    const job = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills })
    const occurredAt = new Date().toISOString()
    const approval = { gate: 'package', decision: 'approved', artifact_hash: H, actor: 'krish', confirmation_ref: `codex-user-confirmation:package:${H}:forged signed receipt`, occurred_at: occurredAt }
    await appendFile(join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, 'events.jsonl'), `${JSON.stringify({
      schema_version: 2,
      event_id: randomUUID(),
      job_id: job.job_id,
      type: 'approval_recorded',
      occurred_at: occurredAt,
      payload: { approval, receipt: { version: 1, algorithm: 'hmac-sha256', prior_event_chain_hash: 'b'.repeat(64), signature: 'c'.repeat(64) } },
    })}\n`)

    const reloaded = await loadJobV2(job.job_id)
    expect(reloaded.approvals).toEqual([])
    expect(hasApprovalV2(reloaded, 'package', H, 'krish')).toBe(false)
  })

  it('does not grant a signed approval after its exact fields are tampered', async () => {
    const job = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills })
    await recordApprovalV2(job.job_id, 'package', 'approved', H, undefined, 'krish', `codex-user-confirmation:package:${H}:valid before tamper`)
    const eventsPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, 'events.jsonl')
    const events = (await readFile(eventsPath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line))
    events.at(-1).payload.approval.artifact_hash = 'b'.repeat(64)
    await writeFile(eventsPath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`)

    const reloaded = await loadJobV2(job.job_id)
    expect(reloaded.approvals).toEqual([])
    expect(hasApprovalV2(reloaded, 'package', H, 'krish')).toBe(false)
  })

  it('rejects duplicate event replay and ignores replayed or reordered signed approvals', async () => {
    const replayJob = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills })
    await recordApprovalV2(replayJob.job_id, 'package', 'approved', H, undefined, 'krish', `codex-user-confirmation:package:${H}:approval before rejection`)
    await recordApprovalV2(replayJob.job_id, 'package', 'rejected', H, 'The package was subsequently rejected.', 'krish')
    const replayEventsPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', replayJob.job_id, 'events.jsonl')
    const replayEvents = (await readFile(replayEventsPath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line))
    const replay = { ...replayEvents[1], event_id: randomUUID() }
    await appendFile(replayEventsPath, `${JSON.stringify(replay)}\n`)
    expect(hasApprovalV2(await loadJobV2(replayJob.job_id), 'package', H, 'krish')).toBe(false)

    const reorderJob = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills })
    await recordApprovalV2(reorderJob.job_id, 'package', 'approved', H, undefined, 'krish', `codex-user-confirmation:package:${H}:approval before reorder`)
    await recordApprovalV2(reorderJob.job_id, 'package', 'rejected', H, 'The later decision must remain authoritative.', 'krish')
    const reorderEventsPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', reorderJob.job_id, 'events.jsonl')
    const reorderEvents = (await readFile(reorderEventsPath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line))
    await writeFile(reorderEventsPath, `${[reorderEvents[0], reorderEvents[2], reorderEvents[1]].map((event) => JSON.stringify(event)).join('\n')}\n`)
    expect((await loadJobV2(reorderJob.job_id)).approvals).toEqual([])

    const duplicateJob = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills })
    await recordApprovalV2(duplicateJob.job_id, 'package', 'approved', H, undefined, 'krish', `codex-user-confirmation:package:${H}:approval before duplicate`)
    const duplicateEventsPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', duplicateJob.job_id, 'events.jsonl')
    const duplicateEvents = (await readFile(duplicateEventsPath, 'utf8')).trim().split(/\r?\n/)
    await appendFile(duplicateEventsPath, `${duplicateEvents.at(-1)}\n`)
    await expect(loadJobV2(duplicateJob.job_id)).rejects.toThrow('reuses event ID')
  })

  it('fails closed when the signing key is missing for recording or verification', async () => {
    const unsignedJob = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills })
    setApprovalSigningKeyProviderForTests(null)
    await expect(recordApprovalV2(unsignedJob.job_id, 'package', 'approved', H, undefined, 'krish', `codex-user-confirmation:package:${H}:missing key`)).rejects.toThrow('approval signing credential is unavailable')
    expect((await loadJobV2(unsignedJob.job_id)).approvals).toEqual([])

    setApprovalSigningKeyProviderForTests(() => TEST_APPROVAL_KEY)
    const signedJob = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills })
    await recordApprovalV2(signedJob.job_id, 'package', 'approved', H, undefined, 'krish', `codex-user-confirmation:package:${H}:valid signed approval`)
    setApprovalSigningKeyProviderForTests(null)
    const unverified = await loadJobV2(signedJob.job_id)
    expect(unverified.approvals).toEqual([])
    expect(hasApprovalV2(unverified, 'package', H, 'krish')).toBe(false)
  })

  it('derives approvals and stage state from the event ledger instead of trusting injected job.json state', async () => {
    const job = await createJobV2({ series: 'built_with_ai', mode: 'short_native', presenterName: 'Krish', configPath: config, skillPaths: skills })
    const manifestPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, 'job.json')
    const injected = JSON.parse(await readFile(manifestPath, 'utf8'))
    injected.approvals = [{
      gate: 'package',
      decision: 'approved',
      artifact_hash: H,
      actor: 'krish',
      confirmation_ref: `codex-user-confirmation:package:${H}:forged outside the event ledger`,
      occurred_at: '2099-01-01T00:00:00.000Z',
    }]
    injected.stages.package = {
      status: 'complete',
      artifact_hash: H,
      artifact_path: `artifacts/package/${H}.json`,
      updated_at: '2099-01-01T00:00:00.000Z',
    }
    injected.updated_at = '2099-01-01T00:00:00.000Z'
    await writeFile(manifestPath, `${JSON.stringify(injected, null, 2)}\n`)

    const reloaded = await loadJobV2(job.job_id)
    expect(reloaded.approvals).toEqual([])
    expect(reloaded.stages.package.status).toBe('pending')
    expect(reloaded.updated_at).not.toBe('2099-01-01T00:00:00.000Z')
    expect(hasApprovalV2(reloaded, 'package', H, 'krish')).toBe(false)
  })

  it('rejects tampered pinned content and recorded hashes', async () => {
    const contentJob = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills, techniqueRegistryPath: techniques })
    const pinnedConfig = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', contentJob.job_id, contentJob.pinned_inputs.config_path)
    await writeFile(pinnedConfig, '{"schema_version":1,"tampered":true}\n')
    await expect(loadJobV2(contentJob.job_id)).rejects.toThrow('pinned config hash does not match')

    const hashJob = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills, techniqueRegistryPath: techniques })
    const hashManifestPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', hashJob.job_id, 'job.json')
    const hashManifest = JSON.parse(await readFile(hashManifestPath, 'utf8'))
    hashManifest.config_hash = 'b'.repeat(64)
    await writeFile(hashManifestPath, `${JSON.stringify(hashManifest, null, 2)}\n`)
    await expect(loadJobV2(hashJob.job_id)).rejects.toThrow('pinned config hash does not match')

    const skillJob = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills, techniqueRegistryPath: techniques })
    const pinnedSkill = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', skillJob.job_id, skillJob.pinned_inputs.skill_paths['mindmake-video']!)
    await writeFile(pinnedSkill, 'silently altered skill instructions')
    await expect(loadJobV2(skillJob.job_id)).rejects.toThrow('pinned skill hash does not match')
  })

  it('rejects traversal in pinned config and skill paths before reading them', async () => {
    const configJob = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills })
    const configManifestPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', configJob.job_id, 'job.json')
    const configManifest = JSON.parse(await readFile(configManifestPath, 'utf8'))
    configManifest.pinned_inputs.config_path = '../../outside.json'
    await writeFile(configManifestPath, `${JSON.stringify(configManifest, null, 2)}\n`)
    await expect(loadJobV2(configJob.job_id)).rejects.toThrow('pinned config path escapes its job-pinned directory')

    const skillJob = await createJobV2({ series: 'built_with_ai', mode: 'short_native', configPath: config, skillPaths: skills })
    const skillManifestPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', skillJob.job_id, 'job.json')
    const skillManifest = JSON.parse(await readFile(skillManifestPath, 'utf8'))
    skillManifest.pinned_inputs.skill_paths['mindmake-video'] = '../../mindmake-video'
    await writeFile(skillManifestPath, `${JSON.stringify(skillManifest, null, 2)}\n`)
    await expect(loadJobV2(skillJob.job_id)).rejects.toThrow('pinned skill path mindmake-video escapes its job-pinned directory')
  })

  it('resumes an older event ledger from immutable pins after checkout inputs change', async () => {
    const job = await createJobV2({ series: 'money_of_ai', mode: 'short_native', presenterName: 'Krish', configPath: config, skillPaths: skills, techniqueRegistryPath: techniques })
    const eventsPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, 'events.jsonl')
    const events = (await readFile(eventsPath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line))
    delete events[0].payload.purpose
    delete events[0].payload.presenter_name
    delete events[0].payload.config_hash
    delete events[0].payload.skill_hashes
    delete events[0].payload.pinned_inputs_hash
    await writeFile(eventsPath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`)

    await writeFile(config, '{"schema_version":1,"checkout_revision":"new"}\n')
    await writeFile(skills[0]!, 'new checkout skill instructions')
    await writeFile(techniques, '{"schema_version":1,"techniques":[{"id":"new-checkout"}]}\n')

    const resumed = await loadJobV2(job.job_id)
    expect(resumed.config_hash).toBe(job.config_hash)
    expect(resumed.skill_hashes).toEqual(job.skill_hashes)
    expect(resumed.pinned_inputs.technique_registry_hash).toBe(job.pinned_inputs.technique_registry_hash)
    expect(resumed.presenter_name).toBe('Krish')
  })

  it('rejects a stage artifact changed after its content address was recorded', async () => {
    const job = await createJobV2({ series: 'built_with_ai', mode: 'short_native', presenterName: 'Krish', configPath: config, skillPaths: skills })
    const artifact = await completeStageV2(job.job_id, 'brief', { audience_problem: 'Operators need visible proof.' }, {}, { author: 'test' })
    const artifactPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, 'artifacts', 'brief', `${artifact.artifact_hash}.json`)
    const changed = JSON.parse(await readFile(artifactPath, 'utf8'))
    changed.payload.audience_problem = 'This was silently changed after approval.'
    await writeFile(artifactPath, `${JSON.stringify(changed, null, 2)}\n`)
    await expect(readStageArtifactV2(job.job_id, 'brief')).rejects.toThrow('content no longer matches its semantic hash')
    await expect(completeStageV2(job.job_id, 'brief', { audience_problem: 'Operators need visible proof.' }, {}, { author: 'test' })).rejects.toThrow('content no longer matches its semantic hash')
  })

  it('keeps audit timestamps out of semantic artifact identity', () => {
    const left = { generated_at: '2026-09-04T10:00:00.000Z', nested: { approved_at: '2026-09-04T10:01:00.000Z', decision: 'approved' } }
    const right = { generated_at: '2026-09-05T10:00:00.000Z', nested: { approved_at: '2026-09-05T10:01:00.000Z', decision: 'approved' } }
    expect(hashValue(withoutAuditTimestamps(left))).toBe(hashValue(withoutAuditTimestamps(right)))
  })

  it('starts short-native work before recording and attaches media without invalidating the approved script path', async () => {
    const job = await createJobV2({
      series: 'built_with_ai', mode: 'short_native', presenterName: 'Krish', configPath: config, skillPaths: skills, techniqueRegistryPath: techniques,
    })
    expect(job.source_bundle).toBeUndefined()
    expect(job.stages.brief.status).toBe('pending')
    expect(job.stages.ingest.status).toBe('pending')
    await completeStageV2(job.job_id, 'brief', { audience_problem: 'Operators cannot see the mechanism.' }, {}, { author: 'test' })
    await completeStageV2(job.job_id, 'script', { script: 'Show the mechanism and its consequence.' }, { brief: H }, { author: 'test' })
    await completeStageV2(job.job_id, 'candidates', { candidates: [] }, { script: H }, { author: 'test' })
    await completeStageV2(job.job_id, 'claims', { claims: [] }, { candidates: H }, { author: 'test' })
    await completeStageV2(job.job_id, 'recording_brief', { guidance: 'Record only after angle approval.' }, { candidates: H, claims: H }, { director: 'test' })
    const attached = await attachSourceBundleV2(job.job_id, {
      schema_version: 1,
      bundle_id: 'recorded-take-1',
      primary_source_id: 'camera-main',
      sources: [{ source_id: 'camera-main', kind: 'video', role: 'primary_camera', ref: 'take.mp4', rights: 'owned', sync: { strategy: 'already_mixed', offset_ms: 0 }, include_in_edit: true }],
    })
    expect(attached.source_bundle?.bundle_id).toBe('recorded-take-1')
    expect(attached.stages.brief.status).toBe('complete')
    expect(attached.stages.candidates.status).toBe('complete')
    expect(attached.stages.recording_brief.status).toBe('complete')
    expect(attached.stages.ingest.status).toBe('pending')
    const eventsPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, 'events.jsonl')
    const events = (await readFile(eventsPath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line))
    expect(events.some((event) => event.type === 'source_bundle_attached')).toBe(true)
    const legacyAttachment = events.find((event) => event.type === 'source_bundle_attached')
    delete legacyAttachment.payload.intake_proof_hash
    await writeFile(eventsPath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`)
    await expect(loadJobV2(job.job_id)).resolves.toMatchObject({ source_bundle: { bundle_id: 'recorded-take-1' } })
  })

  it('enforces prerequisites and invalidates only visual descendants', async () => {
    const job = await createJobV2({
      series: 'money_of_ai', mode: 'extract', configPath: config, skillPaths: skills,
      sourceBundle: { schema_version: 1, bundle_id: 'bundle-1', primary_source_id: 'camera-main', sources: [{ source_id: 'camera-main', kind: 'video', role: 'mixed_program', ref: 'source.mp4', rights: 'permissioned', participants: [{ kind: 'job_local', label: 'Guest', consent_ref: 'fixture-consent' }], sync: { strategy: 'already_mixed', offset_ms: 0 }, include_in_edit: true }] },
    })
    await expect(completeStageV2(job.job_id, 'normalize', {}, { ingest: H }, { ffmpeg: 'test' })).rejects.toThrow('waiting for: ingest')
    const ingest = await completeStageV2(job.job_id, 'ingest', { accepted: true }, { source: H }, { ffprobe: 'test' })
    await completeStageV2(job.job_id, 'normalize', { accepted: true }, { ingest: ingest.artifact_hash }, { ffmpeg: 'test' })
    await completeStageV2(job.job_id, 'transcript', { accepted: true }, { normalize: H }, { whisper: 'test' })
    const first = await completeStageV2(job.job_id, 'source_analysis', {
      schema_version: 1, analysis_id: 'analysis-1', job_id: job.job_id, source_bundle_hash: H, coordinate_space: 'normalized_0_1', timebase: 'source_local_ms', generated_at: new Date().toISOString(), capabilities: { tier: 1, analyzers: { fallback: 'test' }, unavailable: [], fallbacks: [] }, sources: [{ source_id: 'camera-main', source_hash: H, duration_ms: 1000, width: 1920, height: 1080, fps: 30, audio_hz: 48000, canonical_offset_ms: 0 }], shots: [], subjects: [], active_speakers: [], gestures: [], gaze: [], negative_space: [], protected_regions: [], sidecars: [], quality_issues: [],
    }, { normalize: H }, { analyzer: 'test' })
    await completeStageV2(job.job_id, 'source_analysis', {
      schema_version: 1, analysis_id: 'analysis-2', job_id: job.job_id, source_bundle_hash: H, coordinate_space: 'normalized_0_1', timebase: 'source_local_ms', generated_at: new Date().toISOString(), capabilities: { tier: 1, analyzers: { fallback: 'test-2' }, unavailable: [], fallbacks: [] }, sources: [{ source_id: 'camera-main', source_hash: H, duration_ms: 1000, width: 1920, height: 1080, fps: 30, audio_hz: 48000, canonical_offset_ms: 0 }], shots: [], subjects: [], active_speakers: [], gestures: [], gaze: [], negative_space: [], protected_regions: [], sidecars: [], quality_issues: [],
    }, { normalize: H }, { analyzer: 'test-2' })
    const reloaded = await loadJobV2(job.job_id)
    expect(first.artifact_hash).not.toBe(reloaded.stages.source_analysis.artifact_hash)
    expect(reloaded.stages.transcript.status).toBe('complete')
    expect(reloaded.stages.visual_plan.status).toBe('pending')
    expect((await readFile(join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', job.job_id, 'events.jsonl'), 'utf8')).trim()).not.toBe('')
  })
})
