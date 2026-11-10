#!/usr/bin/env node
// Render one style on one take, frame by frame, with the brand skin on.
//
//   node lab/styles/_core/render.mjs --style ladder --shape tall --timeline T.json --audio take.wav --out DIR [--from 0 --to 8 --fps 30]
//
// Each frame is drawn from t alone (the style's draw(env, ctx, t)), captured from Chromium and piped to ffmpeg.
// The style's sound cues are synthesised here (no licensed audio) and mixed under the voice; the voice is set to
// -12.5 LUFS so the whole cut, with its silent close, measures close to -14.
// Writes DIR/<style>-<shape>.mp4, DIR/<style>-<shape>.layout.json (what text landed where, for check.mjs).
import { createRequire } from 'node:module'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { skin as makeSkin } from './brand.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
// Playwright is the container's own (pre-installed); require resolves the global install as well as a local one.
const { chromium } = createRequire(import.meta.url)('playwright')
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const style = arg('style'), shape = arg('shape', 'tall'), out = resolve(arg('out', '.'))
const timeline = JSON.parse(readFileSync(arg('timeline'), 'utf8'))
const audio = resolve(arg('audio'))
const fps = Number(arg('fps', 30))
const series = arg('series', 'follow_the_money')
const W = shape === 'tall' ? 1080 : 1920, H = shape === 'tall' ? 1920 : 1080
mkdirSync(out, { recursive: true })

