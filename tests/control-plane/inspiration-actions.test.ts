import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { brief, cardWords, jobPatch, parseJobReport } from '../../apps/control-plane/api/inspiration/_actions.js'
import { rankCandidates, tickRoles, type StyleTick } from '../../apps/control-plane/api/inspiration/_cards.js'
import { MAX_INSPIRED, MAX_OPTIONS, parseOptions } from '../../apps/control-plane/api/_weekOptions.js'

// His ticks on Inspiration cards (docs/PUBLISH_BOARDS.md, "His instruction"). Ruling (Krish, 2026-11-12): an
// inspiration card he ticks is an instruction that jumps the queue: Content means make it into a piece now, Production
// means use the style within a week. Every card, tick and piece here is invented.

const TICK = '11111111-1111-4111-8111-111111111111'
const PIECE = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'
const RUN = 'https://github.com/krishanraja/content-engine/actions/runs/123'
const NOW = '2026-11-12T15:00:00.000Z'
const open = { id: TICK, kind: 'make_piece', state: 'open', piece_id: null }

describe('the piece job reports on his tick, and never past drafted', () => {
  it('checks a report: its state, the idea when drafted, the reason in words when failed', () => {
    expect(parseJobReport({ id: TICK, job_state: 'running', run_url: RUN }).report).toEqual({ id: TICK, job_state: 'running', piece_id: null, error: null, run_url: RUN })
    expect(parseJobReport({ id: TICK, job_state: 'drafted' }).problems).toContain('a drafted job names the idea it wrote (piece_id)')
    expect(parseJobReport({ id: TICK, job_state: 'failed' }).problems).toContain('a failed job says why, in words (error)')
    expect(parseJobReport({ id: TICK, job_state: 'done', piece_id: PIECE }).problems[0]).toMatch(/job_state is one of/)
    expect(parseJobReport({ id: TICK, job_state: 'running', run_url: 'https://example.invalid/run' }).problems).toEqual(["run_url is this repository's Actions run"])
    expect(parseJobReport({ id: 'nope', job_state: 'running' }).report).toBeNull()
  })

  it('drafted names the idea and moves an open tick to drafted; failed keeps it open with the reason', () => {
    const drafted = jobPatch(open, parseJobReport({ id: TICK, job_state: 'drafted', piece_id: PIECE, run_url: RUN }).report!, NOW)
    expect(drafted).toEqual({ patch: { job_state: 'drafted', job_at: NOW, updated_at: NOW, job_run_url: RUN, job_error: null, piece_id: PIECE, state: 'drafted' } })
    const failed = jobPatch(open, parseJobReport({ id: TICK, job_state: 'failed', error: 'the writing run stopped' }).report!, NOW)
    expect(failed).toEqual({ patch: { job_state: 'failed', job_at: NOW, updated_at: NOW, job_error: 'the writing run stopped' } })
    expect('state' in (failed as { patch: Record<string, unknown> }).patch).toBe(false)
  })

  it('never writes on a style tick, a dropped or done tick, or a second idea; never drops, closes or places', () => {
    const r = parseJobReport({ id: TICK, job_state: 'drafted', piece_id: PIECE }).report!
    expect(jobPatch({ ...open, kind: 'copy_style' }, r, NOW)).toEqual({ refused: 'not_a_piece_tick' })
    expect(jobPatch({ ...open, state: 'dropped' }, r, NOW)).toEqual({ refused: 'tick_dropped' })
    expect(jobPatch({ ...open, state: 'done' }, r, NOW)).toEqual({ refused: 'tick_done' })
    expect(jobPatch({ ...open, state: 'drafted', piece_id: OTHER }, r, NOW)).toEqual({ refused: 'drafted_another_idea' })
    expect(jobPatch({ ...open, state: 'drafted', piece_id: PIECE }, parseJobReport({ id: TICK, job_state: 'running' }).report!, NOW)).toEqual({ refused: 'already_drafted' })
    // Drafted again with the same idea is the same answer, and moves nothing further.
    const again = jobPatch({ ...open, state: 'drafted', piece_id: PIECE }, r, NOW) as { patch: Record<string, unknown> }
    expect(again.patch.state).toBeUndefined()
    for (const p of [again.patch, (jobPatch(open, r, NOW) as { patch: Record<string, unknown> }).patch]) {
      expect(Object.keys(p)).not.toContain('scheduled_for')
      expect(['done', 'dropped', 'in_use']).not.toContain(p.state)
    }
  })
})

