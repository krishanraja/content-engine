import type { SupabaseClient } from '@supabase/supabase-js'
import { dayDate, piecesByDay, SERIES_DAYS, type PostedDay } from './_posted.js'
import { liveDay, type LiveDay } from './_live.js'
import { yesByDay } from './_yes.js'
import { readRuns, ENGINE_REPO, type JobName, type RunInfo } from './_run.js'
import { offdaySides, type OffdaySides } from './_offdaySides.js'
import type { MediaItem } from './_media.js'
import { mediaWithAnswers } from './_cuts.js'
import { VIEW_CONTRACT_VERSION } from './_viewContract.js'
import { liveBoardUrl } from './_liveBoard.js'
import { ARC, FREEDOM, mockPrompt, researchPrompt, storyPrompt, storyboardPrompt, stepPrompt, type PieceBrief } from './_prompts.js'
import { dayComments, dayPieces, dayPosted, dayYes, ideaLines, materialPress, offdayApproval, offdayOptions, seriesOptions, storiesFresh, thoughtPress, yesPress,
  type PressAction, type ViewComment, type ViewOption, type ViewPiece, type ViewPosted, type ViewYes } from './_viewExtras.js'
import { HELD_CHANGED, HELD_TITLE, approvedLabel, asSentence, cutSoWhat, dayShort, dayWords, gatePieces, goes, optionSha, readApprovals, type Approval, type Held } from './_gate.js'
import { attachOverlay, readOverlay, withWriteBack, type Overlay, type ViewMaterial, type ViewSession } from './_writeBack.js'
import { dayStyle, motionBank, type DayStyle, type MotionModule } from './_style.js'
import { ownerDriveToken, weekPosts, type DrivePost, type PostAsset } from './_drivePosts.js'

// The live board ("The Desk", /board/<Monday> since 10 Nov 2026; /board/next/<Monday> still serves it): one view of the week as it stands now, built on every read from the
// pieces' making records, his presses on the board, the week's plan files on main and the runs on GitHub. Nothing is a
// snapshot. docs/plans/2026-11-09-board-desk/PLAN.md.
//
// The rule (Krish, 2026-11-09): "I should always open it with something to do for each piece or for the week, unless
// the day or the week is complete", and "Absolutely everything that isn't 100% complete needs an action button". So
// every day that is not done carries exactly one next step, and that step carries at least one action; viewProblems()
// refuses a view that breaks this, and the tests hold every state to it. An action names the machine that does the
// work: a run on GitHub (_run.ts), a press on the board, a link to what to read or watch, or, only for work that is a
// conversation with Krish, the prompt for a new session.
//
// The ideas gate (docs/PUBLISH_BOARDS.md, "The ideas gate"; Krish, 2026-11-11: "I shouldn't end up seeing random ideas
// in the publish board that I never wanted there and that I didn't approve"): a day draws only the pieces his approval
// holds there (_gate.ts gatePieces, the same rule the database holds every writer to), each says "Approved by you" and
// when, and every other piece on the day is a visible held line (`held`) with a press to approve it, never hidden.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
export const VIEW_DAYS: readonly PostedDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const SERIES: Record<string, string> = { mon: 'follow.the.money', wed: 'under.the.hood', fri: 'mind.the.gap' }
const DAY_NAME: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' }
export const STOPS = ['Idea', 'Story', 'Make', 'Approve', 'Live'] as const
/** What a series piece makes: the essay with a long and a short cut, so its motion style must be made for both. */
const SERIES_FORMATS = ['long_video', 'short_video']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Who = 'you' | 'engine' | 'growth' | 'stuck' | 'done'
export type Action =
  | { kind: 'run'; label: string; job: JobName; input: Record<string, unknown>; runs_on: string }
  | { kind: 'open'; label: string; href: string }
  | { kind: 'prompt'; label: string; prompt: string }
  | { kind: 'review'; label: string }
  | { kind: 'research'; label: string; piece_id: string }
  | { kind: 'look'; label: string; piece_id: string }
  | PressAction
export interface DayView {
  day: PostedDay
  date: string
  label: string
  kind: string
  series: string
  title: string
  piece_id: string | null
  stop: number
  who: Who
  next: string
  runs_on: string
  actions: Action[]
  run?: RunInfo
  detail: Array<{ h: string; p: string }>
  /** A revised off-day option, shown whole, with what a press on it must carry (the full board's record). */
  reviews?: Array<{ doc_id: string; revision: number | null; side: string; option: OffdaySides; prev: Body | null }>
  /** A series day's guided path (PLAN.md, "Each day as a guided path"): six steps, one current, and what each needs. */
  path?: DayPath
  /** What the day's piece has rendered (cuts, thumbnails), newest first; ids only, signed at /api/board/<week>/media/<id> (_media.ts).
   *  Contract 1.6.0: each cut carries his Yes and Not this and his latest answer on it (_cuts.ts). */
  media: MediaItem[]
  /** Contract 1.2.0 (_viewExtras.ts): every piece on the day, the day's options with their presses, his comments, what
   *  Growth posted and his yes. */
  pieces: ViewPiece[]
  options: ViewOption[]
  comments: ViewComment[]
  posted: ViewPosted[]
  yes: ViewYes | null
  /** The sessions reporting on the day's piece or the day, working first (_writeBack.ts; contract 1.1.0). */
  sessions: ViewSession[]
  /** What is on file for the day's piece and the day in the piece materials store, newest first; read through
   *  /api/content-ideas/store?op=read&id=<id> (api/_pieceStore.ts; contract 1.1.0). */
  materials: ViewMaterial[]
  /** Contract 1.3.0, the ideas gate: every piece or option on the day that his approval does not hold there, and why.
   *  Never hidden: "Held: not approved by you". */
  held: Held[]
  /** Contract 1.7.0 (_drivePosts.ts): every post folder of the day in Drive's 3 Posts with everything made in it, each
   *  asset with its Drive file, a carousel's slides in order and its older versions; the post bound to an option says
   *  which (`option`), the one the day's piece files into says which (`piece_id`). Null when Drive could not be read. */
  posts: ViewPost[] | null
}
/** A post folder of a day, as the view carries it (contract 1.7.0). */
export interface ViewPost { id: string; name: string; url: string; option: string | null; piece_id: string | null; assets: PostAsset[] }
/** What a day's next step is built from, before the parts every day carries (media, and 1.2.0's extras). */
export type DayCore = Omit<DayView, 'media' | 'pieces' | 'options' | 'comments' | 'posted' | 'yes' | 'sessions' | 'materials' | 'held' | 'posts'>
export type PathKey = 'research' | 'story' | 'look' | 'board' | 'record' | 'cut'
export const PATH: Array<{ key: PathKey; label: string }> = [
  { key: 'research', label: 'Research' }, { key: 'story', label: 'Story' }, { key: 'look', label: 'Look' },
  { key: 'board', label: 'Storyboard and script' }, { key: 'record', label: 'Record' }, { key: 'cut', label: 'Cut and publish' },
]
/**
 * The steps from idea to publish (contract 1.5.0; approved mock M5: "Steps from idea to publish: Ideas, Agreed, Flesh
 * out, Script and record, After recording, Ready to post", each with its day). The working steps (PATH) stay as they
 * are, for the next step and the prompts; these are what a person reads, each from the same record.
 */
