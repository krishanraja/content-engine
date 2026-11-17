import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { thisWeek } from './board-week-model.test'
import { buildView, typedApproval } from '../../apps/control-plane/api/board/_view'
import { asWritten, wordsBody } from '../../apps/control-plane/api/board/_contracts'
import { itemPrompt, offdayScripts, recordHead, recordsItself } from '../../apps/control-plane/api/board/_weekModel'
import { NEVER_HEADLESS, ROUTE_RULING } from '../../apps/control-plane/api/board/_makeRoute'
import { RECORD_MYSELF } from '../../apps/control-plane/api/board/_audio'

// Two rulings on the Content board's Claude prompt buttons (Krish, 2026-11-17): "presumably when it gets to this stage and
// the files are in teleprompter, the next action presumes I have recorded the video and put it in the inbox, and thats
// what the next button's prompt is there to do in Claude?Also can you stop having my Claude production prompt buttons
// open up a new browser window? Just copy to clipboard is enough for all such buttons".

type Body = Record<string, any>
const WEEK = '2026-11-09'
// Tue 17 Nov's habits voiceover: an off-day option with a piece id and no engine row ("idea not found"), its script
// approved in his words through a session, and the server's own send answer held on the same document.
const PIECE = '701a2c55-7400-4dc8-99cb-d6001147ae16'
const TUE_WORDS = {
  at: '2026-11-17T11:06:24.000Z', day: 'tue', via: 'words', kind: 'approve_scripts',
  send: { at: '2026-11-17T11:06:25.717Z', by: 'content-engine server', status: 'held', error: "the piece's making record could not be read, so nothing was sent" },
  texts: { short: "You can't sack an AI. So when it screws up, who gets the blame?" },
  words: 'merge all to main and then let me know when all done, ready in teleprompter for me',
  titles: { short: 'Habits that cost your job (voiceover, 90 s)' },
  said_at: '2026-11-17T11:06:00Z', scripts: { short: '97566818c7babdd720b3ed9459922cbe8205953ffe6433587ae89a38441773da' },
  approved: true, piece_id: PIECE, said_where: 'Claude Code session in krishanraja/content-engine',
  session_ref: 'https://claude.ai/code/session_01JRhKytFcFVtUWn8teqtkUB', folder_title: 'Tue 17 Nov off-day: habits voiceover',
}

// The real document's words never named an approval, so since 17 Nov it is not one (Ruling, Krish, 2026-11-17). The
// stage tests carry the same document with words that do.
const APPROVED = { ...TUE_WORDS, words: 'Approve the script, ready in teleprompter for me' }

/** The frozen week with Tuesday's approved voiceover carrying the habits piece id. */
function week(picks: Body[] = []) {
  const i = thisWeek()
  const tue = ((i.ideas!.offdays as Body).tue as Body[]).find(o => o.id === 'mcpskin')!
  tue.piece_id = PIECE
  i.now = new Date('2026-11-09T09:00:00Z') // before its Tuesday, so it is not missed
  i.picks = [...i.picks, ...picks] as typeof i.picks
  return i
}
const voiceover = (picks: Body[] = []) => {
  const view = buildView(week(picks))
  const it = view.model.days.find(d => d.day === 'tue')!.items.find(x => x.key === 'off-tue-mcpskin')!
  expect(it, 'the approved voiceover is on Tuesday').toBeTruthy()
  return it
}
/** The card's Claude prompt, wherever it sits: its next action, or beside his press. */
const anyPrompt = (it: Body): string => String(([it.next, ...(it.others || [])] as Body[]).find(a => a && a.kind === 'prompt')?.prompt ?? '')
const promptOf = (a: unknown): string => {
  const p = a as Body
  expect(p.kind).toBe('prompt')
  return String(p.prompt)
}

