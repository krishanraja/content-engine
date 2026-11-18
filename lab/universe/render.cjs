// Renders lab/universe/universe.html to a day still, a night still and a day-to-night video (1080x1350, 4:5).
// node lab/universe/render.cjs <out-dir>
const { chromium } = require('playwright')
const { mkdirSync, rmSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const { join, resolve } = require('node:path')

const here = __dirname
const out = resolve(process.argv[2] || join(here, 'out'))
const frames = join(out, 'frames')
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true })
const FPS = 30, HOLD = 3 * FPS, TURN = 2 * FPS          // 3 s day, 2 s dusk, 3 s night
;(async () => {
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })
await page.goto('file://' + join(here, 'universe.html'))
await page.evaluate(() => document.fonts.ready)
const ease = (x) => x * x * (3 - 2 * x)
const total = HOLD * 2 + TURN
for (let f = 0; f < total; f++) {
  const t = f < HOLD ? 0 : f < HOLD + TURN ? ease((f - HOLD) / TURN) : 1
  await page.evaluate(([t, f]) => window.setFrame(t, f), [t, f])
  await page.screenshot({ path: join(frames, `f${String(f).padStart(4, '0')}.png`) })
}
const still = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 })
await still.goto('file://' + join(here, 'universe.html'))
await still.evaluate(() => document.fonts.ready)
for (const [name, t] of [['day', 0], ['night', 1]]) {
  await still.evaluate((t) => window.setFrame(t, 4), t)
  await still.screenshot({ path: join(out, `universe-${name}.png`) })
}
await browser.close()
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f%04d.png'),
  '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-movflags', '+faststart', join(out, 'universe.mp4')])
rmSync(frames, { recursive: true, force: true })
console.log('wrote', out)
})()
