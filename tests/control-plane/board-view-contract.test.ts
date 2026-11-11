import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { buildView, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { JOBS, type JobName } from '../../apps/control-plane/api/board/_run'
import { VIEW_CONTRACT_VERSION, notModified, viewEtag } from '../../apps/control-plane/api/board/_viewContract'
import { LIVE_BOARD_URL, liveBoardUrl } from '../../apps/control-plane/api/board/_liveBoard'
import { SCHEMA_PATH, compare, judge, validate } from '../../scripts/check-view-contract'

// The Publish Board view's contract (Ruling, Krish, 2026-11-11: "make sure this is built such that when I make other
// updates to the publish board and content engine, they do not regress this work, they just elegantly upgrade the
// publish board in the content tab"). Control Centre's board reads GET /api/board/<Monday>/view; every view this
// engine builds must keep view.schema.json, and a removal or rename of anything in it fails here and in
// check:view-contract. The frozen fixture is what Control Centre pins (control-center tests/fixtures/board-view/).

type Body = Record<string, unknown>
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as Body
const FIXTURE = 'apps/control-plane/api/board/fixtures/view.json'
const WEEK = '2026-11-16'
const MON = '8287846b-6618-4a19-9fb8-23ad4eca2718', WED = 'db9f9f6a-1092-49be-8024-f335e060305a', FRI = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118'
const SIGNED = '# Narrative lock\n\nThe arc.\n\nSigned by Krish: "Yes, this is the story", 2026-11-08'
const piece = (id: string, date: string, slot: string, making: Body = {}, meta: Body = {}) =>
  ({ id, idea: `Piece ${id.slice(0, 4)}. It says one thing.`, scheduled_for: date, lane_slot: slot, state: 'drafting', buried_at: null, body: '', updated_at: '2026-11-09T12:00:00Z', meta: { making, ...meta } })
const option = (id: string, extra: Body = {}) => ({ id, format: 'Meme video, 9:16', copy: `Option ${id}`, ...extra })
const verdict = (day: string, id: string, side: Body) => ({ doc_id: `off-${day}-${id}`, updated_by: 'Krish', revision: 2, body: { use: 'offday', pick: `off-${day}-${id}`, day, ...side } })
const run = (job: JobName, state: 'queued' | 'running' | 'done' | 'failed') => ({ job, workflow: JOBS[job].workflow, state, started_at: '2026-11-09T17:00:00Z', updated_at: '2026-11-09T17:05:00Z', url: `https://github.com/krishanraja/content-engine/actions/runs/1`, event: 'repository_dispatch' })
const look = (id: string, name: string) => ({ id, name, pitch: `${name}, pitched.`, status: 'trial' })

/** One week with every part of the view in it: media, a run, a path at each step, a revised off-day option, reviews. */
function full(): ViewInputs {
  const cut = { cut: 'long', path: '3 Posts/mon/long.mp4', sha256: 'a'.repeat(64), at: '2026-11-16T08:00:00Z', seconds: 412, thumbnail: { path: '3 Posts/mon/long.jpg' } }
  return {
    week: WEEK, now: new Date('2026-11-16T09:00:00Z'),
    pieces: [
      piece(MON, '2026-11-16', 'follow_the_money', { video_assets: [cut], workroom: 'done', draft: 'done', scripts: 'done' },
        { materials: [{ id: 'm1', title: 'Storyboard: Monday', kind: 'paste', content: 'x', at: '2026-11-15T10:00:00Z' }], look: { production: 'face-with-proof', experiment: null, inspiration: [], at: '2026-11-15T10:00:00Z' } }),
      piece(WED, '2026-11-18', 'under_the_hood', {}, { materials: [{ id: 'm2', title: 'WIRED: a source', kind: 'paste', content: 'x', at: '2026-11-14T10:00:00Z' }] }),
      piece(FRI, '2026-11-20', 'mind_the_gap'),
    ],
    picks: [{ doc_id: 'mon-scripts', updated_by: 'Krish', body: { approved: true, piece_id: MON } }],
    queue: [verdict('tue', 'povteach', { idea: { verdict: 'improve', words: 'Change the caption', sha256: 'a'.repeat(64) } }),
      verdict('thu', 'lookalikes', { idea: { verdict: 'improve', words: 'x', sha256: 'b'.repeat(64) } })],
    history: [{ collection: 'picks', doc_id: 'mon', updated_at: '2026-11-15T10:00:00Z', updated_by: 'Krish' }],
    runs: { 'make-piece': run('make-piece', 'running'), 'offday-revise': run('offday-revise', 'done') },
    north_star: { current: 3, target: 8 },
    ideas: {
      days: { wed: [{ id: WED, so_what: 'Why it matters', story: 'The story', style: { production: 'face-with-proof', script: 'fry-explainer', experiment: { format: 'kinetic-movement', why: 'Because it moves.' } } }] },
      offdays: { tue: [option('povteach', { revised: { side: 'idea', words: 'his words' } })], thu: [option('lookalikes')], sat: [] },
    },
    locks: { mon: SIGNED, wed: SIGNED, fri: null },
    research_files: { wed: true },
    formats: { script: [look('fry-explainer', 'The Hannah Fry explainer')], production: [look('face-with-proof', 'Face-led'), look('kinetic-movement', 'Everything moves')] },
    inspiration: { cards: [{ id: 'c1', name: 'clip.mp4', words: 'I like how it is lit.', saved: '2026-11-01T00:00:00Z' }], unread: 3 },
  }
}

const states = (): ViewInputs[] => {
  const f = full()
  return [
    f,
    { ...f, pieces: [], ideas: null, runs: {}, north_star: null },
    { ...f, runs: { 'make-piece': run('make-piece', 'failed'), 'saturday-goodnews': run('saturday-goodnews', 'queued') } },
    { ...f, ideas: { offdays: { tue: [option('povteach')], thu: [], sat: [option('goodnews')] } }, queue: [] },
    { ...f, queue: [verdict('tue', 'povteach', { idea: { verdict: 'approve', words: null, sha256: 'a'.repeat(64) } })] },
  ]
}
const served = (i: ViewInputs) => JSON.parse(JSON.stringify({ ok: true, ...buildView(i) })) as Body

/** Long prompts shortened, so the pinned copy stays small; shape and kinds untouched. */
function shorten(v: unknown): unknown {
  if (typeof v === 'string') return v.length > 240 ? `${v.slice(0, 240)}…` : v
  if (Array.isArray(v)) return v.map(shorten)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shorten(x)]))
  return v
}