export type StageKey = 'idea' | 'agreed' | 'flesh_out' | 'script_record' | 'after_recording' | 'ready_to_post'
export const STAGES: Array<{ key: StageKey; label: string }> = [
  { key: 'idea', label: 'Ideas' }, { key: 'agreed', label: 'Agreed' }, { key: 'flesh_out', label: 'Flesh out' },
  { key: 'script_record', label: 'Script and record' }, { key: 'after_recording', label: 'After recording' }, { key: 'ready_to_post', label: 'Ready to post' },
]
/** One step from idea to publish: `when` is the day it happened (from the record) or, for Ready to post, the day it
 *  goes out; null when the record does not say. Never a guessed day. */
export interface Stage { key: StageKey; label: string; state: 'done' | 'current' | 'todo'; when: string | null }

/** A YYYY-MM-DD day moved by n days. */
const shiftYmd = (ymd: string, n: number): string => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

/** A record's time as its day (YYYY-MM-DD), or null. */
const dayOf = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && Number.isFinite(Date.parse(v)) ? v.slice(0, 10) : null)

/** The day a narrative lock was signed, from its last line ("Signed by Krish: "...", 2026-11-08"), or null. */
export function lockSignedOn(text: string | null | undefined): string | null {
  if (!lockSigned(text)) return null
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  return LOCK_SIGNED.exec(lines[lines.length - 1])?.[2] ?? null
}

/** The steps from idea to publish, from what is done (a later step done means every one before it is) and the days the
 *  record holds. Pure. */
export function stagesOf(i: {
  done: Record<StageKey, boolean>
  /** The Sunday the ideas were brought (the day before the week starts). */
  ideasOn: string
  agreedOn: string | null
  fleshedOn: string | null
  recordedOn: string | null
  cutOn: string | null
  /** The day the piece goes out. */
  goesOn: string
}): Stage[] {
  const done = { ...i.done }
  for (let k = STAGES.length - 1; k > 0; k--) if (done[STAGES[k].key]) done[STAGES[k - 1].key] = true
  const current = STAGES.find(s => !done[s.key])?.key ?? null
  const when: Record<StageKey, string | null> = {
    idea: i.ideasOn, agreed: done.agreed ? i.agreedOn : null, flesh_out: done.flesh_out ? i.fleshedOn : null,
    script_record: done.script_record ? i.recordedOn : null, after_recording: done.after_recording ? i.cutOn : null, ready_to_post: i.goesOn,
  }
  return STAGES.map(s => ({ ...s, state: done[s.key] ? 'done' : s.key === current ? 'current' : 'todo', when: when[s.key] }))
}

export interface LookOption { id: string; name: string; pitch: string; status: string }
export interface DayPath {
  steps: Array<{ key: PathKey; label: string; state: 'done' | 'current' | 'todo' }>
  current: PathKey | null
  materials: Array<{ id: string; title: string; kind: string; bytes: number; at: string | null }>
  research_file: boolean
  look: {
    recommended: { production: LookOption | null; experiment: LookOption | null; script: LookOption | null; why: string | null }
    options: LookOption[]
    picked: { production: string; experiment: string | null; inspiration: string[]; at: string } | null
  }
  inspiration: { cards: Array<{ id: string; name: string; words: string; saved: string | null }>; unread: number }
  prompts: { research: string; story: string; storyboard: string; mock: string }
  /** The session's storyboard filed on the piece (a material titled "Storyboard: ..."), or null. */
  storyboard: { title: string; at: string | null } | null
  /** Contract 1.4.0 (_style.ts): the piece's motion, caption and treatment choices, each option with its press. */
  style: DayStyle | null
  /** Contract 1.5.0: the steps from idea to publish, each with its day (stagesOf). */
  stages: Stage[]
}
export interface WeekView {
  /** The contract this view keeps (view.schema.json, x-contract-version; _viewContract.ts). */
  contract_version: string
  week: string
  as_of: string
  days: DayView[]
  yours: Array<{ key: string; day: PostedDay; label: string; next: string; actions: Action[]; review?: NonNullable<DayView['reviews']>[number] }>
  moved: Array<{ at: string; text: string }>
  north_star: { current: number; target: number } | null
  runs: Partial<Record<JobName, RunInfo>>
  sources: Record<string, boolean>
  /** The week's change signal (board_signal.revision): bumped by every write the view reads, null when unread. */
  revision: number | null
}

export interface ViewInputs {
  week: string
  now: Date
  pieces: Body[]
  picks: Array<{ doc_id: string; body: Body; updated_by: string; updated_at?: string; revision?: number }>
  queue: Array<{ doc_id: string; body: Body; updated_by: string; updated_at?: string; revision?: number }>
  history: Array<{ collection: string; doc_id: string; updated_at: string; updated_by: string }>
  ideas: Body | null
  locks: Partial<Record<PostedDay, string | null>>
  runs: Partial<Record<JobName, RunInfo>>
  north_star: { current: number; target: number } | null
  /** Which series days have research in the week's folder (docs/plans/<week>-week/<day>-research.md). */
  research_files?: Partial<Record<PostedDay, boolean>>
  /** The engine's looks: config/style-references.json formats (script and production). */
  formats?: { script: LookOption[]; production: LookOption[] }
  /** The bank's motion styles: config/style-references.json, layer motion (contract 1.4.0). */
  motion?: MotionModule[]
  /** Each series day's creative direction (its plan folder's ve/spec.json or creative-direction.json), when on main. */
  specs?: Partial<Record<PostedDay, Body | null>>
  /** His production inspiration: cards with his own words first, and how many recent ones have none yet. */
  inspiration?: { cards: Array<{ id: string; name: string; words: string; saved: string | null }>; unread: number }
  /** His comments on the week (board_documents, comments) and Growth's ticks (board_ticks). */
  comments?: Array<{ doc_id: string; body: Body; updated_by: string; updated_at?: string }>
  ticks?: Array<{ tick_id: string; body: Body; updated_by: string }>
  /** The week's change signal (board_signal). */
  revision?: number | null
  /** The sessions and the materials store for the week's pieces and days (board_overlay; _writeBack.ts). */
  overlay?: Overlay | null
  /** The approvals that stand now (board_approvals_now, _gate.ts), or null when they cannot be read: then every piece
   *  is held. Required, so no caller builds a view that skips the gate. */
  approvals: Approval[] | null
  /** The week's post folders in Drive (_drivePosts.ts weekPosts), or null when Drive could not be read; left out, the
   *  view says Drive was not read. */
  drive_posts?: DrivePost[] | null
}

/** The day's post folders, each bound to the option whose `drive` names it and to the piece whose making record files
 *  into it (pack.folder): the bound ones first, then by name. Null when Drive could not be read. */
