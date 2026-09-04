import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashFile } from './hash.js'
import { resolvePythonCommand } from './python-runtime.js'
import { commandVersion, run, runBuffer } from './process.js'

const SHA256 = /^[a-f0-9]{64}$/
const FALLBACK_WIDTH = 480
const FALLBACK_HEIGHT = 270
const MINIMUM_INTERVAL_MS = 750
const MAXIMUM_SAMPLES = 160

export type CaptionOcrStatus = 'complete' | 'partial' | 'failed' | 'engine_unavailable' | 'fallback_no_ocr'

export interface CaptionRegionFingerprint {
  normalized_pixel_sha256: string
  perceptual_hash: string
  edge_density: number
  contrast: number
}

export interface CaptionRegionAnalysis {
  analysis_version: 1
  analyzer: string
  method: 'python_opencv' | 'ffmpeg_fallback'
  source_sha256: string
  duration_ms: number
  sampling: {
    region_normalized: { x: number; y: number; width: number; height: number }
    interval_ms: number
    maximum_samples: number
    sample_count: number
    coverage_start_ms: number
    coverage_end_ms: number
  }
  implementation: Record<string, string | null>
  implementation_file_sha256: string
  analysis_artifact_path: string
  analysis_artifact_sha256: string
  caption_ocr: {
    status: CaptionOcrStatus
    engine: string | null
    engine_version: string | null
    precision: 'diagnostic_only'
    reason: string
    successful_samples?: number
    failed_samples?: number
  }
  samples: Array<{
    at_ms: number
    relative_path: string
    sample_sha256: string
    normalized_pixel_sha256: string
    perceptual_hash: string
    edge_density: number
    contrast: number
    ocr: Record<string, unknown>
  }>
  fallback_reason?: string
}

interface CaptionAnalysisRuntime {
  runProcess: typeof run
  runBufferProcess: typeof runBuffer
  resolvePython: typeof resolvePythonCommand
  version: typeof commandVersion
}

const defaultRuntime: CaptionAnalysisRuntime = {
  runProcess: run,
  runBufferProcess: runBuffer,
  resolvePython: resolvePythonCommand,
  version: commandVersion,
}

function fallbackReasonCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/timed?\s*out|timeout/i.test(message)) return 'python_analyzer_timeout'
  if (/unsupported result|invalid sample|missing a valid|did not report|did not produce/i.test(message)) return 'python_result_validation_failed'
  if (/cannot find|not found|enoent|no module named|modulenotfounderror|opencv|cv2/i.test(message)) return 'python_runtime_unavailable'
  return 'python_analyzer_failed'
}

function safeLabel(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'artifact'
}

export function captionSampleIntervalMs(durationMs: number): number {
  const duration = Math.max(1, Math.round(durationMs))
  const required = Math.ceil(Math.max(0, duration - 1) / Math.max(1, MAXIMUM_SAMPLES - 1))
  return Math.max(MINIMUM_INTERVAL_MS, Math.ceil(required / 50) * 50)
}

export function captionSampleTimesMs(durationMs: number): number[] {
  const duration = Math.max(1, Math.round(durationMs))
  const interval = captionSampleIntervalMs(duration)
  const count = Math.min(MAXIMUM_SAMPLES, Math.max(1, Math.ceil(duration / interval)))
  return Array.from({ length: count }, (_, index) => Math.min(duration - 1, index * interval))
}

function resizedGrayscale(frame: Buffer, width: number, height: number, outputWidth: number, outputHeight: number): number[] {
  if (frame.length !== width * height) throw new Error('caption-region frame size does not match its declared dimensions')
  const output: number[] = []
  for (let outputY = 0; outputY < outputHeight; outputY += 1) {
    const startY = Math.floor(outputY * height / outputHeight)
    const endY = Math.max(startY + 1, Math.floor((outputY + 1) * height / outputHeight))
    for (let outputX = 0; outputX < outputWidth; outputX += 1) {
      const startX = Math.floor(outputX * width / outputWidth)
      const endX = Math.max(startX + 1, Math.floor((outputX + 1) * width / outputWidth))
      let total = 0
      let count = 0
      for (let y = startY; y < Math.min(height, endY); y += 1) {
        for (let x = startX; x < Math.min(width, endX); x += 1) {
          total += frame[y * width + x] ?? 0
          count += 1
        }
      }
      output.push(Math.round(total / Math.max(1, count)))
    }
  }
  return output
}