describe('the Publish Board view contract', () => {
  it('carries the schema version on every view', () => {
    expect(SCHEMA['x-contract-version']).toBe(VIEW_CONTRACT_VERSION)
    for (const s of states()) expect(buildView(s).contract_version).toBe(VIEW_CONTRACT_VERSION)
  })

  it('keeps the schema in every state the week can be in', () => {
    for (const s of states()) expect(validate(SCHEMA, served(s))).toEqual([])
    const v = served(full()) as { days: Array<Body> }
    // The full week really carries the optional parts, so the schema has been held against them.
    expect(v.days.some(d => Array.isArray(d.media) && d.media.length === 2)).toBe(true)
    expect(v.days.some(d => d.run)).toBe(true)
    expect(v.days.some(d => Array.isArray(d.reviews) && d.reviews.length)).toBe(true)
    expect(v.days.some(d => d.path)).toBe(true)
  })

  it('fails a view that drops or renames anything the schema promises', () => {
    const v = served(full())
    const day = (v.days as Body[])[0]!
    const cases: Array<[string, (x: Body) => void]> = [
      ['week', x => { delete x.week }],
      ['days', x => { (x.days as unknown[]).pop() }],
      ['day.who', x => { delete ((x.days as Body[])[0]!).who }],
      ['day.next renamed', x => { const d = (x.days as Body[])[0]!; d.next_step = d.next; delete d.next }],
      ['day.actions', x => { delete ((x.days as Body[])[2]!).actions }],
      ['action.label', x => { delete (((x.days as Body[])[2]!.actions as Body[])[0]!).label }],
      ['run action job', x => { const a = ((x.days as Body[]).flatMap(d => d.actions as Body[])).find(a => a.kind === 'run')!; delete a.job }],
      ['media.id', x => { delete (((x.days as Body[])[0]!.media as Body[])[0]!).id }],
      ['path.steps', x => { delete ((x.days as Body[])[0]!.path as Body).steps }],
      ['yours.next', x => { delete ((x.yours as Body[])[0]!).next }],
      ['moved.text', x => { delete ((x.moved as Body[])[0]!).text }],
      ['contract_version', x => { delete x.contract_version }],
    ]
    expect(day.day).toBe('mon')
    for (const [name, mutate] of cases) {
      const copy = JSON.parse(JSON.stringify(v)) as Body
      mutate(copy)
      expect(validate(SCHEMA, copy), name).not.toEqual([])
    }
  })

  it('accepts a view with fields and kinds it has never seen: additions never break it', () => {
    const v = served(full()) as Body & { days: Body[] }
    v.extra_week_note = 'new'
    v.days[0]!.checklist = [{ title: 'Captions', text: 'Burned in' }]
    ;(v.days[0]!.actions as Body[]).push({ kind: 'teleprompter', label: 'Send to Teleprompter' })
    ;(v.days[0]!.media as Body[]).push({ id: 'c'.repeat(64), kind: 'mock', cut: 'look', title: 'Look mock', at: null })
    expect(validate(SCHEMA, v, SCHEMA, '$', { open: true })).toEqual([])
    // The engine's own views are held to the declared kinds: a new kind is added to the schema with a minor bump.
    expect(validate(SCHEMA, v).join()).toMatch(/teleprompter/)
  })

  it('pins a frozen fixture that keeps the schema (UPDATE_VIEW_FIXTURE=1 writes it again)', () => {
    if (process.env.UPDATE_VIEW_FIXTURE === '1' || !existsSync(FIXTURE)) writeFileSync(FIXTURE, `${JSON.stringify(shorten(served(full())), null, 1)}\n`)
    const frozen = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Body
    expect(validate(SCHEMA, frozen)).toEqual([])
    expect(frozen.contract_version).toBe(VIEW_CONTRACT_VERSION)
    // The fixture is the same shape as a fresh build: every key the build sends is in it.
    const keys = (o: unknown, at = ''): string[] => (o && typeof o === 'object' && !Array.isArray(o)
      ? Object.entries(o).flatMap(([k, x]) => [`${at}.${k}`, ...keys(x, `${at}.${k}`)]) : Array.isArray(o) && o.length ? keys(o[0], `${at}[]`) : [])
    expect(new Set(keys(frozen))).toEqual(new Set(keys(shorten(served(full())))))
  })

  it('judges a schema change: an addition passes with a bump, a removal needs a major', () => {
    const base = JSON.parse(JSON.stringify(SCHEMA)) as Body
    const next = (f: (s: Body & Record<string, any>) => void, v?: string) => {
      const s = JSON.parse(JSON.stringify(SCHEMA)) as Body & Record<string, any>
      f(s)
      if (v) s['x-contract-version'] = v
      return s
    }
    const added = next(s => { s.$defs.day.properties.checklist = { type: 'array' } }, '1.1.0')
    expect(compare(base, added).breaking).toEqual([])
    expect(judge(base, added).ok).toBe(true)
    expect(judge(base, next(s => { s.$defs.day.properties.checklist = { type: 'array' } })).ok).toBe(false)
    const removed = next(s => { delete s.$defs.day.properties.next; s.$defs.day.required = s.$defs.day.required.filter((k: string) => k !== 'next') }, '1.1.0')
    expect(compare(base, removed).breaking.join()).toMatch(/next: removed or renamed/)
    expect(judge(base, removed).ok).toBe(false)
    expect(judge(base, next(s => { delete s.$defs.day.properties.next }, '2.0.0')).ok).toBe(true)
    expect(compare(base, next(s => { s.$defs.day.properties.title.type = ['string', 'null'] })).breaking.join()).toMatch(/title: may now be null/)
    expect(compare(base, next(s => { s.$defs.action.properties.kind.enum.push('teleprompter') })).breaking).toEqual([])
    expect(compare(base, next(s => { s.$defs.dayKey.enum.push('sun') })).breaking.join()).toMatch(/sun/)
    expect(compare(base, next(s => { s.$defs.day.required = s.$defs.day.required.filter((k: string) => k !== 'media') })).breaking.join()).toMatch(/media: no longer always sent/)
    expect(compare(base, next(s => { s.$defs.action.allOf[0].then.required = ['job'] })).breaking.join()).toMatch(/input: no longer always sent/)
  })

  it('tags a view by what it says, so a read that finds nothing new is a 304', () => {
    const a = served(full()), b = { ...served(full()), as_of: '2030-01-01T00:00:00Z' }
    expect(viewEtag(a)).toBe(viewEtag(b))
    const c = served({ ...full(), north_star: { current: 4, target: 8 } })
    expect(viewEtag(c)).not.toBe(viewEtag(a))
    expect(notModified(viewEtag(a), viewEtag(b))).toBe(true)
    expect(notModified(`W/${viewEtag(a)}, "x"`, viewEtag(a))).toBe(true)
    expect(notModified(undefined, viewEtag(a))).toBe(false)
  })

  it('names one live board, the same in config/boards.json, and every link carries the week and the day', () => {
    const boards = JSON.parse(readFileSync('config/boards.json', 'utf8')) as { live_board: { url: string } }
    expect(boards.live_board.url).toBe(LIVE_BOARD_URL)
    expect(liveBoardUrl('2026-11-16', 'wed')).toBe(`${LIVE_BOARD_URL}?week=2026-11-16&day=wed`)
    expect(liveBoardUrl('2026-11-16', 'Monday')).toBe(`${LIVE_BOARD_URL}?week=2026-11-16&day=mon`)
    expect(liveBoardUrl('2026-11-16')).toBe(`${LIVE_BOARD_URL}?week=2026-11-16`)
    expect(liveBoardUrl()).toBe(LIVE_BOARD_URL)
    const prompts = buildView(full()).days.flatMap(d => d.actions).filter(a => a.kind === 'prompt').map(a => (a as { prompt: string }).prompt)
    for (const p of prompts.filter(p => p.includes('content.krishraja.com/board/'))) expect(p).toContain(LIVE_BOARD_URL)
  })
})
