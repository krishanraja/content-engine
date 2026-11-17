import { describe, expect, it } from 'vitest'
import { thisWeek } from './board-week-model.test'
import { buildView, scriptsStateOf, typedApproval, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { APPROVAL_WORDS, backBody, backDocId, hisOnlyRefusal, namesApproval, namesTakeBack, takenBackAt, validBody, wordsBody, wordsDocId } from '../../apps/control-plane/api/board/_contracts'
import { approval } from './_approvals'
import { offdayPieceId } from '../../apps/control-plane/api/board/_offdayPiece'

// Three rulings, 17 Nov, made system rules for every card on every day:
// - "I want the board in a state where I can see the script and edit it, and then press approve."
// - He gets a take-back press on any approval, and his typed words carried from a session can take one back too.
// - A typed approval carried from a session counts only when his words name it ("ready in teleprompter for me", carried
//   as an approval of Tue 17's voiceover script, was not one).

type Body = Record<string, any>
const W16 = '2026-11-16'
const TUE = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118'
const HABITS = '701a2c55-7400-4dc8-99cb-d6001147ae16'
const AT = '2026-11-17T11:09:12.000Z'
const said = (words: string, at = '2026-11-17T14:57:28.000Z') => ({ words, said_at: at, at, said_where: 'a Claude Code session', session_ref: 'https://claude.ai/code/session_x' })
const scriptsDoc = (piece: string, words: string, at?: string) => ({ doc_id: wordsDocId('tue', 'scripts', piece), updated_by: 'engine_operator', updated_at: at ?? '2026-11-17T14:57:28.000Z',
  body: { kind: 'approve_scripts', day: 'tue', via: 'words', approved: true, piece_id: piece, texts: { long: 'Long words.', short: 'Short words.' }, titles: { long: 'L', short: 'S' },
    folder_title: 'F', ...said(words, at), send: { at: AT, by: 'content-engine server', status: 'sent' } } })
const back = (piece: string, extra: Body = {}, by = 'Krish') => ({ doc_id: backDocId('tue', 'scripts', piece), updated_by: by,
  body: { kind: 'take_back', what: 'scripts', day: 'tue', piece_id: piece, approved: false, at: '2026-11-17T15:30:00.000Z', ...extra } })

describe('a typed approval counts only when his words name it', () => {
  it('names an approval: approve, approved, approval, sign, signed, and the board\'s own words', () => {
    for (const w of ['Approve both scripts', 'Approved.', 'signed', 'Signed, add in the impacts too', 'approve the lock for weds', 'approve_edited', 'Yes, I approve', 'Approval given'])
      expect(namesApproval(w), w).toBe(true)
  })
  it('can fail: words that do not name an approval are not one, the Tue 17 voiceover\'s included', () => {
    for (const w of ['merge all to main and then let me know when all done, ready in teleprompter for me', 'yes', 'looks good', 'go', 'disapproved? no', 'designed'])
      expect(namesApproval(w), w).toBe(w === 'disapproved? no' ? APPROVAL_WORDS.test(w) : false)
    expect(wordsBody(wordsDocId('tue', 'scripts', HABITS), scriptsDoc(HABITS, 'merge all to main and then let me know when all done, ready in teleprompter for me').body as never)).toBe(false)
    expect(validBody('picks', wordsDocId('tue', 'scripts', TUE), { ...scriptsDoc(TUE, 'ready in teleprompter for me').body, send: undefined })).toBe(false)
  })
  it('a lock may also be approved in words that say to lock it; scripts may not', () => {
    const lock = { kind: 'sign_lock', day: 'tue', via: 'words', approved: true, piece_id: TUE, lock_path: 'docs/plans/2026-11-16-week/narrative-lock-tue.md', lock_sha256: 'a'.repeat(64), ...said('Yes, lock it.') }
    expect(validBody('picks', wordsDocId('tue', 'lock', TUE), lock)).toBe(true)
    const { send: _s, ...scripts } = scriptsDoc(TUE, 'Yes, lock it.').body
    expect(validBody('picks', wordsDocId('tue', 'scripts', TUE), scripts)).toBe(false)
  })
})

describe('his take-back, by press or in his words', () => {
  it('his press is saved as his; a session carries only his words that name taking it back', () => {
    const press = back(TUE).body
    expect(validBody('picks', backDocId('tue', 'scripts', TUE), press)).toBe(true)
    expect(hisOnlyRefusal('picks', press, 'engine_operator')).toBe('take_back_is_his')
    expect(hisOnlyRefusal('picks', press, 'Krish')).toBeNull()
    const words = { ...press, via: 'words', ...said('You haven\'t done this. I want the board in a state where I can see the script and edit it, and then press approve.') }
    expect(namesTakeBack(words.words)).toBe(true)
    expect(validBody('picks', backDocId('tue', 'scripts', TUE), words)).toBe(true)
    expect(hisOnlyRefusal('picks', words, 'engine_operator')).toBeNull()
  })
  it('can fail: words that do not name taking it back, another piece\'s id, a yes, or the wrong document are refused', () => {
    const base = back(TUE).body
    expect(backBody(backDocId('tue', 'scripts', TUE), { ...base, via: 'words', ...said('looks good') })).toBe(false)
    expect(backBody(backDocId('tue', 'scripts', HABITS), base)).toBe(false)
    expect(backBody(backDocId('tue', 'scripts', TUE), { ...base, approved: true })).toBe(false)
    expect(backBody(backDocId('tue', 'lock', TUE), base)).toBe(false)
  })
  it('an approval made before it stops counting; a newer one counts again; a take-back nobody may write is ignored', () => {
    const before = scriptsDoc(TUE, 'Approve both scripts', '2026-11-17T14:57:28.000Z')
    expect(typedApproval([before], 'tue', 'scripts', TUE)).not.toBeNull()
    expect(takenBackAt([back(TUE)], 'scripts', TUE)).toBe(Date.parse('2026-11-17T15:30:00.000Z'))
    expect(typedApproval([before, back(TUE)], 'tue', 'scripts', TUE)).toBeNull()
    const after = scriptsDoc(TUE, 'Approve both scripts, edited', '2026-11-17T16:00:00.000Z')
    expect(typedApproval([after, back(TUE)], 'tue', 'scripts', TUE)?.words).toBe('Approve both scripts, edited')
    // A press-shaped take-back a session wrote is not his.
    expect(typedApproval([before, back(TUE, {}, 'engine_operator')], 'tue', 'scripts', TUE)).not.toBeNull()
    // His Approve scripts press, taken back the same way.
    const pressed = { doc_id: 'tue-scripts', updated_by: 'Krish', updated_at: '2026-11-17T14:00:00.000Z', body: { approved: true, piece_id: TUE } }
    expect(scriptsStateOf([pressed], 'tue', TUE).pressed).toBe(true)
    expect(scriptsStateOf([pressed, back(TUE)], 'tue', TUE).pressed).toBe(false)
  })
})

const PICKED = {
  look: { production: 'face-with-proof', experiment: null, inspiration: [], by: 'Krish', at: AT },
  style: { motion: 'eating-jobs-ladder', captions: 'art-directed', rejected: { motion: [], captions: [], treatment: [] }, by: 'Krish', at: AT },
}
const LOCK = `# Narrative lock: Tue 17\n\npiece_id: ${TUE}\nPublishes: 2026-11-17\n\nThe arc.\n\nSigned by Krish: "Signed.", 2026-11-17`
const mod = (id: string, name: string) => ({ id, name, how: `${name}.`, rules: [], point_types: ['claim'], formats: ['long_video', 'short_video'], fits: 'often', krish_verdict: '', ve_route: ['ve'] })
const filed = [{ cut: 'long', id: 'a', title: 'Long', text: 'Long words.', at: null }, { cut: 'short', id: 'b', title: 'Short', text: 'Short words.', at: null }]
function pieceWeek(picks: Body[]): ViewInputs {
  return {
    week: W16, now: new Date('2026-11-17T12:00:00Z'),
    pieces: [{ id: TUE, idea: 'OpenAI pledges to pay for data center power', thesis: 'x', scheduled_for: '2026-11-17', lane_slot: 'mind_the_gap', state: 'drafting', buried_at: null, body: '', updated_at: AT, meta: PICKED }],
    picks, queue: [], history: [], runs: {}, north_star: null, ideas: { days: {} }, locks: { tue: LOCK }, scripts: { [TUE]: filed },
    motion: [mod('eating-jobs-ladder', 'The unwanted neighbour')], formats: { production: [{ id: 'face-with-proof', name: 'Face with proof', pitch: 'x', status: 'live' }], script: [] },
    approvals: [approval(W16, 'tue', TUE)], items: [], all_items: [], plans: {},
  } as unknown as ViewInputs
}
const card = (i: ViewInputs) => buildView(i).model!.days.find(d => d.day === 'tue')!.items.find(x => x.piece_id === TUE)!

describe('the scripts are on every card, approved or not', () => {
  it('approved: Edit the scripts (the same review, ending in his Approve) and Take back my approval sit beside the card\'s action', () => {
    const it = card(pieceWeek([scriptsDoc(TUE, 'Approve both scripts')]))
    const edit = it.others.find((a: Body) => a.label === 'Edit the scripts') as Body
    expect(edit).toMatchObject({ kind: 'press', collection: 'picks', id: wordsDocId('tue', 'scripts', TUE), body: { kind: 'approve_scripts', piece_id: TUE } })
    expect(edit.scripts.cuts.map((c: Body) => c.text)).toEqual(['Long words.', 'Short words.'])
    expect(it.others.find((a: Body) => a.label === 'Take back my approval')).toMatchObject({ kind: 'press', collection: 'picks', id: backDocId('tue', 'scripts', TUE),
      body: { kind: 'take_back', what: 'scripts', day: 'tue', piece_id: TUE, approved: false }, stamp: ['at'] })
  })
  it('taken back: the card asks for his Approve again, with the scripts to read and edit', () => {
    const it = card(pieceWeek([scriptsDoc(TUE, 'Approve both scripts'), back(TUE)]))
    const all = [it.next, ...it.others] as Body[]
    expect(all.some(a => a?.label === 'Take back my approval')).toBe(false)
    expect(all.some(a => a?.kind === 'press' && a.scripts && /^Read and approve/.test(a.label))).toBe(true)
  })
})

describe('an off-day post he records shows its script on its card for his Approve (Tue 17\'s habits voiceover)', () => {
  function week(picks: Body[] = []) {
    const i = thisWeek()
    i.now = new Date('2026-11-09T09:00:00Z')
    const opt = ((i.ideas!.offdays as Body).tue as Body[]).find(o => o.id === 'mcpskin')!
    opt.piece_id = HABITS
    i.pieces = [...i.pieces, { id: HABITS, idea: 'Habits that cost your job', scheduled_for: null, state: 'seeded', buried_at: null, body: '', updated_at: AT,
      meta: { offday_link: { week: '2026-11-09', day: 'tue', item: 'off-tue-mcpskin' } } }] as never
    ;(i as Body).scripts = { [HABITS]: [{ cut: 'short', id: 'eb036615', title: '90-second cut script, Tue 17 voiceover (for your Approve)', text: 'You can\'t sack an AI.', at: '2026-11-17T16:00:00Z' }] }
    i.picks = [...i.picks, ...picks] as never
    return buildView(i).model!.days.find(d => d.day === 'tue')!.items.find(x => x.key === 'off-tue-mcpskin')!
  }
  it('filed and not approved: the next action is his Approve, the script on the card to read and edit', () => {
    const it = week()
    expect(it.decision).toBe(true)
    expect(it.next).toMatchObject({ kind: 'press', label: 'Read and approve the script', id: wordsDocId('tue', 'scripts', HABITS), body: { piece_id: HABITS } })
    expect((it.next as Body).scripts.cuts[0].text).toBe('You can\'t sack an AI.')
    // Built by the off-day card's own scripts section (#804, scriptsReady); scriptsOnCard leaves a card that offers it.
    expect(it.line).toMatch(/The script is ready for your Approve: 90-second cut script, Tue 17 voiceover \(for your Approve\)\.$/)
    expect(it.others.some((a: Body) => a.kind === 'prompt')).toBe(true)
  })
  it('the real Tue 17 document does not count, so his Approve is still asked; one in his approval words moves the card on', () => {
    const real = week([{ doc_id: 'tue-scripts-words', updated_by: 'engine_operator', body: { ...scriptsDoc(HABITS, 'merge all to main and then let me know when all done, ready in teleprompter for me').body, texts: { short: 'You can\'t sack an AI.' }, titles: { short: 'S' } } }])
    expect(real.next).toMatchObject({ label: 'Read and approve the script' })
    const approved = week([{ ...scriptsDoc(HABITS, 'Approve the script'), body: { ...scriptsDoc(HABITS, 'Approve the script').body, texts: { short: 'You can\'t sack an AI.' }, titles: { short: 'S' } } }])
    expect(approved.next).toMatchObject({ op: 'takes-in' })
    expect(approved.others.map((a: Body) => a.label)).toEqual(expect.arrayContaining(['Edit the script', 'Take back my approval']))
  })
})

describe('every off-day kind with copy on its record keeps Edit and Take back once approved (Krish, 2026-11-17: "there is copy on every single post")', () => {
  it('an approved meme offers Edit the script and Take back my approval; with no record, nothing is added', () => {
    const build = (withRecord: boolean) => {
      const i = thisWeek()
      i.now = new Date('2026-11-09T09:00:00Z')
      const id = offdayPieceId('2026-11-09', 'off-tue-homework', {})
      if (withRecord) i.pieces = [...i.pieces, { id, idea: 'One AI does the homework', scheduled_for: null, state: 'seeded', buried_at: null, body: '', updated_at: AT,
        meta: { offday_link: { week: '2026-11-09', day: 'tue', item: 'off-tue-homework' } } }] as never
      ;(i as Body).scripts = { [id]: [{ cut: 'short', id: 'm1', title: 'Meme copy, short cut', text: 'One AI does the homework, another marks it.', at: '2026-11-08T10:00:00Z' }] }
      i.picks = [...i.picks, { doc_id: wordsDocId('tue', 'scripts', id), updated_by: 'Krish', updated_at: '2026-11-08T11:00:00Z',
        body: { kind: 'approve_scripts', day: 'tue', via: 'words', approved: true, piece_id: id, texts: { short: 'One AI does the homework, another marks it.' }, titles: { short: 'S' },
          folder_title: 'F', ...said('approve', '2026-11-08T11:00:00.000Z') } }] as never
      return buildView(i).model!.days.find(d => d.day === 'tue')!.items.find(x => x.key === 'off-tue-homework')!
    }
    const meme = build(true)
    expect(meme.others.map((a: Body) => a.label)).toEqual(expect.arrayContaining(['Edit the script', 'Take back my approval']))
    // Only scripts he records go to his Teleprompter (Ruling, Krish, 2026-11-17: "only scripts i record go to
    // teleprompter"): a meme's copy is approved and kept, and its press says it never goes there.
    const edit = meme.others.find((a: Body) => a.label === 'Edit the script') as Body
    expect(edit.body).toMatchObject({ teleprompter: false })
    expect(String(edit.goes)).toMatch(/never goes to your Teleprompter/)
    expect(String(edit.scripts.edited_note)).toMatch(/never goes to your Teleprompter/)
    // can fail: no record, so no copy on file to show
    expect(build(false).others.some((a: Body) => a.label === 'Take back my approval')).toBe(false)
  })
})
