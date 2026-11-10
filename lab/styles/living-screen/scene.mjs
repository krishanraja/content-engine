// The Living Screen, v2 (premium): a real-looking product interface, rebuilt in code so it performs on cue, shown
// as a lit glass screen floating in 3D space with neon light streaks drawing round it. The camera locks to the part
// being spoken about; a cursor clicks, counts run, the chart draws itself.
// Bar set by Krish's references: the Mon 9 Nov cut (a real artefact on ink, tilted, with neon streaks and glow) and
// the Ladder v2 he approved on 10 Nov ("much better, go"). Draws frame t from t alone.
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
const UW = 2400, UH = 1600            // the interface, in its own pixels
const SW = 6, SH = 4                  // the screen, in world units
let R

// Where the camera looks on the interface for each beat: [x, y, w] in interface pixels.
const FOCUS = {
  full: [1200, 800, 2700], hook: [1300, 760, 1700], ask: [1420, 1080, 1900], cardA: [790, 380, 1000], cardB: [1420, 380, 1000], cardC: [2000, 380, 960],
  chart: [1460, 1100, 2000], side: [700, 600, 1300],
}
const SHOTS = [[B.hook, 'hook'], [B.y1988, 'cardA'], [B.expect, 'chart'], [B.didnt, 'cardB', 'opened'], [B.same, 'cardC'],
  [B.talk, 'side'], [B.two, 'chart'], [B.ask, 'ask']]

function rr(g, x, y, w, h, r, fill, stroke, lw = 3) {
  g.beginPath(); g.roundRect(x, y, w, h, r)
  if (fill) { g.fillStyle = fill; g.fill() }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke() }
}
function label(g, s, x, y, size, color, { font = 'IBM Plex Mono', weight = 600, align = 'left', track = 3 } = {}) {
  g.font = `${weight} ${size}px '${font}'`; g.fillStyle = color; g.textAlign = align; g.letterSpacing = `${track}px`; g.fillText(s, x, y); g.letterSpacing = '0px'; g.textAlign = 'left'
}

function cursorPath(env) {
  return [[0, 2500, 1700], [2.0, 260, 470], [at(env, B.y1988, 'city'), 800, 420], [at(env, B.didnt, 'opened') - 0.5, 260, 400],
    [at(env, B.didnt, 'opened'), 260, 400], [at(env, B.didnt, 'Forty-three'), 1450, 430], [at(env, B.same, 'stayed'), 2080, 440],
    [at(env, B.talk) + 0.2, 260, 520], [at(env, B.talk, 'talking'), 900, 1180], [at(env, B.watch), 1900, 1000],
    [at(env, B.ask, 'pick'), 1300, 1060], [at(env, B.ask, 'Then'), 1500, 1250], [env.closeAt, 1500, 1250]]
}
function cursorAt(env, t) {
  const p = cursorPath(env)
  for (let i = 0; i < p.length - 1; i++) if (t >= p[i][0] && t < p[i + 1][0]) {
    const k = env.ease.utility(clamp((t - p[i][0]) / Math.min(0.7, p[i + 1][0] - p[i][0])))
    return [lerp(p[i][1], p[i + 1][1], k), lerp(p[i][2], p[i + 1][2], k)]
  }
  return p.at(-1).slice(1)
}