export function dayPosts(posts: DrivePost[] | null | undefined, date: string, options: ViewOption[], pieces: Body[]): ViewPost[] | null {
  if (!Array.isArray(posts)) return null
  const packOf = (p: Body) => { const m = isObj(p.meta) && isObj(p.meta.making) && isObj(p.meta.making.pack) ? p.meta.making.pack : null; return m && typeof m.folder === 'string' ? m.folder.trim() : '' }
  return posts.filter(p => p.date === date).map(p => {
    const option = options.find(o => o.post === p.id)?.id ?? null
    const piece = pieces.find(x => packOf(x) === p.name)
    return { id: p.id, name: p.name, url: p.url, option, piece_id: piece ? String(piece.id).toLowerCase() : null, assets: p.assets }
  }).sort((a, b) => Number(!a.option && !a.piece_id) - Number(!b.option && !b.piece_id) || a.name.localeCompare(b.name))
}

const LOCK_SIGNED = /^Signed by Krish\b[^:\n]*:\s*"(.+)"\s*,\s*(\d{4}-\d{2}-\d{2})\b/
/** Whether a narrative lock is signed: its last line that is not blank is his signature (making.py lock_signature). */
export function lockSigned(text: string | null | undefined): boolean {
  if (!text) return false
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const m = lines.length ? LOCK_SIGNED.exec(lines[lines.length - 1]) : null
  return Boolean(m && !/^<[^>]*>$/.test(m[1].trim()))
}

const short = (week: string, day: PostedDay) => {
  const d = new Date(`${dayDate(week, day)}T00:00:00Z`)
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()}`
}
const boardTab = (week: string, tab: string) => `/board/${week}#${tab}`
/** A day's options on the live board (the day's `options`, contract 1.2.0); the archive page reads it as the day. */
const optionsTab = (week: string, day: PostedDay) => boardTab(week, `options-${day}`)
const running = (r?: RunInfo) => Boolean(r && (r.state === 'queued' || r.state === 'running'))
const GH = (job: JobName) => `GitHub · ${job}.yml`

function stepState(live: LiveDay, key: string) { return live.steps.find(s => s.key === key)?.state }

/** Whether any channel is out. The publish step turns 'now' as soon as it is the first open step, before anything is
 * posted; only a step carrying the engine's channel count (its note, written once a channel is posted) means posting has
 * started. Wed 11 Nov showed "Posting: some channels are out" with nothing out (Krish, 2026-11-11: "so behind where we're
 * actually at"). */
export function postingStarted(live: Pick<LiveDay, 'steps'>): boolean {
  const step = live.steps.find(s => s.key === 'publish')
  return step?.state === 'now' && Boolean(step.note)
}

