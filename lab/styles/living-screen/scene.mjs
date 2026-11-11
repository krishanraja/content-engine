// The Living Screen, v3: a product interface, rebuilt in code, that comes apart in 3D and performs on cue.
// Krish, 10 Nov 2026, on v2: "the living screen looks incomplete and kind of boring. There's not enough animation,
// movement, or visual stimulation at all." So in v3 something new happens every one to two seconds:
// - every card and chart is its own panel that lifts off the screen, glowing, when it is spoken about;
// - light pulses race along the neon streaks; lit dust drifts through the room; the camera keeps orbiting;
// - avatars light up and drop away, branch pins drop onto a city map with ripples, notifications slide in,
//   speech bubbles pop, and the chart's lines draw with glowing heads.
// Bar set by Krish's references: the Mon 9 Nov cut (a real artefact on ink, neon, glow) and The Ladder v2.
// Draws frame t from t alone.
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { clamp, lerp, text } from '../_core/house.mjs'

const B = { hook: 0, y1988: 1, y2004: 2, expect: 3, didnt: 4, same: 5, talk: 6, two: 7, watch: 8, ask: 9 }
const at = (env, b, word) => (word ? env.word(b, word).s : env.beat(b).s)
const col = (hex) => new THREE.Color(hex)
const UW = 2400, UH = 1600, SW = 6, SH = 4
let R

// The interface's parts, in interface pixels: [x, y, w, h].
const RECT = {
  cardA: [480, 150, 600, 420], cardB: [1120, 150, 600, 420], cardC: [1760, 150, 600, 420],
  main: [480, 620, 1240, 940], map: [1760, 620, 600, 940], toast: [1560, 40, 800, 150],
  hook: [560, 330, 1280, 940], // the counter scene the opening line acts out (Krish, 10 Nov: "some sort of bank teller visual")
}
const toLocal = (x, y) => [(x / UW - 0.5) * SW, (0.5 - y / UH) * SH]

