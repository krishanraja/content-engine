// Polish mock frames: HTML/CSS rendered in Playwright's Chromium with the brand's own font files and tokens.
// Motion phases are computed from the brand's own curves (config/ve/brand-tokens.json motion) at 30 fps.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = '/tmp/claude-0/-home-user/63cf1651-3ee8-5d67-9673-d5fc61485f70/scratchpad'
const OUT = `${ROOT}/polish/frames`
const HTML = `${ROOT}/polish/html`
const W = `file://${ROOT}/polish/work`
const PH = `file://${ROOT}/polish/photos`
const NM = 'file:///home/user/content-engine/node_modules'
const BRAND = `file://${ROOT}/sgref/p/stage-short/assets/src/assets/brand/makeyourmindup`
const STILL = `file://${ROOT}/sgref/stills`
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(HTML, { recursive: true })

// ---- the brand's curves (brand-tokens.json motion) ----
function bezier(p1x, p1y, p2x, p2y) {
  return t => {
    if (t <= 0) return 0; if (t >= 1) return 1
    let lo = 0, hi = 1, x = t
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; const bx = 3 * (1 - m) ** 2 * m * p1x + 3 * (1 - m) * m ** 2 * p2x + m ** 3; if (bx < x) lo = m; else hi = m }
    const m = (lo + hi) / 2; return 3 * (1 - m) ** 2 * m * p1y + 3 * (1 - m) * m ** 2 * p2y + m ** 3
  }
}
const HERO = bezier(0.16, 1, 0.3, 1)      // hero_bezier: entrances
const EXIT = bezier(0.3, 0, 0.8, 0.15)    // exit_bezier: departures
const UTIL = bezier(0.2, 0, 0, 1)         // utility_bezier: wires, wipes
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const prog = (f, start, dur) => clamp((f - start) / dur)
// speed blur: half-frame shutter, capped at 18 px (kit/ingredients.ts MAX_BLUR_PX)
const blurOf = (fn, f) => Math.min(18, Math.abs(fn(f + 0.5) - fn(f - 0.5)) * 0.5)

