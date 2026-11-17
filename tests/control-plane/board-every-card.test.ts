import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { thisWeek } from './board-week-model.test'
import { buildView, scriptsStateOf } from '../../apps/control-plane/api/board/_view'
import { WORDS_ID, wordsBody, wordsDocId } from '../../apps/control-plane/api/board/_contracts'
import { TYPED_SCRIPTS_ID } from '../../apps/control-plane/api/_teleprompter'
import { decisionsText, newestScripts, pieceDecisions, scriptCut, scriptCuts, scriptSection, scriptsChanged } from '../../apps/control-plane/api/board/_decisions'
import { recordedPiece, scriptsReady, withWork } from '../../apps/control-plane/api/board/_weekModel'

// Ruling (Krish, 2026-11-17): "any feedback on the board UI or UX must be done to every single day present and future".
// The board builds its cards in three places (pieceItem: a series day's own piece; placedPieceItem: a piece moved to
// another day; postItemBase: an off-day post). On 17 Nov his Approve scripts reached only a moved piece (Wed 18 sat at
// "Make the storyboard and the script together" with both scripts filed), and an off-day post showed none of the nine
// reports and dozen materials filed for it. Each rule below is one function every card builder calls, and this file
// fails when a builder stops calling it.

const SRC = readFileSync('apps/control-plane/api/board/_weekModel.ts', 'utf8')
/** The body of a top-level function in _weekModel.ts. */
function body(name: string): string {
  const at = SRC.search(new RegExp(`^(export )?function ${name}\\b`, 'm'))
  expect(at, `${name} is in _weekModel.ts`).toBeGreaterThan(-1)
  const next = SRC.slice(at + 1).search(/^(export )?(async )?function /m)
  return SRC.slice(at, next < 0 ? undefined : at + 1 + next)
}
const BUILDERS = ['pieceItem', 'placedPieceItem', 'postItemBase']