function rr(g, x, y, w, h, r, fill, stroke, lw = 3) {
  g.beginPath(); g.roundRect(x, y, w, h, r)
  if (fill) { g.fillStyle = fill; g.fill() }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke() }
}
function label(g, s, x, y, size, color, { font = 'IBM Plex Mono', weight = 600, align = 'left', track = 3 } = {}) {
  g.font = `${weight} ${size}px '${font}'`; g.fillStyle = color; g.textAlign = align; g.letterSpacing = `${track}px`; g.fillText(s, x, y); g.letterSpacing = '0px'; g.textAlign = 'left'
}
function avatar(g, x, y, s, color, alpha = 1) {
  if (alpha <= 0.01) return
  g.save(); g.globalAlpha *= alpha; g.fillStyle = color
  g.beginPath(); g.arc(x, y - 12 * s, 9 * s, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(x, y + 14 * s, 15 * s, Math.PI, 0); g.fill(); g.restore()
}

function note(g, c, x, y, rot) {
  g.save(); g.translate(x, y); g.rotate(rot)
  rr(g, -95, -44, 190, 88, 8, c.mint, c.ink, 3); g.strokeStyle = c.ink; g.lineWidth = 3; g.strokeRect(-80, -32, 160, 64)
  g.fillStyle = c.ink; g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill(); g.restore()
}

// --------------------------------------------------------------- what each panel draws

const DRAW = {
  hook(env, g, t, W, H) {
    // The counter: the piece's recurring set. It acts out the opening line, comes back for "expect those jobs to
    // disappear" and "They didn't", and again for "stopped counting cash ... talking to customers".
    const c = env.skin.colors
    const w0 = (s) => env.word(B.hook, s).s
    const inOpening = t < at(env, B.y1988, 'city'), inTalk = t >= at(env, B.talk) - 0.3
    label(g, 'THE COUNTER', 40, 76, 38, c.creamSoft)
    // The cash machine: slides in on "Cash machines", flickers on "ended"; glows smugly on "disappear".
    const km = inOpening ? env.ease.hero(clamp((t - w0('Cash') + 0.3) / 0.6)) : 1
    const shake = inOpening ? clamp((t - w0('ended')) / 0.5) * (1 - clamp((t - w0('ended') - 0.5) / 0.3)) : 0
    const smug = !inOpening && !inTalk ? clamp((t - at(env, B.expect, 'disappear')) / 0.4) * (1 - clamp((t - at(env, B.didnt)) / 0.3)) : 0
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
    // The teller's window and sign. The window light dims while the teller is a ghost.
    const ghost = !inOpening && !inTalk ? env.ease.utility(clamp((t - at(env, B.expect, 'disappear')) / 0.5)) * (1 - clamp((t - at(env, B.didnt, "didn't")) / 0.15)) : 0
    const back = !inOpening && !inTalk ? env.ease.hero(clamp((t - at(env, B.didnt, "didn't")) / 0.45)) : 0
    const kw = inOpening ? env.ease.hero(clamp((t - w0('bank') + 0.2) / 0.5)) : 1
    g.save(); g.globalAlpha = kw
    rr(g, 600, 150, 520, 420, 22, ghost > 0.5 ? c.ink : c.inkSoft, c.cream, 6)
    rr(g, 760, 112, 200, 64, 14, c.cream); label(g, 'TELLER', 860, 158, 36, c.ink, { align: 'center', weight: 700 })
    g.restore()
    // The teller: rises on "teller"; fades to a dashed outline on "disappear"; pops back on "didn't" with a burst.
    const kt = inOpening ? env.ease.hero(clamp((t - w0('teller')) / 0.5)) : 1
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
      // In the talk scene the teller turns to the customer: eyes look down-left.
      const look = inTalk ? env.ease.enter(clamp((t - at(env, B.talk, 'talking')) / 0.4)) * -10 : 0
      g.beginPath(); g.arc(tx - 26 + look, ty - 226 - look * 0.3, 7, 0, Math.PI * 2); g.arc(tx + 26 + look, ty - 226 - look * 0.3, 7, 0, Math.PI * 2); g.fill()
      g.lineWidth = 6; g.strokeStyle = c.ink; g.beginPath(); g.arc(tx, ty - 206, 22, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke()
      rr(g, tx + 64, ty - 110, 84, 52, 8, c.ink); g.fillStyle = c.channel; g.fillRect(tx + 76, ty - 92, 60, 8)
    }
    g.restore()
    if (back > 0 && back < 1) for (let i = 0; i < 12; i++) {   // the burst as the teller comes back
      const a = (i / 12) * Math.PI * 2, r = 120 + 200 * back
      g.save(); g.globalAlpha = 1 - back; g.strokeStyle = c.mint; g.lineWidth = 8
      g.beginPath(); g.moveTo(tx + Math.cos(a) * r * 0.8, 330 + Math.sin(a) * r * 0.8); g.lineTo(tx + Math.cos(a) * r, 330 + Math.sin(a) * r); g.stroke(); g.restore()
    }
    // The counter.
    g.fillStyle = c.creamSoft; g.fillRect(380, 560, W - 420, 30); g.fillStyle = c.line; g.fillRect(380, 590, W - 420, 320)
    if (inOpening) {
      // "hands you your cash": notes pass over the counter to a customer's hand.
      const kh = env.ease.hero(clamp((t - w0('you') + 0.2) / 0.5))
      g.save(); g.globalAlpha = kh; g.fillStyle = c.cream
      g.beginPath(); g.ellipse(760, 790, 120, 56, -0.2, 0, Math.PI * 2); g.fill()
      for (let f = 0; f < 4; f++) { g.beginPath(); g.ellipse(680 + f * 40, 730 - (f === 0 ? -10 : 0), 22, 46, -0.3, 0, Math.PI * 2); g.fill() }
      g.restore()
      for (let i = 0; i < 3; i++) {
        const k = env.ease.hero(clamp((t - w0('hands') - i * 0.18) / 0.6))
        if (k <= 0) continue
        note(g, c, lerp(tx - 40, 760, k) + i * 10, lerp(500, 720, k) - i * 10 - Math.sin(Math.PI * k) * 70, -0.2 + i * 0.1)
      }
    }
    if (inTalk) {
      // "stopped counting cash": the stack on the counter slides off; "talking to customers": a customer steps up
      // and speech bubbles go back and forth.
      const off = env.ease.exit(clamp((t - at(env, B.talk, 'stopped')) / 0.6))
      for (let i = 0; i < 4; i++) note(g, c, 1000 + off * 400, 540 - i * 14, 0.05 * i)
      const kc = env.ease.hero(clamp((t - at(env, B.talk, 'spent')) / 0.5))
      g.save(); g.globalAlpha = kc
      g.fillStyle = c.cream; g.beginPath(); g.arc(560, 700 + (1 - kc) * 80, 80, 0, Math.PI * 2); g.fill()     // the customer, from behind
      g.beginPath(); g.arc(560, 980 + (1 - kc) * 80, 190, Math.PI, 0); g.fill()
      g.restore()
      for (let i = 0; i < 5; i++) {
        const k = env.ease.hero(clamp((t - at(env, B.talk, 'talking') - i * 0.32) / 0.3)) * (1 - clamp((t - at(env, B.talk, 'talking') - i * 0.32 - 0.9) / 0.3))
        if (k <= 0) continue
        const left = i % 2 === 0, bx = left ? 420 : 960, by = 330 - (i % 3) * 30
        g.save(); g.globalAlpha = k; g.translate(bx, by); g.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k)
        rr(g, -110, -60, 220, 120, 50, left ? c.cream : c.mint)
        g.fillStyle = c.ink; for (let d = 0; d < 3; d++) { g.beginPath(); g.arc(-40 + d * 40, 0, 12, 0, Math.PI * 2); g.fill() }
        g.restore()
      }
    }
  },
  cardA(env, g, t, W, H) {
    const c = env.skin.colors
    label(g, 'PER BRANCH', 36, 70, 34, c.creamSoft)
    const yr = t >= at(env, B.y2004) ? '2004' : '1988'
    rr(g, W - 190, 30, 150, 60, 30, t >= at(env, B.y2004) ? c.channel : c.line); label(g, yr, W - 115, 72, 34, t >= at(env, B.y2004) ? c.ink : c.cream, { align: 'center', track: 1 })
    const f0 = at(env, B.y1988, 'city'), f1 = at(env, B.y1988, 'twenty'), d0 = at(env, B.y2004, 'thirteen') - 0.35
    const n = t < f0 ? 0 : t < d0 ? Math.round(20 * clamp((t - f0) / (f1 - f0 + 0.15))) : Math.round(lerp(20, 13, env.ease.utility(clamp((t - d0) / 0.4))))
    if (t >= f0) { g.font = `200px 'Anton'`; g.fillStyle = c.cream; g.fillText(String(n), 36, 300) } // never a "0" before the count
    if (t >= d0 + 0.4) { g.font = `96px 'Anton'`; g.fillStyle = c.muted; g.fillText('20', 260, 300); g.fillRect(254, 262, 112, 9) }
    // Twenty avatars light one by one; seven drop away in 2004.
    for (let i = 0; i < 20; i++) {
      const on = clamp((t - (f0 + (f1 - f0) * (i / 20))) / 0.15)
      const gone = i >= 13 ? env.ease.exit(clamp((t - d0 - (i - 13) * 0.05) / 0.35)) : 0
      const x = 40 + (i % 10) * 54, y = 345 + Math.floor(i / 10) * 44 + gone * 40
      avatar(g, x + 14, y, 1, on > 0.5 && gone < 0.5 ? c.channel : c.line, 1 - gone)
    }
  },
  cardB(env, g, t, W) {
    const c = env.skin.colors
    label(g, 'CITY BRANCHES', 36, 70, 34, c.creamSoft)
    const k = env.ease.utility(clamp((t - at(env, B.didnt, 'Forty-three')) / 0.8))
    if (t >= at(env, B.didnt, 'Forty-three')) {
      const s = `+${Math.round(43 * k)}%`; g.font = `200px 'Anton'`; const w = g.measureText(s).width
      g.fillStyle = c.channel; g.fillRect(28, 120, (w + 24) * k, 190); g.fillStyle = c.ink; g.fillText(s, 40, 290)
    } else {
      // "Each branch got cheaper to run": the running cost of one branch shrinks.
      const kc = env.ease.utility(clamp((t - at(env, B.didnt, 'cheaper')) / 0.8))
      label(g, 'COST TO RUN', 40, 160, 34, c.muted)
      rr(g, 40, 190, 520 * lerp(1, 0.6, kc), 70, 12, kc > 0 ? c.cream : c.line)
      if (kc > 0) { g.fillStyle = c.mint; g.beginPath(); const ax = 40 + 520 * lerp(1, 0.6, kc) + 40; g.moveTo(ax - 22, 205); g.lineTo(ax + 22, 205); g.lineTo(ax, 245); g.closePath(); g.fill() }
    }
    // Bars: seven, then three more grow.
    for (let i = 0; i < 10; i++) {
      const kk = i < 7 ? env.ease.hero(clamp((t - at(env, B.didnt, 'opened') - i * 0.06) / 0.4)) : env.ease.hero(clamp((t - at(env, B.didnt, 'Forty-three') - (i - 7) * 0.15) / 0.45))
      g.fillStyle = i < 7 ? c.creamSoft : c.channel; g.fillRect(40 + i * 52, 400 - 60 * kk, 36, 60 * kk)
    }
  },
  cardC(env, g, t) {
    const c = env.skin.colors
    label(g, 'TELLER JOBS', 36, 70, 34, c.creamSoft)
    // Two equal rows of tellers, 1988 and 2004, and a mint equals sign on "stayed".
    for (const [row, yr, word] of [[0, '1988', 'total'], [1, '2004', 'teller']]) {
      label(g, yr, 36, 158 + row * 90, 30, c.muted, { track: 1 })
      for (let i = 0; i < 8; i++) {
        const k = env.ease.hero(clamp((t - at(env, B.same, word) - i * 0.05) / 0.3))
        avatar(g, 150 + i * 46, 150 + row * 90, 1.1, c.channel, k)
      }
    }
    const ke = env.ease.hero(clamp((t - at(env, B.same, 'stayed')) / 0.4))
    if (ke > 0) { g.save(); g.globalAlpha = ke; g.font = `150px 'Anton'`; g.fillStyle = c.mint; g.fillText('=', 520, 250); g.restore() }
    const k = env.ease.enter(clamp((t - at(env, B.same, 'stayed')) / 0.8))
    if (k <= 0) return
    g.strokeStyle = c.mint; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(40, 330); g.lineTo(40 + 520 * k, 330); g.stroke()
    label(g, 'LEVEL', 40, 395, 50, c.mint, { weight: 700 })
  },
  main(env, g, t, W, H) {
    const c = env.skin.colors
    const kT = env.ease.enter(clamp((t - at(env, B.talk) + 0.1) / 0.5)) * (1 - clamp((t - at(env, B.two)) / 0.3))
    const kAsk = env.ease.enter(clamp((t - at(env, B.ask, 'pick')) / 0.5))
    if (kAsk > 0.5) {
      // The ask: one task ticks done, then four new slots pop open.
      label(g, 'THIS WEEK', 40, 80, 38, c.creamSoft)
      rr(g, 40, 130, W - 80, 160, 24, c.inkSoft, c.line, 2); g.fillStyle = c.creamSoft; g.fillRect(100, 200, 560, 22)
      const kd = env.ease.enter(clamp((t - at(env, B.ask, 'does')) / 0.4))
      rr(g, W - 200, 160, 110, 100, 22, kd > 0.5 ? c.mint : null, c.cream, 5)
      if (kd > 0.5) { g.strokeStyle = c.ink; g.lineWidth = 12; g.beginPath(); g.moveTo(W - 175, 210); g.lineTo(W - 150, 235); g.lineTo(W - 110, 185); g.stroke() }
      for (let i = 0; i < 4; i++) {
        const kk = env.ease.hero(clamp((t - at(env, B.ask, 'Then') - i * 0.3) / 0.5))
        if (kk <= 0) continue
        const x = 40 + i * 290, y = 380 + (1 - kk) * 80
        g.save(); g.globalAlpha = kk; rr(g, x, y, 260, 380, 28, c.ink, c.mint, 6)
        g.fillStyle = c.mint; g.fillRect(x + 100, y + 180, 60, 16); g.fillRect(x + 122, y + 158, 16, 60)
        g.restore()
      }
      return
    }
    if (kT > 0.5) {
      // Customers: tellers turn from the cash drawer to people; bubbles pop one after another.
      label(g, 'TIME AT THE COUNTER', 40, 80, 38, c.creamSoft)
      const cash = lerp(1, 0.3, env.ease.utility(clamp((t - at(env, B.talk, 'counting')) / 0.9)))
      const talk = lerp(0.25, 1, env.ease.utility(clamp((t - at(env, B.talk, 'talking')) / 0.9)))
      rr(g, 40, 140, 120, 80, 12, null, c.cream, 6); g.fillStyle = c.cream; g.beginPath(); g.arc(100, 180, 18, 0, Math.PI * 2); g.fill()
      rr(g, 200, 140, 960 * cash, 80, 18, c.creamSoft)
      g.strokeStyle = c.mint; g.lineWidth = 7; g.beginPath(); g.ellipse(100, 300, 58, 40, 0, 0, Math.PI * 2); g.stroke()
      rr(g, 200, 260, 960 * talk, 80, 18, c.mint)
      for (let i = 0; i < 6; i++) {
        const kk = env.ease.hero(clamp((t - at(env, B.talk, 'spent') - i * 0.22) / 0.4))
        const x = 110 + i * 180, y = 640
        avatar(g, x, y + 120, 2.2, c.creamSoft, kk); avatar(g, x + 70, y + 120, 2.2, c.channel, kk)
        if (kk > 0) { g.save(); g.globalAlpha = kk; rr(g, x - 10, y - 30 - kk * 20, 110, 70, 30, c.mint); g.restore() }
      }
      return
    }
    // The chart: the expected dive, then the two lines that really moved, each with a glowing head.
    label(g, 'TELLERS AND BRANCHES', 40, 80, 38, c.creamSoft)
    g.strokeStyle = c.line; g.lineWidth = 2
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(80, 180 + i * 160); g.lineTo(W - 60, 180 + i * 160); g.stroke() }
    label(g, '1988', 80, H - 40, 34, c.muted); label(g, '2004', W - 60, H - 40, 34, c.muted, { align: 'right' })
    const xs = Array.from({ length: 33 }, (_, i) => 80 + i * ((W - 140) / 32))
    const line = (pts, k, color, width, dash = []) => {
      if (k <= 0) return null
      const n = Math.max(1, Math.floor((pts.length - 1) * k)), f = (pts.length - 1) * k - n
      g.save(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.beginPath()
      pts.slice(0, n + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
      const head = n < pts.length - 1 ? [lerp(pts[n][0], pts[n + 1][0], f), lerp(pts[n][1], pts[n + 1][1], f)] : pts[n]
      g.lineTo(...head); g.stroke(); g.restore()
      g.fillStyle = color; g.beginPath(); g.arc(head[0], head[1], width * 1.6, 0, Math.PI * 2); g.fill()
      return head
    }
    const kE = env.ease.utility(clamp((t - at(env, B.expect, 'expect')) / 1.5)) * (1 - clamp((t - at(env, B.didnt) - 0.2) / 0.5))
    line(xs.map((x, i) => [x, 200 + (i / 32) ** 2 * 640]), kE, c.muted, 10, [28, 22])
    if (kE > 0.2) label(g, 'EXPECTED', W - 60, 860, 40, c.muted, { align: 'right' })
    const kP = env.ease.utility(clamp((t - at(env, B.two, 'Fewer')) / 0.9)), kR = env.ease.utility(clamp((t - at(env, B.two, 'More')) / 0.8))
    const watch = env.ease.enter(clamp((t - at(env, B.watch)) / 0.4))
    line(xs.map((x, i) => [x, 220 + (i / 32) * 260]), kP, c.creamSoft, 12)
    const head = line(xs.map((x, i) => [x, 760 - (i / 32) * 520]), kR, watch > 0.5 ? c.mint : c.cream, 14 + 6 * watch)
    if (kP > 0.9) label(g, 'PER BRANCH', W - 60, 540, 42, c.creamSoft, { align: 'right' })
    if (kR > 0.9) label(g, 'BRANCHES', W - 60, 200, 48, watch > 0.5 ? c.mint : c.cream, { align: 'right', weight: 700 })
    if (watch > 0 && head) for (let r = 0; r < 3; r++) {
      const u = ((t - at(env, B.watch)) * 1.2 + r / 3) % 1
      g.strokeStyle = c.mint; g.globalAlpha = 1 - u; g.lineWidth = 6; g.beginPath(); g.arc(head[0], head[1], 20 + 90 * u, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1
    }
  },
  map(env, g, t, W, H) {
    const c = env.skin.colors
    label(g, 'CITY', 36, 70, 34, c.creamSoft)
    // A street grid; pins drop as branches open (seven, then three more on "Forty-three"), each with a ripple.
    g.strokeStyle = c.line; g.lineWidth = 3
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(30, 140 + i * 120); g.lineTo(W - 30, 140 + i * 120 + 30); g.stroke() }
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(60 + i * 125, 110); g.lineTo(40 + i * 125, H - 40); g.stroke() }
    const PINS = [[120, 230], [360, 200], [500, 330], [200, 450], [420, 520], [140, 680], [480, 720], [300, 300], [260, 610], [500, 860]]
    PINS.forEach(([x, y], i) => {
      const t0 = i < 7 ? at(env, B.didnt, 'opened') + i * 0.12 : at(env, B.didnt, 'Forty-three') + (i - 7) * 0.2
      const k = env.ease.hero(clamp((t - t0) / 0.45))
      if (k <= 0) return
      const u = clamp((t - t0 - 0.3) / 0.8)
      if (u > 0 && u < 1) { g.strokeStyle = i < 7 ? c.cream : c.channel; g.globalAlpha = 1 - u; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y, 20 + 60 * u, 10 + 30 * u, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1 }
      const py = y - (1 - k) * 160
      g.fillStyle = i < 7 ? c.cream : c.channel
      g.beginPath(); g.arc(x, py - 40, 24, Math.PI, 0); g.lineTo(x, py); g.closePath(); g.fill()
      g.fillStyle = c.ink; g.beginPath(); g.arc(x, py - 42, 9, 0, Math.PI * 2); g.fill()
    })
  },
  toast(env, g, t, W, H) {
    const c = env.skin.colors
    const T = [[at(env, B.y2004, 'thirteen'), '−7 TELLERS PER BRANCH', c.cream], [at(env, B.didnt, 'Forty-three') + 0.6, '+43% CITY BRANCHES', c.channel],
      [at(env, B.same, 'stayed') + 0.3, 'HELD LEVEL', c.mint]]
    const cur = T.filter(([s]) => t >= s && t < s + 2.4).at(-1)
    if (!cur) return
    rr(g, 6, 6, W - 12, H - 12, 36, c.ink, cur[2], 5)
    g.fillStyle = cur[2]; g.beginPath(); g.arc(70, H / 2, 20, 0, Math.PI * 2); g.fill()
    label(g, cur[1], 120, H / 2 + 18, 44, c.cream, { weight: 700, track: 2 })
  },
}
// The counter scene's three appearances: [in, out].
function hookOn(env, t) {
  const W = [[env.word(B.hook, 'Cash').s - 0.4, at(env, B.y1988, 'city') - 0.6], [at(env, B.expect, 'expect') - 0.3, at(env, B.didnt, 'Each') - 0.4],
    [at(env, B.talk) - 0.3, at(env, B.two) - 0.4]]
  return Math.max(...W.map(([a, b]) => env.ease.hero(clamp((t - a) / 0.5)) * (1 - env.ease.exit(clamp((t - b) / 0.45)))))
}
function toastOn(env, t) {
  const S = [at(env, B.y2004, 'thirteen'), at(env, B.didnt, 'Forty-three') + 0.6, at(env, B.same, 'stayed') + 0.3]
  return Math.max(...S.map((s) => env.ease.enter(clamp((t - s) / 0.35)) * (1 - env.ease.exit(clamp((t - s - 2.1) / 0.3)))))
}

