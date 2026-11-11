// Swiss Kinetic Type: the type is the picture. A cream field on a strict, visible 12-column grid; one word or number
// at a time, set huge, flush left, wiped in from its baseline or from the left edge on the beat it is said; facts in
// Plex Mono on the grid lines; one mint block for the answer. Below the caption, plain squares count what the words say.
// Bar: the International Typographic Style (Müller-Brockmann's grid, Ruder's type as image), moving.
// Draws frame t from t alone.
import { clamp, lerp, text } from '../_core/house.mjs'
import { draw as bigType } from '../../moves/type-is-the-picture/move.mjs'

const B = { hook: 0, y1988: 1, y2004: 2, expect: 3, didnt: 4, same: 5, talk: 6, two: 7, watch: 8, ask: 9 }
const at = (env, b, word) => (word ? env.word(b, word).s : env.beat(b).s)

export async function setup(env) {
  // Captions sit directly under the type block (Krish, 11 Nov: "A"); the counting squares sit below them.
  if (env.shape === 'tall') env.captionBase = 1178
}

export function draw(env, ctx, t, house) {
  const c = env.skin.colors, e = env.ease, tall = env.shape === 'tall', W = env.W, H = env.H
  // The field: cream, with the house paper very faint so it reads as printed stock.
  ctx.fillStyle = c.cream; ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 0.18; ctx.drawImage(env.paperImg, 0, 0, W, H); ctx.globalAlpha = 1
  // The grid: 12 columns and a baseline every 60 px, drawn on in the first second, then always there.
  const M = tall ? 60 : 96, cols = 12, gw = (W - M * 2) / cols, g0 = e.hero(clamp((t + 0.4) / 1))
  ctx.save(); ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.07; ctx.lineWidth = 2
  for (let i = 0; i <= cols; i++) { const x = M + i * gw; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H * g0); ctx.stroke() }
  ctx.globalAlpha = 0.04; for (let y = 0; y < H * g0; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  ctx.restore()
  // The masthead band: ink, so the wordmark and the series name read as they do on the wide frame. Vertical video has
  // no wordmark (Ruling, Krish, 2026-11-11), so the tall frame has no band.
  if (!tall) { ctx.fillStyle = c.ink; ctx.fillRect(0, 0, W, 150) }
  const L = (s, x, y, o = {}) => text(env, ctx, s, x, y, { font: 'IBM Plex Mono', size: tall ? 40 : 30, weight: 600, color: c.ink, tracking: 2, ...o })
  const fade = (t0, t1) => e.enter(clamp((t - t0) / 0.35)) * (1 - e.exit(clamp((t - t1) / 0.3)))
  // Section number, top right of the field: the beat we are on, as a Swiss poster numbers its parts.
  const beat = env.timeline.beats.findIndex((b, i) => t < (env.timeline.beats[i + 1]?.s ?? 1e9))
  const X = M, TOP = tall ? 470 : 230
  L('IMF · BESSEN · 2015', X, TOP, { role: 'credit', alpha: fade(0, at(env, B.ask) - 0.3) })
  L('YOUR DESK', X, TOP, { role: 'credit', alpha: fade(at(env, B.ask), 1e9) })
  L(String(beat + 1).padStart(2, '0') + ' / 10', tall ? 860 : W - M, TOP, { align: 'right', role: 'label', color: c.muted })

  // ---- The type block (tall: 520 to 1100) ----
  const T = (str, x, y, size, t0, t1, o = {}) => bigType(ctx, t, { c, e, str, x, y, size, color: c.ink, at: t0, out: t1, ...o })
  const base1 = tall ? 830 : 560, base2 = tall ? 1100 : 860
  // Hook: the machine against the person.
  T('ATM', X - 8, base1, tall ? 330 : 300, -0.3, at(env, B.y1988) - 0.35, { from: 'left' })
  T('TELLER', X - 6, base2, tall ? 250 : 240, at(env, B.hook, 'teller') - 0.15, at(env, B.y1988) - 0.35)
  if (t > at(env, B.hook, 'ended') - 0.1 && t < at(env, B.y1988) - 0.2) {
    // A mint rule strikes through the person, where the machine "should have ended" him; it is the claim, not the answer,
    // so it is ink, and it lifts away later.
    const k = e.utility(clamp((t - at(env, B.hook, 'ended') + 0.1) / 0.4))
    ctx.fillStyle = c.ink; ctx.fillRect(X - 14, base2 - 110, (tall ? 640 : 600) * k, 22)
  }
  // 1988, then 2004.
  L('1988 · PER BRANCH', X, tall ? 560 : 300, { alpha: fade(at(env, B.y1988, '1988'), at(env, B.y2004) - 0.3) })
  // The year holds the frame until the count arrives, so the block is never empty while he speaks.
  T('1988', X - 10, base2, tall ? 420 : 400, at(env, B.y1988, '1988') - 0.1, at(env, B.y1988, 'twenty') - 0.35, { from: 'left' })
  T('20', X - 12, base2, tall ? 600 : 540, at(env, B.y1988, 'twenty') - 0.15, at(env, B.y2004, 'thirteen') - 0.25)
  L('2004 · PER BRANCH', X, tall ? 560 : 300, { alpha: fade(at(env, B.y2004, '2004'), at(env, B.expect) - 0.3) })
  T('20', X - 6, base2, tall ? 260 : 240, at(env, B.y2004, 'thirteen') - 0.2, at(env, B.expect) - 0.3, { color: c.muted, strike: at(env, B.y2004, 'thirteen'), strikeColor: c.ink })
  T('13', tall ? 370 : 440, base2, tall ? 600 : 540, at(env, B.y2004, 'thirteen') - 0.1, at(env, B.expect) - 0.3)
  // You'd expect zero: drawn as an outline, because it never happened.
  if (t > at(env, B.expect, 'expect') - 0.1 && t < at(env, B.didnt) + 0.2) {
    const k = e.enter(clamp((t - at(env, B.expect, 'expect') + 0.1) / 0.45)), o = e.exit(clamp((t - at(env, B.didnt)) / 0.25))
    ctx.save(); ctx.globalAlpha = k * (1 - o); ctx.font = `${tall ? 600 : 540}px 'Anton'`; ctx.lineWidth = 6; ctx.strokeStyle = c.ink
    ctx.setLineDash([18, 14]); ctx.strokeText('0', X - 12, base2 + (1 - k) * 60); ctx.restore()
    L('EXPECTED', tall ? 390 : 420, base2 - 40, { alpha: k * (1 - o) })
  }
  // They didn't: more branches, 43 percent, on the one mint block.
  L('CITY BRANCHES · 1988 → 2004', X, tall ? 560 : 300, { alpha: fade(at(env, B.didnt, 'opened'), at(env, B.same) - 0.3) })
  T('NO.', X - 8, base2, tall ? 600 : 540, at(env, B.didnt) - 0.1, at(env, B.didnt, 'opened') - 0.3)
  T('+43%', X + 6, base2, tall ? 370 : 380, at(env, B.didnt, 'Forty') - 0.15, at(env, B.same) - 0.3, { block: c.mint, from: 'left' })
  T('MORE', X - 6, tall ? 770 : 470, tall ? 170 : 150, at(env, B.didnt, 'opened') - 0.1, at(env, B.same) - 0.3)
  // The total stayed level: one equals sign.
  L('TOTAL · 1988 = 2004', X, tall ? 560 : 300, { alpha: fade(at(env, B.same, 'total'), at(env, B.talk) - 0.3) })
  // Equals, drawn as two ink bars on the mint block (the typeface's own sign is too slight to be the picture).
  { const k = e.enter(clamp((t - at(env, B.same, 'stayed') + 0.15) / 0.45)), o = e.exit(clamp((t - at(env, B.talk) + 0.3) / 0.35))
    if (k > 0 && o < 1) {
      const bw = (tall ? 960 : 900), bh = tall ? 400 : 360, by = base2 - bh + (tall ? 0 : 10)
      ctx.save(); ctx.beginPath(); ctx.rect(X - 10, by, bw * k * (1 - o) + 1, bh); ctx.clip()
      ctx.fillStyle = c.mint; ctx.fillRect(X - 10, by, bw, bh)
      ctx.fillStyle = c.ink; const bar = bh * 0.18, gap = bh * 0.16
      ctx.fillRect(X + 60, by + bh / 2 - gap / 2 - bar, bw - 140, bar); ctx.fillRect(X + 60, by + bh / 2 + gap / 2, bw - 140, bar)
      ctx.restore()
    } }
  // The job changed: count, struck; talk.
  T('COUNT', X - 6, base1 - 30, tall ? 230 : 210, at(env, B.talk, 'counting') - 0.1, at(env, B.two) - 0.3, { color: c.muted, strike: at(env, B.talk, 'cash'), strikeColor: c.ink })
  T('TALK', X - 8, base2, tall ? 330 : 300, at(env, B.talk, 'talking') - 0.1, at(env, B.two) - 0.3, { from: 'left' })
  // Two things moved.
  L('PER BRANCH', X, base1 - 300, { alpha: fade(at(env, B.two, 'Fewer'), at(env, B.watch) - 0.3) })
  T('−35%', X - 6, base1 - 20, tall ? 260 : 240, at(env, B.two, 'Fewer') - 0.1, at(env, B.watch) - 0.3)
  L('BRANCHES', X, base1 + 22, { alpha: fade(at(env, B.two, 'More'), at(env, B.ask) - 0.3) })
  T('+43%', X - 6, base2, tall ? 260 : 240, at(env, B.two, 'More') - 0.1, at(env, B.ask) - 0.3, { block: t >= at(env, B.watch) ? c.mint : null })
  // The ask.
  T('1 TASK', X - 6, base1 - 30, tall ? 230 : 210, at(env, B.ask, 'pick') - 0.1, 1e9)
  T('COST ↓', X - 6, base2 - 10, tall ? 230 : 210, at(env, B.ask, 'costs') - 0.1, at(env, B.ask, 'what') - 0.2, { from: 'left' })
  T('MORE?', X - 6, base2 - 10, tall ? 230 : 210, at(env, B.ask, 'what') - 0.1, 1e9, { block: c.mint, from: 'left' })

  // ---- Below the caption: squares that count (tall only; the wide frame keeps the type alone) ----
  if (tall) {
    const sq = 70, gap = 18, x0 = M + 4, y0 = 1330
    const per = (i) => {
      // 20 tellers light in 1988; 7 fall away in 2004; in the branch beat each square is a branch, and three more land.
      const lit = t >= at(env, B.y1988, 'twenty') - 0.6 + i * 0.03
      const gone = i >= 13 ? e.exit(clamp((t - at(env, B.y2004, 'thirteen') - (i - 13) * 0.05) / 0.4)) : 0
      return { lit, gone }
    }
    // The hook: twenty empty frames, the jobs before anyone is counted.
    const hk = e.enter(clamp((t + 0.2) / 0.8)) * (1 - e.exit(clamp((t - at(env, B.y1988, 'twenty') + 0.6) / 0.3)))
    if (hk > 0.01) { ctx.save(); ctx.globalAlpha = hk; ctx.strokeStyle = c.ink; ctx.lineWidth = 4; for (let i = 0; i < 20; i++) ctx.strokeRect(x0 + (i % 10) * (sq + gap) + 2, y0 + Math.floor(i / 10) * (sq + gap) + 2, sq - 4, sq - 4); ctx.restore() }
    // The ask: one task, and the copies it allows once it costs less.
    if (t >= at(env, B.ask, 'pick') - 0.2) {
      const one = e.hero(clamp((t - at(env, B.ask, 'pick') + 0.2) / 0.4))
      ctx.globalAlpha = one; ctx.fillStyle = c.ink; ctx.fillRect(x0, y0, sq * 2 + gap, sq * 2 + gap); ctx.globalAlpha = 1
      for (let i = 0; i < 12; i++) {
        const k = e.hero(clamp((t - at(env, B.ask, 'more') + 0.4 - i * 0.07) / 0.35)); if (k <= 0) continue
        const x = x0 + (2 + (i % 6)) * (sq + gap) + gap, y = y0 + Math.floor(i / 6) * (sq + gap)
        ctx.globalAlpha = k; ctx.fillStyle = c.mint; ctx.fillRect(x + (1 - k) * -60, y, sq, sq); ctx.globalAlpha = 1
      }
    }
    const branches = t >= at(env, B.didnt, 'opened') - 0.2 && t < at(env, B.talk) - 0.2
    const tellers = t >= at(env, B.y1988) && t < at(env, B.didnt, 'opened') - 0.2
    if (tellers) for (let i = 0; i < 20; i++) {
      const { lit, gone } = per(i); if (!lit || gone >= 1) continue
      const x = x0 + (i % 10) * (sq + gap), y = y0 + Math.floor(i / 10) * (sq + gap) + gone * 120
      ctx.globalAlpha = 1 - gone; ctx.fillStyle = i < 13 || gone === 0 ? c.ink : c.muted; ctx.fillRect(x, y, sq, sq); ctx.globalAlpha = 1
    }
    if (branches) for (let i = 0; i < 10; i++) {
      const extra = i >= 7, k = extra ? e.hero(clamp((t - at(env, B.didnt, 'Forty') - (i - 7) * 0.18) / 0.4)) : e.enter(clamp((t - at(env, B.didnt, 'opened') + 0.2 - i * 0.05) / 0.3))
      if (k <= 0) continue
      const x = x0 + i * (sq + gap), y = y0 + (1 - k) * -80
      ctx.globalAlpha = k; ctx.fillStyle = extra ? c.mint : c.ink; ctx.fillRect(x, y, sq, sq * 1.4)
      ctx.fillStyle = extra ? c.ink : c.cream; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + sq / 2, y - 30); ctx.lineTo(x + sq + 6, y); ctx.fill(); ctx.globalAlpha = 1
    }
    // Level: two bars of equal length, 1988 and 2004.
    if (t >= at(env, B.same) - 0.2 && t < at(env, B.talk) + 0.2) {
      const a = e.utility(clamp((t - at(env, B.same, 'total')) / 0.6)), b = e.utility(clamp((t - at(env, B.same, 'stayed') + 0.1) / 0.6))
      const o = 1 - e.exit(clamp((t - at(env, B.talk)) / 0.3))
      ctx.globalAlpha = o; ctx.fillStyle = c.ink; ctx.fillRect(x0, 1560, 880 * a, 56); ctx.fillStyle = c.mint; ctx.fillRect(x0, 1640, 880 * b, 56); ctx.globalAlpha = 1
    }
  }
  house.dress(env, ctx)
}

