// Renders the whole cast large for review: node lab/universe/figurines/lineup.cjs <out.png> [t]
const { chromium } = require('playwright'); const { spawn } = require('node:child_process'); const { resolve } = require('node:path')
const root = resolve(__dirname, '..', '..', '..'), PORT = 8890 + (process.pid % 100)
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' })
;(async () => {
  try {
    await new Promise((r) => setTimeout(r, 800)); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2100, height: 2100 } })
    p.on('pageerror', (e) => console.log('pageerror', e.message))
    await p.goto(`http://127.0.0.1:${PORT}/lab/universe/figurines/lineup.html`); await p.waitForFunction(() => window.ready, null, { timeout: 60000 })
    await p.evaluate((t) => window.setTime(t), Number(process.argv[3] || 1)); await p.screenshot({ path: process.argv[2] }); await b.close()
  } finally { srv.kill() }
})().catch((e) => { console.error(e); srv.kill(); process.exit(1) })
