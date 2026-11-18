// The work, as one building (lab/universe/PLAN.md). Everything is a pure function of t (seconds): window.setTime(t).
import * as THREE from '../vendor/three.module.js'

let kitName = 'codex'
const kit = await import('../figurines/index.js').catch(() => { kitName = 'placeholder'; return import('../figurines/placeholder.js') })
window.kitName = kitName

const W = 1080, H = 1350
const C = { ink: '#0C1512', ink2: '#16221D', cream: '#F4EFE4', mint: '#7EF0C0', butter: '#FFD84D', lilac: '#B7A6FF', coral: '#FF6A4D',
  slab: '#CBBFA7', wallIn: '#F2ECDF', wallOut: '#BDB29B', glass: '#2A3A33', skin: '#E9C6A2', claude: '#D97757' }

// The work, bottom to top. Plain words only (Krish, 18 Nov 2026: "layman's terms ... not overwhelm people").
const LOGO = { claude: 'claude-symbol.png', openai: 'openai.jpg', github: 'github.jpg', vercel: 'vercel.png', supabase: 'supabase.jpg',
  elevenlabs: 'elevenlabs.jpg', runway: 'runway.jpg', buffer: 'buffer.jpg', gmail: 'gmail.jpg' }
const TOOL = { openai: '#E8E8E8', github: '#2B3137', vercel: '#1B1B1B', supabase: '#3ECF8E', elevenlabs: '#D9D4CC', runway: '#5B5BD6', buffer: '#B0EC9C', gmail: '#EA4335' }
const LEVELS = [
  { key: 'brain', n: '', name: 'The AI brain', brain: true, cast: [
    { role: 'Librarian', p: 'filer', head: 'supabase' }, { role: 'Linker', p: 'chin', legs: true }] },
  { key: 'build', n: '6', name: 'Build', cast: [
    { role: 'Coder', p: 'typist', head: 'github' }, { role: 'Tester', p: 'magnifier', legs: true }, { role: 'Fixer', p: 'wrench', head: 'vercel' }] },
  { key: 'sell', n: '5', name: 'Sell', cast: [
    { role: 'Caller', p: 'caller', legs: true }, { role: 'Follow-up', p: 'pacer', head: 'gmail' }, { role: 'Prepper', p: 'pageflip', legs: true }] },
  { key: 'share', n: '4', name: 'Share', cast: [
    { role: 'Poster', p: 'button', head: 'buffer' }, { role: 'Replier', p: 'waver', legs: true }] },
  { key: 'make', n: '3', name: 'Make', cast: [
    { role: 'Editor', p: 'bobber', head: 'runway' }, { role: 'Designer', p: 'pentap', head: 'openai' }, { role: 'Voice', p: 'talker', head: 'elevenlabs' }] },
  { key: 'write', n: '2', name: 'Write', cast: [
    { role: 'Researcher', p: 'pageflip', legs: true }, { role: 'Writer', p: 'typist', legs: true }, { role: 'Checker', p: 'skeptic', legs: true }] },
  { key: 'find', n: '1', name: 'Find ideas', cast: [
    { role: 'Reader', p: 'scanner', legs: true }, { role: 'Scout', p: 'binoculars', legs: true }, { role: 'Ideas', p: 'bulb', legs: true }] },
  { key: 'roof', n: '', name: 'I decide', roof: true, cast: [
    { role: 'You', p: 'sipper', human: true }, { role: 'Approver', p: 'stamper', legs: true }] },
]
const CARDS = [
  ['Roof', 'I decide', ['Approve what goes out under my name', 'Pick the strongest of the options', 'Press send when it is ready'], 'A fast, clear yes or no'],
  ['1', 'Find ideas', ['Read every link and newsletter I save', 'Track what people are talking about', 'Flag ideas before they become obvious'], 'A shortlist worth making'],
  ['2', 'Write', ['Research the facts and the sources', 'Draft each script in my own voice', 'Double-check every claim and number'], 'Scripts ready to film'],
  ['3', 'Make', ['Film and edit the video into shape', 'Design the covers and carousels', 'Add the voice, captions and music'], 'Finished videos and posts'],
  ['4', 'Share', ['Post it on every channel at once', 'Schedule it for the right time of day', 'Reply to every comment and question'], 'Posts out, people talking'],
  ['5', 'Sell', ['Research each company before the call', 'Prepare the questions worth asking', 'Send the follow-up the same day'], 'Meetings booked in the diary'],
  ['6', 'Build', ['Build the tools the whole team uses', 'Test them properly before they ship', 'Fix whatever breaks, fast'], 'Tools that keep working'],
  ['Base', 'The AI brain', ['Remembers every piece, call and decision', 'Turns each of my corrections into a rule', 'Every floor checks it before acting'], 'Every floor runs on this'],
]