// Which panel is lifted, when: [beat, word, panel].
const LIFT = [[B.hook, 'Cash', 'hook'], [B.y1988, 'city', 'cardA'], [B.expect, 'expect', 'hook'], [B.didnt, 'Each', 'cardB'],
  [B.didnt, 'opened', 'map'], [B.didnt, 'Forty-three', 'cardB'], [B.same, 'total', 'cardC'], [B.talk, null, 'hook'], [B.two, null, 'main'],
  [B.ask, 'pick', 'main']]
function lifted(env, t) {
  let cur = null, t0 = 0
  for (const [b, w, p] of LIFT) { const s = at(env, b, w) - 0.2; if (t >= s) { cur = p; t0 = s } }
  return { cur, t0 }
}

// --------------------------------------------------------------- the base screen: frame, tabs, ticker

function drawBase(env, g, t) {
  const c = env.skin.colors
  const grad = g.createLinearGradient(0, 0, UW, UH); grad.addColorStop(0, c.inkSoft); grad.addColorStop(1, c.ink)
  g.fillStyle = c.ink; g.fillRect(0, 0, UW, UH); rr(g, 0, 0, UW, UH, 40, grad)
  ;[0, 1, 2].forEach((i) => { g.fillStyle = c.line; g.beginPath(); g.arc(60 + i * 46, 50, 14, 0, Math.PI * 2); g.fill() })
  label(g, 'BRANCH STAFFING', 220, 64, 34, c.creamSoft)
  g.fillStyle = c.line; g.fillRect(0, 104, UW, 2); g.fillRect(440, 104, 2, UH - 104)
  const sel = t >= at(env, B.talk) - 0.2 ? 2 : t >= at(env, B.didnt, 'opened') - 0.2 ? 1 : 0
  ;['Staff', 'Branches', 'Customers'].forEach((name, i) => {
    if (i === sel) { rr(g, 32, 200 + i * 120, 380, 92, 18, c.ink, c.line, 2); g.fillStyle = c.channel; g.fillRect(32, 222 + i * 120, 8, 48) }
    g.font = `${i === sel ? 800 : 500} 50px 'Archivo'`; g.fillStyle = i === sel ? c.cream : c.muted; g.fillText(name, 80, 262 + i * 120)
  })
  // A live activity column in the sidebar: rows tick by, so the screen is never still.
  for (let i = 0; i < 8; i++) {
    const y = 700 + ((i * 110 + t * 60) % 880)
    g.globalAlpha = 0.5 * Math.sin(Math.PI * ((y - 700) / 880)); g.fillStyle = c.line; rr(g, 40, y, 360, 64, 14, c.line)
    g.fillStyle = c.muted; g.fillRect(70, y + 26, 160 + ((i * 37) % 120), 12); g.globalAlpha = 1
  }
  // Ghost slots under each panel.
  for (const k of ['cardA', 'cardB', 'cardC', 'main', 'map']) { const [x, y, w, h] = RECT[k]; rr(g, x, y, w, h, 28, null, c.line, 2) }
}

