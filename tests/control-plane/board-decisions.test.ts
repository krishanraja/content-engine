import { describe, expect, it } from 'vitest'
import { buildView, readPieceDecisions, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { DECISIONS_RULE, nextStep, pieceDecisions, scriptsChanged, spokenTitle } from '../../apps/control-plane/api/board/_decisions'
import { createStoreHandler } from '../../apps/control-plane/api/content-ideas/store'
import { approval } from './_approvals'

// F46-asked-for-a-press-already-made (config/failures.json). Tue 17 Nov 2026, piece b019dbf8, the data-centres piece
// placed on Tuesday: at 11:09 UTC Krish pressed Pick the look, Pick the motion style and Pick the captions on the board
// (meta.look and meta.style, by Krish). The board's prompt he then pasted said "step look", and get_piece_board carried
// none of his picks, so at 11:13 the session asked him to press all three again. His words: "I already did that in the
// UI, before I pasted my last prompt to you. Why are you asking me to go back and repeat this?"

type Body = Record<string, any>
const W16 = '2026-11-16'
const TUE = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118'
const AT = '2026-11-17T11:09:12.000Z'
const LOCK = `# Narrative lock: Tue 17\n\npiece_id: ${TUE}\nPublishes: 2026-11-17\n\nThe arc.\n\nSigned by Krish: "Signed.", 2026-11-17`
const PICKED = {
  look: { production: 'face-with-proof', experiment: null, inspiration: [], by: 'Krish', at: AT },
  style: { motion: 'eating-jobs-ladder', captions: 'art-directed', rejected: { motion: [], captions: [], treatment: [] }, by: 'Krish', at: AT },
}
const mod = (id: string, name: string) => ({ id, name, how: `${name}.`, rules: [], point_types: ['claim'], formats: ['long_video', 'short_video'], fits: 'often', krish_verdict: '', ve_route: ['ve'] })
const looks = [{ id: 'face-with-proof', name: 'Face with proof', pitch: 'x', status: 'live' }]

function inputs(meta: Body = {}, picks: Body[] = []): ViewInputs {
  return {
    week: W16, now: new Date('2026-11-17T11:10:00Z'),
    pieces: [{ id: TUE, idea: 'OpenAI pledges to pay for data center power', thesis: 'x', scheduled_for: '2026-11-17', lane_slot: 'mind_the_gap',
      state: 'drafting', buried_at: null, body: '', updated_at: AT, meta }],
    picks, queue: [], history: [], runs: {}, north_star: null, ideas: { days: {} }, locks: { tue: LOCK },
    motion: [mod('eating-jobs-ladder', 'The unwanted neighbour'), mod('swiss-kinetic-type', 'Swiss grid')], formats: { production: looks, script: [] },
    approvals: [approval(W16, 'tue', TUE)], items: [], all_items: [], plans: {},
  } as unknown as ViewInputs
}
const item = (v: ReturnType<typeof buildView>) => v.model!.days.find(d => d.day === 'tue')!.items.find(x => x.piece_id === TUE)!
const prompts = (it: ReturnType<typeof item>) => [it.next, ...it.others].filter((a: any) => a?.kind === 'prompt' && /Claude/.test(a.label)).map((a: any) => String(a.prompt))

describe('F46: a board prompt never asks Krish for a decision he has already made', () => {
  it('17 Nov reproduced: look, motion and captions picked by Krish, so the prompt\'s step is not look and it names his picks', () => {
    const it = item(buildView(inputs(PICKED)))
    const all = prompts(it)
    expect(all.length).toBeGreaterThan(0)
    for (const p of all) {
      expect(p).not.toMatch(/step look\)/)
      expect(p).toMatch(/step board\)/)
      expect(p).toContain(`- Look: done, face-with-proof, by Krish at ${AT} (his press on the board)`)
      expect(p).toContain(`- Motion style: done, eating-jobs-ladder, by Krish at ${AT}`)
      expect(p).toContain(`- Captions: done, art-directed, by Krish at ${AT}`)
      expect(p).toContain('- Narrative lock signed: done')
      expect(p).toContain('- Scripts approved: not made yet')
      expect(p).toContain(DECISIONS_RULE)
    }
    expect(it.line).toBe('Branded: its narrative lock is signed for Tue 17. Your production picks are in. Next: the storyboard and both scripts, for your Approve.')
    expect(it.stage.key).toBe('fleshed_out')
  })
  it('before his picks the step is still look, and the prompt says the three are not made', () => {
    const p = prompts(item(buildView(inputs())))
    expect(p[0]).toMatch(/step look\)/)
    expect(p[0]).toContain('- Look: not made yet')
  })
  it('his scripts approved too: the step is record', () => {
    const scripts = { doc_id: 'tue-scripts', updated_by: 'Krish', updated_at: '2026-11-17T12:00:00Z', body: { approved: true, piece_id: TUE } }
    const it = item(buildView(inputs(PICKED, [scripts])))
    expect(prompts(it)[0]).toMatch(/step record\)/)
    expect(prompts(it)[0]).toContain('- Scripts approved: done, approved, by Krish at 2026-11-17T12:00:00Z')
  })
  it('a decision that could not be read is unknown, never "not made", and leaves no step to act on', () => {
    const d = pieceDecisions({ meta: PICKED, lock: undefined, scripts: undefined })
    expect(d.items.find(x => x.key === 'lock')!.made).toBeNull()
    expect(d.next_step).toBeNull()
    expect(nextStep(pieceDecisions({ meta: {}, lock: { signed: true, on: null, typed: null }, scripts: undefined }).items)).toBe('look')
  })
})

