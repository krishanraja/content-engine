import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Script, createContext } from 'node:vm'
import { afterAll, describe, expect, it } from 'vitest'

// scripts/post-pack/week_board.py: the week's one publish board, three tabs
// and a tick for every step, saved in the page's own store. Krish,
// 2026-10-12: "just give me one ... Publish Manager for the ... whole week
// with 3 tabs on it for Mon / Weds / Fri, which we need to get to 100%. Give
// me a tick box next to each one so I can tick as I go and you can durably
// record that completion where it needs to be recorded."

const ROOT = join(__dirname, '..', '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
// Nothing here may reach the engine: no key, and an address that cannot resolve.
const env: NodeJS.ProcessEnv = { ...process.env, ENGINE_BASE_URL: 'https://engine.invalid', PYTHONIOENCODING: 'utf-8' }
delete env.ENGINE_OPERATOR_TOKEN
delete env.CLAUDE_CODE_REMOTE
const work = mkdtempSync(join(tmpdir(), 'week-board-test-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

// The board published on 12 October, reduced to what a rebuild must keep.
const PUBLISHED = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'week-board', 'published-2026-10-12.json'), 'utf8')) as {
  url: string; tick_ids: string[]; steps: Array<{ key: string; label: string; channel: string | null; standing: boolean }>; pieces: Record<string, string | null>
}
// This week's real publish pages, only where a session points at them (WEEK_BOARD_DAY_PAGES).
const DAY_PAGES = process.env.WEEK_BOARD_DAY_PAGES || ''
const MONDAY_PAGE = DAY_PAGES && join(DAY_PAGES, 'pm-monday', 'monday-publish.html')
const FRIDAY_PAGE = DAY_PAGES && join(DAY_PAGES, 'pm-friday', 'friday-publish.html')
const SENT = DAY_PAGES && join(DAY_PAGES, 'descript', 'sent.json')
const MON = 'f328382d-71b3-41a7-a221-d8615826f12e'
const WED = '7554ed4a-560b-4365-b266-ea72abeed7ef'
const FRI = '904658db-4df2-4537-a0ed-ebe93e081db7'
const STEPS = ['record-long', 'record-short', 'substack', 'youtube', 'shorts', 'tiktok', 'reels', 'linkedin', 'whatsapp', 'notes']

function run(args: string[]) {
  return spawnSync(PY, [join(ROOT, 'scripts', 'post-pack', 'week_board.py'), ...args], { encoding: 'utf8', env, cwd: work, maxBuffer: 64 * 1024 * 1024 })
}

function ids(page: string) {
  const all = [...page.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]!)
  return { all, duplicates: [...new Set(all.filter((x, i) => all.indexOf(x) !== i))] }
}

function boardScript(page: string) {
  const m = /<script>\n([\s\S]*)\n<\/script>\s*$/.exec(page)
  expect(m, 'the board ends with its own script').not.toBeNull()
  return m![1]!
}

function conf(page: string) {
  const m = /const CONF = (\{.*?\});\n/.exec(page)
  expect(m, 'the board carries its CONF').not.toBeNull()
  return JSON.parse(m![1]!) as { steps: Array<{ key: string; label: string; channel: string | null; standing: boolean }>; days: Array<{ key: string; piece_id: string | null; state: string }> }
}

// ---------------------------------------------------------------- a small DOM, enough for week.js

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
type Listener = (e: Record<string, unknown>) => unknown

