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


// ===== Title slide and outro: the lead items (Krish, 2026-11-20) =====
const SF = (shape, f) => `file://${ROOT}/polish/sting/fr/mtg-${shape}/${String(Math.max(1, Math.min(56, f))).padStart(2, '0')}.png`
const frames = []
const BAND_W = `file://${ROOT}/polish/sting/mtg-wide-band.png`
const TITLE_EMBER = `linear-gradient(180deg, #FF7A52 0%, ${T.coral} 22%, ${T.ember} 50%, #8E2A22 74%, ${T.plum} 90%, ${T.plumDeep} 100%)`
const add = (name, w, h, body) => frames.push({ name, w, h, html: page(w, h, body) })

// ---- the title, spoken word by word ----
const TITLE = { a: ['So', 'will', 'your', 'AI', 'auditor', 'find', 'missing', 'money'], or: 'or', b: ['will', 'it', 'find', 'skeletons', 'in', 'your', 'closet?'] }
const PER_WORD = 9                       // about 3.3 words a second as he says the line; each word lands on its own spoken frame
const landAt = i => i * PER_WORD         // i over the whole line (a, or, b)
const LAST = landAt(TITLE.a.length + TITLE.b.length) // frame of the last title word
const wordSpan = (w, i, f, colour) => {
  const p = HERO(prog(f, landAt(i), 6)); const fn = x => (1 - HERO(prog(x, landAt(i), 6))) * 70
  return `<span style="display:inline-block;opacity:${p > 0 ? Math.min(1, p * 2) : 0};transform:translateX(${(1 - p) * 70}px);filter:blur(${blurOf(fn, f)}px);color:${colour};margin-right:.22em">${w}</span>`
}
const linesOf = (words, breaks, offset, f, colour) => {
  let out = '', k = 0
  breaks.forEach((n, li) => { out += words.slice(k, k + n).map((w, j) => wordSpan(w, offset + k + j, f, colour)).join('') + (li < breaks.length - 1 ? '<br>' : ''); k += n })
  return out
}
const bandIn = (f, start) => HERO(prog(f, start - 2, 8))