const T = {
  ink: '#0C1512', inkDeep: '#070D0B', inkSoft: '#16221D', cream: '#F4EFE4', mint: '#7EF0C0',
  coral: '#FF6A4D', butter: '#FFD84D', lilac: '#B7A6FF',
  // proposed (need Krish's words before they enter config/brand-palette.json):
  ember: '#E2551F', emberDeep: '#B8321C', plum: '#3B1232', plumDeep: '#1E0918', peach: '#FFB48F',
}
const EMBER_GRADIENT = `linear-gradient(180deg, ${T.plumDeep} 0%, ${T.plum} 12%, ${T.emberDeep} 30%, ${T.coral} 46%, ${T.ember} 62%, #8E2A22 82%, ${T.plumDeep} 100%)`

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1.6 -0.3'/></filter><rect width='300' height='300' filter='url(#n)'/></svg>`)}")`

const CSS = `
@font-face{font-family:'MYMU Anton';src:url('${NM}/@fontsource/anton/files/anton-latin-400-normal.woff2')}
@font-face{font-family:'MYMU Archivo';font-weight:100 900;font-stretch:62% 125%;src:url('${NM}/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2') format('woff2-variations')}
@font-face{font-family:'MYMU Fraunces';font-style:normal;font-weight:100 900;src:url('${NM}/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2') format('woff2-variations')}
@font-face{font-family:'MYMU Fraunces';font-style:italic;font-weight:100 900;src:url('${NM}/@fontsource-variable/fraunces/files/fraunces-latin-full-italic.woff2') format('woff2-variations')}
@font-face{font-family:'MYMU Plex Mono';font-weight:500;src:url('${NM}/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2')}
@font-face{font-family:'MYMU Plex Mono';font-weight:600;src:url('${NM}/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:var(--w);height:var(--h);overflow:hidden;background:${T.ink};color:${T.cream}}
.abs{position:absolute}
.display{font-family:'MYMU Anton';font-weight:400;text-transform:uppercase;line-height:.88;letter-spacing:.005em}
.accent{font-family:'MYMU Fraunces';font-style:italic;font-weight:420;font-variation-settings:'opsz' 144,'SOFT' 60,'WONK' 0;letter-spacing:-.01em;line-height:1.02}
.eyebrow{font-family:'MYMU Archivo';font-stretch:62%;font-weight:720;text-transform:uppercase;letter-spacing:.14em;line-height:1.1}
.data{font-family:'MYMU Plex Mono';font-weight:500;letter-spacing:.06em}
.caption{font-family:'MYMU Archivo';font-weight:900;font-stretch:112%;letter-spacing:-.015em;line-height:1.06}
.grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.07;mix-blend-mode:overlay;pointer-events:none}
.hair{height:2px;background:rgba(244,239,228,.18)}
`
const page = (w, h, body, extra = '') => `<!doctype html><html><head><meta charset="utf-8"><style>:root{--w:${w}px;--h:${h}px}${CSS}${extra}</style></head><body><div class="abs" style="inset:0;overflow:hidden">${body}</div></body></html>`

// ---- shared pieces ----
const PANEL_H = 1000 // band staging: panel y 0 to 0.52 of 1920
function bandTake(img = `${W}/take-17.png`, { scale = 1.42, faceX = 640, eyeY = 880, toX = 540, toEyeY = 1380 } = {}) {
  const left = toX - faceX * scale, top = toEyeY - eyeY * scale
  return `<img class="abs" src="${img}" style="left:${left}px;top:${top}px;width:${1080 * scale}px">`
}
const seamCaption = (text) => `<div class="abs caption" style="left:0;right:0;top:${PANEL_H - 52}px;display:flex;justify-content:center;z-index:5">
  <span style="background:${T.ink};color:${T.cream};font-size:64px;padding:18px 36px 22px;box-shadow:10px 10px 0 ${T.coral}">${text}</span></div>`

const billCard = ({ w = 430, tilt = 0, total = true } = {}) => `
<div style="width:${w}px;background:${T.cream};color:${T.ink};border-radius:18px;padding:30px 30px 26px;transform:rotate(${tilt}deg);box-shadow:0 30px 60px rgba(0,0,0,.35)">
  <div class="eyebrow" style="font-size:22px;color:${T.ink};opacity:.7">Itemised statement</div>
  <div class="data" style="font-size:19px;margin-top:6px;opacity:.6">ACCT 0047-2219 · INPATIENT</div>
  <div style="height:2px;background:${T.ink};opacity:.15;margin:18px 0 10px"></div>
  ${[['Room and board', '41,280.00'], ['Pharmacy', '38,915.40'], ['Laboratory', '27,604.10'], ['Imaging', '33,120.00'], ['Supplies, misc.', '54,080.50']].map(([a, b]) => `
  <div class="data" style="display:flex;justify-content:space-between;font-size:20px;padding:7px 0;border-bottom:1.5px solid rgba(12,21,18,.12)"><span>${a}</span><span>${b}</span></div>`).join('')}
  ${total ? `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:14px"><span class="eyebrow" style="font-size:22px">Patient owes</span><span class="display" style="font-size:54px">$195,000</span></div>` : ''}
</div>`

const readCard = (w = 420) => `
<div style="width:${w}px;background:${T.inkSoft};border:2px solid rgba(244,239,228,.14);border-radius:18px;padding:26px 28px">
  <div style="display:flex;align-items:center;gap:14px"><div style="width:40px;height:40px;border-radius:50%;background:${T.coral}"></div>
  <div><div class="eyebrow" style="font-size:20px;color:${T.cream};opacity:.7">The read</div><div class="data" style="font-size:18px;opacity:.55">29 OCT 2025</div></div></div>
  <div class="caption" style="font-size:40px;margin-top:18px;font-weight:800;font-stretch:100%">Line by line, every charge checked.</div>
</div>`

const resultCard = (w = 470) => `
<div style="width:${w}px;background:${T.mint};color:${T.ink};border-radius:18px;padding:24px 30px 28px">
  <div class="eyebrow" style="font-size:22px;opacity:.75">After the read</div>
  <div style="display:flex;align-items:baseline;gap:22px;margin-top:8px"><span class="display" style="font-size:120px">$0</span>
  <span class="accent" style="font-size:44px;line-height:1">owed by the family</span></div>
</div>`

const wireDefs = `<defs><radialGradient id="pulse"><stop offset="0" stop-color="${T.mint}"/><stop offset="1" stop-color="${T.mint}" stop-opacity="0"/></radialGradient></defs>`
function wire(d, len, drawn, colour, { pulseAt = null, pt = null } = {}) {
  return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - drawn)}" opacity="${colour === T.cream ? 0.75 : 1}"/>
  ${pt ? `<circle cx="${pt.x}" cy="${pt.y}" r="22" fill="url(#pulse)"/><circle cx="${pt.x}" cy="${pt.y}" r="7" fill="${T.mint}"/>` : ''}`
}
const port = (x, y, c = T.cream) => `<circle cx="${x}" cy="${y}" r="9" fill="${T.ink}" stroke="${c}" stroke-width="4"/>`

