import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nextPair, parseMark, parseTriage, present, queueMeta } from '../../apps/control-plane/api/_ideaQueue'

// The one idea queue (Krish, 2026-10-19). "It needs to survive everything": every sweep that can delete, bury or
// expire a content_ideas row must name the queue's guard, and a verdict is only ever his own.
const api = (p: string) => readFileSync(`apps/control-plane/api/${p}`, 'utf8')

describe('the queue survives every sweep', () => {
  it('the Monday purge names queued_at and protected_at on its delete', () => {
    const src = api('purge/run.ts')
    expect(src).toMatch(/\.is\('queued_at', null\)/)
    expect(src).toMatch(/\.is\('protected_at', null\)/)
  })
  it('the triage sweep and the grader spare protected_at, which a queued row carries', () => {
    expect(api('triage/sweep.ts')).toMatch(/\.is\('protected_at', null\)/)
    expect(api('_grader.ts')).toMatch(/\.is\('protected_at', null\)/)
  })
  it('both stale-archive functions spare protected_at', () => {
    for (const f of ['20261011180000_stale_archive_spares_the_week.sql', '20261023090000_one_closer.sql']) {
      expect(readFileSync(`supabase/migrations/${f}`, 'utf8')).toMatch(/protected_at IS NULL/)
    }
  })
  it('the route sets protected_at with queued_at, and a drop clears both', () => {
    const src = api('idea-queue.ts')
    expect(src).toMatch(/queued_at: now, protected_at: now/)
    expect(src).toMatch(/queued_at: null, protected_at: null, state: 'dropped'/)
  })
})

describe('his triage', () => {
  it('records a verdict only with decided_by Krish', () => {
    expect(parseTriage({ verdict: 'story' }).triage).toBeNull()
    expect(parseTriage({ verdict: 'story', decided_by: 'Claude' }).triage).toBeNull()
    expect(parseTriage({ verdict: 'story', decided_by: 'Krish' }).triage?.verdict).toBe('story')
  })
  it('curious needs his reason and angle needs the angle', () => {
    expect(parseTriage({ verdict: 'curious', decided_by: 'Krish' }).triage).toBeNull()
    expect(parseTriage({ verdict: 'curious', decided_by: 'Krish', reason: "it's safer" }).triage?.reason).toBe("it's safer")
    expect(parseTriage({ verdict: 'angle', decided_by: 'Krish' }).triage).toBeNull()
  })
  it('refuses a verdict outside the four plus drop', () => {
    expect(parseTriage({ verdict: 'maybe', decided_by: 'Krish' }).triage).toBeNull()
  })
})

describe('a mark', () => {
  it('needs the plain-English so_what when it has no row', () => {
    expect(parseMark({ idea: 'A story' }).mark).toBeNull()
    expect(parseMark({ idea: 'A story', so_what: 'Your bill doubles.' }).mark?.so_what).toBe('Your bill doubles.')
  })
  it('accepts an existing row by id alone and refuses a bad id', () => {
    expect(parseMark({ id: '5b5bfadc-a60c-4d0a-be8e-b2e9bf43d092' }).mark?.id).toBeTruthy()
    expect(parseMark({ id: 'nope', so_what: 'x', idea: 'y' }).mark).toBeNull()
  })
  it('keeps a clarifying question beside the idea and never counts it as a decision', () => {
    const m = parseMark({ idea: 'A', so_what: 'B', question: 'Run it before or after the hearing?' }).mark!
    const meta = queueMeta(m, undefined, '2026-10-19T00:00:00Z', 'Claude Code')
    expect(meta.questions).toEqual([{ text: 'Run it before or after the hearing?', at: '2026-10-19T00:00:00Z', by: 'Claude Code' }])
    expect(queueMeta(parseMark({ idea: 'A', so_what: 'B' }).mark!, meta, '2026-10-20T00:00:00Z', 'x').questions).toHaveLength(1)
    const row = present({ id: 'a', idea: 'a', queued_at: '1', meta: { queue: meta } })
    expect(row.questions).toHaveLength(1)
    expect(row.needs_triage).toBe(true)
  })
  it('keeps what was first queued when marked again', () => {
    const mark = parseMark({ idea: 'A', so_what: 'B' }).mark!
    const first = queueMeta(mark, undefined, '2026-10-19T00:00:00Z', 'a')
    expect(queueMeta(mark, first, '2026-10-20T00:00:00Z', 'b').queued_at).toBe('2026-10-19T00:00:00Z')
  })
})

describe('the A/B pair', () => {
  const row = (id: string, at: string, triage?: unknown) => present({ id, idea: id, queued_at: at, meta: { queue: triage ? { triage } : {} } })
  it('takes the two longest-waiting untriaged ideas', () => {
    const pair = nextPair([row('c', '3'), row('a', '1'), row('b', '2', { verdict: 'story' }), row('d', '4')])!
    expect(pair.map(p => p.id)).toEqual(['a', 'c'])
  })
  it('never offers a pair he has already compared', () => {
    const a = present({ id: 'a', idea: 'a', queued_at: '1', meta: { queue: { beat: [{ id: 'b' }] } } })
    const b = present({ id: 'b', idea: 'b', queued_at: '2', meta: { queue: { lost_to: [{ id: 'a' }] } } })
    const c = present({ id: 'c', idea: 'c', queued_at: '3', meta: {} })
    expect(nextPair([a, b, c])!.map(p => p.id)).toEqual(['c', 'a'])
    expect(nextPair([a, b])).toBeNull()
  })
  it('is empty with fewer than two untriaged', () => {
    expect(nextPair([row('a', '1')])).toBeNull()
  })
})

