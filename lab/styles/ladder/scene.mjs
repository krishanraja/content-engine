// The Ladder, v2 (premium): one object carries every number, built in real 3D.
// A bank branch is the object. Its twenty lit windows are the tellers; seven go dark for 2004. The camera cranes up
// to a street of branches where three more drop in (43% more), a mint level line holds through them (teller jobs:
// level), and the piece ends on two towers of badge slabs, the two things that moved.
// Bar set by Krish's own references: the Mon 2 Nov Ladder (3D badges with mass, Anton numbers with the old value
// struck, producer credits, a lit vignette, a camera that never rests) and the Mon 9 Nov cut (real artefacts, glow).
// Draws frame t from t alone: every position is a pure function of t.
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { clamp, lerp, text } from '../_core/house.mjs'
import { update as countOnAPart } from '../../moves/count-on-a-part/move.mjs'
import { update as streetDrop } from '../../moves/street-drop/move.mjs'
import { update as levelLine } from '../../moves/level-line/move.mjs'
import { update as slabTowers } from '../../moves/slab-towers/move.mjs'
import { update as taskCopies3d } from '../../moves/task-copies-3d/move.mjs'

const B = { hook: 0, y1988: 1, y2004: 2, expect: 3, didnt: 4, same: 5, talk: 6, two: 7, watch: 8, ask: 9 }
const at = (env, b, word) => (word ? env.word(b, word).s : env.beat(b).s)
const col = (hex) => new THREE.Color(hex)

let R // the three.js rig, built once in setup

function paperTexture(env) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512
  cv.getContext('2d').drawImage(env.paperImg, 0, 0, 512, 512)
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping
  return tx
}

/** One branch: a stucco block, a pediment, two columns, steps, and a 5 x 4 grid of windows. */
function makeBranch(mats, scale = 1) {
  const g = new THREE.Group()
  const add = (m, x, y, z, cast = true) => { m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m }
  add(new THREE.Mesh(new RoundedBoxGeometry(6, 3.6, 3.2, 3, 0.06), mats.stucco), 0, 2.1, 0)
  add(new THREE.Mesh(new RoundedBoxGeometry(6.6, 0.3, 3.8, 2, 0.04), mats.stone), 0, 0.15, 0)
  add(new THREE.Mesh(new RoundedBoxGeometry(3, 0.16, 0.6, 2, 0.03), mats.stone), 0, 0.08, 2.05, false)
  const ped = new THREE.Shape(); ped.moveTo(-3.3, 0); ped.lineTo(3.3, 0); ped.lineTo(0, 1.1); ped.closePath()
  add(new THREE.Mesh(new THREE.ExtrudeGeometry(ped, { depth: 3.4, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }), mats.stucco), 0, 3.95, -1.7)
  add(new THREE.Mesh(new RoundedBoxGeometry(6.8, 0.22, 3.6, 2, 0.04), mats.stone), 0, 3.95, 0)
  for (const x of [-2.6, 2.6]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 3.6, 24), mats.stone), x, 2.1, 1.75)
  const windows = []
  for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) {
    const x = -1.84 + k * 0.92, y = 3.25 - r * 0.72
    add(new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.6, 0.12, 2, 0.04), mats.frame), x, y, 1.62, false)
    const glass = add(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.44), mats.glass.clone()), x, y, 1.69, false)
    const head = add(new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), mats.ink), x, y + 0.02, 1.695, false)
    const sh = add(new THREE.Mesh(new THREE.CircleGeometry(0.15, 24, 0, Math.PI), mats.ink), x, y - 0.2, 1.695, false)
    windows.push({ glass, head, sh })
  }
  const atm = new THREE.Group()
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.6, 0.5, 2, 0.05), mats.dark); body.position.y = 0.95; body.castShadow = true; atm.add(body)
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), mats.screen); scr.position.set(0, 1.35, 0.26); atm.add(scr)
  atm.position.set(3.9, 0, 1.6); g.add(atm)
  g.scale.setScalar(scale)
  return { group: g, windows, atm }
}

