// Renders the version 2 scene (lab/universe/scene/) to a 12 s video and day and night stills, 1080x1350.
//   node lab/universe/render3d.cjs <out-dir>
// Or the floor close-ups (lab/universe/PLAN.md, "Floor close-ups"): a 5 s push in on one or two floors, 1080x1350, and
// one still (2x) mid-move, where the floor is centred, for each shot named (roof, watch-write, share-sell; "all" for every one).
//   node lab/universe/render3d.cjs <out-dir> --shots all
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
const SHOT_NAMES = ['roof', 'watch-write', 'share-sell'], SHOT_SECONDS = 5, SHOT_STILL = 2.4
const shotArg = process.argv.indexOf('--shots') > 0 ? process.argv[process.argv.indexOf('--shots') + 1] : null
const shots = shotArg === 'all' ? SHOT_NAMES : shotArg ? shotArg.split(',') : null
for (const s of shots || []) if (!SHOT_NAMES.includes(s)) throw new Error(`unknown shot ${s}; one of ${SHOT_NAMES.join(', ')}`)
const encode = (dest) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f%04d.png'),
  '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-movflags', '+faststart', dest])
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
    if (shots) {
      for (const name of shots) {
        rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true })
        const page = await open(1), t0 = await page.evaluate((n) => { window.setShot(n); return window.SHOT_T0 }, name)
        for (let f = 0; f < FPS * SHOT_SECONDS; f++) {
          await page.evaluate((t) => window.setTime(t), t0 + f / FPS)
          await page.screenshot({ path: join(frames, `f${String(f).padStart(4, '0')}.png`) })
        }
        encode(join(out, `closeup-${name}.mp4`)); await page.close()
        const still = await open(2); await still.evaluate(([n, t]) => { window.setShot(n); window.setTime(t) }, [name, t0 + SHOT_STILL])
        await still.screenshot({ path: join(out, `closeup-${name}.png`) }); await still.close()
        console.log('wrote', name)
      }
      await browser.close(); rmSync(frames, { recursive: true, force: true }); return
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
    encode(join(out, 'universe-v2.mp4'))
    rmSync(frames, { recursive: true, force: true })
    console.log('wrote', out)
  } finally { server.kill() }
})().catch((e) => { console.error(e); server.kill(); process.exit(1) })
