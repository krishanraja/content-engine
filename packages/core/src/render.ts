import { mkdir, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import type { RenderManifestV1 } from '@mindmake/contracts'
import { jobPath } from './paths.js'
import { rendererProps } from './treatment.js'
import { run } from './process.js'
import { remotionLicenceEligible } from './doctor.js'

export async function renderShort(repoRoot: string, manifest: RenderManifestV1, preview = false): Promise<string> {
  if (!await remotionLicenceEligible(repoRoot)) throw new Error('Remotion licence eligibility is not confirmed. Run studio doctor.')
  const suffix = preview ? '.preview' : ''
  const outputPath = join(jobPath(manifest.job_id), 'renders', `${manifest.treatment_id}${suffix}.mp4`)
  const rawPath = join(jobPath(manifest.job_id), 'renders', `${manifest.treatment_id}${suffix}.raw.mp4`)
  await mkdir(dirname(outputPath), { recursive: true })
  const inputProps = rendererProps(manifest)
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
    crf: 18,
    scale: preview ? 0.5 : 1,
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
