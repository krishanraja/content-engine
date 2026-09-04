import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import {
  analyzeCaptionRegions,
  captionSampleIntervalMs,
  captionSampleTimesMs,
  fingerprintCaptionRegionFrame,
  hashFile,
} from '@mindmake/core'

const execFileAsync = promisify(execFile)

describe('external-final caption-region analysis', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
  })

  it('uses a deterministic interval that caps long recordings without undersampling shorts', () => {
    expect(captionSampleIntervalMs(30_000)).toBe(750)
    expect(captionSampleIntervalMs(3_600_000)).toBe(22_650)
    expect(Math.ceil(3_600_000 / captionSampleIntervalMs(3_600_000))).toBeLessThanOrEqual(160)
    expect(captionSampleTimesMs(1_500)).toEqual([0, 750])
    expect(captionSampleTimesMs(30_000)).toHaveLength(40)
    expect(captionSampleTimesMs(3_600_000)).toHaveLength(159)
  })

  it('creates stable functional fingerprints from grayscale caption-region pixels', () => {
    const width = 32
    const height = 18
    const frame = Buffer.alloc(width * height)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) frame[y * width + x] = x < width / 2 ? 20 : 235
    }
    const first = fingerprintCaptionRegionFrame(frame, width, height)
    const second = fingerprintCaptionRegionFrame(Buffer.from(frame), width, height)
    const blank = fingerprintCaptionRegionFrame(Buffer.alloc(width * height, 20), width, height)
    expect(second).toEqual(first)
    expect(first.normalized_pixel_sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(first.perceptual_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(first.edge_density).toBeGreaterThan(0)
    expect(blank.normalized_pixel_sha256).not.toBe(first.normalized_pixel_sha256)
  })

  it('falls back to reviewable FFmpeg frame samples and an explicit no-OCR state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mindmake-caption-analysis-'))
    temporaryDirectories.push(root)
    const outputDirectory = join(root, 'analysis')
    const inputPath = join(root, 'external-final.mp4')
    await writeFile(inputPath, 'stable synthetic media fixture', 'utf8')
    const sourceSha256 = await hashFile(inputPath)
    const width = 480
    const height = 270
    const first = Buffer.alloc(width * height, 30)
    const second = Buffer.alloc(width * height, 220)
    const analysis = await analyzeCaptionRegions(
      process.cwd(),
      inputPath,
      outputDirectory,
      'accepted-final',
      sourceSha256,
      1_500,
      {
        resolvePython: async () => 'missing-python',
        runProcess: async () => { throw new Error('pinned OpenCV runtime is unavailable') },
        runBufferProcess: async () => ({ stdout: Buffer.concat([first, second]), stderr: '' }),
        version: async () => 'ffmpeg test-version',
      },
    )
    expect(analysis.method).toBe('ffmpeg_fallback')
    expect(analysis.caption_ocr).toMatchObject({ status: 'fallback_no_ocr', engine: null, precision: 'diagnostic_only' })
    expect(analysis.fallback_reason).toBe('python_runtime_unavailable')
    expect(analysis.samples).toHaveLength(2)
    expect(analysis.samples[0]?.sample_sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(analysis.samples[0]?.normalized_pixel_sha256).not.toBe(analysis.samples[1]?.normalized_pixel_sha256)
    expect(await readFile(join(outputDirectory, analysis.samples[0]!.relative_path))).toHaveLength(width * height + 15)
    expect(analysis.analysis_artifact_sha256).toMatch(/^[a-f0-9]{64}$/)
    const persisted = JSON.parse(await readFile(analysis.analysis_artifact_path, 'utf8')) as { caption_ocr: { status: string } }
    expect(persisted.caption_ocr.status).toBe('fallback_no_ocr')
  })

  it('rejects a forged hash and a media file that changes during analysis', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mindmake-caption-integrity-'))
    temporaryDirectories.push(root)
    const inputPath = join(root, 'external-final.mp4')
    await writeFile(inputPath, 'original bytes', 'utf8')
    await expect(analyzeCaptionRegions(process.cwd(), inputPath, join(root, 'forged'), 'final', 'f'.repeat(64), 1_000))
      .rejects.toThrow('does not match')

    const originalHash = await hashFile(inputPath)
    await expect(analyzeCaptionRegions(
      process.cwd(),
      inputPath,
      join(root, 'mutated'),
      'final',
      originalHash,
      1_000,
      {
        resolvePython: async () => 'python',
        runProcess: async () => {
          await writeFile(inputPath, 'changed bytes', 'utf8')
          throw new Error('analyzer stopped')
        },
        runBufferProcess: async () => { throw new Error('fallback must not analyze changed bytes') },
        version: async () => 'ffmpeg test-version',
      },
    )).rejects.toThrow('changed during processing')
  })

  it('executes the real media path and covers the canonical sampling plan', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mindmake-caption-real-media-'))
    temporaryDirectories.push(root)
    const inputPath = join(root, 'captioned.mp4')
    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=0x202020:s=360x640:r=30:d=1.5',
      '-vf', 'drawbox=x=60:y=430:w=240:h=80:color=black@0.8:t=fill,drawbox=x=90:y=455:w=70:h=12:color=white:t=fill,drawbox=x=175:y=455:w=95:h=12:color=white:t=fill',
      '-c:v', 'mpeg4', '-q:v', '3', '-pix_fmt', 'yuv420p', inputPath,
    ], { windowsHide: true, timeout: 60_000 })
    const sourceSha256 = await hashFile(inputPath)
    const analysis = await analyzeCaptionRegions(process.cwd(), inputPath, join(root, 'analysis'), 'accepted-final', sourceSha256, 1_500)
    expect(analysis.source_sha256).toBe(sourceSha256)
    expect(analysis.sampling).toMatchObject({ interval_ms: 750, sample_count: 2, coverage_start_ms: 0, coverage_end_ms: 750 })
    expect(analysis.caption_ocr.status).not.toBe('not_run')
    expect(analysis.samples).toHaveLength(2)
    for (const sample of analysis.samples) {
      expect(sample.sample_sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(await readFile(join(root, 'analysis', sample.relative_path))).not.toHaveLength(0)
    }
  }, 120_000)
})
