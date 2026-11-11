// Dark Keynote: a near-black stage under one spotlight; one giant number at a time, centred, rising out of a glossy
// floor; a slow band of light sweeps across its face as he lands it; a small label above, the credit below. Nothing
// else on stage. Slides change by a soft dissolve, never a wipe.
// Bar: the product-keynote reveal (one number, a lot of black, light that moves slowly).
// Draws frame t from t alone.
import { clamp, lerp, text } from '../_core/house.mjs'
import { draw as sweepNumber } from '../../../packages/moves/light-sweep-number/move.mjs'

const B = { hook: 0, y1988: 1, y2004: 2, expect: 3, didnt: 4, same: 5, talk: 6, two: 7, watch: 8, ask: 9 }
const at = (env, b, word) => (word ? env.word(b, word).s : env.beat(b).s)

export async function setup(env) {
  // Captions sit directly under the number and its credit (Krish, 11 Nov: "A"); the floor runs on below them.
  if (env.shape === 'tall') env.captionBase = 1040
}

/** Each slide: the number, its label, when it lands and leaves, and its colour. */
function slides(env) {
  const c = env.skin.colors
  return [
    { str: 'ATM', label: 'THE THREAT · 1970s', a: -0.4, b: at(env, B.y1988) - 0.3 },
    { str: '1988', label: 'THE YEAR', a: at(env, B.y1988, '1988') - 0.1, b: at(env, B.y1988, 'twenty') - 0.45, size: 0.8 },
    { str: '20', label: 'TELLERS PER BRANCH · 1988', a: at(env, B.y1988, 'twenty') - 0.2, b: at(env, B.y2004, 'thirteen') - 0.35 },
    { str: '13', label: 'TELLERS PER BRANCH · 2004', a: at(env, B.y2004, 'thirteen') - 0.15, b: at(env, B.expect, 'expect') - 0.3 },
    { str: '0?', label: 'EXPECTED', a: at(env, B.expect, 'expect') - 0.1, b: at(env, B.didnt) - 0.05, color: c.muted, shade: c.line },
    { str: 'NO.', label: 'WHAT HAPPENED', a: at(env, B.didnt) - 0.05, b: at(env, B.didnt, 'cheaper') - 0.45, size: 0.9 },
    { str: 'COST ↓', label: 'RUNNING A BRANCH', a: at(env, B.didnt, 'cheaper') - 0.15, b: at(env, B.didnt, 'Forty') - 0.45, size: 0.62 },
    { str: '+43%', label: 'BRANCHES · 1988 → 2004', a: at(env, B.didnt, 'Forty') - 0.15, b: at(env, B.same) - 0.3, size: 0.84 },
    { str: '=', label: 'TOTAL · 1988 = 2004', a: at(env, B.same, 'stayed') - 0.15, b: at(env, B.talk) - 0.3, color: c.mint, shade: '#3E8F6E', glow: 'rgba(126,240,192,0.35)', size: 1.5 },
    { str: 'CASH', label: 'THE OLD JOB', a: at(env, B.talk, 'counting') - 0.15, b: at(env, B.talk, 'talking') - 0.45, size: 0.8, color: c.muted, shade: c.line },
    { str: 'PEOPLE', label: 'WHERE THE TIME WENT', a: at(env, B.talk, 'talking') - 0.15, b: at(env, B.two) - 0.3, size: 0.62 },
    { str: '−35%', label: 'PER BRANCH', size: 0.84, a: at(env, B.two, 'Fewer') - 0.15, b: at(env, B.two, 'More') - 0.4 },
    { str: '+43%', label: 'BRANCHES', size: 0.84, a: at(env, B.two, 'More') - 0.15, b: at(env, B.ask) - 0.3, color: c.mint, shade: '#3E8F6E', glow: 'rgba(126,240,192,0.3)', resweep: at(env, B.watch) },
    { str: '1 TASK', label: 'YOUR DESK', a: at(env, B.ask, 'pick') - 0.15, b: at(env, B.ask, 'what') - 0.3, size: 0.62 },
    { str: 'MORE?', label: 'COST ↓', a: at(env, B.ask, 'what') - 0.15, b: 1e9, size: 0.62, color: c.mint, shade: '#3E8F6E', glow: 'rgba(126,240,192,0.35)' },
  ]
}