describe('F46: the piece\'s own read (get_piece_board) carries his decisions', () => {
  // A small stand-in for the database: the piece row, the week's presses and the overlay the listing reads.
  const db = (meta: Body, picks: Body[] = []) => {
    const rows: Record<string, Body[]> = {
      content_ideas: [{ id: TUE, idea: 'Data centres', scheduled_for: '2026-11-17', lane_slot: 'mind_the_gap', meta }],
      board_documents: picks.map(p => ({ ...p, week: W16, collection: 'picks' })),
    }
    const query = (table: string) => {
      const filters: Array<[string, unknown]> = []
      const run = () => ({ data: (rows[table] || []).filter(r => filters.every(([k, v]) => r[k] === v)), error: null })
      const q: Body = {
        select: () => q, eq: (k: string, v: unknown) => { filters.push([k, v]); return q },
        maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
        then: (ok: (r: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
      }
      return q
    }
    return { from: query, rpc: async () => ({ data: { as_of: AT, materials: [], sessions: [], fields: [], events: [] }, error: null }) }
  }
  const github = async (url: string) => (/narrative-lock-tue\.md$/.test(url) ? new Response(LOCK, { status: 200 })
    : /api\.github\.com/.test(url) ? new Response('{}', { status: 404 }) : new Response('', { status: 404 }))

  it('readPieceDecisions: his three picks, the signed lock and the step they leave, each with who and when', async () => {
    const d = await readPieceDecisions(db(PICKED) as never, TUE, {}, github as never)
    expect(d).toMatchObject({ week: W16, day: 'tue', next_step: 'board', rule: DECISIONS_RULE })
    expect(d!.items.map(x => [x.key, x.made, x.value, x.by, x.at])).toEqual([
      ['lock', true, 'signed', 'Krish', '2026-11-17'],
      ['look', true, 'face-with-proof', 'Krish', AT],
      ['motion', true, 'eating-jobs-ladder', 'Krish', AT],
      ['captions', true, 'art-directed', 'Krish', AT],
      ['scripts', false, null, null, null],
    ])
  })
  it('GitHub unreachable: the lock is unknown, the step is unknown, the picks still show', async () => {
    const d = await readPieceDecisions(db(PICKED) as never, TUE, {}, (async () => { throw new Error('offline') }) as never)
    expect(d!.items.find(x => x.key === 'lock')!.made).toBeNull()
    expect(d!.items.find(x => x.key === 'look')!.made).toBe(true)
    expect(d!.next_step).toBeNull()
  })
  it('GET /api/content-ideas/store?piece=<id> returns them as decisions; a failed read says unread, never not made', async () => {
    const call = async (decide: Parameters<typeof createStoreHandler>[3]) => {
      const handler = createStoreHandler(async () => db(PICKED) as never, undefined, undefined, decide)
      let status = 0, body: Body = {}
      const res: Body = { setHeader: () => res, status: (s: number) => { status = s; return res }, json: (b: Body) => { body = b; return res }, redirect: () => res }
      await handler({ method: 'GET', query: { piece: TUE }, headers: { authorization: 'Bearer k' } } as never, res as never)
      return { status, body }
    }
    process.env.ENGINE_OPERATOR_TOKEN = 'k'
    const ok = await call(async (d, id) => readPieceDecisions(d as never, id, {}, github as never) as never)
    expect(ok.status).toBe(200)
    expect(ok.body.decisions.next_step).toBe('board')
    expect(ok.body.decisions.items.find((x: Body) => x.key === 'look')).toMatchObject({ made: true, value: 'face-with-proof', by: 'Krish', at: AT })
    const failed = await call(async () => { throw new Error('down') })
    expect(failed.body.decisions).toEqual({ unread: true, rule: DECISIONS_RULE })
  })
})

// F47-card-never-moved-on (config/failures.json). Tue 17 Nov, about 11:35 UTC, after the script session filed both scripts
// for his Approve: the card still showed Fleshed out current, "Its make picks up from where it is", the idea row's old
// summary, and no way to approve the scripts. Krish: "Why does this never actually update the board and move to
// Production Planned? This should happen automatically when sessions like this get to this point."
describe('F47: the card moves on when a session reaches a milestone, and offers his next press', () => {
  const LOCK17 = `# Narrative lock: Tue 17\n\npiece_id: ${TUE}\nPublishes: 2026-11-17\n\n## Surface story\nAmerica has a new least-wanted neighbour.\n\n## Deeper story\nThe midterms turned AI into a vote about the electricity bill.\n\n## Arc\n- Hook.\n\nSigned by Krish: "Signed.", 2026-11-17`
  const filed = [
    { cut: 'long' as const, id: '6503bef2-62ac-4192-83a5-f1607d9d3f30', title: 'Tue 17 script, 5-minute cut, redrafted 17 Nov to the signed lock (for your Approve)', text: 'America has a new neighbour nobody wants.', at: '2026-11-17T11:30:14Z' },
    { cut: 'short' as const, id: '81ff7074-8a15-43c1-b78c-793ca9b2bfcd', title: 'Tue 17 script, short cut (about 30 s), redrafted 17 Nov to the signed lock (for your Approve)', text: 'Forty towns said no.', at: '2026-11-17T11:30:17Z' },
  ]
  const at17 = (extra: Body = {}) => ({ ...inputs(PICKED), locks: { tue: LOCK17 }, pieces: [{ ...inputs(PICKED).pieces[0], thesis: 'OpenAI pledged to solicit community input.' }], ...extra }) as ViewInputs

  it('17 Nov reproduced: look picked and both scripts filed, so the card is past Fleshed out, says the scripts are ready and offers Approve scripts', () => {
    const it = item(buildView(at17({ scripts: { [TUE]: filed } })))
    expect(it.path.map(s => s.state)).toEqual(['done', 'done', 'current', 'todo', 'todo'])
    expect(it.line).toMatch(/^Branded for Tue 17\. Your production picks are in\. Both scripts are ready for your Approve: Tue 17 script, 5-minute cut/)
    expect(it.decision).toBe(true)
    expect(it.next).toMatchObject({ kind: 'press', label: 'Read and approve the scripts', collection: 'picks', id: 'tue-scripts-words-b019dbf8',
      body: { kind: 'approve_scripts', day: 'tue', via: 'words', approved: true, piece_id: TUE, texts: { long: filed[0].text, short: filed[1].text } },
      words: { path: 'words', required: true } })
    // What it says is the signed lock, never the idea row it started from.
    expect(it.read.so_what).toBe('The midterms turned AI into a vote about the electricity bill.')
    expect(it.read.story).toBe('America has a new least-wanted neighbour.')
    // The scripts are read in the review the press opens, never as links to raw text (Krish, 17 Nov: "the scripts are
    // shitty links to awful looking text").
    expect(it.read.research).not.toEqual(expect.arrayContaining([filed[0].title]))
    expect((it.next as any).scripts).toMatchObject({ path: 'texts', approve: 'Approve both scripts', approve_edited: 'Approve both scripts, with my edits',
      cuts: [{ cut: 'long', label: 'Long cut', text: filed[0].text, words: 7, material_id: filed[0].id }, { cut: 'short', label: 'Short cut', text: filed[1].text, words: 4 }] })
  })
  it('his press, as the board saves it, is a body the engine accepts; only his words approve', async () => {
    const { validBody } = await import('../../apps/control-plane/api/board/_contracts')
    const press = item(buildView(at17({ scripts: { [TUE]: filed } }))).next as any
    const saved = { ...press.body, words: 'Approved.', at: '2026-11-17T12:00:00Z', said_at: '2026-11-17T12:00:00Z' }
    expect(validBody('picks', press.id, saved)).toBe(true)
    expect(validBody('picks', press.id, { ...saved, words: '' })).toBe(false)
    // His edits, approved with the review's own words, are a body the engine accepts too.
    const edited = { ...saved, words: press.scripts.approve_edited, texts: { ...press.body.texts, long: `${press.body.texts.long} Mate, it's a hum.` } }
    expect(validBody('picks', press.id, edited)).toBe(true)
  })
  it('a lock he signed in his words on the board gives the card its words too, not the idea row\'s', () => {
    const unsigned = LOCK17.replace(/\n\nSigned by Krish:.*$/, '')
    const base = at17({ locks: { tue: unsigned }, scripts: { [TUE]: filed } })
    const sha = (item(buildView(base)).next as any).body.lock_sha256
    const words = { doc_id: 'tue-lock-words', updated_by: 'Krish', revision: 1, body: { kind: 'sign_lock', day: 'tue', via: 'words', approved: true, piece_id: TUE,
      lock_path: 'docs/plans/2026-11-16-week/narrative-lock-tue.md', lock_sha256: sha, words: 'Signed.', at: '2026-11-17T11:05:00Z', said_at: '2026-11-17T11:05:00Z',
      said_where: 'the Publish Board in Control Centre', session_ref: 'https://controlcenter.krishraja.com/#/content?week=2026-11-16&day=tue' } }
    const it = item(buildView({ ...base, picks: [words] } as ViewInputs))
    expect(it.read.so_what).toBe('The midterms turned AI into a vote about the electricity bill.')
    expect(it.next).toMatchObject({ label: 'Read and approve the scripts' })
  })
  it('after his approval the card is at Production planned and asks him to record', () => {
    // His approval carries the words filed: an approval counts only for the words it approved (Krish, 17 Nov).
    const words = { doc_id: 'tue-scripts-words', updated_by: 'Krish', body: { kind: 'approve_scripts', day: 'tue', via: 'words', approved: true, piece_id: TUE,
      texts: { long: filed[0].text, short: filed[1].text }, titles: { long: 'a', short: 'b' }, folder_title: 'x', words: 'Approved.', at: '2026-11-17T12:00:00Z',
      said_at: '2026-11-17T12:00:00Z', said_where: 'the Publish Board in Control Centre', session_ref: 'https://controlcenter.krishraja.com/#/content?week=2026-11-16&day=tue' } }
    const it = item(buildView(at17({ scripts: { [TUE]: filed }, picks: [words] })))
    expect(it.path.map(s => s.state)).toEqual(['done', 'done', 'done', 'current', 'todo'])
    expect(it.next).not.toMatchObject({ label: 'Read and approve the scripts' })
    // Approved: the card waits on his My takes are in the Inbox (Krish, 2026-11-17: "whenever I press approve script, the
    // new board state should be waiting for me to confirm the videos are in the Inbox").
    expect(it.line).toMatch(/^Your scripts are approved\. Record both cuts from your Teleprompter, drop the takes in the Video Engine Inbox, then press My takes are in the Inbox\.$/)
    expect(it.next).toMatchObject({ kind: 'press', op: 'takes-in', label: 'My takes are in the Inbox', body: { piece_id: TUE } })
    expect(it.decision).toBe(true)
  })
  it('no scripts filed yet: past Fleshed out, and the card says the scripts are next, with no press to approve', () => {
    const it = item(buildView(at17()))
    expect(it.path.map(s => s.state)).toEqual(['done', 'done', 'current', 'todo', 'todo'])
    expect(it.next).not.toMatchObject({ label: 'Read and approve the scripts' })
    expect(it.line).toMatch(/Next: the storyboard and both scripts/)
  })
})

// F49-approve-held-his-own-edits (config/failures.json). Tue 17 Nov 2026, 16:20 UTC, piece b019dbf8: Krish edited both
// scripts in the review and pressed "Approve both scripts, with my edits". The board saved his words (revision 5), the
// server held the send because his edited words had no scripts' check (revision 6), and the card still offered the old
// filed words under "Read and approve the scripts". His words: "pressed approve, and it just deleted all my edits, and
// the board looks like i never did anything. The title of this article also now doesnt make sense given my new scripts";
// then "you need to fix every instance of this workflow everywhere - I need to see the board state change and my edits
// get saved, and the approve scripts button auto sends to teleprompter" (Ruling, Krish, 2026-11-17).
describe('F49: his Approve scripts with his own edits moves the card on, keeps his words and sends them', () => {
  const LOCK17 = `# Narrative lock: Tue 17\n\npiece_id: ${TUE}\nPublishes: 2026-11-17\n\n## Surface story\nTowns say no.\n\n## Deeper story\nThe bill.\n\nSigned by Krish: "Signed.", 2026-11-17`
  const filed = [
    { cut: 'long' as const, id: '6503bef2-62ac-4192-83a5-f1607d9d3f30', title: 'Tue 17 script, 5-minute cut (for your Approve)', text: 'America has a new neighbour nobody wants.', at: '2026-11-17T11:30:14Z' },
    { cut: 'short' as const, id: '81ff7074-8a15-43c1-b78c-793ca9b2bfcd', title: 'Tue 17 script, short cut (for your Approve)', text: 'Forty towns said no.', at: '2026-11-17T11:30:17Z' },
  ]
  const EDITED = {
    long: 'This month, a little town in Ohio called Piqua just got rid of its mayor for approving a Meta data centre. So if you pay for AI at work, could the midterm results in America push up your bill? And where does AI get built when towns say no to the big data centers? Let\'s find out.\n\nSo I\'ve been digging.',
    short: 'A tiny town in Ohio just fired its mayor because he green lit a data centre for Meta. Sacked, over a building. So what just happened to AI with the midterms in America and where does AI get built when towns say no? Let\'s find out.\n\nMeta wanted a giant data centre.',
  }
  const pressAt = '2026-11-17T16:20:16.888Z'
  const his = (send: Body | null) => ({ doc_id: 'tue-scripts-words-b019dbf8', updated_by: 'Krish', updated_at: '2026-11-17T16:20:17.528Z', revision: 6, body: {
    kind: 'approve_scripts', day: 'tue', via: 'words', approved: true, piece_id: TUE, texts: EDITED,
    titles: { long: 'OpenAI pledges to pay for data center power after election highlights AI concerns: long cut', short: 'OpenAI pledges to pay for data center power after election highlights AI concerns: short cut' },
    folder_title: 'OpenAI pledges to pay for data center power after election highlights AI concerns', words: 'Approve both scripts, with my edits',
    at: pressAt, said_at: pressAt, said_where: 'the Publish Board in Control Centre', session_ref: 'https://controlcenter.krishraja.com/#/content?week=2026-11-16&day=tue',
    ...(send ? { send } : {}) } })
  const at17 = (picks: Body[], more: Body[] = filed) => ({ ...inputs(PICKED), now: new Date('2026-11-17T16:21:00Z'), locks: { tue: LOCK17 }, scripts: { [TUE]: more }, picks }) as ViewInputs

  it('16:20 reproduced: his edited words count as approved, the card is at Production planned and says it was sent, and the old press is gone', () => {
    const sent = { status: 'sent', at: '2026-11-17T16:20:17.095Z', by: 'content-engine server', folder_id: 'A08795EC', recorded: true,
      checks: 'sent on his own press; still to run after it: these words have not passed the scripts\' check' }
    const it = item(buildView(at17([his(sent)])))
    expect(it.path.map(s => s.state)).toEqual(['done', 'done', 'done', 'current', 'todo'])
    expect(it.next).not.toMatchObject({ label: 'Read and approve the scripts' })
    expect(it.line).toBe('Scripts approved Tue 17 Nov, sent to your Teleprompter at 16:20 UTC. The checks on your words run next and report to you; they never hold or change them. '
      + 'Record both cuts from your Teleprompter, drop the takes in the Video Engine Inbox, then press My takes are in the Inbox.')
    expect(it.next).toMatchObject({ kind: 'press', op: 'takes-in' })
    // The working title is the one his scripts speak, not the idea's headline.
    expect(it.title).toBe('Where does AI get built when towns say no?')
    // The post-production prompt carries his edited words, never the older filed ones, and the checks still to run come
    // first in the next session's prompt, so the card's promise is kept.
    const all = prompts(it).join('\n')
    expect(all).not.toContain('America has a new neighbour nobody wants.')
    expect(all).toMatch(/First, before the recording step: his own Approve scripts press \(Tue 17 Nov\) sent his exact words/)
    expect(all).toMatch(/Never rewrite or resend his words, and never ask him to press Approve again\. Still to run: sent on his own press/)
  })
  it('the working title goes back to his own once he picks titles, and a phone\'s clock never decides which came first', () => {
    const sent = { status: 'sent', at: '2026-11-17T16:20:17.095Z', by: 'content-engine server', folder_id: 'A08795EC', recorded: true }
    const titled = { doc_id: 'tue-titles', updated_by: 'Krish', body: { kind: 'titles', day: 'tue', piece_id: TUE, at: '2026-11-18T09:00:00Z' } }
    expect(item(buildView(at17([his(sent), titled]))).title).toBe('OpenAI pledges to pay for data center power')
    // His device stamped 16:10 but the server wrote it at 16:20:17; a script filed at 16:15 is older than his press.
    const slow = his(sent); slow.body.said_at = '2026-11-17T16:10:00.000Z'; slow.body.at = slow.body.said_at
    const before = [{ ...filed[0], at: '2026-11-17T16:15:00Z' }, filed[1]]
    expect(item(buildView(at17([slow], before))).next).not.toMatchObject({ label: 'Read and approve the scripts' })
  })
  it('the server\'s old hold never sends the card back to Read and approve: his approval counts and the card says why it is not in Teleprompter', () => {
    const held = { status: 'held', at: '2026-11-17T16:20:17.095Z', by: 'content-engine server', error: 'these words have not passed the scripts\' check, so nothing was sent' }
    const it = item(buildView(at17([his(held)])))
    expect(it.next).not.toMatchObject({ label: 'Read and approve the scripts' })
    expect(it.line).toMatch(/^You approved the scripts on Tue 17 Nov, and your approval counts\. They are not in your Teleprompter yet: the send was held \(these words have not passed the scripts' check, so nothing was sent\)/)
    expect(it.path.map(s => s.state)).toEqual(['done', 'done', 'done', 'current', 'todo'])
  })
  it('only a script filed after his approval makes it stale, and then the review offers the new words with their own spoken title', () => {
    const later = [{ ...filed[0], text: 'Rewritten after he approved. Where do the servers go when a town votes no? Let\'s find out.\n\nMore.', at: '2026-11-17T17:00:00Z' }, filed[1]]
    const it = item(buildView(at17([his(null)], later)))
    expect(it.next).toMatchObject({ label: 'Read and approve the scripts' })
    expect(it.line).toMatch(/Rewritten since you approved them/)
    const press = it.next as any
    // The Teleprompter folder keeps the piece's own title, so a send never makes a second folder.
    expect(press.body.folder_title).toBe('OpenAI pledges to pay for data center power')
    expect(press.goes).toMatch(/sends them to your Teleprompter now\.$/)
    expect(press.scripts.edited_note).toMatch(/Approve sends them to your Teleprompter straight away/)
  })
})

describe('F49 review: the spoken title and the staleness rule hold on awkward scripts', () => {
  it('spokenTitle keeps decimals and initials whole, skips stock teasers, labels and directions, and needs a full question', () => {
    const t = (long: string) => spokenTitle({ long })
    expect(t('OpenAI made a pledge. Why would it pay $2.5 billion for power? Let\'s find out.')).toBe('Why would it pay $2.5 billion for power?')
    expect(t('Towns are angry. Can the U.S. build data centers fast enough? Let\'s see.')).toBe('Can the U.S. build data centers fast enough?')
    expect(t('Data centres are everywhere now. Want to know why?')).toBeNull()
    expect(t('[Krish to camera] Is your job the next one AI takes over?')).toBe('Is your job the next one AI takes over?')
    expect(t('**HOOK**\n\nWho pays when the power bill doubles for everyone?')).toBe('Who pays when the power bill doubles for everyone?')
    expect(t('She asked me, "Who pays for all of this power?"')).toBe('She asked me, Who pays for all of this power?')
    expect(t('No question in this opening at all.')).toBeNull()
  })
  it('a filed script whose time cannot be read counts as filed after his approval, so unknown never counts as approved', () => {
    const f = [{ cut: 'long' as const, id: 'x', title: 't', text: 'B', at: null }]
    expect(scriptsChanged({ long: 'A' }, f, '2026-11-17T16:20:00Z')).toEqual(['long'])
    expect(scriptsChanged({ long: 'A' }, [{ ...f[0], at: '2026-11-17T11:30:00Z' }], '2026-11-17T16:20:00Z')).toEqual([])
    expect(scriptsChanged({ long: 'A' }, [{ ...f[0], at: '2026-11-17T17:00:00Z' }], '2026-11-17T16:20:00Z')).toEqual(['long'])
  })
})
