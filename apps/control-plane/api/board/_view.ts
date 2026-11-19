import { carryTemplates } from './_carryTemplates.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { wordsBody, asWritten, wordsDocId, takenBackAt } from './_contracts.js'
import { dayDate, piecesByDay, SERIES_DAYS, type PostedDay } from './_posted.js'
/** The days a piece is approved for publish on: the series days and the off days he records (tue, thu, sat). */
const PUBLISH_DAYS: readonly PostedDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
import { liveDay, type LiveDay } from './_live.js'
import { currentFolder, makingSteps } from '../_making.js'
import { yesByDay } from './_yes.js'
import { readRuns, ENGINE_REPO, type JobName, type RunInfo } from './_run.js'
import { readSignOffPresses, readSignOffSources, signOffsView, type SignOffsView } from './_signOffs.js'
import { offdaySides, type OffdaySides } from './_offdaySides.js'
import type { MediaItem } from './_media.js'
import { mediaWithAnswers } from './_cuts.js'
import { dayThumbs, type DayThumbs } from './_thumbs.js'
import { VIEW_CONTRACT_VERSION } from './_viewContract.js'
import { withResearchPrompts } from './_researchPrompt.js'
import { liveBoardUrl } from './_liveBoard.js'
import { ARC, FREEDOM, mockPrompt, researchPrompt, storyPrompt, storyboardPrompt, stepPrompt, type PieceBrief } from './_prompts.js'
import { dayComments, dayPieces, dayPosted, dayYes, ideaLines, materialPress, offdayApproval, offdayList, offdayOptions, seriesOptions, storiesFresh, thoughtPress, yesPress,
  type PressAction, type ViewComment, type ViewOption, type ViewPiece, type ViewPosted, type ViewYes } from './_viewExtras.js'
import { HELD_CHANGED, HELD_TITLE, approvedLabel, approvedWhen, asSentence, cutSoWhat, dayShort, dayWords, gatePieces, goes, optionSha, readApprovals, type Approval, type Held } from './_gate.js'
import { attachOverlay, readOverlay, withWriteBack, workByScope, type Overlay, type ViewMaterial, type ViewSession } from './_writeBack.js'
import { lockRead, newestScripts, pieceDecisions, scriptSection, scriptsChanged, type FiledScript, type LockState, type PieceDecisions, type ScriptsState } from './_decisions.js'
import { dayStyle, motionBank, type DayStyle, type MotionModule } from './_style.js'
import { liveByDay, liveLine, livePress, postsFor, publishedNow, todayNY, type LivePost } from './_itsLive.js'
import { ownerDriveToken, weekPosts, type DrivePost, type PostAsset } from './_drivePosts.js'
import { dayManifest, readDrafts, type Draft, type ViewManifest } from './_manifest.js'
import { carriedItems, channelWord, dayLabel, dayOptions, liveOn, readItems, readItemsIn, type GrowthPost, type OffdayItem } from './_offdayItems.js'
import { ideaStage, lateLine, lateOn, postedStage, truthProblems } from './_stage.js'
import { modelProblems, offdayHead, offdayKind, recentOutOf, weekModel, type ModelInputs, type WeekModel } from './_weekModel.js'
import { makeRoute } from './_makeRoute.js'
import { PLAN_ROLE, parsePlan, type PlanGot, type ProductionPlan } from './_productionPlan.js'
import { scheduledOf } from './_posted.js'

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

export type Who = 'you' | 'engine' | 'growth' | 'stuck' | 'done' | 'missed'
export type Action =
  | { kind: 'run'; label: string; job: JobName; input: Record<string, unknown>; runs_on: string }
  | { kind: 'open'; label: string; href: string }
  | PromptAction
  | { kind: 'review'; label: string }
  | { kind: 'research'; label: string; piece_id: string }
  | { kind: 'look'; label: string; piece_id: string }
  | PressAction
/** The one Claude prompt (contract 1.17.0 adds `notes` and `open`): `notes` asks for his own words before it is copied
 *  and the board puts them under `heading` at the end of the prompt, saving them with `save` (his comment on the day,
 *  which the engine files to his taste ledger); `open` names where the board opens it, a new Claude Code session with
 *  the repository chosen and the prompt filled in. The board builds the claude.ai/code address: the view carries no
 *  link. */
export type PromptAction = {
  kind: 'prompt'
  label: string
  prompt: string
  notes?: { ask: string; heading: string; save?: PressAction; saved?: SavedNote[] }
  open?: { app: 'claude_code'; repository: string }
  /** Contract 1.19.0: who the prompt is for. A Perplexity research prompt is only copied (no session opens), and its
   *  answer comes back through Paste research on the piece (_researchPrompt.ts). */
  tool?: 'claude' | 'perplexity'
}
/** Contract 1.19.0: a note of his already saved on the item, newest first, whole (Krish, 2026-11-17: "when I add feedback
 *  in to the control center UI, it obviously loads in to the prompt that comes here, but when i reopen the piece at a later
 *  date it seems to have vanished"). The box stays empty for new words; these show beside it. */
export interface SavedNote { at: string; text: string; frame?: 'visual_points' }

/** The heading his earlier notes go under in a Claude prompt. */
/** How a saved answer to the production plan's question reads among his earlier notes, so its framing is never lost. */
export const VISUAL_POINT_LINE = '(A point to make visually, with a picture of its own that makes it plain on screen.)'
export const EARLIER_NOTES = "Krish's earlier notes on this piece, newest first (each is also on file on the piece, kind note). They still stand unless newer words of his say otherwise:"

/** The most saved notes one prompt carries, and the most of each note's words (the press keeps 2,000). */
export const SAVED_NOTES_MAX = 10
const SAVED_NOTE_CHARS = 2000

/** His saved notes for one item (its piece, or an off-day post's key), newest first: the claude_notes comments he left. */
export function savedNotesFor(rows: ViewInputs['comments'], target: { piece_id?: unknown; item?: unknown }): SavedNote[] {
  const piece = typeof target.piece_id === 'string' ? target.piece_id.toLowerCase() : null
  const item = !piece && typeof target.item === 'string' ? target.item : null
  if (!piece && !item) return []
  return (rows || []).filter(c => isObj(c.body) && c.body.use === 'claude_notes' && c.updated_by === 'Krish' && typeof c.body.text === 'string' && c.body.text.trim()
    && (piece ? String(c.body.piece_id || '').toLowerCase() === piece : c.body.item === item))
    .map(c => ({ at: String(c.body.at || c.updated_at || ''), text: String(c.body.text).trim().slice(0, SAVED_NOTE_CHARS),
      // His answer to the production plan's question (_weekModel.ts VISUAL_POINTS_ASK) keeps its framing on later prompts.
      ...(c.body.frame === 'visual_points' ? { frame: 'visual_points' as const } : {}) }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter((n, i, all) => all.findIndex(x => x.text === n.text) === i)
    .slice(0, SAVED_NOTES_MAX)
}

/** Every Claude prompt in the week model that asks for his notes carries the ones he already saved on its item. */
export function withSavedNotes(model: WeekModel, rows: ViewInputs['comments']): WeekModel {
  const fill = (a: Action | null): void => {
    if (!a || a.kind !== 'prompt' || !a.notes?.save) return
    const body = (a.notes.save as { body?: Body }).body || {}
    if (body.use !== 'claude_notes') return
    a.notes.saved = savedNotesFor(rows, body)
    // The Claude session starts with nothing to assume: his earlier notes are in its prompt too (the research prompt
    // carries them in its own words).
    if (a.tool !== 'perplexity' && a.notes.saved.length && !a.prompt.includes(EARLIER_NOTES))
      a.prompt = `${a.prompt}\n\n${EARLIER_NOTES}\n${a.notes.saved.map(n => `- ${n.at ? `${n.at.slice(0, 16).replace('T', ' ')} UTC: ` : ''}${n.frame === 'visual_points' ? `${VISUAL_POINT_LINE} ` : ''}${n.text}`).join('\n')}`
  }
  for (const d of model.days) for (const it of d.items) { fill(it.next); for (const o of it.others) fill(o) }
  return model
}
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
  /** Contract 1.16.0 (_thumbs.ts): the piece's thumbnail options while a set the critic judged is on its making record,
   *  each option's wide and tall files as same-site Drive file paths with their sha256 and the critic's line, the grid
   *  mock, his Pick on each option and Not this on the set while it waits on him, and his answer once given; else null. */
  thumbs: DayThumbs | null
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
  /** Contract 1.8.0 (_manifest.ts): the day's piece's manifest, its exact files (each with its Drive link) and words,
   *  with his Approve for publish bound to its sha256 while it waits on him, and whether a press of his binds it now or
   *  bound another draft (changed). Null when the piece has no draft manifest. */
  manifest: ViewManifest | null
}
/** A post folder of a day, as the view carries it (contract 1.7.0). */
export interface ViewPost { id: string; name: string; url: string; option: string | null; piece_id: string | null; assets: PostAsset[] }
/** What a day's next step is built from, before the parts every day carries (media, and 1.2.0's extras). */
export type DayCore = Omit<DayView, 'media' | 'thumbs' | 'pieces' | 'options' | 'comments' | 'posted' | 'yes' | 'sessions' | 'materials' | 'held' | 'posts' | 'manifest'>
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

/** The days the piece's making record holds for recording and cutting: the day its Recorded step was done (its latest
 *  take's `at`) and the day its Video assets step was done (its latest file's `at`), each as makingSteps reads the
 *  record, so the stages say what the record's own steps say. Null while that step is not done on the record (a step
 *  done only because a later one is has no day of its own), never a guessed day. Pure. */
export function makingDays(piece: Body): { recordedOn: string | null; cutOn: string | null } {
  const meta = isObj(piece.meta) ? piece.meta : {}
  const steps = makingSteps({ id: String(piece.id), state: piece.state as string | null, body: piece.body as string | null, meta })
  const doneOn = (key: string) => { const s = steps.find(x => x.key === key); return s && s.state === 'done' ? dayOf(s.at) : null }
  return { recordedOn: doneOn('record'), cutOn: doneOn('video') }
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
  /** The three video sign-offs, one review card each, on every week (contract 1.11.0, _signOffs.ts); null when the
   *  cards cannot be read. */
  sign_offs?: SignOffsView | null
  /** The contract this view keeps (view.schema.json, x-contract-version; _viewContract.ts). */
  contract_version: string
  week: string
  as_of: string
  days: DayView[]
  yours: Array<{ key: string; day: PostedDay; label: string; next: string; actions: Action[]; review?: NonNullable<DayView['reviews']>[number] }>
  moved: Array<{ at: string; text: string }>
  /** The week's published count against its target. current is live (contract 1.8.0, publishedNow): what went out in
   *  the last seven days, the posts he marked live included; measured is the number NOW.md last recorded. */
  north_star: { current: number; target: number; measured?: number } | null
  runs: Partial<Record<JobName, RunInfo>>
  sources: Record<string, boolean>
  /** The week's change signal (board_signal.revision): bumped by every write the view reads, null when unread. */
  revision: number | null
  /** Contract 1.12.0 (_weekModel.ts): the week model the Publish Board draws, the three pieces and the off-day posts he
   *  approved, each with its kind, its path and one next action, and the ideas that wait on the ideas board. */
  model?: WeekModel
}

export interface ViewInputs {
  /** The sign-off cards as _signOffs.ts built them (contract 1.11.0); undefined in a fixture that has none. */
  sign_offs?: SignOffsView | null
  week: string
  now: Date
  pieces: Body[]
  picks: Array<{ doc_id: string; body: Body; updated_by: string; updated_at?: string; revision?: number }>
  queue: Array<{ doc_id: string; body: Body; updated_by: string; updated_at?: string; revision?: number }>
  history: Array<{ collection: string; doc_id: string; updated_at: string; updated_by: string }>
  ideas: Body | null
  locks: Partial<Record<PostedDay, string | null>>
  runs: Partial<Record<JobName, RunInfo>>
  north_star: { current: number; target: number; measured?: number } | null
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
  /** The newest script of each cut a session filed on each piece for his Approve, with its words (F47; readView). */
  scripts?: Record<string, FiledScript[]>
  /** Each piece's production plan (_productionPlan.ts), by piece id. */
  productionPlans?: Record<string, ProductionPlan>
  /** The approvals that stand now (board_approvals_now, _gate.ts), or null when they cannot be read: then every piece
   *  is held. Required, so no caller builds a view that skips the gate. */
  approvals: Approval[] | null
  /** The week's post folders in Drive (_drivePosts.ts weekPosts), or null when Drive could not be read; left out, the
   *  view says Drive was not read. */
  drive_posts?: DrivePost[] | null
  /** Each piece's draft manifest, by piece id (_manifest.ts readDrafts); left out, no day carries one. */
  drafts?: Record<string, Draft>
  /** Contract 1.9.0: the one place an off-day item's day lives (offday_items, _offdayItems.ts): every item on a day of
   *  the week or offered by its plan, or null when it could not be read (the plan's options then show as they are,
   *  and nothing offers a move). Left out, the plan only. */
  items?: OffdayItem[] | null
  /** Contract 1.10.0, one post, one item (_onePost.ts): every item of every week on a day or in his Ideas for Later, and
   *  the week plans beside this one (by Monday), so the same post is drawn on one day only. Left out, the week's own. */
  all_items?: OffdayItem[] | null
  /** Contract 1.17.0: the series pieces scheduled in the 14 days before the week (content_ideas), for the repeat check. */
  recent_pieces?: Body[]
  plans?: Record<string, Body | null>
}

/** A folder's or an option's title as a comparison key: letters and digits, lower case. */
const titleKey = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, '')
/** The title a post folder carries after its date and day ("2026-11-17 Tue off.day - Free ChatGPT has ads now"). */
const folderTitle = (name: string): string => name.replace(/^\d{4}-\d{2}-\d{2}\s+\w{3}\s+[^-]*-\s*/, '')