// Direction A: the approved two-band lockup (Wed 11, "AI MUSIC or HUMAN MUSIC?"), now word by word.
function lockupA(f, { size = 108, breaksA = [3, 3, 2], breaksB = [3, 2, 2], bandW = 860, topA = 330, orTop = 660, topB = 800, frameW = 1080, wm = 0, wmTop = 1260 } = {}) {
  const ia = 0, ior = TITLE.a.length, ib = ior + 1
  const b1 = bandIn(f, landAt(ia)), b2 = bandIn(f, landAt(ib))
  const orP = UTIL(prog(f, landAt(ior), 6))
  return `
  <div class="abs" style="left:0;top:${topA}px;width:${bandW}px;transform:translateX(${(b1 - 1) * (bandW + 40)}px) rotate(-3deg);transform-origin:left center;opacity:${b1 > 0 ? 1 : 0}">
    <div style="background:${T.cream};padding:30px 40px 34px 96px;box-shadow:14px 14px 0 ${T.coral}"><div class="display" style="font-size:${size}px;line-height:.94;color:${T.ink}">${linesOf(TITLE.a, breaksA, ia, f, T.ink)}</div></div></div>
  <div class="abs accent" style="left:0;width:${frameW}px;top:${orTop}px;text-align:center;font-size:${size * 1.1}px;color:${T.mint};font-weight:520;opacity:${orP};transform:translateY(${(1 - orP) * 20}px)">or</div>
  <div class="abs" style="right:0;top:${topB}px;width:${bandW}px;transform:translateX(${(1 - b2) * (bandW + 40)}px) rotate(-3deg);transform-origin:right center;opacity:${b2 > 0 ? 1 : 0}">
    <div style="background:${T.mint};padding:30px 120px 34px 60px;box-shadow:14px 14px 0 ${T.coral}"><div class="display" style="font-size:${size}px;line-height:.94;color:${T.ink}">${linesOf(TITLE.b, breaksB, ib, f, T.ink)}</div></div></div>
  ${wm > 0 ? `<img class="abs" src="${BRAND}/makeyourmindup-stacked.png" style="left:${frameW / 2 - 250}px;width:500px;top:${wmTop + (1 - wm) * 40}px;opacity:${wm}">` : ''}`
}
const titleGround = (w, h) => {
  const n = Math.round(w / 36)
  const bars = Array.from({ length: n }, (_, i) => { const bh = (h * 0.15) + h * 0.3 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)); return `<div class="abs" style="left:${18 + i * 36}px;top:${h / 2 - bh / 2}px;width:12px;height:${bh}px;border-radius:6px;background:${T.mint};opacity:.12"></div>` }).join('')
  return `<div class="abs" style="inset:0;background:radial-gradient(120% 70% at 50% 45%, #10201a 0%, ${T.inkDeep} 70%)"></div>${bars}<div class="grain"></div>`
}
// Tall: builds in the band staging's panel (y 0 to 1000) as he says it; on his last word the panel takes the frame
// (its lower edge slides down over the face band, 8 f hero), the wordmark rises, it holds at most 2 s, then leaves left.
function titleA_tall(f) {
  const take = (f - LAST)
  const grow = HERO(prog(take, 0, 8)), wm = UTIL(prog(take, 6, 10))
  const ex = EXIT(prog(take, 54, 8))                       // leaves at 1.8 s, gone by 2.07 s (cap 2 s full frame)
  const panelH = PANEL_H + (1920 - PANEL_H) * grow
  const s = 0.86 + 0.14 * grow, dy = -200 * (1 - grow)       // in the panel: 86% size, raised into the panel
  const back = HERO(prog(take, 58, 14))
  return `${bandTake()}
  <div class="abs" style="left:0;top:0;width:1080px;height:${panelH}px;overflow:hidden;transform:translateX(${-0.35 * 1080 * ex}px);filter:brightness(${1 - 0.85 * ex})">
    ${titleGround(1080, 1920)}
    <div class="abs" style="left:0;top:0;width:1080px;height:1920px;transform:translateY(${dy}px) scale(${s});transform-origin:50% 330px">${lockupA(f, { wm })}</div>
  </div>
  ${ex > 0 ? `<div class="abs" style="left:0;top:0;width:1080px;height:${PANEL_H}px;background:${T.ink};transform:translateX(${(1 - back) * 1080}px)"><div class="grain"></div></div>` : ''}`
}
// Wide: the pillar staging (his face column 608 px on the right, 0.32); the panel grows over his column on his last word.
function wideTake(img = `${W}/takew-9.png`) {
  // the long take is vertical: his face column is a 608 x 1080 crop of it, face centred (shot grammar, band 16:9)
  return `<div class="abs" style="left:1312px;top:0;width:608px;height:1080px;overflow:hidden"><img src="${img}" style="position:absolute;width:900px;left:-146px;top:-300px"></div>`
}
function titleA_wide(f) {
  const take = f - LAST, grow = HERO(prog(take, 0, 8)), wm = UTIL(prog(take, 6, 10))
  const pw = 1312 + 608 * grow
  const s = 0.7 + 0.15 * grow
  return `${wideTake()}
  <div class="abs" style="left:0;top:0;width:${pw}px;height:1080px;overflow:hidden">${titleGround(1920, 1080)}
    <div class="abs" style="left:${(pw - 1920 * s) / 2}px;top:${grow * -40}px;width:1920px;height:1080px;transform:scale(${s});transform-origin:0 0">
      ${lockupA(f, { size: 112, breaksA: [5, 3], breaksB: [4, 3], bandW: 1400, topA: 150, orTop: 500, topB: 650, frameW: 1920, wm, wmTop: 1050 })}</div></div>`
}