describe('the brief the job reads', () => {
  it('his words first, the card\'s own after, never a tapped guess; ready only with a card or a reading', () => {
    const card = { id: OTHER, name: 'an-invented-reel.mp4', lane: 'strategy', kind: 'video', drive_file_id: 'drive-1', why_here: 'found it on a flight',
      why_like: 'the opening line', why_like_source: 'picked', note_for_claude: 'watch to the end', facets: { link: { url: 'https://www.instagram.com/reel/x/' } } }
    expect(cardWords(card)).toEqual(['found it on a flight', 'watch to the end'])
    const b = brief({ id: TICK, kind: 'make_piece', state: 'open', due_at: NOW, words: 'make it about who pays' }, card, null, null)
    expect(b.his_words).toEqual(['make it about who pays', 'found it on a flight', 'watch to the end'])
    expect(b.card?.drive_url).toBe('https://drive.google.com/file/d/drive-1/view')
    expect(b.ready).toBe(true)
    const waiting = brief({ id: TICK, kind: 'make_piece', state: 'open', due_at: NOW, words: null }, null, { id: 'r', url: 'https://x.invalid', status: 'queued' }, null)
    expect(waiting.ready).toBe(false)
    const read = brief({ id: TICK, kind: 'make_piece', state: 'open', due_at: NOW, words: null }, null, { id: 'r', status: 'read' }, { read_md: 'y'.repeat(25000), source_url: 'https://x.invalid' })
    expect(read.ready).toBe(true)
    expect(read.reading?.read_md.length).toBe(20000)
    expect(read.reading?.cut).toBe(true)
  })
})

describe('a style he ticked comes first for the next cut (failure F26\'s path)', () => {
  const row = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: `${id}.mp4`, lane: 'production', kind: 'video', drive_created_at: '2026-11-01T00:00:00Z', ...extra })
  const teaching = row('44444444-4444-4444-8444-444444444444', { teaches: ['look'], teaches_source: 'krish', answered_at: NOW, route: 'study_style' })
  const ticked = row('55555555-5555-4555-8555-555555555555', { drive_created_at: '2026-10-01T00:00:00Z' })
  const ticks = new Map<string, StyleTick>([[ticked.id, { action_id: TICK, due_at: '2026-11-19T15:00:00Z', words: 'copy the caption build' }]])

  it('an open tick leads every role it serves, with its instruction; without one the order is as it was', () => {
    for (const role of ['look', 'motion', 'captions'] as const) {
      const out = rankCandidates([teaching, ticked], new Map(), { role, limit: 2 }, ticks)
      expect(out[0].id).toBe(ticked.id)
      expect(out[0].instruction).toEqual({ action_id: TICK, due_at: '2026-11-19T15:00:00Z', words: 'copy the caption build' })
      expect(out[0].why[0]).toMatch(/^Krish ticked it: use this style in a made asset by 2026-11-19/)
    }
    // A role it does not serve keeps the order it had.
    expect(rankCandidates([teaching, ticked], new Map(), { role: 'pacing', limit: 2 }, ticks)[0].id).toBe(teaching.id)
    expect(rankCandidates([teaching, ticked], new Map(), { role: 'look', limit: 2 })[0].id).toBe(teaching.id)
    expect(tickRoles(row('x', { teaches: ['hook'] }))).toEqual(['hook'])
  })
})

