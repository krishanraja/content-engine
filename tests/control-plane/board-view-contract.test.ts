import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { approval, approvedAll } from './_approvals'
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
const motion = (id: string, fits: string, krish_verdict: string, point_types: string[], formats = ['long_video', 'short_video'], ve_route = ['headline']) =>
  ({ id, name: `The ${id} style`, how: `How ${id} moves.`, rules: [`${id} rule one`, `${id} rule two`], point_types, formats, fits, krish_verdict, ve_route })

/** One week with every part of the view in it: media, a run, a path at each step, a revised off-day option, reviews. */
function full(): ViewInputs {
  const cut = { cut: 'long', path: '3 Posts/mon/long.mp4', sha256: 'a'.repeat(64), at: '2026-11-16T08:00:00Z', seconds: 412, thumbnail: { path: '3 Posts/mon/long.jpg' } }
  const i: ViewInputs = {
    week: WEEK, now: new Date('2026-11-16T09:00:00Z'),
    pieces: [
      piece('5b726fc3-ac63-4607-9293-3257b4ecc75c', '2026-11-16', 'mind_the_gap'),
      piece(MON, '2026-11-16', 'follow_the_money', { video_assets: [cut], workroom: 'done', draft: 'done', scripts: 'done' },
        { materials: [{ id: 'm1', title: 'Storyboard: Monday', kind: 'paste', content: 'x', at: '2026-11-15T10:00:00Z' }], look: { production: 'face-with-proof', experiment: null, inspiration: [], at: '2026-11-15T10:00:00Z' },
          // 1.4.0: his motion pick and a "Not this" on a caption style.
          style: { motion: 'ladder', captions: null, rejected: { motion: [], captions: ['beast'] }, by: 'Krish', at: '2026-11-15T11:00:00Z' },
          // 1.6.0: his Not this on the long cut, with his words.
          cut_verdicts: [{ media_id: 'a'.repeat(64), cut: 'long', verdict: 'not_this', words: 'The open drags. Start on the number.', sha256: 'a'.repeat(64), path: '3 Posts/mon/long.mp4', by: 'Krish', at: '2026-11-16T08:40:00Z' }] }),
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
      offdays: { tue: [option('povteach', { revised: { side: 'idea', words: 'his words' } })], thu: [option('lookalikes')],
        sat: [option('goodnews', { weekly: 'good_news', stories_due: '2026-11-19', decided: 'Signed off (Krish, 15 Nov).', stories: [1, 2, 3, 4, 5].map(n => ({
          headline: `Story ${n}`, what: 'What happened.', why: 'Why it helps.', date: '2026-11-18', source: { label: 'The source', url: `https://example.org/${n}` }, media: { kind: 'photo', url: `https://example.org/${n}.jpg` } })) })] },
    },
    locks: { mon: SIGNED, wed: SIGNED, fri: null },
    research_files: { wed: true },
    formats: { script: [look('fry-explainer', 'The Hannah Fry explainer')], production: [look('face-with-proof', 'Face-led'), look('kinetic-movement', 'Everything moves')] },
    // 1.4.0: the bank's motion styles, and Friday's creative direction he signed.
    motion: [motion('ladder', 'often', 'liked', ['number', 'comparison']), motion('data-story', 'often', 'untested', ['number', 'sequence']),
      motion('shape-morph', 'sometimes', 'untested', ['transformation']), motion('full-visual', 'sometimes', 'untested', ['mechanism'], ['short_video']),
      motion('pixel-retro', 'rarely', 'not for us', ['mood']), motion('toy-3d', 'sometimes', 'untested', ['product'], ['long_video', 'short_video'], ['needs_device'])],
    specs: { fri: { schema_version: 2, piece_id: FRI, signed: { by: 'Krish', said: 'Yes, make it', on: '2026-11-15', script_sha256: 'c'.repeat(64) },
      style: { motion: { module: 'data-story', reason: 'one number per beat' }, points: ['number'] }, brand: { caption_theme: 'art-directed' } } },
    inspiration: { cards: [{ id: 'c1', name: 'clip.mp4', words: 'I like how it is lit.', saved: '2026-11-01T00:00:00Z' }], unread: 3 },
    // Two sessions on Monday's piece, two screen grabs and a corpus on it, and a picture on Tuesday with no piece yet (1.1.0).
    overlay: {
      sessions: [
        { session_id: 'board-kxqp', scope: MON, piece_id: MON, day: 'mon', surface: 'claude-code', label: null, by: 'Claude Code', step: 'board', doing: 'Drafting the 90-second script', last_kind: 'progress', state: 'working', started_at: '2026-11-16T08:10:00Z', last_at: '2026-11-16T08:50:00Z', lease_until: '2026-11-16T09:20:00Z', events: 4 },
        { session_id: 'look-tzrw', scope: MON, piece_id: MON, day: 'mon', surface: 'claude-ai', label: null, by: 'claude.ai', step: 'look', doing: 'Filed two frames for the look', last_kind: 'done', state: 'done', started_at: '2026-11-16T07:00:00Z', last_at: '2026-11-16T07:40:00Z', lease_until: '2026-11-16T07:40:00Z', events: 3 },
      ],
      materials: [
        { id: '11111111-2222-4333-8444-555555555555', scope: MON, piece_id: MON, week: WEEK, day: 'mon', key: 'sha:x', version: 1, kind: 'screenshot', role: 'inspiration', title: 'Screen grab one', bytes: 182000, content_type: 'image/png', storage: 'bucket', added_by: 'Krish', at: '2026-11-15T21:00:00Z' },
        { id: '22222222-3333-4444-8555-666666666666', scope: MON, piece_id: MON, week: WEEK, day: 'mon', key: 'sha:y', version: 1, kind: 'screenshot', role: 'inspiration', title: 'Screen grab two', bytes: 201000, content_type: 'image/png', storage: 'bucket', added_by: 'Krish', at: '2026-11-15T21:01:00Z' },
        { id: '33333333-4444-4555-8666-777777777777', scope: MON, piece_id: MON, week: WEEK, day: 'mon', key: 'corpus', version: 2, kind: 'corpus', role: 'research', title: 'Oracle research corpus', bytes: 48000, content_type: null, storage: 'text', added_by: 'Claude Code', at: '2026-11-15T20:00:00Z' },
        { id: '44444444-5555-4666-8777-888888888888', scope: `day:${WEEK}/tue`, piece_id: null, week: WEEK, day: 'tue', key: 'sha:z', version: 1, kind: 'image', role: 'inspiration', title: 'Tuesday reference', bytes: 90000, content_type: 'image/jpeg', storage: 'bucket', added_by: 'Krish', at: '2026-11-15T19:00:00Z' },
      ],
    },
    // 1.2.0: his comments, Growth's ticks and the week's change signal; a second piece on Monday; the weekly good news.
    comments: [{ doc_id: 'desk-mon-cut-1', updated_by: 'Krish', updated_at: '2026-11-16T08:30:00Z', body: { thread_id: 'desk-mon-cut-1', anchor: 'desk:mon:cut', text: 'Love the open.', at: '2026-11-16T08:30:00Z' } }],
    ticks: [{ tick_id: 'mon-shorts', updated_by: 'growth', body: { done: true, day: 'mon', step: 'shorts', label: 'YouTube Shorts', at: '2026-11-16T09:00:00Z', posts: [{ url: 'https://www.youtube.com/shorts/x' }] } }],
    revision: 7,
    approvals: [],
  }
  // The ideas gate (1.3.0): every piece and the weekly good news stand for ones he approved, so the frozen fixture has no
  // held line (Control Centre's pinned copy draws it as is); the states below hold some.
  return { ...i, approvals: [...approvedAll(WEEK, i.pieces), approval(WEEK, 'sat', 'goodnews', { doc: 'queue/off-sat-goodnews' })] }
}