// --------------------------------------------------------------- build

function makePanel(scene, rig, key, mats) {
  const [x, y, w, h] = RECT[key]
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
  const pw = (w / UW) * SW, ph = (h / UH) * SH
  const group = new THREE.Group()
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(pw * 1.08, ph * 1.08), mats.shadow.clone()); shadow.position.z = 0.005
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(pw * 1.04, ph * 1.04), mats.glow.clone()); glow.position.z = 0.02
  const face = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, color: 0xd6d6d6, toneMapped: false, transparent: true }))
  face.position.z = 0.03
  group.add(glow); group.add(face)
  const [lx, ly] = toLocal(x + w / 2, y + h / 2)
  group.position.set(lx, ly, 0.02); shadow.position.set(lx + 0.06, ly - 0.06, 0.006)
  rig.add(shadow); rig.add(group)
  return { key, cv, g: cv.getContext('2d'), tex, group, glow, face, shadow, w, h, lx, ly }
}

export async function setup(env) {
  // Captions sit directly under the dress and the credit (Krish, 11 Nov: "A"); the panels sit below them.
  if (env.shape === 'tall') env.captionBase = 530
  const c = env.skin.colors
  const glc = document.createElement('canvas'); glc.width = env.W; glc.height = env.H
  const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(env.W, env.H, false); renderer.toneMapping = THREE.ACESFilmicToneMapping
  const scene = new THREE.Scene(); scene.background = col(c.ink); scene.fog = new THREE.Fog(col(c.ink), 12, 36)
  const camera = new THREE.PerspectiveCamera(env.shape === 'tall' ? 40 : 28, env.W / env.H, 0.05, 100)

  const base = document.createElement('canvas'); base.width = UW; base.height = UH
  const baseTex = new THREE.CanvasTexture(base); baseTex.colorSpace = THREE.SRGBColorSpace; baseTex.anisotropy = 8
  const rig = new THREE.Group()
  rig.add(new THREE.Mesh(new RoundedBoxGeometry(SW + 0.22, SH + 0.22, 0.18, 4, 0.1), new THREE.MeshStandardMaterial({ color: col(c.inkSoft), roughness: 0.25, metalness: 0.7 })))
  rig.children[0].position.z = -0.1
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: baseTex, color: 0xc8c8c8, toneMapped: false })); rig.add(screen)
  rig.position.set(0, 2.6, 0); rig.rotation.set(-0.06, -0.2, 0.02); scene.add(rig)

  const mats = {
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 }),
    glow: new THREE.MeshBasicMaterial({ color: col(c.channel), transparent: true, opacity: 0, toneMapped: false }),
  }
  const panels = Object.fromEntries(['cardA', 'cardB', 'cardC', 'main', 'map', 'toast', 'hook'].map((k) => [k, makePanel(scene, rig, k, mats)]))

  // A cursor on its own plane, always in front.
  const cur = document.createElement('canvas'); cur.width = cur.height = 128
  const cg = cur.getContext('2d'); cg.fillStyle = c.cream; cg.strokeStyle = c.ink; cg.lineWidth = 6
  cg.beginPath(); cg.moveTo(10, 8); cg.lineTo(10, 92); cg.lineTo(33, 71); cg.lineTo(68, 71); cg.closePath(); cg.fill(); cg.stroke()
  const curTex = new THREE.CanvasTexture(cur); curTex.colorSpace = THREE.SRGBColorSpace
  const cursor = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshBasicMaterial({ map: curTex, transparent: true, toneMapped: false }))
  rig.add(cursor)

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: col(c.ink), roughness: 0.4, metalness: 0.35 }))
  floor.rotation.x = -Math.PI / 2; scene.add(floor)
  scene.add(new THREE.HemisphereLight(col(c.cream), col(c.ink), 0.4))
  const key = new THREE.DirectionalLight(0xfff1dc, 1.2); key.position.set(-5, 9, 6); scene.add(key)

  // Neon streaks with light pulses racing along them.
  const pulse = document.createElement('canvas'); pulse.width = 1024; pulse.height = 4
  const pg = pulse.getContext('2d'); pg.fillStyle = '#000'; pg.fillRect(0, 0, 1024, 4)
  for (const [x, w] of [[120, 160], [520, 90], [780, 220]]) { const gr = pg.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.8, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); pg.fillStyle = gr; pg.fillRect(x, 0, w, 4) }
  const streaks = []
  const streak = (pts, color, r, speed) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
    const baseM = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, r, 10, false), new THREE.MeshStandardMaterial({ color: col(color), emissive: col(color), emissiveIntensity: 1.1 }))
    const tex = new THREE.CanvasTexture(pulse); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1)
    const p = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, r * 1.6, 10, false), new THREE.MeshBasicMaterial({ map: tex, color: col(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    scene.add(baseM); scene.add(p); streaks.push({ baseM, p, tex, speed })
  }
  streak([[-9, 0.4, -3], [-4.5, 1.1, -0.8], [-1, 0.6, 0.6], [2.5, 1.5, 0.4], [5, 4.8, -0.6], [9, 6.2, -3]], c.channel, 0.03, 0.22)
  streak([[-9, 5.6, -2.5], [-4, 4.9, -0.5], [0, 5.3, 0.4], [4, 4.6, 0.6], [9, 2.2, -2]], c.channel, 0.022, -0.17)
  streak([[-8, 1.8, -4], [-3, 0.9, -1.4], [1.5, 0.3, -1], [6, 0.8, -2.5], [10, 1.6, -5]], c.mint, 0.02, 0.3)

  // Lit dust drifting through the room.
  const N = 420, pos = new Float32Array(N * 3), seed = []
  let s = 11
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < N; i++) seed.push([rnd() * 18 - 9, rnd() * 7, rnd() * 10 - 6, rnd() * 6.28])
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: col(c.cream), size: 0.035, transparent: true, opacity: 0.7, toneMapped: false }))
  scene.add(dust)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(env.W / 2, env.H / 2), 0.65, 0.5, 0.88))
  composer.addPass(new OutputPass())
  R = { renderer, scene, camera, composer, rig, screen, base, bg: base.getContext('2d'), baseTex, panels, cursor, streaks, dust, seed, glc }
}

