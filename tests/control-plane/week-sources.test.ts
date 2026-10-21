import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildSources, excluded, LIKED_COSINE, sourceKind, tasteOf, windows } from '../../apps/control-plane/api/_weekSources'

// Sunday's ideas from every source (Krish, 2026-10-21): gathered from his own ideas, his inspo folder and the
// engine's research, ranked by what he picked and marked before; the judges stay blind.

const WEEK = '2026-10-26'
const at = (iso: string) => `${iso}T09:00:00.000Z`
// Unit vectors at a chosen angle from the x axis, so a cosine is exactly what the test says.
const vec = (deg: number) => JSON.stringify([Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0])
const row = (id: string, extra: Record<string, any> = {}) => ({
  id, idea: `Idea ${id}`, thesis: null, state: 'seeded', lane_slot: 'follow_the_money', source_type: 'pool_headline',
  source_url: 'https://example.com', created_at: at('2026-10-22'), meta: {}, embedding: null, ...extra,
})

describe('the three pools', () => {
  it('his words, his inspo folder and the engine each land in their own pool', () => {
    expect(sourceKind({ source_type: 'manual', source_ref: 'said:x' })).toEqual({ kind: 'his', via: 'said' })
    expect(sourceKind({ source_type: 'requested_research', meta: { requested_by: 'Krish' } })).toEqual({ kind: 'his', via: 'research' })
    expect(sourceKind({ source_type: 'inspiration_sweep' }).kind).toBe('inspo')
    expect(sourceKind({ source_type: 'pool_headline' }).kind).toBe('engine')
    const out = buildSources({
      weekStart: WEEK, series: ['follow_the_money'], tasteRows: [],
      rows: [row('a', { source_type: 'manual', source_ref: 'said:11111111-2222-4333-8444-555555555555', state: 'drafting' }), row('b', { source_type: 'inspiration_sweep' }), row('c')],
    })
    expect(out.counts).toEqual({ his: 1, inspo: 1, engine: 1 })
    expect(out.series[0].pool.map(c => [c.id, c.source_kind])).toEqual([['a', 'his'], ['b', 'inspo'], ['c', 'engine']])
  })

  it('a topic researched for a session is not his idea; only one he asked for is', () => {
    expect(sourceKind({ source_type: 'requested_research', meta: { requested_by: 'Claude Code' } }).kind).toBe('engine')
    expect(sourceKind({ source_type: 'requested_research', meta: {} }).kind).toBe('engine')
  })

  it('scheduled, published, absorbed, buried, library and queued rows are never offered', () => {
    expect(excluded(row('s', { scheduled_for: '2026-10-28' }))).toBe('scheduled')
    expect(excluded(row('p', { state: 'published' }))).toBe('published')
    expect(excluded(row('x', { state: 'absorbed' }))).toBe('absorbed')
    expect(excluded(row('d', { state: 'dropped' }))).toBe('dropped')
    expect(excluded(row('b', { buried_at: at('2026-10-20') }))).toBe('buried')
    expect(excluded(row('l', { library_at: at('2026-10-20') }))).toBe('library')
    expect(excluded(row('q', { queued_at: at('2026-10-20') }))).toBe('queued')
    const out = buildSources({ weekStart: WEEK, series: ['follow_the_money'], tasteRows: [], rows: [
      row('s', { scheduled_for: '2026-10-28' }), row('x', { state: 'absorbed' }), row('ok')] })
    expect(out.series[0].pool.map(c => c.id)).toEqual(['ok'])
    expect(out.skipped).toEqual({ scheduled: 1, absorbed: 1 })
  })

  it('his window starts the Monday before; the others look back fourteen days from the Sunday', () => {
    const w = windows(WEEK)
    expect(w.his_since.slice(0, 10)).toBe('2026-10-19')
    expect(w.pool_since.slice(0, 10)).toBe('2026-10-11')
    const out = buildSources({ weekStart: WEEK, series: ['follow_the_money'], tasteRows: [], rows: [
      row('old-his', { source_type: 'manual', source_ref: 'said:1', created_at: at('2026-10-15') }), row('engine-15', { created_at: at('2026-10-15') }),
      row('too-old', { created_at: at('2026-10-05') }), row('drafting-engine', { state: 'drafting' })] })
    expect(out.series[0].pool.map(c => c.id)).toEqual(['engine-15'])
  })

  it('names the empty source and why', () => {
    const out = buildSources({ weekStart: WEEK, series: ['follow_the_money'], tasteRows: [], rows: [row('c')],
      relayed: [{ id: 'krish-ideas-week-2026-10-26', title: 'His ideas', detail: 'In his words', created_at: at('2026-10-24') }] })
    expect(out.empty.map(e => e.source)).toEqual(['his', 'inspo'])
    expect(out.empty[0].why).toMatch(/1 relayed board item/)
    expect(out.his_relayed[0].id).toBe('krish-ideas-week-2026-10-26')
  })
})

