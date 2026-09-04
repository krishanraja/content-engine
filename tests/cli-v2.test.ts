import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Command } from 'commander'
import { afterEach, describe, expect, it } from 'vitest'
import { classifyError } from '@mindmake/core'
import { assertCanonicalEvidencePacketPathV2, assertYoutubePrivateOnly, evidenceApprovalCurrentnessIssuesV2, evidenceClaimUrlIssues, qaPassed, registerV2Commands, resolveApprovalArtifactHash, type CurrentEvidencePacketRefV2, type EvidenceReviewPacketV2 } from '../packages/cli/src/v2.js'
import { runStudioCli } from '../packages/cli/src/index.js'
import type { JobManifestV2 } from '@mindmake/contracts'

describe.sequential('V2 CLI', () => {
  const roots: string[] = []
  const priorRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT

  afterEach(async () => {
    if (priorRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
    else process.env.MINDMAKE_RUNTIME_ROOT = priorRuntimeRoot
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('exposes only the private YouTube publishing surface', () => {
    const program = new Command().exitOverride()
    registerV2Commands(program, { repoRoot: '.', configPath: 'config.json', skillPaths: [], out: () => undefined })
    const v2 = program.commands.find((command) => command.name() === 'v2')!
    expect(v2.commands.map((command) => command.name())).toEqual(expect.arrayContaining(['identity', 'job', 'ingest', 'transcribe', 'candidates', 'recording-brief', 'source', 'visual-plan', 'assets', 'styleframes', 'animatic', 'treatment', 'render', 'qa', 'approve', 'feedback', 'package', 'publish', 'analytics', 'experiment']))
    const publish = v2.commands.find((command) => command.name() === 'publish')!
    expect(publish.commands.map((command) => command.name())).toEqual(['youtube'])
    expect(() => assertYoutubePrivateOnly('youtube_shorts', 'private')).not.toThrow()
    expect(() => assertYoutubePrivateOnly('youtube_shorts', 'public')).toThrow(/only permits private/i)
    expect(() => assertYoutubePrivateOnly('linkedin', 'private')).toThrow(/local draft packages/i)
    try { assertYoutubePrivateOnly('linkedin', 'private') } catch (error) { expect(classifyError(error).exitCode).toBe(20) }
  })

  it('accepts only explicit passing QA shapes', () => {
    expect(qaPassed({ passed: true })).toBe(true)
    expect(qaPassed({ passed: false })).toBe(false)
    expect(qaPassed({ results: [{ passed: true }, { passed: true }] })).toBe(true)
    expect(qaPassed({ verdicts: [{ passed: true }, { passed: false }] })).toBe(false)
    expect(qaPassed({})).toBe(false)
  })

  it('binds each evidence asset URL to the exact approved claim it is meant to prove', () => {
    const requirements = [{ asset_id: 'proof-1', content_kind: 'evidence_screenshot' as const, truth_role: 'evidence' as const, narrative_job: 'prove' as const, claim_ids: ['claim-1'], brief: 'Show the exact reported consequence.', generated_allowed: false, required: true, fallback: 'Return to Krish.' }]
    const assets = [{ asset_id: 'proof-1', media_kind: 'image' as const, content_kind: 'evidence_screenshot' as const, truth_role: 'evidence' as const, path: 'proof.png', sha256: 'a'.repeat(64), source_url: 'https://example.com/report?b=2&a=1#result', rights: 'third_party_commentary_excerpt' as const, attribution: 'Example report', rights_rationale: 'A short attributed crop directly proves the claim.', generated: false, approval: { state: 'unreviewed' as const } }]
    const claims = [{ claim_id: 'claim-1', candidate_id: 'candidate-1', text: 'The result changed.', kind: 'fact' as const, evidence_urls: ['https://EXAMPLE.com/report?a=1&b=2'], verification: 'verified' as const }]
    expect(evidenceClaimUrlIssues(requirements, assets, claims, 'candidate-1')).toEqual([])
    expect(evidenceClaimUrlIssues(requirements, assets, [{ ...claims[0]!, evidence_urls: ['https://example.com/unrelated'] }], 'candidate-1')).toContain('evidence asset proof-1 is not sourced from the approved evidence URL for claim claim-1')
  })

  it('hashes exact approval files while accepting an existing SHA-256', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mindmake-cli-hash-'))
    roots.push(root)
    const path = join(root, 'candidate.json')
    await writeFile(path, '{"candidate":"exact"}\n', 'utf8')
    const hash = await resolveApprovalArtifactHash(path)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(await resolveApprovalArtifactHash(hash)).toBe(hash)
  })

  it('accepts only a regular packet directly inside the exact job review directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mindmake-evidence-path-'))
    roots.push(root)
    process.env.MINDMAKE_RUNTIME_ROOT = join(root, 'runtime')
    const jobId = 'evidence-path-job'
    const packetId = 'evidence-current-packet'
    const evidenceRoot = join(process.env.MINDMAKE_RUNTIME_ROOT, 'jobs', jobId, 'reviews', 'evidence')
    await mkdir(evidenceRoot, { recursive: true })
    const validPath = join(evidenceRoot, `${packetId}.json`)
    await writeFile(validPath, '{}\n', 'utf8')
    await expect(assertCanonicalEvidencePacketPathV2(jobId, validPath, packetId)).resolves.toBe(validPath)

    const outside = join(root, `${packetId}.json`)
    await writeFile(outside, '{}\n', 'utf8')
    await expect(assertCanonicalEvidencePacketPathV2(jobId, outside, packetId)).rejects.toThrow(/directly contained/i)
    await expect(assertCanonicalEvidencePacketPathV2(jobId, join(evidenceRoot, '..', `${packetId}.json`), packetId)).rejects.toThrow(/directly contained/i)

    const escapeLink = join(evidenceRoot, 'evidence-linked-packet.json')
    try {
      await symlink(outside, escapeLink, 'file')
      await expect(assertCanonicalEvidencePacketPathV2(jobId, escapeLink, 'evidence-linked-packet')).rejects.toThrow(/regular canonical file|real path escapes/i)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error
    }

    const linkedRootJob = 'evidence-linked-root-job'
    const linkedJobRoot = join(process.env.MINDMAKE_RUNTIME_ROOT, 'jobs', linkedRootJob)
    const outsideEvidenceRoot = join(root, 'outside-evidence-root')
    await mkdir(join(linkedJobRoot, 'reviews'), { recursive: true })
    await mkdir(outsideEvidenceRoot, { recursive: true })
    const linkedEvidenceRoot = join(linkedJobRoot, 'reviews', 'evidence')
    try {
      await symlink(outsideEvidenceRoot, linkedEvidenceRoot, process.platform === 'win32' ? 'junction' : 'dir')
      const linkedPacket = join(linkedEvidenceRoot, `${packetId}.json`)
      await writeFile(join(outsideEvidenceRoot, `${packetId}.json`), '{}\n', 'utf8')
      await expect(assertCanonicalEvidencePacketPathV2(linkedRootJob, linkedPacket, packetId)).rejects.toThrow(/exact current job/i)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error
    }
  })

  it('binds evidence approval to the current prepared packet and a runnable current visual plan', () => {
    const hash = (character: string) => character.repeat(64)
    const packetPath = resolve(join('runtime', 'jobs', 'evidence-current-job', 'reviews', 'evidence', 'evidence-current.json'))
    const packet: EvidenceReviewPacketV2 = { schema_version: 2, packet_id: 'evidence-current', job_id: 'evidence-current-job', visual_plan_artifact_hash: hash('a'), assets: [], generated_shots: [] }
    const currentRef: CurrentEvidencePacketRefV2 = { schema_version: 2, job_id: packet.job_id, packet_path: packetPath, packet_hash: hash('b'), visual_plan_artifact_hash: hash('a') }
    const readyJob = {
      job_id: packet.job_id,
      mode: 'solo',
      stages: {
        visual_plan: { status: 'complete', artifact_hash: hash('a'), updated_at: '2026-09-04T10:00:00.000Z' },
        assets: { status: 'pending', updated_at: '2026-09-04T10:00:00.000Z' },
      },
    } as unknown as JobManifestV2
    const valid = { job: readyJob, packet, packet_path: packetPath, packet_hash: hash('b'), current_ref: currentRef, current_visual_plan_hash: hash('a') }
    expect(evidenceApprovalCurrentnessIssuesV2(valid)).toEqual([])
    expect(evidenceApprovalCurrentnessIssuesV2({ ...valid, current_ref: { ...currentRef, packet_hash: hash('c') } })).toContain('evidence packet is not the current prepared packet')
    expect(evidenceApprovalCurrentnessIssuesV2({ ...valid, current_ref: { ...currentRef, packet_path: resolve('stale-packet.json') } })).toContain('evidence packet is not the current prepared packet')
    expect(evidenceApprovalCurrentnessIssuesV2({ ...valid, current_visual_plan_hash: hash('d') })).toContain('evidence packet is stale for the current visual plan')
    for (const status of ['pending', 'invalidated'] as const) {
      const job = { ...readyJob, stages: { ...readyJob.stages, visual_plan: { status, updated_at: '2026-09-04T10:00:00.000Z' } } } as unknown as JobManifestV2
      expect(evidenceApprovalCurrentnessIssuesV2({ ...valid, job })).toContain('assets stage is not ready for evidence approval')
    }
  })

  it('creates a schema V2 job without weakening V1 command registration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mindmake-cli-create-'))
    roots.push(root)
    const runtimeRoot = join(root, 'runtime')
    const repoRoot = join(root, 'repo')
    const configPath = join(repoRoot, 'config', 'studio.json')
    const techniquesPath = join(repoRoot, 'config', 'techniques.json')
    const skillPath = join(repoRoot, '.agents', 'skills', 'mindmake-video')
    const bundlePath = join(root, 'source-bundle.json')
    await mkdir(join(repoRoot, 'config'), { recursive: true })
    await mkdir(skillPath, { recursive: true })
    await writeFile(configPath, '{}\n', 'utf8')
    await writeFile(techniquesPath, '{"schema_version":1,"registry_id":"test","version":1,"principle":"test registry"}\n', 'utf8')
    await writeFile(join(skillPath, 'SKILL.md'), '# Test\n', 'utf8')
    await writeFile(bundlePath, JSON.stringify({
      schema_version: 1,
      bundle_id: 'bundle-test',
      primary_source_id: 'cam-1',
      sources: [{ source_id: 'cam-1', kind: 'video', role: 'primary_camera', ref: join(root, 'source.mp4'), rights: 'owned', sync: { strategy: 'already_mixed', offset_ms: 0 }, include_in_edit: true }],
    }), 'utf8')
    process.env.MINDMAKE_RUNTIME_ROOT = runtimeRoot
    const outputs: unknown[] = []
    const program = new Command().exitOverride()
    program.command('legacy-placeholder')
    registerV2Commands(program, { repoRoot, configPath, skillPaths: [skillPath], out: (value) => outputs.push(value) })
    await program.parseAsync([
      'node', 'studio', 'v2', 'job', 'create', '--series', 'The Money of AI', '--mode', 'solo', '--source-bundle', bundlePath,
      '--techniques', techniquesPath, '--no-identity', '--no-presenter',
    ])
    expect(program.commands.map((command) => command.name())).toContain('legacy-placeholder')
    const output = outputs[0] as { job: { schema_version: number; presenter_name?: string; target_platforms: string[]; treatment_lane: string; pinned_inputs: { technique_registry_hash?: string } } }
    expect(output.job.schema_version).toBe(2)
    expect(output.job.presenter_name).toBeUndefined()
    expect(output.job.target_platforms).toEqual(['youtube_shorts', 'linkedin', 'tiktok', 'instagram_reels'])
    expect(output.job.treatment_lane).toBe('premium')
    expect(output.job.pinned_inputs.technique_registry_hash).toMatch(/^[a-f0-9]{64}$/)
    const jobDirectories = await (await import('node:fs/promises')).readdir(join(runtimeRoot, 'jobs'))
    const persisted = JSON.parse(await readFile(join(runtimeRoot, 'jobs', jobDirectories[0]!, 'job.json'), 'utf8')) as { schema_version: number }
    expect(persisted.schema_version).toBe(2)

    const shortNativeOutputs: unknown[] = []
    const shortNativeProgram = new Command().exitOverride()
    registerV2Commands(shortNativeProgram, { repoRoot, configPath, skillPaths: [skillPath], out: (value) => shortNativeOutputs.push(value) })
    await shortNativeProgram.parseAsync([
      'node', 'studio', 'v2', 'job', 'create', '--series', 'Built With AI', '--mode', 'short_native',
      '--techniques', techniquesPath, '--no-identity',
    ])
    const shortNative = shortNativeOutputs[0] as { job: { source_bundle?: unknown }; next_stage: string }
    expect(shortNative.job.source_bundle).toBeUndefined()
    expect(shortNative.next_stage).toBe('brief')

    const beforePath = join(root, 'copy-before.json')
    const afterPath = join(root, 'copy-after.json')
    await writeFile(beforePath, '{"post_copy":"General opening"}\n', 'utf8')
    await writeFile(afterPath, '{"post_copy":"Specific operator payoff"}\n', 'utf8')
    const feedbackOutput: unknown[] = []
    const feedbackProgram = new Command().exitOverride()
    registerV2Commands(feedbackProgram, { repoRoot, configPath, skillPaths: [skillPath], out: (value) => feedbackOutput.push(value) })
    await feedbackProgram.parseAsync([
      'node', 'studio', 'v2', 'feedback', 'import', '--job', jobDirectories[0]!, '--artifact-id', 'linkedin-copy',
      '--kind', 'copy', '--stage', 'package', '--action', 'revise', '--before', beforePath, '--after', afterPath,
    ])
    const captured = feedbackOutput[0] as { feedback: { schema_version: number; inferred_rationale: string }; event_path: string; event_hash: string }
    expect(captured.feedback.schema_version).toBe(2)
    expect(captured.feedback.inferred_rationale).toMatch(/platform framing/i)
    const confirmOutput: unknown[] = []
    const confirmProgram = new Command().exitOverride()
    registerV2Commands(confirmProgram, { repoRoot, configPath, skillPaths: [skillPath], out: (value) => confirmOutput.push(value) })
    await confirmProgram.parseAsync([
      'node', 'studio', 'v2', 'feedback', 'confirm', '--event', captured.event_path,
      '--confirmation-ref', `codex-user-confirmation:feedback:${captured.event_hash}:Krish confirmed this inference.`,
    ])
    expect((confirmOutput[0] as { feedback: { confirmation: string } }).feedback.confirmation).toBe('confirmed')
  })

  it('emits machine-readable parser failures while preserving help and version exits', async () => {
    const runCli = (args: string[]) => new Promise<{ code: number | null; stdout: string; stderr: string }>((resolvePromise, reject) => {
      const child = spawn(process.execPath, [join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(process.cwd(), 'packages', 'cli', 'src', 'index.ts'), ...args], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      let settled = false
      const deadline = setTimeout(() => {
        if (settled) return
        settled = true
        child.kill()
        reject(new Error(`CLI probe did not exit within 10 seconds: ${args.join(' ')}`))
      }, 10_000)
      child.stdout.on('data', (chunk) => { stdout += String(chunk) })
      child.stderr.on('data', (chunk) => { stderr += String(chunk) })
      child.once('error', (error) => {
        if (settled) return
        settled = true
        clearTimeout(deadline)
        reject(error)
      })
      child.once('close', (code) => {
        if (settled) return
        settled = true
        clearTimeout(deadline)
        resolvePromise({ code, stdout, stderr })
      })
    })

    const runLoadedCli = async (args: string[]) => {
      let stdout = ''
      let stderr = ''
      const code = await runStudioCli(['node', 'studio', ...args], {
        stdout: (value) => { stdout += value },
        stderr: (value) => { stderr += value },
      })
      return { code, stdout, stderr }
    }

    // One child process verifies the real entry point and exit code. Help and
    // version then reuse the already-loaded command graph, avoiding two more
    // multi-second TypeScript process startups without relaxing the hang limit.
    const invalid = await runCli(['v2', 'analytics', 'import'])
    expect(invalid.code).toBe(10)
    expect(JSON.parse(invalid.stdout)).toMatchObject({ ok: false, code: 'validation' })
    expect(JSON.parse(invalid.stderr)).toMatchObject({ ok: false, code: 'validation', diagnostic: 'command-line parsing failed' })
    expect(invalid.stderr).not.toContain('error: required option')

    const help = await runLoadedCli(['--help'])
    expect(help.code).toBe(0)
    expect(help.stdout).toContain('Mindmaker deterministic video production engine')
    expect(help.stderr).toBe('')

    const version = await runLoadedCli(['--version'])
    expect(version).toMatchObject({ code: 0, stdout: '0.1.0\n', stderr: '' })
  }, 15_000)
})
