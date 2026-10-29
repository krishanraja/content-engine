const { chromium } = require('playwright')
const path = require('path')
;(async () => {
  const files = process.argv.slice(2)
  const b = await chromium.launch()
  for (const f of files) for (const week of ['this', 'next']) for (const [vw, w] of [['phone', 390], ['desktop', 1440]]) {
    const p = await b.newPage({ viewport: { width: w, height: w === 390 ? 844 : 900 }, deviceScaleFactor: 2 })
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
    await p.goto('file://' + path.resolve(f) + '?week=' + week); await p.waitForTimeout(400)
    const sw = await p.evaluate(() => document.documentElement.scrollWidth)
    const out = `shots/${path.basename(f, '.html')}-${week}-${vw}.png`
    await p.screenshot({ path: out, fullPage: true })
    console.log(out, 'scrollWidth', sw, errs.length ? 'ERR ' + errs.join(';') : '')
    await p.close()
  }
  await b.close()
})()