export function draw(env, ctx, t, house) {
  const c = env.skin.colors, e = env.ease, tall = env.shape === 'tall', W = env.W, H = env.H
  // The stage: ink, darker at the edges, one cone of light from above, a floor that catches it.
  ctx.fillStyle = '#070C0A'; ctx.fillRect(0, 0, W, H)
  // Tall: the floor is raised so the slide's label sits just under every channel's top bar and the number fills the
  // top of the screen (Krish, 2026-11-11: "make maximum use of the full screen").
  const cx = W / 2, floor = tall ? 820 : 760
  const cone = ctx.createLinearGradient(0, 0, 0, floor)
  cone.addColorStop(0, 'rgba(244,239,228,0.10)'); cone.addColorStop(1, 'rgba(244,239,228,0.02)')
  ctx.save(); ctx.filter = 'blur(40px)'; ctx.fillStyle = cone; ctx.beginPath()
  const breathe = 1 + 0.03 * Math.sin(t * 0.4)
  ctx.moveTo(cx - 120, -40); ctx.lineTo(cx + 120, -40); ctx.lineTo(cx + (tall ? 520 : 760) * breathe, floor); ctx.lineTo(cx - (tall ? 520 : 760) * breathe, floor); ctx.fill(); ctx.restore()
  const pool = ctx.createRadialGradient(cx, floor, 10, cx, floor, tall ? 560 : 820)
  pool.addColorStop(0, 'rgba(244,239,228,0.14)'); pool.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save(); ctx.translate(cx, floor); ctx.scale(1, 0.18); ctx.translate(-cx, -floor); ctx.fillStyle = pool; ctx.fillRect(0, floor - 600, W, 1200); ctx.restore()
  // Haze: slow motes in the beam.
  ctx.save(); ctx.fillStyle = c.cream
  for (let i = 0; i < 46; i++) {
    const ph = i * 12.9898, x = cx + Math.sin(ph) * (tall ? 380 : 620) + Math.sin(t * 0.13 + ph) * 30, y = ((Math.cos(ph) * 0.5 + 0.5) * floor + t * (6 + (i % 5) * 3)) % floor
    ctx.globalAlpha = 0.05 + 0.08 * Math.abs(Math.sin(ph * 3 + t * 0.5)); ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()

  // The slides.
  const NS = tall ? 430 : 400, LY = tall ? 330 : 210
  for (const s of slides(env)) {
    const vis = e.enter(clamp((t - s.a) / 0.5)) * (1 - e.exit(clamp((t - s.b) / 0.45)))
    if (vis <= 0.01) continue
    sweepNumber(ctx, t, { c, e, str: s.str, x: cx, y: floor - 10, size: NS * (s.size ?? 1), color: s.color ?? c.cream, shade: s.shade ?? '#8E8C84', glow: s.glow,
      at: s.a, out: s.b, sweep: t >= (s.resweep ?? 1e9) ? s.resweep : s.a + 0.35, floor, ground: '#070C0A' })
    text(env, ctx, s.label, cx, LY, { font: 'IBM Plex Mono', size: tall ? 40 : 30, weight: 600, color: c.creamSoft, align: 'center', tracking: 3, alpha: vis, role: 'label' })
  }
  // The credit, below the floor, under every number that came from the source.
  const src = t < at(env, B.talk) - 0.3 || (t >= at(env, B.two) && t < at(env, B.ask) - 0.3)
  text(env, ctx, 'IMF F&D · BESSEN · 2015', cx, floor + (tall ? 100 : 80), { font: 'IBM Plex Mono', size: tall ? 40 : 28, weight: 500, color: c.muted, align: 'center', tracking: 2, role: 'credit', alpha: src ? e.enter(clamp((t - 0.6) / 0.6)) : 0 })
  // A vignette, then the dress.
  const v = ctx.createRadialGradient(cx, H * 0.42, H * 0.2, cx, H * 0.45, H * 0.8)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)
  house.dress(env, ctx)
}

export function cues({ timeline }) {
  const w = (b, s) => timeline.beats[b].words.find((x) => x.w.toLowerCase().startsWith(s.toLowerCase())).s
  // Keynote sound: a low swell under each reveal, a soft chime on the answer, long quiet between.
  const out = [{ t: 0.0, kind: 'whoosh', gain: 0.4 }, { t: 0.2, kind: 'thump', gain: 0.35 }]
  for (const [b, s] of [[1, 'twenty'], [2, 'thirteen'], [4, 'Forty'], [6, 'talking'], [7, 'More'], [9, 'pick'], [9, 'what']]) out.push({ t: w(b, s) - 0.3, kind: 'whoosh', gain: 0.35 }, { t: w(b, s) - 0.05, kind: 'thump', gain: 0.3 })
  out.push({ t: w(5, 'stayed'), kind: 'chime', gain: 0.55 }, { t: timeline.beats[8].s, kind: 'chime', gain: 0.35 })
  return out
}
