#!/usr/bin/env node
// The lab's checks, read from what render.mjs recorded of every word on every fifth frame.
//
//   node lab/styles/_core/check.mjs OUT/<style>-<shape>.layout.json [...more] [--sheet OUT/<style>-<shape>.mp4]
//
// Fails (exit 1) when a word to be read sits in any channel's button zone on the tall canvas (channel-safe-zones),
// outside the title-safe box on the wide one, is under 40 px on the tall canvas (F44), when a caption repeats two or
// more words shown elsewhere on screen at that moment (F42), or when a label is on screen too briefly to read.
// Also: a tall cut's animated content may carry no wordmark or series badge (the outro card, joined after, keeps it),
// on a wide cut no word may sit over or under the wordmark or the series name (Ruling, Krish, 2026-11-11), and on a
// tall cut the type uses the top of the screen (the topmost word starts by y 340). Only recorded words are checked
// here; shapes and 3D are not.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { skin as makeSkin } from './brand.mjs'

const skin = makeSkin()
const files = process.argv.slice(2).filter((a) => a.endsWith('.layout.json'))
const hit = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3]
const words = (s) => s.toLowerCase().replace(/[^a-z0-9% ]/g, ' ').split(/\s+/).filter(Boolean)
let failures = 0
const TOP_BY = 340

for (const f of files) {
  const L = JSON.parse(readFileSync(f, 'utf8'))
  const problems = new Map()
  const note = (k, msg) => { if (!problems.has(k)) problems.set(k, msg) }
  const seen = new Map()
  for (const { t, items } of L.layout) {
    const dress = items.filter((i) => i.role === 'dress')
    if (L.shape === 'tall' && dress.length) note('dress:tall', `the tall cut draws "${dress[0].text}" at ${t}s: no wordmark or series badge over a vertical cut's animated content`)
    if (L.shape !== 'tall') for (const it of items) {
      if (it.role === 'dress') continue
      for (const d of dress) if (hit(it.box, d.box)) note(`overdress:${it.text}`, `"${it.text}" at ${t}s sits over or under the ${d.text === '(wordmark)' ? 'wordmark' : 'series name'}`)
    }
    for (const it of items) {
      if (it.role === 'dress' && L.shape !== 'tall') continue
      const b = it.box
      if (L.shape === 'tall') {
        for (const [ch, def] of Object.entries(skin.safe.tall)) {
          for (const z of def.zones) {
            const zb = z.box
            if (hit(b, zb)) note(`zone:${it.text}:${ch}`, `"${it.text}" at ${t}s sits in ${ch} ${z.name}`)
          }
        }
        if (it.size < 40) note(`size:${it.text}`, `"${it.text}" is ${it.size} px tall on the tall canvas (F44 wants 40)`)
      } else {
        const [x1, y1, x2, y2] = skin.safe.wide
        if (b[0] < x1 || b[1] < y1 || b[0] + b[2] > x2 || b[1] + b[3] > y2) note(`wide:${it.text}`, `"${it.text}" at ${t}s is outside the wide title-safe box`)
      }
      if (it.role !== 'number' && it.role !== 'caption' && it.role !== 'close') {
        const s = seen.get(it.text) ?? { first: t, last: t }; s.last = t; seen.set(it.text, s)
      }
    }
    const caps = items.filter((i) => i.role === 'caption').map((i) => i.text).join(' ')
    if (caps) {
      const cw = words(caps)
      for (const o of items.filter((i) => i.role !== 'caption')) {
        const ow = words(o.text)
        for (let k = 0; k + 1 < ow.length; k++) {
          const pair = `${ow[k]} ${ow[k + 1]}`
          if (` ${cw.join(' ')} `.includes(` ${pair} `)) note(`rep:${o.text}`, `caption repeats "${pair}" from "${o.text}" at ${t}s (F42)`)
        }
      }
    }
  }
  // Uses the screen (Krish, 2026-11-11: "all vertical video templates should be adjusted to make maximum use of the
  // full screen, as opposed to the current situation where a third of the screen at the top is now cut off"): on the
  // tall canvas, once the opening second has passed, the topmost word on screen starts by y 340 (just under every
  // channel's top bar at 270) on at least three quarters of the frames that carry any word but a caption.
  if (L.shape === 'tall') {
    const frames = L.layout.filter(({ t, items }) => t >= 1 && items.some((i) => i.role !== 'caption' && i.role !== 'close' && i.role !== 'dress'))
    const low = frames.filter(({ items }) => Math.min(...items.filter((i) => i.role !== 'caption' && i.role !== 'close' && i.role !== 'dress').map((i) => i.box[1])) > TOP_BY)
    if (frames.length && low.length / frames.length > 0.25) note('top:empty', `the top of the tall screen is empty on ${Math.round((100 * low.length) / frames.length)}% of frames: the topmost word starts below y ${TOP_BY} (first at ${low[0].t}s)`)
  }
  for (const [s, { first, last }] of seen) {
    const need = words(s).length / 3.3 + 0.4
    if (last - first + 0.17 < need) note(`read:${s}`, `"${s}" is on screen ${(last - first + 0.17).toFixed(1)}s; reading it needs ${need.toFixed(1)}s`)
  }
  console.log(`${f.split('/').pop()}: ${problems.size ? `${problems.size} problem(s)` : 'clean'}`)
  for (const m of problems.values()) console.log(`  - ${m}`)
  failures += problems.size
}

const i = process.argv.indexOf('--sheet')
if (i > 0) {
  const mp4 = process.argv[i + 1]
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' })
  const d = Number(r.stdout), every = Math.max(1, Math.floor((d * 30) / 12))
  const out = mp4.replace(/\.mp4$/, '.sheet.png')
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf', `select='not(mod(n\\,${every}))',scale=320:-1,tile=6x2`, '-frames:v', '1', out], { stdio: 'inherit' })
  console.log(`contact sheet ${out}`)
}
process.exit(failures ? 1 : 0)