/** The interface, drawn into its own canvas each frame. */
function drawUI(env, g, t) {
  const c = env.skin.colors
  g.fillStyle = c.ink; g.fillRect(0, 0, UW, UH)
  const grad = g.createLinearGradient(0, 0, UW, UH); grad.addColorStop(0, c.inkSoft); grad.addColorStop(1, c.ink)
  rr(g, 0, 0, UW, UH, 40, grad)
  ;[0, 1, 2].forEach((i) => { g.fillStyle = c.line; g.beginPath(); g.arc(60 + i * 46, 50, 14, 0, Math.PI * 2); g.fill() })
  label(g, 'BRANCH STAFFING · CITY BRANCHES', UW / 2, 64, 34, c.creamSoft, { align: 'center' })
  g.fillStyle = c.line; g.fillRect(0, 104, UW, 2)
  const sel = t >= at(env, B.talk) + 0.2 ? 2 : t >= at(env, B.didnt, 'opened') ? 1 : 0
  ;['Staff', 'Branches', 'Customers'].forEach((name, i) => {
    if (i === sel) { rr(g, 32, 200 + i * 120, 380, 92, 18, c.ink, c.line, 2); g.fillStyle = c.channel; g.fillRect(32, 222 + i * 120, 8, 48) }
    g.font = `${i === sel ? 800 : 500} 50px 'Archivo'`; g.fillStyle = i === sel ? c.cream : c.muted; g.fillText(name, 80, 262 + i * 120)
  })
  g.fillStyle = c.line; g.fillRect(440, 104, 2, UH - 104)

  const card = (x, w) => rr(g, x, 160, w, 400, 28, c.ink, c.line, 2)
  card(480, 600)
  label(g, 'PER BRANCH', 530, 250, 38, c.creamSoft)
  const nA = t < at(env, B.y1988, 'city') ? null : t < at(env, B.y2004, 'needed')
    ? Math.round(20 * clamp((t - at(env, B.y1988, 'city')) / (at(env, B.y1988, 'twenty') - at(env, B.y1988, 'city') + 0.2)))
    : Math.round(lerp(20, 13, env.ease.utility(clamp((t - at(env, B.y2004, 'needed')) / 0.6))))
  if (nA !== null) { g.font = `250px 'Anton'`; g.fillStyle = c.cream; g.fillText(String(nA), 525, 500) }
  if (t >= at(env, B.y2004, 'needed') + 0.6) { g.font = `120px 'Anton'`; g.fillStyle = c.muted; g.fillText('20', 830, 500); g.fillRect(822, 450, 130, 10) }
  const yr = t >= at(env, B.y2004) ? '2004' : t >= at(env, B.y1988) ? '1988' : ''
  if (yr) { rr(g, 900, 196, 150, 64, 32, c.line); label(g, yr, 975, 240, 36, c.cream, { align: 'center', track: 1 }) }

  card(1120, 600)
  label(g, 'CITY BRANCHES', 1170, 250, 38, c.creamSoft)
  if (t >= at(env, B.didnt, 'opened')) {
    const kB = env.ease.utility(clamp((t - at(env, B.didnt, 'Forty-three')) / 0.8))
    const s = `+${Math.round(43 * kB)}%`
    g.font = `250px 'Anton'`; const w = g.measureText(s).width
    if (kB > 0) { g.fillStyle = c.channel; g.fillRect(1160, 300, (w + 30) * kB, 220) }
    g.fillStyle = kB > 0.5 ? c.ink : c.cream; g.fillText(s, 1175, 500)
  }
  card(1760, 600)
  label(g, 'TELLER JOBS', 1810, 250, 38, c.creamSoft)
  const kC = env.ease.enter(clamp((t - at(env, B.same, 'stayed')) / 0.8))
  if (kC > 0) {
    g.strokeStyle = c.mint; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath()
    for (let i = 0; i <= 60 * kC; i++) { const x = 1820 + i * 8, y = 420 + Math.sin(i * 0.7) * 5; i ? g.lineTo(x, y) : g.moveTo(x, y) }
    g.stroke(); label(g, 'LEVEL', 1820, 520, 46, c.mint, { weight: 700 })
  }

  rr(g, 480, 620, 1880, 940, 28, c.ink, c.line, 2)
  const kT = env.ease.enter(clamp((t - at(env, B.talk, 'stopped')) / 0.8)) * (1 - clamp((t - at(env, B.two)) / 0.3))
  const kAsk = env.ease.enter(clamp((t - at(env, B.ask, 'pick')) / 0.6))
  if (kT < 0.5 && kAsk < 0.5) {
    g.strokeStyle = c.line; g.lineWidth = 2
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(560, 760 + i * 170); g.lineTo(2280, 760 + i * 170); g.stroke() }
    label(g, '1988', 560, 1520, 36, c.muted); label(g, '2004', 2280, 1520, 36, c.muted, { align: 'right' })
    const xs = Array.from({ length: 33 }, (_, i) => 560 + i * (1720 / 32))
    const line = (pts, k, color, width, dash = [], fill = null) => {
      if (k <= 0) return
      const n = Math.max(1, Math.floor((pts.length - 1) * k))
      g.save(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.beginPath()
      pts.slice(0, n + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke()
      if (fill) { g.lineTo(pts[n][0], 1440); g.lineTo(pts[0][0], 1440); g.closePath(); g.fillStyle = fill; g.fill() }
      g.restore()
    }
    const kE = env.ease.utility(clamp((t - at(env, B.expect, 'expect')) / 1.6)) * (1 - clamp((t - at(env, B.two)) / 0.4))
    line(xs.map((x, i) => [x, 790 + (i / 32) ** 2 * 640]), kE, c.muted, 10, [28, 22])
    const kP = env.ease.utility(clamp((t - at(env, B.two, 'Fewer')) / 1.0)), kR = env.ease.utility(clamp((t - at(env, B.two, 'More')) / 0.9))
    const watch = env.ease.enter(clamp((t - at(env, B.watch)) / 0.4))
    line(xs.map((x, i) => [x, 800 + (i / 32) * 240]), kP, c.creamSoft, 12)
    const up = watch > 0.5 ? c.mint : c.cream
    const fillG = g.createLinearGradient(0, 1000, 0, 1440); fillG.addColorStop(0, up + '55'); fillG.addColorStop(1, c.ink + '00')
    line(xs.map((x, i) => [x, 1320 - (i / 32) * 440]), kR, up, 14 + watch * 6, [], fillG)
    if (kP > 0.9) label(g, 'PER BRANCH', 2280, 1110, 44, c.creamSoft, { align: 'right' })
    if (kR > 0.9) label(g, 'BRANCHES', 2280, 850, 50, up, { align: 'right', weight: 700 })
  }
  if (kT > 0) {
    g.save(); g.globalAlpha = kT
    const cash = lerp(1, 0.35, env.ease.utility(clamp((t - at(env, B.talk, 'counting')) / 1.0)))
    const talk = lerp(0.3, 1, env.ease.utility(clamp((t - at(env, B.talk, 'talking')) / 1.0)))
    rr(g, 600, 820, 150, 96, 14, null, c.cream, 6); g.fillStyle = c.cream; g.beginPath(); g.arc(675, 868, 22, 0, Math.PI * 2); g.fill()
    rr(g, 800, 820, 1400 * cash, 96, 18, c.creamSoft)
    g.strokeStyle = c.mint; g.lineWidth = 8; g.beginPath(); g.ellipse(675, 1150, 72, 50, 0, 0, Math.PI * 2); g.stroke()
    rr(g, 800, 1102, 1400 * talk, 96, 18, c.mint)
    g.restore()
  }
  if (kAsk > 0) {
    g.save(); g.globalAlpha = kAsk
    rr(g, 600, 720, 1640, 170, 24, c.inkSoft, c.line, 2); g.fillStyle = c.creamSoft; g.fillRect(680, 790, 760, 24)
    const kd = env.ease.enter(clamp((t - at(env, B.ask, 'does')) / 0.4))
    rr(g, 2080, 755, 110, 100, 20, kd > 0.5 ? c.mint : null, c.cream, 4)
    for (let i = 0; i < 4; i++) {
      const kk = env.ease.hero(clamp((t - at(env, B.ask, 'Then') - i * 0.25) / 0.5))
      if (kk <= 0) continue
      g.save(); g.globalAlpha = kAsk * kk
      rr(g, 600 + i * 420, 1000 + (1 - kk) * 60, 380, 300, 28, null, c.mint, 6)
      g.fillStyle = c.mint; g.fillRect(760 + i * 420, 1140, 60, 16); g.fillRect(782 + i * 420, 1118, 16, 60)
      g.restore()
    }
    g.restore()
  }
  const [px, py] = cursorAt(env, t)
  for (const ck of [at(env, B.didnt, 'opened'), at(env, B.talk) + 0.2, at(env, B.ask, 'pick')]) {
    const k = clamp((t - ck) / 0.45)
    if (k > 0 && k < 1) { g.strokeStyle = c.mint; g.lineWidth = 6; g.globalAlpha = 1 - k; g.beginPath(); g.arc(px, py, 20 + 70 * k, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1 }
  }
  g.fillStyle = c.cream; g.strokeStyle = c.ink; g.lineWidth = 6
  g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + 84); g.lineTo(px + 23, py + 63); g.lineTo(px + 58, py + 63); g.closePath(); g.fill(); g.stroke()
}

export async function setup(env) {
  const c = env.skin.colors
  const glc = document.createElement('canvas'); glc.width = env.W; glc.height = env.H
  const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(env.W, env.H, false); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene(); scene.background = col(c.ink); scene.fog = new THREE.Fog(col(c.ink), 14, 40)
  const camera = new THREE.PerspectiveCamera(env.shape === 'tall' ? 40 : 28, env.W / env.H, 0.05, 100)

  const ui = document.createElement('canvas'); ui.width = UW; ui.height = UH
  const tex = new THREE.CanvasTexture(ui); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: tex, color: 0xd6d6d6, toneMapped: false })) // crisp: stays under the bloom threshold
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(SW + 0.22, SH + 0.22, 0.18, 4, 0.1), new THREE.MeshStandardMaterial({ color: col(c.inkSoft), roughness: 0.25, metalness: 0.7 }))
  bezel.position.z = -0.1; bezel.castShadow = true
  const rig = new THREE.Group(); rig.add(bezel); rig.add(screen)
  rig.position.set(0, 2.6, 0); rig.rotation.set(-0.06, -0.22, 0.02); scene.add(rig)

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: col(c.ink), roughness: 0.45, metalness: 0.3 }))
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)
  scene.add(new THREE.HemisphereLight(col(c.cream), col(c.ink), 0.35))
  const key = new THREE.DirectionalLight(0xfff1dc, 1.4); key.position.set(-5, 9, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key)

  // Neon light streaks: tubes along curves round the screen, in the series colour and mint, drawn on over time.
  const streak = (pts, color, r) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, r, 12, false), new THREE.MeshStandardMaterial({ color: col(color), emissive: col(color), emissiveIntensity: 2.2 }))
    scene.add(m); return m
  }
  const streaks = [
    streak([[-9, 0.4, -3], [-4.5, 1.1, -0.8], [-1, 0.6, 0.6], [2.5, 1.5, 0.4], [5, 4.8, -0.6], [9, 6.2, -3]], c.channel, 0.035),
    streak([[-9, 5.6, -2.5], [-4, 4.9, -0.5], [0, 5.3, 0.4], [4, 4.6, 0.6], [9, 2.2, -2]], c.channel, 0.025),
    streak([[-8, 1.8, -4], [-3, 0.9, -1.4], [1.5, 0.3, -1], [6, 0.8, -2.5], [10, 1.6, -5]], c.mint, 0.022),
  ]
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(env.W / 2, env.H / 2), 0.6, 0.5, 0.9))
  composer.addPass(new OutputPass())
  R = { renderer, scene, camera, composer, ui, uictx: ui.getContext('2d'), tex, rig, screen, streaks, glc }
}

