// The Evidence Desk: the real source on a lamp-lit desk. Every number is shown where it is printed, circled by hand in
// the one pointer colour, lifted in a loupe, and pinned to one clock of when it was true.
// Bar: the Mon 9 Nov cut's real artefacts on ink, and the explainer grammar of freeze, circle, magnify.
// The source is James Bessen, "Toil and Technology", IMF Finance & Development, March 2015, captured from the public
// page (lab assets, never committed). Nothing on the cards is retyped or redrawn: they are the captured pixels.
// Draws frame t from t alone.
import { clamp, lerp, text } from '../_core/house.mjs'
import { draw as mark, handCircle, handUnderline } from '../../../packages/moves/freeze-circle-magnify/move.mjs'
import { draw as clock } from '../../../packages/moves/source-on-clock/move.mjs'
import { draw as bigType } from '../../../packages/moves/type-is-the-picture/move.mjs'

const B = { hook: 0, y1988: 1, y2004: 2, expect: 3, didnt: 4, same: 5, talk: 6, two: 7, watch: 8, ask: 9 }
const at = (env, b, word) => (word ? env.word(b, word).s : env.beat(b).s)
// The style's one kept accent: red only ever points (a circle, an underline, the playhead). Mint means the answer and
// the series colour marks the channel, so neither may point (STYLE.md section 3).
const POINT = '#FF5247'
// Phrase boxes in the captured paragraph (image pixels, measured from the page's own text ranges).
const P = {
  atms: [91, 14, 665, 46], n20: [652, 185, 45, 46], n13: [754, 185, 46, 46], range: [558, 185, 236, 46],
  more: [614, 242, 416, 46], pct: [101, 356, 365, 46], jobs: [[775, 413, 302, 46], [0, 470, 167, 46]],
}
// Where the two cards lie on the desk (desk coordinates are the tall canvas at rest): [x, y, scale, rotation].
const HEAD = [122, 968, 0.8, -0.028], PARA = [84, 1176, 0.845, 0.014]

const img = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })
export async function setup(env) {
  const base = (env.assets ?? '') + 'evidence-desk/'
  env.head = await img(base + 'head.png'); env.para = await img(base + 'para.png')
  // Captions sit directly under the number and its credit (Krish, 11 Nov: "A"); the desk is the picture below.
  if (env.shape === 'tall') env.captionBase = 592
}

/** A point on a card (image pixels) in desk coordinates. */
function onCard([x, y, s, r], px, py) { return [x + Math.cos(r) * px * s - Math.sin(r) * py * s, y + Math.sin(r) * px * s + Math.cos(r) * py * s] }
const mid = (b) => [b[0] + b[2] / 2, b[1] + b[3] / 2]

/** The camera: a focus point on the desk and a zoom, eased from shot to shot, always breathing. */
function camera(env, t) {
  const shots = [
    [0, [540, 1250], 0.93],
    [at(env, B.y1988), onCard(PARA, ...mid(P.range)), 1.42],
    [at(env, B.y2004, 'thirteen') + 0.5, onCard(PARA, 560, 230), 1.12],
    [at(env, B.expect), onCard(PARA, 820, 470), 1.25],
    [at(env, B.didnt, 'opened') - 0.3, onCard(PARA, 560, 300), 1.18],
    [at(env, B.same), onCard(PARA, 560, 460), 1.3],
    [at(env, B.talk), [540, 1240], 0.96],
    [at(env, B.two), onCard(PARA, 520, 280), 1.06],
    [at(env, B.watch), onCard(PARA, ...mid(P.pct)), 1.5],
    [at(env, B.ask), [540, 1240], 1],
  ]
  let i = 0; while (i + 1 < shots.length && t >= shots[i + 1][0]) i++
  const [t1, f1, z1] = shots[i], [, f0, z0] = shots[Math.max(0, i - 1)]
  const k = i ? env.ease.hero(clamp((t - t1) / 0.9)) : 1
  const drift = 1 + 0.012 * Math.sin(t * 0.5)
  return { f: [lerp(f0[0], f1[0], k), lerp(f0[1], f1[1], k) + Math.sin(t * 0.3) * 6], z: lerp(z0, z1, k) * drift }
}

