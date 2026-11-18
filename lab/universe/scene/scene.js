// The work, as one building (lab/universe/PLAN.md). Everything is a pure function of t (seconds): window.setTime(t).
import * as THREE from '../vendor/three.module.js'

let kitName = 'codex'
const kit = await import('../figurines/index.js').catch(() => { kitName = 'placeholder'; return import('../figurines/placeholder.js') })
window.kitName = kitName

const W = 1080, H = 1350
const C = { ink: '#0C1512', cream: '#F4EFE4', mint: '#7EF0C0', butter: '#FFD84D', lilac: '#B7A6FF', coral: '#FF6A4D',
  slab: '#CBBFA7', wallIn: '#F2ECDF', wallOut: '#BDB29B', glass: '#2A3A33', skin: '#E9C6A2', claude: '#D97757' }
const LOGO = { claude: 'claude-symbol.png', openai: 'openai.jpg', github: 'github.jpg', vercel: 'vercel.png', supabase: 'supabase.jpg',
  elevenlabs: 'elevenlabs.jpg', runway: 'runway.jpg', buffer: 'buffer.jpg', gmail: 'gmail.jpg', canva: 'canva.jpg' }
const TOOL = { openai: '#E8E8E8', github: '#2B3137', vercel: '#1B1B1B', supabase: '#3ECF8E', elevenlabs: '#D9D4CC', runway: '#5B5BD6',
  buffer: '#B0EC9C', gmail: '#EA4335', canva: '#7D2AE8' }

// The work, bottom to top (Krish, 18 Nov 2026: richer, closer to the source post; no venture names).
// Each figurine: role, personality (the kit's action), and either a tool's mark on its head or Claude's on its legs.
const L_ = (role, p, mark, extra = {}) => ({ role, p, ...(mark === 'legs' ? { legs: true } : mark === 'human' ? { human: true } : { head: mark }), ...extra })
const LEVELS = [
  { key: 'brain', name: 'The AI brain', brain: true, fh: 2.05, rooms: ['Archives', 'Chief of staff', 'Analysis'], cast: [
    L_('Librarian', 'filer', 'supabase'), L_('File archive', 'filer', 'legs'), L_('Content archive', 'pageflip', 'legs'),
    L_('Inspiration house', 'bulb', 'legs'), L_('Taste + standards', 'stamper', 'legs'), L_('Auditor', 'magnifier', 'legs'),
    L_('Analyst', 'chin', 'legs'), L_('Trend spotter', 'binoculars', 'legs'), L_('Learnings', 'pentap', 'legs'),
    L_('Chief of staff', 'caller', 'legs', { chief: true })] },
  { key: 'build', n: '6', name: 'Build', rooms: ['Workshop', 'Test lab'], cast: [
    L_('Coder', 'typist', 'github'), L_('Reviewer', 'skeptic', 'legs'), L_('Deployer', 'button', 'vercel'),
    L_('Tester', 'magnifier', 'legs'), L_('Fixer', 'wrench', 'legs')] },
  { key: 'sell', n: '5', name: 'Sell', rooms: ['Account research', 'Call room'], cast: [
    L_('Account researcher', 'pageflip', 'legs'), L_('Call prep', 'chin', 'legs'), L_('CRM updater', 'filer', 'supabase'),
    L_('Notetaker', 'typist', 'legs'), L_('Outbound drafts', 'typist', 'gmail'), L_('Follow-up', 'pacer', 'gmail')] },
  { key: 'share', n: '4', name: 'Share', rooms: ['Posting desk', 'Community'], cast: [
    L_('Scheduler', 'button', 'buffer'), L_('Poster', 'waver', 'legs'), L_('Results reader', 'chin', 'legs'),
    L_('Replier', 'typist', 'legs'), L_('Amplifier', 'talker', 'legs')] },
  { key: 'make', n: '3', name: 'Make', rooms: ['Edit suite', 'Design studio'], cast: [
    L_('Video editor', 'bobber', 'runway'), L_('Voice + music', 'talker', 'elevenlabs'), L_('Motion designer', 'pentap', 'openai'),
    L_('Cover designer', 'pentap', 'canva'), L_('Carousels', 'pageflip', 'canva'), L_('Builder', 'wrench', 'openai')] },
  { key: 'write', n: '2', name: 'Write', rooms: ['Research desk', 'Script room'], cast: [
    L_('Researcher', 'pageflip', 'legs'), L_('Fact checker', 'magnifier', 'legs'), L_('Scriptwriter', 'typist', 'legs'),
    L_('Voice checker', 'skeptic', 'legs'), L_('Clarity coach', 'talker', 'legs')] },
  { key: 'watch', n: '1', name: 'Watch + ideas', rooms: ['Reading room', 'Idea lab'], cast: [
    L_('Link reader', 'scanner', 'legs'), L_('Inspiration scout', 'binoculars', 'legs'), L_('AI search probe', 'typist', 'openai'),
    L_('Divergent thinker', 'bulb', 'legs'), L_('Idea ranker', 'stamper', 'legs'), L_('Trend radar', 'scanner', 'legs')] },
  { key: 'roof', name: 'The decision deck', roof: true, rooms: [], cast: [
    L_('Vision', 'bulb', 'legs'), L_('Judgement', 'skeptic', 'legs'), L_('You, the CEO', 'sipper', 'human'),
    L_('Taste', 'magnifier', 'legs'), L_('Standards', 'stamper', 'legs')] },
]
const CARDS = [
  ['Roof', 'I decide', ['Set the vision, the taste and the standards', 'Judge, pick and approve everything that ships', 'One live board for every call I make'], 'Fast, clear decisions', []],
  ['1', 'Watch + ideas', ['Read every link I save within 15 minutes', 'Scout trends, with a divergent thinker on call', 'Check what AI search answers say first'], 'A ranked shortlist of ideas', ['claude', 'openai']],
  ['2', 'Write', ['Research every claim back to a source', 'Script it in my voice, checked line by line', 'A clarity coach makes it easy to follow'], 'Scripts ready to film', ['claude']],
  ['3', 'Make', ['Cut my takes into long and short videos', 'Motion, covers and carousels built to brand', 'Voice, captions and licensed music added'], 'Finished videos and posts', ['runway', 'openai', 'canva', 'elevenlabs']],
  ['4', 'Share', ['Schedule every post on every channel', 'Reply to every comment and message', 'Read what each post actually brought in'], 'Posts live, people talking', ['buffer', 'claude']],
  ['5', 'Sell', ['Research the account before the call', 'Take the notes, then update the CRM', 'Draft outreach and follow-ups I send'], 'Good meetings booked', ['gmail', 'supabase']],
  ['6', 'Build', ['Build the tools and apps behind it all', 'Review and test every change', 'Ship it, and fix what breaks, fast'], 'Tools that keep working', ['github', 'vercel']],
  ['Base', 'The AI brain', ['A proactive chief of staff running it all', 'Librarian, auditor, analyst, trend spotter, archives', 'Keeps my taste and standards, learns every fix'], 'Every floor runs on this', ['claude', 'supabase']],
]