/** The world point on the screen under an interface pixel. */
function onScreen(x, y) {
  return R.screen.localToWorld(new THREE.Vector3((x / UW - 0.5) * SW, (0.5 - y / UH) * SH, 0))
}

function placeCamera(env, t) {
  let from = FOCUS.full, to = FOCUS.full, t0 = 0
  for (const [b, key, word] of SHOTS) { const s = at(env, b, word) - 0.25; if (t >= s) { from = to; to = FOCUS[key]; t0 = s } }
  const k = env.ease.hero(clamp((t - t0) / 1.0))
  const [x, y, w] = from.map((v, i) => lerp(v, to[i], k))
  R.rig.updateMatrixWorld(true)
  const target = onScreen(x, y)
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(R.rig.quaternion)
  const fov = (R.camera.fov * Math.PI) / 180
  const tall = env.shape === 'tall'
  const span = ((w / UW) * SW) / (tall ? R.camera.aspect : 1)
  const dist = ((span / 2) / Math.tan(fov / 2)) * (tall ? 1.05 : 0.62)
  const pos = target.clone().add(normal.multiplyScalar(dist))
  pos.x += Math.sin(t * 0.37) * 0.06 * dist - 0.06 * dist; pos.y += Math.cos(t * 0.29) * 0.03 * dist + 0.12 * dist
  const look = target.clone(); if (tall) look.y += 0.08 * dist * Math.tan(fov / 2)
  R.camera.position.copy(pos); R.camera.lookAt(look)
}

