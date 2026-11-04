import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash, webcrypto } from 'node:crypto'
import vm from 'node:vm'

// The board page's live overlay (web.js drawLive; Ruling, Krish, 2026-11-03: "The Publish Board should just be
// makeyourmindup weekly content calendar, always up to date"). The page script runs here against a small stand-in for
// the browser's document, built with the hooks week_board.py emits, and one answer from op=state.

const WEB_JS = readFileSync(new URL('../../scripts/post-pack/week_board/web.js', import.meta.url), 'utf8')
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')
const MON = '11111111-1111-4111-8111-111111111111', WED = '22222222-2222-4222-8222-222222222222'

// ---------------------------------------------------------------- a stand-in document, enough for the board script
const kebab = (k: string) => k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
class El {
  attrs = new Map<string, string>(); kids: El[] = []; parent: El | null = null; text = ''; html = ''
  dataset: Record<string, string>
  classList = { toggle: (c: string, on?: boolean) => { const s = new Set(this.className.split(' ').filter(Boolean)); (on ?? !s.has(c)) ? s.add(c) : s.delete(c); this.className = [...s].join(' ') }, contains: (c: string) => this.className.split(' ').includes(c) }
  constructor(public tagName: string, attrs: Record<string, string> = {}, kids: El[] = [], text = '') {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v)
    for (const k of kids) this.append(k)
    this.text = text
    this.dataset = new Proxy({}, {
      get: (_, k: string) => this.attrs.get('data-' + kebab(k)),
      set: (_, k: string, v) => { this.attrs.set('data-' + kebab(k), String(v)); return true },
      deleteProperty: (_, k: string) => { this.attrs.delete('data-' + kebab(k)); return true },
    }) as Record<string, string>
  }
  get className() { return this.attrs.get('class') || '' } set className(v) { this.attrs.set('class', v) }
  get id() { return this.attrs.get('id') || '' }
  get hidden() { return this.attrs.has('hidden') } set hidden(v) { if (v) this.attrs.set('hidden', ''); else this.attrs.delete('hidden') }
  get disabled() { return this.attrs.has('disabled') } set disabled(v) { if (v) this.attrs.set('disabled', ''); else this.attrs.delete('disabled') }
  get textContent(): string { return this.text + this.kids.map(k => k.textContent).join('') }
  set textContent(v) { this.kids = []; this.text = String(v) }
  get innerHTML() { return this.html || this.textContent } set innerHTML(v) { this.kids = []; this.text = ''; this.html = v }
  value = ''
  setAttribute(k: string, v: string) { this.attrs.set(k, v) } getAttribute(k: string) { return this.attrs.get(k) ?? null }
  append(...els: El[]) { for (const e of els) { e.parent = this; this.kids.push(e) } }
  prepend(e: El) { e.parent = this; this.kids.unshift(e) }
  before(e: El) { const p = this.parent!; e.parent = p; p.kids.splice(p.kids.indexOf(this), 0, e) }
  replaceChildren() { this.kids = [] }
  addEventListener() {}
  all(): El[] { return this.kids.flatMap(k => [k, ...k.all()]) }
  matches(sel: string) {
    const m = sel.match(/^([a-z]+)?((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/)
    if (!m) throw new Error('selector the stand-in cannot read: ' + sel)
    if (m[1] && m[1] !== this.tagName) return false
    for (const c of (m[2] || '').split('.').filter(Boolean)) if (!this.classList.contains(c)) return false
    for (const [, k, v] of (m[3] || '').matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
      if (!this.attrs.has(k) || (v !== undefined && this.attrs.get(k) !== v)) return false
    }
    return true
  }
  querySelectorAll(sel: string) { return this.all().filter(e => sel.split(',').some(s => e.matches(s.trim()))) }
  querySelector(sel: string) { return this.querySelectorAll(sel)[0] || null }
  closest(sel: string) { let e: El | null = this; while (e && !e.matches(sel)) e = e.parent; return e }
}
const h = (tag: string, attrs: Record<string, string> = {}, ...kids: Array<El | string>) =>
  new El(tag, attrs, kids.filter((k): k is El => typeof k !== 'string'), kids.filter(k => typeof k === 'string').join(''))
const chip = (k: string, note: string) => h('button', { class: 'st', 'data-live-step': k }, h('span', { class: 'st-note' }, note))

function page(longText: string, shortText: string) {
  const long = h('textarea', { 'data-review-id': 'mon-long' }), short = h('textarea', { 'data-review-id': 'mon-short' })
  long.value = longText; short.value = shortText
  const approve = h('div', { class: 'rec ap', 'data-approve-day': 'mon', 'data-cuts': 'long short', 'data-box-long': 'mon-long', 'data-box-short': 'mon-short',
    'data-live-sha-long': sha(longText), 'data-live-sha-short': sha(shortText) },
  h('button', { 'data-act': 'approve-scripts', 'data-day': 'mon' }, 'Approve scripts'))
  const mon = h('div', { class: 'pm fixed', 'data-day': 'mon', 'data-live-day': 'mon', 'data-live-piece': MON, 'data-live-cuts': 'long', 'data-live-thumbs': '' },
    h('div', { class: 'steps' }, chip('brief', 'agreed'), chip('drafts', 'in review'), chip('record', ''), chip('publish', '9 steps')), long, short, approve)
  const wed = h('div', { class: 'pm fixed', 'data-day': 'wed', 'data-live-day': 'wed', 'data-live-piece': '', 'data-live-cuts': '', 'data-live-thumbs': '' },
    h('div', { class: 'steps' }, chip('brief', 'not picked')))
  const bar = h('div', { id: 'stale-bar', hidden: '' }); bar.innerHTML = 'A newer version of this board is live. <a href="">Reload</a>'
  const body = h('body', {}, h('div', { class: 'wk-top' }), bar, h('main', { id: 'week' }, mon, wed))
  return { body, mon, wed, approve, bar, short }
}

async function run(dom: ReturnType<typeof page>, state: unknown) {
  const head = h('head')
  const document = {
    head, body: dom.body, hidden: false,
    createElement: (tag: string) => h(tag),
    querySelector: (s: string) => dom.body.querySelector(s), querySelectorAll: (s: string) => dom.body.querySelectorAll(s),
    getElementById: (id: string) => dom.body.all().find(e => e.id === id) || null,
    addEventListener() {},
  }
  const fetch = async (url: string) => ({ ok: true, status: 200, json: async () => (url.endsWith('/state') ? state : { ok: true, weeks: [] }) })
  const ctx = vm.createContext({ document, window: { addEventListener() {}, confirm: () => false }, fetch, setInterval() {}, crypto: webcrypto,
    TextEncoder, URL, console })
  vm.runInContext(WEB_JS.replace('__WEB_WEEK__', '"2026-11-02"'), ctx)
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0))
}

