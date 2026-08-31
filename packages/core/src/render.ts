import { access, cp, mkdir, unlink } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { bundle } from '@remotion/bundler'
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer'
import type { RenderManifestV1 } from '@mindmake/contracts'
import { jobPath } from './paths.js'
import { rendererProps } from './treatment.js'
import { run } from './process.js'
import { remotionLicenceEligible } from './doctor.js'
import { hashFile, hashPath, hashValue } from './hash.js'
import { studioPaths } from './paths.js'
import { stageOfficialWordmarks } from './brand-assets.js'

const REMOTION_VERSION = '4.0.518'

export async function rendererImplementationHash(repoRoot: string): Promise<string> {
  return hashValue({
    renderer_source: await hashPath(join(repoRoot, 'apps', 'renderer', 'src')),
    renderer_props: await hashFile(join(repoRoot, 'packages', 'core', 'src', 'treatment.ts')),
    renderer_runtime: await hashFile(join(repoRoot, 'packages', 'core', 'src', 'render.ts')),
    brand_asset_runtime: await hashFile(join(repoRoot, 'packages', 'core', 'src', 'brand-assets.ts')),
    dependencies: await hashFile(join(repoRoot, 'package-lock.json')),
  })
}

export function renderCacheKey(manifest: unknown, profile: string, rendererHash: string): string {
  return hashValue({ manifest, profile, renderer_hash: rendererHash, audio_normalization: 'loudnorm-two-pass-v2-aac-headroom' })
}

export function validateAudioDurationParity(videoDurationSeconds: number, audioDurationSeconds: number, toleranceSeconds = 0.15): string[] {
  if (!Number.isFinite(videoDurationSeconds) || videoDurationSeconds <= 0) return ['rendered video duration is unavailable']
  if (!Number.isFinite(audioDurationSeconds) || audioDurationSeconds <= 0) return ['rendered audio duration is unavailable']
  const drift = Math.abs(videoDurationSeconds - audioDurationSeconds)
  return drift > toleranceSeconds ? [`rendered audio duration differs from video by ${drift.toFixed(3)} seconds`] : []
}

async function verifyRenderedAudioDuration(path: string): Promise<void> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_type,duration', '-show_entries', 'format=duration', '-of', 'json', path,
  ])
  const parsed = JSON.parse(stdout) as { streams?: Array<{ codec_type?: string; duration?: string }>; format?: { duration?: string } }
  const videoDuration = Number(parsed.streams?.find((stream) => stream.codec_type === 'video')?.duration || parsed.format?.duration)
  const audioDuration = Number(parsed.streams?.find((stream) => stream.codec_type === 'audio')?.duration)
  const issues = validateAudioDurationParity(videoDuration, audioDuration)
  if (issues.length) throw new Error(`rendered audio integrity failed: ${issues.join('; ')}`)
}

export function loudnormSecondPassFilter(stderr: string): string {
  const json = stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0]
  if (!json) throw new Error('FFmpeg loudness measurement did not return JSON')
  const measured = JSON.parse(json) as Record<string, string>
  const fields = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'] as const
  for (const field of fields) if (!Number.isFinite(Number(measured[field]))) throw new Error(`FFmpeg loudness measurement is invalid: ${field}`)
  return [
    'loudnorm=I=-14:TP=-1.5:LRA=11',
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true',
    'print_format=summary',
  ].join(':')
}

async function measuredLoudnormFilter(path: string): Promise<string> {
  const { stderr } = await run('ffmpeg', [
    '-hide_banner', '-nostats', '-i', path,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-',
  ], { timeoutMs: 600_000 })
  return loudnormSecondPassFilter(stderr)
}

export async function normalizeRenderedAudio(inputPath: string, outputPath: string): Promise<string> {
  const loudnormFilter = await measuredLoudnormFilter(inputPath)
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
    '-map_metadata', '-1', '-c:v', 'copy',
    '-af', loudnormFilter, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', outputPath,
  ], { timeoutMs: 1_800_000 })
  return outputPath
}

