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