/** One series day (Mon, Wed, Fri): its piece's next step from the record, the lock and the runs. */
function seriesDay(i: ViewInputs, day: PostedDay, piece: Body | undefined): DayCore {
  const week = i.week, date = dayDate(week, day)
  const base = { day, date, label: short(week, day), kind: 'Essay and two cuts', series: SERIES[day], detail: [] as DayView['detail'] }
  if (!piece) {
    return { ...base, title: 'No piece picked yet', piece_id: null, stop: 0, who: 'you', runs_on: 'A press on the board',
      next: `Pick ${DAY_NAME[day]}'s idea from the options`, actions: [{ kind: 'open', label: 'Pick the idea', href: optionsTab(week, day) }] }
  }
  const id = String(piece.id).toLowerCase()
  const title = String(piece.idea || piece.thesis || 'Untitled').slice(0, 140)
  const live = liveDay(piece, date)
  const lock = i.locks[day]
  const signed = lockSigned(lock)
  const make = i.runs['make-piece']
  const meta = isObj(piece.meta) ? piece.meta : {}
  const scriptsApproved = i.picks.some(p => p.doc_id === `${day}-scripts` && p.updated_by === 'Krish' && p.body.approved === true && String(p.body.piece_id || '').toLowerCase() === id)
  // What the Sunday room wrote about the idea, and his note on his pick: the brief every prompt starts from.
  const ideaRow = (isObj(i.ideas) && isObj(i.ideas.days) && Array.isArray(i.ideas.days[day]) ? i.ideas.days[day] as Body[] : []).find(x => String(x.id).toLowerCase() === id)
  const pick = i.picks.find(p => p.doc_id === day && p.updated_by === 'Krish')
  const materials = (Array.isArray(meta.materials) ? meta.materials as Body[] : []).filter(isObj)
    .map(m => ({ id: String(m.id || ''), title: String(m.title || m.url || 'Untitled'), kind: String(m.kind || 'paste'), bytes: Number(m.bytes) || String(m.content || '').length, at: typeof m.at === 'string' ? m.at : null }))
  const researchFile = Boolean(i.research_files?.[day])
  const look = isObj(meta.look) && typeof meta.look.production === 'string' ? meta.look : null
  const brief: PieceBrief = {
    week, day, dayName: DAY_NAME[day], date, series: SERIES[day], pieceId: id, idea: String(ideaRow?.so_what || title),
    story: typeof ideaRow?.story === 'string' ? ideaRow.story : null,
    brief: typeof pick?.body.note === 'string' ? pick.body.note : null,
    materials: [...materials.map(m => m.title), ...(researchFile ? [`docs/plans/${week}-week/${day}-research.md`] : [])],
    lock: lock ? { path: `docs/plans/${week}-week/narrative-lock-${day}.md`, signed } : null,
    look: look ? { production: nameOf(i, String(look.production)), experiment: look.experiment ? nameOf(i, String(look.experiment)) : null, inspiration: Array.isArray(look.inspiration) ? look.inspiration.map(String) : [] } : null,
  }
  const style = isObj(ideaRow?.style) ? ideaRow!.style as Body : null
  const experiment = style && isObj(style.experiment) ? style.experiment as Body : null
  const rec = stepState(live, 'record'), vid = stepState(live, 'video'), pub = stepState(live, 'publish')
  const done: Record<PathKey, boolean> = {
    research: materials.length > 0 || researchFile || signed,
    story: signed,
    look: Boolean(look),
    board: scriptsApproved,
    record: rec === 'done',
    cut: live.verdict === 'done' || pub === 'done',
  }
  // A later step done means every step before it is done too: a piece recorded before the path existed is never sent back to Look.
  for (let k = PATH.length - 1; k > 0; k--) if (done[PATH[k].key]) done[PATH[k - 1].key] = true
  const current = PATH.find(s => !done[s.key])?.key ?? null
  const path: DayPath = {
    steps: PATH.map(s => ({ ...s, state: done[s.key] ? 'done' : s.key === current ? 'current' : 'todo' })),
    current, materials, research_file: researchFile,
    look: {
      recommended: { production: formatOf(i, style?.production), experiment: formatOf(i, experiment?.format), script: formatOf(i, style?.script), why: typeof experiment?.why === 'string' ? experiment.why : null },
      options: i.formats?.production || [],
      picked: look ? { production: String(look.production), experiment: look.experiment ? String(look.experiment) : null, inspiration: Array.isArray(look.inspiration) ? look.inspiration.map(String) : [], at: String(look.at || '') } : null,
    },
    inspiration: i.inspiration || { cards: [], unread: 0 },
    prompts: { research: researchPrompt(brief), story: storyPrompt(brief), storyboard: storyboardPrompt(brief), mock: mockPrompt(brief) },
    storyboard: (m => (m ? { title: m.title, at: m.at } : null))(materials.find(m => /^Storyboard:/.test(m.title))),
    style: null,
    stages: stagesOf({
      done: {
        idea: true, agreed: signed, flesh_out: done.research && done.look, script_record: done.board && done.record,
        after_recording: vid === 'done' || done.cut, ready_to_post: done.cut,
      },
      ideasOn: shiftYmd(week, -1),
      agreedOn: lockSignedOn(lock) ?? dayOf(pick?.updated_at),
      fleshedOn: look ? dayOf(look.at) : null,
      recordedOn: null,
      cutOn: null,
      goesOn: date,
    }),
  }
  // The style choices (contract 1.4.0): a spec on file for another piece is never read as this one's.
  const spec = (s => (s && (typeof s.piece_id !== 'string' || !UUID.test(s.piece_id) || s.piece_id.toLowerCase() === id) ? s : null))(i.specs?.[day] ?? null)
  const points = spec && isObj(spec.style) && Array.isArray(spec.style.points) ? spec.style.points.filter((p): p is string => typeof p === 'string') : []
  path.style = dayStyle({ pieceId: id, meta, formats: SERIES_FORMATS, points: points.length ? points : null, motion: i.motion || [],
    looks: i.formats?.production || [], recommendedLook: path.look.recommended.production?.id ?? null, gate: live.gates.style, spec })
  const detail: DayView['detail'] = [
    { h: 'Research', p: materials.length ? materials.map(m => m.title).join(' · ') : researchFile ? `${day}-research.md in the week's folder` : 'None yet' },
    { h: 'Narrative lock', p: signed ? 'Signed' : lock ? 'Written, waiting for your signature' : 'Not written yet' },
    { h: 'Look', p: look ? [nameOf(i, String(look.production)), look.experiment ? nameOf(i, String(look.experiment)) : ''].filter(Boolean).join(' + ') : 'Not picked yet' },
  ]
  const v = { ...base, title, piece_id: id, detail, path }
  const conversation = 'A conversation with you in a new Claude session'
  if (live.verdict === 'done') return { ...v, stop: 4, who: 'done', next: 'Published on every channel', runs_on: '', actions: [] }
  if (current === 'research') {
    return { ...v, stop: 1, who: 'you', runs_on: 'Perplexity sonar-pro on the engine, or your own research dropped here',
      next: 'Bring the evidence: research it now, or drop your Perplexity file on this day',
      actions: [{ kind: 'research', label: 'Research it now', piece_id: id }, { kind: 'prompt', label: 'Copy Perplexity prompt', prompt: path.prompts.research }, materialPress(id)] }
  }
  if (current === 'story') {
    return { ...v, stop: 1, who: 'you', runs_on: conversation,
      next: lock ? 'Read the narrative lock and sign it, or say what to change' : 'Settle the story in a short session, then sign the narrative lock',
      actions: [{ kind: 'prompt', label: 'Copy Claude prompt', prompt: path.prompts.story }] }
  }
  if (current === 'look') {
    return { ...v, stop: 2, who: 'you', runs_on: 'Your pick, here; a mock on your own footage if you want one',
      next: 'Pick the look: the recommended one, another, or fold in your inspiration',
      actions: [{ kind: 'look', label: 'Pick the look', piece_id: id }, { kind: 'prompt', label: 'Copy mock prompt', prompt: path.prompts.mock }] }
  }
  if (current === 'board') {
    const made = ['workroom', 'draft', 'scripts'].every(k => stepState(live, k) === 'done')
    const failed = live.steps.find(s => s.state === 'failed')
    if (made) {
      return { ...v, stop: 3, who: 'you', runs_on: 'Your press on the board, then the server sends them to your Teleprompter',
        // Remind, never refuse (Krish, 2026-11-09: "Remind"): no storyboard on file is said where he approves.
        next: path.storyboard ? 'Read the storyboard and both scripts, and approve them as one'
          : 'Approve the scripts. Reminder: no storyboard is on file yet; drop the session\'s storyboard here first, or approve anyway', actions: [{ kind: 'open', label: 'Read and approve', href: boardTab(week, day) }, { kind: 'prompt', label: 'Copy Claude prompt', prompt: path.prompts.storyboard }] }
    }
    return { ...v, stop: 2, who: failed ? 'stuck' : 'you', runs_on: `${conversation}, or ${GH('make-piece')}`, ...(make ? { run: make } : {}),
      next: failed ? `${failed.key} failed${failed.note ? `: ${failed.note}` : ''}. Make it again` : 'Make the storyboard and the script together, before you record',
      actions: [{ kind: 'prompt', label: 'Copy Claude prompt', prompt: path.prompts.storyboard },
        { kind: 'run', label: 'Run the make on GitHub', job: 'make-piece', input: { piece_id: id }, runs_on: GH('make-piece') }] }
  }
  if (current === 'record') {
    return { ...v, stop: 3, who: 'you', runs_on: 'You, then your home computer places each take on its piece',
      next: 'Record both cuts from your Teleprompter; each take files itself', actions: [{ kind: 'open', label: 'Open Teleprompter', href: 'https://app.teleprompter.com' }] }
  }
  if (vid !== 'done') {
    const cut = i.runs['produce-day']
    return { ...v, stop: 3, who: 'you', ...(cut ? { run: cut } : {}), runs_on: `Your home computer overnight, or ${GH('produce-day')}`,
      next: 'Both takes are in. Cut the videos now, or let tonight\'s overnight run do it',
      actions: [{ kind: 'run', label: 'Cut the videos now', job: 'produce-day', input: { date, piece: id }, runs_on: GH('produce-day') }] }
  }
  const posting = postingStarted(live)
  // His yes for the day (one yes anywhere: a board yes, his typed words carried from a session, or Approve for publish)
  // means the day is approved: nothing is left for him to press (Krish, 2026-11-11: "I don't want you to give me back
  // work to do, buttons to click on the publish board").
  const yes = yesByDay(i.picks)[day]
  if (!posting && yes?.approved) {
    return { ...v, stop: 4, who: 'growth', runs_on: 'Growth posts it on the day',
      next: `Approved${yes.via === 'words' ? ' in your words' : ''}. Ready to post: Growth posts it on the day`,
      actions: [{ kind: 'prompt', label: 'Copy prompt for Growth', prompt: `Post the ${DAY_NAME[day]} ${date} piece ${id} that Krish approved on the content-engine board (week of ${week}), from its 3 Posts folder.` }] }
  }
  return { ...v, stop: posting ? 4 : 3, who: 'growth', runs_on: 'Growth posts it, after your Approve for publish',
    next: posting ? 'Posting: some channels are out' : 'Watch both cuts and press Approve for publish',
    actions: [{ kind: 'open', label: 'Watch and approve', href: boardTab(week, day) }, ...(posting ? [] : [yesPress(i, day)])] }
}

