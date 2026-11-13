import { describe, expect, it } from 'vitest'
import { approval, withApprovals } from './_approvals'
import { buildView, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { fillPress, ideasRunOf, storiesFresh, type PressAction } from '../../apps/control-plane/api/board/_viewExtras'
import { validBody } from '../../apps/control-plane/api/board/_contracts'
import { offdaySides } from '../../apps/control-plane/api/board/_offdaySides'
import { liveInput } from '../../apps/control-plane/api/board/_itsLive'

// One live board (Ruling, Krish, 2026-11-11: one live board, in Control Centre; the old board is a read-only archive; Ruling, Krish, 2026-11-13: the old boards are retired for good and redirect to it).
// Everything the old board showed is in the view (contract 1.1.0), and every press the old board made is a press the
// view carries, built so the board accepts it once his words and the time are filled in.

type Body = Record<string, unknown>
const WEEK = '2026-11-09'
const MON = 'b358e788-209f-427b-a84d-1f79a8ebb430', WED = '36886e0b-4b32-473b-be72-b0aef31fccef'
const piece = (id: string, date: string, slot: string, extra: Body = {}) =>
  ({ id, idea: `Piece ${id.slice(0, 4)}.`, scheduled_for: date, lane_slot: slot, state: 'drafting', buried_at: null, updated_at: '2026-11-09T12:00:00Z', meta: {}, ...extra })
const opt = (id: string, extra: Body = {}) => ({ id, format: 'Meme, 2 panels, 4:5', copy: `Option ${id}`, hook: `Hook ${id}`, ...extra })
const story = (n: number) => ({ headline: `Story ${n}`, what: 'What happened.', why: 'Why.', date: '2026-11-11', source: { label: 'Src', url: `https://example.org/${n}` }, media: { kind: 'photo', url: `https://example.org/${n}.jpg` } })

function week(over: Partial<ViewInputs> = {}): ViewInputs {
  const gitbroke = opt('gitbroke', { decided: 'Signed off for publishing next week (Krish, 4 Nov). Growth posts it.', direction: { look: 'Infographic' } })
  return withApprovals({
    week: WEEK, now: new Date('2026-11-11T12:00:00Z'),
    pieces: [piece(MON, '2026-11-09', 'follow_the_money', { state: 'published' }), piece(WED, '2026-11-11', 'under_the_hood'),
      piece('11111111-2222-4333-8444-555555555555', '2026-11-11', 'mind_the_gap')],
    picks: [], history: [], runs: {}, north_star: null, locks: {},
    queue: [{ doc_id: 'off-thu-gitbroke', updated_by: 'Krish', revision: 1, body: { use: 'offday', pick: 'off-thu-gitbroke', day: 'thu',
      idea: { verdict: 'approve', words: null, sha256: offdaySides(gitbroke).idea_sha256 }, direction: { verdict: 'improve', words: 'x', sha256: offdaySides(gitbroke).direction_sha256 } } }],
    ideas: {
      days: { fri: [{ id: 'f3fcd5e1-573e-4692-a413-db7c5823a10e', so_what: 'Meta ranked staff by AI use.', story: 'Headline: Meta staff gamed it. Hook: "A rat tail."' },
        { id: 'c00cd4e0-e1bb-4c60-b36f-cea92897e38c', so_what: 'An old proof.', story: 'Headline: AI found a mistake. Hook: "40 years."' }] },
      offdays: {
        tue: [opt('shell'), opt('quoteline')],
        thu: [gitbroke, opt('agentnotsetup', { decided: 'Posts Thu 12 Nov (Krish, 11 Nov). Codex schedules it.' }), opt('phonehome')],
        sat: [opt('goodnews', { weekly: 'good_news', stories_due: '2026-10-28', decided: 'Chosen at the weekend (Krish, 4 Nov).', stories: [1, 2, 3, 4, 5].map(story) }), opt('infosys')],
      },
    },
    ...over,
  })
}
const day = (v: ReturnType<typeof buildView>, d: string) => v.days.find(x => x.day === d)!
const presses = (v: ReturnType<typeof buildView>) => v.days.flatMap(d => [...d.actions, ...d.options.flatMap(o => o.actions)]).filter((a): a is PressAction => a.kind === 'press')

describe('one live board: the view carries everything the old board showed', () => {
  it('shows every piece on a day, the one it leads with marked', () => {
    const wed = day(buildView(week()), 'wed')
    expect(wed.pieces.map(p => p.id).sort()).toEqual([WED, '11111111-2222-4333-8444-555555555555'].sort())
    expect(wed.pieces.find(p => p.on_day)?.id).toBe(WED)
  })

  it('holds an off-day option a session wrote as decided until he presses Approve, and then it is chosen (the ideas gate)', () => {
    // Krish, 2026-11-11: only his Approved crosses. Words a session wrote as decided are shown, never read as his press.
    const held = day(buildView(week()), 'thu')
    const opts = Object.fromEntries(held.options.map(o => [o.id, o]))
    expect(opts.gitbroke.status).toBe('held')
    expect(opts.gitbroke.said).toMatch(/^Said in a session, not pressed here: Signed off/)
    expect(opts.gitbroke.held).toMatch(/not pressed Approve/)
    expect(opts.gitbroke.actions.map(a => a.label)).toEqual(['Approve for Thursday 12 Nov', 'Improve for a future piece', 'Reject', 'Save as a trend', 'File for later'])
    expect(held.held.map(h => [h.option, h.title])).toEqual([['off-thu-gitbroke', 'Held: not approved by you'], ['off-thu-agentnotsetup', 'Held: not approved by you']])
    // A held idea is the ideas board's: the day never leads with it (Ruling, Krish, 2026-11-13).
    expect(held.actions.some(a => a.kind === 'press' && /^Approve/.test(a.label))).toBe(false)
    // His Approve on it stands: it is chosen, says so with when, and carries no press; his words settled its Improve.
    const gitbroke = opt('gitbroke', { decided: 'Signed off for publishing next week (Krish, 4 Nov). Growth posts it.', direction: { look: 'Infographic' } })
    const approved = buildView(week({ approvals: [approval(WEEK, 'thu', 'gitbroke', { doc: 'queue/off-thu-gitbroke', option_sha256: offdaySides(gitbroke).idea_sha256, decided_at: '2026-11-03T11:56:26Z' })] }))
    const thu = day(approved, 'thu')
    expect(thu.who).toBe('growth')
    expect(thu.next).toMatch(/Approved/)
    expect(thu.detail[0]).toEqual({ h: 'Approved by you', p: 'Tue 3 Nov, 06:56' })
    const o = thu.options.find(x => x.id === 'gitbroke')!
    expect(o.status).toBe('approved')
    expect(o.outcome).toMatchObject({ id: 'approved', label: 'Approved by you, Tue 3 Nov, 06:56' })
    expect(o.actions).toEqual([])
    expect(thu.held.map(h => h.option)).toEqual(['off-thu-agentnotsetup'])
    expect(thu.options.find(x => x.id === 'phonehome')!.status).toBe('open')
  })

  it('brings Saturday\'s good news with the week\'s one ideas run, and shows the stories once they are in', () => {
    // Ruling (Krish, 2026-11-11): the ideas board fills once a week in full, Saturday's good news included.
    const gnApproved = (stories_due: string) => {
      const ideas = week().ideas as Body & { offdays: Record<string, Body[]> }
      ideas.offdays.sat[0] = { ...ideas.offdays.sat[0], stories_due, stories: [1, 2, 3, 4, 5].map(story) }
      return week({ ideas, approvals: [approval(WEEK, 'sat', 'goodnews', { doc: 'queue/off-sat-goodnews' })] })
    }
    const stale = day(buildView(gnApproved('2026-10-28')), 'sat')
    expect(stale.who).toBe('engine')
    expect(stale.next).toMatch(/not in yet/)
    expect(stale.actions[0]).toMatchObject({ kind: 'run', job: 'saturday-goodnews', input: { week: WEEK } })
    expect(stale.options.find(o => o.id === 'goodnews')?.stories_fresh).toBe(false)
    // Found by the week's ideas run (the Saturday nine days before its Monday) or later: this week's stories.
    const fresh = day(buildView(gnApproved('2026-10-31')), 'sat')
    expect(fresh.who).toBe('growth')
    expect(fresh.next).toMatch(/5 stories/)
    const gn = fresh.options.find(o => o.id === 'goodnews')!
    expect(gn.stories_fresh).toBe(true)
    expect(gn.stories).toHaveLength(5)
    expect(gn.stories![0]).toMatchObject({ headline: 'Story 1', href: 'https://example.org/1', media_kind: 'photo' })
    expect(ideasRunOf(WEEK)).toBe('2026-10-31')
    expect(storiesFresh(WEEK, { stories: [1, 2, 3, 4, 5].map(story), stories_due: '2026-10-30' })).toBe(false)
    expect(storiesFresh(WEEK, { stories: [1, 2, 3, 4].map(story), stories_due: '2026-11-12' })).toBe(false)
    // Without his Approve the good news is an option to judge, held while a session's words call it decided.
    const unpressed = day(buildView(week()), 'sat')
    expect(unpressed.who).toBe('you')
    expect(unpressed.held.map(h => h.option)).toEqual(['off-sat-goodnews'])
  })

  it('offers each Sunday option of a day with no piece its five outcomes, each saying where it goes, and points the day there', () => {
    const fri = day(buildView(week()), 'fri')
    expect(fri.actions[0]).toMatchObject({ kind: 'open', href: `/board/${WEEK}#options-fri` })
    expect(fri.options.map(o => o.doc_id)).toEqual(['fri-1', 'fri-2'])
    expect(fri.options[0].title).toBe('Meta staff gamed it.')
    const acts = fri.options[0].actions
    expect(acts.map(a => a.label)).toEqual(['Approve for Friday 13 Nov', 'File for later', 'Reject', 'Save as a trend', 'Improve for a future piece'])
    expect(acts.map(a => a.outcome)).toEqual(['approved', 'filed', 'rejected', 'trend', 'improved'])
    expect(acts[0].goes).toBe("Goes onto the publish board for Friday 13 November as the day's piece.")
    for (const a of acts) expect(a.goes, a.label).toBeTruthy()
    // A day with its piece approved and placed keeps its options to read and press; since 1.13.0 each other option's
    // Approve says what it replaces and asks where that piece goes (Krish, 13 Nov 2026: "There is no approve button").
    const F = 'f3fcd5e1-573e-4692-a413-db7c5823a10e'
    const placed = day(buildView(week({ pieces: [...week().pieces, piece(F, '2026-11-13', 'mind_the_gap')] })), 'fri')
    expect(placed.options[0].actions.map(a => a.label)).toEqual([])
    expect(placed.options[0].status).toBe('approved')
    expect(placed.options[1].actions.map(a => a.label).slice(1)).toEqual(['File for later', 'Reject', 'Save as a trend', 'Improve for a future piece'])
    const swap = placed.options[1].actions[0]
    expect(swap.op).toBe('replace')
    expect(swap.label).toMatch(/^Approve for Fri 13 Nov, replacing /)
    expect(swap.choose?.path).toBe('current_to')
    expect(swap.choose?.options.map(o => o.value).slice(-2)).toEqual(['later', 'alongside'])
  })

  it('builds every press as a document the board accepts once his words and the time are in', () => {
    const states = [week(), week({ queue: [] }), week({ picks: [{ doc_id: 'fri', updated_by: 'Krish', revision: 3, body: { day: 'fri', pick: 'fri-2', story: 's', at: '2026-11-08T10:00:00Z' } }] })]
    let n = 0
    for (const s of states) for (const a of presses(buildView(s))) {
      const { id, body } = fillPress(a, a.words ? 'His words.' : '', '2026-11-11T12:00:00Z')
      if (a.op === 'material') { expect(typeof body.piece_id).toBe('string'); expect(body.content).toBe('His words.'); continue }
      // It's live (1.7.0): his link and the channels he chose, checked as the live route checks them.
      if (a.op === 'live') { expect(liveInput({ ...body, url: 'https://www.instagram.com/p/abc/', channels: [a.choose!.options[0].value] }).input, a.label).toBeTruthy(); continue }
      expect(validBody(a.collection!, id, body), `${a.collection}/${id} ${a.label}`).toBe(true)
      n++
    }
    expect(n).toBeGreaterThan(20)
  })

  it('carries his comments, Growth\'s posts, his yes and the change signal', () => {
    const v = buildView(week({
      comments: [{ doc_id: 'c1', updated_by: 'Krish', updated_at: '2026-11-03T06:52:52Z', body: { thread_id: 'c1', anchor: 'idea-fri-2', text: 'PICK fri', at: '2026-11-03T06:52:49Z' } }],
      ticks: [{ tick_id: 'mon-shorts', updated_by: 'growth', body: { done: true, day: 'mon', step: 'shorts', label: 'YouTube Shorts', at: '2026-11-09T17:30:24Z', posts: [{ url: 'https://www.youtube.com/shorts/x' }] } }],
      picks: [{ doc_id: 'yes-wed-words', updated_by: 'engine_operator', body: { kind: 'yes', day: 'wed', via: 'words', approved: true, words: 'yes', at: '2026-11-11T10:25:58Z' } }],
      revision: 41,
    }))
    expect(day(v, 'fri').comments.map(c => c.anchor)).toEqual(['idea-fri-2'])
    expect(day(v, 'mon').posted).toEqual([{ step: 'shorts', label: 'YouTube Shorts', at: '2026-11-09T17:30:24Z', href: 'https://www.youtube.com/shorts/x', by: 'growth' }])
    expect(day(v, 'wed').yes).toMatchObject({ approved: true, via: 'words' })
    expect(v.revision).toBe(41)
  })
})