// ---------------------------------------------------------------- renderer, camera, light
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(window.devicePixelRatio || 1); renderer.setSize(W, H); renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.insertBefore(renderer.domElement, document.getElementById('labels'))
const scene = new THREE.Scene()
const BW = 6, BD = 2.4, FH = 1.32, SLAB = 0.14
const SCALE = 84 // px per world unit
const CX = 372, CY = 1180 // where the building's base centre lands on the frame
const camera = new THREE.OrthographicCamera(-CX / SCALE, (W - CX) / SCALE, CY / SCALE, -(H - CY) / SCALE, 0.1, 200)
const target = new THREE.Vector3(0, 0, 0)
camera.position.copy(target).add(new THREE.Vector3(6.2, 2.6, 15)); camera.lookAt(target)
const hemi = new THREE.HemisphereLight('#FFFFFF', '#9C8F78', 1.5); scene.add(hemi)
const sun = new THREE.DirectionalLight('#FFF3DE', 2.1); sun.position.set(6, 12, 9); scene.add(sun)
const fill = new THREE.DirectionalLight('#CFE6FF', 0.5); fill.position.set(-8, 4, 6); scene.add(fill)
const brainLight = new THREE.PointLight(C.mint, 0, 9, 1.3); brainLight.position.set(0, 0.8, 0.2); scene.add(brainLight)

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o })
const box = (w, h, d, m, x, y, z, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o }
const loader = new THREE.TextureLoader()
const textures = {}
await Promise.all(Object.entries(LOGO).map(([k, f]) => new Promise((res) => loader.load(`../logos/${f}`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; textures[k] = t; res() }, undefined, () => res()))))

// ---------------------------------------------------------------- the building
const building = new THREE.Group(); scene.add(building)
const ground = box(BW + 2.4, 0.2, BD + 1.2, mat('#B9AD95'), 0.5, -0.1, 0.3, scene)
const levels = []
const windowMats = []
const lampMats = []
const roomLights = []
LEVELS.forEach((L, i) => {
  const g = new THREE.Group(); building.add(g)
  const y0 = i * FH
  const wallIn = mat(L.brain ? '#1B2A24' : C.wallIn), slab = mat(L.brain ? '#24342D' : C.slab), out = mat(C.wallOut)
  box(BW, SLAB, BD, slab, 0, SLAB / 2, 0, g)                                          // floor
  if (!L.roof) {
    box(BW, FH, 0.1, wallIn, 0, FH / 2, -BD / 2 + 0.05, g)                           // back wall
    box(0.1, FH, BD, wallIn, -BW / 2 + 0.05, FH / 2, 0, g)                           // left wall
    box(0.14, FH, BD, out, BW / 2 + 0.07, FH / 2, 0, g)                              // right wall, outside
    for (const z of [-0.6, 0.45]) {                                                  // its windows
      const wm = mat(C.glass, { emissive: new THREE.Color('#FFD98A'), emissiveIntensity: 0 }); windowMats.push(wm)
      box(0.02, 0.5, 0.55, wm, BW / 2 + 0.145, FH * 0.55, z, g)
    }
    const lamp = mat('#FFF6DD', { emissive: new THREE.Color('#FFE3A0'), emissiveIntensity: 0 }); lampMats.push(lamp)
    box(BW - 0.6, 0.03, 0.12, lamp, 0, FH - 0.03, -BD / 2 + 0.4, g)                 // ceiling light strip
  } else {
    box(BW, 0.28, 0.08, out, 0, 0.28, -BD / 2 + 0.04, g); box(0.08, 0.28, BD, out, -BW / 2 + 0.04, 0.28, 0, g); box(0.08, 0.28, BD, out, BW / 2 - 0.04, 0.28, 0, g)
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.55, 20), mat('#9A8A70')); tank.position.set(-2.2, 0.9, -0.6); g.add(tank)
    for (const x of [-2.4, -2.0]) box(0.05, 0.5, 0.05, mat(C.ink), x, 0.38, -0.6, g)
    box(0.04, 1.2, 0.04, mat(C.ink), 2.3, 0.75, -0.7, g)
  }
  if (!L.roof && !L.brain) { const pl = new THREE.PointLight('#FFD9A0', 0, 4.5, 1.4); pl.position.set(0, FH - 0.25, 0.4); g.add(pl); roomLights.push(pl) }
  levels.push({ ...L, g, y0 })
})
// The roof cap on the top floor, so the building reads as closed
const cap = box(BW + 0.2, 0.08, BD + 0.1, mat('#B7AA90'), 0, 0, 0, building)