const steps = [
  { key: 'workroom', state: 'done' }, { key: 'draft', state: 'done' }, { key: 'visual_gate', state: 'done' }, { key: 'scripts', state: 'done', note: 'long and short' },
  { key: 'pack', state: 'done' }, { key: 'record', state: 'now', note: 'short cut still to record' }, { key: 'video', state: 'now', note: 'short cut still to produce' },
  { key: 'publish', state: 'now', note: '1 of 5 channels' },
]
const LONG = 'The long script.\n', SHORT = 'The short script.\n'
const state = (over: Record<string, unknown> = {}, live: Record<string, unknown> = {}) => ({
  ok: true, week: '2026-11-02', build_id: 'c'.repeat(64), yes: {}, posted: {}, rebuild_needed: false, ...over,
  live: { mon: { piece_id: MON, date: '2026-11-02', steps, verdict: null, teleprompter: { long: 'in', short: 'in' }, cuts: [{ cut: 'long', thumbnail: false }],
    posted: ['youtube'], script_hashes: { long: sha(LONG), short: sha(SHORT) }, written_at: null }, ...live },
})
const note = (panel: El, k: string) => panel.querySelector(`[data-live-step="${k}"]`)!.querySelector('.st-note')!.textContent

describe('the board page\'s live overlay', () => {
  it('redraws each day\'s step notes from the record and leaves what it has no word for as built', async () => {
    const dom = page(LONG, SHORT)
    await run(dom, state())
    expect(note(dom.mon, 'brief')).toBe('agreed')
    expect(note(dom.mon, 'drafts')).toBe('signed off')
    expect(dom.mon.querySelector('[data-live-step="drafts"]')!.dataset.liveState).toBe('done')
    expect(note(dom.mon, 'record')).toBe('short cut still to record')
    expect(note(dom.mon, 'publish')).toBe('1 of 5 channels; posted: youtube')
    expect(dom.approve.dataset.liveStale).toBe('')
    expect(dom.bar.hidden).toBe(true)
  })
  it('says a failed step is blocked', async () => {
    const dom = page(LONG, SHORT)
    await run(dom, state({}, { mon: { ...state().live.mon, steps: steps.map(s => s.key === 'draft' ? { key: 'draft', state: 'failed', note: 'the fact gate did not pass' } : s) } }))
    expect(note(dom.mon, 'drafts')).toBe('blocked: the fact gate did not pass')
    expect(dom.mon.querySelector('[data-live-step="drafts"]')!.dataset.liveState).toBe('failed')
  })
  it('holds Approve scripts when the record holds words this page was not built with, and says what a rebuild adds', async () => {
    const dom = page(LONG, SHORT)
    const changed = { ...state().live.mon, script_hashes: { long: sha(LONG), short: sha('Words a session wrote later.\n') },
      cuts: [{ cut: 'long', thumbnail: true }, { cut: 'short', thumbnail: false }] }
    await run(dom, state({ rebuild_needed: true }, { mon: changed, wed: { ...state().live.mon, piece_id: WED, cuts: [], script_hashes: {} } }))
    expect(dom.approve.dataset.liveStale).toBe('1')
    expect(dom.approve.querySelector('[data-act="approve-scripts"]')!.disabled).toBe(true)
    expect(dom.approve.querySelector('[data-live-note]')!.textContent).toBe('The words changed since this page was built: this tab needs a rebuild')
    expect(dom.bar.hidden).toBe(false)
    const said = dom.bar.textContent
    expect(said).toContain("Monday's long cut thumbnail is on the record; rebuild to show it")
    expect(said).toContain("Monday's short cut is on the record; rebuild to show it")
    expect(said).toContain("Monday's short script changed on the record; rebuild to show it")
    expect(said).toContain("Wednesday's piece is on the record; rebuild to show it")
    // The words he sees are never replaced.
    expect(dom.short.value).toBe(SHORT)
  })
  it('does not hold the press when the record holds the words now in the box (his saved edit, checked again)', async () => {
    const edited = 'The short script,\r\nas he edited it.   \n\n'
    const dom = page(LONG, SHORT); dom.short.value = edited
    await run(dom, state({}, { mon: { ...state().live.mon, script_hashes: { long: sha(LONG), short: sha('The short script,\nas he edited it.\n') } } }))
    expect(dom.approve.dataset.liveStale).toBe('')
    expect(dom.bar.hidden).toBe(true)
  })
  it('stays quiet when only the record\'s time changed: the overlay already shows what changed (a step, Growth\'s post)', async () => {
    let dom = page(LONG, SHORT)
    await run(dom, state({ rebuild_needed: true }))
    expect(dom.bar.hidden).toBe(true)
    dom = page(LONG, SHORT)
    await run(dom, state({ build_id: null }))
    expect(dom.bar.hidden).toBe(true)
  })
})