/** The day's post folders, each bound to the option whose `drive` names it and to the piece whose making record files
 *  into it (pack.folder): the bound ones first, then by name. Null when Drive could not be read.
 *
 *  A post's folder is dated for the day it was made for, and a post he moves to another day keeps its folder (Krish,
 *  2026-11-18: a post scheduled for Fri 20 showed no files at all, because its folder was dated Tue 17 and its card sat on
 *  Thu 19: "at no point did I ever see the covers, thumbnails etc"). So a folder of another day of the week is also this
 *  day's when an option here names it (`drive`), or, with nothing naming it, when its title is the one option's title
 *  (a folder named "... - Free ChatGPT has ads now" and an option "Free ChatGPT has ads now. Here is ..."): never when
 *  more than one option here would claim it. */
export function dayPosts(posts: DrivePost[] | null | undefined, date: string, options: ViewOption[], pieces: Body[]): ViewPost[] | null {
  if (!Array.isArray(posts)) return null
  // The folder each piece is bound to now (its binding, else its pack's folder, its date put right after a move).
  const packOf = (p: Body) => currentFolder(isObj(p.meta) && isObj(p.meta.making) ? p.meta.making as never : null, p.scheduled_for) ?? ''
  const here = posts.filter(p => p.date === date)
  const hereIds = new Set(here.map(p => p.id))
  const claimed = (p: DrivePost): string | null => {
    const named = options.find(o => o.post === p.id)
    if (named) return named.id
    const key = titleKey(folderTitle(p.name))
    if (key.length < 12) return null
    const hits = options.filter(o => !o.post && titleKey(o.title).includes(key))
    return hits.length === 1 ? hits[0].id : null
  }
  const moved = posts.filter(p => p.date !== date && !hereIds.has(p.id) && claimed(p) !== null)
  return [...here, ...moved].map(p => {
    const option = claimed(p)
    const piece = pieces.find(x => packOf(x) === p.name)
    return { id: p.id, name: p.name, url: p.url, option, piece_id: piece ? String(piece.id).toLowerCase() : null, assets: p.assets }
  }).sort((a, b) => Number(!a.option && !a.piece_id) - Number(!b.option && !b.piece_id) || a.name.localeCompare(b.name))
}

const LOCK_SIGNED = /^Signed by Krish\b[^:\n]*:\s*"(.+)"\s*,\s*(\d{4}-\d{2}-\d{2})\b/
/** The sha256 of the words a lock's signature binds (making.py lock_body_hash): every line above it that is not blank,
 *  read flush left; an unsigned lock hashes whole. */
export function lockBodyHash(text: string): string {
  let lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length && LOCK_SIGNED.test(lines[lines.length - 1])) lines = lines.slice(0, -1)
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')
}
/** The words he signed a lock with (its last line), or null. */
function lockWords(text: string | null | undefined): string | null {
  if (!lockSigned(text)) return null
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  return LOCK_SIGNED.exec(lines[lines.length - 1])?.[1] ?? null
}
/** The days a narrative lock may be filed under: every day a piece may sit on. */
export const LOCK_DAYS: PostedDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
/** The piece a lock names on its `piece_id:` line, or null when it names none. */
export function lockPieceId(text: string | null | undefined): string | null {
  const m = /^piece_id:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/im.exec(String(text || ''))
  return m ? m[1].toLowerCase() : null
}
/** A piece's narrative lock: the week's lock that names it, wherever it is filed, else the day's own lock when that names
 *  no piece. A lock follows its piece, never its day: on 13 Nov Fri 20's piece was replaced and moved to Tue 17, and the
 *  new Fri 20 piece read as Branded from the lock Krish signed for the piece that left (narrative-lock-fri.md names
 *  b019dbf8). */
export function lockOf(locks: ViewInputs['locks'], day: PostedDay, pieceId: string): { text: string; day: PostedDay } | null {
  const id = pieceId.toLowerCase()
  for (const [d, text] of Object.entries(locks) as Array<[PostedDay, string | null | undefined]>) if (text && lockPieceId(text) === id) return { text, day: d }
  const own = locks[day]
  return own && !lockPieceId(own) ? { text: own, day } : null
}
export type Typed = { words: string; said_where: string; said_at: string; body?: Body }
/** A piece's lock on file, unsigned, under the day the piece is on: what his "Signed." press binds (_weekModel.ts). */
export interface LockToSign { day: PostedDay; path: string; sha256: string; revision: number }
/** His typed approval of this piece's lock or scripts, carried from a session (picks/<day>-<lock|scripts>-words; Ruling,
 *  Krish, 2026-11-12: "Scripts and locks only."), or null. A lock's counts only for the lock text on the board now (its
 *  lock_sha256 is that text's lockBodyHash), so a lock changed after his words is never shown as approved. */
export function typedApproval(picks: Array<{ doc_id: string; body: Body }>, day: string, what: 'lock' | 'scripts', pieceId: string,
  lockText?: string | null): Typed | null {
  // The piece's own document first (wordsDocId), then the day's older one, each only for this piece.
  const ids = [wordsDocId(day, what, pieceId), `${day}-${what}-words`]
  const doc = ids.map(id => picks.find(p => p.doc_id === id)).find(p => p && isObj(p.body) && wordsBody(p.doc_id, asWritten(p.body))
    && String(p.body.piece_id).toLowerCase() === pieceId)
  const b = doc && isObj(doc.body) ? doc.body : null
  if (!b) return null
  // Taken back since (his take-back press or his words; 17 Nov): this approval no longer counts.
  const madeAt = Date.parse(String(b.said_at || b.at || ''))
  if (Number.isFinite(madeAt) && madeAt <= takenBackAt(picks, what, pieceId)) return null
  if (what === 'lock' && (!lockText || lockBodyHash(lockText) !== b.lock_sha256)) return null
  return { words: String(b.words), said_where: String(b.said_where), said_at: String(b.said_at), body: b }
}
/** "Approved in your words: "...", Thu 12 Nov, in a Claude Code session" (Ruling, Krish, 2026-11-12). */
export function inYourWords(words: string, on: string | null, where?: string | null): string {
  const said = words.length > 160 ? `${words.slice(0, 157).trimEnd()}...` : words
  const day = on && /^\d{4}-\d{2}-\d{2}/.test(on) ? new Date(`${on.slice(0, 10)}T12:00:00Z`) : null
  const when = day ? `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getUTCDay()]} ${day.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][day.getUTCMonth()]}` : ''
  return `Approved in your words: "${said}"${when ? `, ${when}` : ''}${where ? ` (${where})` : ''}`
}
/** Whether a narrative lock is signed: its last line that is not blank is his signature (making.py lock_signature), and
 *  when that line names the sha256 it binds, the words above it still hash to it (making.py signature_problems, the
 *  drift rule). A story changed under his old approval line is unsigned, so the board asks him to approve it again
 *  (Ruling, Krish, 2026-11-16: an approved story can still be changed by a Claude session). */
