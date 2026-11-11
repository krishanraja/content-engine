import { dayDate, type PostedDay } from './_posted.js'
import { offdaySides } from './_offdaySides.js'
import { yesByDay } from './_yes.js'
import { OUTCOMES, OUTCOME_OF_USE, OUTCOME_OF_VERDICT, approvedLabel, dayShort, dayWords, goes, optionSha, type Approval, type Outcome } from './_gate.js'

// The parts of the week the live board needs beside each day's next step (Ruling, Krish, 2026-11-11: one live board, in
// Control Centre; the old board is a read-only archive). Contract 1.2.0 of GET /api/board/<Monday>/view adds, on each
// day: every piece on it (`pieces`, so a second piece or an off-day piece is never hidden behind the first), the day's
// options in full with the presses that answer them (`options`), his comments on it (`comments`), what Growth has
// posted (`posted`) and his yes (`yes`); and on the week, the board's change signal (`revision`).
//
// A press is the action kind `press`: the document the old board's button saved, built here from the same records, so
// the live board saves it as it is (PUT /api/board/<Monday>/<collection>/<id>) or posts it to one of this board's own
// routes (op). The live board fills in only his words (`words.path`) and the time (`stamp`); the server checks every
// body as before (validBody) and binds each hash it binds (preparePress). Nothing here decides for him.
//
// The ideas gate (contract 1.3.0; docs/PUBLISH_BOARDS.md, "The ideas gate"): every idea on the ideas board ends in one
// of five outcomes (_gate.ts OUTCOMES), each a press that says where it sends the idea (`goes`), and only Approve puts an
// idea on the publish board. An option says which outcome it has (`outcome`), and an option whose words a session wrote
// as decided is held until he presses (`held`): his words in a session are kept, never read as his press.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const DAY_NAME: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
const SERIES_SLOT: Record<string, string> = { mon: 'follow_the_money', wed: 'under_the_hood', fri: 'mind_the_gap' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, n) : '')
const https = (v: unknown) => (typeof v === 'string' && /^https:\/\/[^\s]{1,2000}$/.test(v) ? v : undefined)

/** A press on the live board: a board document saved as built here, or a post to one of the board's own routes. */
export type PressAction = {
  kind: 'press'
  label: string
  /** PUT /api/board/<Monday>/<collection>/<id> with { body, revision }. `{t}` in id is replaced by the press time, and a
   *  body value that is exactly "{id}" by the id (a comment is its own thread). */
  collection?: 'picks' | 'queue' | 'comments'
  id?: string
  revision?: number
  /** Or POST /api/board/<Monday>/<op> with the body (material: his research pasted onto the piece). */
  op?: 'material'
  body: Body
  /** His words: asked before the press, written at this dot path; required ones are never sent empty. */
  words?: { path: string; ask: string; required: boolean }
  /** Dot paths set to the press time (ISO). */
  stamp: string[]
  /** What the board says once it is saved. */
  done: string
  /** Contract 1.3.0: which of the five outcomes the press gives an idea, and where that sends it, said before he presses. */
  outcome?: Outcome
  goes?: string
}

export interface ViewOption {
  id: string
  doc_id: string
  title: string
  text: string
  format: string | null
  source: string | null
  /** Where it stands: open, picked, approved, decided, improve, rejected, next_week, revised, or a press use. */
  status: string
  /** His words on it, or the decision the week's plan records in his words. */
  said: string | null
  stories?: Array<{ headline: string; what: string; date: string | null; source: string | null; href?: string; media_kind: string | null; media?: string }>
  stories_due?: string | null
  /** Whether the good news holds this week's stories (found on or after the week's Thursday). */
  stories_fresh?: boolean
  actions: PressAction[]
  /** Contract 1.3.0: the outcome he gave it (one of five), or null while it waits on him. */
  outcome?: { id: Outcome; label: string; at: string | null; words: string | null } | null
  /** Contract 1.3.0: why it cannot cross to the publish board yet (words a session wrote for him, changed words). */
  held?: string
}
export interface ViewPiece {
  id: string; title: string; series: string; state: string; published: boolean; on_day: boolean
  /** Contract 1.3.0: the approval that holds it on its day ("Approved by you, Sun 9 Nov, 08:07"). */
  approval?: { at: string; label: string; via: string } | null
}
export interface ViewComment { at: string; by: string; anchor: string; text: string }
export interface ViewPosted { step: string; label: string; at: string | null; href?: string }
export interface ViewYes { approved: boolean; via: string; at: string; words: string | null }