export async function setup(env) {
  // Captions sit directly under the number, label and credit (Krish, 11 Nov: "A").
  if (env.shape === 'tall') env.captionBase = 800
  const c = env.skin.colors
  const glc = document.createElement('canvas'); glc.width = env.W; glc.height = env.H
  const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(env.W, env.H, false)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
  const scene = new THREE.Scene(); scene.background = col(c.ink); scene.fog = new THREE.Fog(col(c.ink), 30, 70)
  const camera = new THREE.PerspectiveCamera(env.shape === 'tall' ? 42 : 30, env.W / env.H, 0.1, 200)
  // Tall: the picture slides down so the object sits under the caption line (Krish, 10 Nov: captions lower).
  if (env.shape === 'tall') camera.setViewOffset(env.W, env.H, 0, -240, env.W, env.H)
  const mats = {
    stucco: new THREE.MeshStandardMaterial({ map: paperTexture(env), color: col(c.cream), roughness: 0.85 }),
    stone: new THREE.MeshStandardMaterial({ color: col(c.creamSoft), roughness: 0.7 }),
    frame: new THREE.MeshStandardMaterial({ color: col(c.inkSoft), roughness: 0.5, metalness: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: col(c.channel), emissive: col(c.channel), emissiveIntensity: 1.4, roughness: 0.3 }),
    ink: new THREE.MeshBasicMaterial({ color: col(c.ink) }),
    dark: new THREE.MeshStandardMaterial({ color: col(c.inkSoft), roughness: 0.35, metalness: 0.5 }),
    screen: new THREE.MeshStandardMaterial({ color: col(c.cream), emissive: col(c.cream), emissiveIntensity: 0.8 }),
    floor: new THREE.MeshStandardMaterial({ color: col(c.inkSoft), roughness: 0.92 }),
    mint: new THREE.MeshStandardMaterial({ color: col(c.mint), emissive: col(c.mint), emissiveIntensity: 1.6 }),
    slab: new THREE.MeshStandardMaterial({ map: paperTexture(env), color: col(c.cream), roughness: 0.6 }),
    slabLit: new THREE.MeshStandardMaterial({ color: col(c.mint), emissive: col(c.mint), emissiveIntensity: 0.22, roughness: 0.5 }),
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mats.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)
  scene.add(new THREE.HemisphereLight(col(c.cream), col(c.ink), 0.55))
  const key = new THREE.DirectionalLight(0xfff1dc, 2.6); key.position.set(-8, 14, 10); key.castShadow = true
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22 }); key.shadow.bias = -0.0004; key.shadow.radius = 4
  scene.add(key)
  const rim = new THREE.DirectionalLight(col(c.mint), 0.3); rim.position.set(10, 6, -12); scene.add(rim)

  const hero = makeBranch(mats); scene.add(hero.group)
  const street = []
  for (let i = 0; i < 10; i++) {
    const b = makeBranch(mats, 0.55)
    b.home = new THREE.Vector3(-9.6 + (i % 5) * 4.8, 0, -6 - Math.floor(i / 5) * 5.2)
    b.group.position.copy(b.home); b.atm.visible = false
    scene.add(b.group); street.push(b)
  }
  const level = new THREE.Mesh(new THREE.BoxGeometry(28, 0.06, 0.22), mats.mint); level.position.set(0, 0.04, -2.6); scene.add(level)
  const towers = [[], []]
  for (let s = 0; s < 20; s++) for (const [ti, x] of [[0, -2.4], [1, 2.4]]) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.22, 1.6, 2, 0.05), mats.slab)
    m.position.set(x, 0.13 + s * 0.26, 14); m.castShadow = m.receiveShadow = true; scene.add(m); towers[ti].push(m)
  }
  // The ask: one task (a slab) and the four copies it makes room for.
  const ask = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.22, 1.6, 2, 0.05), mats.slabLit); m.castShadow = true; m.visible = false; scene.add(m); return m })
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(env.W / 2, env.H / 2), 0.55, 0.6, 0.72))
  composer.addPass(new OutputPass())
  R = { renderer, scene, camera, composer, hero, street, level, towers, ask, glc, mats }
}

// Camera shots: [time, position, look-at]. Between shots the camera eases on the house hero curve; it never rests.
function shots(env) {
  const z = env.shape === 'tall' ? 1.55 : 1, lift = env.shape === 'tall' ? 2.2 : 0.9
  return [
    // The look-at sits above the object (lift), so the object lands in the lower two thirds and the type owns the top.
    // The hook opens close on the lit cash machine, then reveals the branch on "ended".
    [0, [6.6, 1.7, 5.4 * z], [3.9, 1.25 + lift * 0.35, 1.6]],
    [at(env, B.hook, 'ended') - 0.2, [8 * z, 4.2, 13 * z], [0, 2.2 + lift, 0]],
    [at(env, B.y1988, 'city') - 0.3, [4.6 * z, 3.2, 11.6 * z], [0, 2.3 + lift, 0]],
    [at(env, B.expect) - 0.2, [-4.6 * z, 3.4, 12 * z], [0, 2.3 + lift, 0]],
    [at(env, B.didnt, 'opened') - 0.3, [0, 15 * z, 13 * z], [0, 0.5 + lift, -8]],
    [at(env, B.talk) - 0.2, [4.4 * z, 3.2, 11.8 * z], [0, 2.2 + lift, 0]],
    [at(env, B.two) - 0.2, [5 * z, 4.6, 22 * z], [0, 2.2 + lift, 14]],
    [at(env, B.ask) - 0.2, [0, 6, 26 * z], [0, 2 + lift, 14]],
  ]
}