// --------------------------------------------------------------- per frame

function cursorUI(env, t) {
  const P = [[0, 2500, 1700], [3.6, 250, 460], [at(env, B.y1988, 'city'), 800, 480], [at(env, B.didnt, 'opened') - 0.6, 250, 400],
    [at(env, B.didnt, 'opened') - 0.2, 250, 400], [at(env, B.didnt, 'Forty-three'), 2050, 900], [at(env, B.same, 'stayed'), 2080, 420],
    [at(env, B.talk) - 0.6, 250, 520], [at(env, B.talk) - 0.2, 250, 520], [at(env, B.talk, 'talking'), 1100, 1300], [at(env, B.watch), 1500, 900],
    [at(env, B.ask, 'pick'), 1500, 860], [at(env, B.ask, 'Then'), 1300, 1200], [env.closeAt, 1300, 1200]]
  for (let i = 0; i < P.length - 1; i++) if (t >= P[i][0] && t < P[i + 1][0]) {
    const k = env.ease.utility(clamp((t - P[i][0]) / Math.min(0.7, P[i + 1][0] - P[i][0])))
    return [lerp(P[i][1], P[i + 1][1], k), lerp(P[i][2], P[i + 1][2], k)]
  }
  return P.at(-1).slice(1)
}

function placeCamera(env, t) {
  const { cur, t0 } = lifted(env, t)
  const prev = (() => { let p = null; for (const [b, w, k] of LIFT) { if (at(env, b, w) - 0.2 < t0) p = k } return p })()
  // Each target is [x, y, width, height] in screen units; the distance is the one that fits it in the frame.
  const target = (k) => {
    if (!k) return [0, 0, SW, SH]
    const P = R.panels[k]; return [P.lx, P.ly, (P.w / UW) * SW, (P.h / UH) * SH]
  }
  const a = target(prev), b = target(cur), k = env.ease.hero(clamp((t - t0) / 1.0))
  const hookK = env.ease.hero(clamp((t - 0.2) / 3.2))
  const [x, y, w, h] = a.map((v, i) => lerp(v, b[i], k))
  const tall = env.shape === 'tall'
  const vf = Math.tan((R.camera.fov * Math.PI) / 360), hf = vf * R.camera.aspect
  const margin = cur ? (tall ? 1.26 : 1.3) : lerp(1.6, 1.08, hookK)
  // Tall fits the width (the frame is narrow); wide fits the height.
  const dist = Math.max((w * margin) / 2 / hf, (h * margin) / 2 / vf * (tall ? 0.55 : 1))
  R.rig.updateMatrixWorld(true)
  const focus = R.screen.localToWorld(new THREE.Vector3(x, y, 0.3))
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(R.rig.quaternion)
  // The camera keeps moving: a slow orbit round the focus, and a breath of push-in.
  const yaw = Math.sin(t * 0.23) * 0.22 + (cur ? 0 : -0.25 * (1 - hookK)), pitch = Math.sin(t * 0.17) * 0.06 + 0.08
  const dir = normal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).applyAxisAngle(new THREE.Vector3(1, 0, 0), -pitch)
  const pos = focus.clone().add(dir.multiplyScalar(dist * (1 + 0.03 * Math.sin(t * 0.5))))
  // Tall: the panel sits above the caption line, between the dress and the captions.
  const look = focus.clone(); if (tall) look.y += 0.16 * dist * vf
  R.camera.position.copy(pos); R.camera.lookAt(look)
}

