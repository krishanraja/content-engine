// The counter: a teller's window, a cash machine and a counter, acting out a line about a person's job.
// Modes follow the times given: opening (cash machine in, teller rises, notes handed over), ghost (the teller fades
// to a dashed outline while the machine glows; pops back with a burst), talk (cash slides off; a customer steps up;
// speech bubbles alternate). Box 1280 x 940.
import { clamp, lerp, rr, label, note } from '../_kit.mjs'

export function draw(g, t, p, tokens = p.c) {
  p = { ...p, c: tokens }
  const { c, e, W } = p, T = p.times
  const inOpening = t < T.openEnd, inTalk = t >= T.talkStart - 0.3
  label(g, p.title ?? 'THE COUNTER', 40, 76, 38, c.creamSoft)
  const km = inOpening ? e.hero(clamp((t - T.cash + 0.3) / 0.6)) : 1
  const shake = inOpening ? clamp((t - T.ended) / 0.5) * (1 - clamp((t - T.ended - 0.5) / 0.3)) : 0
  const smug = !inOpening && !inTalk ? clamp((t - T.disappear) / 0.4) * (1 - clamp((t - T.backStart) / 0.3)) : 0
  const mx = 70 - (1 - km) * 300 + Math.sin(t * 60) * 6 * shake
  g.save(); g.globalAlpha = km
  if (smug > 0) { g.shadowColor = c.mint; g.shadowBlur = 60 * smug }
  rr(g, mx, 230, 260, 560, 26, c.inkSoft, c.line, 4)
  g.shadowBlur = 0
  rr(g, mx + 30, 270, 200, 140, 14, c.mint)
  g.fillStyle = c.ink; g.globalAlpha = km * (0.6 + 0.4 * Math.sin(t * 9) * shake); g.fillRect(mx + 55, 320, 150, 16); g.fillRect(mx + 55, 352, 100, 16)
  g.globalAlpha = km; g.fillStyle = c.line; g.fillRect(mx + 60, 470, 140, 14); g.fillRect(mx + 40, 640, 180, 24)
  for (let i = 0; i < 9; i++) { g.fillStyle = c.line; g.fillRect(mx + 50 + (i % 3) * 60, 520 + Math.floor(i / 3) * 34, 44, 22) }
  g.restore()
  const ghost = !inOpening && !inTalk ? e.utility(clamp((t - T.disappear) / 0.5)) * (1 - clamp((t - T.didnt) / 0.15)) : 0
  const back = !inOpening && !inTalk ? e.hero(clamp((t - T.didnt) / 0.45)) : 0
  const kw = inOpening ? e.hero(clamp((t - T.bank + 0.2) / 0.5)) : 1
  g.save(); g.globalAlpha = kw
  rr(g, 600, 150, 520, 420, 22, ghost > 0.5 ? c.ink : c.inkSoft, c.cream, 6)
  rr(g, 760, 112, 200, 64, 14, c.cream); label(g, p.sign ?? 'TELLER', 860, 158, 36, c.ink, { align: 'center', weight: 700 })
  g.restore()
  const kt = inOpening ? e.hero(clamp((t - T.teller) / 0.5)) : 1
  const bounce = back > 0 && back < 1 ? Math.sin(Math.PI * back) * 40 : 0
  const tx = 860, ty = 560 + (1 - kt) * 140 - bounce
  g.save(); g.beginPath(); g.rect(600, 150, 520, 420); g.clip()
  if (ghost > 0.5) {
    g.setLineDash([18, 14]); g.strokeStyle = c.muted; g.lineWidth = 6
    g.beginPath(); g.arc(tx, ty + 30, 175, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(tx, ty - 230, 72, 0, Math.PI * 2); g.stroke()
  } else {
    g.globalAlpha = kt * (1 - ghost * 2)
    g.fillStyle = c.channel; g.beginPath(); g.arc(tx, ty + 30, 175, Math.PI, 0); g.fill()
    g.fillStyle = c.cream; g.beginPath(); g.moveTo(tx - 46, ty - 140); g.lineTo(tx, ty - 70); g.lineTo(tx + 46, ty - 140); g.closePath(); g.fill()
    g.fillStyle = c.ink; g.fillRect(tx - 8, ty - 120, 16, 90)
    g.fillStyle = c.creamSoft; g.beginPath(); g.arc(tx, ty - 230, 72, 0, Math.PI * 2); g.fill()
    g.fillStyle = c.ink; g.beginPath(); g.arc(tx, ty - 262, 76, Math.PI * 1.05, Math.PI * 1.95); g.fill()
    const look = inTalk ? e.enter(clamp((t - T.talking) / 0.4)) * -10 : 0
    g.beginPath(); g.arc(tx - 26 + look, ty - 226 - look * 0.3, 7, 0, Math.PI * 2); g.arc(tx + 26 + look, ty - 226 - look * 0.3, 7, 0, Math.PI * 2); g.fill()
    g.lineWidth = 6; g.strokeStyle = c.ink; g.beginPath(); g.arc(tx, ty - 206, 22, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke()
    rr(g, tx + 64, ty - 110, 84, 52, 8, c.ink); g.fillStyle = c.channel; g.fillRect(tx + 76, ty - 92, 60, 8)
  }
  g.restore()
  if (back > 0 && back < 1) for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r = 120 + 200 * back
    g.save(); g.globalAlpha = 1 - back; g.strokeStyle = c.mint; g.lineWidth = 8
    g.beginPath(); g.moveTo(tx + Math.cos(a) * r * 0.8, 330 + Math.sin(a) * r * 0.8); g.lineTo(tx + Math.cos(a) * r, 330 + Math.sin(a) * r); g.stroke(); g.restore()
  }
  g.fillStyle = c.creamSoft; g.fillRect(380, 560, W - 420, 30); g.fillStyle = c.line; g.fillRect(380, 590, W - 420, 320)
  if (inOpening) {
    const kh = e.hero(clamp((t - T.you + 0.2) / 0.5))
    g.save(); g.globalAlpha = kh; g.fillStyle = c.cream
    g.beginPath(); g.ellipse(760, 790, 120, 56, -0.2, 0, Math.PI * 2); g.fill()
    for (let f = 0; f < 4; f++) { g.beginPath(); g.ellipse(680 + f * 40, 730 - (f === 0 ? -10 : 0), 22, 46, -0.3, 0, Math.PI * 2); g.fill() }
    g.restore()
    for (let i = 0; i < 3; i++) {
      const k = e.hero(clamp((t - T.hands - i * 0.18) / 0.6))
      if (k <= 0) continue
      note(g, c, lerp(tx - 40, 760, k) + i * 10, lerp(500, 720, k) - i * 10 - Math.sin(Math.PI * k) * 70, -0.2 + i * 0.1)
    }
  }
  if (inTalk) {
    const off = e.exit(clamp((t - T.stopped) / 0.6))
    for (let i = 0; i < 4; i++) note(g, c, 1000 + off * 400, 540 - i * 14, 0.05 * i)
    const kc = e.hero(clamp((t - T.spent) / 0.5))
    g.save(); g.globalAlpha = kc
    g.fillStyle = c.cream; g.beginPath(); g.arc(560, 700 + (1 - kc) * 80, 80, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.arc(560, 980 + (1 - kc) * 80, 190, Math.PI, 0); g.fill()
    g.restore()
    for (let i = 0; i < 5; i++) {
      const k = e.hero(clamp((t - T.talking - i * 0.32) / 0.3)) * (1 - clamp((t - T.talking - i * 0.32 - 0.9) / 0.3))
      if (k <= 0) continue
      const left = i % 2 === 0, bx = left ? 420 : 960, by = 330 - (i % 3) * 30
      g.save(); g.globalAlpha = k; g.translate(bx, by); g.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k)
      rr(g, -110, -60, 220, 120, 50, left ? c.cream : c.mint)
      g.fillStyle = c.ink; for (let d = 0; d < 3; d++) { g.beginPath(); g.arc(-40 + d * 40, 0, 12, 0, Math.PI * 2); g.fill() }
      g.restore()
    }
  }
}
