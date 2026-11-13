import { describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { approval } from './_approvals'
import { buildView, viewProblems, type ViewInputs, type WeekView } from '../../apps/control-plane/api/board/_view'
import { CLAUDE_LABEL, GOOD_NEWS_STORIES, OFFDAY_KINDS, PIECE_PATH, POST_PATH, kindLabel, modelProblems, offdayKind } from '../../apps/control-plane/api/board/_weekModel'
import { SCHEMA_PATH, validate } from '../../scripts/check-view-contract'
import { offdaySides } from '../../apps/control-plane/api/board/_offdaySides'
import { assetsOf, type DriveFile } from '../../apps/control-plane/api/board/_drivePosts'

// The week model (contract 1.12.0; Ruling, Krish, 2026-11-13: the publish board shows only what he approved, in one week
// model (three pieces and off-day posts of fixed kinds), one action per item, ideas only on the ideas board, and never
// the old composer). The week here is the week of 9 Nov as it stood on Fri 13 Nov: Mon and Wed out, Tue's three posts
// approved (one live), Thu 12's explainer and meme video approved with an idea he never answered, Fri 13's piece
// approved in his words and ready to post, Sat 14's approved one-story good news beside a held "Good things AI did this
// week" with five stories and a held quiz carousel. Control Centre's board draws its fixture of this week from here
// (apps/control-plane/api/board/fixtures/week-2026-11-09.view.json; UPDATE_WEEK_FIXTURE=1 writes it).

type Body = Record<string, unknown>
const WEEK = '2026-11-09'
const MON = 'b358e788-209f-427b-a84d-1f79a8ebb430', WED = '36886e0b-4b32-473b-be72-b0aef31fccef', FRI = 'f3fcd5e1-573e-4692-a413-db7c5823a10e'
const FRI_OTHER = '56bb9c22-c813-47c1-bf9b-751288c60096'
const SIGNED = '# Narrative lock\n\nThe arc.\n\nSigned by Krish: "Yes, this is the story", 2026-11-08'
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as Body
const FIXTURE = 'apps/control-plane/api/board/fixtures/week-2026-11-09.view.json'

const piece = (id: string, date: string, slot: string, idea: string, making: Body = {}) =>
  ({ id, idea, thesis: idea, scheduled_for: date, lane_slot: slot, state: 'drafting', buried_at: null, body: '', updated_at: '2026-11-12T12:00:00Z', meta: { making, look: { production: 'face-with-proof', experiment: null, inspiration: [], at: '2026-11-08T12:00:00Z' } } })
const cutsOf = (day: string) => ({
  workroom: { at: '2026-11-10T10:00:00Z', url: 'https://example.org/workroom' },
  script_check: { passed: true, checked_at: '2026-11-10T11:00:00Z', cuts: ['long', 'short'] },
  recordings: [{ cut: 'long', at: '2026-11-11T10:00:00Z' }, { cut: 'short', at: '2026-11-11T10:10:00Z' }],
  video_assets: ['long', 'short'].map(c => ({ cut: c, path: `3 Posts/${day}/${c}.mp4`, sha256: (c === 'long' ? 'a' : 'b').repeat(64), at: '2026-11-12T08:00:00Z', seconds: c === 'long' ? 326 : 94,
    url: `https://drive.google.com/file/d/1${c}Cut${day}0000000000000/view`, thumbnail: { path: `3 Posts/${day}/${c}.jpg`, url: `https://drive.google.com/file/d/1${c}Thumb${day}000000000000/view` } })),
})
const live = (day: string, subject: Body, channels: string[], at: string) =>
  ({ doc_id: `live-${day}`, updated_by: 'Krish', body: { kind: 'live', posts: [{ ...subject, channels, url: `https://example.org/${day}/post`, at }] } })
const story = (n: number, headline: string, kind: string) => ({ headline, what: `What happened in story ${n}.`, why: `Why story ${n} matters to people.`, kind, date: '2026-11-07',
  source: { label: `Source ${n}`, url: `https://example.org/goodnews/${n}` }, media: { kind: 'photo', url: `https://example.org/goodnews/${n}.jpg` } })
const img = (id: string, name: string, w: number, h: number): DriveFile => ({ id, name, mimeType: 'image/png', modifiedTime: '2026-11-11T10:00:00Z', size: '1000', imageMediaMetadata: { width: w, height: h } })
const vid = (id: string, name: string, w: number, h: number, ms: number): DriveFile => ({ id, name, mimeType: 'video/mp4', modifiedTime: '2026-11-11T11:00:00Z', size: '1000', videoMediaMetadata: { durationMillis: String(ms), width: w, height: h } })
const folder = (id: string, name: string, date: string) => ({ id, name, url: `https://drive.google.com/drive/folders/${id}`, date })
const said = 'Chosen at the weekend from fresh news (Krish, 4 Nov): the run on Sat 7 Nov brings the week\'s good news, and you pick on Sun 8 Nov.'

/** The week of 9 Nov on Fri 13 Nov, shaped like the live records. */
export function thisWeek(): ViewInputs {
  const i = plan()
  // His Reject on Tuesday's level-up carousel, bound to the words he saw.
  const quoteline = ((i.ideas!.offdays as Body).tue as Body[]).find(o => o.id === 'quoteline')!
  i.queue = [{ doc_id: 'off-tue-quoteline', updated_by: 'Krish', body: { use: 'offday', pick: 'off-tue-quoteline', day: 'tue', idea: { verdict: 'reject', words: 'Boring, no clear takeaway.', sha256: offdaySides(quoteline).idea_sha256 } } }]
  return i
}

function plan(): ViewInputs {
  return {
    week: WEEK, now: new Date('2026-11-13T15:00:00Z'),
    pieces: [
      piece(MON, '2026-11-09', 'follow_the_money', 'When an AI app millions of people loved goes bust, who walks away with the money?', cutsOf('mon')),
      piece(WED, '2026-11-11', 'under_the_hood', 'AI is already inside the songs people have on repeat, hidden in the credits.', cutsOf('wed')),
      piece(FRI, '2026-11-13', 'mind_the_gap', 'Meta staff were ranked by AI use. They gamed it.', cutsOf('fri')),
    ],
    picks: [
      { doc_id: 'mon-scripts', updated_by: 'Krish', body: { approved: true, piece_id: MON } },
      { doc_id: 'wed-scripts', updated_by: 'Krish', body: { approved: true, piece_id: WED } },
      { doc_id: 'fri-scripts', updated_by: 'Krish', body: { approved: true, piece_id: FRI } },
      { doc_id: 'yes-fri-words', updated_by: 'Krish', body: { kind: 'yes', day: 'fri', via: 'words', approved: true, words: 'Yes, post it', at: '2026-11-12T20:00:00Z' } },
      live('mon', { piece_id: MON }, ['substack', 'youtube'], '2026-11-09T13:00:00Z'),
      live('wed', { piece_id: WED }, ['substack', 'youtube'], '2026-11-11T13:00:00Z'),
      live('tue', { option: 'off-tue-shell' }, ['instagram', 'linkedin'], '2026-11-10T13:25:00Z'),
    ],
    queue: [],
    history: [{ collection: 'queue', doc_id: 'off-sat-oldproof', updated_at: '2026-11-08T14:07:00Z', updated_by: 'Krish' }],
    runs: {},
    north_star: { current: 3, target: 8 },
    ideas: {
      days: {
        fri: [
          { id: FRI_OTHER, so_what: 'An AI that agrees with you is a risk.', story: 'Headline: Ask your AI for the other side.', source: { label: 'A study', url: 'https://example.org/study' } },
          { id: FRI, so_what: 'Meta staff were ranked by how much AI they used, so they gamed the count.', story: 'Headline: Meta staff were ranked by AI use. They gamed it. Hook: ...', why_now: 'Reported 6 Nov 2026.', fact: 'The ranking counted prompts, not results.', source: { label: 'The report', url: 'https://example.org/meta' } },
        ],
      },
      offdays: {
        tue: [
          { id: 'shell', format: 'Meme carousel, 3 cards, 4:5', copy: 'Who walked away with what when Character.AI went bust, in three cards.', hook: 'Character.AI went bust. Here is who got what.', ties_to: 'Mon: follow.the.money' },
          { id: 'mcpskin', format: 'Voiceover short with motion graphics, about 40 seconds, 9:16', copy: 'The MCP short you saved on 2 Nov, rebuilt in our look.', hook: 'What MCP actually does, in 40 seconds.' },
          { id: 'homework', format: 'Meme, 2 panels, 4:5', copy: 'Home Depot has one AI answer its customers and a rival AI mark the answers.', hook: 'One AI does the homework, another marks it.' },
          { id: 'quoteline', format: 'Level-up move, carousel, 4 cards, 4:5', copy: 'Ask it to quote the exact line it used.', hook: 'Make your AI quote its source.' },
        ],
        wed: [{ id: 'tablefortwo', format: 'Meme, 1 image, 4:5', copy: 'Table for two. One of them runs on a GPU.', hook: 'POV: tech leaders getting busted in 5 years from now', decided: 'Growth filed it for Wed 11 Nov on white; remade on black 12 Nov.' }],
        thu: [
          { id: 'gitbroke', format: 'Explainer carousel, infographic, 5 cards, 4:5', copy: 'Anthropic\'s own AI wrote so much code the tool almost every programmer uses could not keep up.', hook: 'Anthropic\'s AI wrote so much code Git could not keep up.',
            ties_to: 'Wed: under.the.hood, if you pick Anthropic broke Git', source: { label: 'The Register', url: 'https://example.org/register' }, drive: 'https://drive.google.com/drive/folders/1ThuGitbrokePost000000000001' },
          { id: 'otherside', format: 'Level-up move, carousel, 4 cards, 4:5', copy: 'Four cards. Your AI says hire the cheaper supplier. Ask it for the strongest case against it.', hook: 'Before you take your AI\'s advice, ask this.',
            ties_to: 'Fri: mind.the.gap, if you pick the Grandma piece' },
          { id: 'agentnotsetup', format: 'Meme video, 19 s, 9:16', copy: 'Gave my AI agent the keys to my laptop and zero instructions.', hook: 'POV: your AI agent using your computer without being set up properly by you', drive: 'https://drive.google.com/drive/folders/1ThuAgentPost00000000000001' },
        ],
        sat: [
          { id: 'goodnews', weekly: 'good_news', stories_due: '2026-11-07', format: 'Uplifting AI news carousel, 6 cards, 4:5', copy: 'Good things AI did this week, as real news with the real picture or clip of each one.', hook: 'Good things AI did this week.', decided: said,
            stories: [story(1, 'AI tips helped electricity customers cut peak demand by 1 gigawatt this year', 'climate'), story(2, 'AI drafts of heart scan reports cut doctors\' reading time by nearly half', 'health'),
              story(3, 'An AI model spotted a safety flaw before release', 'safety'), story(4, 'A lab used AI to find a new antibiotic candidate', 'science'), story(5, 'AI helped a charity answer twice as many calls', 'work')] },
          { id: 'spotai', format: 'Quiz carousel, 6 cards, 4:5', copy: 'One of three hit songs started as an AI demo; can you spot it?', hook: 'One of these hits started as an AI demo. Which?', ties_to: 'Wed: under.the.hood, if you pick the AI-in-music piece', decided: said },
          { id: 'oldproof', format: 'Uplifting explainer carousel, 4 cards, 4:5', source: { label: 'Axiom, The enormous theorem formalized', url: 'https://axiommath.ai/research/the-enormous-theorem-formalized/' },
            copy: 'Axiom says its AI agents checked a 15,000-page piece of maths and found a mistake in a proof from 1986.', hook: 'AI found a mistake in a maths proof from 1986, its makers say.',
            pitch: { see: 'Four cards.', lands: 'A 40-year-old mistake found by AI is a story people retell.', share: 'AI is a great checker when something strict checks it.' }, ties_to: 'Fri: mind.the.gap, if you pick the error-finder piece' },
        ],
      },
    },
    locks: { mon: SIGNED, wed: SIGNED, fri: SIGNED },
    // What is in Drive: Thursday's explainer carousel (five cards, 4:5) and its meme video (9:16), filed in their posts.
    drive_posts: [
      { ...folder('1ThuGitbrokePost000000000001', '2026-11-12 Thu off.day - Git could not keep up', '2026-11-12'),
        assets: assetsOf([1, 2, 3, 4, 5].map(n => ({ folder: '4 Social', file: img(`1ThuGitbrokeCard00000000000${n}`, `gitbroke-card-${n}.png`, 1080, 1350) }))) },
      { ...folder('1ThuAgentPost00000000000001', '2026-11-12 Thu off.day - AI agent not set up', '2026-11-12'),
        assets: assetsOf([{ folder: '', file: vid('1ThuAgentVideo0000000000001', 'agent not set up - tall 9x16.mp4', 1080, 1920, 19000) }]) },
    ],
    approvals: [
      approval(WEEK, 'mon', MON), approval(WEEK, 'wed', WED), approval(WEEK, 'fri', FRI),
      approval(WEEK, 'tue', 'shell'), approval(WEEK, 'tue', 'mcpskin'), approval(WEEK, 'tue', 'homework'),
      approval(WEEK, 'thu', 'gitbroke'), approval(WEEK, 'thu', 'agentnotsetup'),
      approval(WEEK, 'sat', 'oldproof'),
    ],
  }
}

const dayOf = (v: WeekView, day: string) => v.model!.days.find(d => d.day === day)!

describe('the week model (contract 1.12.0)', () => {
  const v = buildView(thisWeek())

  it('keeps the contract and every rule of the view and the model', () => {
    expect(v.contract_version).toBe('1.12.0')
    expect(validate(SCHEMA, JSON.parse(JSON.stringify({ ok: true, ...v })), SCHEMA, '$', { open: true })).toEqual([])
    expect(viewProblems(v)).toEqual([])
    expect(modelProblems(v.model!, v.days)).toEqual([])
    if (process.env.UPDATE_WEEK_FIXTURE) writeFileSync(FIXTURE, `${JSON.stringify({ ok: true, ...v }, null, 1)}\n`)
  })

  it('the frozen fixture of this week is what the builder makes now', () => {
    const frozen = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Body
    const { as_of: _a, ...now } = JSON.parse(JSON.stringify({ ok: true, ...v })) as Body
    const { as_of: _b, ...was } = frozen
    expect(now).toEqual(was)
  })

  it('a day draws only what he approved: an unanswered or held option is never on a day', () => {
    for (const md of v.model!.days) {
      const d = v.days.find(x => x.day === md.day)!
      for (const it of md.items) {
        if (it.type === 'piece') expect(d.pieces.find(p => `piece:${p.id}` === it.key)?.approval).toBeTruthy()
        else expect(d.options.find(o => o.doc_id === it.key)).toMatchObject({ status: 'approved', outcome: { id: 'approved' } })
      }
      // Every open, held or revised option on the day is on the ideas board instead, and never on the day.
      for (const o of d.options.filter(x => ['open', 'held', 'revised'].includes(x.status) && !x.outcome)) {
        expect(md.items.some(it => it.key === o.doc_id)).toBe(false)
        expect(v.model!.ideas.some(i => i.doc_id === o.doc_id)).toBe(true)
      }
    }
  })

  it('a held option a session said was decided is an idea, and its Approve is on the ideas board, not on the day', () => {
    const sat = v.days.find(d => d.day === 'sat')!
    expect(sat.actions.some(a => a.kind === 'press' && /^Approve/.test(a.label))).toBe(false)
    const held = v.model!.ideas.filter(i => i.day === 'sat').map(i => i.doc_id)
    expect(held).toEqual(['off-sat-goodnews', 'off-sat-spotai'])
    expect(v.model!.ideas.find(i => i.doc_id === 'off-sat-spotai')!.actions.map(a => a.label)).toContain('Approve for Saturday 14 Nov')
    expect(v.yours.every(y => y.actions.every(a => !(a.kind === 'press' && a.collection === 'queue')))).toBe(true)
  })

  it('Thu 12: the explainer and the meme video he approved, and the idea he never answered off the day', () => {
    const thu = dayOf(v, 'thu')
    expect(thu.items.map(i => [i.key, i.kind_label])).toEqual([['off-thu-gitbroke', 'Explainer'], ['off-thu-agentnotsetup', 'Meme']])
    expect(thu.items.every(i => i.missed && i.path.map(s => s.key).join() === POST_PATH.map(s => s.key).join())).toBe(true)
    expect(thu.items[0].next).toMatchObject({ kind: 'press', op: 'live' })
    expect(thu.ideas).toBe(1)
    expect(v.model!.ideas.find(i => i.doc_id === 'off-thu-otherside')).toMatchObject({ why: 'open', kind: 'supporting', kind_label: "Carousel for Friday's piece" })
  })

  it('Sat 14: one good-news post with its stories in full, saying plainly how many of five it holds; the held five-story idea stays an idea', () => {
    const sat = dayOf(v, 'sat')
    expect(sat.items).toHaveLength(1)
    const gn = sat.items[0]
    expect(gn).toMatchObject({ key: 'off-sat-oldproof', kind: 'good_news', kind_label: 'Good news', stories_planned: GOOD_NEWS_STORIES })
    expect(gn.stories).toEqual([{ headline: 'AI found a mistake in a maths proof from 1986, its makers say.', what: expect.stringContaining('15,000-page'),
      why: 'AI is a great checker when something strict checks it.', date: null, source: 'Axiom, The enormous theorem formalized', href: 'https://axiommath.ai/research/the-enormous-theorem-formalized/' }])
    expect(gn.stories!.length).toBeLessThan(gn.stories_planned!)
    expect(gn.next).toMatchObject({ kind: 'run', job: 'saturday-goodnews', label: 'Find the other 4 stories', input: { week: WEEK, fill: 'off-sat-oldproof' } })
    const held = v.model!.ideas.find(i => i.doc_id === 'off-sat-goodnews')!
    expect(held.stories!.map(s => s.headline)).toHaveLength(5)
    expect(held.stories![0]).toMatchObject({ why: 'Why story 1 matters to people.', source: 'Source 1', date: '2026-11-07' })
    expect(sat.ideas).toBe(2)
  })

  it('the three pieces are on the piece path, mapped from the engine\'s own steps', () => {
    expect(PIECE_PATH.map(s => s.label)).toEqual(['Branded', 'Fleshed out', 'Production planned', 'Produced', 'Live'])
    const mon = dayOf(v, 'mon').items[0], fri = dayOf(v, 'fri').items[0]
    expect(mon).toMatchObject({ type: 'piece', stage: { key: 'live' }, next: null })
    expect(mon.path.every(s => s.state === 'done')).toBe(true)
    expect(fri).toMatchObject({ type: 'piece', key: `piece:${FRI}`, stage: { key: 'produced', label: 'Produced' }, missed: false })
    expect(fri.path.map(s => s.state)).toEqual(['done', 'done', 'done', 'done', 'current'])
    expect(fri.read).toMatchObject({ so_what: expect.stringContaining('Meta staff'), why_now: 'Reported 6 Nov 2026.', sources: [{ label: 'The report', href: 'https://example.org/meta' }] })
    // Friday's other Sunday idea is an idea, never on the day.
    expect(v.model!.ideas.find(i => i.piece_id === FRI_OTHER)).toMatchObject({ day: 'fri', kind: 'piece', why: 'open' })
  })

  it('every item has one next action: a press that does the thing, or the one Claude prompt that reports back to the board', () => {
    for (const it of v.model!.days.flatMap(d => d.items)) {
      if (it.stage.key === 'live') { expect(it.next).toBeNull(); continue }
      expect(it.next).toBeTruthy()
      if (it.next!.kind === 'prompt') { expect(it.next!.label).toBe(CLAUDE_LABEL); expect(it.next!.prompt).toMatch(/report_board_session|board_session\.py/) }
      expect(['look', 'review']).not.toContain(it.next!.kind)
    }
  })

  it('a decision on a day is only his: Approve for publish on a made piece, or an approved post\'s missing choice', () => {
    const i = thisWeek()
    i.picks = i.picks.filter(p => p.doc_id !== 'yes-fri-words')
    const w = buildView(i)
    const fri = dayOf(w, 'fri')
    expect(fri.decisions).toBe(1)
    expect(fri.items[0]).toMatchObject({ decision: true, next: { kind: 'press', label: expect.stringMatching(/^Yes, post it|^Approve/) } })
    expect(w.yours.map(y => y.day)).toEqual(['fri'])
    expect(w.model!.days.filter(d => d.day !== 'fri').every(d => d.decisions === 0)).toBe(true)
  })
})

describe('the off-day kinds', () => {
  it('one short list, one plain name each', () => {
    expect(OFFDAY_KINDS.map(k => k.label)).toEqual(['Supporting carousel', 'Voiceover short', 'Explainer', 'Good news', 'Meme'])
    expect(kindLabel('supporting', 'wed')).toBe("Carousel for Wednesday's piece")
  })
  it('a plan names it, or its words say it, by one rule', () => {
    const k = (o: Body) => offdayKind(o).kind
    expect(k({ kind: 'meme', format: 'Explainer carousel' })).toBe('meme')
    expect(k({ format: 'Uplifting explainer carousel, 4 cards' })).toBe('good_news')
    expect(k({ weekly: 'good_news', format: 'Uplifting AI news short, voiceover over real footage' })).toBe('good_news')
    expect(k({ format: 'Voiceover short with motion graphics, about 40 seconds' })).toBe('voiceover')
    expect(k({ kind: 'recorded', format: 'Said to camera' })).toBe('voiceover')
    expect(k({ format: 'Meme carousel, 3 cards', ties_to: 'Mon: follow.the.money' })).toBe('meme')
    expect(k({ format: 'Explainer carousel, infographic, 5 cards', ties_to: 'Wed: under.the.hood' })).toBe('explainer')
    expect(offdayKind({ format: 'Quiz carousel, 6 cards', ties_to: 'Wed: under.the.hood, if you pick it' })).toEqual({ kind: 'supporting', supports: 'wed' })
    expect(offdayKind({ kind: 'supporting', supports: 'friday' })).toEqual({ kind: 'supporting', supports: 'fri' })
    expect(k({ format: 'A single image' })).toBe('explainer')
  })
})