class El {
  tag: string
  attrs: Record<string, string>
  children: El[] = []
  parent: El | null = null
  own = ''
  listeners: Record<string, Listener[]> = {}
  hidden: boolean
  disabled: boolean
  checked: boolean
  value = ''
  tabIndex = 0
  offsetHeight = 48
  style: Record<string, unknown> = { setProperty() {} }
  dataset: Record<string, string>
  classList: { has: Set<string>; toggle(c: string, on?: boolean): void; add(c: string): void; remove(c: string): void; contains(c: string): boolean }
  constructor(tag: string, attrs: Record<string, string>) {
    this.tag = tag
    this.attrs = attrs
    this.hidden = 'hidden' in attrs
    this.disabled = 'disabled' in attrs
    this.checked = 'checked' in attrs
    this.dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]))
    const has = new Set((attrs.class || '').split(/\s+/).filter(Boolean))
    this.classList = {
      has,
      toggle(c, on) { if (on ?? !has.has(c)) has.add(c); else has.delete(c) },
      add(c) { has.add(c) },
      remove(c) { has.delete(c) },
      contains(c) { return has.has(c) },
    }
  }
  get textContent(): string { return this.own + this.children.map(c => c.textContent).join('') }
  set textContent(v: string) { this.own = String(v); this.children = [] }
  get className() { return [...this.classList.has].join(' ') }
  set className(v: string) { this.classList.has.clear(); for (const c of String(v).split(/\s+/).filter(Boolean)) this.classList.has.add(c) }
  get id() { return this.attrs.id }
  getAttribute(k: string) { return this.attrs[k] ?? null }
  setAttribute(k: string, v: unknown) { this.attrs[k] = String(v) }
  addEventListener(type: string, fn: Listener) { (this.listeners[type] ||= []).push(fn) }
  focus() {}
  contains(other: El | null) { for (let e = other; e; e = e.parent) if (e === this) return true; return false }
  closest(selector: string): El | null { for (let e: El | null = this; e && e.tag !== '#root'; e = e.parent) if (matchesAny(e, selector)) return e; return null }
  querySelectorAll(selector: string): El[] { const out: El[] = []; walk(this, e => { if (matchesAny(e, selector)) out.push(e) }); return out }
  querySelector(selector: string): El | null { return this.querySelectorAll(selector)[0] ?? null }
}

function walk(root: El, fn: (e: El) => void) { for (const c of root.children) { fn(c); walk(c, fn) } }

interface Compound { tag?: string; id?: string; classes: string[]; attrs: Array<{ name: string; value?: string }> }
function compound(text: string): Compound {
  const out: Compound = { classes: [], attrs: [] }
  const tag = /^[a-zA-Z][a-zA-Z0-9]*/.exec(text)
  if (tag) out.tag = tag[0].toLowerCase()
  for (const m of text.slice(tag ? tag[0].length : 0).matchAll(/#([\w-]+)|\.([\w-]+)|\[([^\]=]+)(?:=("?)([^"\]]*)\4)?\]/g)) {
    if (m[1]) out.id = m[1]
    else if (m[2]) out.classes.push(m[2])
    else out.attrs.push({ name: m[3]!.trim(), value: m[5] })
  }
  return out
}
function matchesCompound(e: El, c: Compound) {
  if (c.tag && e.tag !== c.tag) return false
  if (c.id && e.attrs.id !== c.id) return false
  if (c.classes.some(k => !e.classList.has.has(k))) return false
  return c.attrs.every(a => a.name in e.attrs && (a.value === undefined || e.attrs[a.name] === a.value))
}
function matches(e: El, selector: string): boolean {
  const parts = selector.trim().split(/\s+/).map(compound)
  if (!matchesCompound(e, parts[parts.length - 1]!)) return false
  let at: El | null = e.parent
  for (let i = parts.length - 2; i >= 0; i--) {
    while (at && !matchesCompound(at, parts[i]!)) at = at.parent
    if (!at) return false
    at = at.parent
  }
  return true
}
const matchesAny = (e: El, selector: string) => e.tag !== '#root' && selector.split(',').some(s => matches(e, s))

function parse(html: string): El {
  const root = new El('#root', {})
  let at = root
  const body = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<title>[\s\S]*?<\/title>/g, '')
  for (const m of body.matchAll(/<!--[\s\S]*?-->|<(\/)?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>/]+(?:="[^"]*"|='[^']*'|=[^\s>]+)?)*)\s*(\/)?>|([^<]+)/g)) {
    if (m[5] !== undefined) { at.children.push(Object.assign(new El('#text', {}), { own: unescape(m[5]), parent: at })); continue }
    if (!m[2]) continue
    const tag = m[2].toLowerCase()
    if (m[1]) {
      for (let e: El | null = at; e && e !== root; e = e.parent) if (e.tag === tag) { at = e.parent!; break }
      continue
    }
    const attrs: Record<string, string> = {}
    for (const a of (m[3] || '').matchAll(/([^\s=]+)(?:="([^"]*)"|='([^']*)'|=([^\s>]+))?/g)) attrs[a[1]!] = unescape(a[2] ?? a[3] ?? a[4] ?? '')
    const el = new El(tag, attrs)
    el.parent = at
    at.children.push(el)
    if (!VOID.has(tag) && !m[4]) at = el
  }
  return root
}

interface Store { saved: Record<string, Record<string, unknown>>; writes: Array<{ path: string; body: Record<string, unknown> }>; fail: boolean }
function mountBoard(page: string, store: Store | null) {
  const root = parse(page)
  const docListeners: Record<string, Listener[]> = {}
  const timers = new Map<number, () => void>()
  let nextTimer = 0
  const db = store && {
    collection(name: string) {
      return {
        doc(id: string) { return { async set(body: Record<string, unknown>) { if (store.fail) throw new Error('refused'); store.writes.push({ path: `${name}/${id}`, body }) } } },
        onSnapshot(cb: (s: unknown) => void) { cb({ docs: Object.entries(store.saved).map(([id, data]) => ({ id, exists: true, data: () => data })) }); return () => {} },
      }
    },
    doc(path: string) {
      return {
        async set(body: Record<string, unknown>) { if (store.fail) throw new Error('refused'); store.writes.push({ path, body }) },
        onSnapshot(cb: (s: unknown) => void) { cb({ exists: false, data: () => null }); return () => {} },
      }
    },
  }
  const document = {
    getElementById: (id: string) => root.querySelector(`#${id}`),
    querySelector: (s: string) => root.querySelector(s),
    querySelectorAll: (s: string) => root.querySelectorAll(s),
    addEventListener: (type: string, fn: Listener) => { (docListeners[type] ||= []).push(fn) },
    documentElement: { style: { setProperty() {} } },
    body: { appendChild() {} },
    activeElement: null,
  }
  const window: Record<string, unknown> = {
    claude: store ? { use: async (name: string) => (name === 'db' ? db : { save: async () => {} }) } : undefined,
    addEventListener() {},
    scrollTo() {},
  }
  const context = createContext({
    window, document, location: { hash: '' }, history: { replaceState() {} },
    localStorage: { getItem: () => null, setItem() {} }, CSS: { escape: (s: string) => s },
    ResizeObserver: class { observe() {} }, navigator: {}, getSelection: () => null, console,
    setTimeout: (fn: () => void) => { timers.set(++nextTimer, fn); return nextTimer }, clearTimeout: (id: number) => { timers.delete(id) },
  })
  new Script(boardScript(page)).runInContext(context)
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)) }
  const boxes = (id: string) => root.querySelectorAll(`input[data-tick="${id}"]`)
  const change = async (input: El, on: boolean) => {
    input.checked = on
    for (const fn of docListeners.change || []) fn({ target: input })
    await settle()
  }
  const flush = async () => { while (timers.size) { const [id, fn] = timers.entries().next().value!; timers.delete(id); fn() } await settle() }
  return { root, boxes, change, flush, settle }
}

