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
  /** Why an approval he gave no longer counts: scripts filed after it are not the words he approved. */
  note?: string
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
export interface ScriptsState {
  pressed: boolean; pressed_at: string | null; typed: { words: string; said_at: string } | null
  /** The words each cut held when he approved them (the approval's texts); null when the approval carries none. */
  texts?: Partial<Record<'long' | 'short' | 'feature', string>> | null
}

export interface DecisionInputs {
  meta: unknown
  /** undefined when the lock could not be read. */
  lock: LockState | undefined
  /** undefined when the board's presses could not be read. */
  scripts: ScriptsState | undefined
  /** The scripts filed on the piece now (readFiledScripts); undefined when they were not read, so nothing is compared. */
  filed?: FiledScript[]
}

/** Words as compared for an approval: the same words, whatever the spacing and line breaks. */
const sameWords = (a: string, b: string) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim()
/** The cuts filed now whose words are not the words he approved (Krish, 2026-11-17: "tie approvals to the words"):
 *  Wed 18's scripts were approved in his words at 09:01 and rewritten at 13:43, and an approval that ignores its words
 *  would count for scripts he never read. An older approval saved without its words cannot be compared and stands as
 *  it was, so no piece he already approved and recorded is sent back a step. */
export function scriptsChanged(approved: ScriptsState['texts'], filed: FiledScript[] | undefined, approvedAt: string | null = null): Array<'long' | 'short'> {
  if (!filed?.length || !approved || !Object.keys(approved).length) return []
  // Only a script filed AFTER his approval makes it stale. Words he edited himself on the board differ from the older
  // filed text by design, and his approval is the newer act (F49, Tue 17 Nov 16:20: "pressed approve, and it just
  // deleted all my edits, and the board looks like i never did anything").
  const since = approvedAt && Number.isFinite(Date.parse(approvedAt)) ? Date.parse(approvedAt) : null
  // A filing time that cannot be read counts as after his approval: unknown never counts as approved (review of F49).
  const filedAfter = (f: FiledScript) => since === null || f.at === null || !Number.isFinite(Date.parse(f.at)) || Date.parse(f.at) > since
  return filed.filter(f => (typeof approved[f.cut] !== 'string' || !sameWords(approved[f.cut] as string, f.text)) && filedAfter(f)).map(f => f.cut)
}

/** The title his approved scripts speak (house rule INTRO_PATTERN: the title said as a question in the intro), as a
 *  working title: the last question in each cut's first paragraph, a compound question cut to its last clause ("what
 *  happened and where does AI get built when towns say no?" -> "Where does AI get built when towns say no?"), the
 *  shortest across the cuts. Null when no intro asks one. Titles are settled with the finished video (packaging). */