export function draw(env, ctx, t, house) {
  const c = env.skin.colors
  drawUI(env, R.uictx, t); R.tex.needsUpdate = true
  R.rig.position.y = 2.6 + Math.sin(t * 0.6) * 0.03
  R.streaks.forEach((m, i) => {
    const k = env.ease.hero(clamp((t - 0.2 - i * 0.35) / 1.6))
    m.geometry.setDrawRange(0, Math.floor((m.geometry.index.count * k) / 3) * 3)
    m.material.emissiveIntensity = 2.2 * (0.85 + 0.15 * Math.sin(t * 2 + i))
  })
  placeCamera(env, t)
  R.composer.render()
  ctx.drawImage(R.glc, 0, 0)
  const tall = env.shape === 'tall'
  const s1 = ctx.createLinearGradient(0, tall ? 180 : 0, 0, tall ? 640 : 300)
  s1.addColorStop(0, c.ink + 'f0'); s1.addColorStop(1, c.ink + '00'); ctx.fillStyle = s1; ctx.fillRect(0, 0, env.W, tall ? 640 : 300)
  const g = ctx.createRadialGradient(env.W / 2, env.H * 0.55, env.H * 0.2, env.W / 2, env.H * 0.5, env.H * 0.8)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, c.ink + 'cc'); ctx.fillStyle = g; ctx.fillRect(0, 0, env.W, env.H)
  if (t >= at(env, B.y1988) && t < at(env, B.talk)) text(env, ctx, 'IMF · BESSEN 2015', tall ? 72 : 96, tall ? 420 : 170, { font: 'IBM Plex Mono', size: tall ? 40 : 30, weight: 500, color: c.muted, role: 'credit', tracking: 2, alpha: env.ease.enter(clamp((t - at(env, B.y1988)) / 0.4)) })
  house.dress(env, ctx)
}

export function cues({ timeline }) {
  const w = (b, s) => timeline.beats[b].words.find((x) => x.w.toLowerCase().startsWith(s.toLowerCase())).s
  const out = [{ t: 0.2, kind: 'whoosh' }]
  const f0 = w(1, 'city'), f1 = w(1, 'twenty')
  for (let i = 0; i < 20; i += 2) out.push({ t: f0 + (f1 - f0) * (i / 20), kind: 'key', gain: 0.8 })
  for (let i = 0; i < 7; i++) out.push({ t: w(2, 'needed') + i * 0.085, kind: 'count', gain: 0.7 })
  out.push({ t: w(4, 'opened'), kind: 'tick' }, { t: timeline.beats[6].s + 0.2, kind: 'tick' }, { t: w(9, 'pick'), kind: 'tick' })
  out.push({ t: w(5, 'stayed'), kind: 'chime' }, { t: timeline.beats[8].s, kind: 'chime', gain: 0.6 })
  for (const [b, word] of [[1], [3, 'expect'], [4, 'opened'], [5], [6], [7], [9]]) out.push({ t: word ? w(b, word) - 0.25 : timeline.beats[b].s - 0.25, kind: 'whoosh', gain: 0.5 })
  return out
}
