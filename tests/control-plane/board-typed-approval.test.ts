import { describe, expect, it } from 'vitest'
import { buildView, lockBodyHash, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { hisOnlyRefusal, validBody } from '../../apps/control-plane/api/board/_contracts'
import { afterPress, preparePress } from '../../apps/control-plane/api/board/_presses'
import { optionSha } from '../../apps/control-plane/api/board/_gate'
import { scriptHash, typedApproval } from '../../apps/control-plane/api/_teleprompter'
import { approval } from './_approvals'

// Typed approval (Ruling, Krish, 2026-11-12: "Scripts and locks only. Typed approval counts for locking a story and
// approving a script; putting an idea on the publish board still needs your press, so that gate is unchanged."). A
// session carries his exact typed words for a narrative lock (picks/<day>-lock-words) or a piece's scripts
// (picks/<day>-scripts-words); the board shows each as "Approved in your words", the scripts go to his Teleprompter as
// the Approve scripts press sends them, and nothing a session writes puts an idea on the board.

type Body = Record<string, any>
const WEEK = '2026-11-16'
const MON = '8287846b-6618-4a19-9fb8-23ad4eca2718', WED = 'db9f9f6a-1092-49be-8024-f335e060305a'
const OPERATOR = 'engine_operator'
const LOCK = ['# Narrative lock, Monday', `piece_id: ${MON}`, '## Surface story', 'Oracle borrows to build.', '## Deeper story', 'Who carries the debt.'].join('\n')
const LOCK_PATH = `docs/plans/${WEEK}-week/narrative-lock-mon.md`
const SAID = { words: 'Yes, lock it. That is the story.', said_at: '2026-11-13T09:10:00Z', said_where: 'Claude Code session in krishanraja/content-engine',
  session_ref: 'https://claude.ai/code/session_x' }
const LONG = 'Oracle just borrowed another twenty billion dollars to build for AI.'
const lockDoc = (over: Body = {}): Body => ({ kind: 'sign_lock', day: 'mon', via: 'words', approved: true, piece_id: MON, lock_path: LOCK_PATH,
  lock_sha256: lockBodyHash(LOCK), at: '2026-11-13T09:11:00Z', ...SAID, ...over })
const scriptsDoc = (over: Body = {}): Body => ({ kind: 'approve_scripts', day: 'mon', via: 'words', approved: true, piece_id: MON,
  texts: { long: LONG }, titles: { long: 'Mon 16 Nov - 5-minute - Oracle borrows to build' }, folder_title: 'Mon 16 Nov follow.the.money - Oracle borrows to build',
  at: '2026-11-13T09:12:00Z', ...SAID, words: 'Approve the script, send it to the teleprompter.', ...over })

describe('what a typed approval carries', () => {
  it('his words verbatim, when and where he typed them, the session, and what he approved', () => {
    expect(validBody('picks', 'mon-lock-words', lockDoc())).toBe(true)
    expect(validBody('picks', 'mon-scripts-words', scriptsDoc())).toBe(true)
    for (const bad of [{ words: '' }, { said_at: 'this morning' }, { said_where: '' }, { session_ref: 'http://x' }, { approved: false },
      { day: 'wed' }, { lock_sha256: 'abc' }, { lock_path: `docs/plans/${WEEK}-week/narrative-lock-wed.md` }, { send: {} }])
      expect(validBody('picks', 'mon-lock-words', lockDoc(bad)), JSON.stringify(bad)).toBe(false)
    expect(validBody('picks', 'mon-scripts-words', scriptsDoc({ texts: {} }))).toBe(false)
    expect(validBody('picks', 'mon-scripts-words', lockDoc())).toBe(false)
    // Only these two: no typed approval on an off day, on titles, on a cut or on publish.
    for (const id of ['tue-lock-words', 'mon-titles-words', 'mon-publish-words']) expect(validBody('picks', id, lockDoc()), id).toBe(false)
  })
  it('"via: words" on any other document is refused, so a session\'s words never stand as one of his presses', () => {
    expect(validBody('picks', 'mon-scripts', scriptsDoc())).toBe(false)
    expect(validBody('picks', 'mon', { day: 'mon', pick: 'Oracle', story: 'Headline', via: 'words', approved: true })).toBe(false)
  })
})

describe('who may write it', () => {
  it('the engine may carry his typed approval of a lock or of scripts, only as a yes', () => {
    expect(hisOnlyRefusal('picks', lockDoc(), OPERATOR)).toBe(null)
    expect(hisOnlyRefusal('picks', scriptsDoc(), OPERATOR)).toBe(null)
    expect(hisOnlyRefusal('picks', scriptsDoc({ approved: false }), OPERATOR)).toBe('typed_approval_is_a_yes')
    // The Approve scripts press itself, and every other decision, stay his.
    const { via, words, said_at, said_where, session_ref, ...press } = scriptsDoc()
    expect(hisOnlyRefusal('picks', press, OPERATOR)).toBe('decision_is_his')
  })
  it('a typed approval can never put an idea on the publish board: the ideas gate stays his press alone', () => {
    // His Approve on an idea (picks/<day>) and his answers on the ideas board (queue) are refused from a session,
    // whatever words it carries.
    const pick = { day: 'mon', pick: 'Oracle', story: 'Headline', via: 'words', approved: true, ...SAID }
    expect(hisOnlyRefusal('picks', pick, OPERATOR)).toBe('pick_is_his')
    expect(hisOnlyRefusal('queue', { use: 'approve', via: 'words', ...SAID }, OPERATOR)).toBe('press_is_his')
  })
})

/** A content_ideas row and board_save, as the press reads and writes them; records every table touched. */
function fakeDb(meta: Body) {
  const touched: string[] = [], saves: Body[] = [], writes: Body[] = []
  const db = {
    touched, saves, writes,
    from(table: string) {
      touched.push(table)
      const q: any = {
        select() { return q }, eq() { return q }, in() { return q },
        update(p: Body) { writes.push({ table, p }); return q }, insert(p: Body) { writes.push({ table, p }); return q }, upsert(p: Body) { writes.push({ table, p }); return q },
        async maybeSingle() { return { data: table === 'content_ideas' ? { meta, updated_at: 't0' } : null, error: null } },
        then(resolve: (v: unknown) => void) { return resolve({ data: [], error: null }) },
      }
      return q
    },
    async rpc(name: string, args: Body) { saves.push({ name, ...args }); return { data: { ok: true, revision: 2, body: args.p_body }, error: null } },
  }
  return db
}

describe('after it is saved', () => {
  it('a typed lock approval places nothing and sends nothing', async () => {
    const db = fakeDb({})
    const out = await afterPress(db as any, { week: WEEK, collection: 'picks', id: 'mon-lock-words', body: lockDoc(), who: OPERATOR, saved: { ok: true, revision: 1 } })
    expect(out).toBeNull()
    expect(db.touched).toEqual([])
    expect(db.writes).toEqual([])
  })
  it('typed approval of scripts goes to Teleprompter as the press does, held until the scripts\' check and two readers pass', async () => {
    const id = 'mon-scripts-words'
    const body = await preparePress('picks', id, scriptsDoc())
    expect(body.scripts).toEqual({ long: scriptHash(LONG) })
    expect(validBody('picks', id, body)).toBe(true)
    // Unchecked words are held, exactly as for his press.
    const held = fakeDb({ making: {} })
    const sent: Body[] = []
    const out = await afterPress(held as any, { week: WEEK, collection: 'picks', id, body, who: OPERATOR, saved: { ok: true, revision: 1 } },
      { send: async i => { sent.push(i as Body); return { status: 'sent' } }, now: () => '2026-11-13T09:12:05Z' })
    expect(out?.send?.status).toBe('held')
    expect(sent).toEqual([])
    // Checked and read back by two fresh readers: sent, with his typed approval as the approval.
    const sha = scriptHash(LONG)
    const ready = fakeDb({ making: { script_check: { passed: true, hashes: { long: sha },
      read_back: { long: { script_sha256: sha, found: 'nothing lost', readers: ['Reader A', 'Reader B'] } } } } })
    const done = await afterPress(ready as any, { week: WEEK, collection: 'picks', id, body, who: OPERATOR, saved: { ok: true, revision: 1 } },
      { send: async i => { sent.push(i as Body); return { status: 'sent', scripts: [] } }, now: () => '2026-11-13T09:12:05Z' })
    expect(done?.send?.status).toBe('sent')
    expect(sent[0].approval).toMatchObject({ id, updated_by: OPERATOR })
    expect(typedApproval(sent[0].approval)).toBe(true)
  })
  it('the Teleprompter gate counts his typed words, and never another session document', () => {
    expect(typedApproval({ id: 'mon-scripts-words', body: scriptsDoc() })).toBe(true)
    expect(typedApproval({ id: 'mon-scripts', body: scriptsDoc() })).toBe(false)
    expect(typedApproval({ id: 'mon-scripts-words', body: scriptsDoc({ words: '' }) })).toBe(false)
    expect(typedApproval({ id: 'mon-scripts-words', body: { ...scriptsDoc(), via: 'board' } })).toBe(false)
  })
})

describe('on the board', () => {
  const MON_OPTION = { id: MON, so_what: 'Oracle is raising $20 billion more to build for AI.', story: 'Headline: Oracle borrows to build.' }
  const piece = (id: string, date: string, slot: string) =>
    ({ id, idea: `Piece ${id.slice(0, 4)}. It says one thing.`, scheduled_for: date, lane_slot: slot, state: 'drafting', buried_at: null, body: '', updated_at: '2026-11-09T12:00:00Z', meta: {} })
  const inputs = (picks: ViewInputs['picks'], locks: ViewInputs['locks'] = { mon: LOCK }): ViewInputs => ({
    week: WEEK, now: new Date('2026-11-13T10:00:00Z'),
    pieces: [piece(MON, '2026-11-16', 'follow_the_money'), piece(WED, '2026-11-18', 'under_the_hood')],
    picks, queue: [], history: [], runs: {}, north_star: null, locks,
    ideas: { days: { mon: [MON_OPTION] }, offdays: { tue: [], thu: [], sat: [] } },
    approvals: [approval(WEEK, 'mon', MON, { option_sha256: optionSha({ so_what: MON_OPTION.so_what, story: MON_OPTION.story }) })],
  })
  const row = (doc_id: string, body: Body) => ({ doc_id, body, updated_by: OPERATOR })
  const detail = (v: ReturnType<typeof buildView>, d: string, h: string) => v.days.find(x => x.day === d)!.detail.find(x => x.h === h)?.p

  it('shows his lock and his scripts as "Approved in your words", with his words, and moves the piece on', () => {
    const v = buildView(inputs([row('mon-lock-words', lockDoc()), row('mon-scripts-words', scriptsDoc())]))
    expect(detail(v, 'mon', 'Narrative lock')).toBe('Approved in your words: "Yes, lock it. That is the story.", Fri 13 Nov (Claude Code session in krishanraja/content-engine)')
    expect(detail(v, 'mon', 'Scripts')).toBe('Approved in your words: "Approve the script, send it to the teleprompter.", Fri 13 Nov (Claude Code session in krishanraja/content-engine)')
    const steps = v.days.find(x => x.day === 'mon')!.path!.steps
    expect(steps.find(s => s.key === 'story')!.state).toBe('done')
    expect(steps.find(s => s.key === 'board')!.state).toBe('done')
  })
  it('a lock changed after his words is not approved, and a lock he signed in the file shows his signature words', () => {
    const changed = buildView(inputs([row('mon-lock-words', lockDoc())], { mon: `${LOCK}\nA line a session added later.` }))
    expect(detail(changed, 'mon', 'Narrative lock')).toBe('Written, waiting for your signature')
    const signedFile = buildView(inputs([], { mon: `${LOCK}\n\nSigned by Krish: "Lock it.", 2026-11-13, lock sha256 ${lockBodyHash(LOCK)}` }))
    expect(detail(signedFile, 'mon', 'Narrative lock')).toBe('Approved in your words: "Lock it.", Fri 13 Nov')
  })
  it('his typed words for a day whose idea he never approved put nothing on the board', () => {
    const typed = { ...lockDoc({ day: 'wed', piece_id: WED, lock_path: `docs/plans/${WEEK}-week/narrative-lock-wed.md` }) }
    const v = buildView(inputs([row('wed-lock-words', typed), row('wed-scripts-words', scriptsDoc({ day: 'wed', piece_id: WED }))], { mon: LOCK, wed: LOCK }))
    const wed = v.days.find(x => x.day === 'wed')!
    expect(wed.piece_id).toBeNull()
    expect(wed.pieces).toEqual([])
    expect(wed.held.map(h => h.piece_id)).toEqual([WED])
  })
})