// ---------------------------------------------------------------- renderer, camera, light
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(window.devicePixelRatio || 1); renderer.setSize(W, H); renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.insertBefore(renderer.domElement, document.getElementById('labels'))
const scene = new THREE.Scene()
const BW = 7.2, BD = 2.6, FH = 1.36, SLAB = 0.14, FIG = 1.12
const SCALE = 81
const CX = 348, CY = 1262
const camera = new THREE.OrthographicCamera(-CX / SCALE, (W - CX) / SCALE, CY / SCALE, -(H - CY) / SCALE, 0.1, 200)
camera.position.set(6.2, 2.7, 15); camera.lookAt(0, 0, 0)
const hemi = new THREE.HemisphereLight('#FFFFFF', '#9C8F78', 1.5); scene.add(hemi)
const sun = new THREE.DirectionalLight('#FFF3DE', 2.1); sun.position.set(6, 12, 9); scene.add(sun)
const fill = new THREE.DirectionalLight('#CFE6FF', 0.5); fill.position.set(-8, 4, 6); scene.add(fill)
const brainLight = new THREE.PointLight(C.mint, 0, 10, 1.3); brainLight.position.set(0, 1.2, 0.2); scene.add(brainLight)

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o })
const box = (w, h, d, m, x, y, z, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o }
const loader = new THREE.TextureLoader()
const textures = {}
await Promise.all(Object.entries(LOGO).map(([k, f]) => new Promise((res) => loader.load(`../logos/${f}`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; textures[k] = t; res() }, undefined, () => res()))))

