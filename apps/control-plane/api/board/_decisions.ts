// Krish's decisions on a piece, read live from the records, so no session asks him for a press he has already made.
//
// Tue 17 Nov 2026, piece b019dbf8 (data centres): at 11:09 UTC he pressed Pick the look, Pick the motion style and Pick
// the captions on the board (meta.look and meta.style, by Krish). The prompt he then pasted still said "step look", and
// get_piece_board showed none of his picks, so at 11:13 the session asked him to make the same three presses again. His
// words: "I already did that in the UI, before I pasted my last prompt to you. Why are you asking me to go back and
// repeat this?" (config/failures.json, F46-asked-for-a-press-already-made).
//
// One reader, two callers: the board's prompts (the week model writes the decisions and the step they leave into every
// Claude prompt, _writeBack.ts) and the piece's own read (GET /api/content-ideas/store?piece=<id>, which the Control
// Center connector's get_piece_board returns), so a session checks before it asks. Pure: the callers read the records.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

export type DecisionKey = 'lock' | 'look' | 'motion' | 'captions' | 'scripts'
/** One of his decisions on the piece. made is null when its record could not be read: unknown, never "not made". */
export interface Decision {
  key: DecisionKey
  label: string
  made: boolean | null
  value: string | null
  by: string | null
  at: string | null
  /** Where it is recorded: his press on the board, his typed words, or his signature on the lock. */
  how: string | null
}
/** The step a piece is at from his decisions: story (sign the lock), look (his three production picks), board (the
 *  storyboard and scripts, to his Approve), record (his takes). null when a record that decides it could not be read. */
export type DecidedStep = 'story' | 'look' | 'board' | 'record'
export interface PieceDecisions { items: Decision[]; next_step: DecidedStep | null; rule: string }

/** What every board prompt and every piece read tells a session (Krish, 2026-11-17). */
export const DECISIONS_RULE = 'Before asking Krish for any press or decision, read it from get_piece_board\'s decisions; '
  + 'if it is already made, take the next step. Never ask him to repeat a press he has made.'

/** His signature or typed approval of the lock, as the view reads it (_view.ts lockSigned, lockSignedOn, typedApproval). */
export interface LockState { signed: boolean; on: string | null; typed: { words: string; said_at: string } | null }
/** His scripts approval: the Approve scripts press, or his typed words. */
export interface ScriptsState { pressed: boolean; pressed_at: string | null; typed: { words: string; said_at: string } | null }

export interface DecisionInputs {
  meta: unknown
  /** undefined when the lock could not be read. */
  lock: LockState | undefined
  /** undefined when the board's presses could not be read. */
  scripts: ScriptsState | undefined
}

const LABELS: Record<DecisionKey, string> = { lock: 'Narrative lock signed', look: 'Look', motion: 'Motion style', captions: 'Captions', scripts: 'Scripts approved' }

/** His decisions on the piece and the step they leave, from its records. */
export function pieceDecisions(i: DecisionInputs): PieceDecisions {
  const meta = isObj(i.meta) ? i.meta : {}
  const look = isObj(meta.look) ? meta.look : null
  const style = isObj(meta.style) ? meta.style : null
  const d = (key: DecisionKey, made: boolean | null, value: string | null = null, by: string | null = null, at: string | null = null, how: string | null = null): Decision =>
    ({ key, label: LABELS[key], made, value: made ? value : null, by: made ? by : null, at: made ? at : null, how: made ? how : null })
  const lock = i.lock === undefined ? d('lock', null)
    : i.lock.typed ? d('lock', true, `"${i.lock.typed.words}"`, 'Krish', i.lock.typed.said_at, 'his typed words')
    : i.lock.signed ? d('lock', true, 'signed', 'Krish', i.lock.on, 'his signature on the lock')
    : d('lock', false)
  const lookId = look ? str(look.production) : null
  const motion = style ? str(style.motion) : null
  const captions = style ? str(style.captions) : null
  const styleBy = style ? str(style.by) ?? 'Krish' : null
  const styleAt = style ? str(style.at) : null
  const scripts = i.scripts === undefined ? d('scripts', null)
    : i.scripts.pressed ? d('scripts', true, 'approved', 'Krish', i.scripts.pressed_at, 'his Approve scripts press on the board')
    : i.scripts.typed ? d('scripts', true, `"${i.scripts.typed.words}"`, 'Krish', i.scripts.typed.said_at, 'his typed words')
    : d('scripts', false)
  const items = [
    lock,
    d('look', Boolean(lookId), lookId, look ? str(look.by) ?? 'Krish' : null, look ? str(look.at) : null, 'his press on the board'),
    d('motion', Boolean(motion), motion, styleBy, styleAt, 'his press on the board'),
    d('captions', Boolean(captions), captions, styleBy, styleAt, 'his press on the board'),
    scripts,
  ]
  return { items, next_step: nextStep(items), rule: DECISIONS_RULE }
}

/** The first decision not made names the step; one that could not be read before it leaves the step unknown. */
export function nextStep(items: Decision[]): DecidedStep | null {
  const of = (k: DecisionKey) => items.find(x => x.key === k)?.made ?? null
  const order: Array<[DecidedStep, DecisionKey[]]> = [['story', ['lock']], ['look', ['look', 'motion', 'captions']], ['board', ['scripts']]]
  for (const [step, keys] of order) {
    const made = keys.map(of)
    if (made.includes(null)) return null
    if (made.includes(false)) return step
  }
  return 'record'
}

/** The decisions as lines a prompt carries: what he has decided, by whom and when, and what is still his to decide. */
export function decisionsText(p: PieceDecisions): string {
  const line = (x: Decision) => x.made === null ? `- ${x.label}: could not be read; read it from get_piece_board before asking`
    : x.made ? `- ${x.label}: done, ${x.value}${x.by ? `, by ${x.by}` : ''}${x.at ? ` at ${x.at}` : ''}${x.how ? ` (${x.how})` : ''}`
    : `- ${x.label}: not made yet`
  return `His decisions on this piece when this prompt was copied:\n${p.items.map(line).join('\n')}\n${p.rule}`
}