function formatOf(i: ViewInputs, id: unknown): LookOption | null {
  if (typeof id !== 'string') return null
  return [...(i.formats?.production || []), ...(i.formats?.script || [])].find(f => f.id === id) || null
}
function nameOf(i: ViewInputs, id: string): string { return formatOf(i, id)?.name || id }

/** One off day (Tue, Thu, Sat): the options in the week's ideas.json and his verdicts on them. */
function offDay(i: ViewInputs, day: PostedDay, piece: Body | undefined): DayCore {
  const week = i.week, date = dayDate(week, day)
  const options = (isObj(i.ideas) && isObj(i.ideas.offdays) && Array.isArray(i.ideas.offdays[day]) ? i.ideas.offdays[day] : []) as Body[]
  const verdict = (o: Body) => i.queue.find(q => q.doc_id === `off-${day}-${String(o.id)}` && q.updated_by === 'Krish')?.body
  const sideVerdict = (b: Body | undefined, side: string) => (isObj(b) && isObj(b[side]) ? String((b[side] as Body).verdict || '') : '')
  // An option is chosen once his Approve on it stands (the ideas gate, _gate.ts): words a session wrote as decided in
  // ideas.json are shown on the option and never read as his press (Krish, 2026-11-11: only his Approved crosses). An
  // Improve he is waiting on still leads the day, so its revision comes back to him.
  const approvedNow = (o: Body) => offdayApproval(i.approvals, day, o).approval
  const decided = (o: Body) => typeof o.decided === 'string' && o.decided.trim().length > 0
  const said = options.map(o => ({ o, b: verdict(o) }))
  const chosen = said.filter(x => approvedNow(x.o) || sideVerdict(x.b, 'idea') === 'improve' || sideVerdict(x.b, 'direction') === 'improve')
  const state = (x: { o: Body; b?: Body }) => {
    const a = approvedNow(x.o)
    return a ? approvedLabel(a) : sideVerdict(x.b, 'idea') || (decided(x.o) ? 'said in a session, not pressed' : 'no press')
  }
  const base = { day, date, label: short(week, day), series: day === 'sat' ? 'good news' : 'off day', piece_id: piece ? String(piece.id).toLowerCase() : null,
    detail: said.map(x => ({ h: String(x.o.id), p: [x.o.format, state(x), x.o.revised ? 'revised' : ''].filter(Boolean).join(' · ') })) }
  if (piece) {
    const live = liveDay(piece, date)
    const title = String(piece.idea || 'Off-day piece').slice(0, 140)
    if (live.verdict === 'done') return { ...base, kind: 'Off-day piece', title, stop: 4, who: 'done', next: 'Published', runs_on: '', actions: [] }
  }
  if (!options.length) {
    if (day === 'sat') {
      const gn = i.runs['saturday-goodnews']
      return { ...base, kind: 'Good news', title: "This week's good news", stop: 0, who: 'engine', ...(gn ? { run: gn } : {}),
        runs_on: `${GH('sunday-ideas')}, with the week's ideas; ${GH('saturday-goodnews')} by hand`,
        next: running(gn) ? 'Finding the stories now' : 'The weekly ideas run brings the good news stories with the rest of the ideas; find them now if you want them sooner',
        actions: [{ kind: 'run', label: 'Find the stories now', job: 'saturday-goodnews', input: { week }, runs_on: GH('saturday-goodnews') }] }
    }
    const si = i.runs['sunday-ideas']
    return { ...base, kind: 'Off day', title: 'No options yet', stop: 0, who: 'engine', ...(si ? { run: si } : {}), runs_on: GH('sunday-ideas'),
      next: 'The Sunday ideas run writes the off-day options', actions: [{ kind: 'run', label: 'Write the options now', job: 'sunday-ideas', input: { week }, runs_on: GH('sunday-ideas') }] }
  }
  const lead = chosen[0]
  if (!lead) {
    return { ...base, kind: 'Off day', title: `${options.length} options to judge`, stop: 0, who: 'you', runs_on: 'Your presses on the board',
      next: 'Approve, improve or reject each option', actions: [{ kind: 'open', label: `Judge the ${options.length} options`, href: optionsTab(week, day) }] }
  }
  // The weekly good news (plan-week references/offdays.md, "The Saturday good news"): the weekly ideas run finds its
  // stories with the rest of the week's ideas (Ruling, Krish, 2026-11-11: the ideas board fills once a week in full,
  // Saturday's good news included); a format chosen without them waits on a run, and is never "stuck" meanwhile.
  const weekly = chosen.find(x => x.o.weekly)
  if (weekly) {
    const gnKind = `Off day: ${String(weekly.o.format || 'good news').split(',')[0]}`
    if (!storiesFresh(week, weekly.o)) {
      const gn = i.runs['saturday-goodnews']
      return { ...base, kind: gnKind, title: String(weekly.o.hook || "This week's good news").slice(0, 140), stop: 1, who: 'engine', ...(gn ? { run: gn } : {}),
        runs_on: `${GH('sunday-ideas')}, with the week's ideas; ${GH('saturday-goodnews')} by hand`,
        next: running(gn) ? 'Finding this week\'s good news stories now; they come back here' : 'This week\'s good news stories are not in yet: find them now and they come back here',
        actions: [{ kind: 'run', label: 'Find the stories now', job: 'saturday-goodnews', input: { week }, runs_on: GH('saturday-goodnews') }] }
    }
    const n = Array.isArray(weekly.o.stories) ? weekly.o.stories.length : 0
    return { ...base, kind: gnKind, title: String(weekly.o.hook || "This week's good news").slice(0, 140), stop: 2, who: 'growth', runs_on: 'Growth makes the post from the stories shown',
      next: `This week's good news is in: ${n} stories. Growth makes the post, and its mock comes back for your yes`,
      actions: [{ kind: 'open', label: 'Read the stories', href: optionsTab(week, day) },
        { kind: 'prompt', label: 'Copy prompt for Growth', prompt: `Make the ${DAY_NAME[day]} ${date} good-news post ${String(weekly.o.id)} from the ${n} stories on the content-engine board (week of ${week}), to docs/CAROUSEL-STANDARD.md.` }] }
  }
  // An Improve still waits on its revision, unless his words in a session settled the option (`decided`): that settles
  // what it waits on, never whether it is approved (Thu 12 Nov showed "Your Improve has not come back" on a card he had
  // signed off; Krish, 2026-11-11).
  const improving = (x: { o: Body; b?: Body }) => !decided(x.o) && (sideVerdict(x.b, 'idea') === 'improve' || sideVerdict(x.b, 'direction') === 'improve')
  const waiting = chosen.filter(x => improving(x) && !x.o.revised)
  const o = lead.o, kind = `Off day: ${String(o.format || 'option').split(',')[0]}`
  const title = waiting.length > 1 ? `${waiting.length} options waiting on your Improve: ${waiting.map(x => String(x.o.id)).join(', ')}` : String(o.hook || o.copy || o.id).slice(0, 140)
  const improve = improving(lead)
  const rev = i.runs['offday-revise']
  if (improve && !o.revised) {
    return { ...base, kind, title, stop: 2, who: 'stuck', ...(rev ? { run: rev } : {}), runs_on: GH('offday-revise'),
      next: running(rev) ? 'A revise run is going on GitHub now; the revised version comes back here when it ends' : 'Your Improve has not come back as a revision yet. Run it, and the revised version comes back here',
      actions: [{ kind: 'run', label: 'Run my Improve', job: 'offday-revise', input: { week, option: `off-${day}-${String(o.id)}` }, runs_on: GH('offday-revise') }] }
  }
  // A revised mock is judged on the full board, where the mock plays; the page judges the idea and the direction.
  const back = chosen.filter(x => improving(x) && x.o.revised && (x.o.revised as Body).side !== 'mock')
  if (back.length && !waiting.length) {
    const reviews = back.map(x => {
      const docId = `off-${day}-${String(x.o.id)}`, row = i.queue.find(q => q.doc_id === docId), sides = offdaySides(x.o)
      return { doc_id: docId, revision: row && Number.isInteger(row.revision) ? Number(row.revision) : null, side: sides.revised?.side || 'idea', option: sides, prev: row ? row.body : null }
    })
    return { ...base, kind, title: back.length > 1 ? `${back.length} revised options: ${back.map(x => String(x.o.id)).join(', ')}` : title, stop: 3, who: 'you',
      runs_on: 'Your press, here: the same record as the full board',
      next: back.length > 1 ? `${back.length} revised versions are back. Approve, improve again or reject each` : 'The revised version is back. Approve it, improve it again or reject it',
      reviews, actions: [{ kind: 'review', label: back.length > 1 ? `Review the ${back.length} revised versions` : 'Review the revised version' }] }
  }
  return { ...base, kind, title, stop: 2, who: 'growth', runs_on: 'Growth makes the approved off-day post',
    next: 'Approved. Growth makes it and posts it on the day',
    actions: [{ kind: 'prompt', label: 'Copy prompt for Growth', prompt: `Make the ${DAY_NAME[day]} ${date} off-day post ${String(o.id)} that Krish approved on the content-engine board (week of ${week}), to docs/CAROUSEL-STANDARD.md.` }] }
}