// Direction B: the ember lockup. No bands: plum words straight onto the ember-to-plum ground, the serif "or" in cream.
function lockupB(f, { size = 150, breaksA = [3, 3, 2], breaksB = [3, 2, 2], top = 330, frameW = 1080, lead = 96 } = {}) {
  const ior = TITLE.a.length, ib = ior + 1, orP = UTIL(prog(f, landAt(ior), 6))
  return `<div class="abs" style="left:${lead}px;right:${lead}px;top:${top}px">
    <div class="display" style="font-size:${size}px;line-height:.9">${linesOf(TITLE.a, breaksA, 0, f, T.plum)}</div>
    <div class="accent" style="font-size:${size * 0.8}px;color:${T.cream};opacity:${orP};margin:6px 0 2px">or</div>
    <div class="display" style="font-size:${size}px;line-height:.9">${linesOf(TITLE.b, breaksB, ib, f, T.plum)}</div></div>`
}
function titleB_tall(f) {
  const take = f - LAST, grow = HERO(prog(take, 0, 8)), wm = UTIL(prog(take, 6, 10))
  const panelH = PANEL_H + (1920 - PANEL_H) * grow, s = 0.72 + 0.28 * grow
  return `${bandTake()}
  <div class="abs" style="left:0;top:0;width:1080px;height:${panelH}px;overflow:hidden">
    <div class="abs" style="inset:0;background:${TITLE_EMBER}"></div><div class="grain" style="opacity:.09"></div>
    <div class="abs" style="left:0;top:0;width:1080px;height:1920px;transform:translateY(${-200 * (1 - grow)}px) scale(${s});transform-origin:50% 330px">${lockupB(f, { size: 118, top: 300 })}
      <div class="abs" style="left:96px;top:${1240 + (1 - wm) * 30}px;background:${T.ink};padding:22px 26px;opacity:${wm}"><img src="${BRAND}/makeyourmindup-stacked.png" style="width:300px;display:block"></div></div>
  </div>`
}
function titleB_wide(f) {
  const wm = UTIL(prog(f - LAST, 6, 10))
  return `<div class="abs" style="inset:0;background:${TITLE_EMBER.replace('180deg', '125deg')}"></div><div class="grain" style="opacity:.09"></div>
  ${lockupB(f, { size: 128, breaksA: [5, 3], breaksB: [4, 3], top: 130, lead: 140 })}
  <div class="abs" style="left:140px;top:${900 + (1 - wm) * 20}px;background:${T.ink};padding:18px 22px;opacity:${wm}"><img src="${BRAND}/makeyourmindup-horizontal.png" style="width:420px;display:block"></div>`
}
// Direction C: behind him, through the matte (anchor cuts). His wall becomes ink; the words land behind his head.
function titleC_tall(f) {
  const s = 1.15, left = 540 - 640 * s, top = 845 - 880 * s, wm = UTIL(prog(f - LAST, 6, 10))
  return `<img class="abs" src="${W}/take-17.png" style="left:${left}px;top:${top}px;width:${1080 * s}px">
  ${titleGround(1080, 1920)}
  <div class="abs" style="left:96px;right:96px;top:250px"><div class="display" style="font-size:74px;line-height:.92">${linesOf(TITLE.a, [5, 3], 0, f, T.cream)}</div>
    <div class="accent" style="font-size:66px;color:${T.mint};opacity:${UTIL(prog(f, landAt(8), 6))}">or</div>
    <div class="display" style="font-size:74px;line-height:.92;color:${T.mint}">${linesOf(TITLE.b, [4, 3], 9, f, T.mint)}</div></div>
  <img class="abs" src="${W}/take-17-cut.png" style="left:${left}px;top:${top}px;width:${1080 * s}px">
  ${wm > 0 ? `<img class="abs" src="${BRAND}/makeyourmindup-horizontal.png" style="left:96px;width:420px;top:${140 + (1 - wm) * 20}px;opacity:${wm}">` : ''}`
}

// Title frames
const tA = [[landAt(2) + 2, 'build-w3'], [landAt(7) + 3, 'build-w8'], [landAt(12) + 3, 'build-w13'], [LAST + 1, 'last-word'], [LAST + 4, 'takes-frame-f4'], [LAST + 30, 'full-1s'], [LAST + 58, 'leaves-1.9s']]
tA.forEach(([f, n], i) => add(`T-A${i + 1}-tall-${n}`, 1080, 1920, titleA_tall(f)))
add('T-A8-wide-build-w8', 1920, 1080, titleA_wide(landAt(7) + 3))
add('T-A9-wide-build-w13', 1920, 1080, titleA_wide(landAt(12) + 3))
add('T-A10-wide-full-1s', 1920, 1080, titleA_wide(LAST + 30))
add('T-B1-tall-build-w13', 1080, 1920, titleB_tall(landAt(12) + 3))
add('T-B2-tall-full-1s', 1080, 1920, titleB_tall(LAST + 30))
add('T-B3-wide-full-1s', 1920, 1080, titleB_wide(LAST + 30))
add('T-C1-tall-build-w8', 1080, 1920, titleC_tall(landAt(7) + 3))
add('T-C2-tall-full-1s', 1080, 1920, titleC_tall(LAST + 30))

