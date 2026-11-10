// v1, flat: not yet at the bar Krish set for the Ladder on 10 Nov 2026 ("significantly more premium"); to be rebuilt
// to that bar before he sees it.
// The Living Screen: a real-looking product interface, rebuilt in code so it performs on cue. The camera locks to
// the part being spoken about; a cursor clicks, counts run, the chart draws itself. Draws frame t from t alone.
import { clamp, lerp, text } from '../_core/house.mjs'

const VIEW = { tall: [40, 330, 820, 820], wide: [160, 100, 1600, 820] } // where the screen is shown on the canvas
const UI = { w: 1200, h: 900 }
const B = { hook: 0, y1988: 1, y2004: 2, expect: 3, didnt: 4, same: 5, talk: 6, two: 7, watch: 8, ask: 9 }
// Camera targets in UI space [x, y, w, h], per beat.
const CAM = {
  full: [0, 0, 1200, 900], cardA: [215, 70, 330, 220], cardB: [560, 70, 330, 220], cardC: [880, 70, 320, 220],
  chart: [215, 300, 985, 580], side: [0, 40, 560, 520],
}
const SHOTS = [
  [B.hook, 'full'], [B.y1988, 'cardA'], [B.expect, 'chart'], [B.didnt, 'cardB', 'opened'], [B.same, 'cardC'],
  [B.talk, 'side'], [B.two, 'chart'], [B.ask, 'full'],
]

const at = (env, b, word) => (word ? env.word(b, word).s : env.beat(b).s)

function camera(env, t) {
  let from = CAM.full, to = CAM.full, t0 = 0
  for (const [b, key, word] of SHOTS) {
    const s = at(env, b, word) - 0.25
    if (t >= s) { from = to; to = CAM[key]; t0 = s }
  }
  const k = env.ease.hero(clamp((t - t0) / 0.9))
  return from.map((v, i) => lerp(v, to[i], k))
}

function rr(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r)
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke() }
}

function cursorPath(env) {
  return [
    [0.0, 1250, 950], [2.2, 120, 220], [at(env, B.y1988, 'city'), 380, 200], [at(env, B.didnt, 'opened') - 0.4, 120, 160],
    [at(env, B.didnt, 'opened'), 120, 160], [at(env, B.didnt, 'Forty-three'), 720, 210], [at(env, B.same, 'stayed'), 1040, 220],
    [at(env, B.talk) + 0.2, 120, 240], [at(env, B.talk, 'talking'), 400, 420], [at(env, B.watch), 900, 420],
    [at(env, B.ask, 'pick'), 600, 520], [at(env, B.ask, 'Then'), 700, 640], [env.closeAt, 700, 640],
  ]
}
const CLICKS = (env) => [at(env, B.didnt, 'opened'), at(env, B.talk) + 0.2, at(env, B.ask, 'pick')]

function cursorAt(env, t) {
  const p = cursorPath(env)
  for (let i = 0; i < p.length - 1; i++) {
    if (t >= p[i][0] && t < p[i + 1][0]) {
      const k = env.ease.utility(clamp((t - p[i][0]) / Math.min(0.7, p[i + 1][0] - p[i][0])))
      return [lerp(p[i][1], p[i + 1][1], k), lerp(p[i][2], p[i + 1][2], k)]
    }
  }
  return p.at(-1).slice(1)
}