export function draw(env, ctx, t, house) {
  const c = env.skin.colors
  drawBase(env, R.bg, t); R.baseTex.needsUpdate = true
  const { cur, t0 } = lifted(env, t)
  for (const [k, P] of Object.entries(R.panels)) {
    P.g.clearRect(0, 0, P.w, P.h)
    rr(P.g, 2, 2, P.w - 4, P.h - 4, 28, c.ink, c.line, 2)
    DRAW[k](env, P.g, t, P.w, P.h); P.tex.needsUpdate = true
    // Panels assemble during the hook, flying in from depth one after another.
    const order = ['cardA', 'cardB', 'cardC', 'main', 'map'].indexOf(k)
    // The first frame already has the screen assembling (F01: never open on an empty frame).
    const arrive = k === 'toast' ? toastOn(env, t)
      : k === 'hook' ? hookOn(env, t)
      : env.ease.hero(clamp((t + 0.5 - order * 0.32) / 0.6))
    const active = k === cur ? env.ease.hero(clamp((t - t0) / 0.6)) : 0
    const lift = (k === 'toast' ? 0.85 : k === 'hook' ? 0.75 : 0.04 + 0.5 * active) + (1 - arrive) * 2.5
    P.group.position.z = lift; P.group.scale.setScalar((1 + 0.05 * active) * (k === 'toast' ? 0.6 + 0.4 * arrive : 1))
    P.group.rotation.y = active * 0.12 * Math.sin(t * 0.8)
    // While one panel is lifted, the others dim, so the eye goes where he is talking.
    const focusK = cur && k !== 'toast' ? env.ease.enter(clamp((t - t0) / 0.5)) : 0
    P.face.material.opacity = arrive * (k === cur || k === 'toast' ? 1 : 1 - 0.65 * focusK); P.group.visible = arrive > 0.01
    P.glow.material.opacity = active * (0.55 + 0.25 * Math.sin(t * 5)) + (k === 'toast' ? arrive * 0.6 : 0)
    P.glow.material.color.set(k === 'cardC' || (k === 'main' && t >= at(env, B.watch)) || k === 'toast' && t >= at(env, B.same, 'stayed') + 0.3 ? c.mint : c.channel)
    P.shadow.material.opacity = 0.55 * active * arrive
  }
  const [ux, uy] = cursorUI(env, t); const [cx, cy] = toLocal(ux, uy)
  R.cursor.position.set(cx + 0.11, cy - 0.11, 0.95)
  R.rig.position.y = 2.6 + Math.sin(t * 0.6) * 0.03
  R.streaks.forEach((S, i) => {
    const k = env.ease.hero(clamp((t + 0.6 - i * 0.25) / 1.4))
    for (const m of [S.baseM, S.p]) m.geometry.setDrawRange(0, Math.floor((m.geometry.index.count * k) / 3) * 3)
    S.tex.offset.x = -t * S.speed
  })
  const p = R.dust.geometry.attributes.position.array
  R.seed.forEach(([x, y, z, ph], i) => { p[i * 3] = x + Math.sin(t * 0.2 + ph) * 0.4; p[i * 3 + 1] = (y + t * 0.08 + ph) % 7; p[i * 3 + 2] = z + Math.cos(t * 0.15 + ph) * 0.3 })
  R.dust.geometry.attributes.position.needsUpdate = true
  placeCamera(env, t)
  R.composer.render()
  ctx.drawImage(R.glc, 0, 0)
  const tall = env.shape === 'tall'
  const s1 = ctx.createLinearGradient(0, tall ? 180 : 0, 0, tall ? 600 : 260)
  s1.addColorStop(0, c.ink + 'f0'); s1.addColorStop(1, c.ink + '00'); ctx.fillStyle = s1; ctx.fillRect(0, 0, env.W, tall ? 600 : 260)
  const g = ctx.createRadialGradient(env.W / 2, env.H * 0.55, env.H * 0.25, env.W / 2, env.H * 0.5, env.H * 0.85)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, c.ink + 'b3'); ctx.fillStyle = g; ctx.fillRect(0, 0, env.W, env.H)
  if (t >= at(env, B.y1988) && t < at(env, B.talk)) text(env, ctx, 'IMF · BESSEN 2015', tall ? 72 : 96, tall ? 430 : 170, { font: 'IBM Plex Mono', size: tall ? 40 : 30, weight: 500, color: c.muted, role: 'credit', tracking: 2, alpha: env.ease.enter(clamp((t - at(env, B.y1988)) / 0.4)) })
  house.dress(env, ctx)
}

