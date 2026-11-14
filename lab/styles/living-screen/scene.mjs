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
import { rr, label } from '../../../packages/moves/_kit.mjs'
import { draw as counterScene } from '../../../packages/moves/counter-scene/move.mjs'
import { draw as countInCard } from '../../../packages/moves/count-in-card/move.mjs'
import { draw as costShrink } from '../../../packages/moves/cost-shrink/move.mjs'
import { draw as percentBlock } from '../../../packages/moves/percent-block/move.mjs'
import { draw as barsGrow } from '../../../packages/moves/bars-grow/move.mjs'
import { draw as rowsEqual } from '../../../packages/moves/rows-equal/move.mjs'
import { draw as timeBars } from '../../../packages/moves/time-bars/move.mjs'
import { draw as taskCopies } from '../../../packages/moves/task-copies-2d/move.mjs'
import { draw as liveChart } from '../../../packages/moves/live-chart/move.mjs'
import { draw as mapPinDrop } from '../../../packages/moves/map-pin-drop/move.mjs'
import * as toast from '../../../packages/moves/toast/move.mjs'

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



// --------------------------------------------------------------- what each panel draws

// Each panel draws with moves from the library (lab/moves), timed to his words.
const P = (env, W, H, extra) => ({ c: env.skin.colors, e: env.ease, W, H, ...extra })
const DRAW = {
  hook: (env, g, t, W, H) => counterScene(g, t, P(env, W, H, { times: {
    openEnd: at(env, B.y1988, 'city'), talkStart: at(env, B.talk), cash: env.word(B.hook, 'Cash').s, ended: env.word(B.hook, 'ended').s,
    bank: env.word(B.hook, 'bank').s, teller: env.word(B.hook, 'teller').s, hands: env.word(B.hook, 'hands').s, you: env.word(B.hook, 'you').s,
    disappear: at(env, B.expect, 'disappear'), backStart: at(env, B.didnt), didnt: at(env, B.didnt, "didn't"),
    stopped: at(env, B.talk, 'stopped'), spent: at(env, B.talk, 'spent'), talking: at(env, B.talk, 'talking') } })),
  cardA: (env, g, t, W, H) => countInCard(g, t, P(env, W, H, { label: 'PER BRANCH', years: ['1988', '2004'], from: 20, to: 13,
    times: { yearSwitch: at(env, B.y2004), countStart: at(env, B.y1988, 'city'), countLand: at(env, B.y1988, 'twenty'), drop: at(env, B.y2004, 'thirteen') - 0.35 } })),
  cardB(env, g, t, W, H) {
    const p = P(env, W, H)
    label(g, 'CITY BRANCHES', 36, 70, 34, p.c.creamSoft)
    if (t >= at(env, B.didnt, 'Forty-three')) percentBlock(g, t, { ...p, value: 43, times: { start: at(env, B.didnt, 'Forty-three') } })
    else costShrink(g, t, { ...p, label: 'COST TO RUN', times: { start: at(env, B.didnt, 'cheaper') } })
    barsGrow(g, t, { ...p, first: 7, more: 3, times: { first: at(env, B.didnt, 'opened'), more: at(env, B.didnt, 'Forty-three') } })
  },
  cardC: (env, g, t, W, H) => rowsEqual(g, t, P(env, W, H, { label: 'TELLER JOBS',
    rows: [{ label: '1988', start: at(env, B.same, 'total') }, { label: '2004', start: at(env, B.same, 'teller') }], times: { equals: at(env, B.same, 'stayed') } })),
  main(env, g, t, W, H) {
    const p = P(env, W, H)
    const kT = env.ease.enter(clamp((t - at(env, B.talk) + 0.1) / 0.5)) * (1 - clamp((t - at(env, B.two)) / 0.3))
    const kAsk = env.ease.enter(clamp((t - at(env, B.ask, 'pick')) / 0.5))
    if (kAsk > 0.5) return taskCopies(g, t, { ...p, label: 'THIS WEEK', times: { done: at(env, B.ask, 'does'), copies: at(env, B.ask, 'Then') } })
    if (kT > 0.5) return timeBars(g, t, { ...p, times: { less: at(env, B.talk, 'counting'), more: at(env, B.talk, 'talking'), people: at(env, B.talk, 'spent') } })
    liveChart(g, t, { ...p, label: 'TELLERS AND BRANCHES', axis: ['1988', '2004'], labels: ['PER BRANCH', 'BRANCHES'],
      times: { expect: at(env, B.expect, 'expect'), expectEnd: at(env, B.didnt), a: at(env, B.two, 'Fewer'), b: at(env, B.two, 'More'), watch: at(env, B.watch) } })
  },
  map: (env, g, t, W, H) => mapPinDrop(g, t, P(env, W, H, { label: 'CITY', first: 7, more: 3, times: { first: at(env, B.didnt, 'opened'), more: at(env, B.didnt, 'Forty-three') } })),
  toast: (env, g, t, W, H) => toast.draw(g, t, P(env, W, H, { items: toastItems(env) })),
}
const toastItems = (env) => { const c = env.skin.colors; return [[at(env, B.y2004, 'thirteen'), '−7 TELLERS PER BRANCH', c.cream], [at(env, B.didnt, 'Forty-three') + 0.6, '+43% CITY BRANCHES', c.channel], [at(env, B.same, 'stayed') + 0.3, 'HELD LEVEL', c.mint]] }
// The counter scene's three appearances: [in, out].
function hookOn(env, t) {
  const W = [[env.word(B.hook, 'Cash').s - 0.4, at(env, B.y1988, 'city') - 0.6], [at(env, B.expect, 'expect') - 0.3, at(env, B.didnt, 'Each') - 0.4],
    [at(env, B.talk) - 0.3, at(env, B.two) - 0.4]]
  return Math.max(...W.map(([a, b]) => env.ease.hero(clamp((t - a) / 0.5)) * (1 - env.ease.exit(clamp((t - b) / 0.45)))))
}
function toastOn(env, t) { return toast.on(t, { e: env.ease, items: toastItems(env) }) }

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
  if (env.shape === 'tall') env.captionBase = 400
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
  // Tall: the panel keeps short of the action rail (x 880; Krish, 2026-11-11: "stay within the boundaries of all the
  // social platforms").
  const margin = cur ? (tall ? 1.55 : 1.3) : lerp(tall ? 1.75 : 1.6, tall ? 1.4 : 1.08, hookK)
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
  const look = focus.clone(); if (tall) look.y += 0.06 * dist * vf  // 11 Nov: raised with the credit, under the top bar
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
  if (t >= at(env, B.y1988) && t < at(env, B.talk)) text(env, ctx, 'IMF · BESSEN 2015', tall ? 72 : 96, tall ? 300 : 170, { font: 'IBM Plex Mono', size: tall ? 40 : 30, weight: 500, color: c.muted, role: 'credit', tracking: 2, alpha: env.ease.enter(clamp((t - at(env, B.y1988)) / 0.4)) })
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