describe('could combine (Krish, 2026-10-21: nothing in the queue is combined without his word)', () => {
  const vec = (deg: number) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)]
  const q = (id: string, deg: number, extra: Record<string, any> = {}) => ({
    id, idea: `Idea ${id}`, state: 'seeded', lane_slot: 'follow_the_money', queued_at: '2026-10-20T00:00:00Z',
    embedding: JSON.stringify(vec(deg)), meta: { queue: { so_what: `So what ${id}.` } }, ...extra,
  })
  it('joins close queued ideas by single link, in groups of two to five, with their so_what', async () => {
    const { combineCandidates, COMBINE_COSINE } = await import('../../apps/control-plane/api/_ideaQueue')
    expect(COMBINE_COSINE).toBe(0.72)
    // a-b and b-c are each within 40 degrees (cos 0.77), a-c is 80 apart: single link still joins all three.
    const groups = combineCandidates([q('a', 0), q('b', 40), q('c', 80), q('far', 200)])
    expect(groups).toHaveLength(1)
    expect(groups[0].ids).toEqual(['a', 'b', 'c'])
    expect(groups[0].series).toBe('follow_the_money')
    expect(groups[0].members[0].so_what).toBe('So what a.')
  })
  it('leaves out dropped, unqueued and unembedded ideas, and a lone idea is no group', async () => {
    const { combineCandidates } = await import('../../apps/control-plane/api/_ideaQueue')
    expect(combineCandidates([q('a', 0), q('d', 1, { state: 'dropped' })])).toEqual([])
    expect(combineCandidates([q('a', 0), q('m', 1, { meta: { queue: { triage: { verdict: 'drop' } } } })])).toEqual([])
    expect(combineCandidates([q('a', 0), q('u', 1, { queued_at: null })])).toEqual([])
    expect(combineCandidates([q('a', 0), q('n', 1, { embedding: null })])).toEqual([])
  })
  it('keeps at most five, the most central, and says when the series differ', async () => {
    const { combineCandidates } = await import('../../apps/control-plane/api/_ideaQueue')
    const many = [0, 2, 4, 6, 8, 10, 12].map((d, i) => q(`r${i}`, d, i === 6 ? { lane_slot: 'mind_the_gap' } : {}))
    const [g] = combineCandidates(many)
    expect(g.ids).toHaveLength(5)
    expect(g.ids).toEqual(['r1', 'r2', 'r3', 'r4', 'r5'])
    const [mixed] = combineCandidates([q('a', 0), q('b', 1, { lane_slot: 'mind_the_gap' })])
    expect(mixed.series).toBeNull()
    expect(mixed.mixed_series).toBe(true)
  })
  it('calls no model and writes nothing', () => {
    const src = readFileSync('apps/control-plane/api/_ideaQueue.ts', 'utf8')
    expect(src).not.toMatch(/callClaude|embedBatch|supabase/)
    expect(readFileSync('apps/control-plane/api/idea-queue.ts', 'utf8')).toMatch(/out\.combine = combineCandidates\(/)
  })
  it('synthesize takes a queued source out of the queue, combined by Krish, and refuses a session without his word', async () => {
    const { absorbedQueuePatch } = await import('../../apps/control-plane/api/_ideaQueue')
    const patch = absorbedQueuePatch({ id: 'a', meta: { other: 1, queue: { so_what: 'x', triage: { verdict: 'story' } } } },
      'parent-id', 'Krish', 'combine these two', '2026-10-25T10:00:00Z')
    expect(patch.queued_at).toBeNull()
    expect(patch.meta.other).toBe(1)
    expect(patch.meta.queue).toMatchObject({ so_what: 'x', absorbed_into: 'parent-id', combined_by: 'Krish', combined_said: 'combine these two' })
    // A bare tap carries no words of his: said stays null, never the board's own text.
    expect(absorbedQueuePatch({ id: 'b', meta: {} }, 'parent-id', 'Krish', null, '2026-10-25T10:00:00Z').meta.queue.combined_said).toBeNull()
    const src = readFileSync('apps/control-plane/api/content-ideas/synthesize.ts', 'utf8')
    expect(src).toMatch(/operatorBearerAllowed\(req\) \? \(body\.decided_by === 'Krish' \? 'Krish' : null\) : 'Krish'/)
    expect(src).toMatch(/queued_needs_his_word/)
    expect(src).toMatch(/absorbedQueuePatch\(row, inserted\.id, 'Krish', combinedSaid/)
    // The refusal comes before the model is called.
    expect(src.indexOf('queued_needs_his_word')).toBeLessThan(src.indexOf('callClaude('))
  })
})
