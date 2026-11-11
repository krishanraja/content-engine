import { dayDate, type PostedDay } from './_posted.js'
import { offdaySides } from './_offdaySides.js'
import { yesByDay } from './_yes.js'

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

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const DAY_NAME: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
const SERIES_SLOT: Record<string, string> = { mon: 'follow_the_money', wed: 'under_the_hood', fri: 'mind_the_gap' }
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
}
export interface ViewPiece { id: string; title: string; series: string; state: string; published: boolean; on_day: boolean }
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
}

const his = <T extends { updated_by: string }>(rows: T[]) => rows.filter(r => r.updated_by === 'Krish')
const rev = (rows: Array<{ doc_id: string; revision?: number }>, id: string) => {
  const r = rows.find(x => x.doc_id === id)
  return r && Number.isInteger(r.revision) ? Number(r.revision) : 0
}

/** The Thursday of the week: the good news is found from then on (Ruling, Krish, 2026-11-07: "done later in the week so
 *  the good news is fresh"). */
export function thursdayOf(week: string): string { return dayDate(week, 'thu' as PostedDay) }

/** Whether a weekly good-news option holds this week's stories: five or more, found for a due date on or after the
 *  week's Thursday. Stories found for an earlier due date (the 7 November run filled the 9 November week's on Saturday)
 *  are last week's news. */
export function storiesFresh(week: string, o: Body): boolean {
  const stories = Array.isArray(o.stories) ? o.stories.filter(isObj) : []
  const due = typeof o.stories_due === 'string' ? o.stories_due : ''
  return stories.length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(due) && due >= thursdayOf(week)
}

