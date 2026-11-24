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

// ---- frames ----
const frames = []
const add = (name, w, h, body, extra) => frames.push({ name, w, h, html: page(w, h, body, extra) })

// 1. Type system, in situ
add('01-type-system', 1080, 1920, `
<div class="abs" style="inset:0;background:${T.inkDeep}"></div><div class="grain"></div>
<div class="abs" style="left:96px;top:110px;right:96px">
  <div class="data" style="font-size:20px;color:${T.mint}">DISPLAY · ANTON 400 · CAPS · TRACK +0.005EM · LEAD 0.88</div>
  <div class="display" style="font-size:270px;margin-top:18px">$195,000</div>
  <div class="data" style="font-size:20px;color:${T.mint};margin-top:84px">EDITORIAL ACCENT · FRAUNCES ITALIC 420 · OPSZ 144 · SOFT 60 · ONE PER FRAME</div>
  <div class="accent" style="font-size:124px;margin-top:14px;color:${T.coral}">one careful read</div>
  <div class="data" style="font-size:20px;color:${T.mint};margin-top:84px">EYEBROW · ARCHIVO WDTH 62 · 720 · CAPS · TRACK +0.14EM</div>
  <div class="eyebrow" style="font-size:42px;margin-top:16px;color:${T.coral}">The bill · 29 Oct 2025 · 5 lines</div>
  <div class="data" style="font-size:20px;color:${T.mint};margin-top:84px">DATA · IBM PLEX MONO 500 · TRACK +0.06EM · HAIRLINES 2PX CREAM 18%</div>
  <div style="margin-top:14px">
    ${[['Pharmacy', '38,915.40'], ['Imaging', '33,120.00'], ['Supplies, misc.', '54,080.50']].map(([a, b]) => `<div class="data" style="display:flex;justify-content:space-between;font-size:32px;padding:18px 0;border-bottom:2px solid rgba(244,239,228,.18)"><span>${a}</span><span>${b}</span></div>`).join('')}
  </div>
  <div class="data" style="font-size:20px;color:${T.mint};margin-top:84px">CAPTIONS (UNCHANGED, DECOUPLED) · ARCHIVO 900 · WDTH 112 · 68PX</div>
  <div style="margin-top:18px"><span class="caption" style="font-size:68px;background:${T.ink};padding:16px 30px 20px;box-shadow:10px 10px 0 ${T.coral};display:inline-block">line by line</span></div>
  <div class="data" style="font-size:20px;color:${T.mint};margin-top:72px">THE PAIRING ON ONE CARD</div>
  <div style="margin-top:16px;background:linear-gradient(160deg,#13201b, ${T.ink});border:2px solid rgba(244,239,228,.1);border-radius:22px;padding:34px 36px">
    <div style="display:flex;justify-content:space-between"><span class="eyebrow" style="font-size:26px;color:${T.coral}">Mind the gap · the bill</span><span class="data" style="font-size:20px;opacity:.6">FRI 20 NOV</span></div>
    <div class="display" style="font-size:150px;margin-top:14px">Owed: <span style="color:${T.mint}">$0</span></div>
    <div class="accent" style="font-size:52px;margin-top:10px;opacity:.9">after one careful read</div>
  </div>
</div>`)