export function lockSigned(text: string | null | undefined): boolean {
  if (!text) return false
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const last = lines.length ? lines[lines.length - 1] : ''
  const m = LOCK_SIGNED.exec(last)
  if (!m || /^<[^>]*>$/.test(m[1].trim())) return false
  const bound = /lock sha256 ([0-9a-f]{64})\b/.exec(last)?.[1]
  return !bound || bound === lockBodyHash(String(text))
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
/** His lock and scripts decisions on a piece placed on `day`, from the week's locks and presses (_decisions.ts). */
export function lockStateOf(locks: ViewInputs['locks'], picks: Array<{ doc_id: string; body: Body }>, day: PostedDay, pieceId: string): LockState {
  const lk = lockOf(locks, day, pieceId)
  const typed = lk ? typedApproval(picks, lk.day, 'lock', pieceId, lk.text) : null
  return { signed: lockSigned(lk?.text), on: lockSignedOn(lk?.text), typed: typed ? { words: typed.words, said_at: typed.said_at } : null }
}
const SCRIPT_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export function scriptsStateOf(picks: Array<{ doc_id: string; body: Body; updated_by?: string | null; updated_at?: string | null }>, day: PostedDay, pieceId: string): ScriptsState {
  const back = takenBackAt(picks, 'scripts', pieceId)
  // His approval follows its piece to any day (review of 17 Nov: a piece moved after he approved asked for it again):
  // the day it is on first, then any other day.
  const days = [day, ...SCRIPT_DAYS.filter(x => x !== day)]
  const pressedOn = (dd: string) => picks.find(p => p.doc_id === `${dd}-scripts` && p.updated_by === 'Krish' && isObj(p.body) && p.body.approved === true && String(p.body.piece_id || '').toLowerCase() === pieceId
    && !(Date.parse(String(p.updated_at || p.body.at || '')) <= back))
  const pressed = days.map(pressedOn).find(Boolean)
  const typed = days.map(dd => typedApproval(picks, dd, 'scripts', pieceId)).find(Boolean) ?? null
  const at = pressed ? str(pressed.updated_at) ?? (isObj(pressed.body) ? str(pressed.body.at) : null) : null
  // His words written by his own login are timed by the server (updated_at), never by his device's clock, so a slow or fast
  // phone cannot make his approval look older or newer than a filed script (scriptsChanged; review of F49).
  const own = typed ? picks.find(p => isObj(p.body) && p.body === typed.body && p.updated_by === 'Krish') : null
  const typedAt = typed ? (own ? str(own.updated_at) : null) ?? typed.said_at : null
  // The words he approved, so the approval counts only for them (pieceDecisions, scriptsChanged).
  const bodyOf = pressed && isObj(pressed.body) ? pressed.body : typed ? typed.body : null
  const texts = bodyOf && isObj(bodyOf.texts) ? Object.fromEntries(Object.entries(bodyOf.texts as Body).filter(([, v]) => typeof v === 'string')) as ScriptsState['texts'] : null
  return { pressed: Boolean(pressed), pressed_at: at, typed: typed ? { words: typed.words, said_at: typedAt ?? typed.said_at } : null, texts }
}
/** Every approved piece's decisions on the week, by piece id: what the prompts carry and the step they leave (F46). */
export function weekDecisions(i: ViewInputs, days: Array<{ day: PostedDay; pieces: Array<{ id: string; approval?: unknown }> }>): Record<string, PieceDecisions> {
  const out: Record<string, PieceDecisions> = {}
  for (const d of days) for (const p of d.pieces.filter(x => x.approval)) {
    const row = i.pieces.find(x => String(x.id).toLowerCase() === p.id)
    out[p.id] = pieceDecisions({ meta: row?.meta, lock: lockStateOf(i.locks, i.picks, d.day, p.id), scripts: scriptsStateOf(i.picks, d.day, p.id),
      filed: i.scripts ? i.scripts[p.id] ?? [] : undefined })
  }
  return out
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
  const found = lockOf(i.locks, day, id)
  const lock = found?.text ?? null
  // His typed approval counts for the lock and the scripts (Ruling, Krish, 2026-11-12: "Scripts and locks only."),
  // shown as "Approved in your words"; his Approve on the idea itself stays his press (the ideas gate).
  const typedLock = typedApproval(i.picks, day, 'lock', id, lock)
  const typedScripts = typedApproval(i.picks, day, 'scripts', id)
  const signed = lockSigned(lock) || Boolean(typedLock)
  const make = i.runs['make-piece']
  const meta = isObj(piece.meta) ? piece.meta : {}
  // His approval, read by one reader on every card (scriptsStateOf: any day, his take-back respected), and counted only for
  // the words it approved: scripts filed AFTER it with other words send the card back to his edit and Approve (Krish,
  // 2026-11-17: "move the board state back to wher I can edit scripts and then approve again"); his own edits never do.
  const scriptsState = scriptsStateOf(i.picks, day, id)
  const scriptsPressed = scriptsState.pressed
  const rewritten = scriptsChanged(scriptsState.texts, i.scripts?.[id], scriptsState.pressed_at ?? scriptsState.typed?.said_at ?? null)
  const scriptsApproved = (scriptsPressed || Boolean(scriptsState.typed)) && !rewritten.length
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
    lock: lock ? { path: `docs/plans/${week}-week/narrative-lock-${found?.day ?? day}.md`, signed } : null,
    look: look ? { production: nameOf(i, String(look.production)), experiment: look.experiment ? nameOf(i, String(look.experiment)) : null, inspiration: Array.isArray(look.inspiration) ? look.inspiration.map(String) : [] } : null,
  }
  const style = isObj(ideaRow?.style) ? ideaRow!.style as Body : null
  const experiment = style && isObj(style.experiment) ? style.experiment as Body : null
  const rec = stepState(live, 'record'), vid = stepState(live, 'video'), pub = stepState(live, 'publish')
  // "It's live" (contract 1.8.0): a post he marked live on Substack is the essay out, so the day is done at once,
  // before the publish watcher matches the post by the link now on the piece's record.
  const said = postsFor(liveByDay(i.picks)[day], { piece_id: id })
  const essayOut = said.some(p => p.channels.includes('substack'))
  const done: Record<PathKey, boolean> = {
    research: materials.length > 0 || researchFile || signed,
    story: signed,
    look: Boolean(look),
    board: scriptsApproved,
    record: rec === 'done',
    cut: live.verdict === 'done' || pub === 'done' || essayOut,
  }
  // A later step done means every step before it is done too: a piece recorded before the path existed is never sent back to Look.
  for (let k = PATH.length - 1; k > 0; k--) if (done[PATH[k].key]) done[PATH[k - 1].key] = true
  // Scripts he agreed before the production pick never skip it: until a take is recorded, the look is his next step
  // (Krish, 2026-11-13: "I've already agreed the scripts for Monday, Wednesday, and Friday and just need to pick and lock
  // down the rest of the production before I get recording").
  if (!look && !done.record && !done.cut) done.look = false
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
      agreedOn: lockSignedOn(lock) ?? dayOf(typedLock?.said_at) ?? dayOf(pick?.updated_at),
      fleshedOn: look ? dayOf(look.at) : null,
      ...makingDays(piece),
      goesOn: date,
    }),
  }
  // The style choices (contract 1.4.0): a spec on file for another piece is never read as this one's.
  const spec = (s => (s && (typeof s.piece_id !== 'string' || !UUID.test(s.piece_id) || s.piece_id.toLowerCase() === id) ? s : null))(i.specs?.[day] ?? null)
  const points = spec && isObj(spec.style) && Array.isArray(spec.style.points) ? spec.style.points.filter((p): p is string => typeof p === 'string') : []
  path.style = dayStyle({ pieceId: id, meta, formats: SERIES_FORMATS, points: points.length ? points : null, motion: i.motion || [],
    looks: i.formats?.production || [], recommendedLook: path.look.recommended.production?.id ?? null, gate: live.gates.style, spec,
    recommendedMotion: typeof style?.motion === 'string' ? style.motion : null, recommendedCaptions: typeof style?.captions === 'string' ? style.captions : null,
    motionAlternatives: planAlternatives(style, 'motion_alternatives'), captionsAlternatives: planAlternatives(style, 'captions_alternatives'),
    lookAlternatives: planAlternatives(style, 'production_alternatives') })
  const detail: DayView['detail'] = [
    { h: 'Research', p: materials.length ? materials.map(m => m.title).join(' · ') : researchFile ? `${day}-research.md in the week's folder` : 'None yet' },
    { h: 'Narrative lock', p: typedLock ? inYourWords(typedLock.words, typedLock.said_at, typedLock.said_where)
      : lockSigned(lock) ? inYourWords(lockWords(lock) ?? '', lockSignedOn(lock)) : lock ? 'Written, waiting for your signature' : 'Not written yet' },
    { h: 'Look', p: look ? [nameOf(i, String(look.production)), look.experiment ? nameOf(i, String(look.experiment)) : ''].filter(Boolean).join(' + ') : 'Not picked yet' },
    // Where the scripts are, from the records only (Ruling, Krish, 2026-11-12: the board shows exactly where everything
    // is): his Approve scripts press, the making record's Scripts step, the send to his Teleprompter.
    { h: 'Scripts', p: rewritten.length ? `Rewritten since you approved them (${rewritten.map(c => c === 'long' ? 'the 5-minute script' : 'the 90-second script').join(' and ')}): edit them if you like, then approve them again`
      : scriptsPressed ? 'Approved by you on the board' : typedScripts ? inYourWords(typedScripts.words, typedScripts.said_at, typedScripts.said_where)
      : stepState(live, 'scripts') === 'done' ? 'Written, waiting for your Approve scripts'
      : 'Not filed yet: none on the piece\'s record and none sent to your Teleprompter' },
  ]
  // A step a session settled with him somewhere the engine cannot see is never shown as done; the line says plainly
  // what is not on file yet, so it can be filed from that session.
  const notFiled = [!signed ? 'your locked story' : '', !scriptsApproved && stepState(live, 'scripts') !== 'done' ? 'your approved scripts' : ''].filter(Boolean)
  const v = { ...base, title, piece_id: id, detail, path }
  const conversation = 'A conversation with you in a new Claude session'
  if (live.verdict === 'done') return { ...v, stop: 4, who: 'done', next: 'Published on every channel', runs_on: '', actions: [] }
  if (essayOut) return { ...v, stop: 4, who: 'done', next: liveLine(said), runs_on: '', actions: [] }
  if (current === 'research') {
    return { ...v, stop: 1, who: 'you', runs_on: 'Perplexity sonar-pro on the engine, or your own research dropped here',
      next: 'Bring the evidence: research it now, or drop your Perplexity file on this day',
      actions: [{ kind: 'research', label: 'Research it now', piece_id: id }, { kind: 'prompt', label: 'Copy Perplexity prompt', prompt: path.prompts.research }, materialPress(id)] }
  }
  if (current === 'story') {
    return { ...v, stop: 1, who: 'you', runs_on: conversation,
      next: lock ? 'Read the narrative lock and sign it, or say what to change'
        : `No narrative lock${notFiled.length > 1 ? ' and no approved scripts are' : ' is'} filed yet. If you settled ${notFiled.length > 1 ? 'them' : 'the story'} in a session, file ${notFiled.length > 1 ? 'them' : 'the lock'} from that session; if not, settle the story in a short session and sign the narrative lock`,
      actions: [{ kind: 'prompt', label: 'Copy Claude prompt', prompt: path.prompts.story }] }
  }
  if (current === 'look') {
    return { ...v, stop: 2, who: 'you', runs_on: 'Your pick, here; a mock on your own footage if you want one',
      next: `${scriptsApproved ? 'Scripts approved. ' : ''}Pick the look: the recommended one, another, or fold in your inspiration${notFiled.includes('your approved scripts') ? '. No approved scripts are filed yet: if you approved them in a session, file them from that session' : ''}`,
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
  // Growth's own record of what it has scheduled for the piece (POST /offday-posts, a piece's entries; _posted.ts).
  const queued = scheduledOf(i.ticks, day, id)
  if (!posting && yes?.approved) {
    const when = queued.length ? `Scheduled: ${[...new Set(queued.map(q => q.label))].join(', ')}, from ${approvedWhen(queued[0].due_at)}` : 'Ready to post: Growth posts it on the day'
    return { ...v, stop: 4, who: 'growth', runs_on: 'Growth posts it on the day',
      next: `Approved${yes.via === 'words' ? ' in your words' : ''}. ${when}`,
      actions: [{ kind: 'prompt', label: 'Copy prompt for Growth', prompt: `Post the ${DAY_NAME[day]} ${date} piece ${id} that Krish approved on the content-engine board (week of ${week}), from its 3 Posts folder.` }] }
  }
  return { ...v, stop: posting ? 4 : 3, who: 'growth', runs_on: 'Growth posts it, after your Approve for publish',
    next: posting ? 'Posting: some channels are out' : 'Watch both cuts and press Approve for publish',
    actions: [{ kind: 'open', label: 'Watch and approve', href: boardTab(week, day) }, ...(posting ? [] : [yesPress(i, day)])] }
}

const planAlternatives = (st: Body | null | undefined, key: string): string[] =>
  st && Array.isArray(st[key]) ? (st[key] as unknown[]).filter((x): x is string => typeof x === 'string') : []
function formatOf(i: ViewInputs, id: unknown): LookOption | null {
  if (typeof id !== 'string') return null
  return [...(i.formats?.production || []), ...(i.formats?.script || [])].find(f => f.id === id) || null
}
function nameOf(i: ViewInputs, id: string): string { return formatOf(i, id)?.name || id }

/** One off day (Tue, Thu, Sat): the options in the week's ideas.json and his verdicts on them. */
function offDay(i: ViewInputs, day: PostedDay, piece: Body | undefined): DayCore {
  const week = i.week, date = dayDate(week, day)
  // The day's options from the one place their day lives (_offdayItems.ts): the plan's and the approvals carried here
  // (offdayList), minus what moved away, plus what moved here and Growth's own.
  const listed = dayOptions(i.ideas, i.items ?? null, week, day, offdayList(i.ideas, i.queue, day), i.all_items, carriedItems({ ...(i.plans || {}), [week]: i.ideas }))
  const options = listed.map(x => x.o)
  // Growth's posting record on each option's item (made, scheduled, live), from the one place (2026-11-12).
  const recordOf = (o: Body) => listed.find(x => x.o === o)?.placed.row ?? null
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
  const marked = liveByDay(i.picks)[day]
  if (piece) {
    const live = liveDay(piece, date)
    const title = String(piece.idea || 'Off-day piece').slice(0, 140)
    if (live.verdict === 'done') return { ...base, kind: 'Off-day piece', title, stop: 4, who: 'done', next: 'Published', runs_on: '', actions: [] }
    // An off-day piece is out once any of its posts is: his "It's live", or a post Growth recorded (its tick, with its
    // link, which needs no press of his).
    const mine = postsFor(marked, { piece_id: String(piece.id).toLowerCase() })
    if (mine.length) return { ...base, kind: 'Off-day piece', title, stop: 4, who: 'done', next: liveLine(mine), runs_on: '', actions: [] }
    const ticked = (i.ticks || []).filter(t => t.updated_by === 'growth' && isObj(t.body) && t.body.done === true && t.body.day === day)
    if (ticked.length) return { ...base, kind: 'Off-day piece', title, stop: 4, who: 'done', next: `Live: Growth posted it on ${ticked.map(t => String(t.body.label || t.body.step)).join(', ')}`, runs_on: '', actions: [] }
  }
  // An off-day option his Approve stands on, marked live by him: the day is out, led by the option that went out. An
  // approved option not marked live keeps its own It's live press on the day (buildView).
  const outHere = chosen.filter(x => approvedNow(x.o)).map(x => ({ o: x.o, posts: postsFor(marked, { option: `off-${day}-${String(x.o.id)}` }) })).filter(x => x.posts.length)
  if (outHere.length) {
    const o = outHere[0].o
    return { ...base, kind: `Off day: ${String(o.format || 'option').split(',')[0]}`, title: String(o.hook || o.copy || o.id).slice(0, 140), stop: 4, who: 'done',
      next: liveLine(([] as LivePost[]).concat(...outHere.map(x => x.posts)).sort((a, b) => a.at.localeCompare(b.at))), runs_on: '', actions: [] }
  }
  // An approved option Growth posted, from Growth's own record (POST /api/board/<Monday>/offday-posts): the day is out,
  // with no press of his (2026-11-12; Tue 10 Nov's carousel went out on six channels and the board said "With Growth").
  const growthOut = chosen.filter(x => approvedNow(x.o)).map(x => ({ o: x.o, posts: liveOn(recordOf(x.o)) })).filter(x => x.posts.length)
  if (growthOut.length) {
    const o = growthOut[0].o
    return { ...base, kind: `Off day: ${String(o.format || 'option').split(',')[0]}`, title: String(o.hook || o.copy || o.id).slice(0, 140), stop: 4, who: 'done',
      next: growthLiveLine(([] as GrowthPost[]).concat(...growthOut.map(x => x.posts))), runs_on: '', actions: [] }
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
        { kind: 'prompt', label: 'Copy prompt for Growth', prompt: `Make the ${DAY_NAME[day]} ${date} good-news post ${String(weekly.o.id)} from the ${n} stories on the content-engine board (week of ${week}).\n\n${offdayHead(makeRoute('good_news', String(weekly.o.format || ''))).trimEnd()}` }] }
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
  // Where Growth is with it, from its own record: scheduled (with when and where), made, or still to make.
  const record = recordOf(o)?.posts ?? []
  const queued = record.filter(p => p.state === 'scheduled' && p.due_at && p.due_at.slice(0, 10) >= date.slice(0, 10))
  const made = record.some(p => p.state === 'made')
  return { ...base, kind, title, stop: queued.length ? 3 : 2, who: 'growth', runs_on: 'Growth makes the approved off-day post',
    next: queued.length ? `Approved. Growth scheduled it on ${[...new Set(queued.map(p => channelWord(p.channel)))].join(', ')}`
      : made ? 'Approved. Growth made it; it schedules it for the day' : 'Approved. Growth makes it and posts it on the day',
    actions: [{ kind: 'prompt', label: 'Copy prompt for Growth', prompt: `Make the ${DAY_NAME[day]} ${date} off-day post ${String(o.id)} that Krish approved on the content-engine board (week of ${week}).\n\n${offdayHead(makeRoute(offdayKind(o).kind, String(o.format || ''))).trimEnd()}` }] }
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
      + ` (the old pages at content.krishraja.com/board are retired and redirect there; the view carries no https link, by the media rule)`,
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
  const heldPieces: NonNullable<ModelInputs['heldPieces']> = []
  const days = attachOverlay(i.week, VIEW_DAYS.map((d): Omit<DayView, 'sessions' | 'materials'> => {
    const piece = byDay.get(d), date = dayDate(i.week, d)
    const shown = piece ? String(piece.id).toLowerCase() : null
    const core = SERIES_DAYS.includes(d) ? seriesDay(i, d, piece) : offDay(i, d, piece)
    // A publishing day can carry off-day posts too (a meme beside the week's piece): its options in ideas.json
    // offdays[<day>] are drawn after the day's own ideas (Krish, 2026-11-12, of Wednesday's Jensen Huang post and
    // Thursday's meme: "Put them there so I can approve").
    const options = [...(SERIES_DAYS.includes(d) ? [...seriesOptions(i, d, Boolean(piece), piece ?? null), ...offdayOptions(i, d)] : offdayOptions(i, d)), ...ideaLines(i, d)]
    const approval = shown ? gate.approvalOf.get(shown) : undefined
    if (approval) core.detail = [{ h: approval.via === 'approve_publish' ? 'Approved for publish by you' : 'Approved by you', p: approvedLabel(approval).replace(/^[^,]+, /, '') }, ...core.detail]
    else {
      const lead = options.find(o => o.status === 'approved' && o.outcome?.id === 'approved')
      if (lead?.outcome) core.detail = [{ h: 'Approved by you', p: lead.outcome.label.replace(/^[^,]+, /, '') }, ...core.detail]
    }
    // Held: pieces on the day his approval does not hold, and options a session wrote as decided. They are ideas, on the
    // ideas board only (Ruling, Krish, 2026-11-13: the publish board shows only what he approved): the day's own lead and
    // presses never carry one. The held lines stay as data; a held piece that is not one of the day's options takes its
    // Approve to the ideas board through the model.
    const held: Held[] = [...(gate.held.get(d) || []),
      ...options.filter(o => o.status === 'held')
        .map(o => ({ piece_id: null, option: o.doc_id, title: /changed/.test(o.held || '') ? HELD_CHANGED : HELD_TITLE, text: `${asSentence(o.title)} ${o.held || ''}`.trim() }))]
    if (SERIES_DAYS.includes(d) && !piece) {
      const listed = new Set(options.map(o => o.id.toLowerCase()))
      for (const h of gate.held.get(d) || []) {
        const p = i.pieces.find(x => String(x.id).toLowerCase() === h.piece_id)
        if (p && !listed.has(String(p.id).toLowerCase())) heldPieces.push({ day: d, piece: p, press: approveHeldPress(i, d, p) })
      }
    }
    // His Approve for publish, bound to the piece's manifest, leads while it waits on him (1.8.0).
    const manifest = shown ? dayManifest(i.drafts?.[shown], i.picks, d) : null
    if (manifest?.press && core.who !== 'done') core.actions = [manifest.press, ...core.actions.filter(a => !(a.kind === 'press' && a.id === manifest.press!.id))]
    return { ...core, manifest, media: mediaWithAnswers(piece), thumbs: SERIES_DAYS.includes(d) ? dayThumbs(i.week, piece) : null,
      pieces: dayPieces(gate.approved, date, shown, gate.approvalOf, i.now),
      options, held,
      comments: dayComments(i.comments, d), posted: [...dayPosted(i.ticks, d, liveByDay(i.picks)[d] || []), ...growthPosted(i.items, i.week, d)], yes: dayYes(i.picks, d),
      posts: dayPosts(i.drive_posts, date, options, i.pieces) }
  }), i.overlay ?? null)
  // "It's live" on every piece on the board that is not out yet (contract 1.8.0; Krish, 2026-11-12: "How do I indicate
  // that Tuesday the 10th was posted correctly?"). Once the day is due and only Growth has it, it is the press the day
  // leads with; before that it waits under More presses.
  const today = todayNY(i.now)
  const marked = liveByDay(i.picks)
  for (const d of days) {
    // A piece still being made takes it only once its day has come: nothing can be live before it is made or due. A
    // piece that is out needs no press (its post is on the record already); an off-day option approved for the day, on
    // any day, has its own.
    if (d.who !== 'growth' && d.who !== 'done' && d.date > today) continue
    const subjects: Array<{ piece_id?: string; option?: string; title: string }> = [
      ...(d.piece_id && d.who !== 'done' ? [{ piece_id: d.piece_id, title: d.title }] : []),
      ...d.options.filter(o => o.status === 'approved' && o.doc_id.startsWith(`off-${d.day}-`)).map(o => ({ option: o.doc_id, title: o.title })),
    ]
    // Out already by his mark, or by Growth's own record of the post (2026-11-12): no It's live to press.
    const growthLive = new Set(d.options.filter(o => o.posts?.some(p => p.state === 'live')).map(o => o.doc_id))
    const open = subjects.filter(sub => !postsFor(marked[d.day], sub).length && !(sub.option && growthLive.has(sub.option)))
    if (!open.length) continue
    const presses = open.map(sub => livePress(d.day, sub, open.length > 1 || d.who === 'done' ? `It's live: ${sub.title}` : "It's live"))
    const his = d.actions.some(a => a.kind === 'press' || a.kind === 'review' || a.kind === 'look' || a.kind === 'research')
    // A day that is out already (another of its approved options went live) keeps the rest one press away, never leading.
    if (d.who === 'done') d.actions = [...d.actions, ...presses]
    else if (d.who === 'growth' && d.date <= today && !his) {
      d.actions = [...presses, ...d.actions]
      d.next = `${d.next.replace(/[.\s]+$/, '')}. Once it is out, press It's live with the post's link`
    } else d.actions = [...d.actions, ...presses]
  }
  // Where everything is (contract 1.10.0; Ruling, Krish, 2026-11-12: the board shows exactly where everything is, and
  // one post is one item that can never sprawl across days or go stale). Every option and piece on a day carries its one
  // stage from the records (_stage.ts), an item placed on a day says where else the same post is up as an idea, and a
  // past day that is not out says it was missed, never "with Growth" or "ready".
  for (const d of days) {
    const folderMade = (id: string) => (d.posts || []).some(p => p.option === id && p.assets.length > 0)
    const pieceStages = new Map<string, NonNullable<ViewPiece['stage']>>()
    for (const o of d.options) {
      // A publishing day's approved option is the day's piece: it is where the piece is (filled in below).
      if (d.piece_id && o.id.toLowerCase() === d.piece_id) continue
      if (o.status === 'approved' && o.outcome?.id === 'approved') {
        const marks = postsFor(marked[d.day], { option: o.doc_id }).flatMap(p => p.channels.map(c => ({ label: channelWord(c), href: p.url, at: p.at })))
        o.stage = postedStage({ date: d.date, today, approvedAt: o.outcome.at, approvedLabel: o.outcome.label, growth: o.posts || [], out: marks, scheduled: [], made: folderMade(o.id) })
      } else {
        const sp = o.same_post
        o.stage = ideaStage(o.outcome, o.status, sp ? `one post with ${sp.date ? `${dayLabel(sp.date)}'s, ${sp.state === 'approved' ? 'approved there' : 'offered there'}` : 'an idea in your Ideas for Later'}` : null)
      }
    }
    for (const p of d.pieces) {
      const mine = d.piece_id === p.id
      const ticked = (i.ticks || []).filter(t => t.updated_by === 'growth' && isObj(t.body) && t.body.done === true && t.body.day === d.day && String(t.body.piece_id || '').toLowerCase() === p.id)
        .map(t => ({ label: String(t.body.label || t.body.step || ''), href: (Array.isArray(t.body.posts) ? (t.body.posts as Body[]).filter(isObj).map(x => x.url).find(u => typeof u === 'string' && /^https:\/\//.test(u)) : undefined) as string | undefined, at: typeof t.body.at === 'string' ? t.body.at : null }))
      const marks = postsFor(marked[d.day], { piece_id: p.id }).flatMap(x => x.channels.map(c => ({ label: channelWord(c), href: x.url, at: x.at })))
      p.stage = mine && d.who === 'done' && !ticked.length && !marks.length
        ? { state: 'live', label: d.next, at: null, links: [] }
        : postedStage({ date: d.date, today, approvedAt: p.approval?.at ?? null, approvedLabel: p.approval?.label ?? 'Approved by you', growth: [], out: [...ticked, ...marks],
          scheduled: scheduledOf(i.ticks, d.day, p.id).map(q => ({ label: q.label, due_at: q.due_at })), made: mine && d.media.some(m => m.kind === 'cut') })
      pieceStages.set(p.id, p.stage)
    }
    for (const o of d.options) {
      if (d.piece_id && o.id.toLowerCase() === d.piece_id) o.stage = pieceStages.get(d.piece_id) ?? ideaStage(o.outcome, o.status)
    }
    // The same post up as an idea on another day: said on the day it is on, so it is never on two days unseen.
    const twins = d.options.filter(o => o.stage && o.stage.state !== 'idea').flatMap(o => (o.elsewhere || []).filter(l => /also has this post up as an idea/.test(l)))
    if (twins.length && d.who !== 'done') d.next = `${d.next.replace(/[.\s]+$/, '')}. ${twins[0]}`
  }
  for (const d of days) {
    if (d.date >= today || d.who === 'done') continue
    // The day after its own, a day not out is Late: its next step stays open (Ruling, Krish, 2026-11-18; _stage.ts).
    if (lateOn(d.date, today)) { d.next = `${lateLine(d.label, today)} ${d.next}`; continue }
    const was = d.next
    d.who = 'missed'
    d.next = `Missed: ${d.label} has passed and nothing on it is marked live. If it went out, press It's live with its link`
    d.detail = [...d.detail, { h: 'Before its day passed', p: was }]
    const live = d.actions.filter(a => a.kind === 'press' && (a as { op?: string }).op === 'live')
    d.actions = [...live, ...d.actions.filter(a => !live.includes(a))]
  }
  for (const d of days) {
    if (d.who === 'done' || d.actions.some(a => a.kind === 'prompt' && /Claude/.test(a.label))) continue
    d.actions.push({ kind: 'prompt', label: 'Copy Claude prompt', prompt: backupPrompt(i.week, d) })
    if (d.piece_id && d.path) (d.actions[d.actions.length - 1] as { prompt: string }).prompt = stepPrompt(briefOf(i, d), d.next)
  }
  // His thoughts on any day not done, pinned to the step it is on, as the desk's "Add your thoughts" saved them.
  for (const d of days) if (d.who !== 'done') d.actions.push(thoughtPress(d.day, d.path?.current || 'day'))
  // Every Claude and Growth prompt says how the session reports back to the board, with no key in it (_writeBack.ts).
  const decisions = weekDecisions(i, days)
  withWriteBack(i.week, days, decisions)
  // The week model (contract 1.12.0): the one thing the Publish Board draws, from the days built above.
  const signedLocks = Object.values(i.locks).filter(t => lockSigned(t)).map(t => lockPieceId(t)).filter((x): x is string => Boolean(x))
  // A piece his approval holds on a day that is not its series day (Tue 17's data-centres piece) has no day path of its
  // own: its look choices are worked out here, from its own record, so his production pick is a press there too.
  const placedStyles = Object.fromEntries(days.flatMap(d => d.pieces.filter(p => p.approval && (p.id !== d.piece_id || !SERIES_DAYS.includes(d.day))).map(p => {
    const row = i.pieces.find(x => String(x.id).toLowerCase() === p.id)
    const meta = row && isObj(row.meta) ? row.meta : {}
    // Its row in the week's plan, on whichever day it was offered: what a session recommends for its production.
    const planRow = isObj(i.ideas) && isObj(i.ideas.days) ? Object.values(i.ideas.days as Body).flatMap(l => (Array.isArray(l) ? l : []).filter(isObj))
      .find(x => String(x.id).toLowerCase() === p.id) : undefined
    const st = planRow && isObj(planRow.style) ? planRow.style as Body : null
    return [p.id, dayStyle({ pieceId: p.id, meta, formats: SERIES_FORMATS, points: null, motion: i.motion || [], looks: i.formats?.production || [],
      recommendedLook: typeof st?.production === 'string' ? st.production : null,
      recommendedMotion: typeof st?.motion === 'string' ? st.motion : null, recommendedCaptions: typeof st?.captions === 'string' ? st.captions : null,
      motionAlternatives: planAlternatives(st, 'motion_alternatives'), captionsAlternatives: planAlternatives(st, 'captions_alternatives'),
      lookAlternatives: planAlternatives(st, 'production_alternatives') })]
  })))
  // Each piece on a day with its lock written and not yet signed: his "Signed." is one press there, his typed approval of
  // the lock (picks/<day>-lock-words), on whatever day the piece is placed (Tue 17's data-centres piece too). A lock his
  // words already approved counts as signed, wherever the piece is.
  const locksToSign: Record<string, LockToSign> = {}
  for (const d of days) {
    for (const p of d.pieces.filter(x => x.approval)) {
      const lk = lockOf(i.locks, d.day, p.id)
      if (!lk) continue
      if (typedApproval(i.picks, lk.day, 'lock', p.id, lk.text)) { signedLocks.push(p.id); continue }
      if (lockSigned(lk.text) || lk.day !== d.day) continue
      const doc = wordsDocId(d.day, 'lock', p.id)
      locksToSign[p.id] = { day: d.day, path: `docs/plans/${i.week}-week/narrative-lock-${d.day}.md`, sha256: lockBodyHash(lk.text),
        revision: i.picks.find(x => x.doc_id === doc)?.revision ?? 0 }
    }
  }
  // What went out or is on its way around the week, so an idea that retells it leaves the ideas board (contract 1.17.0).
  const recentOut = recentOutOf({ week: i.week, ideas: i.ideas, plans: i.plans, pieces: i.pieces }, days, i.all_items ?? null, i.recent_pieces ?? [])
  // An off-day video post's look, motion and caption choices, from its own record's meta (_offdayPiece.ts; Krish,
  // 2026-11-17: "at no point does a voiceover short give me the same controls as a mon/wed/fri piece"). A short only.
  const offdayStyle = (pieceId: string, meta: unknown) => dayStyle({ pieceId, meta: isObj(meta) ? meta : {}, formats: ['short_video'], points: null,
    motion: i.motion || [], looks: i.formats?.production || [], recommendedLook: null })
  const built = weekModel(days, { week: i.week, now: i.now, work: workByScope(i.overlay ?? null), today, ideas: i.ideas, plans: i.plans, pieces: i.pieces, heldPieces, signedLocks, placedStyles, offdayStyle, locksToSign, recentOut, picks: i.picks, decisions,
    scripts: i.scripts ?? {}, productionPlans: i.productionPlans ?? {}, lockReads: Object.fromEntries(Object.keys(decisions).map(id => {
      const lk = Object.values(i.locks).find(t => t && lockPieceId(t) === id)
      // Signed by its own last line or by his words on the board (signedLocks counts both; 17 Nov: Tue 17 was signed in his
      // words, and the card kept the idea row's summary).
      return [id, lk && signedLocks.includes(id) ? lockRead(lk) : { so_what: null, story: null }]
    })) })
  // Beside each piece's Claude production prompt, its Perplexity research prompt, from everything on record (1.19.0).
  const model = withSavedNotes(withResearchPrompts(built, (day, it) => {
    const dv = days.find(x => x.day === day)
    if (!dv || !it.piece_id) return null
    return { series: dv.series || null, dayLabel: dv.label, lock: lockOf(i.locks, day as PostedDay, it.piece_id)?.text ?? null,
      materials: dv.piece_id === it.piece_id ? dv.materials : [], saved: savedNotesFor(i.comments, { piece_id: it.piece_id }) }
  }), i.comments)
  // What waits on his press: only his real decisions (Approve for publish on a made piece, an approved post's missing
  // choice), never an idea (Ruling, Krish, 2026-11-13).
  const yours: WeekView['yours'] = model.days.flatMap(md => md.items.filter(it => it.decision && it.next)
    .map(it => ({ key: `${md.day}-${it.key}`, day: md.day, label: md.label, next: it.line, actions: [it.next!] })))
  const dayWord = (id: string) => DAY_NAME[id.slice(0, 3)] || id
  const name = (c: string, id: string) => (c === 'picks' && /^(mon|wed|fri)$/.test(id) ? `picked ${dayWord(id)}'s idea`
    : c === 'picks' && id.startsWith('signoff-') ? 'answered a sign-off card' : c === 'picks' ? `pressed ${id}` : c === 'queue' && id.startsWith('off-') ? `judged the ${dayWord(id.slice(4))} option ${id.slice(8)}`
    : c === 'queue' ? `judged idea ${id}` : c === 'comments' ? 'left a comment' : `${c} ${id}`)
  const seen = new Set<string>()
  const moved = i.history.filter(h => { const k = `${h.collection}/${h.doc_id}`; if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 8).map(h => ({ at: h.updated_at, text: `${h.updated_by === 'Krish' ? 'You' : h.updated_by} ${name(h.collection, h.doc_id)}` }))
  for (const r of Object.values(i.runs)) if (r) moved.push({ at: r.updated_at, text: `${r.workflow}: ${r.state}` })
  moved.sort((a, b) => b.at.localeCompare(a.at))
  return { contract_version: VIEW_CONTRACT_VERSION, week: i.week, as_of: i.now.toISOString(), days, yours, moved: moved.slice(0, 10), north_star: i.north_star, runs: i.runs,
    sources: { ideas: Boolean(i.ideas), runs: Object.keys(i.runs).length > 0, store: Boolean(i.overlay), approvals: Array.isArray(i.approvals), drive: Array.isArray(i.drive_posts),
      items: Array.isArray(i.items), sign_offs: Boolean(i.sign_offs) },
    revision: i.revision ?? null, sign_offs: i.sign_offs ?? null, model }
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
  // Where everything is (_stage.ts): one stage per item, one day per post, and a past day not out says it was missed.
  out.push(...truthProblems(v.days, todayNY(new Date(v.as_of))))
  // The week model (1.12.0): only what he approved on a day, one action an item, kinds and paths from their lists.
  if (v.model) out.push(...modelProblems(v.model, v.days))
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

/** Where two branches split: the merge base of main and the week's branch, by GitHub's compare API on the board's own
 *  token (as branchSha), or null when it cannot be asked. */
export async function mergeBaseSha(f: Fetcher, env: Record<string, string | undefined>, a: string, b: string): Promise<string | null> {
  const t = String(env.OFFDAY_REVISE_DISPATCH_TOKEN || env.PLACE_TAKES_DISPATCH_TOKEN || '').trim()
  if (!t) return null
  try {
    const r = await f(`https://api.github.com/repos/${ENGINE_REPO}/compare/${a}...${b}`,
      { method: 'GET', headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } })
    if (r.status !== 200) return null
    const sha = (JSON.parse(await r.text()) as { merge_base_commit?: { sha?: string } }).merge_base_commit?.sha
    return typeof sha === 'string' && /^[0-9a-f]{40}$/.test(sha) ? sha : null
  } catch { return null }
}

/** One value written out with its keys in order, so two copies of the same thing compare equal. */
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (isObj(x) && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, (x as Body)[k]])) : x))
const sameValue = (a: unknown, b: unknown) => canon(a) === canon(b)
const idRows = (v: unknown): v is Body[] => Array.isArray(v) && v.every(x => isObj(x) && typeof x.id === 'string')

/** The week's plan as main and the week's branch hold it together (Ruling, Krish, 2026-11-17: "Why do recommendations in
 *  my UI never adapt to the piece?"). Each part comes from the side that changed it since the two split (base): a
 *  session's write to main (a piece's production pick) and a run's write to the week branch (an Improve's revision, the
 *  good news) both reach the card. Rows are matched by id. A part both changed keeps the week branch's, as before. */
export function mergeWeekPlan(base: unknown, main: unknown, week: unknown): unknown {
  if (sameValue(week, base)) return main
  if (sameValue(main, base)) return week
  if (idRows(main) && idRows(week)) {
    const b = idRows(base) ? base : []
    const ids = [...week.map(x => x.id as string), ...main.map(x => x.id as string).filter(id => !week.some(x => x.id === id))]
    return ids.map(id => mergeWeekPlan(b.find(x => x.id === id), main.find(x => x.id === id), week.find(x => x.id === id)))
      .filter(x => x !== undefined)
  }
  if (isObj(main) && isObj(week) && !Array.isArray(main) && !Array.isArray(week)) {
    const b = isObj(base) && !Array.isArray(base) ? base : {}
    const out: Body = {}
    for (const k of [...Object.keys(week), ...Object.keys(main).filter(k => !(k in week))]) {
      const v = mergeWeekPlan(b[k], main[k], week[k])
      if (v !== undefined) out[k] = v
    }
    return out
  }
  return week
}

/** A piece's decisions read live for its own read (GET /api/content-ideas/store?piece=<id>, which the Control Center
 *  connector's get_piece_board returns; F46): his look, motion and captions from the piece's meta, the lock from the
 *  week's narrative-lock files at main's newest commit, and his presses and typed approvals from the board. A record
 *  that cannot be read is unknown (made: null), never "not made", so a session reads it again rather than asking. */
export async function readPieceDecisions(db: SupabaseClient, pieceId: string, env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch as unknown as Fetcher): Promise<(PieceDecisions & { week: string; day: PostedDay }) | null> {
  const id = pieceId.toLowerCase()
  const row = await db.from('content_ideas').select('id,scheduled_for,meta').eq('id', id).maybeSingle()
  if (row.error || !row.data) return null
  const date = typeof row.data.scheduled_for === 'string' ? row.data.scheduled_for.slice(0, 10) : null
  if (!date) return null
  const at = new Date(`${date}T00:00:00Z`)
  const day = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[at.getUTCDay()]
  at.setUTCDate(at.getUTCDate() - ((at.getUTCDay() + 6) % 7))
  const week = at.toISOString().slice(0, 10)
  if (day === 'sun') return { ...pieceDecisions({ meta: row.data.meta, lock: undefined, scripts: undefined }), week, day: 'mon' }
  const sha = await branchSha(fetcher, env, 'main')
  const RAW = `https://raw.githubusercontent.com/${ENGINE_REPO}/${sha || 'main'}`
  // A lock file that is not there is no lock; any other failure leaves every lock unknown.
  const lockText = async (d: PostedDay): Promise<string | null | undefined> => {
    try { const r = await fetcher(`${RAW}/docs/plans/${week}-week/narrative-lock-${d}.md`); return r.status === 200 ? await r.text() : r.status === 404 ? null : undefined } catch { return undefined }
  }
  const [picksRead, ...texts] = await Promise.all([
    db.from('board_documents').select('doc_id,body,updated_by,updated_at').eq('week', week).eq('collection', 'picks'),
    ...LOCK_DAYS.map(lockText),
  ])
  const picks = picksRead.error ? null : (picksRead.data || []) as Array<{ doc_id: string; body: Body; updated_by: string; updated_at?: string }>
  const locksRead = !texts.includes(undefined)
  const locks = Object.fromEntries(LOCK_DAYS.map((d, k) => [d, texts[k] ?? null])) as ViewInputs['locks']
  // The scripts filed on the piece now, so his approval counts only for the words he approved; unread leaves them unknown.
  const overlay = await readOverlay(db as never, week, [id]).catch(() => null)
  const filed = overlay ? (await readFiledScripts(db, overlay, [id]).catch(() => null))?.[id] ?? [] : undefined
  return { ...pieceDecisions({ meta: row.data.meta, lock: locksRead && picks ? lockStateOf(locks, picks, day, id) : undefined,
    scripts: picks ? scriptsStateOf(picks, day, id) : undefined, filed }), week, day }
}

/** The newest filed script of each cut on each piece, with its words (F47). */
export async function readFiledScripts(db: SupabaseClient, overlay: Overlay | null, pieceIds: string[]): Promise<Record<string, FiledScript[]>> {
  const out: Record<string, FiledScript[]> = {}
  if (!overlay) return out
  const mats = (overlay.materials || []).filter(isObj).map(m => ({ id: String(m.id || ''), title: String(m.title || ''), role: typeof m.role === 'string' ? m.role : null,
    at: typeof m.at === 'string' ? m.at : null, scope: m.scope, where: m.scope === m.piece_id ? 'piece' : 'day', storage: m.storage }))
  const { readMaterial } = await import('../_pieceStore.js')
  for (const id of pieceIds) {
    const found = newestScripts(mats.filter(m => m.scope === id && m.storage === 'text'), id)
    const read = await Promise.all(found.map(async ({ cut, m, both }) => {
      try {
        const got = await readMaterial(db as never, m.id)
        const whole = got.kind === 'text' && typeof got.body.content === 'string' ? got.body.content.trim() : ''
        // One material holding both cuts gives each cut only its own words, under its heading (17 Nov, Wed 18).
        const text = both ? (scriptSection(whole, cut) ?? '') : whole
        return text ? { cut, id: m.id, title: m.title, text, at: m.at } : null
      } catch { return null }
    }))
    const ok = read.filter((x): x is FiledScript => Boolean(x))
    if (ok.length) out[id] = ok
  }
  return out
}

/** Each piece's production plan (_productionPlan.ts): the newest text material with role production_plan on the piece,
 *  parsed and bound to its sha256. A plan that cannot be read or parsed is left off, never guessed. */
export async function readProductionPlans(db: SupabaseClient, overlay: Overlay | null, pieceIds: string[], pieces: Body[] = []): Promise<Record<string, ProductionPlan>> {
  const out: Record<string, ProductionPlan> = {}
  if (!overlay) return out
  const mats = (overlay.materials || []).filter(isObj).filter(m => m.role === PLAN_ROLE && m.storage === 'text')
  const { readMaterial } = await import('../_pieceStore.js')
  for (const id of pieceIds) {
    const newest = mats.filter(m => m.scope === id).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0]
    if (!newest) continue
    try {
      const got = await readMaterial(db as never, String(newest.id))
      const text = got.kind === 'text' && typeof got.body.content === 'string' ? got.body.content : ''
      const plan = text ? parsePlan(text, id, createHash('sha256').update(text).digest('hex')) : null
      if (plan) out[id] = plan
    } catch { /* left off */ }
  }
  // 1.30.0: beside each plan, the files he got himself for it and the piece's bound post folder (_postFolder.ts).
  const ids = Object.keys(out)
  if (!ids.length) return out
  const { GOT_ROLE, beatsOfKey } = await import('../_postFolder.js')
  const gotMats = (overlay.materials || []).filter(isObj).filter(m => m.role === GOT_ROLE && ids.includes(String(m.scope)) && m.storage === 'bucket')
  const drive = await readGotInDrive(db, [...new Set(gotMats.map(m => String(m.sha256 || '')).filter(x => /^[a-f0-9]{64}$/.test(x)))])
  for (const id of ids) {
    const piece = pieces.find(p => String(p.id).toLowerCase() === id)
    const meta = piece && isObj(piece.meta) ? piece.meta : {}
    const folder = currentFolder(isObj(meta.making) ? meta.making as never : null, piece?.scheduled_for)
    out[id] = { ...out[id], folder, got: gotMats.filter(m => m.scope === id).sort((a, b) => String(a.at || '').localeCompare(String(b.at || ''))).map(m => {
      const sha = String(m.sha256 || '')
      const rows = (drive.get(sha) ?? []).filter(r => !folder || r.path.startsWith(`3 Posts/${folder}/`))
      const written = rows.find(r => r.written)
      const state: PlanGot['drive']['state'] = drive === UNREAD ? 'filing' : written ? 'in_drive' : rows.length ? 'filing' : 'not_filed'
      return { id: String(m.id), title: String(m.title || 'file'), kind: String(m.kind || 'file'), content_type: typeof m.content_type === 'string' ? m.content_type : null,
        beats: beatsOfKey(m.key) ?? [], at: typeof m.at === 'string' ? m.at : null, drive: { state, path: (written ?? rows[0])?.path ?? null } }
    }) }
  }
  return out
}

const UNREAD = new Map<string, Array<{ path: string; written: boolean }>>()
/** Where each of his files is in the asset library's folder for his own files: written into Drive by the library sync,
 *  or waiting for it. A library that cannot be read answers UNREAD, so no file is called missing on a failed read. */
async function readGotInDrive(db: SupabaseClient, shas: string[]): Promise<Map<string, Array<{ path: string; written: boolean }>>> {
  if (!shas.length) return new Map()
  const r = await db.from('content_library_files').select('path,sha256,state,written').in('sha256', shas)
    .like('path', '3 Posts/%/3 Video/Your materials/%').eq('state', 'ready')
  if (r.error || !Array.isArray(r.data)) return UNREAD
  const out = new Map<string, Array<{ path: string; written: boolean }>>()
  for (const row of r.data as Array<{ path: string; sha256: string; written: unknown }>) {
    const list = out.get(row.sha256) ?? []
    list.push({ path: row.path, written: isObj(row.written) && Object.keys(row.written).length > 0 })
    out.set(row.sha256, list)
  }
  return out
}

/** Read every input of the week now and build its view. Each source that cannot be read is said in sources, never a failure. */
export async function readView(db: SupabaseClient, week: string, env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch as unknown as Fetcher, now = new Date(),
  /** The week's posts in Drive (_drivePosts.ts); a test passes its own, or one that answers null. */
  drive?: (week: string) => Promise<DrivePost[] | null>): Promise<WeekView> {
  // main and the week's branch, each at the commit it points at now when the token can ask (branchSha); otherwise by name.
  const [mainSha, weekSha] = await Promise.all([branchSha(fetcher, env, 'main'), branchSha(fetcher, env, `offday-revise/${week}`)])
  const RAW = `https://raw.githubusercontent.com/${ENGINE_REPO}/${mainSha || 'main'}`
  // The week's plan from both: main (where a session writes a piece's production pick) and the week's branch (where the
  // runs write), merged from where they split (mergeWeekPlan), so neither side's newer write is hidden by the other's.
  const ideasPath = `docs/plans/${week}-week/ideas.json`
  const weekIdeas: Promise<string | null> = weekSha === null ? Promise.resolve(null) : (async () => {
    const [w, m, base] = await Promise.all([
      fetchText(fetcher, `https://raw.githubusercontent.com/${ENGINE_REPO}/${weekSha || `offday-revise/${week}`}/${ideasPath}`),
      fetchText(fetcher, `${RAW}/${ideasPath}`),
      mainSha && weekSha ? mergeBaseSha(fetcher, env, mainSha, weekSha) : Promise.resolve(null),
    ])
    if (!w || !m) return w ?? m
    // Without the point they split, the week branch's copy is read whole, as before.
    const b = base ? await fetchText(fetcher, `https://raw.githubusercontent.com/${ENGINE_REPO}/${base}/${ideasPath}`) : null
    if (!b) return w
    try { return JSON.stringify(mergeWeekPlan(JSON.parse(b), JSON.parse(m), JSON.parse(w))) } catch { return w }
  })()
  const [pieces, picks, queue, history, ideasText, nowText, runs, ...locks] = await Promise.all([
    // The week's pieces, and the records of its off-day video posts, linked to it and never scheduled (_offdayPiece.ts).
    Promise.all([
      db.from('content_ideas').select('id, idea, thesis, scheduled_for, lane_slot, state, buried_at, body, meta, updated_at')
        .gte('scheduled_for', week).lte('scheduled_for', dayDate(week, 'sun')).then(r => (r.error ? [] : r.data || [])),
      db.from('content_ideas').select('id, idea, thesis, scheduled_for, lane_slot, state, buried_at, body, meta, updated_at')
        .eq('meta->offday_link->>week', week).limit(60).then(r => (r.error ? [] : r.data || [])),
    ]).then(([on, linked]) => [...on, ...linked.filter(x => !on.some(y => y.id === x.id))]),
    db.from('board_documents').select('doc_id,body,updated_by,updated_at,revision').eq('week', week).eq('collection', 'picks').then(r => (r.error ? [] : r.data || [])),
    db.from('board_documents').select('doc_id,body,updated_by,updated_at,revision').eq('week', week).eq('collection', 'queue').then(r => (r.error ? [] : r.data || [])),
    db.from('board_history').select('collection,doc_id,updated_at,updated_by').eq('week', week).order('updated_at', { ascending: false }).limit(12)
      .then(r => (r.error ? [] : r.data || [])),
    // The week's revise branch with main: offday-revise pushes his revised cards there, and GitHub Actions may not open
    // the pull request that brings them to main, so the board reads them where they are, the moment they exist.
    weekIdeas.then(t => t ?? fetchText(fetcher, `${RAW}/${ideasPath}`)),
    fetchText(fetcher, `${RAW}/NOW.md`),
    readRuns(env, fetcher as never),
    // Every day's lock, not only the series days': a lock follows its piece (lockOf), and a piece moved to an off day
    // keeps its lock there (Tue 17 Nov's data-centres piece, narrative-lock-tue.md).
    ...LOCK_DAYS.map(d => fetchText(fetcher, `${RAW}/docs/plans/${week}-week/narrative-lock-${d}.md`)),
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
  // The scripts sessions filed on each piece for his Approve, with their words, so the card can offer his Approve
  // scripts the moment they are filed (F47). A script that cannot be read is left off, never guessed.
  const scripts = await readFiledScripts(db, overlay, (pieces as Body[]).map(p => String(p.id).toLowerCase()))
  // Each piece's production plan, made after his takes are in (_productionPlan.ts, contract 1.25.0).
  const productionPlans = await readProductionPlans(db, overlay, (pieces as Body[]).map(p => String(p.id).toLowerCase()), pieces as Body[])
  // Each piece's draft manifest (1.8.0), whose sha256 his Approve for publish binds.
  // Every day's piece, an off-day piece he records included (Krish, 2026-11-18: once the final assets are made and filed,
  // that is the final state, where he presses Publish).
  const drafts = await readDrafts(db, (pieces as Body[]).filter(p => PUBLISH_DAYS.some(d => p.scheduled_for === dayDate(week, d)))).catch(() => new Map<string, Draft>())
  // The approvals that stand now (the ideas gate): null when they cannot be read, and then every piece is held. Beside
  // them, the one place every off-day item's day lives (offday_items).
  // One post, one item (contract 1.10.0): every item of every week on a day or in his Ideas for Later, and the plans of
  // the weeks beside this one, so the same post is drawn on one day only and the day it is on says where else it is up.
  // The three video sign-off cards (contract 1.11.0): the manifest and the configs it writes, from main, and his presses.
  const signOffs = Promise.all([readSignOffSources(fetcher, mainSha), readSignOffPresses(db).catch(() => null)])
    .then(([s, p]) => signOffsView(s.manifest, p ?? [], s.configs)).catch(() => null)
  const [approvals, items, allItems, recentPieces, ...beside] = await Promise.all([readApprovals(db, week), readItems(db, week), readItemsIn(db, ['offered', 'approved', 'later']),
    // The series pieces of the 14 days before the week and those in work for the weeks after it, with their source, so an
    // idea that retells one, or is one, leaves the board (Ruling, Krish, 2026-11-19).
    db.from('content_ideas').select('id, idea, thesis, scheduled_for, state, buried_at, source_url, canonical_url')
      .gte('scheduled_for', shiftYmd(week, -14)).lt('scheduled_for', shiftYmd(week, 63)).in('state', ['drafting', 'review', 'approved', 'published'])
      .then(r => (r.error ? [] : r.data || []), () => []),
    ...[-7, 7].map(n => readWeekIdeas(shiftYmd(week, n), env, fetcher).catch(() => null))])
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
  // Last week's meme templates he has not answered stay on offer this week (Ruling, Krish, 2026-11-19; _carryTemplates.ts).
  {
    const last = shiftYmd(week, -7)
    const lastQueue = await db.from('board_documents').select('doc_id,body').eq('week', last).eq('collection', 'queue')
      .then(r => (r.error ? [] : (r.data || []) as Array<{ doc_id: string; body: unknown }>), () => [])
    const approvedIds = new Set(((allItems || []) as Array<{ option_id?: string; state?: string }>).filter(x => x.state === 'approved').map(x => String(x.option_id)))
    ideas = carryTemplates(ideas, last, (beside[0] ?? null) as Body | null, lastQueue, approvedIds)
  }
  let north: { current: number; target: number; measured?: number } | null = null
  const m = nowText ? /<!-- north-star-state (\{.*?\}) -->/.exec(nowText) : null
  try { if (m) { const s = JSON.parse(m[1]); north = { current: Number(s.current), target: Number(s.week_target) } } } catch { north = null }
  // The published count, live: a post he marks live moves it at once, not at the next morning's measurement.
  if (north) {
    const live = await publishedNow(db, now).catch(() => null)
    if (live !== null) north = { current: live, target: north.target, measured: north.current }
  }
  return buildView({ week, now, pieces: pieces as Body[], picks: picks as ViewInputs['picks'], queue: queue as ViewInputs['queue'],
    history: history as ViewInputs['history'], ideas, runs, north_star: north,
    locks: Object.fromEntries(LOCK_DAYS.map((d, k) => [d, locks[k] as string | null])),
    research_files: Object.fromEntries(SERIES_DAYS.map((d, k) => [d, Boolean(research[k])])), formats, motion,
    specs: Object.fromEntries(SERIES_DAYS.map((d, k) => [d, specs[k]])), inspiration, overlay, scripts, productionPlans, approvals,
    comments: commentRows as ViewInputs['comments'], ticks: tickRows as ViewInputs['ticks'], revision: signal as number | null,
    drive_posts: await drivePosts, drafts: Object.fromEntries(drafts), items, all_items: allItems, recent_pieces: recentPieces as Body[],
    plans: { [shiftYmd(week, -7)]: beside[0] ?? null, [shiftYmd(week, 7)]: beside[1] ?? null }, sign_offs: await signOffs })
}

/** A week's ideas.json as the view reads it: the week's offday-revise branch first, then main, each at the commit it
 *  points at now when the board's token can ask. Null when neither has it. */
export async function readWeekIdeas(week: string, env: Record<string, string | undefined> = process.env, fetcher: Fetcher = fetch as unknown as Fetcher): Promise<Body | null> {
  const [mainSha, weekSha] = await Promise.all([branchSha(fetcher, env, 'main'), branchSha(fetcher, env, `offday-revise/${week}`)])
  const branch = weekSha === null ? null : await fetchText(fetcher, `https://raw.githubusercontent.com/${ENGINE_REPO}/${weekSha || `offday-revise/${week}`}/docs/plans/${week}-week/ideas.json`)
  const text = branch ?? await fetchText(fetcher, `https://raw.githubusercontent.com/${ENGINE_REPO}/${mainSha || 'main'}/docs/plans/${week}-week/ideas.json`)
  try { const v = text ? JSON.parse(text) : null; return isObj(v) ? v : null } catch { return null }
}

/** "Live on Instagram, TikTok. Growth posted it, Tue 10 Nov, 12:34", from Growth's own record of the posts; "Buffer
 *  shows it sent" when only the done-check sweep saw the send in Buffer (check buffer_sent). */
export function growthLiveLine(posts: GrowthPost[]): string {
  const sorted = [...posts].sort((a, b) => a.at.localeCompare(b.at))
  const channels = [...new Set(sorted.map(p => channelWord(p.channel)))]
  const last = sorted[sorted.length - 1]
  const who = sorted.length && sorted.every(p => p.check === 'buffer_sent') ? 'Buffer shows it sent' : 'Growth posted it'
  const live = `Live on ${channels.join(', ')}. ${who}${last?.at ? `, ${approvedWhen(last.at)}` : ''}`
  // The live check (Krish, 2026-11-19): what each send was checked for, and what went out wrong, said plainly. A post Buffer
  // could not be read for says nothing: never "checked".
  const checked = sorted.filter(p => p.verify)
  const wrong = checked.flatMap(p => (p.verify!.ok ? [] : p.verify!.failed.map(f => `${channelWord(p.channel)}: ${f}`)))
  if (wrong.length) return `${live}. It did not all go out right: ${wrong.join('; ')}`
  if (checked.length && checked.length === sorted.length) return `${live}. Checked live: every post matches how it was made`
  return live
}

/** What Growth posted on a day for its off-day items, from its own record: one line per channel, with the post's link. */
export function growthPosted(items: OffdayItem[] | null | undefined, week: string, day: PostedDay): ViewPosted[] {
  const out: ViewPosted[] = []
  for (const r of items ?? []) {
    if (r.state !== 'approved' || r.week !== week || r.day !== day) continue
    for (const p of r.posts) if (p.state === 'live' && p.channel) out.push({ step: p.channel, label: channelWord(p.channel), at: p.at || null, ...(p.url ? { href: p.url } : {}), by: 'growth' })
  }
  return out
}