async function sharedBrowserExecutable(): Promise<string> {
  const targetDirectory = join(studioPaths().runtimeRoot, 'browser', `remotion-${REMOTION_VERSION}`, 'headless-shell')
  const targetExecutable = join(targetDirectory, 'chrome-headless-shell.exe')
  try { await access(targetExecutable); return targetExecutable } catch { /* Seed the shared browser once. */ }
  const status = await ensureBrowser({ chromeMode: 'headless-shell', logLevel: 'info' })
  if (status.type !== 'local-puppeteer-browser' && status.type !== 'user-defined-path') throw new Error('Remotion browser could not be installed')
  await mkdir(dirname(targetDirectory), { recursive: true })
  await cp(dirname(status.path), targetDirectory, { recursive: true, force: true })
  const copiedExecutable = join(targetDirectory, basename(status.path))
  await access(copiedExecutable)
  return copiedExecutable
}

export async function renderShort(repoRoot: string, manifest: RenderManifestV1, preview = false, previewDurationMs = 6_000, previewScale = 0.25): Promise<string> {
  if (!await remotionLicenceEligible(repoRoot)) throw new Error('Remotion licence eligibility is not confirmed. Run studio doctor.')
  if (preview && ![0.25, 1].includes(previewScale)) throw new Error('preview scale must be 0.25 or 1')
  const effectiveDurationMs = preview ? Math.min(manifest.duration_ms, Math.max(1_000, previewDurationMs)) : manifest.duration_ms
  const renderManifest = effectiveDurationMs === manifest.duration_ms ? manifest : {
    ...manifest,
    duration_ms: effectiveDurationMs,
    captions: manifest.captions.filter((cue) => cue.start_ms < effectiveDurationMs).map((cue) => ({ ...cue, end_ms: Math.min(cue.end_ms, effectiveDurationMs) })),
    evidence_overlays: manifest.evidence_overlays.filter((overlay) => overlay.start_ms < effectiveDurationMs).map((overlay) => ({ ...overlay, end_ms: Math.min(overlay.end_ms, effectiveDurationMs) })),
  }
  const previewProfile = previewScale === 1 ? 'review-hq-v3-30fps' : 'review-proxy-v6-30fps'
  const rendererHash = await rendererImplementationHash(repoRoot)
  const previewKey = renderCacheKey(renderManifest, preview ? previewProfile : 'master-v3', rendererHash).slice(0, 10)
  const suffix = preview ? `.preview-${previewScale === 1 ? 'hq' : 'proxy'}-${Math.ceil(effectiveDurationMs / 1000)}s-${previewKey}` : ''
  const outputPath = join(jobPath(manifest.job_id), 'renders', `${manifest.treatment_id}${suffix}.mp4`)
  const rawPath = join(jobPath(manifest.job_id), 'renders', `${manifest.treatment_id}${suffix}.raw.mp4`)
  await mkdir(dirname(outputPath), { recursive: true })
  if (preview) {
    try { await access(outputPath); return outputPath } catch { /* Render a missing cached preview. */ }
  }
  const brandWordmarks = await stageOfficialWordmarks(renderManifest, dirname(manifest.source_path))
  const inputProps = rendererProps(renderManifest, brandWordmarks)
  const browserExecutable = await sharedBrowserExecutable()
  const serveUrl = await bundle({ entryPoint: join(repoRoot, 'apps', 'renderer', 'src', 'index.ts'), publicDir: dirname(manifest.source_path) })
  const composition = await selectComposition({ serveUrl, id: 'MindmakeShort', inputProps, browserExecutable })
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: rawPath,
    inputProps,
    browserExecutable,
    imageFormat: 'jpeg',
    pixelFormat: 'yuv420p',
    crf: preview && previewScale < 1 ? 28 : 18,
    scale: preview ? previewScale : 1,
    ...(preview ? { concurrency: Math.max(1, Math.min(4, availableParallelism() - 1)), ...(previewScale < 1 ? { jpegQuality: 70, x264Preset: 'veryfast' as const } : { jpegQuality: 90, x264Preset: 'medium' as const }) } : {}),
    logLevel: 'info',
  })
  await normalizeRenderedAudio(rawPath, outputPath)
  await verifyRenderedAudioDuration(outputPath)
  await unlink(rawPath)
  return outputPath
}