function placeCamera(env, t) {
  const S = shots(env)
  let i = 0; while (i + 1 < S.length && t >= S[i + 1][0]) i++
  const a = S[Math.max(0, i - 1)], b = S[i]
  const k = i === 0 ? 1 : env.ease.hero(clamp((t - b[0]) / 1.3))
  const p = a[1].map((v, j) => lerp(v, b[1][j], k)), l = a[2].map((v, j) => lerp(v, b[2][j], k))
  p[0] += Math.sin(t * 0.37) * 0.25; p[1] += Math.cos(t * 0.29) * 0.12
  R.camera.position.set(...p); R.camera.lookAt(...l)
}

export function draw(env, ctx, t, house) {
  const c = env.skin.colors
  placeCamera(env, t)

  // Moves from the library (lab/moves), timed to his words.
  const mp = (extra) => ({ c, e: env.ease, ...extra })
  countOnAPart(R.hero.windows, t, mp({ from: 20, to: 13, firstIndex: 1, times: {
    countStart: at(env, B.y1988, 'city'), countLand: at(env, B.y1988, 'twenty'), drop: at(env, B.y2004, 'thirteen') - 0.35,
    first: at(env, B.hook, 'person'), ghost: at(env, B.expect, 'disappear'), ghostEnd: at(env, B.didnt) } }))
  R.hero.atm.position.x = 3.9
  // One set on stage at a time: the hero branch, the street, or the towers.
  const inStreet = t >= at(env, B.didnt, 'opened') + 0.3 && t < at(env, B.talk) + 0.4
  R.hero.group.visible = !inStreet && !(t >= at(env, B.two) + 0.3)
  streetDrop(R.street, t, mp({ first: 7, times: { first: at(env, B.didnt, 'opened'), more: at(env, B.didnt, 'Forty-three'), end: at(env, B.talk) + 0.4 } }))
  const kl = levelLine(R.level, t, mp({ times: { start: at(env, B.same, 'stayed'), end: at(env, B.two) } }))
  const tw = t >= at(env, B.two) - 0.2
  const watch = env.ease.enter(clamp((t - at(env, B.watch)) / 0.4))
  slabTowers(R.towers, t, mp({ xs: [-2.4, 2.4], z: 14, left: [20, 13], right: [7, 10], mats: { plain: R.mats.slab, lit: R.mats.slabLit },
    times: { show: at(env, B.two) - 0.2, fall: at(env, B.two, 'Fewer'), grow: at(env, B.two, 'More'), watch: at(env, B.watch) } }))
  const kp = taskCopies3d(R.ask, t, mp({ from: [-2.4, 0.13 + 12 * 0.26], z: 14, times: { lift: at(env, B.ask, 'pick'), copies: at(env, B.ask, 'Then') } }))
  if (kp > 0) R.towers[0][12].visible = false
  const f0 = at(env, B.y1988, 'city'), f1 = at(env, B.y1988, 'twenty'), d0 = at(env, B.y2004, 'thirteen') - 0.35

  R.composer.render()
  ctx.drawImage(R.glc, 0, 0)

  // The type's ground: an ink scrim from the top down to below the numbers, and one above the captions.
  const tall0 = env.shape === 'tall'
  const s1 = ctx.createLinearGradient(0, tall0 ? 180 : 0, 0, tall0 ? 900 : 560)
  s1.addColorStop(0, c.ink + 'f2'); s1.addColorStop(0.6, c.ink + 'b3'); s1.addColorStop(1, c.ink + '00')
  ctx.fillStyle = s1; ctx.fillRect(0, 0, env.W, tall0 ? 900 : 560)
  // A lit vignette over the 3D: light in the middle, ink at the edges.
  const g = ctx.createRadialGradient(env.W / 2, env.H * 0.42, env.H * 0.15, env.W / 2, env.H * 0.5, env.H * 0.78)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, c.ink + 'e6')
  ctx.fillStyle = g; ctx.fillRect(0, 0, env.W, env.H)

  // Type over the 3D: the number, the old value struck, the producer credit.
  const tall = env.shape === 'tall'
  const NX = tall ? 72 : 120, NY = tall ? 560 : 330, N = tall ? 240 : 230
  const CY = NY + (tall ? 128 : 112)
  const tx = (s, x, y, o) => text(env, ctx, s, x, y, o)
  const credit = (alpha) => tx('IMF · BESSEN 2015', NX, CY, { font: 'IBM Plex Mono', size: tall ? 40 : 30, weight: 500, color: c.muted, alpha, role: 'credit', tracking: 2 })
  if (t >= f0 - 0.1 && t < at(env, B.expect)) {
    const n = t < d0 ? Math.round(20 * clamp((t - f0) / (f1 - f0 + 0.15))) : Math.round(lerp(20, 13, env.ease.utility(clamp((t - d0) / 0.4))))
    const k = env.ease.enter(clamp((t - f0) / 0.4))
    if (t >= d0 + 0.4) {
      const sx = NX + (tall ? 330 : 320), sy = NY - (tall ? 20 : 20)
      tx('20', sx, sy, { font: 'Anton', size: tall ? 110 : 100, color: c.muted, alpha: k, role: 'number' })
      ctx.fillStyle = c.muted; ctx.fillRect(sx - 6, sy - (tall ? 40 : 36), tall ? 120 : 110, 7)
    }
    tx(String(n), NX, NY, { font: 'Anton', size: N, color: c.cream, alpha: k, role: 'number' })
    tx(t >= at(env, B.y2004) ? 'TELLERS · 2004' : 'TELLERS · 1988', NX, NY + (tall ? 64 : 58), { font: 'IBM Plex Mono', size: tall ? 40 : 34, weight: 600, color: c.creamSoft, alpha: k, role: 'label', tracking: 2 })
    credit(k)
  }
  const k43 = env.ease.hero(clamp((t - at(env, B.didnt, 'Forty-three')) / 0.6)) * (1 - clamp((t - at(env, B.talk)) / 0.3))
  if (k43 > 0.02) {
    ctx.save(); ctx.font = `${N}px 'Anton'`; const w43 = ctx.measureText('+43%').width; ctx.restore()
    ctx.fillStyle = c.channel; ctx.fillRect(NX - 12, NY - N * 0.8, (w43 + 24) * k43, N * 0.88)
    tx('+43%', NX, NY, { font: 'Anton', size: N, color: c.ink, alpha: k43, role: 'number' })
    tx('CITY BRANCHES · 1988 TO 2004', NX, NY + (tall ? 64 : 58), { font: 'IBM Plex Mono', size: tall ? 40 : 34, weight: 600, color: c.cream, alpha: k43, role: 'label', tracking: 2 })
    credit(k43)
  }
  if (kl > 0.02 && t < at(env, B.talk)) tx('HELD LEVEL', NX, CY + (tall ? 64 : 54), { font: 'IBM Plex Mono', size: tall ? 40 : 34, weight: 700, color: c.mint, alpha: kl, role: 'label', tracking: 2 })
  if (tw && t < at(env, B.ask)) {
    const kk = env.ease.enter(clamp((t - at(env, B.two, 'Fewer')) / 0.4))
    tx('PER BRANCH  20 → 13', tall ? 72 : 120, NY - 60, { font: 'IBM Plex Mono', size: tall ? 40 : 34, weight: 600, color: c.creamSoft, alpha: kk * (1 - watch * 0.5), role: 'label' })
    tx('BRANCHES  7 → 10', tall ? 72 : 120, NY + 4, { font: 'IBM Plex Mono', size: tall ? 40 : 34, weight: 700, color: watch > 0.5 ? c.mint : c.creamSoft, alpha: env.ease.enter(clamp((t - at(env, B.two, 'More')) / 0.4)), role: 'label' })
  }
  house.dress(env, ctx)
}

export function cues({ timeline }) {
  const w = (b, s) => timeline.beats[b].words.find((x) => x.w.toLowerCase().startsWith(s.toLowerCase())).s
  const out = [{ t: 0.6, kind: 'whoosh' }]
  const f0 = w(1, 'city'), f1 = w(1, 'twenty')
  for (let i = 0; i < 20; i++) out.push({ t: f0 + (f1 - f0) * (i / 20), kind: 'tick', gain: 0.55 })
  for (let i = 0; i < 7; i++) out.push({ t: w(2, 'thirteen') - 0.35 + i * 0.04, kind: 'count', gain: 0.6 })
  out.push({ t: w(4, 'opened') - 0.3, kind: 'whoosh' })
  for (let i = 0; i < 3; i++) out.push({ t: w(4, 'Forty-three') + i * 0.18 + 0.5, kind: 'thump', gain: 0.35 })
  out.push({ t: w(5, 'stayed'), kind: 'chime' }, { t: timeline.beats[7].s - 0.2, kind: 'whoosh' }, { t: timeline.beats[8].s, kind: 'chime', gain: 0.6 })
  return out
}