// ---------------------------------------------------------------- the building
const building = new THREE.Group(); scene.add(building)
box(BW + 2.6, 0.2, BD + 1.2, mat('#B9AD95'), 0.6, -0.1, 0.3, scene)
const levels = [], windowMats = [], lampMats = [], roomLights = []
let yAcc = 0
LEVELS.forEach((L) => {
  const fh = L.fh || FH, g = new THREE.Group(); building.add(g)
  const y0 = yAcc; yAcc += L.roof ? 0 : fh
  const wallIn = mat(L.brain ? '#1B2A24' : C.wallIn), slab = mat(L.brain ? '#24342D' : C.slab), out = mat(C.wallOut)
  box(BW, SLAB, BD, slab, 0, SLAB / 2, 0, g)
  if (!L.roof) {
    box(BW, fh, 0.1, wallIn, 0, fh / 2, -BD / 2 + 0.05, g)
    box(0.1, fh, BD, wallIn, -BW / 2 + 0.05, fh / 2, 0, g)
    box(0.14, fh, BD, out, BW / 2 + 0.07, fh / 2, 0, g)
    for (const z of [-0.7, 0.5]) { const wm = mat(C.glass, { emissive: new THREE.Color('#FFD98A'), emissiveIntensity: 0 }); windowMats.push(wm); box(0.02, fh * 0.4, 0.6, wm, BW / 2 + 0.145, fh * 0.55, z, g) }
    const lamp = mat('#FFF6DD', { emissive: new THREE.Color('#FFE3A0'), emissiveIntensity: 0 }); lampMats.push(lamp)
    box(BW - 0.6, 0.03, 0.12, lamp, 0, fh - 0.03, -BD / 2 + 0.4, g)
    // Glass partitions between the rooms
    const n = L.rooms.length
    for (let r = 1; r < n; r++) { const x = -BW / 2 + (r * BW) / n; box(0.05, fh - SLAB, 0.05, mat('#8E8470'), x, fh / 2, -BD / 2 + 0.15, g); box(0.03, 0.005, BD - 0.2, mat('#A99C84'), x, SLAB + 0.003, 0, g) }
    if (!L.brain) { const pl = new THREE.PointLight('#FFD9A0', 0, 5, 1.4); pl.position.set(0, fh - 0.25, 0.4); g.add(pl); roomLights.push(pl) }
  } else {
    box(BW, 0.28, 0.08, out, 0, 0.28, -BD / 2 + 0.04, g); box(0.08, 0.28, BD, out, -BW / 2 + 0.04, 0.28, 0, g); box(0.08, 0.28, BD, out, BW / 2 - 0.04, 0.28, 0, g)
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.6, 20), mat('#9A8A70')); tank.position.set(-2.8, 0.95, -0.75); g.add(tank)
    for (const x of [-3.0, -2.6]) box(0.05, 0.5, 0.05, mat(C.ink), x, 0.4, -0.75, g)
    box(0.04, 1.3, 0.04, mat(C.ink), 3.0, 0.8, -0.85, g)
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.03, 32), mat('#3A4A43')); pad.position.set(2.2, SLAB + 0.02, -0.5); g.add(pad)
    box(0.08, 0.01, 0.5, mat(C.cream), 2.02, SLAB + 0.04, -0.5, g); box(0.08, 0.01, 0.5, mat(C.cream), 2.38, SLAB + 0.04, -0.5, g); box(0.36, 0.01, 0.08, mat(C.cream), 2.2, SLAB + 0.04, -0.5, g)
  }
  levels.push({ ...L, fh, g, y0 })
})
const topY = levels[levels.length - 1].y0

