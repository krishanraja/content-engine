// The live board on every device (docs/plans/2026-11-09-board-desk/PLAN.md, "Testing on every device"). Serves the built
// page (api/board/_deskPage.ts) with a view JSON in place of the server, then on each device, light and dark:
//   no sideways scroll; every control's text fits inside it; every control at least 44px tall; the action bar in the
//   same place on every day card; no serious axe-core finding; and the flows: open a day, research it now (and Undo),
//   drop a file, pick a look, review a revised option, copy a prompt, save long-form thoughts.
//
//   node scripts/check-desk-devices.mjs VIEW.json [SCREENSHOT_DIR]
// Chromium only (the browser this environment has); real Safari is not tested here.
import { readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright')
const [viewPath, shots] = process.argv.slice(2)
if (!viewPath) { console.error('usage: node scripts/check-desk-devices.mjs VIEW.json [SCREENSHOT_DIR]'); process.exit(2) }
const src = readFileSync(new URL('../apps/control-plane/api/board/_deskPage.ts', import.meta.url), 'utf8')
const page = JSON.parse(src.slice(src.indexOf('= ') + 2).trim())
const view = JSON.parse(readFileSync(viewPath, 'utf8'))
const axe = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const WEEK = view.week
if (shots) mkdirSync(shots, { recursive: true })

const DEVICES = [
  ['iphone-se', devices['iPhone SE']], ['iphone-15-pro', devices['iPhone 15 Pro']], ['pixel-7', devices['Pixel 7']],
  ['ipad-mini', devices['iPad Mini']], ['ipad-pro', devices['iPad Pro 11']],
  ['desktop-1280', { viewport: { width: 1280, height: 800 } }], ['desktop-1440', { viewport: { width: 1440, height: 900 } }],
  ['desktop-1920', { viewport: { width: 1920, height: 1080 } }],
]
const problems = []
const sent = []
const say = (where, what) => problems.push(`${where}: ${what}`)

async function checks(p, where) {
  const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  if (over) say(where, 'scrolls sideways')
  const clipped = await p.evaluate(() => [...document.querySelectorAll('button, a.inline-flex, summary, [role=tab]')].filter(e => {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') return false
    const t = e.querySelector('.truncate') || e
    return t.scrollWidth > t.clientWidth + 1 && t.textContent.trim().length > 0
  }).map(e => e.textContent.trim().slice(0, 40)))
  if (clipped.length) say(where, `text does not fit: ${JSON.stringify(clipped.slice(0, 6))}`)
  const small = await p.evaluate(() => [...document.querySelectorAll('button, a.inline-flex, summary, [role=tab], [role=radiogroup] label')].filter(e => {
    const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && !e.closest('[aria-hidden=true]')
  }).map(e => `${e.tagName} "${e.textContent.trim().slice(0, 24)}" ${Math.round(e.getBoundingClientRect().height)}px`))
  if (small.length) say(where, `controls under 44px: ${JSON.stringify(small.slice(0, 6))}`)
  await p.addScriptTag({ content: axe })
  const found = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .filter(v => ['serious', 'critical'].includes(v.impact)).map(v => `${v.id} (${v.nodes.length})`))
  if (found.length) say(where, `axe: ${found.join(', ')}`)
}

