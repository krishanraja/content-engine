import { mkdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { hashFile } from './hash.js'
import { jobPath } from './paths.js'
import { commandVersion, run, runBuffer } from './process.js'
import { resolvePythonCommand } from './python-runtime.js'

export interface MediaProbe {
  path: string
  duration_seconds: number
  width: number
  height: number
  average_fps: number
  audio_hz: number | null
  video_codec: string
  audio_codec: string | null
  file_hash: string
}

export interface LoudnessProbe {
  integrated_lufs: number | null
  true_peak_dbtp: number | null
}

function ratio(value: string | undefined): number {
  if (!value) return 0
  const [left, right] = value.split('/').map(Number)
  if (!left || !right) return Number(value) || 0
  return left / right
}

export async function probeMedia(path: string): Promise<MediaProbe> {
  const absolute = resolve(path)
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=index,codec_type,codec_name,width,height,avg_frame_rate,sample_rate', '-of', 'json', absolute])
  const data = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<Record<string, string | number>> }
  const video = data.streams?.find((stream) => stream.codec_type === 'video')
  const audio = data.streams?.find((stream) => stream.codec_type === 'audio')
  if (!video) throw new Error('input has no video stream')
  return {
    path: absolute,
    duration_seconds: Number(data.format?.duration || 0),
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    average_fps: ratio(String(video.avg_frame_rate || '0')),
    audio_hz: audio?.sample_rate ? Number(audio.sample_rate) : null,
    video_codec: String(video.codec_name || 'unknown'),
    audio_codec: audio ? String(audio.codec_name || 'unknown') : null,
    file_hash: await hashFile(absolute),
  }
}

export async function analyzeLoudness(path: string): Promise<LoudnessProbe> {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', resolve(path), '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], { timeoutMs: 600_000 })
  const integrated = [...stderr.matchAll(/I:\s*(-?\d+(?:\.\d+)?)\s+LUFS/g)].at(-1)?.[1]
  const peak = [...stderr.matchAll(/Peak:\s*(-?\d+(?:\.\d+)?)\s+dBFS/g)].at(-1)?.[1]
  return {
    integrated_lufs: integrated === undefined ? null : Number(integrated),
    true_peak_dbtp: peak === undefined ? null : Number(peak),
  }
}

export async function framePerceptualHashes(path: string): Promise<string[]> {
  const size = 16
  const { stdout } = await runBuffer('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-i', resolve(path),
    '-vf', `fps=1/5,scale=${size}:${size}:flags=area,format=gray`,
    '-an', '-vsync', '0', '-f', 'rawvideo', 'pipe:1',
  ], { timeoutMs: 600_000 })
  const frameSize = size * size
  const hashes: string[] = []
  for (let offset = 0; offset + frameSize <= stdout.length; offset += frameSize) {
    const frame = stdout.subarray(offset, offset + frameSize)
    const mean = frame.reduce((total, value) => total + value, 0) / frame.length
    let bits = ''
    for (const value of frame) bits += value >= mean ? '1' : '0'
    hashes.push(bits.match(/.{1,4}/g)?.map((nibble) => Number.parseInt(nibble, 2).toString(16)).join('') || '')
  }
  return hashes
}

export async function detectSceneCuts(path: string, threshold = 0.35): Promise<number[]> {
  const { stderr } = await run('ffmpeg', [
    '-hide_banner', '-i', resolve(path),
    '-vf', `select=gt(scene\\,${threshold}),showinfo`, '-an', '-f', 'null', '-',
  ], { timeoutMs: 600_000 })
  return [...stderr.matchAll(/pts_time:(\d+(?:\.\d+)?)/g)].map((match) => Math.round(Number(match[1]) * 1000))
}