// ---------------------------------------------------------------- furniture and placement
function desk(g, x, z, screen) {
  box(0.56, 0.05, 0.34, mat('#A88E6C'), x, 0.42, z, g)
  for (const dx of [-0.24, 0.24]) box(0.04, 0.4, 0.28, mat('#7E6A50'), x + dx, 0.2, z, g)
  box(0.34, 0.24, 0.03, mat(C.ink), x, 0.6, z - 0.08, g)
  const s = mat(screen, { emissive: new THREE.Color(screen), emissiveIntensity: 0.35 }); lampMats.push(s); box(0.3, 0.2, 0.01, s, x, 0.6, z - 0.06, g)
}
function shelf(g, x, z, h = 1.4) {
  box(1.0, h, 0.3, mat('#8B7454'), x, h / 2 + SLAB, z, g)
  const cols = [C.butter, C.lilac, C.coral, C.mint, C.cream]
  for (let k = 0; k < 12; k++) box(0.2, 0.18, 0.2, mat(cols[k % 5]), x - 0.33 + (k % 4) * 0.22, 0.32 + Math.floor(k / 4) * 0.42, z + 0.06, g)
}
const cast = []
levels.forEach((L) => {
  const others = L.cast.filter((c) => !c.chief), n = others.length
  const rows = L.brain ? 2 : 1, perRow = Math.ceil(n / rows)
  const BACK = [-3.1, -2.1, -1.15, 1.15, 2.1, 3.1], FRONT = [-2.6, -1.35, 1.4]
  others.forEach((c, j) => {
    let x, z, row
    if (L.brain) { row = j < BACK.length ? 0 : 1; x = row === 0 ? BACK[j] : FRONT[j - BACK.length]; z = row === 0 ? -0.3 : 0.6 }
    else { row = L.roof ? 1 : j % 2; x = -BW / 2 + (j + 0.5) * (BW / n); z = L.roof ? 0.15 : row === 1 ? 0.5 : -0.35 }
    if (!L.roof && !L.brain && row === 0) desk(L.g, x, -0.85, [C.mint, C.butter, C.lilac][j % 3])
    cast.push({ ...c, level: L, x, z, row })
  })
  const chief = L.cast.find((c) => c.chief)
  if (chief) cast.push({ ...chief, level: L, x: 0, z: 0.7, row: 1 })
  if (L.brain) { shelf(L.g, -2.6, -1.05, 1.6); shelf(L.g, 2.6, -1.05, 1.6) }
})

// ---------------------------------------------------------------- the AI brain and the lines that feed every floor
const brainLevel = levels[0]
const brainMat = new THREE.MeshStandardMaterial({ color: C.mint, emissive: new THREE.Color(C.mint), emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.1 })
const brain = new THREE.Mesh(new THREE.TorusKnotGeometry(0.42, 0.13, 180, 22, 2, 3), brainMat); brain.position.set(0, 1.25, -0.7); brainLevel.g.add(brain)
box(0.9, 0.55, 0.7, mat('#2F4038'), 0, 0.42, -0.75, brainLevel.g)
const cableMat = new THREE.MeshStandardMaterial({ color: C.mint, emissive: new THREE.Color(C.mint), emissiveIntensity: 0.5, roughness: 0.5 })
const riser = box(0.05, 1, 0.05, cableMat, -BW / 2 + 0.18, 0, -BD / 2 + 0.18, building)
const branches = levels.slice(1).map((L) => box(BW - 0.5, 0.025, 0.025, cableMat.clone(), 0, L.y0 + SLAB + 0.02, -BD / 2 + 0.14, building))
const pulses = [0, 1, 2, 3, 4].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: '#C9FFE6' })); building.add(m); return m })

// ---------------------------------------------------------------- the lift and its courier
const shaftX = BW / 2 + 0.62, shaftH = topY + 0.3
const shaft = box(0.62, shaftH, 0.62, new THREE.MeshStandardMaterial({ color: '#A7C9BC', transparent: true, opacity: 0.28, roughness: 0.2 }), shaftX, shaftH / 2, 0.2, building)
const rails = [-0.29, 0.29].map((dx) => box(0.04, shaftH, 0.04, mat(C.ink), shaftX + dx, shaftH / 2, 0.5, building))
const cabin = new THREE.Group(); building.add(cabin); box(0.56, 0.06, 0.56, mat(C.ink), 0, 0.03, 0, cabin)

// ---------------------------------------------------------------- figurines
const figures = cast.map((c, k) => {
  const spec = { personality: c.p, seed: k * 0.61, head: c.human ? 'human' : 'bot', skin: C.skin, accent: C.ink,
    body: c.human ? C.mint : c.chief ? C.mint : c.head ? TOOL[c.head] : C.claude, headLogo: c.head ? textures[c.head] : null, legLogo: c.legs ? textures.claude : null }
  const f = kit.makeFigurine(THREE, spec)
  const holder = new THREE.Group(); holder.add(f.group); holder.position.set(c.x, SLAB, c.z); holder.rotation.y = -0.2
  c.level.g.add(holder)
  return { ...c, f, holder, size: c.chief ? 1.75 : FIG }
})
const courier = kit.makeFigurine(THREE, { personality: 'courier', seed: 2, head: 'bot', skin: C.skin, accent: C.ink, body: C.claude, headLogo: null, legLogo: textures.claude })
courier.group.position.set(0, 0.06, 0); courier.group.scale.setScalar(1.15); cabin.add(courier.group); cabin.rotation.y = -0.3