const browser = await chromium.launch()
for (const [name, device] of DEVICES) for (const scheme of ['light', 'dark']) {
  const where = `${name} ${scheme}`
  const ctx = await browser.newContext({ ...device, colorScheme: scheme, permissions: ['clipboard-read', 'clipboard-write'] })
  const p = await ctx.newPage()
  const errors = []; p.on('pageerror', e => errors.push(e.message))
  await p.route('https://desk.test/**', async route => {
    const u = new URL(route.request().url()), m = route.request().method()
    if (u.pathname.startsWith('/board/next/')) return route.fulfill({ status: 200, contentType: 'text/html', body: page })
    if (u.pathname === `/api/board/${WEEK}/view`) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ...view }) })
    if (u.pathname === '/api/board/weeks') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, weeks: [WEEK] }) })
    if (m !== 'GET') {
      sent.push({ where, path: u.pathname, body: route.request().postDataJSON() })
      const op = u.pathname.split('/').pop()
      const reply = op === 'research' ? { ok: true, material: { title: 'Engine research', bytes: 9000 }, sources: 12 } : op === 'run' ? { ok: true, sent: true, workflow: 'make-piece.yml' } : { ok: true, revision: 2, material: { title: 'x', bytes: 10 } }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) })
    }
    return route.fulfill({ status: 404, body: '' })
  })
  await p.goto(`https://desk.test/board/next/${WEEK}`)
  await p.waitForSelector('#day-mon')
  await p.waitForTimeout(400)
  await checks(p, `${where} home`)
  if (shots && scheme === 'light') await p.screenshot({ path: `${shots}/${name}-home.png`, fullPage: true })
  // The action bar sits in the same place on every day card: its first button starts at the same x on each.
  const xs = await p.evaluate(() => [...document.querySelectorAll('article[id^=day-]')].map(a => { const b = a.querySelector('div.border-t button'); return b ? Math.round(b.getBoundingClientRect().left - a.getBoundingClientRect().left) : null }).filter(x => x !== null))
  if (new Set(xs).size > 1) say(where, `action bars start at different places: ${JSON.stringify(xs)}`)
  // Open Friday: its path opens on the current step.
  await p.click('#day-fri > button')
  await p.waitForSelector('#day-fri [role=tablist]')
  await checks(p, `${where} friday open`)
  if (shots && scheme === 'light') await p.locator('#day-fri').screenshot({ path: `${shots}/${name}-friday.png` })
  if (scheme === 'light' && name === 'desktop-1440') {
    // Pick a look: choose the second option, save; the press waits for its Undo window, then is sent.
    const radios = p.locator('#day-fri [role=radiogroup] label')
    if (await radios.count() > 1) await radios.nth(1).click()
    await p.getByRole('button', { name: 'Use this look' }).click()
    await p.waitForTimeout(5600)
    if (!sent.some(x => x.path.endsWith('/look'))) say(where, 'the look press was not sent')
    // Research Monday now, then Undo it: nothing is sent.
    await p.click('#day-mon > button')
    await p.locator('#day-mon [role=tab]').first().click()
    const before = sent.length
    await p.locator('#day-mon').getByRole('button', { name: 'Research it now' }).click()
    await p.getByRole('button', { name: 'Undo' }).click()
    await p.waitForTimeout(5600)
    if (sent.length !== before) say(where, 'Undo did not stop the research press')
    await p.locator('#day-mon').getByRole('button', { name: 'Research it now' }).click()
    await p.waitForTimeout(5600)
    if (!sent.some(x => x.path.endsWith('/research'))) say(where, 'the research press was not sent')
    // Drop a file on Monday.
    await p.locator('#day-mon input[type=file]').setInputFiles({ name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Notes\n\nOne finding.') })
    await p.waitForTimeout(400)
    if (!sent.some(x => x.path.endsWith('/material') && x.body.content.includes('One finding'))) say(where, 'the dropped file was not filed')
    // Copy a prompt: the sheet shows the whole prompt, and Copy puts it on the clipboard.
    await p.locator('#day-mon').getByRole('button', { name: 'Copy Perplexity prompt' }).click()
    await p.getByRole('button', { name: 'Copy prompt' }).click()
    const clip = await p.evaluate(() => navigator.clipboard.readText())
    if (!/primary sources/.test(clip)) say(where, 'the copied prompt is not the research prompt')
    await p.getByRole('button', { name: 'Close' }).click()
    // Long-form thoughts on a step.
    await p.locator('#day-mon').getByRole('button', { name: /Add your thoughts/ }).first().click()
    await p.locator('[role=dialog] textarea').fill('Lead with who holds the bill.')
    await p.getByRole('button', { name: 'Save my thoughts' }).click()
    await p.waitForTimeout(400)
    if (!sent.some(x => x.path.includes('/comments/') && x.body.body.text === 'Lead with who holds the bill.')) say(where, 'his thoughts were not saved')
    // Review a revised option on its day: Approve sends the full board's record after the Undo window.
    await p.click('#day-tue > button')
    const approve = p.locator('#day-tue').getByRole('button', { name: 'Approve', exact: true })
    if (await approve.count()) {
      await approve.first().click()
      await p.waitForTimeout(5600)
      if (!sent.some(x => x.path.includes('/queue/off-tue-'))) say(where, 'the review press was not sent')
    } else say(where, 'no revised option to review on Tuesday')
  }
  if (errors.length) say(where, `page errors: ${errors.join(' | ')}`)
  await ctx.close()
}
await browser.close()
const presses = sent.map(x => x.path.split('/').slice(3).join('/'))
console.log(`devices: ${DEVICES.length} x light and dark; presses sent: ${JSON.stringify([...new Set(presses)])}`)
if (problems.length) { console.log(`FAILED:\n  ${problems.join('\n  ')}`); process.exit(1) }
console.log('PASS: every device, both themes: no sideways scroll, text fits, 44px controls, action bars aligned, no serious axe finding, every flow sends its press')