function card(env, ctx, image, [x, y, s, r], { lift = 0, alpha = 1 } = {}) {
  if (alpha <= 0.01) return
  const w = image.width * s, h = image.height * s, pad = 34
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y - lift); ctx.rotate(r)
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40 + lift; ctx.shadowOffsetY = 18 + lift * 0.5
  ctx.fillStyle = '#FBF9F4'; ctx.fillRect(-pad, -pad, w + pad * 2, h + pad * 2); ctx.shadowColor = 'transparent'
  // Card stock: the house paper, very faint, so it reads as a printout and not a screen.
  ctx.globalAlpha = alpha * 0.22; ctx.drawImage(env.paperImg, -pad, -pad, w + pad * 2, h + pad * 2); ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(image, 0, 0, w, h); ctx.globalCompositeOperation = 'source-over'
  ctx.restore()
}

export function draw(env, ctx, t, house) {
  const c = env.skin.colors, e = env.ease, tall = env.shape === 'tall', W = env.W, H = env.H
  const T = (s, x, y, o = {}) => text(env, ctx, s, x, y, { font: 'IBM Plex Mono', size: tall ? 40 : 30, weight: 600, color: c.creamSoft, tracking: 2, ...o })
  // The desk: ink felt under one warm lamp.
  ctx.fillStyle = c.ink; ctx.fillRect(0, 0, W, H)
  const lamp = ctx.createRadialGradient(tall ? 560 : 1320, tall ? 1030 : 560, 40, tall ? 560 : 1320, tall ? 1030 : 560, tall ? 1050 : 900)
  lamp.addColorStop(0, 'rgba(244,239,228,0.13)'); lamp.addColorStop(0.55, 'rgba(244,239,228,0.04)'); lamp.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, H)

  // ---- The desk, through the camera ----
  const cam = camera(env, t)
  const anchor = tall ? [540, 1080] : [1330, 560], base = tall ? 1 : 0.78
  // Tall: the desk is a window below the clock, so nothing on it ever sits behind the number, caption or clock.
  const deskTop = tall ? 756 : 0
  ctx.save(); if (tall) { ctx.beginPath(); ctx.rect(0, deskTop, W, H - deskTop); ctx.clip() }
  ctx.save(); ctx.translate(...anchor); ctx.scale(cam.z * base, cam.z * base); ctx.translate(-cam.f[0], -cam.f[1])
  const away = 1.6 * e.exit(clamp((t - at(env, B.ask)) / 0.6))
  const inK = e.hero(clamp((t + 0.6) / 0.9))
  card(env, ctx, env.head, [HEAD[0] - 900 * away, HEAD[1] - 60 * (1 - inK), HEAD[2], HEAD[3]], { lift: 8 * (1 - inK), alpha: inK })
  card(env, ctx, env.para, [PARA[0] + 900 * away, PARA[1] + 80 * (1 - e.hero(clamp((t - 0.2) / 0.9))), PARA[2], PARA[3]], { alpha: e.hero(clamp((t - 0.2) / 0.6)) })
  const para = [PARA[0] + 900 * away, PARA[1], PARA[2], PARA[3]]
  const mk = (box, circle, extra = {}) => mark(ctx, t, { c, e, img: env.para, box, card: para, point: POINT, times: { circle, magnify: 1e9, out: extra.out }, ...extra })
  // 1988 and 2004: the 20, then the 13, circled as he says them.
  mk(P.n20, at(env, B.y1988, 'twenty') - 0.15, { seed: 2, out: at(env, B.expect) })
  mk(P.n13, at(env, B.y2004, 'thirteen') - 0.15, { seed: 5, out: at(env, B.expect) })
  // The answer is hidden under a slip until "They didn't."
  const slipOff = e.hero(clamp((t - at(env, B.didnt) - 0.05) / 0.55))
  // The slip lands once the camera has arrived on the line, so it never passes through the platforms' action rail.
  if (t >= at(env, B.expect) + 0.3 && slipOff < 1) {
    const k = e.hero(clamp((t - at(env, B.expect) - 0.3) / 0.5))
    ctx.save(); ctx.translate(para[0], para[1]); ctx.rotate(para[3]); ctx.scale(para[2], para[2])
    ctx.translate(slipOff * 700, -slipOff * 260); ctx.rotate(-0.06 + slipOff * 0.3)
    ctx.globalAlpha = k; ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12
    ctx.fillStyle = c.cream; ctx.fillRect(760, 398, 330, 136); ctx.fillRect(-14, 456, 196, 76); ctx.shadowColor = 'transparent'
    text(env, ctx, '?', 925, 498, { font: 'Anton', size: 74, color: c.ink, align: 'center', role: 'label' })
    ctx.restore()
  }
  // Each branch got cheaper, so banks opened more: underline it, then circle the 43 percent.
  mark(ctx, t, { c, e, img: env.para, box: P.more, card: para, point: POINT, under: [P.more], times: { circle: at(env, B.didnt, 'opened') - 0.1, magnify: 1e9, out: at(env, B.talk) } })
  mk(P.pct, at(env, B.didnt, 'Forty') - 0.1, { seed: 3, out: at(env, B.ask) })
  // The answer, in mint: teller jobs did not disappear.
  mark(ctx, t, { c, e, img: env.para, box: P.jobs[0], card: para, point: c.mint, under: P.jobs, times: { circle: at(env, B.same, 'stayed') - 0.2, magnify: 1e9, out: at(env, B.ask) } })
  // Two things moved: the two marks joined by a hand-drawn line.
  const j = e.utility(clamp((t - at(env, B.two, 'Fewer')) / 0.6)) * (1 - away)
  if (j > 0) {
    const [ax, ay] = onCard(para, P.range[0] + 40, P.range[1] + 70), [bx, by] = onCard(para, P.pct[0] + 330, P.pct[1] - 20)
    ctx.save(); ctx.strokeStyle = POINT; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.setLineDash([2, 16])
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2 - 140, (ay + by) / 2, lerp(ax, bx, j), lerp(ay, by, j)); ctx.stroke(); ctx.restore()
  }
  // The ask: a fresh index card for his team.
  const ask = e.hero(clamp((t - at(env, B.ask) - 0.3) / 0.7))
  if (ask > 0) {
    ctx.save(); ctx.translate(540, 1200 + 500 * (1 - ask)); ctx.rotate(-0.025)
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 45; ctx.shadowOffsetY = 20
    ctx.fillStyle = c.cream; ctx.fillRect(-420, -250, 840, 500); ctx.shadowColor = 'transparent'
    ctx.globalAlpha = 0.25; ctx.drawImage(env.paperImg, -420, -250, 840, 500); ctx.globalAlpha = 1
    ctx.fillStyle = POINT; ctx.fillRect(-420, -168, 840, 4)
    text(env, ctx, 'EXHIBIT 2 · YOUR DESK', -370, -190, { font: 'IBM Plex Mono', size: 40, weight: 700, color: c.ink, tracking: 2 })
    // Each line is revealed by a wipe, not typed letter by letter: the whole line is on the card from its first frame,
    // so it is read as one line (a typed reveal draws dozens of half-words, each too brief to read).
    const typed = (s, y, t0) => {
      const k = e.utility(clamp((t - t0) / 0.6)); if (k <= 0) return
      ctx.save(); ctx.beginPath(); ctx.rect(-380, y - 50, 760 * k, 70); ctx.clip()
      text(env, ctx, s, -370, y, { font: 'IBM Plex Mono', size: 46, weight: 600, color: c.ink, role: 'label', alpha: k > 0.6 ? 1 : 0.5 })
      ctx.restore()
    }
    typed('TASK AI DOES: ______', -70, at(env, B.ask, 'pick'))
    typed('ITS COST: ↓', 20, at(env, B.ask, 'Then'))
    typed('VOLUME: ↑ ?', 110, at(env, B.ask, 'what'))
    handCircle(ctx, -380, 60, 300, 70, e.utility(clamp((t - at(env, B.ask, 'more') - 0.1) / 0.6)), c.mint, 7, 4)
    ctx.restore()
  }
  ctx.restore()
  if (tall) { const edge = ctx.createLinearGradient(0, deskTop, 0, deskTop + 70); edge.addColorStop(0, c.ink); edge.addColorStop(1, c.ink + '00'); ctx.fillStyle = edge; ctx.fillRect(0, deskTop, W, 70) }
  ctx.restore()

  // ---- The loupe, in screen space so it never crops: the line being read, at twice the size ----
  const toScreen = ([x, y]) => [anchor[0] + (x - cam.f[0]) * cam.z * base, anchor[1] + (y - cam.f[1]) * cam.z * base]
  const loupe = (box, t0, t1, under) => {
    // Freeze: the desk dims; magnify: the line lifts off the page on a slip, whole, at two to three times its size.
    const m = e.hero(clamp((t - t0) / 0.5)) * (1 - e.exit(clamp((t - t1) / 0.4)))
    if (m <= 0.01) return
    ctx.save(); ctx.fillStyle = c.ink; ctx.globalAlpha = 0.6 * m; ctx.fillRect(0, tall ? deskTop : 0, tall ? W : W, H); ctx.restore()
    const s = para[2] * cam.z * base
    mark(ctx, t, { c, e, img: env.para, box, card: [0, -9999, s, 0], point: under ? c.mint : POINT, under: under ? [box] : null, times: { circle: -1, magnify: t0, out: t1 }, strip: tall ? [540, 1100, 1000] : [1330, 560, 1000] })
  }
  loupe(P.range, at(env, B.y2004, 'thirteen') + 0.2, at(env, B.expect) - 0.2)
  loupe(P.pct, at(env, B.didnt, 'percent') + 0.1, at(env, B.same) - 0.3)

  // ---- Over the desk: the scrim, the number with its credit, the clock ----
  const s1 = ctx.createLinearGradient(0, 0, 0, tall ? deskTop : 1)
  s1.addColorStop(0, c.ink); s1.addColorStop(1, c.ink)
  ctx.fillStyle = s1; if (tall) ctx.fillRect(0, 0, W, deskTop)
  else { const s2 = ctx.createLinearGradient(0, 0, 900, 0); s2.addColorStop(0, c.ink); s2.addColorStop(0.85, c.ink + 'ee'); s2.addColorStop(1, c.ink + '00'); ctx.fillStyle = s2; ctx.fillRect(0, 0, 900, H) }
  // Tall: the credit starts just under every channel's top bar (y 270), the number under it, the clock under that and
  // the desk below, so the top of the screen carries the point (Krish, 2026-11-11: "make maximum use of the full screen").
  const NX = tall ? 72 : 96, NY = tall ? 500 : 470, NS = tall ? 190 : 200, CY = tall ? 300 : 250
  const credit = (s, t0, t1, color = c.muted) => T(s, NX, CY, { color, alpha: e.enter(clamp((t - t0) / 0.4)) * (1 - e.exit(clamp((t - t1) / 0.3))), role: 'credit' })
  const num = (s, t0, t1, o = {}) => bigType(ctx, t, { c, e, str: s, x: NX, y: NY, size: NS, color: c.cream, at: t0, out: t1, ...o })
  credit('EXHIBIT 1 · IMF F&D · 2015', 0, at(env, B.ask) - 0.3)
  credit('EXHIBIT 2 · YOUR DESK', at(env, B.ask), 1e9)
  num('ATM', -0.3, at(env, B.y1988) - 0.35)
  num('20', at(env, B.y1988, 'twenty') - 0.2, at(env, B.y2004) - 0.3)
  num('20', at(env, B.y2004) - 0.15, at(env, B.expect) - 0.3, { strike: at(env, B.y2004, 'thirteen') - 0.1, strikeColor: POINT, color: c.muted })
  num('13', at(env, B.y2004, 'thirteen') - 0.1, at(env, B.expect) - 0.3, { x: NX + (tall ? 260 : 270) })
  num('0 ?', at(env, B.expect, 'expect'), at(env, B.didnt) - 0.05, { color: c.muted })
  num('+43%', at(env, B.didnt, 'Forty') - 0.1, at(env, B.same) - 0.3)
  num('LEVEL', at(env, B.same, 'stayed') - 0.15, at(env, B.talk) - 0.3, { color: c.mint })
  num('CASH', at(env, B.talk, 'counting') - 0.1, at(env, B.talk, 'spent') - 0.2, { strike: at(env, B.talk, 'cash'), strikeColor: POINT, color: c.muted })
  num('PEOPLE', at(env, B.talk, 'talking') - 0.1, at(env, B.two) - 0.3, { color: c.mint })
  num('−35%', at(env, B.two, 'Fewer') - 0.1, at(env, B.watch) - 0.3, { size: NS * 0.78 })
  num('+43%', at(env, B.two, 'More') - 0.1, at(env, B.ask) - 0.3, { size: NS * 0.78, x: NX + (tall ? 430 : 440) })
  num('1 TASK', at(env, B.ask, 'pick') - 0.1, 1e9, { size: NS * 0.85 })
  // Small labels beside the numbers: what each one is.
  const lab = (s, t0, t1, x = NX, color = c.creamSoft) => T(s, x, NY + (tall ? 64 : 62), { color, alpha: e.enter(clamp((t - t0) / 0.4)) * (1 - e.exit(clamp((t - t1) / 0.3))) })
  if (!tall) {
    lab('PER BRANCH · 1988 → 2004', at(env, B.y2004, 'thirteen'), at(env, B.expect) - 0.3)
    lab('CITY BRANCHES', at(env, B.didnt, 'percent'), at(env, B.same) - 0.3)
  }
  // The clock: when each of these was true.
  const cx0 = tall ? 110 : 110, cw = tall ? 740 : 640, cy0 = tall ? 690 : 700
  clock(ctx, t, { c, e, x: cx0, y: cy0, w: cw, years: [1970, 2030], point: POINT, start: 0,
    pins: [
      { year: 1972, label: 'ATM', at: 0.2, align: 'left' },
      { year: 1988, label: '1988', at: at(env, B.y1988, '1988') - 0.1 },
      { year: 2004, label: '2004', at: at(env, B.y2004, '2004') - 0.1 },
      { year: 2015, label: 'IMF', at: 0.5 },
      { year: 2026, label: 'NOW', at: at(env, B.ask), color: c.mint },
    ],
    head: [[0.6, 1972], [at(env, B.y1988, '1988'), 1988], [at(env, B.y2004, '2004'), 2004], [at(env, B.ask), 2026]],
    text: (s, x, y, o) => T(s, x, y, { ...o, role: 'label' }) })
  // A vignette, then the dress.
  const v = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.3, W / 2, H * 0.55, H * 0.85)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)
  house.dress(env, ctx)
}