// ---------------------------------------------------------------- furniture, per level
function desk(g, x, z, screen = C.mint) {
  box(0.62, 0.05, 0.36, mat('#A88E6C'), x, 0.42, z, g)
  for (const dx of [-0.27, 0.27]) box(0.04, 0.4, 0.3, mat('#7E6A50'), x + dx, 0.2, z, g)
  box(0.36, 0.24, 0.03, mat(C.ink), x, 0.6, z - 0.08, g)
  const s = mat(screen, { emissive: new THREE.Color(screen), emissiveIntensity: 0.35 }); lampMats.push(s)
  box(0.32, 0.2, 0.01, s, x, 0.6, z - 0.06, g)
}
function shelf(g, x, z, colors) {
  box(0.9, 1.0, 0.28, mat('#8B7454'), x, 0.6, z, g)
  colors.forEach((c, k) => box(0.2, 0.16, 0.2, mat(c), x - 0.3 + (k % 4) * 0.2, 0.3 + Math.floor(k / 4) * 0.3, z + 0.06, g))
}
function plant(g, x, z) { box(0.14, 0.16, 0.14, mat('#B5643F'), x, 0.22, z, g); const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat('#5E8F5A')); b.position.set(x, 0.42, z); g.add(b) }
const cast = []
levels.forEach((L) => {
  const n = L.cast.length
  L.cast.forEach((c, j) => {
    const x = -BW / 2 + (j + 0.5) * (BW / n) + (L.brain ? (j === 0 ? -0.6 : 0.6) : 0)
    if (!L.roof && !L.brain) desk(L.g, x + 0.05, -0.55, [C.mint, C.butter, C.lilac][j % 3])
    cast.push({ ...c, level: L, x, z: L.roof ? 0.1 : 0.15 })
  })
  if (L.key === 'make') { box(0.05, 0.9, 0.05, mat(C.ink), 2.55, 0.55, 0.2, L.g); box(0.22, 0.14, 0.18, mat(C.ink), 2.55, 1.05, 0.2, L.g) }
  if (L.key === 'build') { box(0.4, 1.0, 0.4, mat('#2E3B35'), 2.6, 0.62, -0.75, L.g) }
  if (L.key === 'sell' || L.key === 'write') plant(L.g, 2.65, -0.8)
  if (L.brain) { shelf(L.g, -2.3, -0.85, [C.butter, C.lilac, C.coral, C.mint, C.cream, C.butter, C.lilac, C.coral]); shelf(L.g, 2.3, -0.85, [C.mint, C.cream, C.coral, C.butter, C.lilac, C.mint, C.cream, C.coral]) }
})

// ---------------------------------------------------------------- the AI brain and the lines that feed every floor
const brainLevel = levels[0]
const brainMat = new THREE.MeshStandardMaterial({ color: C.mint, emissive: new THREE.Color(C.mint), emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.1 })
const brain = new THREE.Mesh(new THREE.TorusKnotGeometry(0.34, 0.11, 160, 20, 2, 3), brainMat); brain.position.set(0, 0.82, -0.35); brainLevel.g.add(brain)
box(0.7, 0.3, 0.6, mat('#2F4038'), 0, 0.29, -0.35, brainLevel.g)                  // its plinth
const cableMat = new THREE.MeshStandardMaterial({ color: C.mint, emissive: new THREE.Color(C.mint), emissiveIntensity: 0.5, roughness: 0.5 })
const riser = box(0.05, 1, 0.05, cableMat, -BW / 2 + 0.18, 0, -BD / 2 + 0.18, building) // the line up the back corner
const branches = levels.slice(1, -1).map((L) => box(BW - 0.5, 0.025, 0.025, cableMat.clone(), 0, L.y0 + SLAB + 0.02, -BD / 2 + 0.14, building))
const pulses = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: '#C9FFE6' })); building.add(m); return m })