/** Every piece on the day, the one the day shows first marked. */
export function dayPieces(pieces: Body[], date: string, shown: string | null): ViewPiece[] {
  return pieces.filter(p => p.scheduled_for === date && !p.buried_at && p.state !== 'dropped' && typeof p.id === 'string')
    .map(p => {
      const id = String(p.id).toLowerCase()
      return { id, title: cut(p.idea || p.thesis || 'Untitled', 140), series: String(p.lane_slot || ''), state: String(p.state || ''),
        published: p.state === 'published' || Boolean(p.published_at), on_day: id === shown }
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

/** The Sunday room's options for a series day, each with his pick, his press on it and the presses that answer it. */
export function seriesOptions(i: ExtrasInputs, day: string, placed: boolean): ViewOption[] {
  const list = isObj(i.ideas) && isObj(i.ideas.days) && Array.isArray(i.ideas.days[day]) ? (i.ideas.days[day] as unknown[]).filter(isObj) : []
  const picked = his(i.picks).find(p => p.doc_id === day && !('kind' in p.body))
  return list.map((o, n) => {
    const pick = `${day}-${n + 1}`
    const press = his(i.queue).find(q => q.doc_id === pick)?.body
    const isPick = picked?.body.pick === pick || (typeof picked?.body.idea_id === 'string' && picked.body.idea_id === o.id)
    const status = isPick ? 'picked' : typeof press?.use === 'string' ? press.use : 'open'
    const said = isPick && typeof picked?.body.note === 'string' ? picked.body.note : typeof press?.note === 'string' ? press.note : typeof press?.reason === 'string' ? press.reason : null
    const story = String(o.story || o.so_what || '')
    const card = { pick, idea_id: typeof o.id === 'string' ? o.id : null, so_what: cut(o.so_what, 2000), story, series: SERIES_SLOT[day], week: i.week, day }
    const use = (u: string, label: string, done: string, words?: PressAction['words'], extra: Body = {}): PressAction => ({
      kind: 'press', label, collection: 'queue', id: pick, revision: rev(i.queue, pick),
      body: { ...card, queued: true, use: u, ...extra }, ...(words ? { words } : {}), stamp: ['at'], done })
    const actions: PressAction[] = []
    if (!placed && !isPick) {
      actions.push({ kind: 'press', label: `Pick for ${DAY_NAME[day]}`, collection: 'picks', id: day, revision: rev(i.picks, day),
        body: { day, pick, idea_id: card.idea_id, series: SERIES_SLOT[day], story }, stamp: ['at'],
        words: { path: 'note', ask: 'Anything the story must do? (optional)', required: false }, done: `Picked for ${DAY_NAME[day]}.` })
    }
    actions.push(
      use('wider_piece_context', 'Part of a wider piece', 'Kept for a wider piece.', { path: 'note', ask: 'What is the wider piece? (optional)', required: false }),
      use('track_over_time', 'Track it over time', 'Kept to track over time.', { path: 'note', ask: 'What to watch for? (optional)', required: false }),
      use('next_week', 'Next week', 'Queued for next week.', undefined, { target_week: nextMonday(i.week) }),
      use('not_for_us', 'Not for us', 'Rejected, with your reason.', { path: 'reason', ask: 'Why not?', required: true }),
    )
    return { id: String(o.id || pick), doc_id: pick, title: headlineOf(story) || cut(o.so_what, 200), text: cut(o.so_what, 600),
      format: null, source: isObj(o.source) ? cut(o.source.label, 200) || null : typeof o.source === 'string' ? cut(o.source, 200) : null,
      status, said: said ? cut(said, 600) : null, actions }
  })
}

const headlineOf = (story: string) => { const m = /Headline:\s*(.+?)(?:\s+Hook:|$)/.exec(story); return m ? cut(m[1], 200) : '' }
function nextMonday(week: string): string { const d = new Date(`${week}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10) }

/** The verdict on one side of an off-day option, read as the full board reads it: only a side bound to what is shown now. */
function sideOf(b: Body | undefined, side: string, sha: string | null): Body | null {
  return isObj(b) && isObj(b[side]) && (b[side] as Body).sha256 === sha ? b[side] as Body : null
}

/** The week's off-day options for a day, each as the full board shows it, with Approve, Improve, Reject and Next week
 *  pressing the same queue/off-<day>-<id> record the full board writes (week_board.py; the desk's ReviewCard). An option
 *  the week's plan records as decided in his words is decided: it carries no press. */
export function offdayOptions(i: ExtrasInputs, day: string): ViewOption[] {
  const list = isObj(i.ideas) && isObj(i.ideas.offdays) && Array.isArray(i.ideas.offdays[day]) ? (i.ideas.offdays[day] as unknown[]).filter(isObj) : []
  return list.map(o => {
    const s = offdaySides(o)
    const docId = `off-${day}-${s.id}`
    const row = his(i.queue).find(q => q.doc_id === docId)
    const prev = row?.body
    const idea = sideOf(prev, 'idea', s.idea_sha256), direction = sideOf(prev, 'direction', s.direction_sha256)
    const decided = typeof o.decided === 'string' && o.decided.trim() ? cut(o.decided, 300) : null
    const verdictOf = (v: Body | null) => (v && typeof v.verdict === 'string' ? v.verdict : null)
    const status = decided ? 'decided' : s.revised && !verdictOf(s.revised.side === 'direction' ? direction : idea) ? 'revised'
      : verdictOf(direction) === 'improve' || verdictOf(idea) === 'improve' ? 'improve'
        : verdictOf(idea) === 'reject' || verdictOf(direction) === 'reject' ? 'rejected'
          : verdictOf(idea) === 'next_week' ? 'next_week' : verdictOf(idea) === 'approve' ? 'approved' : 'open'
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
    const press = (side: 'idea' | 'direction', verdict: string, label: string, done: string): PressAction => {
      const sha = side === 'idea' ? s.idea_sha256 : s.direction_sha256!
      const shown = verdict === 'approve' ? { shown: side === 'idea' ? s.shown_idea : s.direction } : {}
      const ask = verdict === 'improve' ? 'What should change?' : verdict === 'reject' ? 'Why not?' : ''
      return { kind: 'press', label, collection: 'queue', id: docId, revision: rev(i.queue, docId),
        body: { ...base, [side]: { verdict, words: null, sha256: sha, ...shown } },
        ...(ask ? { words: { path: `${side}.words`, ask, required: true } } : {}),
        stamp: [...stamp.filter(p => p !== `${side}.at`), `${side}.at`], done }
    }
    const actions: PressAction[] = []
    if (!decided) {
      const ideaOpen = !idea || s.revised?.side === 'idea'
      if (ideaOpen || verdictOf(idea) !== 'approve') {
        actions.push(press('idea', 'approve', 'Approve', 'Approved. Growth makes it.'), press('idea', 'improve', 'Improve', 'Saved. The revise run brings the new version back here.'),
          press('idea', 'reject', 'Reject', 'Rejected, with your reason.'), press('idea', 'next_week', 'Next week', 'Moved to next week.'))
      } else if (s.direction_sha256 && (!direction || s.revised?.side === 'direction')) {
        actions.push(press('direction', 'approve', 'Approve the direction', 'Approved. Growth makes it.'), press('direction', 'improve', 'Improve the direction', 'Saved. The revise run brings the new version back here.'),
          press('direction', 'reject', 'Reject the direction', 'Rejected, with your reason.'))
      }
    }
    const pitch = s.pitch ? [s.pitch.see, s.pitch.lands].filter(Boolean).join(' ') : ''
    const out: ViewOption = { id: s.id, doc_id: docId, title: s.hook || cut(s.copy, 200) || s.id, text: cut(pitch || s.copy, 600), format: s.format || null,
      source: s.source || null, status, said: decided || (typeof words === 'string' ? cut(words, 600) : s.revised ? `Revised from your words: ${cut(s.revised.words, 400)}` : null), actions }
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