export interface ExtrasInputs {
  week: string
  pieces: Body[]
  picks: Array<{ doc_id: string; body: Body; updated_by: string; updated_at?: string; revision?: number }>
  queue: Array<{ doc_id: string; body: Body; updated_by: string; updated_at?: string; revision?: number }>
  ideas: Body | null
  comments?: Array<{ doc_id: string; body: Body; updated_by: string; updated_at?: string }>
  ticks?: Array<{ tick_id: string; body: Body; updated_by: string }>
  /** The approvals that stand now (board_approvals_now), or null when they cannot be read: then nothing is approved. */
  approvals: Approval[] | null
}

const his = <T extends { updated_by: string }>(rows: T[]) => rows.filter(r => r.updated_by === 'Krish')
const rev = (rows: Array<{ doc_id: string; revision?: number }>, id: string) => {
  const r = rows.find(x => x.doc_id === id)
  return r && Number.isInteger(r.revision) ? Number(r.revision) : 0
}

/** The Thursday of the week (kept for readers of the older rule). */
export function thursdayOf(week: string): string { return dayDate(week, 'thu' as PostedDay) }

/** The day the week's one ideas run fills its whole ideas board: the Saturday nine days before its Monday, when the
 *  Sunday ideas run first fires (.github/workflows/sunday-ideas.yml). Ruling (Krish, 2026-11-11): the ideas board fills
 *  once a week in full, Saturday's good news included; the Thursday good-news schedule is retired. */
