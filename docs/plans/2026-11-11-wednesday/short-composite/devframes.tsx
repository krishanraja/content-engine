// One-off for the Wed 11 short (Krish, 2026-11-10: one-off composite). Renders a device's frames to PNGs.
// usage: npx tsx devframes.tsx job.json   job = {device, object, events, w, h, aspect, from, to, out, bg}
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')
const root = process.cwd()
const tokens = { ink: '#0C1512', inkDeep: '#070D0B', inkSoft: '#16221D', cream: '#F4EFE4', mint: '#7EF0C0', channel: '#B7A6FF' }
const fontDir = path.join(root, 'assets/fonts/makeyourmindup')
const css = `@font-face{font-family:"MYMU Anton";src:url("file://${fontDir}/Anton-Regular.ttf")}
@font-face{font-family:"MYMU Archivo";src:url("file://${fontDir}/Archivo-Variable.ttf")}
@font-face{font-family:"MYMU Fraunces";src:url("file://${fontDir}/Fraunces-Italic-Variable.ttf");font-style:italic}
@font-face{font-family:"MYMU Fraunces";src:url("file://${fontDir}/Fraunces-Upright-Variable.ttf")}
@font-face{font-family:"MYMU Plex Mono";src:url("file://${fontDir}/IBMPlexMono-Medium.ttf")}
html,body{margin:0;padding:0}`
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const mod = await import(path.join(root, `apps/renderer/src/engine/devices/${job.device}/index.tsx`))
fs.mkdirSync(job.out, { recursive: true })
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: 1 })
await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="width:${job.w}px;height:${job.h}px;background:${job.bg || tokens.ink};position:relative;overflow:hidden"><div id="r"></div><span style="font-family:'MYMU Anton'">.</span><span style="font-family:'MYMU Archivo'">.</span><span style="font-family:'MYMU Plex Mono'">.</span><span style="font-family:'MYMU Fraunces';font-style:italic">.</span></body></html>`)
await p.evaluate(() => document.fonts.ready)
const step = job.step || 1
for (let frame = job.from; frame <= job.to; frame += step) {
  const inner = renderToStaticMarkup(React.createElement(mod.Device, { object: job.object, events: job.events, tokens, frame, aspect: job.aspect, box: { left: 0, top: 0, width: job.w, height: job.h } }))
  await p.evaluate((h) => { document.getElementById('r')!.innerHTML = h }, inner)
  await p.screenshot({ path: path.join(job.out, `f${String(frame).padStart(5, '0')}.png`) })
}
await b.close()
console.log('ok', job.out)