// 2. Title moment: before (current), then after at three phases.
// Timeline (frames at 30 fps): band 1 enters from the left over 10 f (hero), connector fades up f 8-14,
// band 2 enters from the right f 12-22 (hero), wordmark rises f 20-30 (utility), holds full frame <= 2 s.
function titleAfter(f) {
  const b1 = HERO(prog(f, 0, 10)), b2 = HERO(prog(f, 12, 10)), cn = UTIL(prog(f, 8, 6)), wm = UTIL(prog(f, 20, 10))
  const b1x = (1 - b1) * -1100, b2x = (1 - b2) * 1100
  const bl1 = blurOf(x => (1 - HERO(prog(x, 0, 10))) * -1100, f), bl2 = blurOf(x => (1 - HERO(prog(x, 12, 10))) * 1100, f)
  const bars = Array.from({ length: 30 }, (_, i) => { const h = 160 + 520 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)); return `<div class="abs" style="left:${20 + i * 35}px;top:${960 - h / 2}px;width:12px;height:${h}px;border-radius:6px;background:${T.mint};opacity:.13"></div>` }).join('')
  return `<div class="abs" style="inset:0;background:radial-gradient(120% 70% at 50% 45%, #10201a 0%, ${T.inkDeep} 70%)"></div>${bars}<div class="grain"></div>
  <div class="abs" style="left:0;top:330px;width:860px;transform:translateX(${b1x}px) rotate(-3deg);transform-origin:left center;filter:blur(${bl1}px)">
    <div style="background:${T.cream};padding:30px 40px 34px 96px;box-shadow:14px 14px 0 ${T.coral}">
      <div class="display" style="font-size:108px;line-height:.94;color:${T.ink}">So will your<br>AI auditor find<br>missing money</div></div></div>
  <div class="abs accent" style="left:0;right:0;top:660px;text-align:center;font-size:120px;color:${T.mint};opacity:${cn};font-weight:520">or</div>
  <div class="abs" style="right:0;top:800px;width:860px;transform:translateX(${b2x}px) rotate(-3deg);transform-origin:right center;filter:blur(${bl2}px)">
    <div style="background:${T.mint};padding:30px 120px 34px 60px;box-shadow:14px 14px 0 ${T.coral}">
      <div class="display" style="font-size:108px;line-height:.94;color:${T.ink}">will it find<br>skeletons in<br>your closet?</div></div></div>
  <img class="abs" src="${BRAND}/makeyourmindup-stacked.png" style="left:290px;width:500px;top:${1260 + (1 - wm) * 40}px;opacity:${wm}">`
}
add('02a-title-before', 1080, 1920, `<img class="abs" src="${STILL}/band-short/still-00681.png" style="inset:0;width:1080px">`)
add('02b-title-after-f06', 1080, 1920, titleAfter(6))
add('02c-title-after-f16', 1080, 1920, titleAfter(16))
add('02d-title-after-settled', 1080, 1920, titleAfter(40))

// 3. Card animation: the horizontal slide system in the band staging.
// Outgoing card leads (exit starts 6 f before the handover, exit bezier, 8 f, to -35% and dims to 0.15);
// incoming rows enter from the right, 14 f hero, staggered 3 f, overlap the outgoing by its last 2 f.
function cardsAfter(f) {
  const ex = EXIT(prog(f, -6, 8))
  const outX = -0.35 * 1080 * ex, outDim = 1 - 0.85 * ex
  const outBlur = blurOf(x => -0.35 * 1080 * EXIT(prog(x, -6, 8)), f)
  const rows = ['Subscriptions', 'Invoices', 'Old bills']
  const rowHtml = rows.map((r, i) => {
    const p = HERO(prog(f, i * 3, 14)); const fn = x => (1 - HERO(prog(x, i * 3, 14))) * 1100
    return `<div class="abs" style="left:96px;right:96px;top:${300 + i * 200}px;height:176px;transform:translateX(${(1 - p) * 1100}px);filter:blur(${blurOf(fn, f)}px);opacity:${p > 0 ? 1 : 0}">
      <div style="height:100%;background:${T.cream};color:${T.ink};border-radius:20px;display:flex;align-items:center;padding:0 40px;gap:30px">
        <span class="data" style="font-size:26px;opacity:.55">0${i + 1}</span><span class="display" style="font-size:88px;flex:1">${r}</span>
        <svg width="54" height="54" viewBox="0 0 54 54"><circle cx="27" cy="27" r="25" fill="${T.ink}"/><path d="M15 28 l8 8 l16 -18" stroke="${T.mint}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="40" stroke-dashoffset="${40 * (1 - UTIL(prog(f, i * 3 + 12, 8)))}"/></svg>
      </div></div>`
  }).join('')
  const ey = UTIL(prog(f, 2, 10))
  return `${bandTake()}
  <div class="abs" style="left:0;top:0;width:1080px;height:${PANEL_H}px;background:${T.ink};overflow:hidden">
    <div class="abs" style="inset:0;background:radial-gradient(90% 60% at 30% 0%, #15241e, ${T.ink} 70%)"></div><div class="grain"></div>
    <div class="abs" style="left:96px;top:260px;transform:translateX(${outX}px);filter:brightness(${outDim}) blur(${outBlur}px);opacity:${f < 4 ? 1 : 0}">${billCard({ w: 560 })}</div>
    <div class="abs" style="left:96px;right:96px;top:196px;display:flex;justify-content:space-between;opacity:${ey};transform:translateX(${(1 - ey) * 40}px)">
      <span class="eyebrow" style="font-size:32px;color:${T.coral}">What he checked</span><span class="data" style="font-size:22px;opacity:.6">3 PILES · 1 EVENING</span></div>
    ${rowHtml}
  </div>${seamCaption('archives right now')}`
}
add('03a-card-before', 1080, 1920, `<img class="abs" src="${STILL}/band-short/still-00389.png" style="inset:0;width:1080px">`)
add('03b-card-after-f00', 1080, 1920, cardsAfter(0))
add('03c-card-after-f05', 1080, 1920, cardsAfter(5))
add('03d-card-after-settled', 1080, 1920, cardsAfter(30))