describe('his taste, as evidence', () => {
  const liked = row('liked', { idea: 'Who pays for free AI', embedding: vec(0), queued_at: at('2026-10-19'),
    meta: { queue: { triage: { verdict: 'story', decided_by: 'Krish', at: at('2026-10-20') } } } })
  const dropped = row('dropped', { idea: 'Dull enterprise suite', embedding: vec(90), state: 'dropped',
    meta: { queue: { triage: { verdict: 'drop', decided_by: 'Krish' } } } })

  it('reads only his own marks: a verdict decided by anyone else is not his taste', () => {
    const taste = tasteOf([liked, row('session', { meta: { queue: { triage: { verdict: 'story', decided_by: 'Claude Code' } } } }),
      row('picked', { scheduled_for: '2026-10-21' }), row('opt', { meta: { week_option: { by: 'Claude Code', rank: 1 } } }),
      row('his-opt', { meta: { week_option: { by: 'Krish', rank: 1 } } }), row('won', { meta: { queue: { beat: [{ id: 'z' }] } } })])
    expect(taste.map(t => [t.id, t.kind])).toEqual([['liked', 'story'], ['picked', 'pick'], ['his-opt', 'pick'], ['won', 'ab_win']])
  })

  it('why_here names the nearest idea he liked, and near_drop flags one close to a Drop', () => {
    const near = Math.acos(LIKED_COSINE) * 180 / Math.PI // the widest angle that still counts as near
    const out = buildSources({ weekStart: WEEK, series: ['follow_the_money'], tasteRows: [liked, dropped], rows: [
      row('close', { embedding: vec(10) }), row('far', { embedding: vec(45) }), row('dropish', { embedding: vec(90 - near + 1) })] })
    const pool = Object.fromEntries(out.series[0].pool.map(c => [c.id, c]))
    expect(pool.close.why_here).toBe('close to your Story mark on "Who pays for free AI"')
    expect(pool.close.near?.id).toBe('liked')
    expect(pool.far.why_here).toBeNull()
    expect(pool.dropish.near_drop?.id).toBe('dropped')
    expect(out.taste.liked.map(t => t.id)).toEqual(['liked'])
    expect(out.taste.drops.map(t => t.id)).toEqual(['dropped'])
    expect(JSON.stringify(out.taste)).not.toMatch(/vec/)
  })

  it('ranks his ideas first, then ideas near something he liked, then the ladder score', () => {
    const score = (s: number) => ({ ladder: { final: { score: s } } })
    const out = buildSources({ weekStart: WEEK, series: ['follow_the_money'], tasteRows: [liked], rows: [
      row('top-score', { meta: score(9) }), row('low-score', { meta: score(2) }), row('near', { embedding: vec(5), meta: score(1) }),
      row('his', { source_type: 'manual', source_ref: 'said:2', meta: score(0) })] })
    expect(out.series[0].pool.map(c => c.id)).toEqual(['his', 'near', 'top-score', 'low-score'])
  })

  it('leaves the judges blind: the ladder and the arc scorer never read it', () => {
    const ladder = readFileSync('apps/control-plane/api/judge/ladder.ts', 'utf8')
    const scorer = readFileSync('apps/control-plane/api/_arcScore.ts', 'utf8')
    for (const src of [ladder, scorer]) expect(src).not.toMatch(/_weekSources|why_here|week_option/)
    expect(readFileSync('apps/control-plane/scripts/check-judges.ts', 'utf8')).toMatch(/the judges stay blind/)
    expect(readFileSync('apps/control-plane/api/_weekSources.ts', 'utf8')).not.toMatch(/callClaude|embedBatch|\.insert\(|\.update\(/)
  })

  it('the route serves it on include=sources, read-only', () => {
    const route = readFileSync('apps/control-plane/api/week/options.ts', 'utf8')
    expect(route).toMatch(/include \|\| ''\)\.split\(','\)\.includes\('sources'\)/)
    expect(route).toMatch(/id\.like\.krish-ideas-%,id\.like\.said-%/)
  })
})