describe('every Claude prompt is only copied (contract 1.22.0)', () => {
  it('no prompt the model builds carries open, on any card, on any day', () => {
    const view = buildView(week([{ doc_id: 'tue-scripts-words', updated_by: 'engine_operator', body: TUE_WORDS }]))
    const prompts: Body[] = []
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') { if ((v as Body).kind === 'prompt') prompts.push(v as Body); Object.values(v).forEach(walk) }
    }
    walk(view)
    expect(prompts.length).toBeGreaterThan(3)
    for (const p of prompts) expect('open' in p, p.label).toBe(false)
    const base = { day: 'wed' as const, date: '2026-11-18', title: 'A piece', line: 'Approved.', kind_label: 'Piece', piece_id: PIECE, key: `piece:${PIECE}` }
    expect('open' in (itemPrompt(WEEK, base, 'board') as Body)).toBe(false)
  })

  it('the schema keeps open, retired, and nothing in the engine sends it', () => {
    const schema = readFileSync('apps/control-plane/api/board/view.schema.json', 'utf8')
    expect(Number(String(JSON.parse(schema)['x-contract-version']).split('.')[1])).toBeGreaterThanOrEqual(22)
    expect(JSON.parse(schema).$defs.action.properties.open).toMatchObject({ 'x-since': '1.17.0', 'x-retired': '1.22.0' })
    const model = readFileSync('apps/control-plane/api/board/_weekModel.ts', 'utf8')
    expect(model).not.toMatch(/CODE_OPEN|open: \{/)
  })
})