// 4. Photography: cinematic strips (2.39:1) sliding in alternately from right and left, with parallax inside the mask.
function photosAfter(f) {
  const srcs = [`${PH}/nal-1.jpg`, `${PH}/nal-2.jpg`, `${PH}/nal-3.jpg`]
  const H = 250, gap = 14, top0 = 120
  const strips = srcs.map((s, i) => {
    const dir = i % 2 === 0 ? 1 : -1; const st = i * 4
    const p = HERO(prog(f, st, 16)); const fn = x => dir * (1 - HERO(prog(x, st, 16))) * 1080
    const off = dir * (1 - p) * 1080
    return `<div class="abs" style="left:0;width:1080px;top:${top0 + i * (H + gap)}px;height:${H}px;overflow:hidden;transform:translateX(${off}px);filter:blur(${blurOf(fn, f)}px)">
      <img src="${s}" style="position:absolute;width:1300px;left:${-110 - off * 0.4}px;top:${-[420, 520, 600][i]}px;filter:saturate(.9) contrast(1.05)"></div>`
  }).join('')
  const chip = UTIL(prog(f, 18, 8))
  return `${bandTake(`${W}/take-23.png`, { faceX: 680, eyeY: 880 })}
  <div class="abs" style="left:0;top:0;width:1080px;height:${PANEL_H}px;background:${T.inkDeep};overflow:hidden">${strips}
    <div class="abs data" style="left:96px;top:66px;font-size:21px;opacity:${chip * 0.7}">NÄL HOSPITAL, SWEDEN · PHOTO CC0 · WIKIMEDIA COMMONS</div></div>
  ${seamCaption('every hospital')}`
}
add('04a-photo-after-f04', 1080, 1920, photosAfter(4))
add('04b-photo-after-f10', 1080, 1920, photosAfter(10))
add('04c-photo-after-settled', 1080, 1920, photosAfter(40))

