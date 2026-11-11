#!/usr/bin/env node
// The moves gallery: every 2D lab move playing on a short loop, in one grid, on the house skin.
//   NODE_PATH=$(npm root -g) node lab/moves/gallery.mjs OUT.mp4
// 3D moves are shown in the cuts of the style they came from (move.json "from").
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { skin as makeSkin } from '../styles/_core/brand.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { chromium } = createRequire(import.meta.url)('playwright')
const out = process.argv[2]
const skin = makeSkin()
const LOOP = 5, FPS = 30, COLS = 4, CELL = 480, ROWS = 3
const u = (id) => pathToFileURL(join(HERE, id, 'move.mjs')).href
// Each move with its box and a loop's worth of times (seconds into the loop).
const SHOW = [
  ['counter-scene', 1280, 940, `{ openEnd: 9, talkStart: 99, cash: 0.2, ended: 1.2, bank: 1.6, teller: 2.0, hands: 3.0, you: 3.3, disappear: 99, backStart: 99, didnt: 99, stopped: 99, spent: 99, talking: 99 }`],
  ['count-in-card', 600, 420, `{ yearSwitch: 2.4, countStart: 0.3, countLand: 1.6, drop: 2.6 }`, `label: 'PER BRANCH', years: ['1988', '2004'], from: 20, to: 13`],
  ['cost-shrink', 600, 420, `{ start: 0.8 }`, `label: 'COST TO RUN'`],
  ['percent-block', 600, 420, `{ start: 0.6 }`, `value: 43`],
  ['bars-grow', 600, 420, `{ first: 0.3, more: 1.8 }`, `first: 7, more: 3`],
  ['rows-equal', 600, 420, `{ equals: 2.2 }`, `label: 'TELLER JOBS', rows: [{ label: '1988', start: 0.3 }, { label: '2004', start: 1.1 }]`],
  ['time-bars', 1240, 940, `{ less: 0.5, more: 1.5, people: 2.2 }`],
  ['task-copies-2d', 1240, 940, `{ done: 0.6, copies: 1.6 }`],
  ['live-chart', 1240, 940, `{ expect: 0.1, expectEnd: 1.6, a: 2.0, b: 2.6, watch: 3.6 }`, `label: 'TELLERS AND BRANCHES', axis: ['1988', '2004'], labels: ['PER BRANCH', 'BRANCHES']`],
  ['map-pin-drop', 600, 940, `{ first: 0.3, more: 2.0 }`, `first: 7, more: 3`],
  ['toast', 800, 150, null, `items: [[0.4, '+43% CITY BRANCHES', S.colors.channel], [2.9, 'HELD LEVEL', S.colors.mint]]`],
]
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${skin.fontCss}html,body{margin:0;background:#000}</style></head><body>
<canvas id="c" width="${COLS * CELL}" height="${ROWS * CELL}"></canvas>
<script type="module">
import { bezier } from '${pathToFileURL(join(HERE, '..', 'styles', '_core', 'house.mjs')).href}'
const S = ${JSON.stringify(skin)}
const m = S.motion
const e = { enter: bezier(m.enter_bezier), exit: bezier(m.exit_bezier), hero: bezier(m.hero_bezier), utility: bezier(m.utility_bezier) }
const mods = {}
${SHOW.map(([id]) => `mods['${id}'] = await import('${u(id)}')`).join('\n')}
const SHOW = [${SHOW.map(([id, w, h, times, extra]) => `['${id}', ${w}, ${h}, ${times ?? 'null'}, { ${extra ?? ''} }]`).join(',\n')}]
await document.fonts.load("200px 'Anton'"); await document.fonts.load("600 40px 'IBM Plex Mono'"); await document.fonts.load("700 40px 'IBM Plex Mono'"); await document.fonts.load("800 40px 'Archivo'")
const cells = SHOW.map(([id, w, h]) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv })
window.__draw = (t) => {
  const g = document.getElementById('c').getContext('2d'), c = S.colors
  g.fillStyle = c.ink; g.fillRect(0, 0, ${COLS * CELL}, ${ROWS * CELL})
  SHOW.forEach(([id, w, h, times, extra], i) => {
    const cv = cells[i], cg = cv.getContext('2d'); cg.clearRect(0, 0, w, h)
    cg.fillStyle = c.ink; cg.beginPath(); cg.roundRect(2, 2, w - 4, h - 4, 28); cg.fill(); cg.strokeStyle = c.line; cg.lineWidth = 2; cg.stroke()
    mods[id].draw(cg, t, { c, e, W: w, H: h, times: times ?? {}, ...extra })
    const x = (i % ${COLS}) * ${CELL}, y = Math.floor(i / ${COLS}) * ${CELL}, s = Math.min(440 / w, 380 / h)
    g.drawImage(cv, x + (${CELL} - w * s) / 2, y + 20 + (380 - h * s) / 2, w * s, h * s)
    g.font = "600 26px 'IBM Plex Mono'"; g.fillStyle = c.creamSoft; g.textAlign = 'center'; g.fillText(id, x + ${CELL} / 2, y + 450)
  })
  return document.getElementById('c').toDataURL('image/jpeg', 0.95)
}
window.__ready = true
</script></body></html>`
const dir = mkdtempSync(join(tmpdir(), 'moves-gallery-'))
writeFileSync(join(dir, 'g.html'), html)
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] })
const page = await browser.newPage({ viewport: { width: COLS * CELL, height: ROWS * CELL } })
page.on('pageerror', (er) => { console.error('page error:', er.message); process.exitCode = 1 })
await page.goto(pathToFileURL(join(dir, 'g.html')).href)
await page.waitForFunction(() => window.__ready === true)
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out], { stdio: ['pipe', 'inherit', 'inherit'] })
for (let f = 0; f < LOOP * FPS; f++) {
  const url = await page.evaluate((t) => window.__draw(t), f / FPS)
  if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r))
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await browser.close()
console.log(`wrote ${out}`)