describe('an idea from his ticked card comes on top of a day\'s four', () => {
  const opt = (n: number, extra: Record<string, unknown> = {}) => ({ id: `${n}${n}${n}${n}${n}${n}${n}${n}-0000-4000-8000-00000000000${n}`, rank: n, pitch: 'p', why_now: 'w', ...extra })
  it('takes a fifth option only when it names his tick, and only one a day', () => {
    const four = [1, 2, 3, 4].map(n => opt(n))
    expect(parseOptions({ week_start: '2026-11-16', series: 's', options: [...four, opt(5)] }).problems).toContain(`at most ${MAX_OPTIONS} options a day, plus one from his ticked inspiration`)
    const ok = parseOptions({ week_start: '2026-11-16', series: 's', options: [...four, opt(5, { inspiration_action: TICK })] })
    expect(ok.problems).toEqual([])
    expect(ok.options[4].inspiration_action).toBe(TICK)
    const two = parseOptions({ week_start: '2026-11-16', series: 's', options: [...four.slice(0, 3), opt(4, { inspiration_action: TICK }), opt(5, { inspiration_action: OTHER })] })
    expect(two.problems).toContain(`at most ${MAX_INSPIRED} idea from his ticked inspiration a day`)
    expect(parseOptions({ week_start: '2026-11-16', series: 's', options: [opt(1, { inspiration_action: 'tick-1' })] }).problems[0]).toMatch(/inspiration_action must be/)
  })
})

describe('inspiration_act.py: the deterministic half of the run', () => {
  it('works out the week To approve reads, the open days, and appends the idea after the day\'s options', () => {
    const run = spawnSync('python3', ['-c', `
import sys, json, datetime as dt
sys.path.insert(0, 'scripts/post-pack')
import inspiration_act as a
print(a.planning_monday(dt.date(2026, 11, 12)), a.planning_monday(dt.date(2026, 11, 15)), a.planning_monday(dt.date(2026, 10, 30)))
series = [{'slug': 'follow_the_money', 'cadence': 'Mondays', 'options': [{}], 'scheduled': [{'id': 'x'}]},
          {'slug': 'under_the_hood', 'cadence': 'Wednesdays', 'options': [], 'scheduled': []},
          {'slug': 'mind_the_gap', 'cadence': 'Fridays', 'options': [], 'scheduled': []}]
picks = [{'id': 'wed', 'body': {'pick': 'wed-1'}}]
print([d['day'] for d in a.open_days(series, picks)])
plan = {'days': {'fri': [{'id': 'old-1'}, {'id': 'old-2'}]}}
idea = {'action_id': '${TICK}', 'week': '2026-11-16', 'day': 'fri', 'piece_id': '${PIECE}', 'pitch': 'p', 'why_now': 'w',
        'option': {'so_what': 's', 'story': 'Headline: h', 'why_now': 'w', 'source': {'label': 'l', 'url': 'https://x.invalid'}}}
print(a.check_idea(idea))
card = {'id': '${OTHER}', 'name': 'an-invented-reel.mp4'}
a.insert_option(plan, idea, card)
a.insert_option(plan, idea, card)
print([o['id'] for o in plan['days']['fri']])
print(json.dumps(plan['days']['fri'][2]['from_inspiration'], sort_keys=True), plan['days']['fri'][2]['covers'])
body = a.week_options_body(idea, {'slug': 'mind_the_gap', 'options': [{'id': 'o1', 'rank': 1, 'pitch': 'p1', 'why_now': 'w1', 'recommended': True}]}, card)
print([(o['id'], o['rank'], o.get('inspiration_action')) for o in body['options']])
off = dict(idea, day='sat')
a.insert_option(plan, off, card)
print(sorted(plan['offdays']), a.check_idea(dict(idea, day='sun'))[:1])
`], { cwd: join(__dirname, '..', '..'), encoding: 'utf8' })
    expect(run.stderr).toBe('')
    // Python prints CRLF on Windows: split on either line end, as the rest of the suite does.
    expect(run.stdout.trim().split(/\r?\n/)).toEqual([
      '2026-11-16 2026-11-23 2026-10-26',
      "['fri']",
      '[]',
      `['old-1', 'old-2', '${PIECE}']`,
      `{"action_id": "${TICK}", "card_id": "${OTHER}", "card_name": "an-invented-reel.mp4"} ['${OTHER}']`,
      `[('o1', 1, None), ('${PIECE}', 2, '${TICK}')]`,
      "['sat'] ['day is one of mon, tue, wed, thu, fri, sat']",
    ])
  })
})