// 5. Wires: evidence connected by thin curved wires that draw on (10 f, utility), a pulse travels the answer wire once.
function wiresAfter(f) {
  const n1 = HERO(prog(f, 0, 14)), n2 = HERO(prog(f, 8, 14)), n3 = HERO(prog(f, 20, 14))
  const w1 = UTIL(prog(f, 14, 10)), w2 = UTIL(prog(f, 26, 10))
  const d1 = 'M 592 300 C 640 300, 612 470, 660 470', d2 = 'M 840 628 C 840 740, 740 790, 632 790'
  const pulse = prog(f, 36, 18)
  const pt = pulse > 0 && pulse < 1 ? (() => { const t = UTIL(pulse); const P = [[840, 628], [840, 740], [740, 790], [632, 790]]; const b = (a, b, c, d) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d; return { x: b(P[0][0], P[1][0], P[2][0], P[3][0]), y: b(P[0][1], P[1][1], P[2][1], P[3][1]) } })() : null
  return `${bandTake()}
  <div class="abs" style="left:0;top:0;width:1080px;height:${PANEL_H}px;background:${T.ink};overflow:hidden">
    <div class="abs" style="inset:0;background-image:radial-gradient(rgba(244,239,228,.07) 1.5px, transparent 1.6px);background-size:36px 36px"></div><div class="grain"></div>
    <div class="abs" style="left:72px;top:72px;transform:translateX(${(1 - n1) * -700}px)">${billCard({ w: 520 })}</div>
    <div class="abs" style="left:660px;top:360px;transform:translateX(${(1 - n2) * 700}px)">${readCard(360)}</div>
    <div class="abs" style="left:72px;top:660px;transform:translateX(${(1 - n3) * -800}px)">${resultCard(560)}</div>
    <svg class="abs" style="left:0;top:0" width="1080" height="${PANEL_H}">${wireDefs}
      ${w1 > 0 ? wire(d1, 230, w1, T.cream) + port(592, 300) : ''}${w1 >= 1 ? port(660, 470) : ''}
      ${w2 > 0 ? wire(d2, 300, w2, T.mint, { pt }) + port(840, 628, T.mint) : ''}${w2 >= 1 ? port(632, 790, T.mint) : ''}
    </svg>
  </div>${seamCaption('line by line')}`
}
add('05a-wires-after-f30', 1080, 1920, wiresAfter(30))
add('05b-wires-after-f44', 1080, 1920, wiresAfter(44))

// 6. Duotone cut-out (GETOUT): his cut-out mapped to plum-to-peach, blended into the day's colour, ink type, wordmark in an ink label.
add('06-duotone-cutout-cover', 1080, 1920, `
<div class="abs" style="inset:0;background:${T.coral}"></div>
<div class="abs" style="inset:0;background:radial-gradient(70% 45% at 70% 70%, rgba(255,180,143,.35), transparent 70%)"></div>
<img class="abs" src="${W}/k23-duo-ember.png" style="left:-270px;top:-130px;width:1500px">
<div class="grain" style="opacity:.1"></div>
<div class="abs" style="left:96px;top:250px;right:96px">
  <div class="eyebrow" style="font-size:30px;color:${T.ink}">Mind the gap</div>
  <div class="display" style="font-size:150px;color:${T.ink};margin-top:14px;line-height:.93">AI cut a<br>$195,000<br>hospital bill</div>
  <div class="data" style="font-size:24px;color:${T.ink};margin-top:26px;display:flex;gap:18px;align-items:center"><span>FRI 20 NOV 2026</span></div>
</div>
<div class="abs" style="left:96px;top:1420px;background:${T.ink};padding:26px 30px">
  <img src="${BRAND}/makeyourmindup-stacked.png" style="width:330px;display:block"></div>`)

