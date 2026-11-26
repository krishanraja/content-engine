/* Measure every caption style against the caption rules on one-word pages, in real Chromium, and write the table
 * config/ve/caption-steady.json that `ve lint` (captions.steady) reads.
 *
 * Krish, 2026-11-18, of the Tue 17 short, whose pages are one word each: "We can't have each new word appear somewhere
 * else on the screen, and we need the previous word to stick around for a tiny bit longer." The rules, for every style:
 *   1. a new word never appears somewhere else (its anchor holds across pages),
 *   2. the previous word or phrase stays visible a little longer,
 *   3. nothing jolts (the art-directed unit tests hold this one; it is not measured here).
 *
 * Fourteen one-word pages of 8 frames (0.27 s at 30 fps), each measured 3 frames after its word is said. For each style:
 * how far the new word's best anchor (left edge, centre or right edge; top, middle or bottom) strays between pages, and
 * how often the previous word is still on screen. A style whose anchor strays 100 px or more has `anchor_moves`.
 *
 *   npx tsx scripts/audit-caption-steady.ts            print the table
 *   npx tsx scripts/audit-caption-steady.ts --write    and write config/ve/caption-steady.json
 *
 * Needs Playwright with Chromium (not a repository dependency: it is on the cloud container and the home computers).
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { CAPTION_THEMES } from '../apps/renderer/src/engine/captions/names'
import { THEMES } from '../apps/renderer/src/engine/captions/themes'
import { ArtDirectedCaption } from '../apps/renderer/src/engine/chrome/ArtDirectedCaption'
import { EngineRenderPropsSchema } from '../apps/renderer/src/engine/props'
import fixture from '../fixtures/ve/engine-core/props.json'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(join(ROOT, 'package.json'))
let chromium: any
try { ({ chromium } = require('playwright')) } catch { throw new Error('audit-caption-steady needs Playwright with Chromium (npm i -g playwright, or the cloud container\'s own)') }

const WORDS = ['secretly', 'they', 'charge', 'you', 'more', 'than', "you'd", 'pay', 'if', 'stuck', 'to', 'your', 'current', 'plan']
const EMPHASISED = new Set([2, 7, 12])
const PER = 8, AFTER = 3, MOVES_PX = 100
const base = EngineRenderPropsSchema.parse(fixture)
const pages = WORDS.map((text, i) => ({ fromFrame: i * PER, toFrame: (i + 1) * PER, words: [{ text, atFrame: i * PER }], swipeIndex: EMPHASISED.has(i) ? 0 : null }))
const propsFor = (theme: string) => ({ ...base, fps: 30 as const, captionTheme: theme as never, captionPlacement: 'lower' as const, captions: pages })
const draw = (theme: string, frame: number) => theme === 'art-directed' ? ArtDirectedCaption({ props: propsFor(theme), frame }) : (THEMES as any)[theme](propsFor(theme), frame)

const fontDir = join(ROOT, 'apps/renderer/src/house')
const fontCss = readFileSync(join(fontDir, 'fonts.css'), 'utf8')
  .replace(/url\('([^']+)'\)/g, (_m, p: string) => {
    const base = p.startsWith('@fontsource') ? join(ROOT, 'node_modules') : fontDir
    return `url('${pathToFileURL(join(base, p)).href}')`
  })
const html: string[] = []
for (const theme of CAPTION_THEMES) for (let p = 0; p < WORDS.length; p++) {
  html.push(`<div class="snap" data-theme="${theme}" data-page="${p}" style="position:relative;width:1080px;height:1920px;overflow:hidden;background:#222">${renderToStaticMarkup(draw(theme, p * PER + AFTER) as never)}</div>`)
}
const file = join(tmpdir(), 'caption-steady-audit.html')
writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>${fontCss} body{margin:0} *{box-sizing:border-box}</style>${html.join('')}`)

const browser = await chromium.launch()
const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
await tab.addInitScript('window.__name = (f) => f')
await tab.goto(pathToFileURL(file).href)
await tab.evaluate(() => (document as any).fonts.ready)
const data: any[] = await tab.evaluate((words: string[]) => {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z']/g, '')
  const out: any[] = []
  document.querySelectorAll('.snap').forEach((snap) => {
    const sb = snap.getBoundingClientRect()
    const theme = (snap as HTMLElement).dataset.theme!, page = Number((snap as HTMLElement).dataset.page)
    const texts: { text: string; l: number; t: number; r: number; b: number; op: number }[] = []
    snap.querySelectorAll('*').forEach((el) => {
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim()
      if (!own) return
      let op = 1, hidden = false
      for (let n: Element | null = el; n && n !== snap.parentElement; n = n.parentElement) {
        const cs = getComputedStyle(n)
        op *= Number(cs.opacity)
        if (cs.visibility === 'hidden' || cs.display === 'none') hidden = true
      }
      const r = el.getBoundingClientRect()
      if (hidden || op < 0.04 || r.width < 1 || r.height < 1) return
      texts.push({ text: own, l: r.left - sb.left, t: r.top - sb.top, r: r.right - sb.left, b: r.bottom - sb.top, op })
    })
    const now = norm(words[page]!), before = page > 0 ? norm(words[page - 1]!) : ''
    const sameWord = (t: { text: string }) => norm(t.text) === now || (norm(t.text).length >= 2 && now.startsWith(norm(t.text)))
    const area = (x: { l: number; r: number; t: number; b: number; op: number }) => (x.r - x.l) * (x.b - x.t) * x.op
    const mine = texts.filter(sameWord).sort((a, b) => area(b) - area(a))[0] ?? null
    const kept = before && before !== now ? texts.filter((t) => norm(t.text) === before) : []
    out.push({ theme, page, now: mine, prevSeen: kept.length ? Math.max(...kept.map((k) => k.op)) : 0 })
  })
  return out
}, WORDS)
await browser.close()

const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs)
const styles: Record<string, { x_anchor_spread_px: number | null; y_anchor_spread_px: number | null; previous_word_kept: boolean; anchor_moves: boolean }> = {}
for (const theme of CAPTION_THEMES) {
  const rows = data.filter((d) => d.theme === theme && d.page >= 1), found = rows.filter((d) => d.now)
  const x = (k: 'l' | 'r' | 'c') => found.map((d) => k === 'l' ? d.now.l : k === 'r' ? d.now.r : (d.now.l + d.now.r) / 2)
  const y = (k: 't' | 'b' | 'c') => found.map((d) => k === 't' ? d.now.t : k === 'b' ? d.now.b : (d.now.t + d.now.b) / 2)
  const xs = found.length ? Math.round(Math.min(spread(x('l')), spread(x('r')), spread(x('c')))) : null
  const ys = found.length ? Math.round(Math.min(spread(y('t')), spread(y('b')), spread(y('c')))) : null
  styles[theme] = { x_anchor_spread_px: xs, y_anchor_spread_px: ys,
    previous_word_kept: rows.filter((d) => d.prevSeen >= 0.1).length >= rows.length / 2,
    anchor_moves: (xs ?? 0) >= MOVES_PX || (ys ?? 0) >= MOVES_PX }
}
console.log('style'.padEnd(18), 'x spread'.padEnd(9), 'y spread'.padEnd(9), 'previous kept'.padEnd(14), 'anchor moves')
for (const [name, s] of Object.entries(styles)) console.log(name.padEnd(18), String(s.x_anchor_spread_px).padEnd(9), String(s.y_anchor_spread_px).padEnd(9), String(s.previous_word_kept).padEnd(14), s.anchor_moves)

if (process.argv.includes('--write')) {
  const doc = {
    _about: 'Each caption style measured on one-word pages, the pages of every face-with-proof cut (brand.captions "word"), against the caption rules Krish gave on 18 Nov 2026: "We can\'t have each new word appear somewhere else on the screen, and we need the previous word to stick around for a tiny bit longer." Written by scripts/audit-caption-steady.ts in real Chromium; never edited by hand. anchor_moves: the new word\'s best anchor strays 100 px or more between pages (rule 1), which ve lint refuses for a word-mode cut (captions.steady). previous_word_kept: the word before is still on screen, dimmed, when the next lands (rule 2); a style that says false cuts it at once, and is a known gap, not a refusal.',
    measured: new Date().toISOString().slice(0, 10), tool: 'scripts/audit-caption-steady.ts',
    pages: { words: WORDS, frames_each: PER, measured_frames_after_the_word: AFTER, emphasised: [...EMPHASISED] },
    moves_px: MOVES_PX, styles,
  }
  writeFileSync(`${ROOT}/config/ve/caption-steady.json`, JSON.stringify(doc, null, 2) + '\n')
  console.log('wrote config/ve/caption-steady.json')
}