/** The Claude prompt for a day's next step (Krish, 2026-11-09: "every next action needs to have a Claude prompt as at
 *  least a backup", for the quick back-and-forth such as building an idea into a storyboard). It names the piece, the
 *  step and where its record lives, so a new session starts on the exact step, asks him only what it needs, one question
 *  at a time, and records what they settle on the piece. */
export function backupPrompt(week: string, d: DayView): string {
  const where = [
    d.piece_id ? `- the piece's making record: python3 scripts/post-pack/making.py ${d.piece_id} show` : '',
    `- the week's plan, ideas and off-day options: docs/plans/${week}-week/ (ideas.json, and the offday-revise/${week} branch when it exists)`,
    `- Krish's presses on the board: GET /api/board/${week}/view; the live board, where he works, is ${liveBoardUrl(week, d.day).replace(/^https:\/\//, '')}`
      + ` (content.krishraja.com/board/${week} is the archive; the view carries no https link, by the media rule)`,
  ].filter(Boolean).join('\n')
  const options = d.reviews?.length ? `\nWhat waits on him: ${d.reviews.map(r => r.doc_id).join(', ')} (revised from his words).` : ''
  return 'You are picking up one day of the Make Your Mind Up content engine with no prior context. The repository is krishanraja/content-engine: '
    + 'read AGENTS.md and CLAUDE.md once for the house rules, then trust your judgement.\n\n'
    + `The day: ${d.label} (${d.series}, ${d.kind}): ${d.title}.\nWhere it stands: ${d.next}.${options}\n\nWhere everything lives:\n${where}\n\n`
    + `${ARC}\n\n${FREEDOM}\n\nShow Krish what you made in one message before anything is sent or published.`
}

function briefOf(i: ViewInputs, d: DayView): PieceBrief {
  return { week: i.week, day: d.day, dayName: DAY_NAME[d.day], date: d.date, series: d.series, pieceId: d.piece_id || '', idea: d.title,
    materials: d.path?.materials.map(m => m.title) || [], lock: null }
}

/** His Approve for a held piece that is not one of the day's options (an option carries its own): one press puts
 *  exactly that piece on exactly that day, bound to its words, as an Approve on the ideas board does. */
function approveHeldPress(i: ViewInputs, day: PostedDay, piece: Body): PressAction {
  const id = String(piece.id).toLowerCase()
  const so_what = cutSoWhat(piece.thesis), story = String(piece.idea || piece.thesis || '')
  const title = story.trim().replace(/\s+/g, ' ').slice(0, 60)
  const revision = i.picks.find(p => p.doc_id === day)?.revision
  return { kind: 'press', label: `Approve "${title}" for ${dayShort(i.week, day)}`, collection: 'picks', id: day, revision: Number.isInteger(revision) ? Number(revision) : 0,
    body: { day, pick: `held-${id.slice(0, 8)}`, idea_id: id, series: SERIES[day]?.replace(/\./g, '_') || '', story, so_what, option_sha256: optionSha({ so_what, story }) },
    stamp: ['at'], words: { path: 'note', ask: 'Anything the story must do? (optional)', required: false },
    done: `Approved. It is on the publish board for ${dayWords(i.week, day)}.`, outcome: 'approved', goes: goes('approved', i.week, day) }
}