function wideTake(img = `${W}/takew-9.png`) {
  // the long take is vertical: his face column is a 608 x 1080 crop of it, face centred (shot grammar, band 16:9)
  return `<div class="abs" style="left:1312px;top:0;width:608px;height:1080px;overflow:hidden"><img src="${img}" style="position:absolute;width:900px;left:-146px;top:-300px"></div>`
}

// ===== Protected baselines: the platform deep dive (Character.ai band) and the additive unit chart (Mon 2 Nov) =====
const frames = []
const add = (name, w, h, body) => frames.push({ name, w, h, html: page(w, h, body) })
const CAI = `file://${ROOT}/polish/cai`
const BUTTER = T.butter

// The original frames from his cut (sha 39f1039c...), kept as the baseline.
add('PD-0a-original-headline-wall', 1080, 1920, `<img class="abs" src="${CAI}/f-6.2.png" style="width:1080px">`)
add('PD-0b-original-recording-circles', 1080, 1920, `<img class="abs" src="${CAI}/f-9.6.png" style="width:1080px">`)
add('PD-0c-original-event-tape', 1080, 1920, `<img class="abs" src="${CAI}/f-13.2.png" style="width:1080px">`)

// The face band and his caption stay the cut's own: the rebuilt panel covers y 0 to 1000 only.
const keepBand = (src) => `<img class="abs" src="${CAI}/${src}" style="width:1080px">`
// A platform UI wall built from his real screen grabs (the cards of his own screen recording), not drawn tiles.
function uiWall(drift = 0) {
  const cards = [0, 1, 2, 3]
  let out = ''
  for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) {
    const k = (r * 3 + c) % 4, x = -60 + c * 156 + (r % 2) * 40 - drift, y = -40 + r * 236
    out += `<img src="${CAI}/card${k}.png" style="position:absolute;left:${x}px;top:${y}px;width:140px;height:220px;object-fit:cover;border-radius:12px;opacity:.9">`
  }
  return `<div class="abs" style="inset:0;overflow:hidden">${out}</div><div class="abs" style="inset:0;background:linear-gradient(180deg, rgba(7,13,11,.55), rgba(7,13,11,.72))"></div>`
}
const platformHeader = `<img class="abs" src="${CAI}/cai-wordmark.png" style="left:${540 - 175}px;top:40px;width:350px;mix-blend-mode:screen">`
const yellowTop = `<div class="abs" style="left:0;right:0;top:0;height:8px;background:${BUTTER}"></div>`

// PD-1: rebuilt, then polished: the wall is his real grabs; the two-tone headline (cream, one mint word) slams in by
// word (the cut's own WORD BLUR-IN: 8 px blur to sharp in 2 to 3 f at 30 fps); grain; tighter leading; 72 px margins.
function headlineWall(f) {
  const words = [['Millions', T.cream], ['made', T.cream], ['friends', T.mint], ['here.', T.cream]]
  const lines = [[0, 1], [2, 3]]
  const w = (i) => { const p = clamp((f - i * 4) / 3); return `<span style="display:inline-block;color:${words[i][1]};filter:blur(${(1 - p) * 8}px);opacity:${0.5 + 0.5 * p};margin-right:.18em">${words[i][0]}</span>` }
  return `${keepBand('f-6.2.png')}
  <div class="abs" style="left:0;top:0;width:1080px;height:1000px;background:${T.inkDeep};overflow:hidden">${uiWall(f * 0.6)}<div class="grain"></div>
    ${yellowTop}${platformHeader}
    <div class="abs display" style="left:72px;right:72px;top:330px;font-size:150px;line-height:.9;text-align:center;text-shadow:0 10px 40px rgba(0,0,0,.45)">${lines.map(l => l.map(w).join('')).join('<br>')}</div>
    <div class="abs data" style="left:72px;top:920px;font-size:22px;opacity:.7">CHARACTER.AI HOME PAGE · SCREEN GRABS · 28 OCT 2026</div></div>`
}
add('PD-1a-polish-headline-wall-f6', 1080, 1920, headlineWall(6))
add('PD-1b-polish-headline-wall-settled', 1080, 1920, headlineWall(24))

