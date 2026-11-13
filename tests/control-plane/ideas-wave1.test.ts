// The ideas quality plan, Wave 1, on the engine's side: an idea he rejected leaves the Sunday pool when he presses and
// joins his Drops, the gather hands the run the subjects he gave back and the house rules the ideas are held to, and the
// board shows his warning on an option, each subject not offered again with one press to give it back (his alone), and
// each return held back with its reason. The checks themselves are Python (scripts/post-pack/idea_checks.py; tests
// idea_checks_test.py and ideas_history_test.py). Every sentence here is invented, none is his.
import { describe, expect, it, vi } from 'vitest'
import { buildSources } from '../../apps/control-plane/api/_weekSources'
import { hisOnlyRefusal, validBody, VETO_ID } from '../../apps/control-plane/api/board/_contracts.js'
import { ideaLines, offdayOptions, seriesOptions, tickNote, warned, type ExtrasInputs } from '../../apps/control-plane/api/board/_viewExtras'

const WEEK = '2026-11-23'
const at = (d: string) => `${d}T10:00:00Z`
const vec = (deg: number) => JSON.stringify([Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)])
const row = (id: string, extra: Record<string, unknown> = {}) => ({ id, idea: `Idea ${id}`, state: 'seeded', lane_slot: 'follow_the_money',
  source_type: 'radar', created_at: at('2026-11-14'), meta: {}, ...extra })

describe('his Reject takes an idea out of the pool at once', () => {
  it('skips a rejected row as rejected, and its row is one of his Drops for the near-drop check', () => {
    const rejected = row('11111111-2222-4333-8444-555555555555', { embedding: vec(0) })
    const out = buildSources({ weekStart: WEEK, series: ['follow_the_money'], tasteRows: [],
      rows: [rejected, row('near', { embedding: vec(5) }), row('far', { embedding: vec(80) })],
      rejected: [{ id: '11111111-2222-4333-8444-555555555555', said: 'Not this one.', at: at('2026-11-16') }], rejectedRows: [rejected] })
    const pool = out.series[0].pool.map(c => c.id)
    expect([...pool].sort()).toEqual(['far', 'near'])
    expect(pool).not.toContain('11111111-2222-4333-8444-555555555555')
    expect(out.skipped.rejected).toBe(1)
    expect(out.taste.drops).toEqual([{ id: '11111111-2222-4333-8444-555555555555', idea: 'Idea 11111111-2222-4333-8444-555555555555', angle: null,
      reason: 'Not this one.', at: at('2026-11-16') }])
    const near = out.series[0].pool.find(c => c.id === 'near')
    expect(near?.near_drop?.id).toBe('11111111-2222-4333-8444-555555555555')
  })
})

describe('the gather reads what the checks need', () => {
  it('his answers carry their press and what he saw; the subjects he gave back and the house rules come with them', async () => {
    vi.resetModules()
    vi.doMock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))
    const { readUnvetoed, IDEA_RULES } = await import('../../apps/control-plane/api/week/options')
    const rows = [
      { week: '2026-11-16', doc_id: 'veto-acme', body: { pick: 'veto-acme', queued: false, unveto: 'Acme', at: '2026-11-18T09:00:00Z' }, updated_by: 'Krish', updated_at: '2026-11-18T09:00:01Z' },
      { week: '2026-11-16', doc_id: 'veto-qux', body: { pick: 'veto-qux', queued: false, unveto: 'Qux' }, updated_by: 'engine_operator', updated_at: '2026-11-18T09:00:01Z' },
    ]
    const q: any = { select: () => q, eq: () => q, like: () => q, in: () => q, limit: async () => ({ data: rows, error: null }) }
    const got = await readUnvetoed(WEEK, { from: () => q } as never)
    expect(got.list).toEqual([{ subject: 'Acme', at: '2026-11-18T09:00:00Z', week: '2026-11-16' }])
    const down: any = { select: () => down, eq: () => down, like: () => down, in: () => down, limit: async () => ({ data: null, error: { message: 'down' } }) }
    expect((await readUnvetoed(WEEK, { from: () => down } as never)).empty).toMatch(/every refusal stands/)
    expect([...IDEA_RULES]).toEqual(['BIG_PICTURE', 'STORY_ARC'])
    vi.doUnmock('../../apps/control-plane/api/_supabase.js')
  })
})