/** The whole week's view from its inputs. Pure: the tests build every state from here. */
export function buildView(i: ViewInputs): WeekView {
  // The ideas gate: only the pieces his approval holds on their day are drawn; every other one is a held line.
  const gate = gatePieces(i.week, i.pieces, i.approvals, i.ideas)
  const byDay = new Map(piecesByDay(i.week, gate.approved).map(p => [p.day, p.piece]))
  const days = attachOverlay(i.week, VIEW_DAYS.map((d): Omit<DayView, 'sessions' | 'materials'> => {
    const piece = byDay.get(d), date = dayDate(i.week, d)
    const shown = piece ? String(piece.id).toLowerCase() : null
    const core = SERIES_DAYS.includes(d) ? seriesDay(i, d, piece) : offDay(i, d, piece)
    const options = [...(SERIES_DAYS.includes(d) ? seriesOptions(i, d, Boolean(piece)) : offdayOptions(i, d)), ...ideaLines(i, d)]
    const approval = shown ? gate.approvalOf.get(shown) : undefined
    if (approval) core.detail = [{ h: approval.via === 'approve_publish' ? 'Approved for publish by you' : 'Approved by you', p: approvedLabel(approval).replace(/^[^,]+, /, '') }, ...core.detail]
    else {
      const lead = options.find(o => o.status === 'approved' && o.outcome?.id === 'approved')
      if (lead?.outcome) core.detail = [{ h: 'Approved by you', p: lead.outcome.label.replace(/^[^,]+, /, '') }, ...core.detail]
    }
    // Held: pieces on the day his approval does not hold, and options a session wrote as decided. Never hidden.
    const held: Held[] = [...(gate.held.get(d) || []),
      ...options.filter(o => o.status === 'held')
        .map(o => ({ piece_id: null, option: o.doc_id, title: /changed/.test(o.held || '') ? HELD_CHANGED : HELD_TITLE, text: `${asSentence(o.title)} ${o.held || ''}`.trim() }))]
    if (held.length && core.who !== 'done') {
      const listed = new Set(options.map(o => o.id.toLowerCase()))
      const presses = SERIES_DAYS.includes(d) && !piece
        ? (gate.held.get(d) || []).map(h => i.pieces.find(p => String(p.id).toLowerCase() === h.piece_id)).filter((p): p is Body => Boolean(p) && !listed.has(String(p!.id).toLowerCase()))
          .map(p => approveHeldPress(i, d, p))
        : []
      // A day with nothing his approval holds leads with what is held: he decides it, and nothing else goes on it.
      if (!piece && !options.some(o => o.status === 'approved')) {
        core.who = 'you'
        core.next = `${held.length === 1 ? 'One idea is' : `${held.length} ideas are`} held: not approved by you. Approve what should be on ${DAY_NAME[d]}; nothing else goes on the board`
      }
      core.actions = [...presses, ...core.actions]
    }
    return { ...core, media: mediaWithAnswers(piece),
      pieces: dayPieces(gate.approved, date, shown, gate.approvalOf),
      options, held,
      comments: dayComments(i.comments, d), posted: dayPosted(i.ticks, d), yes: dayYes(i.picks, d),
      posts: dayPosts(i.drive_posts, date, options, i.pieces) }
  }), i.overlay ?? null)
  for (const d of days) {
    if (d.who === 'done' || d.actions.some(a => a.kind === 'prompt' && /Claude/.test(a.label))) continue
    d.actions.push({ kind: 'prompt', label: 'Copy Claude prompt', prompt: backupPrompt(i.week, d) })
    if (d.piece_id && d.path) (d.actions[d.actions.length - 1] as { prompt: string }).prompt = stepPrompt(briefOf(i, d), d.next)
  }
  // His thoughts on any day not done, pinned to the step it is on, as the desk's "Add your thoughts" saved them.
  for (const d of days) if (d.who !== 'done') d.actions.push(thoughtPress(d.day, d.path?.current || 'day'))
  // Every Claude and Growth prompt says how the session reports back to the board, with no key in it (_writeBack.ts).
  withWriteBack(i.week, days)
  const yours: WeekView['yours'] = days.filter(d => d.who === 'you' || d.who === 'stuck').flatMap((d): WeekView['yours'] => (d.reviews?.length
    ? d.reviews.map(r => ({ key: `${d.day}-${r.option.id}`, day: d.day, label: `${d.label} · ${r.option.id}`, next: 'The revised version is back. Approve it, improve it again or reject it', actions: d.actions, review: r }))
    : [{ key: d.day, day: d.day, label: d.label, next: d.next, actions: d.actions }]))
  const dayWord = (id: string) => DAY_NAME[id.slice(0, 3)] || id
  const name = (c: string, id: string) => (c === 'picks' && /^(mon|wed|fri)$/.test(id) ? `picked ${dayWord(id)}'s idea`
    : c === 'picks' ? `pressed ${id}` : c === 'queue' && id.startsWith('off-') ? `judged the ${dayWord(id.slice(4))} option ${id.slice(8)}`
    : c === 'queue' ? `judged idea ${id}` : c === 'comments' ? 'left a comment' : `${c} ${id}`)
  const seen = new Set<string>()
  const moved = i.history.filter(h => { const k = `${h.collection}/${h.doc_id}`; if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 8).map(h => ({ at: h.updated_at, text: `${h.updated_by === 'Krish' ? 'You' : h.updated_by} ${name(h.collection, h.doc_id)}` }))
  for (const r of Object.values(i.runs)) if (r) moved.push({ at: r.updated_at, text: `${r.workflow}: ${r.state}` })
  moved.sort((a, b) => b.at.localeCompare(a.at))
  return { contract_version: VIEW_CONTRACT_VERSION, week: i.week, as_of: i.now.toISOString(), days, yours, moved: moved.slice(0, 10), north_star: i.north_star, runs: i.runs,
    sources: { ideas: Boolean(i.ideas), runs: Object.keys(i.runs).length > 0, store: Boolean(i.overlay), approvals: Array.isArray(i.approvals), drive: Array.isArray(i.drive_posts) },
    revision: i.revision ?? null }
}

/** Every rule the view must keep (PLAN.md): a day not done has a next step, and that step has at least one action. */
export function viewProblems(v: WeekView): string[] {
  const out: string[] = []
  for (const d of v.days) {
    if (d.who === 'done') continue
    if (!d.next) out.push(`${d.day}: not done and no next step`)
    if (!d.actions.length) out.push(`${d.day}: not done and no action`)
    if (!d.actions.some(a => a.kind === 'prompt' && /Claude/.test(a.label))) out.push(`${d.day}: no Claude prompt as a backup`)
    if (d.actions[0]?.kind === 'prompt' && !/conversation|Growth/.test(d.runs_on)) out.push(`${d.day}: a prompt first where a machine could run it`)
    if (d.path && !d.path.current) out.push(`${d.day}: not done and no current step`)
  }
  return out
}

type Fetcher = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{ status: number; text(): Promise<string> }>
const fetchText = async (f: Fetcher, url: string) => { try { const r = await f(url); return r.status === 200 ? await r.text() : null } catch { return null } }

/** The commit a branch points at now, by GitHub's API on the board's own token (the one runs and presses already use),
 *  or undefined when it cannot be asked and null when the branch does not exist. The week's plan files are then read
 *  at that commit: raw.githubusercontent.com keeps a branch's file for five minutes, so a push (the Thursday good news,
 *  an Improve's revision) reaches the live board in seconds instead (Ruling, Krish, 2026-11-11: "genuinely live"). */
export async function branchSha(f: Fetcher, env: Record<string, string | undefined>, branch: string): Promise<string | null | undefined> {
  const t = String(env.OFFDAY_REVISE_DISPATCH_TOKEN || env.PLACE_TAKES_DISPATCH_TOKEN || '').trim()
  if (!t) return undefined
  try {
    const r = await f(`https://api.github.com/repos/${ENGINE_REPO}/git/ref/heads/${branch}`,
      { method: 'GET', headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } })
    if (r.status === 404) return null
    if (r.status !== 200) return undefined
    const sha = (JSON.parse(await r.text()) as { object?: { sha?: string } }).object?.sha
    return typeof sha === 'string' && /^[0-9a-f]{40}$/.test(sha) ? sha : undefined
  } catch { return undefined }
}