export async function normalizeMedia(jobId: string, inputPath: string): Promise<{ outputPath: string; sourcePath: string; probe: MediaProbe; sourceProbe: MediaProbe; ffmpegVersion: string }> {
  const outputDir = join(jobPath(jobId), 'media')
  const outputPath = join(outputDir, 'normalized.mp4')
  const sourcePath = join(outputDir, 'normalized-source.mp4')
  await mkdir(outputDir, { recursive: true })
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', resolve(inputPath),
    '-map_metadata', '-1', '-vf', 'fps=30', '-r', '30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', sourcePath,
  ], { timeoutMs: 3_600_000 })
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath,
    '-map_metadata', '-1', '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30', '-r', '30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', outputPath,
  ], { timeoutMs: 3_600_000 })
  return { outputPath, sourcePath, probe: await probeMedia(outputPath), sourceProbe: await probeMedia(sourcePath), ffmpegVersion: await commandVersion('ffmpeg', ['-version']) }
}

export async function extractClip(inputPath: string, outputPath: string, startMs: number, endMs: number): Promise<string> {
  if (endMs <= startMs) throw new Error('clip end must be after start')
  await mkdir(dirname(outputPath), { recursive: true })
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-ss', (startMs / 1000).toFixed(3), '-to', (endMs / 1000).toFixed(3), '-i', inputPath,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', outputPath,
  ], { timeoutMs: 1_800_000 })
  return outputPath
}

export async function transcribeMedia(repoRoot: string, inputPath: string, outputPath: string, model = 'base.en', vocabulary: string[] = []): Promise<unknown> {
  await mkdir(dirname(outputPath), { recursive: true })
  const python = await resolvePythonCommand(repoRoot)
  await run(python, [join(repoRoot, 'scripts', 'transcribe.py'), '--input', inputPath, '--output', outputPath, '--model', model, '--vocabulary', vocabulary.join(', ')], { timeoutMs: 3_600_000 })
  return JSON.parse(await readFile(outputPath, 'utf8'))
}

export async function benchmarkTranscription(repoRoot: string, fixtures: string[], models: string[], maximumWer: number, maximumRealtimeFactor: number): Promise<unknown> {
  const python = await resolvePythonCommand(repoRoot)
  const args = [
    join(repoRoot, 'scripts', 'benchmark-transcription.py'),
    ...fixtures.flatMap((fixture) => ['--fixture', fixture]),
    '--models', models.join(','),
    '--maximum-wer', String(maximumWer),
    '--maximum-realtime-factor', String(maximumRealtimeFactor),
  ]
  const { stdout } = await run(python, args, { timeoutMs: 7_200_000 })
  return JSON.parse(stdout)
}

export async function createContactSheet(inputPaths: string[], outputPath: string): Promise<string> {
  if (inputPaths.length < 2 || inputPaths.length > 5) throw new Error('contact sheets require two to five preview videos')
  await mkdir(dirname(outputPath), { recursive: true })
  const columns = Math.min(3, inputPaths.length)
  const filters = inputPaths.map((_, index) => `[${index}:v]select=eq(n\\,0),scale=270:480,setsar=1[v${index}]`)
  const layout = inputPaths.map((_, index) => `${index % columns * 270}_${Math.floor(index / columns) * 480}`).join('|')
  const stack = `${inputPaths.map((_, index) => `[v${index}]`).join('')}xstack=inputs=${inputPaths.length}:layout=${layout}:fill=black[out]`
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    ...inputPaths.flatMap((path) => ['-ss', '0.500', '-i', resolve(path)]),
    '-filter_complex', [...filters, stack].join(';'), '-map', '[out]', '-frames:v', '1', outputPath,
  ], { timeoutMs: 300_000 })
  return outputPath
}

export async function trackFaceCrops(repoRoot: string, inputPath: string): Promise<Array<{ at_ms: number; x: number; y: number; width: number; height: number; confidence: number }>> {
  const python = await resolvePythonCommand(repoRoot)
  const { stdout } = await run(python, [join(repoRoot, 'scripts', 'track-face.py'), '--input', inputPath], { timeoutMs: 1_800_000 })
  const parsed = JSON.parse(stdout) as Array<{ at_ms: number; x: number; y: number; width: number; height: number; confidence: number }>
  return parsed.filter((frame) => frame.confidence >= 0.55).sort((left, right) => left.at_ms - right.at_ms)
}

export function mediaBasename(path: string): string {
  return basename(path)
}