describe('the board shows what the run will not offer, and why', () => {
  const inputs = (ideas: Record<string, unknown>, queue: ExtrasInputs['queue'] = []): ExtrasInputs =>
    ({ week: WEEK, pieces: [], picks: [], queue, ideas, approvals: [] })

  it('a warned option says his words first', () => {
    const o = { id: '22222222-3333-4444-8555-666666666666', so_what: 'Who keeps the AI saving.', story: 'Headline: who keeps it.',
      warning: { subject: 'Acme', said: 'Acme is boring', at: '2026-11-17' } }
    expect(warned(o)).toBe('Warned: you said "Acme is boring" (17 Nov). ')
    const [option] = seriesOptions(inputs({ days: { mon: [o] } }), 'mon', false)
    expect(option.text.startsWith('Warned: you said "Acme is boring" (17 Nov). Who keeps')).toBe(true)
    expect(warned({ so_what: 'x' })).toBe('')
  })

  it('an idea from his ticked card on a subject he turned down says so first, and still waits for his Approve (Ruling, Krish, 2026-11-12)', () => {
    const tick = { action_id: '44444444-5555-4666-8777-888888888888', card_id: '66666666-7777-4888-8999-aaaaaaaaaaaa', card_name: 'a-reel.mp4' }
    const refused_before = [{ subject: 'Acme', said: 'Acme is boring.', at: '2026-11-17', via: 'reject', ref: '2026-11-16/queue/fri-3' }]
    const o = { id: '55555555-6666-4777-8888-999999999999', so_what: 'Acme staff who ask questions keep their jobs.', story: 'Headline: x.', from_inspiration: tick, refused_before }
    const note = 'Turned down before: on 17 Nov you said "Acme is boring." It is here because you ticked this card, and your Approve decides. '
    expect(tickNote(o)).toBe(note)
    const [, option] = seriesOptions(inputs({ days: { mon: [{ id: '22222222-3333-4444-8555-666666666666', so_what: 'Other.', story: 'Headline: y.' }, o] } }), 'mon', false)
    expect(option.text).toBe(`${note}Acme staff who ask questions keep their jobs.`)
    expect(option.actions.map(a => a.label)[0]).toMatch(/^Approve for /)
    expect(option.status).toBe('open')
    const off = { id: o.id, kind: 'recorded', hook: 'The good employee is the one AI replaces', copy: 'Acme staff who ask questions keep their jobs.', from_inspiration: tick,
      refused_before: [{ subject: 'Acme', said: null, at: '2026-11-17' }] }
    const [shown] = offdayOptions({ week: WEEK, pieces: [], picks: [], queue: [], approvals: [], ideas: { offdays: { tue: [off] } } }, 'tue')
    expect(shown.text.startsWith('Turned down before: on 17 Nov you turned down Acme. It is here because you ticked this card, and your Approve decides. Acme staff')).toBe(true)
    expect(shown.actions.map(a => a.label)[0]).toMatch(/^Approve for /)
    expect(tickNote({ so_what: 'x' })).toBe('')
  })

  it('each subject not offered again is a line with his words and one press to give it back, which is his alone', () => {
    const ideas = { vetoes: [{ subject: 'Acme', said: 'Told you, Acme is boring.', at: '2026-11-16', day: 'mon' }],
      held: [{ ref: '2026-11-16/queue/off-tue-acme', day: 'tue', title: 'Acme clients took the savings', reason: 'It came back unchanged, with no source newer than your press.' }] }
    const [line] = ideaLines(inputs(ideas), 'mon')
    expect(line.title).toBe('Not offered again: Acme')
    expect(line.text).toBe('You said on 16 Nov: "Told you, Acme is boring." The ideas run will not offer it until you raise it again.')
    expect(line.status).toBe('not offered again')
    const press = line.actions[0] as { label: string; collection: string; id: string; body: Record<string, unknown> }
    expect(press.label).toBe('Offer it again')
    expect([press.collection, press.id]).toEqual(['queue', 'veto-acme'])
    expect(validBody('queue', 'veto-acme', { ...press.body, at: '2026-11-22T08:00:00Z' })).toBe(true)
    expect(hisOnlyRefusal('queue', press.body, 'engine_operator')).toBe('press_is_his')
    expect(hisOnlyRefusal('queue', press.body, 'Krish')).toBeNull()
    expect(validBody('queue', 'veto-acme', { pick: 'veto-acme', queued: true, unveto: 'Acme' })).toBe(false)
    expect(VETO_ID.test('veto-Acme')).toBe(false)
    const [back] = ideaLines(inputs(ideas, [{ doc_id: 'veto-acme', body: press.body, updated_by: 'Krish' }]), 'mon')
    expect([back.status, back.actions.length]).toEqual(['given back', 0])
    const [held] = ideaLines(inputs(ideas), 'tue')
    expect([held.title, held.status, held.actions.length]).toEqual(['Held back: Acme clients took the savings', 'held back', 0])
    expect(ideaLines(inputs(ideas), 'wed')).toEqual([])
  })
})

