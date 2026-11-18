// The acceptance check for the figurine kit (lab/universe/PLAN.md, "The figurine contract"). Written by Claude so the
// kit is never graded by its maker. Needs no browser: it builds every figurine in three.js and measures it.
//   node lab/universe/figurines/check.mjs
import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PERSONALITIES, makeFigurine } from './index.js'

const REQUIRED = ['sipper', 'stamper', 'scanner', 'binoculars', 'bulb', 'pageflip', 'typist', 'skeptic', 'bobber',
  'pentap', 'talker', 'button', 'waver', 'caller', 'pacer', 'magnifier', 'wrench', 'filer', 'chin', 'courier']
const faults = []
const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, 'index.js'), 'utf8')
if (/Math\.random|Date\.now|new Date\(|performance\.now/.test(src)) faults.push('index.js uses a clock or randomness; update(t) must be a pure function of t and seed')
if (/#[0-9a-fA-F]{3,8}\b/.test(src)) faults.push('index.js has a raw hex colour; colours come from spec')
if (/^\s*import\s/m.test(src)) faults.push('index.js imports something; THREE is passed in')
for (const p of REQUIRED) if (!PERSONALITIES.includes(p)) faults.push(`missing personality ${p}`)

const tex = new THREE.Texture()
const snapshot = (group) => { group.updateMatrixWorld(true); const out = []; group.traverse((o) => out.push(o.matrixWorld.toArray().map((v) => +v.toFixed(6)).join(','))); return out.join('|') }
const under = (o, root) => { for (let x = o; x; x = x.parent) if (x === root) return true; return false }
const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180 / Math.PI

for (const personality of PERSONALITIES) {
  for (const head of ['bot', 'human']) {
    const spec = { personality, body: '#7EF0C0', accent: '#0C1512', skin: '#E8C4A0', head, headLogo: head === 'bot' ? tex : null, legLogo: tex, seed: 3 }
    let fig
    try { fig = makeFigurine(THREE, spec) } catch (e) { faults.push(`${personality}/${head}: makeFigurine threw ${e.message}`); continue }
    const { group, update, actor } = fig
    if (!group || typeof update !== 'function' || !actor) { faults.push(`${personality}/${head}: must return { group, update, actor }`); continue }
    update(0); group.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(group), size = box.getSize(new THREE.Vector3())
    if (personality !== 'courier' && personality !== 'pacer') {
      if (size.y < 0.55 || size.y > 0.70) faults.push(`${personality}/${head}: height ${size.y.toFixed(3)} outside 0.55 to 0.70`)
      if (size.x > 0.45 || size.z > 0.35) faults.push(`${personality}/${head}: footprint ${size.x.toFixed(3)} x ${size.z.toFixed(3)} over 0.45 x 0.35`)
      if (box.min.y < -0.01) faults.push(`${personality}/${head}: dips below the floor (${box.min.y.toFixed(3)})`)
    }
    update(1.234); const a = snapshot(group); update(5); update(1.234); const b = snapshot(group)
    if (a !== b) faults.push(`${personality}/${head}: update(t) is not a pure function of t`)
    // The action must read within any 1 s window: sample four windows.
    for (const start of [0, 0.37, 2.1, 7.6]) {
      const pos = [], rot = [], others = new Map()
      for (let i = 0; i <= 30; i++) {
        update(start + i / 30); group.updateMatrixWorld(true)
        pos.push(actor.getWorldPosition(new THREE.Vector3())); rot.push(actor.getWorldQuaternion(new THREE.Quaternion()))
        group.traverse((o) => { if (o.isMesh && !under(o, actor) && o !== group) { const v = o.getWorldPosition(new THREE.Vector3()); if (!others.has(o)) others.set(o, []); others.get(o).push(v) } })
      }
      let travel = 0, turn = 0
      for (const p of pos) for (const q of pos) travel = Math.max(travel, p.distanceTo(q))
      for (const p of rot) for (const q of rot) turn = Math.max(turn, angle(p, q))
      if (travel < 0.04 && turn < 12) faults.push(`${personality}/${head}: action too small in [${start}, ${start + 1}] s (travel ${travel.toFixed(3)}, turn ${turn.toFixed(1)} deg)`)
      if (actor !== group) for (const [o, vs] of others) {
        let d = 0; for (const p of vs) for (const q of vs) d = Math.max(d, p.distanceTo(q))
        if (d > 0.012) { faults.push(`${personality}/${head}: ${o.name || 'a part'} outside the actor moves ${d.toFixed(3)}`); break }
      }
    }
  }
}
if (faults.length) { console.log(faults.join('\n')); process.exit(1) }
console.log(`figurines hold: ${PERSONALITIES.length} personalities, bot and human heads`)