// PD-2: the screen recording, with hand-drawn loops on the items he names, each drawn on his word (8 f, utility),
// double stroke, in the day's colour (butter on follow.the.money), and the mono source line under it.
function recording(f) {
  const loop = (cx, cy, rx, ry, start, seed) => {
    const p = UTIL(prog(f, start, 8)), L = 2 * Math.PI * Math.max(rx, ry) * 1.1
    const d = `M ${cx + rx} ${cy} C ${cx + rx} ${cy - ry * 1.15}, ${cx - rx * 1.1} ${cy - ry}, ${cx - rx} ${cy + seed} S ${cx + rx * 0.9} ${cy + ry * 1.2}, ${cx + rx * 1.05} ${cy - ry * 0.25}`
    return `<path d="${d}" fill="none" stroke="${BUTTER}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - p)}"/>
    <path d="${d}" fill="none" stroke="${BUTTER}" stroke-width="3" stroke-linecap="round" opacity=".6" transform="rotate(4 ${cx} ${cy})" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - UTIL(prog(f, start + 3, 8)))}"/>`
  }
  const push = 1 + 0.04 * clamp(f / 60)
  return `${keepBand('f-9.6.png')}
  <div class="abs" style="left:0;top:0;width:1080px;height:1000px;background:${T.inkDeep};overflow:hidden"><div class="grain"></div>${yellowTop}
    <div class="abs" style="left:40px;top:230px;width:1000px;height:438px;border-radius:22px;overflow:hidden;border:2px solid rgba(244,239,228,.16);box-shadow:0 30px 80px rgba(0,0,0,.5)">
      <img src="${CAI}/rec.png" style="width:1000px;transform:scale(${push});transform-origin:30% 50%"></div>
    <svg class="abs" style="left:0;top:0" width="1080" height="1000">${loop(240, 380, 92, 84, 6, 8)}${loop(868, 380, 92, 84, 18, -6)}</svg>
    <div class="abs data" style="left:72px;top:720px;font-size:22px;opacity:.75">CHARACTER.AI HOME PAGE · SCREEN RECORDING · 28 OCT 2026</div></div>`
}
add('PD-2a-polish-recording-first-loop', 1080, 1920, recording(12))
add('PD-2b-polish-recording-both-loops', 1080, 1920, recording(40))

// PD-3: event tape. Two butter tapes cross the panel (Anton repeat on the upper, the filing in mono on the lower, both
// slide in from opposite sides, 10 f hero), the confetti chips burst once (12 chips, mint, cream and butter), the
// headline: a small cream line, then the giant butter word.
function tape(f) {
  const t1 = HERO(prog(f, 0, 10)), t2 = HERO(prog(f, 3, 10)), h = HERO(prog(f, 8, 8))
  const rep = (s, n) => Array.from({ length: n }, () => s).join('')
  const chips = Array.from({ length: 12 }, (_, i) => {
    const a = i * 2.4, r = 120 + 260 * clamp((f - 8) / 14) * (0.6 + (i % 3) * 0.2)
    const x = 540 + Math.cos(a) * r * 1.4, y = 520 + Math.sin(a) * r * 0.8
    const c = [T.mint, T.cream, BUTTER][i % 3]
    return f > 8 ? `<div class="abs" style="left:${x}px;top:${y}px;width:${18 + (i % 4) * 6}px;height:10px;background:${c};transform:rotate(${i * 37}deg);opacity:${1 - clamp((f - 24) / 12)}"></div>` : ''
  }).join('')
  return `${keepBand('f-13.2.png')}
  <div class="abs" style="left:0;top:0;width:1080px;height:1000px;background:${T.inkDeep};overflow:hidden">${uiWall(f * 0.6)}<div class="grain"></div>${yellowTop}${platformHeader}
    <div class="abs" style="left:-100px;top:170px;width:1400px;transform:translateX(${(1 - t1) * -1400}px) rotate(-6deg);background:${BUTTER};padding:14px 0;box-shadow:0 10px 0 rgba(0,0,0,.25)">
      <div class="display" style="font-size:64px;color:${T.ink};white-space:nowrap">${rep('Chapter 11 · ', 8)}</div></div>
    <div class="abs" style="left:-100px;top:800px;width:1400px;transform:translateX(${(1 - t2) * 1400}px) rotate(5deg);background:${BUTTER};padding:16px 0;box-shadow:0 10px 0 rgba(0,0,0,.25)">
      <div class="data" style="font-size:34px;font-weight:600;color:${T.ink};white-space:nowrap;letter-spacing:.12em">${rep('COURT FILING · FILED 12 OCT 2026 · ', 4)}</div></div>
    ${chips}
    <div class="abs" style="left:0;right:0;top:360px;text-align:center;opacity:${h};transform:scale(${1.08 - 0.08 * h})">
      <div class="display" style="font-size:96px;color:${T.cream}">Now it's</div>
      <div class="display" style="font-size:230px;color:${BUTTER};margin-top:-6px">Bankrupt.</div></div></div>`
}
add('PD-3a-polish-tape-f6', 1080, 1920, tape(6))
add('PD-3b-polish-tape-settled', 1080, 1920, tape(20))