// ---------------------------------------------------------------- the lift and its courier
const shaftX = BW / 2 + 0.62, topY = (LEVELS.length - 1) * FH
const shaft = box(0.62, topY + 0.3, 0.62, new THREE.MeshStandardMaterial({ color: '#A7C9BC', transparent: true, opacity: 0.28, roughness: 0.2 }), shaftX, (topY + 0.3) / 2, 0.2, building)
const rails = [-0.29, 0.29].map((dx) => box(0.04, topY + 0.3, 0.04, mat(C.ink), shaftX + dx, (topY + 0.3) / 2, 0.5, building))
const cabin = new THREE.Group(); building.add(cabin)
box(0.56, 0.06, 0.56, mat(C.ink), 0, 0.03, 0, cabin)

// ---------------------------------------------------------------- figurines
const figures = cast.map((c, k) => {
  const spec = { personality: c.p, seed: k * 0.61, head: c.human ? 'human' : 'bot', skin: C.skin, accent: C.ink,
    body: c.human ? C.mint : c.head ? TOOL[c.head] : C.claude, headLogo: c.head ? textures[c.head] : null, legLogo: c.legs ? textures.claude : null }
  const f = kit.makeFigurine(THREE, spec)
  const holder = new THREE.Group(); holder.add(f.group); holder.position.set(c.x, SLAB, c.z); holder.rotation.y = -0.2; holder.userData.base = 1.35
  c.level.g.add(holder)
  return { ...c, f, holder }
})
const courier = kit.makeFigurine(THREE, { personality: 'courier', seed: 2, head: 'bot', skin: C.skin, accent: C.ink, body: C.claude, headLogo: null, legLogo: textures.claude })
courier.group.position.set(0, 0.06, 0); courier.group.scale.setScalar(1.2); cabin.add(courier.group); cabin.rotation.y = -0.3

// ---------------------------------------------------------------- HTML: labels, panel, stars
const labels = document.getElementById('labels')
const signs = levels.map((L) => { const d = document.createElement('div'); d.className = 'sign' + (L.brain ? ' brain' : ''); d.innerHTML = (L.n ? `<b>${L.n}</b>` : '') + L.name; labels.appendChild(d); return d })
const tags = figures.map((fg) => { const d = document.createElement('div'); d.className = 'tag'; d.textContent = fg.role; labels.appendChild(d); return d })
const panel = document.getElementById('panel')
const cards = CARDS.map(([n, name, what, out], i) => { const d = document.createElement('div'); d.className = 'card' + (i === CARDS.length - 1 ? ' brain' : '')
  d.innerHTML = `<h3><span>${n}</span>${name}</h3><ul>${what.map((w) => `<li>${w}</li>`).join('')}</ul><div class="out"><em>Out comes</em>${out}</div>`; panel.appendChild(d); return d })
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
for (let i = 0; i < 70; i++) { const s = document.createElement('div'); s.className = 'star'; s.style.left = rnd() * 1080 + 'px'; s.style.top = rnd() * 360 + 'px'; s.style.opacity = 0.3 + rnd() * 0.7; document.getElementById('stars').appendChild(s) }

// ---------------------------------------------------------------- time
const clamp = (x) => Math.min(1, Math.max(0, x))
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const backOut = (x) => { const c = 1.6, t = clamp(x) - 1; return 1 + (c + 1) * t * t * t + c * t * t }
const project = (v) => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H] }
const BRAIN_ON = 0.15, FLOOR0 = 0.55, STEP = 0.27
const landAt = (i) => (i === 0 ? FLOOR0 : FLOOR0 + 0.2 + i * STEP)