/** Read every input of the week now and build its view. Each source that cannot be read is said in sources, never a failure. */
export async function readView(db: SupabaseClient, week: string, env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch as unknown as Fetcher, now = new Date(),
  /** The week's posts in Drive (_drivePosts.ts); a test passes its own, or one that answers null. */
  drive?: (week: string) => Promise<DrivePost[] | null>): Promise<WeekView> {
  // main and the week's branch, each at the commit it points at now when the token can ask (branchSha); otherwise by name.
  const [mainSha, weekSha] = await Promise.all([branchSha(fetcher, env, 'main'), branchSha(fetcher, env, `offday-revise/${week}`)])
  const RAW = `https://raw.githubusercontent.com/${ENGINE_REPO}/${mainSha || 'main'}`
  const weekIdeas = weekSha === null ? Promise.resolve(null)
    : fetchText(fetcher, `https://raw.githubusercontent.com/${ENGINE_REPO}/${weekSha || `offday-revise/${week}`}/docs/plans/${week}-week/ideas.json`)
  const [pieces, picks, queue, history, ideasText, nowText, runs, ...locks] = await Promise.all([
    db.from('content_ideas').select('id, idea, thesis, scheduled_for, lane_slot, state, buried_at, body, meta, updated_at')
      .gte('scheduled_for', week).lte('scheduled_for', dayDate(week, 'sun')).then(r => (r.error ? [] : r.data || [])),
    db.from('board_documents').select('doc_id,body,updated_by,updated_at,revision').eq('week', week).eq('collection', 'picks').then(r => (r.error ? [] : r.data || [])),
    db.from('board_documents').select('doc_id,body,updated_by,updated_at,revision').eq('week', week).eq('collection', 'queue').then(r => (r.error ? [] : r.data || [])),
    db.from('board_history').select('collection,doc_id,updated_at,updated_by').eq('week', week).order('updated_at', { ascending: false }).limit(12)
      .then(r => (r.error ? [] : r.data || [])),
    // The week's revise branch first: offday-revise pushes his revised cards there, and GitHub Actions may not open
    // the pull request that brings them to main, so the board reads them where they are, the moment they exist.
    weekIdeas.then(t => t ?? fetchText(fetcher, `${RAW}/docs/plans/${week}-week/ideas.json`)),
    fetchText(fetcher, `${RAW}/NOW.md`),
    readRuns(env, fetcher as never),
    ...SERIES_DAYS.map(d => fetchText(fetcher, `${RAW}/docs/plans/${week}-week/narrative-lock-${d}.md`)),
  ])
  const since = new Date(now.getTime() - 21 * 864e5).toISOString()
  // Each series day's creative direction, in its plan folder (docs/plans/<date>-<dayname>/): ve/spec.json first.
  const spec = (d: PostedDay) => {
    const dir = `${RAW}/docs/plans/${dayDate(week, d)}-${DAY_NAME[d].toLowerCase()}`
    return fetchText(fetcher, `${dir}/ve/spec.json`).then(t => t ?? fetchText(fetcher, `${dir}/creative-direction.json`))
      .then(t => { try { const s = t ? JSON.parse(t) : null; return isObj(s) ? s : null } catch { return null } })
  }
  const [styleText, specs, notedRows, unreadRows, commentRows, tickRows, signal, ...research] = await Promise.all([
    fetchText(fetcher, `${RAW}/config/style-references.json`),
    Promise.all(SERIES_DAYS.map(spec)),
    // His production inspiration with his own words on it, newest first; and the recent videos he has said nothing about.
    db.from('inspiration_items').select('id,name,mime,why_like,drive_created_at').eq('lane', 'production').is('dismissed_at', null)
      .not('why_like', 'is', null).order('drive_created_at', { ascending: false }).limit(6).then(r => (r.error ? [] : r.data || [])),
    db.from('inspiration_items').select('id').eq('lane', 'production').is('dismissed_at', null).is('why_like', null)
      .like('mime', 'video/%').gte('drive_created_at', since).limit(100).then(r => (r.error ? [] : r.data || [])),
    db.from('board_documents').select('doc_id,body,updated_by,updated_at').eq('week', week).eq('collection', 'comments').order('updated_at', { ascending: false }).limit(200)
      .then(r => (r.error ? [] : r.data || [])),
    db.from('board_ticks').select('tick_id,body,updated_by').eq('week', week).then(r => (r.error ? [] : r.data || [])),
    // The week's change signal (supabase/migrations/20261125090000_board_signal.sql); null until it exists.
    db.from('board_signal').select('revision').eq('week', week).maybeSingle().then(r => (r.error || !r.data ? null : Number(r.data.revision)), () => null),
    ...SERIES_DAYS.map(d => fetchText(fetcher, `${RAW}/docs/plans/${week}-week/${d}-research.md`).then(t => Boolean(t))),
  ])
  // Who is working on each piece and what is on file for it (the piece materials store); null when it cannot be read.
  // Beside it, everything made for the week's posts, from their folders in Drive (_drivePosts.ts; contract 1.7.0).
  const drivePosts = drive ? drive(week) : weekPosts(week, () => ownerDriveToken(env))
  const overlay = await readOverlay(db as never, week, (pieces as Body[]).map(p => String(p.id).toLowerCase()))
  // The approvals that stand now (the ideas gate): null when they cannot be read, and then every piece is held.
  const approvals = await readApprovals(db, week)
  let formats: ViewInputs['formats'] = { script: [], production: [] }
  let motion: MotionModule[] = []
  try {
    const styles = styleText ? JSON.parse(styleText) : null
    motion = motionBank(styles)
    const f = styles ? styles.formats : null
    const list = (xs: unknown) => (Array.isArray(xs) ? xs : []).filter(isObj).map(x => ({ id: String(x.id), name: String(x.name || x.id), pitch: String(x.pitch || ''), status: String(x.status || '') }))
    formats = { script: list(f?.script), production: list(f?.production) }
  } catch { /* the look step then offers the recommendation by id only */ }
  const noted = notedRows as Array<{ id: string; name: string; why_like: string | null; drive_created_at: string | null }>
  const inspiration = {
    cards: noted.filter(x => x.why_like && x.why_like.trim()).slice(0, 3).map(x => ({ id: x.id, name: x.name, words: String(x.why_like).trim().slice(0, 600), saved: x.drive_created_at })),
    unread: (unreadRows as unknown[]).length,
  }
  let ideas: Body | null = null
  try { ideas = ideasText ? JSON.parse(ideasText) : null } catch { ideas = null }
  let north: { current: number; target: number } | null = null
  const m = nowText ? /<!-- north-star-state (\{.*?\}) -->/.exec(nowText) : null
  try { if (m) { const s = JSON.parse(m[1]); north = { current: Number(s.current), target: Number(s.week_target) } } } catch { north = null }
  return buildView({ week, now, pieces: pieces as Body[], picks: picks as ViewInputs['picks'], queue: queue as ViewInputs['queue'],
    history: history as ViewInputs['history'], ideas, runs, north_star: north,
    locks: Object.fromEntries(SERIES_DAYS.map((d, k) => [d, locks[k] as string | null])),
    research_files: Object.fromEntries(SERIES_DAYS.map((d, k) => [d, Boolean(research[k])])), formats, motion,
    specs: Object.fromEntries(SERIES_DAYS.map((d, k) => [d, specs[k]])), inspiration, overlay, approvals,
    comments: commentRows as ViewInputs['comments'], ticks: tickRows as ViewInputs['ticks'], revision: signal as number | null,
    drive_posts: await drivePosts })
}
