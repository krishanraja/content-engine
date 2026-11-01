#!/usr/bin/env node
// Draw an article figure from its HTML: one PNG per page, at the page's own size, fonts loaded first.
//
// Krish, 2026-11-01: "this article has only one visual, when there are clearly more we have at hand - the article
// should feel more visual in general, not like a wall of text". Each figure is an HTML page in the piece's pack
// (pack/figure*.html, the house tokens and fonts, checked numbers only); this draws it the same way every time,
// so a cloud session and a home computer make the same picture. publish_manager.py places it from page-facts.json.
//
//   node scripts/pages/render_figure.mjs <figure.html> <out.png> [<more.html> <more.png> ...]
//
// The page sets its width on html/body; its height is its content's (figure.css flows), or a fixed one it sets. Exit 1 when a page draws anything outside its
// frame (a word clipped or overflowing), so a cut-off figure never reaches the article.
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

// Playwright is installed globally on the cloud machines and per checkout at home: require finds either.
const { chromium } = createRequire(import.meta.url)('playwright')
const args = process.argv.slice(2)
if (args.length < 2 || args.length % 2) {
  console.error('usage: render_figure.mjs <figure.html> <out.png> [...]')
  process.exit(2)
}
const browser = await chromium.launch()
let bad = 0
try {
  for (let i = 0; i < args.length; i += 2) {
    const [src, out] = [resolve(args[i]), resolve(args[i + 1])]
    const page = await browser.newPage({ deviceScaleFactor: 2 })  // sharp on high-density screens, as the pack figures were
    await page.goto(pathToFileURL(src).href)
    await page.evaluate(() => document.fonts.ready)
    const size = await page.evaluate(() => {
      const b = document.body.getBoundingClientRect()
      return { w: Math.round(b.width), h: Math.round(b.height) }
    })
    await page.setViewportSize({ width: size.w, height: size.h })
    // Anything drawn past the frame, or a box whose words overflow it, is a clipped figure.
    const spill = await page.evaluate(({ w, h }) => {
      const out = []
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) continue
        if (r.right > w + 1 || r.bottom > h + 1 || r.left < -1 || r.top < -1) out.push(`${el.className || el.tagName}: outside the frame`)
        if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') out.push(`${el.className || el.tagName}: words overflow`)
      }
      // A card's words never run past the card's own edge (a fixed-height box with too much in it).
      for (const box of document.querySelectorAll('.card, .col, .rcpt, .step')) {
        const b = box.getBoundingClientRect()
        for (const el of box.querySelectorAll('*')) {
          const r = el.getBoundingClientRect()
          if (r.height && r.bottom > b.bottom + 1) { out.push(`${el.className || el.tagName}: runs past its ${box.className.split(' ')[0]}`); break }
        }
      }
      // The wordmark never touches the headline or any words.
      const mark = document.querySelector('.mark')
      if (mark) {
        const m = mark.getBoundingClientRect()
        for (const el of document.querySelectorAll('h1, .sub')) {
          const r = el.getBoundingClientRect()
          const range = document.createRange(); range.selectNodeContents(el)
          for (const line of range.getClientRects()) {
            if (line.right > m.left && line.left < m.right && line.bottom > m.top && line.top < m.bottom) { out.push(`${el.tagName}: runs into the wordmark`); break }
          }
        }
      }
      return out.slice(0, 5)
    }, size)
    mkdirSync(dirname(out), { recursive: true })
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: size.w, height: size.h } })
    await page.close()
    if (spill.length) { bad++; console.error(`render_figure: ${args[i]} draws past its frame: ${spill.join('; ')}`) }
    else console.log(`render_figure: ${args[i]} -> ${args[i + 1]} (${size.w}x${size.h})`)
  }
} finally {
  await browser.close()
}
process.exit(bad ? 1 : 0)