// ---- the additive unit chart (Mon 2 Nov, "Who trains your 2030 seniors") ----
// 100 ID badges, 10 x 10, a plane in slight 3D; the juniors carry a butter stripe; one change lands per spoken claim.
const JUNIORS = (() => { const s = []; for (let i = 0; i < 100 && s.length < 27; i++) if (((i * 53 + 17) % 100) < 28) s.push(i); return s })()
function unitChart(state, { w = 1080, h = 1920, wide = false } = {}) {
  // state: 0 = the wall lands (no stripes), 1 = 27 juniors striped ("27%"), 2 = juniors grey from the end of the grid to 9 left ("9%")
  const greyed = state >= 2 ? JUNIORS.slice(9) : []
  const pct = state === 0 ? '' : state === 1 ? '27%' : '9%'
  const badges = Array.from({ length: 100 }, (_, i) => {
    const jr = state >= 1 && JUNIORS.includes(i), grey = greyed.includes(i)
    return `<div style="width:62px;height:84px;border-radius:7px;background:${grey ? '#5d6461' : '#F7F4EC'};opacity:${grey ? 0.5 : 1};position:relative;box-shadow:0 4px 0 rgba(0,0,0,.35)">
      <div style="position:absolute;left:22px;top:7px;width:18px;height:5px;border-radius:3px;background:rgba(12,21,18,.25)"></div>
      ${jr ? `<div style="position:absolute;left:0;right:0;top:56px;height:11px;background:${grey ? '#7c7a64' : BUTTER}"></div>` : ''}</div>`
  }).join('')
  const grid = `<div style="display:grid;grid-template-columns:repeat(10,62px);gap:12px;transform:perspective(1600px) rotateX(24deg) rotateZ(-6deg) skewX(-4deg)">${badges}</div>`
  if (!wide) return `${bandTake()}
  <div class="abs" style="left:0;top:0;width:1080px;height:${PANEL_H}px;background:radial-gradient(90% 70% at 40% 20%, #15241e, ${T.inkDeep} 75%);overflow:hidden"><div class="grain"></div>
    <div class="abs data" style="left:72px;top:96px;font-size:22px;opacity:.75">ANTHROPIC · OCT 2026</div>
    <div class="abs display" style="left:66px;top:130px;font-size:230px;color:${T.cream}">${pct}</div>
    <div class="abs" style="left:540px;top:300px;transform:scale(.6);transform-origin:0 0">${grid}</div></div>
  ${seamCaption(state === 0 ? 'out of every hundred' : state === 1 ? 'juniors were 27' : 'and now just 9').replace(T.coral, BUTTER)}`
  return `${wideTake()}
  <div class="abs" style="left:0;top:0;width:1312px;height:1080px;background:radial-gradient(90% 70% at 40% 20%, #15241e, ${T.inkDeep} 75%);overflow:hidden"><div class="grain"></div>
    <div class="abs data" style="left:96px;top:96px;font-size:22px;opacity:.75">ANTHROPIC · OCT 2026</div>
    <div class="abs display" style="left:90px;top:140px;font-size:260px;color:${T.cream}">${pct}</div>
    <div class="abs" style="left:640px;top:190px;transform:scale(.72);transform-origin:0 0">${grid}</div></div>
  <div class="abs caption" style="left:0;width:1312px;top:930px;display:flex;justify-content:center"><span style="background:${T.ink};color:${T.cream};font-size:52px;padding:14px 30px 18px;box-shadow:0 8px 0 ${BUTTER}">and now just 9</span></div>`
}
add('UC-0-original-mon02', 1080, 1920, `<img class="abs" src="${W}/jobs-before.png" style="width:1080px">`)
add('UC-1-tall-wall-lands', 1080, 1920, unitChart(0))
add('UC-2-tall-27-juniors', 1080, 1920, unitChart(1))
add('UC-3-tall-greys-to-9', 1080, 1920, unitChart(2))
add('UC-4-wide-greys-to-9', 1920, 1080, unitChart(2, { wide: true }))

;(async () => {
  const browser = await chromium.launch(); const only = process.argv[2]
  for (const fr of frames) {
    if (only && !fr.name.startsWith(only)) continue
    const file = path.join(HTML, fr.name + '.html'); fs.writeFileSync(file, fr.html)
    const p = await browser.newPage({ viewport: { width: fr.w, height: fr.h } })
    await p.goto('file://' + file); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(120)
    await p.screenshot({ path: path.join(OUT, fr.name + '.png') }); await p.close(); console.log('wrote', fr.name)
  }
  await browser.close()
})()