export function cues({ timeline }) {
  const w = (b, s) => timeline.beats[b].words.find((x) => x.w.toLowerCase().startsWith(s.toLowerCase())).s
  const out = [{ t: 0.1, kind: 'whoosh' }]
  for (let i = 0; i < 5; i++) out.push({ t: 0.8 + i * 0.45, kind: 'tick', gain: 0.6 })
  const f0 = w(1, 'city'), f1 = w(1, 'twenty')
  for (let i = 0; i < 20; i++) out.push({ t: f0 + (f1 - f0) * (i / 20), kind: 'key', gain: 0.6 })
  for (let i = 0; i < 7; i++) out.push({ t: w(2, 'thirteen') - 0.35 + i * 0.05, kind: 'count', gain: 0.6 })
  out.push({ t: w(2, 'thirteen'), kind: 'chime', gain: 0.35 })
  for (let i = 0; i < 7; i++) out.push({ t: w(4, 'opened') + i * 0.12 + 0.3, kind: 'tick', gain: 0.5 })
  for (let i = 0; i < 3; i++) out.push({ t: w(4, 'Forty-three') + i * 0.2 + 0.3, kind: 'thump', gain: 0.3 })
  out.push({ t: w(5, 'stayed'), kind: 'chime' })
  for (let i = 0; i < 6; i++) out.push({ t: w(6, 'spent') + i * 0.22, kind: 'tick', gain: 0.45 })
  out.push({ t: timeline.beats[8].s, kind: 'chime', gain: 0.6 })
  for (let i = 0; i < 4; i++) out.push({ t: w(9, 'Then') + i * 0.3, kind: 'tick', gain: 0.55 })
  for (const b of [1, 3, 4, 5, 6, 7, 9]) out.push({ t: timeline.beats[b].s - 0.25, kind: 'whoosh', gain: 0.45 })
  return out
}
