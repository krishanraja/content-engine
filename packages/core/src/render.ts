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
import { hashValue } from './hash.js'
import { studioPaths } from './paths.js'

const REMOTION_VERSION = '4.0.518'

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

export async function renderShort(repoRoot: string, manifest: RenderManifestV1, preview = false, previewDurationMs = 6_000): Promise<string> {
  if (!await remotionLicenceEligible(repoRoot)) throw new Error('Remotion licence eligibility is not confirmed. Run studio doctor.')
  const effectiveDurationMs = preview ? Math.min(manifest.duration_ms, Math.max(1_000, previewDurationMs)) : manifest.duration_ms
  const renderManifest = effectiveDurationMs === manifest.duration_ms ? manifest : { ...manifest, duration_ms: effectiveDurationMs, captions: manifest.captions.filter((cue) => cue.start_ms < effectiveDurationMs).map((cue) => ({ ...cue, end_ms: Math.min(cue.end_ms, effectiveDurationMs) })) }
  const previewKey = hashValue({ manifest: renderManifest, profile: preview ? 'review-proxy-v3-15fps' : 'master-v1' }).slice(0, 10)
  const suffix = preview ? `.preview-${Math.ceil(effectiveDurationMs / 1000)}s-${previewKey}` : ''
  const outputPath = join(jobPath(manifest.job_id), 'renders', `${manifest.treatment_id}${suffix}.mp4`)
  const rawPath = join(jobPath(manifest.job_id), 'renders', `${manifest.treatment_id}${suffix}.raw.mp4`)
  await mkdir(dirname(outputPath), { recursive: true })
  if (preview) {
    try { await access(outputPath); return outputPath } catch { /* Render a missing cached preview. */ }
  }
  const inputProps = rendererProps(renderManifest)
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
    crf: preview ? 28 : 18,
    scale: preview ? 0.25 : 1,
    ...(preview ? { concurrency: Math.max(1, Math.min(4, availableParallelism() - 1)), everyNthFrame: 2, jpegQuality: 70, x264Preset: 'veryfast' as const } : {}),
    logLevel: 'info',
  })
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', rawPath,
    '-map_metadata', '-1', '-c:v', 'copy',
    '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', outputPath,
  ], { timeoutMs: 1_800_000 })
  await unlink(rawPath)
  return outputPath
}