// The production gates on a day's tab (week_board.py gates_card): each section says what the making record holds.
const SB = 'a'.repeat(64), ST = 'b'.repeat(64), PR = 'c'.repeat(64), CU = 'd'.repeat(64)
function withGates(dom: ReturnType<typeof page>) {
  const press = (gate: string, extra: Record<string, string> = {}) => h('button', { 'data-act': 'gate', 'data-gate': gate, 'data-day': 'mon', ...extra })
  const section = (gate: string, sha: string, ...kids: El[]) => h('section', { class: 'gate', 'data-gate': gate, 'data-gate-sha': sha, 'data-live-gate': gate, 'data-live-gate-sha': sha },
    h('p', { class: 'gate-live', 'data-live-gate-note': '' }), ...kids)
  const fig = (m: string, name: string) => h('figure', { 'data-style-module': m, 'data-style-name': name }, press('style', { 'data-module': m }))
  const sections = {
    storyboard: section('storyboard', SB, press('storyboard')),
    style: section('style', ST, fig('orbit-on-split', 'Orbit on split'), fig('paper-cut', 'Paper cut'), h('textarea', { 'data-gate-words': 'mon-style' }), press('style', { 'data-module': '' })),
    proof: section('proof', PR, press('proof', { 'data-verdict': 'approve' }), press('proof', { 'data-verdict': 'reject' })),
    cut: section('cut', CU, press('cut')),
  }
  const rounds = h('p', { class: 'gate-live', 'data-live-rounds': '' })
  dom.mon.append(h('div', { class: 'rec gt', 'data-gates-day': 'mon' }, rounds, ...Object.values(sections)))
  return { ...sections, rounds }
}
const live = (sec: El) => sec.querySelector('[data-live-gate-note]')!.textContent
const waiting = { storyboard: { state: 'waiting', at: null }, style: { state: 'waiting', at: null }, proof: { state: 'waiting', at: null }, final: { state: 'waiting', at: null } }