export function fingerprintCaptionRegionFrame(frame: Buffer, width = FALLBACK_WIDTH, height = FALLBACK_HEIGHT): CaptionRegionFingerprint {
  const normalized = resizedGrayscale(frame, width, height, 32, 18)
  const hashPixels = resizedGrayscale(frame, width, height, 16, 16)
  const mean = hashPixels.reduce((total, value) => total + value, 0) / hashPixels.length
  const bits = hashPixels.map((value) => value >= mean ? '1' : '0').join('')
  let perceptualHash = ''
  for (let index = 0; index < bits.length; index += 4) perceptualHash += Number.parseInt(bits.slice(index, index + 4), 2).toString(16)

  let edgeCount = 0
  let comparisons = 0
  let total = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const value = frame[index] ?? 0
      total += value
      if (x + 1 < width) {
        if (Math.abs(value - (frame[index + 1] ?? 0)) >= 32) edgeCount += 1
        comparisons += 1
      }
      if (y + 1 < height) {
        if (Math.abs(value - (frame[index + width] ?? 0)) >= 32) edgeCount += 1
        comparisons += 1
      }
    }
  }
  const fullMean = total / frame.length
  let squaredDifference = 0
  for (const value of frame) squaredDifference += (value - fullMean) ** 2
  const contrast = Math.min(1, Math.sqrt(squaredDifference / frame.length) / 127.5)

  return {
    normalized_pixel_sha256: createHash('sha256').update(Buffer.from(normalized)).digest('hex'),
    perceptual_hash: perceptualHash,
    edge_density: Number((edgeCount / Math.max(1, comparisons)).toFixed(6)),
    contrast: Number(contrast.toFixed(6)),
  }
}

function validatePythonAnalysis(value: unknown, sourceSha256: string): Omit<CaptionRegionAnalysis, 'implementation_file_sha256' | 'analysis_artifact_path' | 'analysis_artifact_sha256'> {
  if (!value || typeof value !== 'object') throw new Error('caption analyzer returned a non-object result')
  const result = value as Record<string, unknown>
  if (result.analysis_version !== 1 || result.analyzer !== 'mindmake-caption-region-v1' || result.method !== 'python_opencv') throw new Error('caption analyzer returned an unsupported result version')
  if (result.source_sha256 !== sourceSha256) throw new Error('caption analyzer result is not bound to the input media hash')
  if (!result.caption_ocr || typeof result.caption_ocr !== 'object') throw new Error('caption analyzer did not report OCR capability')
  const ocr = result.caption_ocr as Record<string, unknown>
  if (!['complete', 'partial', 'failed', 'engine_unavailable'].includes(String(ocr.status))) throw new Error('caption analyzer reported an unsupported OCR status')
  if (!Array.isArray(result.samples) || result.samples.length < 1) throw new Error('caption analyzer did not produce caption-region samples')
  for (const sample of result.samples) {
    if (!sample || typeof sample !== 'object') throw new Error('caption analyzer produced an invalid sample')
    const record = sample as Record<string, unknown>
    if (!SHA256.test(String(record.sample_sha256)) || !SHA256.test(String(record.normalized_pixel_sha256))) throw new Error('caption analyzer sample is missing a valid fingerprint')
    if (!/^[a-f0-9]{64}$/.test(String(record.perceptual_hash))) throw new Error('caption analyzer sample is missing a valid perceptual hash')
  }
  return result as unknown as Omit<CaptionRegionAnalysis, 'implementation_file_sha256' | 'analysis_artifact_path' | 'analysis_artifact_sha256'>
}