// ---- the outro ----
// Tall close, at most 2.0 s = 60 frames (closes.statement_beat; Krish 19 Nov: the 9:16 sting with "Built to help you
// decide." layered on). c 0-29: the sting's frames 1-44 at 1.5x; c 30-59: hold on its settled band (frame 48).
const stingFrame = c => c < 30 ? 1 + Math.round(c * 43 / 29) : 48
const lineInk = (c, start, { size = 92, accent = 150, colour = T.ink, centre = true } = {}) => {
  const p1 = HERO(prog(c, start, 10)), p2 = HERO(prog(c, start + 6, 10))
  const fn1 = x => (1 - HERO(prog(x, start, 10))) * 500, fn2 = x => (1 - HERO(prog(x, start + 6, 10))) * 500
  return `<div style="text-align:${centre ? 'center' : 'left'}"><div class="display" style="font-size:${size}px;color:${colour};transform:translateX(${(1 - p1) * 500}px);opacity:${p1 > 0 ? 1 : 0};filter:blur(${blurOf(fn1, c)}px)">Built to help you</div>
  <div class="accent" style="font-size:${accent}px;color:${colour};font-weight:560;margin-top:-6px;transform:translateX(${(1 - p2) * 500}px);opacity:${p2 > 0 ? 1 : 0};filter:blur(${blurOf(fn2, c)}px)">decide.</div></div>`
}
const action = (c, start, { onInk = false } = {}) => {
  const p = UTIL(prog(c, start, 8))
  return `<div style="display:flex;justify-content:center;gap:18px;align-items:center;opacity:${p};transform:translateY(${(1 - p) * 14}px)">
    <span class="eyebrow" style="font-size:30px;background:${onInk ? T.mint : T.ink};color:${onInk ? T.ink : T.cream};padding:12px 22px;border-radius:40px;letter-spacing:.1em">Subscribe free</span>
    <span class="data" style="font-size:26px;color:${onInk ? T.cream : T.ink}">makeyourmindup.ai</span></div>`
}
// Direction A (recommended): the band lifts, the line lands under it, all inside the tall core box (y 330 to 1180).
function outroA_tall(c) {
  const lift = HERO(prog(c, 30, 12))
  return `<div class="abs" style="inset:0;background:${T.coral}"></div>
  <img class="abs" src="${SF('tall', stingFrame(c))}" style="left:0;top:${-330 * lift}px;width:1080px">
  <div class="abs" style="left:120px;right:260px;top:${860}px">${lineInk(c, 34, { size: 96, accent: 176 })}</div>
  <div class="abs" style="left:120px;right:260px;top:1120px">${action(c, 46)}</div>`
}
// Direction B: a second band. The sting's ink band holds; a cream band carrying the line slams in from the right
// above it, the way the title's second band does, so the open and the close rhyme.
function outroB_tall(c) {
  const p = HERO(prog(c, 32, 10)), fn = x => (1 - HERO(prog(x, 32, 10))) * 1000
  return `<div class="abs" style="inset:0;background:${T.coral}"></div>
  <img class="abs" src="${SF('tall', stingFrame(c))}" style="left:0;top:40px;width:1080px">
  <div class="abs" style="right:0;top:400px;width:900px;transform:translateX(${(1 - p) * 1000}px) rotate(-4deg);transform-origin:right center;filter:blur(${blurOf(fn, c)}px)">
    <div style="background:${T.cream};padding:26px 120px 30px 60px;box-shadow:14px 14px 0 ${T.ink}">
      <div class="display" style="font-size:84px;color:${T.ink};line-height:.95">Built to help you <span class="accent" style="font-size:104px;text-transform:none;font-weight:560">decide.</span></div></div></div>
  <div class="abs" style="left:120px;right:260px;top:1210px;opacity:0">${action(c, 46)}</div>
  <div class="abs" style="left:0;right:0;top:360px;display:flex;justify-content:center">${''}</div>
  <div class="abs" style="left:120px;right:260px;top:${330}px">${action(c, 44)}</div>`
}
// Direction C: the words take the sting's slabs. After MIND, each word of the line arrives on its own colour slab,
// at the sting's own rhythm, and the band closes it.
function outroC_tall(c) {
  const words = [['Built', T.lilac], ['to help', T.mint], ['you', T.coral]]
  if (c < 22) return `<img class="abs" src="${SF('tall', 1 + Math.round(c * 34 / 21))}" style="left:0;top:0;width:1080px">`
  const k = Math.floor((c - 22) / 8)
  if (k < 3) { const [w, bg] = words[k]; const p = HERO(prog(c, 22 + k * 8, 6))
    return `<div class="abs" style="inset:0;background:${bg}"></div><div class="abs display" style="left:0;right:0;top:${760 + (1 - p) * 0}px;text-align:center;font-size:250px;color:${T.ink};transform:translateX(${(1 - p) * 400}px) rotate(-4deg)">${w}</div>` }
  return `<div class="abs" style="inset:0;background:${T.coral}"></div><img class="abs" src="${SF('tall', 48)}" style="left:0;top:-330px;width:1080px">
    <div class="abs accent" style="left:0;right:0;top:880px;text-align:center;font-size:200px;color:${T.ink};font-weight:560">decide.</div>
    <div class="abs" style="left:120px;right:260px;top:1110px">${action(c, 50)}</div>`
}
// Wide close (closes.statement_card, held 5 to 20 s for YouTube's end-screen elements): the sting plays (1.87 s), its band
// shrinks to the masthead slot as an ink ground slides in from the right (12 f hero); settled by 2.75 s; the right
// 44% is left clear for the end-screen elements YouTube draws (dashed guides here only).
const endScreenGuides = `<div class="abs" style="left:1100px;top:150px;width:700px;height:394px;border:3px dashed rgba(244,239,228,.25);border-radius:14px"></div>
  <div class="abs" style="left:1100px;top:580px;width:700px;height:300px;border:3px dashed rgba(244,239,228,.25);border-radius:14px"></div>
  <div class="abs data" style="left:1120px;top:170px;font-size:18px;opacity:.4">END-SCREEN ELEMENT (YOUTUBE DRAWS IT)</div>`