export function cues({ timeline }) {
  const w = (b, s) => timeline.beats[b].words.find((x) => x.w.toLowerCase().startsWith(s.toLowerCase())).s
  const out = [{ t: 0.1, kind: 'whoosh', gain: 0.6 }, { t: 0.35, kind: 'thump', gain: 0.25 }]
  // The pen: a short scratch as each circle draws.
  for (const t of [w(1, 'twenty'), w(2, 'thirteen'), w(4, 'opened'), w(4, 'Forty'), w(5, 'stayed')]) for (let i = 0; i < 6; i++) out.push({ t: t - 0.1 + i * 0.09, kind: 'key', gain: 0.45 })
  out.push({ t: w(2, 'thirteen') + 0.2, kind: 'whoosh', gain: 0.35 }, { t: w(4, 'percent') + 0.1, kind: 'whoosh', gain: 0.35 })
  out.push({ t: w(4, "didn't") + 0.05, kind: 'whoosh', gain: 0.5 }, { t: w(5, 'stayed'), kind: 'chime', gain: 0.6 })
  for (let i = 0; i < 20; i++) out.push({ t: w(9, 'pick') + i * 0.045, kind: 'key', gain: 0.4 })
  out.push({ t: timeline.beats[9].s, kind: 'whoosh', gain: 0.5 })
  return out
}