describe('the run reads fuller sources, and the good news shows its mix (items 9 and 12)', () => {
  it('a wordless card from a bulk import leaves fresh and stays in the library; a card saved as good news is positive', async () => {
    const { buildInspiration, BULK_AT_ONCE } = await import('../../apps/control-plane/api/_inspirationSources')
    const bulk = Array.from({ length: BULK_AT_ONCE }, (_, n) => ({ id: `b${n}`, name: `instagram_${n}.jpg`, kind: 'image', created_at: '2026-11-17T17:23:10Z', facets: {} }))
    const words = { id: 'w1', name: 'instagram_w.jpg', kind: 'image', created_at: '2026-11-17T17:23:20Z', facets: {}, transcript: 'A robot hands a nurse a tray.' }
    const sunny = { id: 's1', name: 'clip.mp4', kind: 'video', created_at: '2026-11-15T09:00:00Z', facets: {}, why_like: 'Just a positive story, more like this', why_like_source: 'typed',
      answered_at: '2026-11-15T09:01:00Z' }
    const lone = { id: 'l1', name: 'one.jpg', kind: 'image', created_at: '2026-11-16T08:00:00Z', facets: {} }
    const out = buildInspiration({ weekStart: WEEK, items: [...bulk, words, sunny, lone] })
    expect(out.fresh.map(c => c.id).sort()).toEqual(['l1', 'w1'])
    expect(out.counts.fresh_left_out_bulk_wordless).toBe(BULK_AT_ONCE)
    expect(out.positive.map(c => c.id)).toEqual(['s1'])
  })

  it('the feed, his session corrections and his hindsight scores come in plain lists, his words kept exactly', async () => {
    const { buildCorrections, buildFeed, buildHindsight } = await import('../../apps/control-plane/api/_inspirationSources')
    expect(buildFeed([{ title: 'A post', excerpt: 'What it says.', meta: { account: '@someone', url: 'https://example.com/p' }, occurred_at: '2026-11-15T00:00:00Z' }]))
      .toEqual([{ title: 'A post', excerpt: 'What it says.', account: '@someone', url: 'https://example.com/p', at: '2026-11-15T00:00:00Z' }])
    expect(buildCorrections([{ excerpt: 'Make it simpler.', title: 'The cover', meta: { said_where: 'a session' }, occurred_at: '2026-11-15T00:00:00Z' },
      { excerpt: 'x', title: null, meta: {}, occurred_at: null }, { excerpt: 'Taken back.', withdrawn_at: '2026-11-16T00:00:00Z', meta: {} }]))
      .toEqual([{ said: 'Make it simpler.', about: 'The cover', where: 'a session', repository: null, at: '2026-11-15T00:00:00Z' }])
    expect(buildHindsight([{ piece_id: 'p1', narrative: 8, production: 7, note: 'Clear.', scored_at: '2026-11-07T00:00:00Z' }]))
      .toEqual([{ piece_id: 'p1', narrative: 8, production: 7, note: 'Clear.', at: '2026-11-07T00:00:00Z' }])
  })

  it('the good-news option says its mix before he presses', async () => {
    const { mixOf, offdayOptions } = await import('../../apps/control-plane/api/board/_viewExtras')
    const st = (kind: string) => ({ headline: 'h', what: 'w', why: 'y', kind, date: '2026-11-20', source: { label: 'L', url: 'https://e.com' }, media: { kind: 'photo', url: 'https://e.com/i' } })
    const stories = [st('health'), st('work'), st('health'), st('money'), st('lab')]
    expect(mixOf(stories)).toBe('2 health, 1 lab, 1 money, 1 work')
    const [o] = offdayOptions({ week: WEEK, pieces: [], picks: [], queue: [], approvals: [], ideas: { offdays: { sat: [{ id: 'goodnews', weekly: 'good_news',
      hook: 'Good things AI did this week.', copy: 'Five stories.', stories_due: '2026-11-14', stories }] } } }, 'sat')
    expect(o.text.startsWith('The mix: 2 health, 1 lab, 1 money, 1 work. ')).toBe(true)
  })
})