const STOCK_QUESTION = /^(want to know why|sound familiar|guess what|know what|you know what|ready|right|why|how|what|really|seriously)\??$/i
export function spokenTitle(texts: Partial<Record<string, string>> | null | undefined): string | null {
  const found: string[] = []
  for (const text of Object.values(texts || {})) {
    if (typeof text !== 'string') continue
    // The first paragraph he speaks: no heading, bold label or bracketed direction (review of F49).
    const spoken = (p: string) => p.replace(/\[[^\]]*\]/g, ' ').replace(/\*\*[^*]*\*\*:?/g, ' ').replace(/["\u201c\u201d]/g, '').replace(/\s+/g, ' ').trim()
    // Initials and titles (U.S., U.K., Dr.) keep their dots inside the sentence they sit in.
    const first = (text.split(/\n\s*\n/).map(x => spoken(x.trim())).find(x => x && !/^#/.test(x) && /[a-z]/.test(x)) || '')
      .replace(/\b((?:[A-Z]\.){2,}|(?:Mr|Mrs|Ms|Dr|St|vs|etc|e\.g|i\.e)\.)/g, m => m.replace(/\./g, '\u2024'))
    // Sentences end at . ? ! followed by a space or the end, so "$2.5 billion" and "U.S." stay whole.
    const qs = (first.match(/(?:[^.?!]|[.?!](?!\s|$))*\?(?=\s|$)/g) || []).map(q => q.trim())
    let q = ([...qs].reverse().find(x => !STOCK_QUESTION.test(x.replace(/^(and|so|but|or|now)\b[,\s]*/i, ''))) || '')
      .replace(/^(and|so|but|or|now)\b[,\s]*/i, '')
    const clause = /\b(?:and|or)\s+((?:where|what|how|why|who|when|which|is|are|can|could|will|would|should|do|does|did)\b[^?]*\?)$/i.exec(q)
    if (clause) q = clause[1]
    q = q.replace(/\u2024/g, '.').replace(/\s+/g, ' ').trim()
    if (q.split(' ').length >= 5 && q.length <= 140) found.push(q.charAt(0).toUpperCase() + q.slice(1))
  }
  // The shortest that is still a full question (the cuts ask the same one, the short cut most plainly).
  return found.length ? found.sort((a, b) => a.length - b.length)[0] : null
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
  const approvedScripts = i.scripts === undefined ? d('scripts', null)
    : i.scripts.pressed ? d('scripts', true, 'approved', 'Krish', i.scripts.pressed_at, 'his Approve scripts press on the board')
    : i.scripts.typed ? d('scripts', true, `"${i.scripts.typed.words}"`, 'Krish', i.scripts.typed.said_at, 'his typed words')
    : d('scripts', false)
  // An approval counts only for the words it approved: scripts filed since with other words wait on his Approve again.
  const changed = approvedScripts.made ? scriptsChanged(i.scripts?.texts ?? null, i.filed, approvedScripts.at) : []
  const cutName = (c: string) => (c === 'long' ? 'the 5-minute script' : 'the 90-second script')
  const scripts: Decision = changed.length
    ? { ...d('scripts', false), note: `you approved earlier words; ${changed.map(cutName).join(' and ')} ${changed.length > 1 ? 'have' : 'has'} been rewritten since (approved ${approvedScripts.at ?? 'before'}), so ${changed.length > 1 ? 'they wait' : 'it waits'} on your Approve again` }
    : approvedScripts
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
    : `- ${x.label}: not made yet${x.note ? `: ${x.note}` : ''}`
  return `His decisions on this piece when this prompt was copied:\n${p.items.map(line).join('\n')}\n${p.rule}`
}

/** A script a session filed on the piece for his Approve (a material of role script), with its words. */
export interface FiledScript { cut: 'long' | 'short'; id: string; title: string; text: string; at: string | null }

/** Which cut a filed script is, from its title: the short or 90-second cut, else the long (5-minute) one. null when it
 *  names neither, so a stray note is never offered as a script. */
export function scriptCut(title: string): 'long' | 'short' | null {
  const cuts = scriptCuts(title)
  return cuts.length === 1 ? cuts[0] : cuts.length ? 'short' : null
}

const SHORT_WORDS = /\bshort\b|\b\d+[- ]?second|\babout \d+ ?s\b|\bvertical\b/
const LONG_WORDS = /\blong\b|\bminute\b|\b\d+-min\b/
/** Every cut a filed script's title names: one material may hold both cuts ("Wed 18 scripts v2 ... (5-minute and
 *  90-second)", 17 Nov), and then its words are split by their cut headings (scriptSection). */
export function scriptCuts(title: string): Array<'long' | 'short'> {
  const t = title.toLowerCase()
  return [...(LONG_WORDS.test(t) ? ['long' as const] : []), ...(SHORT_WORDS.test(t) ? ['short' as const] : [])]
}

/** A heading line that names a cut in a material holding both: "5-MINUTE CUT", "90-SECOND CUT", "LONG CUT", "SHORT
 *  CUT", "VERTICAL", optionally as a Markdown heading or with a colon. */
function headingCut(line: string): 'long' | 'short' | null {
  const t = line.trim().replace(/^#+\s*/, '').replace(/[:*_]+$/g, '').replace(/^[*_]+/, '').trim()
  if (!t || t.length > 60 || !/\bcut\b|^vertical\b|^short\b|^long\b/i.test(t)) return null
  const cuts = scriptCuts(t)
  return cuts.length === 1 ? cuts[0] : null
}
/** One cut's words from a material holding both cuts under their headings; null when it has no such heading, so a
 *  material is never offered for a cut it does not hold. */
export function scriptSection(text: string, cut: 'long' | 'short'): string | null {
  const lines = text.split(/\r?\n/)
  let at: 'long' | 'short' | null = null
  const out: string[] = []
  let found = false
  for (const line of lines) {
    const h = headingCut(line)
    if (h) { at = h; if (h === cut) found = true; continue }
    if (at === cut) out.push(line)
  }
  const body = out.join('\n').trim()
  return found && body ? body : null
}

/** The newest filed script of each cut among a piece's materials (role script, filed on the piece itself). A material
 *  whose title names both cuts is a candidate for each (`both`), its words split by heading when read. */
export function newestScripts<M extends { id: string; title: string; role?: string | null; at?: string | null; where?: string; scope?: unknown }>(materials: M[], pieceId: string): Array<{ cut: 'long' | 'short'; m: M; both: boolean }> {
  const out = new Map<'long' | 'short', { m: M; both: boolean }>()
  for (const m of materials) {
    if (m.role !== 'script' || (m.where !== undefined && m.where !== 'piece') || (m.scope !== undefined && m.scope !== pieceId)) continue
    const cuts = scriptCuts(m.title)
    for (const cut of cuts) {
      const was = out.get(cut)
      if (!was || String(m.at || '') > String(was.m.at || '')) out.set(cut, { m, both: cuts.length > 1 })
    }
  }
  return [...out.entries()].map(([cut, x]) => ({ cut, m: x.m, both: x.both }))
}

/** What a signed lock says, for the card's read sheet: its deeper story as the so-what and its surface story as the
 *  story, so the card says what the piece is now, never the idea row it started from (Krish, 17 Nov). */
export function lockRead(text: string | null | undefined): { so_what: string | null; story: string | null } {
  if (!text) return { so_what: null, story: null }
  const section = (name: string) => {
    const m = new RegExp(`^##\\s*${name}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'mi').exec(text)
    const body = m ? m[1].trim().split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim() : ''
    return body || null
  }
  return { so_what: section('Deeper story'), story: section('Surface story') }
}