describe("an off-day voiceover's prompt follows its stage (Tue 17 Nov)", () => {
  it('before his approval of the script, it is the make prompt', () => {
    const it = voiceover()
    expect(it.line).not.toMatch(/Video Engine Inbox/)
    const p = promptOf(it.next)
    expect(p).toContain('You write the script')
    expect(p).not.toContain('recording.py get')
  })

  it('once he approved the script, it assumes the take is in the Inbox and cuts it on the ve route, with no engine row', () => {
    const it = voiceover([{ doc_id: 'tue-scripts-words', updated_by: 'engine_operator', body: APPROVED }])
    // Its send was held (17 Nov): the card says his approval counts and why it is not in his Teleprompter yet.
    expect(it.line).toMatch(/You approved the script on Tue 17 Nov, and your approval counts\. It is not in your Teleprompter yet: the send was held \(the piece's making record could not be read, so nothing was sent\)/)
    const sent = voiceover([{ doc_id: 'tue-scripts-words', updated_by: 'engine_operator', body: { ...APPROVED, send: { ...TUE_WORDS.send, status: 'sent', error: undefined } } }])
    // In his Teleprompter: the card waits on his My takes are in the Inbox (17 Nov), with the record step's prompt beside it.
    expect(sent.line).toMatch(/Your script is approved\. Record it from your Teleprompter, drop the take in the Video Engine Inbox, then press My takes are in the Inbox\./)
    expect(sent.next).toMatchObject({ kind: 'press', op: 'takes-in', body: { piece_id: PIECE, item: 'off-tue-mcpskin' } })
    expect(anyPrompt(sent)).toContain('recording.py get NAME')
    const p = promptOf(it.next)
    for (const words of ['python scripts/post-pack/recording.py get NAME', 'AGENTS.md rule 9', 'docs/ve/ENGINE.md', 'docs/ve/RUNBOOK.md',
      've card, ve dispatch, ve verify-card', ROUTE_RULING, NEVER_HEADLESS, PIECE, 'Habits that cost your job (voiceover, 90 s)',
      'Tue 17 Nov off-day: habits voiceover', "the board's own send was held", 'scripts/post-pack/teleprompter_send.py', 'Keep the board current as you work']) {
      expect(p).toContain(words)
    }
    expect(p).not.toContain('You write the script')
    // The voice line still rides on it: he records it himself.
    expect(p).toContain('Krish records this one himself')
  })

  it('his Approve scripts press counts the same, and so does a typed approval saved under another day', () => {
    const press = voiceover([{ doc_id: 'tue-scripts', updated_by: 'Krish', updated_at: '2026-11-17T11:00:00Z', body: { kind: 'approve_scripts', approved: true, piece_id: PIECE, texts: { short: 'Words.' } } }])
    expect(anyPrompt(press)).toContain('recording.py get NAME')
    const moved = voiceover([{ doc_id: 'mon-scripts-words-701a2c55', updated_by: 'engine_operator', body: { ...APPROVED, day: 'mon' } }])
    expect(anyPrompt(moved)).toContain('recording.py get NAME')
  })

  it('can fail: a press by anyone else, another piece, or an ElevenLabs voice keeps the make prompt', () => {
    const notHis = voiceover([{ doc_id: 'tue-scripts', updated_by: 'engine_operator', body: { approved: true, piece_id: PIECE } }])
    expect(promptOf(notHis.next)).not.toContain('recording.py get')
    const other = voiceover([{ doc_id: 'tue-scripts-words', updated_by: 'engine_operator', body: { ...APPROVED, piece_id: 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118' } }])
    expect(promptOf(other.next)).not.toContain('recording.py get')
    const eleven = { doc_id: 'audio-voice-off-tue-mcpskin', updated_by: 'Krish', body: { kind: 'audio_pick', layer: 'voice', item: 'off-tue-mcpskin', pick: 'krish-v2', at: '2026-11-17T10:00:00Z' } }
    const cloned = voiceover([eleven, { doc_id: 'tue-scripts-words', updated_by: 'engine_operator', body: APPROVED }])
    expect(promptOf(cloned.next)).not.toContain('recording.py get')
  })

  it('only a voiceover he records has a recorded step', () => {
    expect(recordsItself('voiceover', [], 'x')).toBe(true)
    for (const k of ['supporting', 'good_news', 'explainer', 'meme']) expect(recordsItself(k, [], 'x')).toBe(false)
    const own = [{ doc_id: 'audio-voice-x', updated_by: 'Krish', body: { pick: RECORD_MYSELF } }]
    expect(recordsItself('voiceover', own, 'x')).toBe(true)
  })

  it('reads the approval by the option\'s piece id, and none without one', () => {
    const picks = [{ doc_id: 'tue-scripts-words', body: APPROVED }]
    const sc = offdayScripts(picks, { piece_id: PIECE })!
    expect(sc).toMatchObject({ piece_id: PIECE, on: 'Tue 17 Nov', send: 'held', folder: 'Tue 17 Nov off-day: habits voiceover' })
    expect(offdayScripts(picks, {})).toBeNull()
    expect(offdayScripts(picks, null)).toBeNull()
    expect(recordHead(sc)).toContain('ready in teleprompter for me')
  })
})

describe("the server's own send answer never unmakes his typed approval", () => {
  it('wordsBody refuses send from a session; read back past the server\'s answer, the approval counts', () => {
    expect(wordsBody('tue-scripts-words', APPROVED)).toBe(false)
    expect(wordsBody('tue-scripts-words', asWritten(APPROVED))).toBe(true)
    expect(typedApproval([{ doc_id: 'tue-scripts-words', body: APPROVED }], 'tue', 'scripts', PIECE)?.words).toBe(APPROVED.words)
    // The real Tue 17 document: his words never named an approval, so it is not one (Ruling, Krish, 2026-11-17).
    expect(wordsBody('tue-scripts-words', asWritten(TUE_WORDS))).toBe(false)
    expect(typedApproval([{ doc_id: 'tue-scripts-words', body: TUE_WORDS }], 'tue', 'scripts', PIECE)).toBeNull()
  })
  it('can fail: a send a session wrote is still refused', () => {
    const forged = { ...APPROVED, send: { by: 'a session', status: 'sent' } }
    expect(wordsBody('tue-scripts-words', asWritten(forged))).toBe(false)
    expect(typedApproval([{ doc_id: 'tue-scripts-words', body: forged }], 'tue', 'scripts', PIECE)).toBeNull()
  })
})
