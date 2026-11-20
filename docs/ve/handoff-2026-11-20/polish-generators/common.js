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