const states = (): ViewInputs[] => {
  // The ideas gate: one state holds the second Monday piece and the good news (no approval), one cannot read the
  // approvals at all, so every piece is held.
  const f = full()
  return [
    f,
    { ...f, approvals: f.approvals!.filter(a => a.idea_id !== '5b726fc3-ac63-4607-9293-3257b4ecc75c' && a.idea_id !== 'goodnews') },
    { ...f, pieces: [], ideas: null, runs: {}, north_star: null },
    { ...f, runs: { 'make-piece': run('make-piece', 'failed'), 'saturday-goodnews': run('saturday-goodnews', 'queued') } },
    { ...f, ideas: { offdays: { tue: [option('povteach')], thu: [], sat: [option('goodnews')] } }, queue: [] },
    { ...f, queue: [verdict('tue', 'povteach', { idea: { verdict: 'approve', words: null, sha256: 'a'.repeat(64) } })],
      approvals: [...f.approvals!, approval(WEEK, 'tue', 'povteach', { doc: 'queue/off-tue-povteach' })] },
    { ...f, approvals: null },
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
    // 1.6.0: every cut carries his Yes and Not this and his latest answer; a thumbnail carries neither.
    const media = v.days.flatMap(d => d.media as Body[])
    for (const m of media) {
      if (m.kind === 'cut') expect([m.presses?.yes?.op, m.presses?.not_this?.op, m.presses?.not_this?.words?.required]).toEqual(['cut-verdict', 'cut-verdict', true])
      else expect([m.presses, m.verdict]).toEqual([undefined, undefined])
    }
    expect(media.find(m => m.kind === 'cut')?.verdict).toEqual({ said: 'not_this', words: 'The open drags. Start on the number.', at: '2026-11-16T08:40:00Z' })
    expect(v.days.some(d => d.run)).toBe(true)
    expect(v.days.some(d => Array.isArray(d.reviews) && d.reviews.length)).toBe(true)
    expect(v.days.some(d => d.path)).toBe(true)
    // 1.4.0: every path carries its style choices, each option with its press.
    const styled = v.days.map(d => (d.path as Body | undefined)?.style as Body | undefined).filter(Boolean) as Body[]
    expect(styled.length).toBe(3)
    for (const st of styled) for (const layer of ['motion', 'captions', 'treatment']) expect(((st[layer] as Body).options as Body[]).length).toBeGreaterThan(0)
    // 1.3.0: every approved piece says so, and a state with held lines keeps the schema too.
    expect(v.days.flatMap(d => d.pieces as Body[]).every(p => p.approval && /^Approved by you, /.test(p.approval.label))).toBe(true)
    expect(states().some(st => (served(st).days as Body[]).some(d => (d.held as unknown[]).length > 0))).toBe(true)
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
    // The next minor and the next major of whatever version the schema is on now.
    const [ma, mi] = String(SCHEMA['x-contract-version']).split('.').map(Number)
    const minor = `${ma}.${mi + 1}.0`, major = `${ma + 1}.0.0`
    const added = next(s => { s.$defs.day.properties.checklist = { type: 'array' } }, minor)
    expect(compare(base, added).breaking).toEqual([])
    expect(judge(base, added).ok).toBe(true)
    expect(judge(base, next(s => { s.$defs.day.properties.checklist = { type: 'array' } })).ok).toBe(false)
    const removed = next(s => { delete s.$defs.day.properties.next; s.$defs.day.required = s.$defs.day.required.filter((k: string) => k !== 'next') }, minor)
    expect(compare(base, removed).breaking.join()).toMatch(/next: removed or renamed/)
    expect(judge(base, removed).ok).toBe(false)
    expect(judge(base, next(s => { delete s.$defs.day.properties.next }, major)).ok).toBe(true)
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
    const live = LIVE_BOARD_URL.replace(/^https:\/\//, '')
    const linked = prompts.filter(p => p.includes('content.krishraja.com/board/'))
    expect(linked.length).toBeGreaterThan(0)
    for (const p of linked) expect(p).toMatch(new RegExp(`${live.replace(/[.?#/]/g, m => `\\${m}`)}\\?week=${WEEK}&day=(mon|tue|wed|thu|fri|sat)`))
  })
})
