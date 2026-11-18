// Claude's stand-in figurine, to the same contract as Codex's kit (lab/universe/PLAN.md), so the scene can be staged
// before card ve-universe-figurines lands. The scene prefers ./index.js when it exists.
export const PERSONALITIES = ['sipper', 'stamper', 'scanner', 'binoculars', 'bulb', 'pageflip', 'typist', 'skeptic', 'bobber',
  'pentap', 'talker', 'button', 'waver', 'caller', 'pacer', 'magnifier', 'wrench', 'filer', 'chin', 'courier']

const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)))
// A loop that moves quickly, holds, and returns: 0 -> 1 -> 0 over a period.
const pulse = (t, period, seed) => { const p = (((t + seed * 0.37) % period) + period) % period / period; return p < 0.3 ? ease(p / 0.3) : p < 0.55 ? 1 : 1 - ease((p - 0.55) / 0.3) }

export function makeFigurine(THREE, spec) {
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
  const body = mat(spec.body), dark = mat(spec.accent), skin = mat(spec.skin)
  const g = new THREE.Group(); g.name = 'figurine'
  const mesh = (geo, m, name, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.name = name; o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o }
  const legL = mesh(new THREE.CapsuleGeometry(0.035, 0.08, 4, 8), dark, 'leg-l', -0.045, 0.075, 0)
  const legR = mesh(new THREE.CapsuleGeometry(0.035, 0.08, 4, 8), dark, 'leg-r', 0.045, 0.075, 0)
  mesh(new THREE.CapsuleGeometry(0.085, 0.1, 6, 12), body, 'torso', 0, 0.24, 0)
  const headPivot = new THREE.Group(); headPivot.position.set(0, 0.33, 0); g.add(headPivot)
  let head
  if (spec.head === 'human') {
    head = mesh(new THREE.SphereGeometry(0.11, 20, 16), skin, 'head', 0, 0.11, 0, headPivot)
    mesh(new THREE.SphereGeometry(0.114, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), dark, 'hair', 0, 0.12, -0.005, headPivot)
  } else {
    head = mesh(new THREE.BoxGeometry(0.22, 0.2, 0.18), body, 'head', 0, 0.11, 0, headPivot)
    for (const x of [-0.05, 0.05]) mesh(new THREE.SphereGeometry(0.016, 10, 8), dark, 'eye', x, 0.14, 0.092, headPivot)
    if (spec.headLogo) { const d = mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ map: spec.headLogo, transparent: true }), 'head-logo', 0, 0.07, 0.0905, headPivot) }
  }
  if (spec.legLogo) for (const [x, n] of [[-0.045, 'l'], [0.045, 'r']]) mesh(new THREE.PlaneGeometry(0.055, 0.055), new THREE.MeshBasicMaterial({ map: spec.legLogo, transparent: true }), `leg-logo-${n}`, x, 0.1, 0.037)
  const armPivot = new THREE.Group(); armPivot.position.set(0.11, 0.3, 0); g.add(armPivot)
  mesh(new THREE.CapsuleGeometry(0.028, 0.1, 4, 8), body, 'arm-r', 0, -0.07, 0, armPivot)
  mesh(new THREE.CapsuleGeometry(0.028, 0.1, 4, 8), body, 'arm-l', -0.11, 0.23, 0)
  const p = spec.personality, s = spec.seed || 0
  const headActs = ['scanner', 'skeptic', 'bobber', 'chin', 'binoculars', 'caller', 'bulb']
  const actor = p === 'pacer' || p === 'courier' ? g : headActs.includes(p) ? headPivot : armPivot
  const update = (t) => {
    const k = pulse(t, 1.1, s)
    headPivot.rotation.set(0, 0, 0); armPivot.rotation.set(0, 0, 0); g.position.x = 0; g.position.y = 0
    if (actor === headPivot) { if (p === 'bobber' || p === 'chin') headPivot.rotation.x = 0.35 * k; else headPivot.rotation.y = (k - 0.5) * 0.9 }
    else if (actor === armPivot) armPivot.rotation.x = -1.6 * k
    else if (p === 'pacer') { g.position.x = 0.15 * Math.sin((t + s) * 2.4); legL.rotation.x = 0.5 * Math.sin((t + s) * 9); legR.rotation.x = -legL.rotation.x }
    else g.position.y = 0.045 * Math.abs(Math.sin((t + s) * 6))
  }
  update(0)
  return { group: g, update, actor }
}
