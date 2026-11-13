#!/usr/bin/env node
/** Render compiled EngineRenderProps through the registered FormatMaster (the wide cut through VeCut, behind its
 *  sting when the props carry one). */
import { createHash } from 'node:crypto'
import { readFile, readdir, mkdtemp, copyFile, mkdir, rm, stat, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { bundle } from '@remotion/bundler'
import { selectComposition, renderMedia, renderStill } from '@remotion/renderer'
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

/** The render's own clock: the cut's durationFrames plus the sting's frames (props.sting.frames, none without a
 *  sting), which play at the cut's frame `at` (props.sting.atFrame: straight after the hook; 0 is the retired sting in
 *  front of the cut). Every frame in the props, and every --stills frame asked for, is on the cut's own clock: `toRender`
 *  puts it on the render's, so a beat's keyFrame names the same picture with or without a sting. `lead` is the frames in
 *  front of the cut's own frame 0 (the sting's only when it plays at 0). */
export function renderClock(inputProps) {
  const frames = inputProps.sting?.frames ?? 0
  const at = inputProps.sting?.atFrame ?? 0
  return { lead: at ? 0 : frames, at, frames: frames + inputProps.durationFrames,
    toRender: (frame) => (frames && frame >= at ? frame + frames : frame) }
}

/** The lag between the encoded audio and the stem, measured from `leadSeconds` into both (the cut's first frame, so
 *  the probe hears his voice, not only the bed under the sting). The stem plays from the render's frame 0, so render
 *  time t is stem time trimSeconds + t; a constant lag is the same from any start. */
async function correctAudio(raw, output, stem, trimSeconds, temporary, lagSamples, leadSeconds = 0) {
  const [rendered, reference] = await Promise.all([decodeAudio(raw, leadSeconds), decodeAudio(stem, trimSeconds + leadSeconds)])
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
  const residual = lagSamples(await decodeAudio(corrected, leadSeconds), reference, maxLag)
  console.log(`ve audio: residual ${residual} samples (${(residual / sampleRate * 1000).toFixed(3)} ms)`)
  if (Math.abs(residual) > 48) throw new Error(`audio correction residual exceeds 1 ms: ${residual} samples`)
  // Only hand over a render after its final encoded audio passes the measurement.
  await copyFile(corrected, output)
}

/** The browser Remotion drives: REMOTION_BROWSER when set, else a Chromium headless shell already installed under
 *  /opt/pw-browsers (cloud sessions and CI), else null so Remotion uses or fetches its own. Never downloads here. */
export async function browserExecutable(env = process.env, root = '/opt/pw-browsers') {
  if (env.REMOTION_BROWSER) return env.REMOTION_BROWSER
  let names
  try { names = await readdir(root) } catch { return null }
  for (const name of names.filter(n => n.startsWith('chromium_headless_shell-')).sort().reverse()) {
    const candidate = path.join(root, name, 'chrome-headless-shell-linux64', 'chrome-headless-shell')
    try { if ((await stat(candidate)).isFile()) return candidate } catch { /* next */ }
  }
  return null
}

/** Stage only declared media and the format's plate manifest; safe to test without Chromium. */
export async function stageRenderAssets(inputProps, propsPath, publicDir, repositoryRoot = root) {
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
  if ((inputProps.sting && !inputProps.sting.atFrame) || inputProps.opening) {
    // Nothing goes before the hook on any cut, ever (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever. Remove
    // the sting exception for good."): props carrying a sting or an episode card in front are refused before anything
    // is staged or rendered.
    throw new Error('nothing goes before the hook (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever. Remove the sting exception for good."): these props carry '
      + (inputProps.sting ? 'a sting' : 'an episode card') + ' in front of the cut; run ve compile again')
  }
  if (inputProps.sting) {
    // A sting after the hook is the clip named byte for byte (config/intro-sting.json): bytes that are not the props'
    // are refused before anything renders.
    if (/^https?:\/\//.test(inputProps.sting.src)) throw new Error('the sting must be a local clip, so its sha256 can be checked')
    const local = path.resolve(path.dirname(path.resolve(propsPath)), inputProps.sting.src)
    const sha256 = createHash('sha256').update(await readFile(local)).digest('hex')
    if (sha256 !== inputProps.sting.sha256) {
      throw new Error(`the ${inputProps.sting.series} sting at ${local} is not the clip its props name (sha256 ${sha256}, not ${inputProps.sting.sha256})`)
    }
    inputProps.sting.src = await stage(inputProps.sting.src)
  }
  async function stageParams(value) {
    if (Array.isArray(value)) { for (const item of value) await stageParams(item); return }
    if (!value || typeof value !== 'object') return
    for (const [key, item] of Object.entries(value)) {
      if ((key === 'src' || key === 'logoSrc') && typeof item === 'string') value[key] = await stage(item)
      else await stageParams(item)
    }
  }
  for (const object of inputProps.objects) await stageParams(object.params)
  const logoIds = new Set()
  for (const object of inputProps.objects) {
    if (!['logo_card', 'logo_orbit'].includes(object.device)) continue
    for (const logo of object.params.logos ?? []) logoIds.add(logo.id)
  }
  const centres = inputProps.objects.filter(object => object.device === 'logo_orbit')
    .map(object => object.params.centre).filter(Boolean)
  if (logoIds.size || centres.length) {
    const { marks } = JSON.parse(await readFile(path.join(repositoryRoot, 'config/logo-registry.json'), 'utf8'))
    const findMark = id => marks.find(mark => `${mark.company}:${mark.variant}` === id ||
      (mark.company === id && mark.variant === 'full_colour'))
    for (const id of centres) if (findMark(id)) logoIds.add(id)
    const logoRoot = path.resolve(repositoryRoot, 'assets/logos')
    const copied = new Set()
    for (const id of logoIds) {
      const mark = findMark(id)
      if (!mark?.file) throw new Error(`Unregistered logo asset: ${id}`)
      const local = path.resolve(repositoryRoot, mark.file)
      if (!mark.file.startsWith('assets/logos/') || mark.file.includes('\\') ||
          !local.startsWith(logoRoot + path.sep)) throw new Error(`logo escapes assets/logos: ${mark.file}`)
      const canonicalRoot = await realpath(logoRoot)
      if (!(await realpath(local)).startsWith(canonicalRoot + path.sep))
        throw new Error(`logo escapes assets/logos: ${mark.file}`)
      if (copied.has(local)) continue
      const target = path.join(publicDir, path.relative(repositoryRoot, local))
      await mkdir(path.dirname(target), { recursive: true })
      await copyFile(local, target)
      copied.add(local)
    }
  }
  if (inputProps.objects.some(object => object.device === 'hand_phone_stage')) {
    // The device uses staticFile('plates/<format>/<name>'); keep that tree.
    const plateDir = path.join(repositoryRoot, 'assets', 'plates', inputProps.format)
    const manifest = JSON.parse(await readFile(path.join(plateDir, 'plates.json'), 'utf8'))
    const targetDir = path.join(publicDir, 'plates', inputProps.format)
    await mkdir(targetDir, { recursive: true })
    for (const name of ['plates.json', ...Object.keys(manifest.files)]) {
      const local = path.resolve(plateDir, name)
      if (!local.startsWith(plateDir + path.sep)) throw new Error(`plate escapes format directory: ${name}`)
      const target = path.resolve(targetDir, name)
      await mkdir(path.dirname(target), { recursive: true })
      // copyFile throws before bundling or Chromium if any declared plate is missing.
      await copyFile(local, target)
    }
  }
  if (inputProps.objects.some(object => object.device === 'ladder_stage')) {
    // The Ladder's house paper is one plate, staticFile('plates/two-passports/paper.jpg'), whatever the cut's format.
    const targetDir = path.join(publicDir, 'plates', 'two-passports')
    await mkdir(targetDir, { recursive: true })
    await copyFile(path.join(repositoryRoot, 'assets', 'plates', 'two-passports', 'paper.jpg'), path.join(targetDir, 'paper.jpg'))
  }
}

async function main() {
  const [propsPath, output, ...flags] = process.argv.slice(2)
  // --stills <f1,f2,...>: write one PNG per frame into <out> (a directory) and no MP4,
  // so a design is judged in minutes before a full render (Gate 2 stills). The frames are on the cut's own clock
  // (renderClock): a still after the sting is that frame of his cut, never the sting's.
  const stills = flags[0] === '--stills' && flags.length === 2
    ? flags[1].split(',').map(Number) : undefined
  if (!propsPath || !output || (flags.length && (flags.length !== 2 || !['--scale', '--stills'].includes(flags[0]))) ||
      (stills && !stills.every(f => Number.isInteger(f) && f >= 0))) {
    throw new Error('usage: ve-render.mjs <props.json> <out.mp4> [--scale <positive number>] | <out-dir> --stills <frame,...>')
  }
  const scale = flags[0] === '--scale' ? Number(flags[1]) : 1
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
    await stageRenderAssets(inputProps, propsPath, publicDir)
    const serveUrl = await bundle({ entryPoint: path.join(root, 'apps/renderer/src/index.ts'),
      publicDir, outDir: path.join(temporary, 'bundle') })
    const transportProps = toAsciiProps(inputProps)
    const browser = await browserExecutable()
    const composition = await selectComposition({ serveUrl, id, inputProps: transportProps, browserExecutable: browser, chromiumOptions: { gl: 'swangle' } })
    const tall = inputProps.aspect === '9:16'
    if (composition.fps !== 30 || composition.width !== (tall ? 1080 : 1920) || composition.height !== (tall ? 1920 : 1080)) {
      throw new Error(`${id} must use the 30 fps house canvas`)
    }
    const clock = renderClock(inputProps)
    if (composition.durationInFrames !== clock.frames) {
      throw new Error(`${id} is ${composition.durationInFrames} frames; the sting and the cut are ${clock.frames}`)
    }
    if (stills) {
      await mkdir(path.resolve(output), { recursive: true })
      for (const frame of stills) {
        if (frame >= inputProps.durationFrames) throw new Error(`still frame ${frame} is past the cut`)
        const file = path.resolve(output, `still-${String(frame).padStart(5, '0')}.png`)
        await renderStill({ serveUrl, composition: { ...composition, durationInFrames: clock.frames },
          inputProps: transportProps, output: file, frame: clock.toRender(frame), browserExecutable: browser, chromiumOptions: { gl: 'swangle' } })
        console.log(`ve still: ${file}`)
      }
      return
    }
    await mkdir(path.dirname(path.resolve(output)), { recursive: true })
    const raw = path.join(temporary, 'raw.mp4')
    await renderMedia({ serveUrl, composition: { ...composition, durationInFrames: clock.frames },
      inputProps: transportProps, outputLocation: raw, codec: 'h264', crf: 18, scale, sampleRate, browserExecutable: browser, chromiumOptions: { gl: 'swangle' } })
    await correctAudio(raw, path.resolve(output), stemSrc, inputProps.audio.stem.trimBeforeFrames / inputProps.fps,
      temporary, lagSamples, clock.lead / inputProps.fps)
    if ((await stat(output)).size === 0) throw new Error('render produced an empty MP4')
    console.log(`ve render: ${path.resolve(output)}`)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`ve render: ${error.message}`); process.exitCode = 1 })
}