const skin = makeSkin(series)
const scene = await import(pathToFileURL(join(HERE, '..', style, 'scene.mjs')).href)
const CLOSE_LEN = 6
const closeAt = timeline.beats.at(-1).e + 0.6
const total = Math.max(timeline.duration, closeAt + CLOSE_LEN)
const from = Number(arg('from', 0)), to = Number(arg('to', total))
const name = `${style}-${shape}${arg('from') ? `-${from}-${to}` : ''}`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${skin.fontCss}
html,body{margin:0;background:#000}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"${pathToFileURL(join(HERE, '..', 'node_modules/three/build/three.module.js')).href}","three/addons/":"${pathToFileURL(join(HERE, '..', 'node_modules/three/examples/jsm/')).href}"}}</script>
</head><body><canvas id="c" width="${W}" height="${H}"></canvas>
<script type="module">
import * as house from '${pathToFileURL(join(HERE, 'house.mjs')).href}'
import * as scene from '${pathToFileURL(join(HERE, '..', style, 'scene.mjs')).href}'
window.__setup = async (skin, timeline, shape, closeAt) => {
  const env = house.makeEnv(skin, timeline, shape); env.closeAt = closeAt
  env.markImg = new Image(); env.markImg.src = skin.mark; await env.markImg.decode()
  env.logoImg = new Image(); env.logoImg.src = skin.logo; await env.logoImg.decode()
  env.paperImg = new Image(); env.paperImg.src = skin.paper; await env.paperImg.decode()
  await document.fonts.load("900 64px 'Archivo'"); await document.fonts.load("168px 'Anton'")
  await document.fonts.load("italic 400 64px 'Fraunces'"); await document.fonts.load("600 40px 'IBM Plex Mono'"); await document.fonts.load("500 40px 'IBM Plex Mono'"); await document.fonts.load("700 40px 'IBM Plex Mono'")
  if (scene.setup) await scene.setup(env)
  window.__env = env; return document.fonts.size
}
window.__draw = (t) => {
  const env = window.__env, ctx = document.getElementById('c').getContext('2d')
  env.layout = []
  ctx.save(); scene.draw(env, ctx, t, house); ctx.restore()
  // The close is the approved house card (docs/production/CLOSING.md), filmed by kit and joined after this cut.
  if (t < env.closeAt) house.captions(env, ctx, t)
  house.grain(env, ctx, t)
  return { url: document.getElementById('c').toDataURL(window.__still ? 'image/png' : 'image/jpeg', 0.95), layout: env.layout }
}
</script></body></html>`
const pagePath = join(out, `.${name}.html`)
writeFileSync(pagePath, html)

const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: W, height: H } })
page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1 })
await page.goto(pathToFileURL(pagePath).href)
await page.waitForFunction(() => typeof window.__setup === 'function')
await page.evaluate(([s, tl, sh, ca]) => window.__setup(s, tl, sh, ca), [skin, timeline, shape, closeAt])

// --stills 3,12.9,24: style frames only, as PNGs, before anything is filmed.
const stills = arg('stills')
if (stills) {
  await page.evaluate(() => { window.__still = true })
  for (const s of stills.split(',').map(Number)) {
    const r = await page.evaluate((tt) => window.__draw(tt), s)
    writeFileSync(join(out, `${style}-${shape}-${s.toFixed(1)}.png`), Buffer.from(r.url.split(',')[1], 'base64'))
  }
  await browser.close(); console.log(`wrote ${stills.split(',').length} stills to ${out}`); process.exit(0)
}

const video = join(out, `${name}.video.mp4`)
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', video], { stdio: ['pipe', 'inherit', 'inherit'] })
const layout = []
const n0 = Math.round(from * fps), n1 = Math.round(to * fps)
for (let f = n0; f < n1; f++) {
  const t = f / fps
  const r = await page.evaluate((tt) => window.__draw(tt), t)
  if (f % 5 === 0) layout.push({ t: +t.toFixed(3), items: r.layout })
  const buf = Buffer.from(r.url.split(',')[1], 'base64')
  if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res))
  if (f % 150 === 0) console.log(`${name}: ${(t).toFixed(1)}s / ${to.toFixed(1)}s`)
}
ff.stdin.end()
await new Promise((res) => ff.on('close', res))
await browser.close()
writeFileSync(join(out, `${name}.layout.json`), JSON.stringify({ style, shape, W, H, closeAt, total, layout }))

// Sound: the style's cues, synthesised, mixed under the voice.
const SR = 48000, len = Math.ceil((to - from) * SR), mix = new Float32Array(len)
const rnd = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1 })()
const SOUNDS = {
  tick: (i) => Math.sin(2 * Math.PI * 2400 * i / SR) * Math.exp(-i / (SR * 0.012)) * 0.35,
  count: (i) => Math.sin(2 * Math.PI * 1500 * i / SR) * Math.exp(-i / (SR * 0.02)) * 0.25,
  whoosh: (i) => rnd() * Math.sin(Math.PI * Math.min(1, i / (SR * 0.45))) * 0.12,
  thump: (i) => Math.sin(2 * Math.PI * (70 - 30 * i / SR) * i / SR) * Math.exp(-i / (SR * 0.18)) * 0.8,
  chime: (i) => (Math.sin(2 * Math.PI * 880 * i / SR) + 0.5 * Math.sin(2 * Math.PI * 1320 * i / SR)) * Math.exp(-i / (SR * 0.5)) * 0.18,
  key: (i) => rnd() * Math.exp(-i / (SR * 0.006)) * 0.3,
}
const DUR = { tick: 0.08, count: 0.1, whoosh: 0.45, thump: 0.8, chime: 1.6, key: 0.04 }
const cues = (scene.cues?.({ timeline, closeAt, shape }) ?? []).concat([{ t: closeAt, kind: 'thump' }])
for (const c of cues) {
  const s0 = Math.round((c.t - from) * SR)
  for (let i = 0; i < DUR[c.kind] * SR; i++) if (s0 + i >= 0 && s0 + i < len) mix[s0 + i] += SOUNDS[c.kind](i) * (c.gain ?? 1)
}
const fx = join(out, `${name}.fx.wav`)
const wav = Buffer.alloc(44 + len * 2)
wav.write('RIFF', 0); wav.writeUInt32LE(36 + len * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
wav.write('data', 36); wav.writeUInt32LE(len * 2, 40)
for (let i = 0; i < len; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i])) * 32767), 44 + i * 2)
writeFileSync(fx, wav)

const final = join(out, `${name}.mp4`)
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-ss', String(from), '-t', String(to - from), '-i', audio, '-i', fx,
  '-filter_complex', `[1:a]loudnorm=I=-12.5:TP=-1.5:LRA=11,aresample=48000,apad,atrim=0:${to - from}[v];[2:a]volume=0.5[f];[v][f]amix=inputs=2:duration=first:normalize=0[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', final], { stdio: 'inherit' })
if (r.status !== 0) throw new Error('mux failed')
console.log(`wrote ${final}`)

// The close: the approved house card (docs/production/CLOSING.md), filmed by scripts/quick-edit/kit.py, joined with a
// hard cut at his last word. --close DIR holds endcard-9x16.mp4 and endcard-16x9.mp4.
const closeDir = arg('close')
if (closeDir && !arg('from')) {
  const card = join(resolve(closeDir), `endcard-${shape === 'tall' ? '9x16' : '16x9'}.mp4`)
  const withClose = join(out, `${style}-${shape}.final.mp4`)
  const j = spawnSync('ffmpeg', ['-v', 'error', '-y', '-t', String(closeAt), '-i', final, '-i', card,
    '-filter_complex', `[1:v]fps=${fps},format=yuv420p,setsar=1[cv];anullsrc=r=48000:cl=stereo,atrim=0:6[ca];[0:v][0:a][cv][ca]concat=n=2:v=1:a=1[v][a]`,
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', withClose], { stdio: 'inherit' })
  if (j.status !== 0) throw new Error('joining the close failed')
  console.log(`wrote ${withClose}`)
}