export function draw(env, ctx, t, house) {
  const c = env.skin.colors
  ctx.fillStyle = c.ink; ctx.fillRect(0, 0, env.W, env.H)
  const [vx, vy, vw, vh] = VIEW[env.shape]
  const [cx, cy, cw, ch] = camera(env, t)
  const s = Math.min(vw / cw, vh / ch)
  const ox = vx + (vw - cw * s) / 2 - cx * s, oy = vy + (vh - ch * s) / 2 - cy * s
  ctx.save(); ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip()
  env.clip = [vx, vy, vw, vh]
  ctx.translate(ox, oy); ctx.scale(s, s)
  const tx = (str, x, y, o) => text(env, ctx, str, x, y, o)
  const kin = env.ease.enter(clamp((t - 0.3) / 0.6))
  ctx.globalAlpha = kin

  // The window and its chrome.
  rr(ctx, 0, 0, UI.w, UI.h, 22, c.inkSoft, c.line)
  ;[0, 1, 2].forEach((i) => { ctx.fillStyle = c.line; ctx.beginPath(); ctx.arc(30 + i * 26, 24, 8, 0, Math.PI * 2); ctx.fill() })
  tx('BRANCH STAFFING', 600, 34, { font: 'IBM Plex Mono', size: 26, weight: 600, color: c.creamSoft, align: 'center', role: 'label' })

  // The sidebar; the selected item follows the cursor's clicks.
  const sel = t >= at(env, B.talk) + 0.2 ? 2 : t >= at(env, B.didnt, 'opened') ? 1 : 0
  ;['Staff', 'Branches', 'Customers'].forEach((name, i) => {
    if (i === sel) rr(ctx, 16, 120 + i * 70, 180, 54, 10, c.ink)
    tx(name, 36, 156 + i * 70, { font: 'Archivo', size: 28, weight: i === sel ? 800 : 500, color: i === sel ? c.cream : c.muted, role: 'label' })
  })

  // Card A: tellers per branch, counted on the card.
  rr(ctx, 230, 80, 300, 200, 16, c.ink, c.line)
  const nA = t < at(env, B.y1988, 'city') ? 0 : t < at(env, B.y2004, 'needed')
    ? Math.round(20 * clamp((t - at(env, B.y1988, 'city')) / (at(env, B.y1988, 'twenty') - at(env, B.y1988, 'city') + 0.2)))
    : Math.round(lerp(20, 13, env.ease.utility(clamp((t - at(env, B.y2004, 'needed')) / 0.6))))
  tx('PER BRANCH', 252, 122, { font: 'IBM Plex Mono', size: 22, weight: 600, color: c.creamSoft, role: 'label' })
  tx(nA ? String(nA) : '', 252, 250, { font: 'Anton', size: 120, color: c.cream, role: 'number' })
  const yr = t >= at(env, B.y2004) ? '2004' : t >= at(env, B.y1988) ? '1988' : ''
  if (yr) { rr(ctx, 418, 100, 96, 38, 19, c.line); tx(yr, 466, 128, { font: 'IBM Plex Mono', size: 24, weight: 600, color: c.cream, align: 'center', role: 'label' }) }

  // Card B: city branches, 7 to 10 (43% more).
  rr(ctx, 575, 80, 300, 200, 16, c.ink, c.line)
  const kB = env.ease.utility(clamp((t - at(env, B.didnt, 'Forty-three')) / 0.8))
  tx('CITY BRANCHES', 597, 122, { font: 'IBM Plex Mono', size: 22, weight: 600, color: c.creamSoft, role: 'label' })
  if (t >= at(env, B.didnt, 'opened')) tx(kB > 0 ? `+${Math.round(43 * kB)}%` : '+0%', 597, 250, { font: 'Anton', size: 120, color: c.cream, role: 'number' })

  // Card C: teller jobs, a level line drawn in mint (mint marks the answer).
  rr(ctx, 895, 80, 290, 200, 16, c.ink, c.line)
  tx('TELLER JOBS', 917, 122, { font: 'IBM Plex Mono', size: 22, weight: 600, color: c.creamSoft, role: 'label' })
  const kC = env.ease.enter(clamp((t - at(env, B.same, 'stayed')) / 0.8))
  if (kC > 0) {
    ctx.strokeStyle = c.mint; ctx.lineWidth = 6; ctx.beginPath()
    for (let i = 0; i <= 40 * kC; i++) { const x = 917 + i * 6, y = 210 + Math.sin(i * 0.9) * 3; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
    ctx.stroke()
    tx('LEVEL', 917, 262, { font: 'IBM Plex Mono', size: 26, weight: 700, color: c.mint, alpha: kC, role: 'label' })
  }

  // The chart: an expected line diving to zero, then the two lines that really moved.
  rr(ctx, 230, 310, 955, 560, 16, c.ink, c.line)
  ctx.strokeStyle = c.line; ctx.lineWidth = 2
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(270, 400 + i * 110); ctx.lineTo(1150, 400 + i * 110); ctx.stroke() }
  tx('1988', 270, 850, { font: 'IBM Plex Mono', size: 24, weight: 600, color: c.muted, role: 'label' })
  tx('2004', 1150, 850, { font: 'IBM Plex Mono', size: 24, weight: 600, color: c.muted, align: 'right', role: 'label' })
  const line = (pts, k, color, width, dash = []) => {
    if (k <= 0) return
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.lineCap = 'round'; ctx.beginPath()
    const n = Math.max(1, Math.floor((pts.length - 1) * k))
    pts.slice(0, n + 1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    const f = (pts.length - 1) * k - n
    if (n < pts.length - 1) ctx.lineTo(lerp(pts[n][0], pts[n + 1][0], f), lerp(pts[n][1], pts[n + 1][1], f))
    ctx.stroke(); ctx.restore()
  }
  const xs = Array.from({ length: 17 }, (_, i) => 270 + i * 55)
  const expected = xs.map((x, i) => [x, 420 + i * i * 1.6])
  const kE = env.ease.utility(clamp((t - at(env, B.expect, 'expect')) / 1.6)) * (1 - clamp((t - at(env, B.two)) / 0.4))
  line(expected, kE, c.muted, 5, [14, 12])
  const perBranch = xs.map((x, i) => [x, 420 + (i / 16) * 154])          // 20 to 13 on a 0..20 scale of 440 px
  const branches = xs.map((x, i) => [x, 700 - (i / 16) * 130])           // 7 to 10, scaled
  const kP = env.ease.utility(clamp((t - at(env, B.two, 'Fewer')) / 1.0))
  const kR = env.ease.utility(clamp((t - at(env, B.two, 'More')) / 0.8))
  const watch = env.ease.enter(clamp((t - at(env, B.watch)) / 0.4))
  line(perBranch, kP, c.creamSoft, 6)
  line(branches, kR, watch > 0.5 ? c.mint : c.cream, 6 + watch * 4)
  if (kP > 0.9) tx('PER BRANCH', 1150, 576 + 0, { font: 'IBM Plex Mono', size: 28, weight: 600, color: c.creamSoft, align: 'right', alpha: 1 - watch * 0.5, role: 'label' })
  if (kR > 0.9) tx('BRANCHES', 1150, 555 - 40, { font: 'IBM Plex Mono', size: 28, weight: 700, color: watch > 0.5 ? c.mint : c.cream, align: 'right', role: 'label' })

  // The Customers view (act 3): time counting cash shrinks, time with customers grows. Icons, no words.
  const kT = env.ease.enter(clamp((t - at(env, B.talk, 'stopped')) / 0.8)) * (1 - clamp((t - at(env, B.two)) / 0.3))
  if (kT > 0) {
    ctx.save(); ctx.globalAlpha *= kT
    rr(ctx, 230, 310, 955, 560, 16, c.ink, c.line)
    const cash = lerp(1, 0.35, env.ease.utility(clamp((t - at(env, B.talk, 'counting')) / 1.0)))
    const talk = lerp(0.3, 1, env.ease.utility(clamp((t - at(env, B.talk, 'talking')) / 1.0)))
    // Cash: a note icon; talk: a speech bubble.
    rr(ctx, 270, 400, 70, 44, 6, null, c.cream); ctx.fillStyle = c.cream; ctx.beginPath(); ctx.arc(305, 422, 10, 0, Math.PI * 2); ctx.fill()
    rr(ctx, 380, 400, 720 * cash, 44, 8, c.creamSoft)
    ctx.strokeStyle = c.mint; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(305, 560, 36, 24, 0, 0, Math.PI * 2); ctx.stroke()
    rr(ctx, 380, 538, 720 * talk, 44, 8, c.mint)
    ctx.restore()
  }

  // The ask (act 5): one task row ticks to done, then its time copies itself into new slots.
  const kAsk = env.ease.enter(clamp((t - at(env, B.ask, 'pick')) / 0.6))
  if (kAsk > 0) {
    ctx.save(); ctx.globalAlpha *= kAsk
    rr(ctx, 230, 310, 955, 560, 16, c.ink, c.line)
    rr(ctx, 280, 360, 820, 80, 12, c.inkSoft, c.line)
    ctx.fillStyle = c.creamSoft; ctx.fillRect(330, 395, 380, 12)
    const kd = env.ease.enter(clamp((t - at(env, B.ask, 'does')) / 0.4))
    rr(ctx, 1010, 375, 60, 50, 10, kd > 0.5 ? c.mint : null, c.cream)
    for (let i = 0; i < 4; i++) {
      const kk = clamp((t - at(env, B.ask, 'Then') - i * 0.25) / 0.5)
      if (kk <= 0) continue
      ctx.save(); ctx.globalAlpha *= env.ease.hero(kk)
      rr(ctx, 280 + i * 210, 520 + (1 - env.ease.hero(kk)) * 30, 190, 150, 14, null, c.mint)
      ctx.fillStyle = c.mint; ctx.fillRect(360 + i * 210, 590, 30, 8); ctx.fillRect(371 + i * 210, 579, 8, 30)
      ctx.restore()
    }
    ctx.restore()
  }

  // The cursor, with a ring on each click.
  const [px, py] = cursorAt(env, t)
  for (const ck of CLICKS(env)) {
    const k = clamp((t - ck) / 0.45)
    if (k > 0 && k < 1) { ctx.strokeStyle = c.mint; ctx.lineWidth = 3; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(px, py, 10 + 34 * k, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = kin }
  }
  ctx.fillStyle = c.cream; ctx.strokeStyle = c.ink; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + 40); ctx.lineTo(px + 11, py + 30); ctx.lineTo(px + 28, py + 30); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.restore()
  env.clip = null

  if (t < env.closeAt) house.mark(env, ctx)
}

export function cues({ timeline }) {
  const w = (b, s) => timeline.beats[b].words.find((x) => x.w.toLowerCase().startsWith(s.toLowerCase())).s
  const out = []
  const f0 = w(1, 'city'), f1 = w(1, 'twenty')
  for (let i = 0; i < 20; i += 2) out.push({ t: f0 + (f1 - f0) * (i / 20), kind: 'key', gain: 0.8 })
  for (let i = 0; i < 7; i++) out.push({ t: w(2, 'needed') + i * 0.085, kind: 'count', gain: 0.7 })
  out.push({ t: w(4, 'opened'), kind: 'tick' }, { t: timeline.beats[6].s + 0.2, kind: 'tick' }, { t: w(9, 'pick'), kind: 'tick' })
  out.push({ t: w(5, 'stayed'), kind: 'chime' }, { t: timeline.beats[8].s, kind: 'chime', gain: 0.6 })
  for (const [b, word] of [[1], [3, 'expect'], [4, 'opened'], [5], [6], [7], [9]]) out.push({ t: word ? w(b, word) - 0.25 : timeline.beats[b].s - 0.25, kind: 'whoosh', gain: 0.6 })
  return out
}