// 7. Big moment, full frame: the giant number on the ember-to-plum gradient (<= 2 s, no captions while it holds).
// Ground wipes in from the right with a feathered edge (8 f, utility); the number settles 1.06 -> 1.0 (10 f, hero);
// accent fades up f 8-16; leaves by wiping to the left in 6 f (exit).
function bigFull(f) {
  const g = UTIL(prog(f, 0, 8)), n = HERO(prog(f, 3, 10)), a = UTIL(prog(f, 8, 8))
  const edge = (1 - g) * 1200
  return `${bandTake()}
  <div class="abs" style="left:0;top:0;width:1080px;height:${PANEL_H}px;background:${T.ink}"></div>
  <div class="abs" style="inset:0;clip-path:inset(0 0 0 ${edge}px)"><div class="abs" style="inset:0;background:${EMBER_GRADIENT}"></div>
    <div class="abs" style="inset:0;background:radial-gradient(60% 30% at 50% 40%, rgba(255,160,120,.35), transparent 70%)"></div><div class="grain" style="opacity:.09"></div></div>
  <div class="abs" style="left:0;right:0;top:520px;text-align:center;opacity:${n};transform:scale(${1.06 - 0.06 * n})">
    <div class="eyebrow" style="font-size:32px;color:${T.plum}">Taken off one family's bill</div>
    <div class="display" style="font-size:312px;color:${T.plum};margin-top:12px;letter-spacing:-.01em">$195,000</div></div>
  <div class="abs accent" style="left:0;right:0;top:930px;text-align:center;font-size:76px;color:${T.cream};opacity:${a}">by one careful read</div>
  <div class="abs data" style="left:0;right:0;top:1100px;text-align:center;font-size:22px;color:${T.cream};opacity:${a * 0.7}">TOM'S HARDWARE · 29 OCT 2025</div>`
}
add('07a-moment-before', 1080, 1920, `<img class="abs" src="${STILL}/band-short/still-00097.png" style="inset:0;width:1080px">`)
add('07b-moment-full-f04', 1080, 1920, bigFull(4))
add('07c-moment-full-settled', 1080, 1920, bigFull(24))

// 8. Big moment behind him, through the matte (anchor staging): the ground replaces his wall, the number sits behind
// his head (head over at most the lower 20% of the letters, never anything over his face).
function bigMatte(f) {
  const g = UTIL(prog(f, 0, 8)), n = HERO(prog(f, 3, 12))
  const s = 1.15, left = 540 - 640 * s, top = 800 - 880 * s
  return `<img class="abs" src="${W}/take-17.png" style="left:${left}px;top:${top}px;width:${1080 * s}px">
  <div class="abs" style="inset:0;clip-path:inset(0 0 0 ${(1 - g) * 1200}px)"><div class="abs" style="inset:0;background:${EMBER_GRADIENT}"></div><div class="grain" style="opacity:.09"></div></div>
  <div class="abs" style="left:0;right:0;top:400px;text-align:center;transform:translateX(${(1 - n) * 220}px);opacity:${n}">
    <div class="display" style="font-size:262px;color:${T.plum};letter-spacing:-.01em">$195,000</div></div>
  <img class="abs" src="${W}/take-17-cut.png" style="left:${left}px;top:${top}px;width:${1080 * s}px">
  <div class="abs data" style="left:0;right:0;text-align:center;top:340px;font-size:22px;color:${T.cream};opacity:${n * 0.75}">TOM'S HARDWARE · 29 OCT 2025</div>`
}
add('08a-moment-matte-before', 1080, 1920, `<img class="abs" src="${STILL}/anchor-short/still-00097.png" style="inset:0;width:1080px">`)
add('08b-moment-matte-settled', 1080, 1920, bigMatte(24))

// 9. Face-led cover (his own accounts), refined, inside its rule 5 (no gradient, no glow): near-black, measured grid.
add('09-cover-face-led', 1080, 1920, `
<div class="abs" style="inset:0;background:${T.inkDeep}"></div><div class="grain"></div>
<img class="abs" src="${W}/take-23-cut.png" style="left:86px;top:270px;width:1134px">
<div class="abs" style="left:96px;top:300px;width:820px">
  <div class="eyebrow" style="font-size:30px;color:${T.coral}">Mind the gap</div>
  <div class="display" style="font-size:146px;margin-top:16px;line-height:.93">AI cut a<br><span style="color:${T.coral}">$195,000</span><br>hospital bill</div>
  <img src="${BRAND}/makeyourmindup-stacked.png" style="width:300px;display:block;margin-top:40px">
</div>
<div class="abs" style="left:96px;top:960px;transform:rotate(-3deg);transform-origin:left top">${billCard({ w: 400 })}</div>`)

