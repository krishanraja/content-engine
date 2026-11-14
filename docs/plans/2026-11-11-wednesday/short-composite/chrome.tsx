// One-off for Wed 11 (Krish, 2026-11-10: "closing card is wrong, zero makeyourmindup branding"): render the engine's
// own house chrome (the ending band, the mark tile and the series pill) to transparent PNGs for the composite.
// usage: npx tsx chrome.tsx OUTDIR   (from the repo root)
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')
const root = process.cwd()
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const { EndingBand } = await import(path.join(root, 'apps/renderer/src/engine/chrome/EndingBand.tsx'))
const { MarkTile } = await import(path.join(root, 'apps/renderer/src/engine/chrome/MarkTile.tsx'))
const { ChannelPill } = await import(path.join(root, 'apps/renderer/src/engine/chrome/ChannelPill.tsx'))
const fontDir = path.join(root, 'assets/fonts/makeyourmindup')
const css = `@font-face{font-family:"MYMU Anton";src:url("file://${fontDir}/Anton-Regular.ttf")}
@font-face{font-family:"MYMU Archivo";src:url("file://${fontDir}/Archivo-Variable.ttf")}
@font-face{font-family:"MYMU Fraunces";src:url("file://${fontDir}/Fraunces-Italic-Variable.ttf");font-style:italic}
@font-face{font-family:"MYMU Plex Mono";src:url("file://${fontDir}/IBMPlexMono-Medium.ttf")}
html,body{margin:0;padding:0;background:transparent}`
const brand = {
  stacked: { src: 'file:///tmp/claude-0/brand/masthead.png', pixelWidth: 2415, pixelHeight: 740 },
  mark: { src: 'file:///tmp/claude-0/brand/icon.png', pixelWidth: 512, pixelHeight: 512 },
  logo: { src: 'file:///tmp/claude-0/brand/wordmark.png', pixelWidth: 3319, pixelHeight: 391 },
}
const tokens = { ink: '#0C1512', inkDeep: '#070D0B', inkSoft: '#16221D', cream: '#F4EFE4', mint: '#7EF0C0', channel: '#B7A6FF' }
const series = { label: 'under.the.hood', day: 'Wednesdays', promise: 'Free from jargon', site: 'makeyourmindup.ai' }
const b = await chromium.launch()
for (const aspect of ['9:16', '16:9']) {
  const [w, h] = aspect === '9:16' ? [1080, 1920] : [1920, 1080]
  const props: any = { aspect, fps: 30, durationFrames: 120, tokens, series, brand, ending: { fromFrame: 0, url: 'makeyourmindup.ai' } }
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="width:${w}px;height:${h}px;position:relative;overflow:hidden"><div id="r"></div></body></html>`)
  const tag = aspect === '9:16' ? 'tall' : 'wide'
  for (let f = 0; f < 120; f += 1) {
    const inner = renderToStaticMarkup(React.createElement(EndingBand, { props, frame: f }))
    await p.evaluate((x: string) => { document.getElementById('r')!.innerHTML = x }, inner)
    await p.evaluate(() => Promise.all(Array.from(document.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = r; i.onerror = r }))))
    await p.evaluate(() => document.fonts.ready)
    await p.screenshot({ path: path.join(out, `end_${tag}_${String(f).padStart(3, '0')}.png`), omitBackground: true })
  }
  const corner = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(MarkTile, { props }), React.createElement(ChannelPill, { props, beat: { sectionBeat: true } })))
  await p.evaluate((x: string) => { document.getElementById('r')!.innerHTML = x }, corner)
  await p.evaluate(() => Promise.all(Array.from(document.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = r; i.onerror = r }))))
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: path.join(out, `corner_${tag}.png`), omitBackground: true })
  await p.close()
}
await b.close(); console.log('ok')