export function cues({ timeline }) {
  const w = (b, s) => timeline.beats[b].words.find((x) => x.w.toLowerCase().startsWith(s.toLowerCase())).s
  // Swiss sound: dry and percussive, one tick per word that lands, one thump per mint block.
  const out = [{ t: 0.05, kind: 'thump', gain: 0.4 }]
  for (const [b, s] of [[0, 'teller'], [1, 'twenty'], [2, 'thirteen'], [3, 'expect'], [4, "didn't"], [4, 'opened'], [6, 'counting'], [6, 'talking'], [7, 'Fewer'], [7, 'More'], [9, 'pick'], [9, 'costs']]) out.push({ t: w(b, s) - 0.12, kind: 'tick', gain: 0.8 })
  for (const [b, s] of [[4, 'Forty'], [5, 'stayed'], [9, 'what']]) out.push({ t: w(b, s) - 0.12, kind: 'thump', gain: 0.45 })
  for (let i = 0; i < 20; i++) out.push({ t: w(1, 'twenty') - 0.6 + i * 0.03, kind: 'key', gain: 0.35 })
  for (let i = 0; i < 7; i++) out.push({ t: w(2, 'thirteen') + i * 0.05, kind: 'count', gain: 0.4 })
  out.push({ t: w(5, 'stayed'), kind: 'chime', gain: 0.4 })
  return out
}