async function writeFallbackAnalysis(
  inputPath: string,
  outputPath: string,
  samplesDirectory: string,
  sourceSha256: string,
  durationMs: number,
  implementationSha256: string,
  fallbackReason: string,
  runtime: CaptionAnalysisRuntime,
): Promise<CaptionRegionAnalysis> {
  const intervalMs = captionSampleIntervalMs(durationMs)
  const sampleTimes = captionSampleTimesMs(durationMs)
  const maximumFrames = sampleTimes.length
  const filter = [
    `fps=1/${(intervalMs / 1000).toFixed(3)}:start_time=0`,
    'crop=trunc(iw*0.92/2)*2:trunc(ih*0.46/2)*2:trunc(iw*0.04/2)*2:trunc(ih*0.48/2)*2',
    `scale=${FALLBACK_WIDTH}:${FALLBACK_HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${FALLBACK_WIDTH}:${FALLBACK_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`,
    'format=gray',
  ].join(',')
  const { stdout } = await runtime.runBufferProcess('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-i', resolve(inputPath), '-vf', filter,
    '-an', '-vsync', '0', '-frames:v', String(maximumFrames), '-f', 'rawvideo', 'pipe:1',
  ], { timeoutMs: 600_000 })
  const frameSize = FALLBACK_WIDTH * FALLBACK_HEIGHT
  const frameCount = Math.min(maximumFrames, Math.floor(stdout.length / frameSize))
  if (frameCount !== maximumFrames) throw new Error('FFmpeg caption-region fallback did not cover the canonical sampling plan')

  await mkdir(samplesDirectory, { recursive: true })
  const samples: CaptionRegionAnalysis['samples'] = []
  for (let index = 0; index < frameCount; index += 1) {
    const frame = stdout.subarray(index * frameSize, (index + 1) * frameSize)
    const atMs = sampleTimes[index] as number
    const sampleName = `frame-${String(index + 1).padStart(4, '0')}-${String(atMs).padStart(9, '0')}ms.pgm`
    const samplePath = join(samplesDirectory, sampleName)
    const pgm = Buffer.concat([Buffer.from(`P5\n${FALLBACK_WIDTH} ${FALLBACK_HEIGHT}\n255\n`, 'ascii'), frame])
    await writeFile(samplePath, pgm)
    samples.push({
      at_ms: atMs,
      relative_path: `${basename(samplesDirectory)}/${sampleName}`,
      sample_sha256: createHash('sha256').update(pgm).digest('hex'),
      ...fingerprintCaptionRegionFrame(frame),
      ocr: { status: 'fallback_no_ocr' },
    })
  }
  const ffmpegVersion = await runtime.version('ffmpeg', ['-version'])
  const outputWithoutArtifactHash: Omit<CaptionRegionAnalysis, 'analysis_artifact_sha256'> = {
    analysis_version: 1,
    analyzer: 'mindmake-caption-region-v1',
    method: 'ffmpeg_fallback',
    source_sha256: sourceSha256,
    duration_ms: durationMs,
    sampling: {
      region_normalized: { x: 0.04, y: 0.48, width: 0.92, height: 0.46 },
      interval_ms: intervalMs,
      maximum_samples: MAXIMUM_SAMPLES,
      sample_count: samples.length,
      coverage_start_ms: samples[0]?.at_ms ?? 0,
      coverage_end_ms: samples.at(-1)?.at_ms ?? 0,
    },
    implementation: { python: null, opencv: null, tesseract: null, ffmpeg: ffmpegVersion },
    implementation_file_sha256: implementationSha256,
    analysis_artifact_path: outputPath,
    caption_ocr: {
      status: 'fallback_no_ocr',
      engine: null,
      engine_version: null,
      precision: 'diagnostic_only',
      reason: 'The pinned OpenCV analyzer was unavailable. FFmpeg produced reviewable caption-region samples and fingerprints, but exact SRT sidecars remain authoritative.',
    },
    samples,
    fallback_reason: fallbackReason,
  }
  await writeFile(outputPath, `${JSON.stringify(outputWithoutArtifactHash, null, 2)}\n`, 'utf8')
  return { ...outputWithoutArtifactHash, analysis_artifact_sha256: await hashFile(outputPath) }
}

export async function analyzeCaptionRegions(
  repoRoot: string,
  inputPath: string,
  outputDirectory: string,
  label: string,
  sourceSha256: string,
  durationMs: number,
  runtime: CaptionAnalysisRuntime = defaultRuntime,
): Promise<CaptionRegionAnalysis> {
  if (!SHA256.test(sourceSha256)) throw new Error('caption-region analysis requires the exact input media SHA-256')
  if (await hashFile(inputPath) !== sourceSha256) throw new Error('caption-region analysis input hash does not match the supplied media hash')
  const implementationPath = join(repoRoot, 'scripts', 'analyze-caption-region.py')
  const pythonImplementationSha256 = await hashFile(implementationPath)
  const fallbackImplementationSha256 = await hashFile(fileURLToPath(import.meta.url))
  const stem = `${safeLabel(label)}-${sourceSha256.slice(0, 16)}`
  const outputPath = join(outputDirectory, `${stem}-caption-analysis.json`)
  const samplesDirectory = join(outputDirectory, `${stem}-caption-frames`)
  await mkdir(outputDirectory, { recursive: true })

  try {
    const python = await runtime.resolvePython(repoRoot)
    await runtime.runProcess(python, [
      implementationPath,
      '--input', resolve(inputPath),
      '--output', outputPath,
      '--samples-dir', samplesDirectory,
      '--source-sha256', sourceSha256,
      '--duration-ms', String(Math.max(1, Math.round(durationMs))),
    ], { timeoutMs: 600_000 })
    const value = validatePythonAnalysis(JSON.parse(await readFile(outputPath, 'utf8')), sourceSha256)
    if (await hashFile(inputPath) !== sourceSha256) throw new Error('caption-region analysis input changed during processing')
    return {
      ...value,
      implementation_file_sha256: pythonImplementationSha256,
      analysis_artifact_path: outputPath,
      analysis_artifact_sha256: await hashFile(outputPath),
    }
  } catch (error) {
    if (await hashFile(inputPath) !== sourceSha256) throw new Error('caption-region analysis input changed during processing')
    const analysis = await writeFallbackAnalysis(inputPath, outputPath, samplesDirectory, sourceSha256, Math.max(1, Math.round(durationMs)), fallbackImplementationSha256, fallbackReasonCode(error), runtime)
    if (await hashFile(inputPath) !== sourceSha256) throw new Error('caption-region analysis input changed during processing')
    return analysis
  }
}
