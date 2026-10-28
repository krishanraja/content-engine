#!/usr/bin/env node
/** Render compiled EngineRenderProps through the registered FormatMaster. */
import { readFile, mkdtemp, copyFile, mkdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { bundle } from '@remotion/bundler'
import { selectComposition, renderMedia } from '@remotion/renderer'
import { tsImport } from 'tsx/esm/api'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const run = promisify(execFile)
const sampleRate = 48000
const maxLag = sampleRate / 5

async function decodeAudio(src, trimSeconds = 0) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', src, '-map', '0:a:0',
    '-af', `atrim=start=${trimSeconds},asetpts=PTS-STARTPTS`, '-t', '10',
    '-ar', String(sampleRate), '-ac', '1', '-f', 'f32le', 'pipe:1'],
  { encoding: 'buffer', maxBuffer: sampleRate * 10 * 4 + 1024 * 1024, timeout: 120000, windowsHide: true })
  const samples = new Float32Array(stdout.length / 4)
  for (let i = 0; i < samples.length; i++) samples[i] = stdout.readFloatLE(i * 4)
  return samples
}

async function correctAudio(raw, output, stem, trimSeconds, temporary, lagSamples) {
  const [rendered, reference] = await Promise.all([decodeAudio(raw), decodeAudio(stem, trimSeconds)])
  const lag = lagSamples(rendered, reference, maxLag)
  console.log(`ve audio: lag ${lag} samples (${(lag / sampleRate * 1000).toFixed(3)} ms)`)
  let corrected = raw
  if (Math.abs(lag) > 48) {
    corrected = path.join(temporary, 'corrected.mp4')
    // A negative lag needs silence prepended; atrim cannot accept negative samples.
    const filter = lag > 0 ? `atrim=start_sample=${lag},asetpts=PTS-STARTPTS`
      : `adelay=${-lag}S:all=1,asetpts=PTS-STARTPTS`
    await run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-map', '0:v:0', '-map', '0:a:0',
      '-c:v', 'copy', '-af', filter, '-c:a', 'aac', '-b:a', '320k', corrected],
    { timeout: 120000, windowsHide: true })
  }
  const residual = lagSamples(await decodeAudio(corrected), reference, maxLag)
  console.log(`ve audio: residual ${residual} samples (${(residual / sampleRate * 1000).toFixed(3)} ms)`)
  if (Math.abs(residual) > 48) throw new Error(`audio correction residual exceeds 1 ms: ${residual} samples`)
  // Only hand over a render after its final encoded audio passes the measurement.
  await copyFile(corrected, output)
}

async function main() {
  const [propsPath, output, ...flags] = process.argv.slice(2)
  if (!propsPath || !output || (flags.length && (flags.length !== 2 || flags[0] !== '--scale'))) {
    throw new Error('usage: ve-render.mjs <props.json> <out.mp4> [--scale <positive number>]')
  }
  const scale = flags.length ? Number(flags[1]) : 1
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('scale must be finite and positive')
  const { EngineRenderPropsSchema } = await tsImport('../src/engine/props.ts', import.meta.url)
  const { toAsciiProps, lagSamples } = await tsImport('../src/engine/transport.ts', import.meta.url)
  const inputProps = EngineRenderPropsSchema.parse(JSON.parse(await readFile(propsPath, 'utf8')))
  const stemSrc = /^https?:\/\//.test(inputProps.audio.stem.src) ? inputProps.audio.stem.src
    : path.resolve(path.dirname(path.resolve(propsPath)), inputProps.audio.stem.src)
  const id = inputProps.aspect === '9:16' ? 'VeFormatMasterTall' : 'VeFormatMasterWide'
  const temporary = await mkdtemp(path.join(tmpdir(), 've-render-'))
  try {
    // Serve only explicitly referenced media, never the working directory.
    const publicDir = path.join(temporary, 'public')
    await mkdir(publicDir)
    const staged = new Map()
    async function stage(src) {
      if (/^https?:\/\//.test(src)) return src
      const local = path.resolve(path.dirname(path.resolve(propsPath)), src)
      if (!staged.has(local)) {
        const name = `asset-${staged.size}${path.extname(local)}`
        await copyFile(local, path.join(publicDir, name))
        staged.set(local, `/public/${name}`)
      }
      return staged.get(local)
    }
    for (const image of Object.values(inputProps.brand)) image.src = await stage(image.src)
    inputProps.audio.stem.src = await stage(inputProps.audio.stem.src)
    for (const sfx of inputProps.audio.sfx) sfx.src = await stage(sfx.src)
    for (const segment of inputProps.segments) segment.src = await stage(segment.src)
    for (const object of inputProps.objects) {
      if (typeof object.params?.src === 'string') object.params.src = await stage(object.params.src)
      for (const row of Array.isArray(object.params?.rows) ? object.params.rows : []) {
        if (typeof row?.logoSrc === 'string') row.logoSrc = await stage(row.logoSrc)
      }
    }
    const serveUrl = await bundle({ entryPoint: path.join(root, 'apps/renderer/src/index.ts'),
      publicDir, outDir: path.join(temporary, 'bundle') })
    const transportProps = toAsciiProps(inputProps)
    const composition = await selectComposition({ serveUrl, id, inputProps: transportProps })
    const tall = inputProps.aspect === '9:16'
    if (composition.fps !== 30 || composition.width !== (tall ? 1080 : 1920) || composition.height !== (tall ? 1920 : 1080)) {
      throw new Error(`${id} must use the 30 fps house canvas`)
    }
    await mkdir(path.dirname(path.resolve(output)), { recursive: true })
    const raw = path.join(temporary, 'raw.mp4')
    await renderMedia({ serveUrl, composition: { ...composition, durationInFrames: inputProps.durationFrames },
      inputProps: transportProps, outputLocation: raw, codec: 'h264', crf: 18, scale, sampleRate })
    await correctAudio(raw, path.resolve(output), stemSrc, inputProps.audio.stem.trimBeforeFrames / inputProps.fps,
      temporary, lagSamples)
    if ((await stat(output)).size === 0) throw new Error('render produced an empty MP4')
    console.log(`ve render: ${path.resolve(output)}`)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(`ve render: ${error.message}`); process.exitCode = 1 })
