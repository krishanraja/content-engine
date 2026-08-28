import { access, mkdir, unlink } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { dirname, join } from 'node:path'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import type { RenderManifestV1 } from '@mindmake/contracts'
import { jobPath } from './paths.js'
import { rendererProps } from './treatment.js'
import { run } from './process.js'
import { remotionLicenceEligible } from './doctor.js'
import { hashValue } from './hash.js'

export async function renderShort(repoRoot: string, manifest: RenderManifestV1, preview = false, previewDurationMs = 12_000): Promise<string> {
  if (!await remotionLicenceEligible(repoRoot)) throw new Error('Remotion licence eligibility is not confirmed. Run studio doctor.')
  const effectiveDurationMs = preview ? Math.min(manifest.duration_ms, Math.max(1_000, previewDurationMs)) : manifest.duration_ms
  const renderManifest = effectiveDurationMs === manifest.duration_ms ? manifest : { ...manifest, duration_ms: effectiveDurationMs, captions: manifest.captions.filter((cue) => cue.start_ms < effectiveDurationMs).map((cue) => ({ ...cue, end_ms: Math.min(cue.end_ms, effectiveDurationMs) })) }
  const previewKey = hashValue(renderManifest).slice(0, 10)
  const suffix = preview ? `.preview-${Math.ceil(effectiveDurationMs / 1000)}s-${previewKey}` : ''
  const outputPath = join(jobPath(manifest.job_id), 'renders', `${manifest.treatment_id}${suffix}.mp4`)
  const rawPath = join(jobPath(manifest.job_id), 'renders', `${manifest.treatment_id}${suffix}.raw.mp4`)
  await mkdir(dirname(outputPath), { recursive: true })
  if (preview) {
    try { await access(outputPath); return outputPath } catch { /* Render a missing cached preview. */ }
  }
  const inputProps = rendererProps(renderManifest)
  const serveUrl = await bundle({ entryPoint: join(repoRoot, 'apps', 'renderer', 'src', 'index.ts'), publicDir: dirname(manifest.source_path) })
  const composition = await selectComposition({ serveUrl, id: 'MindmakeShort', inputProps })
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: rawPath,
    inputProps,
    imageFormat: 'jpeg',
    pixelFormat: 'yuv420p',
    crf: preview ? 28 : 18,
    scale: preview ? 0.25 : 1,
    ...(preview ? { concurrency: Math.max(1, Math.min(4, availableParallelism() - 1)), jpegQuality: 70, x264Preset: 'veryfast' as const } : {}),
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
