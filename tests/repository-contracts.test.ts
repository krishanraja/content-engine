import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

async function json<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(join(repoRoot, relativePath), 'utf8')) as T
}

describe('repository operating contracts', () => {
  it('locks Krish naming, approval order and the exact Drive path', async () => {
    const studio = await json<{
      transcription: { vocabulary: string[] }
      visual_story_director: { review_gates: string[] }
      runtime: { drive_root: string; media_inbox: string; archive_root: string }
    }>('config/studio.json')
    const exactMediaRoot = String.raw`G:\My Drive\Ventures\Active\Mindmaker\04_Content\Video Engine`

    expect(studio.transcription.vocabulary).toContain('Krish')
    expect(studio.transcription.vocabulary).not.toContain('Krish Raja')
    expect(studio.visual_story_director.review_gates).toEqual([
      'angle', 'visual_plan', 'evidence', 'storyboard', 'animatic', 'treatment', 'final', 'package',
    ])
    expect(studio.runtime.drive_root).toBe(exactMediaRoot)
    expect(studio.runtime.media_inbox).toBe(`${exactMediaRoot}\\Inbox`)
    expect(studio.runtime.archive_root).toBe(`${exactMediaRoot}\\Archive`)

    const environment = await readFile(join(repoRoot, '.env.example'), 'utf8')
    const launcher = await readFile(join(repoRoot, '.agents', 'skills', 'video-engine', 'SKILL.md'), 'utf8')
    const voiceSkill = await readFile(join(repoRoot, '.agents', 'skills', 'krish-voice', 'SKILL.md'), 'utf8')
    const voiceMetadata = await readFile(join(repoRoot, '.agents', 'skills', 'krish-voice', 'agents', 'openai.yaml'), 'utf8')
    const pathSource = await readFile(join(repoRoot, 'packages', 'core', 'src', 'paths.ts'), 'utf8')
    expect(environment).toContain(`MINDMAKE_DRIVE_ROOT=${exactMediaRoot}`)
    expect(environment).toContain(`MINDMAKE_MEDIA_INBOX=${exactMediaRoot}\\Inbox`)
    expect(launcher).toContain(exactMediaRoot)
    expect(launcher).not.toMatch(/Krish(?:an)? Raja/)
    expect(`${voiceSkill}\n${voiceMetadata}`).not.toMatch(/Krish(?:an)? Raja/)
    expect(pathSource).toContain("export const DEFAULT_WINDOWS_DRIVE_ROOT = 'G:\\\\My Drive\\\\Ventures\\\\Active\\\\Mindmaker\\\\04_Content\\\\Video Engine'")
    expect(pathSource).toContain("const INVALID_WINDOWS_DRIVE_ROOT = 'G:\\\\My Drive\\\\Ventures\\\\Active\\\\Mindmaker\\\\04\\\\_Content\\\\Video Engine'")
  })

  it('boots Codex and Claude into the same tracked session protocol without weakening the launcher trigger', async () => {
    const agents = await readFile(join(repoRoot, 'AGENTS.md'), 'utf8')
    const claude = await readFile(join(repoRoot, 'CLAUDE.md'), 'utf8')
    const protocol = await readFile(join(repoRoot, 'docs', 'ENGINE_SESSION.md'), 'utf8')
    const claudeMcp = await json<{ mcpServers: { 'mindmake-studio': { type: string; command: string; args: string[] } } }>('.mcp.json')
    const codexMcp = await readFile(join(repoRoot, '.codex', 'config.toml'), 'utf8')
    const codexProxy = await readFile(join(repoRoot, 'scripts', 'studio-mcp-credential-proxy.ps1'), 'utf8')
    const endpoint = 'https://controlcenter.krishraja.com/api/video-studio/mcp'

    expect(agents).toContain('docs/ENGINE_SESSION.md')
    expect(claude).toContain('studio.session.open')
    expect(protocol).toContain('tool-backed actions')
    expect(protocol).toContain('Never capture:')
    expect(protocol).toContain('whole ChatGPT, Claude, Codex, or Control Center transcript')
    expect(claudeMcp.mcpServers['mindmake-studio']).toEqual({
      type: 'stdio',
      command: 'pwsh',
      args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/studio-mcp-credential-proxy.ps1'],
    })
    expect(codexMcp).toContain('command = "pwsh"')
    expect(codexMcp).toContain('scripts/studio-mcp-credential-proxy.ps1')
    expect(codexMcp).not.toContain('bearer_token_env_var')
    expect(codexProxy).toContain(endpoint)
    expect(codexProxy).toContain('MindmakeVideoStudio/studio-mcp-token')
    expect(codexProxy).toContain('RedirectStandardOutput = $true')
    expect(codexProxy).not.toContain('Write-Output $token')

    const launcher = await readFile(join(repoRoot, '.agents', 'skills', 'video-engine', 'SKILL.md'), 'utf8')
    expect(launcher).toContain("equals 'Video engine' case-insensitively")
    expect(launcher).toContain('Everything else fails')
  })

  it('retires chat delivery and points scheduled work at Control Center', async () => {
    const heartbeat = await json<{
      status: string
      retired_at: string
      reason: string
      source: { repository: string; branch: string }
      replacement: { surface: string; delivery: string; scheduled_work: string; public_publish_allowed: boolean }
    }>('config/video-engine-pulse-heartbeat.json')

    expect(heartbeat.status).toBe('retired')
    expect(heartbeat.retired_at).toBe('2026-09-07')
    expect(heartbeat.reason).toContain('not an attached chat')
    expect(heartbeat.source).toEqual({ repository: 'krishanraja/content-engine', branch: 'main' })
    expect(heartbeat.replacement).toEqual({
      surface: 'control_center_content',
      delivery: 'pull_only',
      scheduled_work: 'server_side_rows',
      public_publish_allowed: false,
    })
  })

  it('pins active runtime credentials to versioned local-only targets', async () => {
    const controlPlane = await readFile(join(repoRoot, 'packages', 'core', 'src', 'control-plane-client.ts'), 'utf8')
    const signing = await readFile(join(repoRoot, 'packages', 'core', 'src', 'approval-signing.ts'), 'utf8')
    const doctor = await readFile(join(repoRoot, 'packages', 'core', 'src', 'doctor.ts'), 'utf8')
    const cli = await readFile(join(repoRoot, 'packages', 'cli', 'src', 'index.ts'), 'utf8')
    const writer = await readFile(join(repoRoot, 'scripts', 'set-credential.ps1'), 'utf8')
    const active = `${controlPlane}\n${signing}\n${doctor}\n${cli}`

    expect(active).toContain('MindmakeVideoStudio/control-center-runner-token-v2')
    expect(active).toContain('MindmakeVideoStudio/control-center-runner-signing-key-v2')
    expect(active).toContain('MindmakeVideoStudio/control-center-radar-token-v2')
    expect(controlPlane).not.toContain("= 'MindmakeVideoStudio/control-center-runner-token'")
    expect(signing).not.toContain("= 'MindmakeVideoStudio/control-center-runner-signing-key'")
    expect(cli).not.toContain("credential: 'MindmakeVideoStudio/control-center-radar-token'")
    expect(writer).toContain('$quarantinedTargets')
    expect(writer).toContain('$isVersionedRuntimeTarget')
  })

  it('documents only the real V2 recovery, transcription and preview surface', async () => {
    const operations = await readFile(join(repoRoot, 'docs', 'OPERATIONS.md'), 'utf8')
    const deployment = await readFile(join(repoRoot, 'docs', 'DEPLOYMENT.md'), 'utf8')
    expect(operations).toContain('studio v2 transcribe --job <job-id> --verified <transcript.json>')
    expect(operations).toContain('studio v2 job status')
    expect(operations).toContain('studio v2 job resume --job <job-id>')
    expect(operations).toContain('studio v2 render --job <job-id> --profile preview')
    expect(operations).toContain('540x960 and 30 fps')
    expect(operations).toContain('V2 has no `--full-preview` or `--high-quality-preview` flags')
    expect(operations.match(/--gate final --artifact <[^>]+-master-path>/g)).toHaveLength(4)
    expect(operations).toContain('.\\scripts\\studio.ps1 v2 approve --job <job-id> --gate package --artifact <package-artifact-hash>')
    expect(operations).toContain('.\\scripts\\studio.ps1 v2 package archive --job <job-id>')
    expect(operations).not.toContain('.\\scripts\\studio.ps1 v2 package create --job <job-id> --candidate <candidate-json-path> --archive')
    expect(operations).not.toContain('npm run studio --')
    const firstMigration = deployment.indexOf('scripts/migrate-runner-runtime.ps1')
    const requiredPreflight = deployment.indexOf('scripts/verify-runner-source.ps1 -RequirePersistentLocation')
    expect(firstMigration).toBeGreaterThan(-1)
    expect(requiredPreflight).toBeGreaterThan(firstMigration)
    expect(deployment).toContain('scripts/migrate-runner-runtime.ps1 -CheckOnly')
    expect(deployment).toContain('.\\scripts\\studio.ps1 index rebuild')
    const stopPreflight = deployment.indexOf('scripts/runner.ps1 -Mode stop-preflight')
    const disableTask = deployment.indexOf('Disable-ScheduledTask -TaskName "Mindmake Video Studio Runner"', stopPreflight)
    const repeatedStopPreflight = deployment.indexOf('scripts/runner.ps1 -Mode stop-preflight', stopPreflight + 1)
    expect(stopPreflight).toBeGreaterThan(-1)
    expect(disableTask).toBeGreaterThan(stopPreflight)
    expect(repeatedStopPreflight).toBeGreaterThan(disableTask)
  })

  it('keeps every supported media and edit-sidecar format out of Git', async () => {
    const extensions = [
      'mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'm2ts', 'mts', 'mxf',
      'wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus',
      'srt', 'vtt', 'edl', 'fcpxml',
      'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'heic', 'tif', 'tiff', 'bmp',
      'sqlite',
    ]
    const candidates = extensions.map((extension) => `runtime-contract-fixture.${extension}`)
    const ignored = execFileSync('git', ['check-ignore', '--stdin'], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: `${candidates.join('\n')}\n`,
    }).split(/\r?\n/).filter(Boolean)
    expect(ignored).toEqual(candidates)

    const scanner = await readFile(join(repoRoot, 'scripts', 'check-no-secrets.ts'), 'utf8')
    const patterns = await readFile(join(repoRoot, 'scripts', 'secret-patterns.ts'), 'utf8')
    for (const extension of ['webm', 'm2ts', 'mts', 'mxf', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'srt', 'vtt', 'edl', 'fcpxml']) {
      expect(scanner).toContain(extension)
    }
    expect(scanner).toContain('containsCommittedSecret')
    expect(patterns).toContain('VIDEO_STUDIO_(?:EXPORT_TOKEN|RUNNER_TOKEN|RUNNER_SIGNING_KEY|MCP_TOKEN)')
    expect(patterns).toContain('#\\s*paste:')
  })
})