export function ideasRunOf(week: string): string {
  const d = new Date(`${week}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 9)
  return d.toISOString().slice(0, 10)
}

/** Whether a weekly good-news option holds this week's stories: five or more, found for a due date on or after the day
 *  the week's ideas run fills its board (ideasRunOf). Stories found before it were found for another week. */
export function storiesFresh(week: string, o: Body): boolean {
  const stories = Array.isArray(o.stories) ? o.stories.filter(isObj) : []
  const due = typeof o.stories_due === 'string' ? o.stories_due : ''
  return stories.length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(due) && due >= ideasRunOf(week)
}

/** Every piece on the day his approval holds there, the one the day shows first marked, each with that approval. The
 *  pieces it does not hold are the day's `held` lines (_gate.ts gatePieces), never here. */
export function dayPieces(pieces: Body[], date: string, shown: string | null, approvalOf: Map<string, Approval> = new Map()): ViewPiece[] {
  return pieces.filter(p => p.scheduled_for === date && !p.buried_at && p.state !== 'dropped' && typeof p.id === 'string')
    .map(p => {
      const id = String(p.id).toLowerCase()
      const a = approvalOf.get(id)
      return { id, title: cut(p.idea || p.thesis || 'Untitled', 140), series: String(p.lane_slot || ''), state: String(p.state || ''),
        published: p.state === 'published' || Boolean(p.published_at), on_day: id === shown,
        approval: a ? { at: a.decided_at, label: approvedLabel(a), via: a.via } : null }
    })
    .sort((a, b) => Number(b.on_day) - Number(a.on_day) || a.id.localeCompare(b.id))
}

/** His comments that name the day in their anchor (idea-fri-2, off-thu-x, desk:mon:story, mon-dl-video), newest first. */
export function dayComments(rows: ExtrasInputs['comments'], day: string): ViewComment[] {
  const names = new RegExp(`(?:^|[-:])${day}(?:[-:]|$)`)
  return (rows || []).filter(c => isObj(c.body) && typeof c.body.text === 'string' && names.test(String(c.body.anchor || '')))
    .map(c => ({ at: String(c.body.at || c.updated_at || ''), by: c.updated_by === 'Krish' ? 'You' : String(c.updated_by), anchor: String(c.body.anchor), text: cut(c.body.text, 600) }))
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12)
}

/** What Growth has posted on the day (its ticks), with each post's public address when it gave one. */
export function dayPosted(rows: ExtrasInputs['ticks'], day: string): ViewPosted[] {
  return (rows || []).filter(t => t.updated_by === 'growth' && isObj(t.body) && t.body.done === true && t.body.day === day)
    .map(t => {
      const posts = Array.isArray(t.body.posts) ? t.body.posts.filter(isObj) : []
      const href = https(posts[0]?.url)
      return { step: String(t.body.step || ''), label: String(t.body.label || t.body.step || ''), at: typeof t.body.at === 'string' ? t.body.at : null, ...(href ? { href } : {}) }
    })
}

export function dayYes(picks: ExtrasInputs['picks'], day: string): ViewYes | null {
  const y = yesByDay(picks)[day]
  return y ? { approved: y.approved, via: y.via, at: y.at, words: y.words } : null
}

/** The Sunday room's options for a publishing day, each with its outcome and the five presses that answer it. Approve is
 *  his pick for the day (picks/<day>): it puts the idea on the publish board on that day (placePick, _presses.ts). The
 *  other four are queue/<pick> with the use each outcome is stored as (_gate.ts OUTCOME_OF_USE). An idea he approved
 *  carries no other press: one idea, one outcome. */
export function seriesOptions(i: ExtrasInputs, day: string, placed: boolean): ViewOption[] {
  const list = isObj(i.ideas) && isObj(i.ideas.days) && Array.isArray(i.ideas.days[day]) ? (i.ideas.days[day] as unknown[]).filter(isObj) : []
  const current = (i.approvals || []).find(a => a.via === 'pick' && a.day === day) || null
  return list.map((o, n) => {
    const pick = `${day}-${n + 1}`
    const press = his(i.queue).find(q => q.doc_id === pick)?.body
    const ideaId = typeof o.id === 'string' ? o.id : null
    const approved = Boolean(current && ideaId && current.idea_id === ideaId.toLowerCase())
    const pressed = typeof press?.use === 'string' ? OUTCOME_OF_USE[press.use] : undefined
    const status = approved ? 'approved' : pressed || 'open'
    const pressWords = typeof press?.reason === 'string' && press.reason.trim() ? press.reason : typeof press?.note === 'string' && press.note.trim() ? press.note : null
    const said = approved ? current!.words : pressWords
    const story = String(o.story || o.so_what || '')
    const so_what = cut(o.so_what, 2000)
    const card = { pick, idea_id: ideaId, so_what, story, series: SERIES_SLOT[day], week: i.week, day, option_sha256: optionSha({ so_what, story }) }
    const use = (u: string, outcome: Outcome, label: string, done: string, words?: PressAction['words'], extra: Body = {}): PressAction => ({
      kind: 'press', label, collection: 'queue', id: pick, revision: rev(i.queue, pick),
      body: { ...card, queued: true, use: u, ...extra }, ...(words ? { words } : {}), stamp: ['at'], done, outcome, goes: goes(outcome, i.week, day) })
    const actions: PressAction[] = []
    let held: string | undefined
    if (!approved) {
      if (!placed) {
        if (ideaId && UUID.test(ideaId)) {
          actions.push({ kind: 'press', label: `Approve for ${dayShort(i.week, day)}`, collection: 'picks', id: day, revision: rev(i.picks, day),
            body: { day, pick, idea_id: ideaId, series: SERIES_SLOT[day], story, so_what, option_sha256: card.option_sha256 }, stamp: ['at'],
            words: { path: 'note', ask: 'Anything the story must do? (optional)', required: false },
            done: `Approved. It is on the publish board for ${dayWords(i.week, day)}.`, outcome: 'approved', goes: goes('approved', i.week, day) })
        } else {
          held = 'This idea has no record in the engine yet, so it cannot be approved: the ideas run gives every idea one.'
        }
      }
      actions.push(
        use('next_week', 'filed', 'File for later', 'Filed for later. It comes back on a later ideas board.',
          { path: 'note', ask: 'Anything to remember when it comes back? (optional)', required: false }, { target_week: nextMonday(i.week) }),
        use('not_for_us', 'rejected', 'Reject', 'Rejected, with your reason. The next ideas run learns from it.',
          { path: 'reason', ask: 'Why not? The next ideas run learns from your reason.', required: true }),
        use('wider_piece_context', 'trend', 'Save as a trend', 'Saved with its trend, for a wider piece.',
          { path: 'note', ask: 'Which trend is it part of?', required: true }),
        use('improve', 'improved', 'Improve for a future piece', 'Kept with your note for a future piece.',
          { path: 'note', ask: 'What would make it a piece later?', required: true }),
      )
    }
    const outcome = approved
      ? { id: 'approved' as const, label: approvedLabel(current!), at: current!.decided_at, words: current!.words }
      : pressed ? { id: pressed, label: OUTCOMES[pressed], at: typeof press?.at === 'string' ? press.at : null, words: pressWords } : null
    // The plain question first (house rules STORY_ARC and BIG_PICTURE; the ideas quality plan, item 7), then the headline.
    const question = isObj(o.pitch) ? cut(o.pitch.question, 200) : ''
    return { id: String(o.id || pick), doc_id: pick, title: question || headlineOf(story) || cut(o.so_what, 200), text: warned(o) + cut(o.so_what, 600),
      format: null, source: isObj(o.source) ? cut(o.source.label, 200) || null : typeof o.source === 'string' ? cut(o.source, 200) : null,
      status, said: said ? cut(said, 600) : null, actions, outcome, ...(held ? { held } : {}) }
  })
}

/** The warning line on an option he warned off in another press (ideas.json `warning`, his words exactly, checked by
 *  board_feed.py cover): said first, before the idea, so he sees it before he presses. Empty when there is none. */
export function warned(o: Body): string {
  const w = isObj(o.warning) ? o.warning : null
  const said = w ? cut(w.said, 300) : ''
  return said ? `Warned: you said "${said}"${typeof w!.at === 'string' ? ` (${dayLabel(w!.at)})` : ''}. ` : ''
}

const dayLabel = (at: string) => {
  const d = new Date(`${at.slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? at.slice(0, 10) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 59)

/** The ideas board's own lines on a day, drawn after its options (the ideas quality plan, items 1 and 3): each subject
 *  he refused that the run will not offer again, with his words and one press to give it back ("Offer it again",
 *  queue/veto-<subject>, his alone), and each return or ask held back, with the reason. From ideas.json `vetoes` and
 *  `held`; a line with no day of its own goes on Monday. */
export function ideaLines(i: ExtrasInputs, day: string): ViewOption[] {
  const plan = isObj(i.ideas) ? i.ideas : {}
  const on = (d: unknown) => (typeof d === 'string' && ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(d) ? d : 'mon') === day
  const out: ViewOption[] = []
  for (const v of (Array.isArray(plan.vetoes) ? plan.vetoes : []).filter(isObj)) {
    const subject = cut(v.subject, 120), slug = slugOf(subject)
    if (!subject || !slug || !on(v.day)) continue
    const id = `veto-${slug}`
    const back = his(i.queue).find(q => q.doc_id === id && isObj(q.body) && typeof q.body.unveto === 'string')
    out.push({ id, doc_id: id, title: `Not offered again: ${subject}`, format: null, source: null, said: cut(v.said, 600) || null, outcome: null,
      text: `You said${typeof v.at === 'string' ? ` on ${dayLabel(v.at)}` : ''}: "${cut(v.said, 400)}" The ideas run will not offer it until you raise it again.`,
      status: back ? 'given back' : 'not offered again',
      actions: back ? [] : [{ kind: 'press', label: 'Offer it again', collection: 'queue', id, revision: rev(i.queue, id),
        body: { pick: id, queued: false, unveto: subject }, stamp: ['at'], done: 'Given back. The next ideas run may offer it again.' }] })
  }
  for (const h of (Array.isArray(plan.held) ? plan.held : []).filter(isObj)) {
    const ref = cut(h.ref, 160)
    if (!ref || !on(h.day)) continue
    out.push({ id: `held-${slugOf(ref)}`, doc_id: `held-${slugOf(ref)}`, title: `Held back: ${cut(h.title, 200) || ref}`, text: cut(h.reason, 600),
      format: null, source: null, status: 'held back', said: null, actions: [], outcome: null })
  }
  return out
}

const headlineOf = (story: string) => { const m = /Headline:\s*(.+?)(?:\s+Hook:|$)/.exec(story); return m ? cut(m[1], 200) : '' }
function nextMonday(week: string): string { const d = new Date(`${week}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10) }

/** The verdict on one side of an off-day option, read as the full board reads it: only a side bound to what is shown now. */
function sideOf(b: Body | undefined, side: string, sha: string | null): Body | null {
  return isObj(b) && isObj(b[side]) && (b[side] as Body).sha256 === sha ? b[side] as Body : null
}

/** The approval that stands for an off-day option, while it still covers the words shown (its hash), or null. */
export function offdayApproval(approvals: Approval[] | null, day: string, o: Body): { approval: Approval | null; changed: boolean } {
  const s = offdaySides(o)
  const a = (approvals || []).find(x => x.doc === `queue/off-${day}-${s.id}`) || null
  if (!a) return { approval: null, changed: false }
  const covers = !a.option_sha256 || a.via === 'recorded' || a.option_sha256 === s.idea_sha256 || a.option_sha256 === s.copy_sha256
  return covers ? { approval: a, changed: false } : { approval: null, changed: true }
}

/** The week's off-day options for a day, each as the full board shows it, with the five presses on its idea saved to the
 *  same queue/off-<day>-<id> record the full board writes (week_board.py; the desk's ReviewCard). Approve puts it on the
 *  publish board for its day; Growth makes it. An option a session wrote as decided is held until he presses: his words
 *  in a session are shown, never read as his press (Krish, 2026-11-11: only his Approved crosses). */
export function offdayOptions(i: ExtrasInputs, day: string): ViewOption[] {
  const list = isObj(i.ideas) && isObj(i.ideas.offdays) && Array.isArray(i.ideas.offdays[day]) ? (i.ideas.offdays[day] as unknown[]).filter(isObj) : []
  return list.map(o => {
    const s = offdaySides(o)
    const docId = `off-${day}-${s.id}`
    const row = his(i.queue).find(q => q.doc_id === docId)
    const prev = row?.body
    const idea = sideOf(prev, 'idea', s.idea_sha256), direction = sideOf(prev, 'direction', s.direction_sha256)
    const { approval, changed } = offdayApproval(i.approvals, day, o)
    const decided = typeof o.decided === 'string' && o.decided.trim() ? cut(o.decided, 300) : null
    const verdictOf = (v: Body | null) => (v && typeof v.verdict === 'string' ? v.verdict : null)
    const iv = verdictOf(idea), dv = verdictOf(direction)
    const pressed = iv && iv !== 'approve' ? OUTCOME_OF_VERDICT[iv] : undefined
    const held = changed ? 'Its words changed after you approved it, so your approval does not cover the new words.'
      : !approval && decided ? 'Words from a session say it was decided, but you have not pressed Approve on it here, so it is not on the publish board.'
        : !approval && iv === 'approve' ? 'Your approval of it could not be read just now, so it is not shown as approved.' : undefined
    const status = approval ? 'approved' : held ? 'held' : s.revised && !verdictOf(s.revised.side === 'direction' ? direction : idea) ? 'revised'
      : dv === 'improve' || iv === 'improve' ? 'improved'
        : iv === 'reject' || dv === 'reject' ? 'rejected'
          : iv === 'next_week' ? 'filed' : iv === 'trend' ? 'trend' : 'open'
    const words = [idea?.words, direction?.words, isObj(prev?.note) ? (prev!.note as Body).words : null].find(w => typeof w === 'string' && w.trim())
    // As the full board saves it; an empty format or source is left out (the board refuses an empty one).
    const base: Body = { pick: docId, use: 'offday', day, week: i.week, option_id: s.id, ...(s.format ? { format: s.format } : {}), ...(s.source ? { source: s.source } : {}), copy_sha256: s.copy_sha256 }
    const stamp: string[] = ['at']
    for (const side of ['idea', 'direction'] as const) {
      const sha = side === 'idea' ? s.idea_sha256 : s.direction_sha256
      if (!sha) continue
      const kept = side === 'idea' ? idea : direction
      if (kept) base[side] = kept
      else { base[side] = { verdict: null, words: null, sha256: sha }; stamp.push(`${side}.at`) }
    }
    if (isObj(prev?.note)) base.note = prev!.note
    if (isObj(prev?.mock)) base.mock = prev!.mock
    const ASK: Record<string, string> = { improve: 'What would make it a piece later?', reject: 'Why not? The next ideas run learns from your reason.', trend: 'Which trend is it part of?' }
    const press = (side: 'idea' | 'direction', verdict: string, label: string, done: string, outcome?: Outcome): PressAction => {
      const sha = side === 'idea' ? s.idea_sha256 : s.direction_sha256!
      const shown = verdict === 'approve' ? { shown: side === 'idea' ? s.shown_idea : s.direction } : {}
      const ask = side === 'idea' ? ASK[verdict] : verdict === 'improve' ? 'What should change?' : verdict === 'reject' ? 'Why not?' : ''
      return { kind: 'press', label, collection: 'queue', id: docId, revision: rev(i.queue, docId),
        body: { ...base, [side]: { verdict, words: null, sha256: sha, ...shown } },
        ...(ask ? { words: { path: `${side}.words`, ask, required: true } } : {}),
        stamp: [...stamp.filter(p => p !== `${side}.at`), `${side}.at`], done,
        ...(outcome ? { outcome, goes: goes(outcome, i.week, day, true) } : {}) }
    }
    const actions: PressAction[] = []
    const ideaOpen = !idea || s.revised?.side === 'idea'
    if (!approval || ideaOpen) {
      actions.push(
        press('idea', 'approve', `Approve for ${dayShort(i.week, day)}`, `Approved. It is on the publish board for ${dayWords(i.week, day)}; Growth makes it.`, 'approved'),
        press('idea', 'improve', 'Improve for a future piece', 'Kept with your note. The revise run also brings a new version back here.', 'improved'),
        press('idea', 'reject', 'Reject', 'Rejected, with your reason. The next ideas run learns from it.', 'rejected'),
        press('idea', 'trend', 'Save as a trend', 'Saved with its trend, for a wider piece.', 'trend'),
        press('idea', 'next_week', 'File for later', 'Filed for later. It comes back on a later ideas board.', 'filed'))
    } else if (s.direction_sha256 && (!direction || s.revised?.side === 'direction')) {
      actions.push(press('direction', 'approve', 'Approve the direction', 'Approved. Growth makes it.'), press('direction', 'improve', 'Improve the direction', 'Saved. The revise run brings the new version back here.'),
        press('direction', 'reject', 'Reject the direction', 'Rejected, with your reason.'))
    }
    const pitch = s.pitch ? [s.pitch.see, s.pitch.lands].filter(Boolean).join(' ') : ''
    const ownWords = typeof words === 'string' ? cut(words, 600) : s.revised ? `Revised from your words: ${cut(s.revised.words, 400)}` : null
    const said = !approval && decided ? `Said in a session, not pressed here: ${decided}` : approval ? approval.words || ownWords : ownWords
    const outcome = approval ? { id: 'approved' as const, label: approvedLabel(approval), at: approval.decided_at, words: approval.words }
      : pressed ? { id: pressed, label: OUTCOMES[pressed], at: typeof (idea as Body | null)?.at === 'string' ? String((idea as Body).at) : null, words: typeof idea?.words === 'string' ? idea.words : null } : null
    const out: ViewOption = { id: s.id, doc_id: docId, title: s.hook || cut(s.copy, 200) || s.id, text: cut(pitch || s.copy, 600), format: s.format || null,
      source: s.source || null, status, said, actions, outcome, ...(held ? { held } : {}) }
    if (o.weekly) {
      const stories = Array.isArray(o.stories) ? o.stories.filter(isObj) : []
      out.stories = stories.slice(0, 8).map(st => {
        const src = isObj(st.source) ? st.source : {}, media = isObj(st.media) ? st.media : {}
        const href = https(src.url), m = https(media.url)
        return { headline: cut(st.headline, 200), what: cut(st.what, 600), date: typeof st.date === 'string' ? st.date : null,
          source: cut(src.label, 200) || null, ...(href ? { href } : {}), media_kind: typeof media.kind === 'string' ? media.kind : null, ...(m ? { media: m } : {}) }
      })
      out.stories_due = typeof o.stories_due === 'string' ? o.stories_due : null
      out.stories_fresh = storiesFresh(i.week, o)
    }
    return out
  })
}

/** The day's "Add your thoughts": a comment pinned to the day and its step, as the desk saved it (desk:<day>:<step>). */
export function thoughtPress(day: string, step: string): PressAction {
  return { kind: 'press', label: 'Add your thoughts', collection: 'comments', id: `desk-${day}-${step}-{t}`, revision: 0,
    body: { thread_id: '{id}', anchor: `desk:${day}:${step}` }, words: { path: 'text', ask: 'Your thoughts on this step', required: true }, stamp: ['at'],
    done: 'Saved on the board, pinned to this step.' }
}

/** His research pasted onto the piece (POST /api/board/<Monday>/material): filed as the desk filed a dropped file. */
export function materialPress(pieceId: string): PressAction {
  return { kind: 'press', label: 'Paste research', op: 'material', body: { piece_id: pieceId, title: 'Research' },
    words: { path: 'content', ask: 'Paste your research (Markdown is fine)', required: true }, stamp: [], done: 'Filed on the piece. Every later step reads it.' }
}

/** His yes for a series day on the board (picks/yes-<day>-board): one yes anywhere (Ruling, Krish, 2026-11-02). */
export function yesPress(i: ExtrasInputs, day: string): PressAction {
  const id = `yes-${day}-board`
  return { kind: 'press', label: 'Yes, post it', collection: 'picks', id, revision: rev(i.picks, id),
    body: { kind: 'yes', day, via: 'board', approved: true }, stamp: ['at'], done: 'Approved. Growth posts it on the day.' }
}

/** Every press on a view, for the tests: each must be a body the board accepts once filled in. */
export function fillPress(a: PressAction, words: string, at: string): { id: string; body: Body } {
  const id = (a.id || '').replace('{t}', 'test1')
  const body = JSON.parse(JSON.stringify(a.body)) as Body
  for (const [k, v] of Object.entries(body)) if (v === '{id}') body[k] = id
  const set = (path: string, value: unknown) => {
    const keys = path.split('.'); let o: Body = body
    for (const k of keys.slice(0, -1)) { if (!isObj(o[k])) o[k] = {}; o = o[k] as Body }
    o[keys[keys.length - 1]] = value
  }
  if (a.words && words) set(a.words.path, words)
  for (const p of a.stamp) set(p, at)
  return { id, body }
}