window.setTime = (t) => {
  const night = smooth(7, 9, t)
  document.documentElement.style.setProperty('--n', night)
  document.getElementById('tday').style.opacity = clamp(1 - night * 2.4)
  document.getElementById('tnight').style.opacity = clamp(night * 2.4 - 1.4)
  hemi.intensity = 1.5 - 0.95 * night; roomLights.forEach((l) => (l.intensity = 2.2 * night)); sun.intensity = 2.1 - 1.85 * night; fill.intensity = 0.5 - 0.3 * night
  sun.color.set(night > 0.5 ? '#AFC4FF' : '#FFF3DE')
  windowMats.forEach((m) => (m.emissiveIntensity = 1.6 * night)); lampMats.forEach((m) => (m.emissiveIntensity = 0.35 + 1.2 * night))
  // The brain lights first; every floor then lands on top of it.
  const brainOn = smooth(BRAIN_ON, BRAIN_ON + 0.45, t)
  const breathe = 0.5 + 0.5 * Math.sin(t * 2.2)
  brainMat.emissiveIntensity = (0.5 + 0.35 * breathe + 1.1 * night) * brainOn
  brain.scale.setScalar(0.001 + brainOn * (1 + 0.04 * breathe)); brain.rotation.y = t * 0.6; brain.rotation.x = 0.3
  brainLight.intensity = brainOn * (1.2 + 5 * night + 0.6 * breathe)
  levels.forEach((L, i) => {
    const k = clamp((t - landAt(i)) / 0.5)
    L.g.position.y = L.y0 + (1 - backOut(k)) * 3.2 + (k <= 0 ? 40 : 0)
  })
  const top = levels[levels.length - 1]
  cap.position.y = top.g.position.y - 0.01; cap.visible = false
  // The line up the building grows as floors land, then carries pulses upward.
  const reach = Math.max(0.01, ...levels.map((L, i) => (t >= landAt(i) + 0.3 ? L.y0 + FH : 0)))
  riser.scale.y = reach; riser.position.y = reach / 2
  branches.forEach((b, i) => { const on = t >= landAt(i + 1) + 0.4; b.visible = on })
  const span = topY
  pulses.forEach((p, k) => { const y = ((t * 1.9 + k * span / 4) % span); p.position.set(-BW / 2 + 0.18, y, -BD / 2 + 0.18); p.visible = t > 3 && y < reach })
  branches.forEach((b, i) => { const fy = levels[i + 1].y0; const near = pulses.some((p) => p.visible && Math.abs(p.position.y - fy) < 0.35); b.material.emissiveIntensity = (near ? 1.6 : 0.45) + night * 0.6 })
  cableMat.emissiveIntensity = 0.5 + night * 0.8
  // Figurines pop in once their floor has landed, then each does its one small thing.
  figures.forEach((fg, j) => {
    const i = levels.indexOf(fg.level), start = landAt(i) + 0.35 + 0.07 * fg.level.cast.indexOf(fg.level.cast.find((c) => c.role === fg.role))
    const s = backOut(clamp((t - start) / 0.35)); fg.holder.scale.setScalar(Math.max(0.0001, s * 1.35)); fg.f.update(t)
  })
  // The courier rides the lift up, a floor at a time, from 3 s.
  const shaftOn = smooth(2.4, 2.9, t); shaft.visible = rails[0].visible = rails[1].visible = cabin.visible = shaftOn > 0.01
  shaft.scale.y = rails[0].scale.y = rails[1].scale.y = Math.max(0.001, shaftOn); shaft.position.y = rails[0].position.y = rails[1].position.y = (topY + 0.3) * shaftOn / 2
  const ride = Math.max(0, t - 3) / 9 * (LEVELS.length - 1), fl = Math.floor(ride), fr = ride - fl
  cabin.position.set(shaftX, Math.min(topY, (fl + smooth(0.45, 1, fr)) * FH) + SLAB, 0.2); courier.update(t)
  renderer.render(scene, camera)
  // Labels follow their floors and figurines; they arrive once the building has.
  const labelsOn = smooth(2.9, 3.4, t)
  levels.forEach((L, i) => { const [x, y] = project(new THREE.Vector3(-BW / 2 + 0.12, L.g.position.y + (L.roof ? 1.25 : FH - 0.06), BD / 2)); signs[i].style.transform = 'translate(0, 4px)'; Object.assign(signs[i].style, { left: x + 'px', top: y + 'px', opacity: labelsOn }) })
  figures.forEach((fg, j) => { const v = new THREE.Vector3(); fg.holder.getWorldPosition(v); v.y -= 0.02; v.z += 0.22; const [x, y] = project(v); Object.assign(tags[j].style, { left: x + 'px', top: y + 'px', opacity: labelsOn }) })
  cards.forEach((c, i) => { const k = smooth(2.5 + i * 0.12, 2.9 + i * 0.12, t); c.style.opacity = k; c.style.transform = `translateX(${(1 - k) * 40}px)` })
}
window.setTime(0)
await document.fonts.ready
window.ready = true