describe('week_board.py builds the week\'s one publish board', () => {
  it('--self-test: unique ids, the tick ids, the db wiring, no long dashes, the not made yet state and the manifest', () => {
    const result = run(['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/week board self-test passed: \d+ checks/)
  }, 120_000)

  it('a week with nothing made yet is three designed tabs; the picked one already ticks, and the script compiles', () => {
    const out = join(work, 'empty', 'week-board.html')
    const result = run(['--week', '2026-10-19', '--pending', 'wed=The watermark piece', '--piece', `wed=${WED}`, '--out', out])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    const page = readFileSync(out, 'utf8')
    expect(ids(page).duplicates).toEqual([])
    expect(page).toContain('<div class="kick">19 to 23 October 2026</div>')
    expect(page).toContain('picked, not made yet')
    expect((page.match(/data-state="not_picked"/g) || []).length).toBe(2)
    expect(new Set([...page.matchAll(/data-tick="([^"]+)"/g)].map(m => m[1]))).toEqual(new Set(STEPS.map(s => `wed-${s}`)))
    expect(() => new Script(boardScript(page))).not.toThrow()
    const manifest = JSON.parse(readFileSync(join(work, 'empty', 'week-board.json'), 'utf8'))
    expect(manifest.week_start).toBe('2026-10-19')
    expect(manifest.made).toEqual([])
    expect(manifest.picked).toEqual(['wed'])
    // The artifact contract declares the downloads capability as true.
    expect(manifest.publish).toMatchObject({ title: "This Week's Publish Board", icon: 'calendar', capabilities: { db: {}, downloads: true } })
  }, 60_000)

  it('refuses a week that does not start on a Monday', () => {
    const result = run(['--week', '2026-10-13', '--out', join(work, 'bad.html')])
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/Monday/)
  })

  it('a rebuild keeps every tick of the board published on 12 October: the same doc ids, the same steps, the same pieces', () => {
    const out = join(work, 'kept', 'week-board.html')
    const result = run(['--week', '2026-10-12', '--piece', `mon=${MON}`, '--pending', 'mon=Monday', '--piece', `fri=${FRI}`, '--pending', 'fri=Friday', '--out', out])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    const page = readFileSync(out, 'utf8')
    expect(new Set([...page.matchAll(/data-tick="([^"]+)"/g)].map(m => m[1]))).toEqual(new Set(PUBLISHED.tick_ids))
    expect(conf(page).steps).toEqual(PUBLISHED.steps)
    expect(Object.fromEntries(conf(page).days.map(d => [d.key, d.piece_id]))).toEqual(PUBLISHED.pieces)
    expect(PUBLISHED.tick_ids.length).toBe(20)
  }, 60_000)

  it('--previous refuses a rebuild that would turn a day the published board holds into not picked', () => {
    const before = join(work, 'kept', 'week-board.json')
    expect(existsSync(before)).toBe(true)
    const result = run(['--week', '2026-10-12', '--previous', before, '--piece', `fri=${FRI}`, '--pending', 'fri=Friday', '--out', join(work, 'lost.html')])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`--piece mon=${MON}`)
    expect(existsSync(join(work, 'lost.html'))).toBe(false)
    const shown = run(['--show', before, '--json'])
    expect(shown.status, shown.stderr).toBe(0)
    expect(JSON.parse(shown.stdout).days.mon).toEqual({ state: 'picked', piece_id: MON })
  }, 60_000)

  it.skipIf(!MONDAY_PAGE || !existsSync(MONDAY_PAGE) || !existsSync(FRIDAY_PAGE))('this week\'s board from the real Monday and Friday pages: no id twice, and the published board\'s ticks', () => {
    const out = join(work, 'real', 'week-board.html')
    const args = ['--week', '2026-10-12', '--day', `mon=${MONDAY_PAGE}`, '--day', `fri=${FRIDAY_PAGE}`, '--piece', `mon=${MON}`, '--piece', `fri=${FRI}`, '--out', out]
    if (existsSync(SENT)) args.push('--descript', SENT)
    const result = run(args)
    expect(result.status, result.stdout + result.stderr).toBe(0)
    const page = readFileSync(out, 'utf8')
    const found = ids(page)
    expect(found.duplicates).toEqual([])
    expect(found.all.length).toBeGreaterThan(60)
    expect(Buffer.byteLength(page)).toBeLessThan(16 * 1024 * 1024)
    expect(page).not.toContain('Mark done')
    expect(new Set([...page.matchAll(/data-tick="([^"]+)"/g)].map(m => m[1]))).toEqual(new Set(PUBLISHED.tick_ids))
    expect(conf(page).steps).toEqual(PUBLISHED.steps)
    if (existsSync(SENT)) expect((page.match(/href="https:\/\/web\.descript\.com\//g) || []).length).toBe(8)
  }, 120_000)
})

describe('the board\'s own script saves each tick in the page\'s store', () => {
  // A made Monday (a publish page made by publish_manager.py itself) and a picked Wednesday.
  const made = spawnSync(PY, ['-c', `
import sys
from pathlib import Path
sys.path.insert(0, ${JSON.stringify(join(ROOT, 'scripts', 'post-pack'))})
import week_board
out = Path(sys.argv[1])
mon = week_board.stand_in(str(out), 'mon', 'Who gets paid for AI songs', 'follow.the.money')
page, manifest, warnings = week_board.board(week_board.monday_of('2026-10-12'), {'mon': mon}, {'mon': '${MON}', 'wed': '${WED}'}, {}, pending={'wed': 'Watermarks'})
(out / 'board.html').write_text(page, encoding='utf-8')
`, work], { encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 })
  const page = made.status === 0 ? readFileSync(join(work, 'board.html'), 'utf8') : ''
  const at = '2026-10-12T15:00:00.000Z'
  const saved = () => ({
    'mon-substack': { done: true, at, day: 'mon', piece_id: MON, step: 'substack', channel: 'substack', label: 'Substack: video post with the article' },
    // A tick saved for another piece (the day picked again) is not this piece's.
    'wed-youtube': { done: true, at, day: 'wed', piece_id: '00000000-0000-4000-8000-000000000000', step: 'youtube', channel: 'youtube', label: 'YouTube: the 3-minute video' },
  })

  it('builds', () => {
    expect(made.status, made.stderr).toBe(0)
  })

  it('loads the saved ticks: a tick of the day\'s piece is on, one saved for another piece is not, and every box can be ticked', async () => {
    const store: Store = { saved: saved(), writes: [], fail: false }
    const board = mountBoard(page, store)
    await board.settle()
    expect(board.boxes('mon-substack').length).toBe(2)
    expect(board.boxes('mon-substack').every(b => b.checked)).toBe(true)
    expect(board.boxes('wed-youtube').every(b => !b.checked)).toBe(true)
    const all = board.root.querySelectorAll('input[data-tick]')
    expect(all.length).toBeGreaterThan(20)
    expect(all.filter(b => b.disabled).map(b => b.dataset.tick)).toEqual([])
    expect(board.root.querySelector('[data-tabprog="mon"]')!.textContent).toBe('1 of 7')
    expect(board.root.querySelector('[data-tabprog="wed"]')!.textContent).toBe('0 of 7')
    expect(board.root.querySelector('[data-tabprog="fri"]')!.textContent).toBe('not picked')
  })

  it('a tick writes ticks/<day>-<step> with exactly done, at, day, piece_id, step, channel and label', async () => {
    const store: Store = { saved: saved(), writes: [], fail: false }
    const board = mountBoard(page, store)
    await board.settle()
    await board.change(board.boxes('wed-substack')[0]!, true)
    expect(store.writes.map(w => w.path)).toEqual(['ticks/wed-substack'])
    const body = store.writes[0]!.body
    expect(Object.keys(body).sort()).toEqual(['at', 'channel', 'day', 'done', 'label', 'piece_id', 'step'])
    expect(body).toMatchObject({ done: true, day: 'wed', piece_id: WED, step: 'substack', channel: 'substack', label: 'Substack: video post with the article' })
    expect(PUBLISHED.steps.find(s => s.key === 'substack')!.label).toBe(body.label)
    expect(board.boxes('wed-substack').every(b => b.checked)).toBe(true)
    await board.change(board.boxes('mon-record-long')[0]!, true)
    expect(store.writes[1]!.body).toMatchObject({ day: 'mon', piece_id: MON, step: 'record-long', channel: null })
  })

  it('a write the store refuses is undone on the page and said', async () => {
    const store: Store = { saved: saved(), writes: [], fail: true }
    const board = mountBoard(page, store)
    await board.settle()
    const box = board.boxes('mon-tiktok')[0]!
    await board.change(box, true)
    expect(store.writes).toEqual([])
    expect(box.checked).toBe(false)
    expect(box.closest('label.tick')!.querySelector('.t-err')!.textContent).toBe('Not saved, tap again')
  })

  it('the links pasted on a made tab are saved once, as links/<day>', async () => {
    const store: Store = { saved: saved(), writes: [], fail: false }
    const board = mountBoard(page, store)
    await board.settle()
    const article = board.root.querySelector('#mon-link-article')!
    expect(article).not.toBeNull()
    article.value = 'https://makeyourmindup.substack.com/p/who-gets-paid'
    for (const fn of article.listeners.input || []) fn({ target: article })
    for (const fn of article.listeners.input || []) fn({ target: article })
    await board.flush()
    expect(store.writes.map(w => w.path)).toEqual(['links/mon'])
    expect(Object.keys(store.writes[0]!.body).sort()).toEqual(['article', 'at', 'youtube'])
    expect(store.writes[0]!.body.article).toBe('https://makeyourmindup.substack.com/p/who-gets-paid')
  })

  it('with no store, no tick can be made and the page says so', async () => {
    const board = mountBoard(page, null)
    await board.settle()
    expect(board.root.querySelectorAll('input[data-tick]').every(b => b.disabled)).toBe(true)
    expect(board.root.querySelector('[data-note="mon"]')!.textContent).toBe('Ticks are not saving in this view. Open it in claude.ai.')
  })
})