// ---------------------------------------------------------------- HTML: labels, panel, stars
const labels = document.getElementById('labels')
const el = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; labels.appendChild(d); return d }
const signs = levels.map((L) => el('sign' + (L.brain ? ' brain' : ''), (L.n ? `<b>${L.n}</b>` : '') + L.name))
// Room names are painted on each room's back wall, so they belong to the room.
await document.fonts.load('600 40px Plex')
levels.forEach((L) => L.rooms.forEach((r, i) => {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const x2 = cv.getContext('2d')
  const brainSign = L.brain && r === 'Chief of staff'
  x2.font = '600 44px Plex'; const w = Math.min(500, x2.measureText(r.toUpperCase()).width + 44)
  x2.fillStyle = brainSign ? C.mint : '#2A3A33'; x2.beginPath(); x2.roundRect((512 - w) / 2, 10, w, 76, 12); x2.fill()
  x2.fillStyle = brainSign ? C.ink : C.cream; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(r.toUpperCase(), 256, 50)
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
  const n = L.rooms.length, cx = L.brain ? [-1.3, 0.75, 2.55][i] : -BW / 2 + ((i + 0.5) * BW) / n + (i === 0 ? 0.95 : 0)
  const m = new THREE.Mesh(new THREE.PlaneGeometry(L.brain ? 1.45 : 1.75, L.brain ? 0.265 : 0.32), new THREE.MeshBasicMaterial({ map: tex, transparent: true }))
  const sy = L.fh - 0.2
  m.position.set(cx, sy, BD / 2 - 0.3); L.g.add(m)
  for (const dx of [-0.45, 0.45]) box(0.012, L.fh - sy - 0.16, 0.012, mat(C.ink), cx + dx, (L.fh + sy + 0.16) / 2, BD / 2 - 0.3, L.g)
}))
const tags = figures.map((fg) => el('tag' + (fg.chief ? ' chief' : ''), fg.role))
const panel = document.getElementById('panel')
const cards = CARDS.map(([n, name, what, out, icons], i) => { const d = document.createElement('div'); d.className = 'card' + (i === CARDS.length - 1 ? ' brain' : '')
  d.innerHTML = `<h3><span>${n}</span>${name}<i>${icons.map((k) => `<img src="../logos/${LOGO[k]}">`).join('')}</i></h3><ul>${what.map((w) => `<li>${w}</li>`).join('')}</ul><div class="out"><em>Hands off</em>${out}</div>`
  panel.appendChild(d); return d })
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
for (let i = 0; i < 70; i++) { const s = document.createElement('div'); s.className = 'star'; s.style.left = rnd() * 1080 + 'px'; s.style.top = rnd() * 330 + 'px'; s.style.opacity = 0.3 + rnd() * 0.7; document.getElementById('stars').appendChild(s) }

// ---------------------------------------------------------------- time
const clamp = (x) => Math.min(1, Math.max(0, x))
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const backOut = (x) => { const c = 1.6, t = clamp(x) - 1; return 1 + (c + 1) * t * t * t + c * t * t }
const project = (v) => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H] }
const BRAIN_ON = 0.15, FLOOR0 = 0.55, STEP = 0.27
const landAt = (i) => (i === 0 ? FLOOR0 : FLOOR0 + 0.25 + i * STEP)

