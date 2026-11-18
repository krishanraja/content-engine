// The acceptance check for the version 4 figurine kit: one figurine per job (lab/universe/PLAN.md, "Version 4: a
// figurine per job"; the jobs are figurines/roles.json). Written by Claude so the kit is never graded by its maker.
// Needs no browser: it builds every figurine in three.js and measures it.
//   node lab/universe/figurines/check.mjs
import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ROLES, makeFigurine } from './index.js'

const here = dirname(fileURLToPath(import.meta.url))
const REQUIRED = Object.keys(JSON.parse(readFileSync(join(here, 'roles.json'), 'utf8')).roles)
const WALKERS = ['follow-up', 'courier'] // their feet may move
const faults = []
const src = readFileSync(join(here, 'index.js'), 'utf8')
if (/Math\.random|Date\.now|new Date\(|performance\.now/.test(src)) faults.push('index.js uses a clock or randomness; update(t) must be a pure function of t and seed')
if (/#[0-9a-fA-F]{3,8}\b|0x[0-9a-fA-F]{6}\b/.test(src)) faults.push('index.js has a raw colour; colours come from spec and spec.palette')
if (/^\s*import\s/m.test(src)) faults.push('index.js imports something; THREE is passed in')
for (const r of REQUIRED) if (!ROLES.includes(r)) faults.push(`missing role ${r}`)

const tex = new THREE.Texture()
const palette = { ink: '#0C1512', cream: '#F4EFE4', mint: '#7EF0C0', butter: '#FFD84D', lilac: '#B7A6FF', coral: '#FF6A4D',
  wood: '#A88E6C', metal: '#9AA3A0', paper: '#FBF8F1', glow: '#FFE9A8' }
const snapshot = (group) => { group.updateMatrixWorld(true); const out = []; group.traverse((o) => out.push(o.matrixWorld.toArray().map((v) => +v.toFixed(6)).join(','))); return out.join('|') }
const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180 / Math.PI
const spread = (vs) => { let d = 0; for (const p of vs) for (const q of vs) d = Math.max(d, p.distanceTo(q)); return d }
const signatures = new Map()

for (const role of REQUIRED.filter((r) => ROLES.includes(r))) {
  for (const head of role === 'ceo' ? ['human'] : ['bot']) {
    const spec = { role, body: '#D97757', accent: '#0C1512', skin: '#E9C6A2', palette, head, headLogo: tex, legLogo: tex, seed: 3 }
    const id = `${role}/${head}`
    let fig
    try { fig = makeFigurine(THREE, spec) } catch (e) { faults.push(`${id}: makeFigurine threw ${e.message}`); continue }
    const { group, update, actor } = fig
    if (!group || typeof update !== 'function' || !actor) { faults.push(`${id}: must return { group, update, actor }`); continue }
    update(0); group.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(group), size = box.getSize(new THREE.Vector3())
    if (size.y < 0.55 || size.y > 0.85) faults.push(`${id}: height ${size.y.toFixed(3)} outside 0.55 to 0.85`)
    if (role !== 'courier' && (size.x > 0.5 || size.z > 0.4)) faults.push(`${id}: footprint ${size.x.toFixed(3)} x ${size.z.toFixed(3)} over 0.50 x 0.40`)
    if (box.min.y < -0.01) faults.push(`${id}: dips below the floor (${box.min.y.toFixed(3)})`)
    let meshes = 0, named = 0, headLogo = 0, legLogo = 0; const feet = []
    group.traverse((o) => { if (!o.isMesh) return; meshes++; if (o.name) named++; if (o.name === 'head-logo') headLogo++; if (o.name === 'leg-logo') legLogo++; if (/^foot/.test(o.name)) feet.push(o) })
    if (meshes < 14) faults.push(`${id}: only ${meshes} meshes; a job needs its costume and props (14 or more)`)
    if (named < meshes) faults.push(`${id}: ${meshes - named} meshes have no name`)
    if (head === 'bot' && headLogo !== 1) faults.push(`${id}: needs exactly one mesh named head-logo on a bot head (found ${headLogo})`)
    if (legLogo !== 2) faults.push(`${id}: needs two meshes named leg-logo, one on each thigh (found ${legLogo})`)
    if (feet.length < 2) faults.push(`${id}: needs two meshes whose names start with foot`)
    const sig = `${meshes}:${size.x.toFixed(2)}:${size.y.toFixed(2)}:${size.z.toFixed(2)}`
    if (signatures.has(sig)) faults.push(`${id}: same silhouette as ${signatures.get(sig)}; every job looks different`)
    signatures.set(sig, id)
    update(1.234); const a = snapshot(group); update(5); update(1.234); const b = snapshot(group)
    if (a !== b) faults.push(`${id}: update(t) is not a pure function of t`)
    // The job must read within any 1 s window, and the figure must stay planted while it does.
    for (const start of [0, 0.37, 2.1, 7.6]) {
      const pos = [], rot = [], footPos = feet.map(() => [])
      for (let i = 0; i <= 30; i++) {
        update(start + i / 30); group.updateMatrixWorld(true)
        pos.push(actor.getWorldPosition(new THREE.Vector3())); rot.push(actor.getWorldQuaternion(new THREE.Quaternion()))
        feet.forEach((f, k) => footPos[k].push(f.getWorldPosition(new THREE.Vector3())))
      }
      let turn = 0
      for (const p of rot) for (const q of rot) turn = Math.max(turn, angle(p, q))
      const travel = spread(pos)
      if (travel < 0.05 && turn < 15) faults.push(`${id}: action too small in [${start}, ${start + 1}] s (travel ${travel.toFixed(3)}, turn ${turn.toFixed(1)} deg)`)
      if (!WALKERS.includes(role)) for (const fp of footPos) if (spread(fp) > 0.01) { faults.push(`${id}: a foot moves ${spread(fp).toFixed(3)}; the figure stays planted`); break }
    }
  }
}
if (faults.length) { console.log(faults.join('\n')); process.exit(1) }
console.log(`figurines hold: ${REQUIRED.length} jobs, each its own figure`)