describe('every card builder calls the shared rules', () => {
  it('every builder of a card reads its work on file through withWork', () => {
    for (const b of BUILDERS) expect(body(b), b).toMatch(/withWork\(/)
  })
  it('every builder of a piece card offers his Approve scripts through scriptsReady', () => {
    // An off-day post with its own record too (Krish, 2026-11-17: "just add the scripts section to the off-day card").
    for (const b of ['pieceItem', 'placedPieceItem', 'postItemBase']) expect(body(b), b).toMatch(/scriptsReady\(/)
  })
  it('no card builder is added without being listed here', () => {
    const builders = [...SRC.matchAll(/^(?:export )?function (\w+Item(?:Base)?)\(m: ModelInputs/gm)].map(x => x[1])
    expect(builders.sort()).toEqual([...BUILDERS, 'postItem'].sort())
  })
})

const V2 = 'Wed 18 scripts v2 for your approval: your intro, "Build or buy your tools in an AI world?" (5-minute and 90-second)'
const V1 = 'Wed 18 scripts for your approval: 5-minute cut (743 words) and vertical (74 words)'
const BOTH = '5-MINUTE CUT\n\nAnthropic, which makes Claude, pays for other companies\' tools.\n\nSecond paragraph.\n\n90-SECOND CUT\n\nAnthropic pays for its tools. Should you?'

describe('a script material holding both cuts (Wed 18, 17 Nov)', () => {
  it('names both cuts, and a one-cut title still names its one', () => {
    expect(scriptCuts(V2)).toEqual(['long', 'short'])
    expect(scriptCuts(V1)).toEqual(['long', 'short'])
    expect(scriptCuts('Tue 17 script, short cut (about 30 s), redrafted 17 Nov')).toEqual(['short'])
    expect(scriptCuts('Fri script, long cut (5-minute)')).toEqual(['long'])
    expect(scriptCut('Tue 17 script, short cut (about 30 s)')).toBe('short')
    expect(scriptCuts('Research notes for Wednesday')).toEqual([])
  })
  it('gives each cut only its own words, and nothing when the heading is missing', () => {
    expect(scriptSection(BOTH, 'long')).toBe('Anthropic, which makes Claude, pays for other companies\' tools.\n\nSecond paragraph.')
    expect(scriptSection(BOTH, 'short')).toBe('Anthropic pays for its tools. Should you?')
    expect(scriptSection('## Long cut:\nOne.\n\n## Vertical\nTwo.', 'short')).toBe('Two.')
    expect(scriptSection('Just words, no headings.', 'long')).toBeNull()
  })
  it('the newest material holding both cuts is the one offered for each', () => {
    const P = 'db9f9f6a-1092-49be-8024-f335e060305a'
    const found = newestScripts([
      { id: 'v1', title: V1, role: 'script', at: '2026-11-17T08:41:54Z', where: 'piece', scope: P },
      { id: 'v2', title: V2, role: 'script', at: '2026-11-17T13:43:13Z', where: 'piece', scope: P },
    ], P)
    expect(found.map(f => [f.cut, f.m.id, f.both]).sort()).toEqual([['long', 'v2', true], ['short', 'v2', true]])
  })
})

describe('the shared rules', () => {
  const filed = [{ cut: 'long' as const, id: 'a', title: 'Long', text: 'Long words.', at: null }, { cut: 'short' as const, id: 'b', title: 'Short', text: 'Short words.', at: null }]
  it('scripts filed and not approved make his Approve scripts the next action', () => {
    const ready = scriptsReady({ week: '2026-11-16', scripts: { p1: filed }, picks: [] }, 'wed', 'p1', 'Build or buy', 'Fleshed out')
    expect(ready?.press.label).toBe('Read and approve the scripts')
    expect((ready?.press.body as Record<string, unknown>).piece_id).toBe('p1')
    expect(ready?.line).toMatch(/^Fleshed out\. Both scripts are ready for your Approve/)
  })
  it('scripts he approved, or none filed, offer nothing', () => {
    const approved = { p1: { items: [{ key: 'scripts', made: true }] } } as never
    expect(scriptsReady({ week: '2026-11-16', scripts: { p1: filed }, picks: [], decisions: approved }, 'wed', 'p1', 'x', 'y')).toBeNull()
    expect(scriptsReady({ week: '2026-11-16', scripts: {}, picks: [] }, 'wed', 'p1', 'x', 'y')).toBeNull()
  })
  it('the work on file joins the card: materials as research, the newest report as said', () => {
    const read = { so_what: null, story: null, why_now: null, fact: null, text: null, sources: [], research: ['Already'], said: null }
    const work = { 'day:2026-11-16/tue': {
      sessions: [{ by: 'Claude Code (cloud)', state: 'quiet', step: 'post', doing: 'Script v4 is in his Teleprompter.', last_at: '2026-11-17T11:15:16Z' },
        { by: 'Claude Code', state: 'done', step: 'ideas', doing: 'Older line.', last_at: '2026-11-16T12:44:32Z' }],
      materials: [{ title: 'Habits voiceover script v4', at: '2026-11-17T10:27:24Z' }, { title: 'Voice decision', at: '2026-11-17T10:50:03Z' }] } }
    const out = withWork(read, { work }, ['day:2026-11-16/tue'])
    expect(out.research).toEqual(['Already', 'Voice decision', 'Habits voiceover script v4'])
    expect(out.said).toBe('Claude Code (cloud), 2026-11-17 11:15 UTC (quiet, post): Script v4 is in his Teleprompter.')
    expect(withWork({ ...read, said: 'His words.' }, { work }, ['day:2026-11-16/tue']).said).toBe('His words.')
    expect(withWork(read, { work }, ['day:2026-11-16/thu'])).toBe(read)
  })
  it('an off-day option names its piece only when the piece has a record', () => {
    const id = '701a2c55-7400-4dc8-99cb-d6001147ae16'
    expect(recordedPiece({ pieces: [] }, { piece_id: id })).toBeNull()
    expect(recordedPiece({ pieces: [{ id }] }, { piece_id: id.toUpperCase() })).toBe(id)
    expect(recordedPiece({ pieces: [{ id }] }, { piece_id: 'not-a-uuid' })).toBeNull()
  })
})

describe('the frozen week, with work filed on its days', () => {
  it('every card on a day shows the work filed on that day, off-day posts included', () => {
    const i = thisWeek()
    i.overlay = {
      sessions: [{ session_id: 'post-abcd', scope: 'day:2026-11-09/tue', by: 'Claude Code (cloud)', state: 'quiet', step: 'post', doing: 'Carousel cards filed for his look.', started_at: '2026-11-10T09:00:00Z', last_at: '2026-11-10T10:00:00Z' }],
      materials: [{ id: 'm1', scope: 'day:2026-11-09/tue', title: 'Tue carousel, cards v1', kind: 'note', bytes: 10, added_by: 'Claude Code', at: '2026-11-10T09:30:00Z', version: 1 }],
    }
    const view = buildView(i)
    const tue = view.model.days.find(d => d.day === 'tue')!
    const posts = tue.items.filter(it => it.type === 'post' && it.stage.key !== 'live')
    expect(posts.length).toBeGreaterThan(0)
    for (const it of posts) {
      expect(it.read.research, it.key).toContain('Tue carousel, cards v1')
      expect(it.read.said, it.key).toBeTruthy()
    }
  })
})

describe('two pieces on one day each keep their own approval (Tue 17 Nov)', () => {
  const A = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118', B = '701a2c55-7400-4dc8-99cb-d6001147ae16'
  const said = { words: 'Approved.', said_at: '2026-11-17T11:00:00Z', said_where: 'a Claude Code session', session_ref: 'https://claude.ai/code/session_x', at: '2026-11-17T11:00:00Z' }
  const scripts = (piece: string) => ({ kind: 'approve_scripts', day: 'tue', via: 'words', approved: true, piece_id: piece,
    texts: { short: 'Words.' }, titles: { short: 'Title' }, folder_title: 'Folder', ...said })
  it('each piece gets a document of its own, named for it', () => {
    expect(wordsDocId('tue', 'scripts', A)).toBe('tue-scripts-words-b019dbf8')
    expect(wordsDocId('tue', 'lock', B.toUpperCase())).toBe('tue-lock-words-701a2c55')
    expect(WORDS_ID.test('tue-scripts-words')).toBe(true)
    expect(WORDS_ID.test('tue-scripts-words-701a2c55')).toBe(true)
    expect(TYPED_SCRIPTS_ID.test('tue-scripts-words-701a2c55')).toBe(true)
  })
  it('a document named for one piece never carries another piece\'s approval', () => {
    expect(wordsBody('tue-scripts-words-701a2c55', scripts(B))).toBe(true)
    expect(wordsBody('tue-scripts-words-701a2c55', scripts(A))).toBe(false)
  })
  it('both approvals count, the older day-named one and the new piece-named one, each for its own piece only', () => {
    const picks = [{ doc_id: 'tue-scripts-words', body: scripts(B) }, { doc_id: wordsDocId('tue', 'scripts', A), body: scripts(A) }]
    expect(scriptsStateOf(picks, 'tue', A).typed?.words).toBe('Approved.')
    expect(scriptsStateOf(picks, 'tue', B).typed?.words).toBe('Approved.')
    expect(scriptsStateOf([{ doc_id: 'tue-scripts-words', body: scripts(B) }], 'tue', A).typed).toBeNull()
  })
})

describe('the engine\'s read of one piece says its day', () => {
  it('the columns it returns include scheduled_for', () => {
    // Read from the source: importing the route needs the live database's settings.
    const cols = /export const PIECE_COLUMNS = '([^']+)'/.exec(readFileSync('apps/control-plane/api/content-ideas.ts', 'utf8'))?.[1] ?? ''
    expect(cols.split(',')).toContain('scheduled_for')
  })
})

describe('an approval counts only for the words it approved (Krish, 17 Nov: "tie approvals to the words")', () => {
  const P = 'db9f9f6a-1092-49be-8024-f335e060305a'
  const v1 = { long: 'Starbucks spends about four hundred million dollars a year on software.', short: 'Should Starbucks build its own tools?' }
  const v2 = [{ cut: 'long' as const, id: 'm2', title: 'Wed 18 scripts v2 (5-minute and 90-second)', text: 'Anthropic, which makes Claude, pays for other companies\' tools.', at: '2026-11-17T13:43:13Z' },
    { cut: 'short' as const, id: 'm2', title: 'Wed 18 scripts v2 (5-minute and 90-second)', text: 'Anthropic pays for its tools. Should you?', at: '2026-11-17T13:43:13Z' }]
  const typed = (texts: Record<string, string>) => [{ doc_id: wordsDocId('wed', 'scripts', P), body: { kind: 'approve_scripts', day: 'wed', via: 'words', approved: true, piece_id: P,
    texts, titles: Object.fromEntries(Object.keys(texts).map(k => [k, 'T'])), folder_title: 'F', words: 'approve the scripts', said_at: '2026-11-17T09:01:28Z',
    said_where: 'a Claude Code session', session_ref: 'https://claude.ai/code/session_x', at: '2026-11-17T09:01:28Z' } }]
  it('the words he approved come with the approval', () => {
    expect(scriptsStateOf(typed(v1), 'wed', P).texts).toEqual(v1)
  })
  it('scripts rewritten after his approval wait on his Approve again, and the decision says why', () => {
    const dec = pieceDecisions({ meta: {}, lock: { signed: true, on: null, typed: null }, scripts: scriptsStateOf(typed(v1), 'wed', P), filed: v2 })
    const s = dec.items.find(x => x.key === 'scripts')!
    expect(s.made).toBe(false)
    expect(s.note).toMatch(/the 5-minute script and the 90-second script have been rewritten since/)
    expect(decisionsText(dec)).toMatch(/Scripts approved: not made yet: you approved earlier words/)
  })
  it('the same words, whatever the spacing, still count as approved', () => {
    const same = { long: `  ${v2[0].text}\n`, short: v2[1].text.replace(' ', '\n') }
    const dec = pieceDecisions({ meta: {}, lock: undefined, scripts: scriptsStateOf(typed(same), 'wed', P), filed: v2 })
    expect(dec.items.find(x => x.key === 'scripts')!.made).toBe(true)
  })
  it('one cut rewritten is named on its own', () => {
    expect(scriptsChanged({ long: v2[0].text, short: 'Older short words.' }, v2)).toEqual(['short'])
  })
  it('nothing filed, scripts not read, or an older approval saved without its words: the approval stands as it was', () => {
    expect(scriptsChanged(v1, [])).toEqual([])
    expect(scriptsChanged(v1, undefined)).toEqual([])
    expect(scriptsChanged(null, v2)).toEqual([])
  })
  it('the card says the scripts were rewritten since he approved them, and offers the Approve on the new words', () => {
    const dec = pieceDecisions({ meta: {}, lock: undefined, scripts: scriptsStateOf(typed(v1), 'wed', P), filed: v2 })
    const ready = scriptsReady({ week: '2026-11-16', scripts: { [P]: v2 }, picks: [], decisions: { [P]: dec } }, 'wed', P, 'Build or buy', 'Fleshed out')
    expect(ready?.line).toMatch(/^Fleshed out\. Rewritten since you approved them, so they need your Approve again: /)
    expect((ready?.press.body as Record<string, any>).texts).toEqual({ long: v2[0].text, short: v2[1].text })
  })
})
