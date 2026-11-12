import { describe, expect, it } from 'vitest'
import { buildView, viewProblems, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { pieceScheduled, recordScheduled, scheduledOf } from '../../apps/control-plane/api/board/_posted'
import { reportPosts } from '../../apps/control-plane/api/board/_offdayItems'
import { approvedAll } from './_approvals'

// A piece's scheduled posts on the board (docs/PUBLISH_BOARDS.md, "Where everything is"). Ruling (Krish, 2026-11-12):
// the board shows exactly where everything is. Fri 13 Nov was scheduled while the board said "Ready to post: Growth
// posts it on the day": the write-back took only a post that went out, and the off-day one has no piece. Growth now
// reports a piece's scheduled posts through the same route (POST /offday-posts, a piece's entries), each kept on the
// day's box for its channel, and the day says when it goes out.

type Body = Record<string, any>
const WEEK = '2026-11-09'
const FRI = 'f3fcd5e1-573e-4692-a413-db7c5823a10e'
const AT = '2026-11-10T10:00:00Z'
const takes = ['long', 'short'].map(cut => ({ cut, path: `recordings/${cut}.mp4`, at: AT }))
const cuts = ['long', 'short'].map(cut => ({ cut, name: `${cut}.mp4`, path: `x/${cut}.mp4`, at: AT, thumbnail: { path: `x/${cut}.jpg` } }))
const piece = { id: FRI, idea: 'Meta staff were ranked by AI use. They gamed it.', scheduled_for: '2026-11-13', lane_slot: 'mind_the_gap', state: 'drafting', buried_at: null, body: '',
  updated_at: AT, meta: { making: { recordings: takes, video_assets: cuts }, look: { production: 'face-with-proof', at: AT } } }
const yes = { doc_id: 'yes-fri-words', updated_by: 'engine', body: { kind: 'yes', day: 'fri', via: 'words', approved: true, words: 'ready to go', at: AT, said_at: AT, said_where: 'session', session_ref: 'https://claude.ai/code/session_x' } }
const scripts = { doc_id: 'fri-scripts', updated_by: 'Krish', body: { approved: true, piece_id: FRI, at: AT } }
const notes = { tick_id: 'fri-substack-notes', updated_by: 'growth', body: { done: false, day: 'fri', piece_id: FRI, step: 'substack-notes', channel: 'substack-notes', label: 'Substack Notes', by: 'growth',
  scheduled: [{ due_at: '2026-11-13T17:40:00.000Z', buffer_post_id: '6af4e3a977f44b6536fa99f8', at: '2026-11-12T12:00:00Z' }] } }
const inputs = (over: Partial<ViewInputs> = {}): ViewInputs => ({ week: WEEK, now: new Date('2026-11-12T15:00:00Z'), pieces: [piece], picks: [yes, scripts], queue: [], history: [], runs: {}, north_star: null,
  ideas: null, locks: { fri: 'Signed by Krish: "yes", 2026-11-07, lock sha256 ' + 'a'.repeat(64) }, approvals: approvedAll(WEEK, [piece]), research_files: { fri: true }, ...over } as ViewInputs)

describe('a piece Growth has scheduled', () => {
  it('says when it goes out, from Growth\'s record, and the piece is Scheduled', () => {
    const before = buildView(inputs()).days.find(d => d.day === 'fri')!
    expect(before.next).toBe('Approved in your words. Ready to post: Growth posts it on the day')
    const v = buildView(inputs({ ticks: [notes] }))
    const fri = v.days.find(d => d.day === 'fri')!
    expect(fri.next).toBe('Approved in your words. Scheduled: Substack Notes, from Fri 13 Nov, 12:40')
    expect(fri.pieces[0].stage).toEqual({ state: 'scheduled', label: 'Scheduled on Substack Notes for Fri 13 Nov, 12:40', at: '2026-11-13T17:40:00.000Z', links: [] })
    // The day's approved option is the day's piece: one stage, never two (Wed 11 read "Missed" on its option while the day
    // was published on every channel).
    const withOption = buildView(inputs({ ticks: [notes], ideas: { days: { fri: [{ id: FRI, so_what: 'Meta staff gamed it.', story: 'They gamed it.' }] } } })).days.find(d => d.day === 'fri')!
    const mine = withOption.options.filter(x => x.id === FRI)
    expect(mine).toHaveLength(1)
    expect(mine[0].stage).toEqual(withOption.pieces[0].stage)
    expect(fri.posted).toEqual([]) // scheduled is not out
    expect(viewProblems(v)).toEqual([])
  })

  it('reads only Growth\'s own boxes, not ones already out, and the soonest first', () => {
    const out = { ...notes, tick_id: 'fri-x', body: { ...notes.body, done: true, step: 'x', channel: 'x', label: 'X' } }
    const later = { ...notes, tick_id: 'fri-threads', body: { ...notes.body, step: 'threads', channel: 'threads', label: 'Threads', scheduled: [{ due_at: '2026-11-13T18:00:00.000Z' }] } }
    expect(scheduledOf([later, out, notes, { ...notes, updated_by: 'Krish' }], 'fri', FRI).map(s => s.label)).toEqual(['Substack Notes', 'Threads'])
  })
})

describe('Growth reports a piece\'s scheduled posts', () => {
  function fake(scheduledFor = '2026-11-13', ticks: Body[] = []) {
    const saved: Body[] = []
    const q = (table: string) => {
      const where: Array<(r: Body) => boolean> = []
      const self: any = {
        select: () => self, eq: (k: string, v: unknown) => { where.push(r => String(r[k] ?? '') === String(v)); return self }, in: () => self, or: () => self, limit: () => self,
        maybeSingle: () => Promise.resolve({ data: (table === 'content_ideas' ? [{ id: FRI, scheduled_for: scheduledFor }] : table === 'board_ticks' ? ticks : []).find(r => where.every(w => w(r))) ?? null, error: null }),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok),
      }
      return self
    }
    return { saved, db: { from: q, rpc: async (fn: string, a: Body) => { saved.push({ fn, ...a }); return { data: { ok: true }, error: null } } } }
  }
  const entry = { piece_id: FRI, day: 'fri', state: 'scheduled', channel: 'substack-notes', due_at: '2026-11-13T17:40:00Z', buffer_post_id: '6af4e3a977f44b6536fa99f8' }

  it('keeps it on the day\'s box for that channel, never as out', async () => {
    const f = fake()
    const r = await reportPosts(f.db as never, WEEK, { posts: [entry] }, new Date('2026-11-12T12:00:00Z'))
    expect(r).toEqual({ status: 200, body: { ok: true, items: 0, unknown: 0, pieces: { kept: 1, left: 0 } } })
    expect(f.saved).toHaveLength(1)
    expect(f.saved[0]).toMatchObject({ fn: 'board_save', p_collection: 'ticks', p_id: 'fri-substack-notes', p_actor: 'growth',
      p_body: { done: false, day: 'fri', piece_id: FRI, label: 'Substack Notes', scheduled: [{ due_at: '2026-11-13T17:40:00.000Z', buffer_post_id: '6af4e3a977f44b6536fa99f8' }] } })
  })

  it('leaves a box already out, a piece on another day, and anything that is not a scheduled post', async () => {
    const out = fake('2026-11-13', [{ week: WEEK, tick_id: 'fri-substack-notes', body: { done: true, day: 'fri', piece_id: FRI }, revision: 1 }])
    expect((await recordScheduled(out.db as never, WEEK, [pieceScheduled(entry)!], 'now'))).toEqual({ kept: 0, left: 1, failed: false })
    const moved = fake('2026-11-20')
    expect((await recordScheduled(moved.db as never, WEEK, [pieceScheduled(entry)!], 'now'))).toEqual({ kept: 0, left: 1, failed: false })
    expect(pieceScheduled({ ...entry, state: 'live' })).toBeNull()
    expect(pieceScheduled({ ...entry, due_at: null })).toBeNull()
    expect(pieceScheduled({ ...entry, channel: 'myspace' })).toBeNull()
    expect(pieceScheduled({ ...entry, state: 'cancelled', due_at: null })).toMatchObject({ state: 'cancelled' })
  })
})

describe('what is not filed yet is said, never guessed', () => {
  it('names a missing lock and missing scripts, and never shows them as done', () => {
    const fresh = { ...piece, meta: { materials: [{ id: 'r', title: 'research.md', kind: 'paste', content: 'x', at: AT }] } }
    const story = buildView(inputs({ pieces: [fresh], picks: [], locks: {}, research_files: { fri: true } })).days.find(d => d.day === 'fri')!
    expect(story.next).toBe('No narrative lock and no approved scripts are filed yet. If you settled them in a session, file them from that session; if not, settle the story in a short session and sign the narrative lock')
    expect(story.detail.find(x => x.h === 'Scripts')?.p).toBe("Not filed yet: none on the piece's record and none sent to your Teleprompter")
    const look = buildView(inputs({ pieces: [fresh], picks: [] })).days.find(d => d.day === 'fri')!
    expect(look.next).toBe('Pick the look: the recommended one, another, or fold in your inspiration. No approved scripts are filed yet: if you approved them in a session, file them from that session')
    expect(look.detail.find(x => x.h === 'Narrative lock')?.p).toBe('Signed')
  })
})