describe('the production gates in the live overlay', () => {
  it('says each gate waits on him until the record holds his press', async () => {
    const dom = page(LONG, SHORT), g = withGates(dom)
    await run(dom, state({}, { mon: { ...state().live.mon, gates: waiting } }))
    for (const sec of Object.values(g).filter(s => s !== g.rounds)) {
      expect(live(sec)).toBe('Waiting on you')
      expect(sec.dataset.liveState).toBe('waiting')
      expect(sec.dataset.liveAnswered).toBe('')
    }
    expect(g.rounds.textContent).toBe('')
  })
  it('shows signed, the picked style by name, approved and rejected, and holds a press already answered at this hash', async () => {
    const dom = page(LONG, SHORT), g = withGates(dom)
    const at = '2026-11-08T10:00:05.000Z'
    await run(dom, state({}, { mon: { ...state().live.mon, rounds: 1, gates: {
      storyboard: { state: 'signed', at, sha256: SB }, style: { state: 'picked', at, sha256: ST, module: 'orbit-on-split' },
      proof: { state: 'rejected', at, sha256: PR }, final: { state: 'approved', at, sha256: CU } } } }))
    expect(live(g.storyboard)).toMatch(/^Signed /)
    expect(live(g.style)).toMatch(/^Picked Orbit on split /)
    expect(live(g.proof)).toMatch(/^Rejected /)
    expect(live(g.cut)).toMatch(/^Approved /)
    for (const sec of [g.storyboard, g.style, g.proof, g.cut]) {
      expect(sec.dataset.liveAnswered).toBe('1')
      for (const b of sec.querySelectorAll('[data-act="gate"]')) expect(b.disabled).toBe(true)
    }
    expect(g.style.querySelector('textarea')!.disabled).toBe(true)
    expect(g.rounds.textContent).toBe('Full renders sent to you before you approved: 1')
  })
  it('says what was shown changed since he pressed, and leaves the press open', async () => {
    const dom = page(LONG, SHORT), g = withGates(dom)
    await run(dom, state({}, { mon: { ...state().live.mon, gates: { ...waiting,
      storyboard: { state: 'signed', at: '2026-11-08T10:00:05.000Z', sha256: 'e'.repeat(64) },
      style: { state: 'none_of_these', at: '2026-11-08T10:00:05.000Z', sha256: ST } } } }))
    expect(live(g.storyboard)).toBe('This changed since you pressed; press again')
    expect(g.storyboard.dataset.liveState).toBe('changed')
    expect(g.storyboard.dataset.liveAnswered).toBe('')
    expect(g.storyboard.querySelector('[data-act="gate"]')!.disabled).toBe(false)
    expect(live(g.style)).toMatch(/^None of these /)
  })
  it('leaves a board without gates as it was', async () => {
    const dom = page(LONG, SHORT)
    await run(dom, state())
    expect(dom.body.querySelectorAll('[data-live-gate]')).toHaveLength(0)
    expect(dom.bar.hidden).toBe(true)
  })
})