// 10. Receipt cover (brand accounts), refined: the proof leads with the headline, hairline data, grain.
add('10-cover-receipt', 1080, 1920, `
<div class="abs" style="inset:0;background:radial-gradient(110% 60% at 50% 30%, #13221c, ${T.inkDeep} 75%)"></div><div class="grain"></div>
<div class="abs" style="left:96px;top:300px;width:888px">
  <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="eyebrow" style="font-size:30px;color:${T.coral}">Mind the gap</span><span class="data" style="font-size:22px;opacity:.6">FRI 20 NOV 2026</span></div>
  <div class="display" style="font-size:150px;margin-top:20px;line-height:.93">AI cut a <span style="color:${T.coral}">$195,000</span> hospital bill</div>
</div>
<div class="abs" style="left:150px;top:830px;transform:rotate(-2deg)">${billCard({ w: 780 }).replace(/font-size:20px/g, 'font-size:30px').replace(/font-size:19px/g, 'font-size:26px').replace(/font-size:22px/g, 'font-size:30px').replace('font-size:54px', 'font-size:90px')}</div>
<div class="abs" style="left:0;right:0;top:1560px;display:flex;justify-content:center"><img src="${BRAND}/makeyourmindup-stacked.png" style="width:360px"></div>`)

// 11. Wide thumbnail (1280 x 720), refined: no logo (palette), headline left, the proof right.
add('11-thumbnail-wide', 1280, 720, `
<div class="abs" style="inset:0;background:radial-gradient(90% 90% at 75% 40%, #15251f, ${T.inkDeep} 70%)"></div><div class="grain"></div>
<div class="abs" style="left:72px;top:150px;width:720px">
  <div class="eyebrow" style="font-size:24px;color:${T.coral}">Mind the gap</div>
  <div class="display" style="font-size:128px;margin-top:12px;line-height:.93">AI cut a<br><span style="color:${T.coral}">$195,000</span><br>hospital bill</div></div>
<div class="abs" style="left:790px;top:110px;transform:rotate(3deg) scale(1.02);transform-origin:left top">${billCard({ w: 430 })}</div>`)

// 12. Big moment at 16:9 (1920 x 1080), stage staging: the panel takes the gradient; he stays on screen.
add('12-moment-wide', 1920, 1080, `
<div class="abs" style="inset:0;background:#d9d6d2"></div>
<img class="abs" src="${W}/takew-9.png" style="left:1150px;top:-120px;width:900px">
<div class="abs" style="left:48px;top:48px;width:1300px;height:820px;border-radius:28px;overflow:hidden"><div class="abs" style="inset:0;background:${EMBER_GRADIENT.replace('180deg', '160deg')}"></div><div class="grain" style="opacity:.09"></div>
  <div class="abs" style="left:0;right:0;top:170px;text-align:center"><div class="eyebrow" style="font-size:30px;color:${T.plum}">Taken off one family's bill</div>
  <div class="display" style="font-size:300px;color:${T.plum};margin-top:8px">$195,000</div>
  <div class="accent" style="font-size:66px;color:${T.cream};margin-top:22px">by one careful read</div></div>
  <div class="abs data" style="left:56px;bottom:40px;font-size:20px;color:${T.cream};opacity:.7">TOM'S HARDWARE · 29 OCT 2025</div></div>`)

;(async () => {
  const browser = await chromium.launch()
  const only = process.argv[2]
  for (const fr of frames) {
    if (only && !fr.name.startsWith(only)) continue
    const file = path.join(HTML, fr.name + '.html'); fs.writeFileSync(file, fr.html)
    const p = await browser.newPage({ viewport: { width: fr.w, height: fr.h } })
    await p.goto('file://' + file); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150)
    await p.screenshot({ path: path.join(OUT, fr.name + '.png') }); await p.close()
    console.log('wrote', fr.name)
  }
  await browser.close()
})()