function outroA_wide(t) { // t in frames from the start of the close
  if (t < 48) return `<img class="abs" src="${SF('wide', t + 1)}" style="left:0;top:0;width:1920px">`
  const p = HERO(prog(t, 48, 12)), l = HERO(prog(t, 54, 12)), a = UTIL(prog(t, 66, 10))
  return `<div class="abs" style="inset:0;background:${T.coral}"></div>
  <div class="abs" style="inset:0;background:${T.ink};clip-path:inset(0 0 0 ${(1 - p) * 1920}px)"><div class="grain"></div></div>
  <img class="abs" src="${BAND_W}" style="left:0;top:0;width:1920px;transform:translate(${-80 * p}px, ${-110 * p}px) scale(${1 - 0.5 * p});transform-origin:0 0">
  <div class="abs" style="left:120px;top:400px;width:920px;opacity:${l};transform:translateX(${(1 - l) * 300}px)">
    <div class="display" style="font-size:120px;color:${T.cream}">Built to help you</div>
    <div class="accent" style="font-size:180px;color:${T.coral};font-weight:560;margin-top:-10px">decide.</div></div>
  <div class="abs" style="left:120px;top:850px;opacity:${a};display:flex;gap:20px;align-items:center">
    <span class="eyebrow" style="font-size:32px;background:${T.mint};color:${T.ink};padding:14px 26px;border-radius:40px;letter-spacing:.1em">Subscribe free</span><span class="data" style="font-size:28px">makeyourmindup.ai</span><span class="data" style="font-size:24px;margin-left:30px;letter-spacing:.12em"><span style="color:${T.butter}">MONDAYS</span> · <span style="color:${T.lilac}">WEDNESDAYS</span> · <span style="color:${T.coral}">FRIDAYS</span></span></div>
  ${p >= 1 ? endScreenGuides : ''}`
}
function outroB_wide() { // stays on the sting's own coral: line in ink, band top-left
  return `<div class="abs" style="inset:0;background:${T.coral}"></div><div class="grain"></div>
  <img class="abs" src="${BAND_W}" style="left:0;top:0;width:1920px;transform:translate(-80px, -110px) scale(.5);transform-origin:0 0">
  <div class="abs" style="left:120px;top:400px;width:920px"><div class="display" style="font-size:120px;color:${T.ink}">Built to help you</div>
    <div class="accent" style="font-size:180px;color:${T.ink};font-weight:560;margin-top:-10px">decide.</div></div>
  <div class="abs" style="left:120px;top:850px;display:flex;gap:20px;align-items:center"><span class="eyebrow" style="font-size:32px;background:${T.ink};color:${T.cream};padding:14px 26px;border-radius:40px;letter-spacing:.1em">Subscribe free</span><span class="data" style="font-size:28px;color:${T.ink}">makeyourmindup.ai</span><span class="data" style="font-size:24px;margin-left:30px;letter-spacing:.12em;color:${T.ink}">MONDAYS · WEDNESDAYS · FRIDAYS</span></div>
  ${endScreenGuides.replace(/244,239,228,\.25/g, '12,21,18,.3').replace('opacity:.4', 'opacity:.5;color:#0C1512')}`
}
function outroC_wide() { // today's statement card, refined only: one cut to ink, no sting
  return `<div class="abs" style="inset:0;background:radial-gradient(90% 90% at 30% 40%, #13221c, ${T.inkDeep} 70%)"></div><div class="grain"></div>
  <img class="abs" src="${BRAND}/makeyourmindup-stacked.png" style="left:120px;top:110px;width:380px">
  <div class="abs" style="left:120px;top:400px;width:920px"><div class="display" style="font-size:120px">Built to help you</div>
    <div class="accent" style="font-size:180px;color:${T.coral};font-weight:560;margin-top:-10px">decide.</div></div>
  <div class="abs" style="left:120px;top:850px;display:flex;gap:20px;align-items:center"><span class="eyebrow" style="font-size:32px;background:${T.mint};color:${T.ink};padding:14px 26px;border-radius:40px;letter-spacing:.1em">Subscribe free</span><span class="data" style="font-size:28px">makeyourmindup.ai</span><span class="data" style="font-size:24px;margin-left:30px;letter-spacing:.12em"><span style="color:${T.butter}">MONDAYS</span> · <span style="color:${T.lilac}">WEDNESDAYS</span> · <span style="color:${T.coral}">FRIDAYS</span></span></div>
  ${endScreenGuides}`
}
;[[6, 'sting-1.5x-f6'], [22, 'sting-1.5x-f22'], [33, 'band-lifts'], [40, 'line-lands'], [59, 'settled-2.0s']].forEach(([c, n], i) => add(`O-A${i + 1}-tall-${n}`, 1080, 1920, outroA_tall(c)))
;[[38, 'band-2-arrives'], [59, 'settled-2.0s']].forEach(([c, n], i) => add(`O-B${i + 1}-tall-${n}`, 1080, 1920, outroB_tall(c)))
;[[31, 'word-on-slab'], [59, 'settled-2.0s']].forEach(([c, n], i) => add(`O-C${i + 1}-tall-${n}`, 1080, 1920, outroC_tall(c)))
;[[30, 'sting'], [54, 'ink-slides-in'], [83, 'settled-2.75s']].forEach(([t, n], i) => add(`O-A${i + 6}-wide-${n}`, 1920, 1080, outroA_wide(t)))
add('O-B3-wide-settled', 1920, 1080, outroB_wide())
add('O-C3-wide-settled', 1920, 1080, outroC_wide())
add('O-before-tall-current-close', 1080, 1920, `<img class="abs" src="${W}/close-before-tall.png" style="width:1080px">`)
add('O-before-wide-current-close', 1920, 1080, `<img class="abs" src="${W}/close-before-wide.png" style="width:1920px">`)
add('T-before-tall-current-title', 1080, 1920, `<img class="abs" src="${STILL}/band-short/still-00681.png" style="width:1080px">`)

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
