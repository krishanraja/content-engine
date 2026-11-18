// Renders the version 2 scene (lab/universe/scene/) to a 12 s video and day and night stills, 1080x1350.
//   node lab/universe/render3d.cjs <out-dir>
// Needs lab/universe/vendor/three.module.js and lab/universe/logos/ (see README.md); serves the repository root.
const { chromium } = require('playwright')
const { mkdirSync, rmSync } = require('node:fs')
const { execFileSync, spawn } = require('node:child_process')
const { join, resolve } = require('node:path')

const root = resolve(__dirname, '..', '..')
const out = resolve(process.argv[2] || join(__dirname, 'out'))
const frames = join(out, 'frames3d')
const PORT = 8790 + Math.floor((process.pid % 100))
const FPS = 30, SECONDS = 12
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true })
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' })

;(async () => {
  try {
    await new Promise((r) => setTimeout(r, 800))
    const url = `http://127.0.0.1:${PORT}/lab/universe/scene/index.html`
    const browser = await chromium.launch()
    const open = async (scale) => {
      const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: scale })
      page.on('pageerror', (e) => console.log('pageerror', e.message))
      await page.goto(url); await page.waitForFunction(() => window.ready, null, { timeout: 60000 })
      return page
    }
    const page = await open(1)
    console.log('figurines:', await page.evaluate(() => window.kitName))
    for (let f = 0; f < FPS * SECONDS; f++) {
      await page.evaluate((t) => window.setTime(t), f / FPS)
      await page.screenshot({ path: join(frames, `f${String(f).padStart(4, '0')}.png`) })
    }
    const still = await open(2)
    for (const [name, t] of [['day', 5.5], ['night', 11.2]]) {
      await still.evaluate((t) => window.setTime(t), t)
      await still.screenshot({ path: join(out, `universe-v2-${name}.png`) })
    }
    await browser.close()
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f%04d.png'),
      '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-movflags', '+faststart', join(out, 'universe-v2.mp4')])
    rmSync(frames, { recursive: true, force: true })
    console.log('wrote', out)
  } finally { server.kill() }
})().catch((e) => { console.error(e); server.kill(); process.exit(1) })