window.setTime = (t) => {
  const night = smooth(7, 9, t)
  document.documentElement.style.setProperty('--n', night)
  document.getElementById('tday').style.opacity = clamp(1 - night * 2.4)
  document.getElementById('tnight').style.opacity = clamp(night * 2.4 - 1.4)
  hemi.intensity = 1.5 - 0.95 * night; roomLights.forEach((l) => (l.intensity = 2.2 * night)); sun.intensity = 2.1 - 1.85 * night; fill.intensity = 0.5 - 0.3 * night
  sun.color.set(night > 0.5 ? '#AFC4FF' : '#FFF3DE')
  windowMats.forEach((m) => (m.emissiveIntensity = 1.6 * night)); lampMats.forEach((m) => (m.emissiveIntensity = 0.35 + 1.2 * night))
  const brainOn = smooth(BRAIN_ON, BRAIN_ON + 0.45, t), breathe = 0.5 + 0.5 * Math.sin(t * 2.2)
  brainMat.emissiveIntensity = (0.5 + 0.35 * breathe + 1.1 * night) * brainOn
  brain.scale.setScalar(0.001 + brainOn * (1 + 0.04 * breathe)); brain.rotation.y = t * 0.6; brain.rotation.x = 0.3
  brainLight.intensity = brainOn * (1.4 + 5 * night + 0.6 * breathe)
  levels.forEach((L, i) => { const k = clamp((t - landAt(i)) / 0.5); L.g.position.y = L.y0 + (1 - backOut(k)) * 3.2 + (k <= 0 ? 40 : 0) })
  const reach = Math.max(0.01, ...levels.map((L, i) => (t >= landAt(i) + 0.3 ? L.y0 + (L.roof ? 0.3 : L.fh) : 0)))
  riser.scale.y = reach; riser.position.y = reach / 2
  branches.forEach((b, i) => { b.visible = t >= landAt(i + 1) + 0.4 })
  pulses.forEach((p, k) => { const y = ((t * 2.1 + (k * topY) / 5) % topY); p.position.set(-BW / 2 + 0.18, y, -BD / 2 + 0.18); p.visible = t > 3 && y < reach })
  branches.forEach((b, i) => { const fy = levels[i + 1].y0; const near = pulses.some((p) => p.visible && Math.abs(p.position.y - fy) < 0.35); b.material.emissiveIntensity = (near ? 1.6 : 0.45) + night * 0.6 })
  cableMat.emissiveIntensity = 0.5 + night * 0.8
  figures.forEach((fg, j) => {
    const i = levels.indexOf(fg.level), start = landAt(i) + 0.3 + 0.05 * fg.level.cast.indexOf(fg.level.cast.find((c) => c.role === fg.role))
    fg.holder.scale.setScalar(Math.max(0.0001, backOut(clamp((t - start) / 0.35)) * fg.size)); fg.f.update(t)
  })
  const shaftOn = smooth(2.5, 3.0, t); shaft.visible = rails[0].visible = rails[1].visible = cabin.visible = shaftOn > 0.01
  shaft.scale.y = rails[0].scale.y = rails[1].scale.y = Math.max(0.001, shaftOn); shaft.position.y = rails[0].position.y = rails[1].position.y = shaftH * shaftOn / 2
  const stops = levels.map((L) => L.y0), ride = Math.max(0, t - 3) / 9 * (stops.length - 1), fl = Math.min(stops.length - 2, Math.floor(ride)), fr = ride - fl
  cabin.position.set(shaftX, stops[fl] + (stops[fl + 1] - stops[fl]) * smooth(0.45, 1, fr) + SLAB, 0.2); courier.update(t)
  renderer.render(scene, camera)
  const labelsOn = smooth(2.9, 3.4, t)
  levels.forEach((L, i) => { const [x, y] = project(new THREE.Vector3(-BW / 2 + 0.12, L.g.position.y + (L.roof ? 1.3 : L.fh - 0.06), BD / 2)); Object.assign(signs[i].style, { left: x + 'px', top: y + 'px', opacity: labelsOn, transform: 'translate(0, 4px)' }) })
  figures.forEach((fg, j) => { const v = new THREE.Vector3(); fg.holder.getWorldPosition(v); v.y = fg.level.g.position.y + SLAB; v.z = BD / 2 - 0.05; const [x, y] = project(v); const lane = fg.chief ? 0 : fg.row === 0 ? -22 : 0; let top = y + lane - 22; if (fg.level.brain && fg.row === 0) { const h = new THREE.Vector3(); fg.holder.getWorldPosition(h); h.y += 0.74 * fg.size; top = project(h)[1] - 20 - (fg.level.cast.indexOf(fg.level.cast.find((c) => c.role === fg.role)) % 2) * 22 } Object.assign(tags[j].style, { left: x + 'px', top: top + 'px', opacity: labelsOn, transform: 'translate(-50%, 0)' }) })
  cards.forEach((c, i) => { const k = smooth(2.5 + i * 0.12, 2.9 + i * 0.12, t); c.style.opacity = k; c.style.transform = `translateX(${(1 - k) * 40}px)` })
}
window.setTime(0)
await document.fonts.ready
window.ready = true
