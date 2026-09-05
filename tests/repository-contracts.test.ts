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

  it('pins the proactive radar heartbeat to Monday at 11:00 Europe/London', async () => {
    const studio = await json<{ cadence: { radar_day: string; radar_time: string; timezone: string } }>('config/studio.json')
    const heartbeat = await json<{
      kind: string
      source: { repository: string; branch: string }
      schedule: { rrule: string; day: string; local_time: string; timezone: string }
      delivery: { surface: string; thread_binding: string; notification_behavior: string; public_publish_allowed: boolean }
      prompt: string
    }>('config/weekly-radar-heartbeat.json')

    expect(heartbeat.kind).toBe('heartbeat')
    expect(heartbeat.source).toEqual({ repository: 'krishanraja/mindmake-video-studio', branch: 'main' })
    expect(heartbeat.schedule).toEqual({
      rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO;BYHOUR=11;BYMINUTE=0;BYSECOND=0',
      day: studio.cadence.radar_day,
      local_time: studio.cadence.radar_time,
      timezone: studio.cadence.timezone,
    })
    expect(heartbeat.delivery).toEqual({
      surface: 'attached_codex_thread',
      thread_binding: 'operator_managed_runtime_state',
      notification_behavior: 'codex_app_settings',
      public_publish_allowed: false,
    })
    expect(heartbeat.prompt).toContain('latest GitHub main branch of krishanraja/mindmake-video-studio')
    expect(heartbeat.prompt).toContain('do not start a second scraping system')
    expect(heartbeat.prompt).toContain('Label every stale or unavailable provider')
    expect(heartbeat.prompt).toContain('exact evidence screenshot')
    expect(heartbeat.prompt).toContain('Never publish')
  })

  it('documents only the real V2 recovery, transcription and preview surface', async () => {
    const operations = await readFile(join(repoRoot, 'docs', 'OPERATIONS.md'), 'utf8')
    expect(operations).toContain('studio v2 transcribe --job <job-id> --verified <transcript.json>')
    expect(operations).toContain('studio v2 job status')
    expect(operations).toContain('studio v2 job resume --job <job-id>')
    expect(operations).toContain('studio v2 render --job <job-id> --profile preview')
    expect(operations).toContain('540x960 and 30 fps')
    expect(operations).toContain('V2 has no `--full-preview` or `--high-quality-preview` flags')
    expect(operations.match(/--gate final --artifact <[^>]+-master-path>/g)).toHaveLength(4)
    expect(operations).toContain('studio -- v2 approve --job <job-id> --gate package --artifact <package-artifact-hash>')
    expect(operations).toContain('studio -- v2 package archive --job <job-id>')
    expect(operations).not.toContain('studio -- v2 package create --job <job-id> --candidate <candidate-json-path> --archive')
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
    for (const extension of ['webm', 'm2ts', 'mts', 'mxf', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'srt', 'vtt', 'edl', 'fcpxml']) {
      expect(scanner).toContain(extension)
    }
  })
})
