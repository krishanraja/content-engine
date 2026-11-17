import { SERIES_DAYS, type PostedDay } from './_posted.js'
import { writeBack } from './_writeBack.js'
import { asWritten, backDocId, takenBackAt, wordsBody, wordsDocId } from './_contracts.js'
import { spokenTitle, type FiledScript, type PieceDecisions } from './_decisions.js'
import type { MoveSpec, OffdayItem } from './_offdayItems.js'
import { thoughtPress, type PressAction, type ViewOption } from './_viewExtras.js'
import type { Action, DayView, LockToSign, PromptAction } from './_view.js'
import { thumbsPress } from './_thumbs.js'
import { NEVER_HEADLESS, ROUTE_RULING, makeRoute, routeLine, type MakeRoute } from './_makeRoute.js'
import type { DayStyle, StyleLayer } from './_style.js'
import { RECORD_MYSELF, audioPresses, soundLine, voiceOf } from './_audio.js'
import { canonicalUrl, titleNorm } from '../_text.js'
import { offdayPieceId, videoOffday } from './_offdayPiece.js'
import { productionBrief, takesInOf, takesLine, takesPress, type TakesIn } from './_takesIn.js'

// The week model (contract 1.12.0): the one thing the Publish Board draws.
//
// Ruling (Krish, 2026-11-13): the publish board shows only what he approved, in one week model (three pieces and
// off-day posts of fixed kinds), one action per item, ideas only on the ideas board, and never the old composer. His
// words: "Monday, Wednesday, and Friday are set-in-stone ideas on that topic: branded, fleshed out, production planned,
// and then produced. On a Sunday, I decide where all the off-day stuff goes. In general, we have carousels that support
// Monday, Wednesday, or Friday. We have voiceovers, explainers, uplifting carousels, and memes. How has the stability
// and predictability of this, from a data and a UI perspective, gotten so weird?"
//
// So the week is two kinds of thing, computed here from the records the view already reads (the pieces in
// content_ideas through the gate, the off-day items in offday_items, his presses, Growth's records) and nothing else:
//
// 1. The three pieces, Mon, Wed and Fri: on the board only once his approval holds them (the ideas gate), each on one
//    fixed path, Branded, Fleshed out, Production planned, Produced, Live (PIECE_PATH maps the engine's own steps onto
//    those words, here and nowhere else).
// 2. The off-day posts he approved: each of one fixed kind (OFFDAY_KINDS, one plain name each), on one day, on one
//    fixed path, Approved, Made, Scheduled, Live.
//
// Every item carries one next action: a press that does the thing (the engine's route or a run on GitHub), or the one
// Claude prompt, which tells the session to report back to the board when it is done. An idea he has not answered, an
// idea a session said was decided that he never pressed, a revised option and any other suggestion is never on a day:
// it is in `ideas`, which only the ideas board draws, with the five presses that answer it. A day's decisions are only
// his real ones: Approve for publish on a made piece, and a choice an approved post is still missing. Pure.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const cut = (v: unknown, n: number): string => { const s = str(v) ?? ''; return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s }
const https = (v: unknown): string | null => (typeof v === 'string' && /^https:\/\//.test(v) ? v : null)

/** The off-day kinds, one plain name each, the same everywhere he reads them (Ruling, Krish, 2026-11-13). */
export const OFFDAY_KINDS = [
  { key: 'supporting', label: 'Supporting carousel' },
  { key: 'voiceover', label: 'Voiceover short' },
  { key: 'explainer', label: 'Explainer' },
  { key: 'good_news', label: 'Good news' },
  { key: 'meme', label: 'Meme' },
] as const
export type OffdayKind = typeof OFFDAY_KINDS[number]['key']
const KIND_LABEL: Record<OffdayKind, string> = Object.fromEntries(OFFDAY_KINDS.map(k => [k.key, k.label])) as Record<OffdayKind, string>
const DAY_WORD: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' }

/** The kind of the piece itself: one of the three series. */
export const PIECE_KIND = { key: 'piece', label: 'The piece' } as const

/** A series piece's path, and which of the engine's own steps (_view.ts PATH and STAGES) each word stands for. */
export const PIECE_PATH = [
  { key: 'branded', label: 'Branded', from: 'story: his Approve put it in its series and the narrative lock is signed' },
  { key: 'fleshed_out', label: 'Fleshed out', from: 'research and look: the evidence is on file and the look is picked' },
  { key: 'production_planned', label: 'Production planned', from: 'board: the storyboard and both scripts are approved' },
  { key: 'produced', label: 'Produced', from: 'record and video: both cuts are recorded and cut' },
  { key: 'live', label: 'Live', from: 'cut and publish: it is out on its channels' },
] as const
/** An off-day post's path: its stage from Growth's records and his presses (_stage.ts). */
export const POST_PATH = [
  { key: 'approved', label: 'Approved' },
  { key: 'made', label: 'Made' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'live', label: 'Live' },
] as const
/** How many stories a week's good news carries: five, on one topic (Krish, 2026-11-13: "The Saturday carousel is
 *  supposed to be five good news stories on that same topic"). */
export const GOOD_NEWS_STORIES = 5
/** The one label every hand-off to a Claude session wears (Ruling, Krish, 2026-11-17: "We can distinguish the buttons by
 *  changing 'copy prompt for Claude' to \"Claude production prompt\" and the other button to \"Perplexity research prompt\""). */
export const CLAUDE_LABEL = 'Claude production prompt'
/** A Claude prompt is only copied, never opened (contract 1.22.0; Ruling, Krish, 2026-11-17: "can you stop having my Claude
 *  production prompt buttons open up a new browser window? Just copy to clipboard is enough for all such buttons"). The
 *  `open` field 1.17.0 added is never sent again; the schema keeps it, retired, so no board breaks on an older view. */
/** The heading his own words go under at the end of a prompt (Ruling, Krish, 2026-11-16: "I should be able to provide
 *  feedback or what I think the next steps are first, and then click the \"Copy to Claude\" button, and the prompt
 *  incorporates that"). */
export const NOTES_HEADING = "Krish's notes, in his own words (typed on the board just now). They come first: do what they ask before anything else."

export interface ModelStep { key: string; label: string; state: 'done' | 'current' | 'todo'; when: string | null }
export interface ModelSource { label: string; href: string | null }
export interface ModelStory { headline: string; what: string; why: string | null; date: string | null; source: string | null; href: string | null }
/** What the read sheet shows, read-only: the idea's story, its sources and the research on file. */
export interface ModelRead {
  so_what: string | null
  story: string | null
  why_now: string | null
  fact: string | null
  text: string | null
  sources: ModelSource[]
  research: string[]
  /** His words on it, or a session's, said as whose they are. */
  said: string | null
}
/** One next action: the engine's own press or run, a link to do it, or the one Claude prompt. */
export type ModelAction = Action
export interface ModelItem {
  /** `piece:<id>` for a piece, the option's document id (off-<day>-<id>) for a post. */
  key: string
  type: 'piece' | 'post'
  day: PostedDay
  date: string
  kind: string
  kind_label: string
  title: string
  /** "Approved by you, Sun 8 Nov, 08:07": the approval that holds it on its day. */
  approved: string | null
  stage: { key: string; label: string }
  path: ModelStep[]
  /** Its day passed and it is not marked live. */
  missed: boolean
  /** Where it is, in one plain sentence. */
  line: string
  next: ModelAction | null
  /** Whether `next` is one of his real decisions for the day (Approve for publish, an approved post's missing choice). */
  decision: boolean
  /** The other answers to the same decision (Improve, Reject the direction), drawn only in the read sheet. */
  others: PressAction[]
  read: ModelRead
  piece_id: string | null
  /** A post: its row in offday_items, which day it supports, Move to… and Growth's live links. */
  item: string | null
  supports: 'mon' | 'wed' | 'fri' | null
  move: MoveSpec | null
  links: Array<{ label: string; href: string }>
  /** Good news: the stories in full, and how many it should hold. Null for any other kind. */
  stories: ModelStory[] | null
  stories_planned: number | null
  /** Contract 1.17.0: the same story already went out or is already on its way (the same primary source, or the same
   *  hook), said in one line; absent when it did not. */
  repeat?: ModelRepeatOf | null
}
/** What an item or idea repeats: a piece or a post approved, scheduled or live in the 14 days before it. */
export interface ModelRepeatOf { title: string; date: string; day: string; stage: 'live' | 'scheduled' | 'approved'; kind: 'piece' | 'post'; line: string }
/** An idea that left the ideas board because it repeats something that went out (contract 1.17.0). */
export interface ModelRepeat { doc_id: string; piece_id: string | null; day: PostedDay; date: string; title: string; of: ModelRepeatOf }
/** One thing approved, scheduled or live, with its primary source and hook, that a later idea must not retell (Ruling,
 *  Krish, 2026-11-16: "this week's Ideas Board needs to not contain mostly things we published last week"). */
export interface RecentOut { keys: string[]; kind: 'piece' | 'post'; title: string; url: string | null; hook: string | null; date: string; day: string; stage: 'live' | 'scheduled' | 'approved'
  /** The board (Monday) that offered it: only an earlier board's piece or post is ever a repeat. */
  week: string
  /** The weekly good news, whose hook is the same every week by design: never matched by its hook. */
  recurring?: boolean
  /** Every source it cites: canonical URLs, and the named sources of its label, one per ';' part, as words. */
  cites?: { urls: string[]; parts: string[] } }
/** An idea he has not answered, held or revised: on the ideas board only, with the presses that answer it. */
export interface ModelIdea {
  doc_id: string
  piece_id: string | null
  day: PostedDay
  date: string
  kind: string
  kind_label: string
  title: string
  why: 'open' | 'held' | 'revised' | 'held_piece'
  line: string
  read: ModelRead
  actions: PressAction[]
  stories: ModelStory[] | null
  move: MoveSpec | null
}
export interface ModelDay {
  day: PostedDay
  date: string
  label: string
  /** The series a publishing day carries, or null on an off day. */
  series: string | null
  items: ModelItem[]
  /** How many of his real decisions the day holds. */
  decisions: number
  /** How many ideas for this day wait on the ideas board (never drawn on the day). */
  ideas: number
  line: string
}
export interface WeekModel {
  version: 1
  kinds: Array<{ key: string; label: string }>
  piece_path: Array<{ key: string; label: string }>
  post_path: Array<{ key: string; label: string }>
  days: ModelDay[]
  ideas: ModelIdea[]
  /** Contract 1.17.0: the ideas that left the board because they retell something that went out. */
  repeats?: ModelRepeat[]
}

/** What the model reads besides the view's days: the week, today, the week's plan and the pieces' rows. */
export interface ModelInputs {
  week: string
  /** The work on file by scope: each piece id, and day:<Monday>/<day> (_writeBack.ts workByScope). */
  work?: Record<string, { sessions: Array<{ by: string; state: string; step: string | null; doing: string | null; last_at: string }>; materials: Array<{ title: string; at: string | null; where?: string }> }>
  today: string
  ideas: Body | null
  /** Every plan beside this week's, by Monday (an item carried from another week keeps its words there). */
  plans?: Record<string, Body | null>
  pieces: Body[]
  /** Pieces held off a day by the gate that no option offers, each with its Approve. */
  heldPieces?: Array<{ day: PostedDay; piece: Body; press: PressAction }>
  /** The pieces a signed narrative lock of the week names (_view.ts lockOf: a lock follows its piece, not its day). */
  signedLocks?: string[]
  /** The look choices of a piece on a day that is not its series day, by piece id (_view.ts placedStyles). */
  placedStyles?: Record<string, DayStyle>
  /** His decisions on each approved piece, by piece id (_view.ts weekDecisions; _decisions.ts, F46): every Claude prompt
   *  carries them, and a placed piece's step comes from them. */
  decisions?: Record<string, PieceDecisions>
  /** The newest script of each cut filed on each piece, with its words (_view.ts readFiledScripts; F47). */
  scripts?: Record<string, FiledScript[]>
  /** What each piece's signed lock says (lockRead), for the card's read sheet (F47). */
  lockReads?: Record<string, { so_what: string | null; story: string | null }>
  /** Each piece's lock on file and unsigned, by piece id (_view.ts locksToSign). */
  locksToSign?: Record<string, LockToSign>
  /** Pieces and posts approved, scheduled or live from 14 days before the week to its end (_view.ts recentOut). */
  recentOut?: RecentOut[]
  /** The week's picks documents (board_documents, picks): his voice and track picks on an off-day post (_audio.ts). */
  picks?: Array<{ doc_id: string; body: Body; updated_by?: string; revision?: number }>
  /** The look, motion and caption choices of an off-day video post's record (_offdayPiece.ts), from its meta (_view.ts). */
  offdayStyle?: (pieceId: string, meta: unknown) => DayStyle | null
}

/** The address of the live board on a week and day: where his typed approval was given. */
const boardAt = (week: string, day: string) => `https://controlcenter.krishraja.com/#/content?week=${week}&day=${day}`
/** His "Signed." on a piece's narrative lock, as one press on the board: his typed approval of the lock as it stands
 *  (picks/<day>-lock-words, bound to the lock's words by their hash), on whatever day the piece is placed. */
export function signPress(week: string, pieceId: string, lock: LockToSign): PressAction {
  return { kind: 'press', label: 'Sign the lock', collection: 'picks', id: wordsDocId(lock.day, 'lock', pieceId), revision: lock.revision,
    body: { kind: 'sign_lock', day: lock.day, via: 'words', approved: true, piece_id: pieceId, lock_path: lock.path, lock_sha256: lock.sha256,
      said_where: 'the Publish Board in Control Centre', session_ref: boardAt(week, lock.day) },
    words: { path: 'words', ask: 'Your words to sign it ("Signed.")', required: true }, stamp: ['at', 'said_at'],
    goes: `Signs ${lock.path} as it stands now: the piece's story, in your words.`,
    done: 'Signed in your words. The lock is this piece\'s story.' } as PressAction
}
const lockSource = (path: string): ModelSource => ({ label: `The narrative lock (${path.split('/').pop()})`, href: `https://github.com/krishanraja/content-engine/blob/main/${path}` })

/** One layer of his production pick as one press: the options with the recommended first and marked, the one he picked
 *  marked, nothing he said Not this to. Treatment posts to the look route, motion and captions to the style route. */
function layerPress(pieceId: string, style: DayStyle, layer: 'treatment' | 'motion' | 'captions'): PressAction | null {
  const L: StyleLayer = style[layer]
  const opts = L.options.filter(o => !o.rejected)
  if (!opts.length) return null
  // His pick, then the recommended, then the rest, with any style ve cannot draw yet last (Krish, 2026-11-17: "Mark them
  // and build all nine"): it is shown, marked "(not ready yet)", and the style press refuses it.
  const ordered = [...opts].sort((a, b) => Number(b.id === L.picked) - Number(a.id === L.picked) || Number(b.recommended) - Number(a.recommended)
    || Number(a.ready === false) - Number(b.ready === false))
  // Each option carries its one line and, once recorded, its still (contract 1.17.0), which the board shows when he
  // hovers or picks it.
  const options = ordered.map(o => ({ value: o.id, label: `${o.name}${o.id === L.picked ? ' (picked)' : o.recommended ? ' (recommended)' : o.ready === false ? ' (not ready yet)' : ''}`,
    ...(o.line ? { line: cut(o.line, 240) } : {}), ...(o.still_url ? { still: o.still_url } : {}),
    // Why it is recommended (1.18.0), so the board shows the recommended look, motion and captions as one set with reasons.
    ...(o.recommended && o.why ? { why: cut(o.why, 240) } : {}) }))
  const word = { treatment: 'the look', motion: 'the motion style', captions: 'the captions' }[layer]
  const op = layer === 'treatment' ? 'look' : 'style'
  const path = layer === 'treatment' ? 'production' : layer
  // The option's own Yes press, without the choice itself: a look keeps his experiment and inspiration (_style.ts).
  const yes = (opts[0] as { presses?: { yes?: { body?: Record<string, unknown> } } }).presses?.yes?.body
  const body: Record<string, unknown> = { ...(yes || {}), piece_id: pieceId }
  delete body[path]
  return { kind: 'press', label: `${L.picked ? 'Change' : 'Pick'} ${word}`, op, body, stamp: [],
    choose: { path, ask: layer === 'treatment' ? 'Which look?' : layer === 'motion' ? 'Which motion style?' : 'Which captions?', multi: false, required: true, options },
    done: `Picked. It is ${word} for this piece.` } as PressAction
}
/** His production pick for a piece, before a take is recorded: the look, the motion style and the captions, each one
 *  press through the engine's own look and style routes (Krish, 2026-11-13: "just need to pick and lock down the rest
 *  of the production before I get recording"). Empty once a take is recorded or nothing can be chosen. */
export function lookPresses(pieceId: string, style: DayStyle | null | undefined): PressAction[] {
  if (!style) return []
  return (['treatment', 'motion', 'captions'] as const).map(l => layerPress(pieceId, style, l)).filter((x): x is PressAction => Boolean(x))
}

/**
 * An off-day option's kind, from what the plan says it is. A plan names it (`kind`, and `supports` for a supporting
 * carousel); an older plan is read from its words, one rule, in this order: the weekly good news or an uplifting post
 * is good news; a voiceover, or a piece he records, is a voiceover short; anything with a meme in it is a meme; an
 * explainer or an infographic is an explainer; any other carousel tied to a publishing day supports that day; anything
 * else is an explainer.
 */
export function offdayKind(o: Body): { kind: OffdayKind; supports: 'mon' | 'wed' | 'fri' | null } {
  const tied = (() => {
    const explicit = str(o.supports)?.toLowerCase().slice(0, 3)
    if (explicit === 'mon' || explicit === 'wed' || explicit === 'fri') return explicit
    const t = str(o.ties_to)?.toLowerCase() ?? ''
    const m = /\b(mon|wed|fri)[a-z]*\b/.exec(t)
    return m ? (m[1] as 'mon' | 'wed' | 'fri') : null
  })()
  const own = str(o.kind)?.toLowerCase()
  if (own && (OFFDAY_KINDS as readonly { key: string }[]).some(k => k.key === own)) return { kind: own as OffdayKind, supports: own === 'supporting' ? tied : null }
  const f = `${str(o.format) ?? ''}`.toLowerCase()
  if (o.weekly === 'good_news' || /uplifting|good[- ]news/.test(f)) return { kind: 'good_news', supports: null }
  if (/voice ?over|voice-over/.test(f) || own === 'recorded') return { kind: 'voiceover', supports: null }
  if (/\bmeme/.test(f)) return { kind: 'meme', supports: null }
  if (/explainer|infographic/.test(f)) return { kind: 'explainer', supports: null }
  if (/carousel/.test(f) && tied) return { kind: 'supporting', supports: tied }
  return { kind: 'explainer', supports: null }
}

/** A kind's plain name: a supporting carousel says which day's piece it supports. */
export function kindLabel(kind: OffdayKind, supports: string | null): string {
  return kind === 'supporting' && supports ? `Carousel for ${DAY_WORD[supports]}'s piece` : KIND_LABEL[kind]
}

/** The plan's own option for a day's option id, this week's or (an item carried here) any other week's. */
function rawOption(m: ModelInputs, day: string, id: string): Body | null {
  const plans = [m.ideas, ...Object.values(m.plans || {})]
  for (const p of plans) {
    if (!isObj(p)) continue
    for (const group of ['offdays', 'days']) {
      const g = isObj(p[group]) ? p[group] as Body : {}
      const own = Array.isArray(g[day]) ? (g[day] as unknown[]) : []
      const hit = own.filter(isObj).find(o => String(o.id).toLowerCase() === id.toLowerCase())
      if (hit) return hit
    }
    for (const group of ['offdays', 'days']) {
      const g = isObj(p[group]) ? p[group] as Body : {}
      for (const list of Object.values(g)) {
        const hit = (Array.isArray(list) ? list : []).filter(isObj).find(o => String(o.id).toLowerCase() === id.toLowerCase())
        if (hit) return hit
      }
    }
  }
  return null
}

const sourceOf = (v: unknown): ModelSource | null => {
  if (isObj(v)) { const label = str(v.label) ?? str(v.url); return label ? { label: cut(label, 200), href: https(v.url) } : null }
  const s = str(v)
  return s ? { label: cut(s, 200), href: https(s) } : null
}

/** The stories a good-news option holds, in full. One that names no stories of its own is its own one story. */
export function storiesOf(raw: Body | null, o: ViewOption): ModelStory[] {
  const list = raw && Array.isArray(raw.stories) ? (raw.stories as unknown[]).filter(isObj) : []
  if (list.length) {
    return list.map(st => {
      const src = sourceOf(st.source)
      return { headline: cut(st.headline, 200), what: cut(st.what, 600), why: str(st.why) ? cut(st.why, 400) : null,
        date: str(st.date), source: src?.label ?? null, href: src?.href ?? null }
    })
  }
  if (Array.isArray(o.stories) && o.stories.length) {
    return o.stories.map(st => ({ headline: st.headline, what: st.what, why: null, date: st.date, source: st.source, href: st.href ?? null }))
  }
  const src = sourceOf(raw?.source ?? o.source)
  const pitch = raw && isObj(raw.pitch) ? raw.pitch as Body : {}
  return [{ headline: cut(raw?.hook ?? o.title, 200), what: cut(raw?.copy ?? o.text, 600), why: str(pitch.share) ? cut(pitch.share, 400) : str(pitch.lands) ? cut(pitch.lands, 400) : null,
    date: null, source: src?.label ?? null, href: src?.href ?? null }]
}

function readOf(raw: Body | null, extra: { title?: string; text?: string | null; said?: string | null; research?: string[]; row?: Body | null; source?: string | null }): ModelRead {
  const pitch = raw && isObj(raw.pitch) ? raw.pitch as Body : null
  const sources: ModelSource[] = []
  const add = (s: ModelSource | null) => { if (s && !sources.some(x => x.label === s.label)) sources.push(s) }
  add(sourceOf(raw?.source))
  if (raw && Array.isArray(raw.sources)) for (const s of raw.sources) add(sourceOf(s))
  if (!sources.length && extra.source) add(sourceOf(extra.source))
  const story = str(raw?.story) ?? (extra.row ? str(extra.row.idea) : null)
  const text = pitch ? [str(pitch.see), str(pitch.lands)].filter(Boolean).join(' ') || null : str(raw?.copy) ?? extra.text ?? null
  return {
    so_what: str(raw?.so_what) ?? (extra.row ? str(extra.row.thesis) : null),
    story: story ? cut(story, 4000) : null,
    why_now: str(raw?.why_now),
    fact: str(raw?.fact) ? cut(raw!.fact, 1200) : null,
    text: text ? cut(text, 1200) : null,
    sources,
    research: [...new Set(extra.research || [])].slice(0, 40),
    said: extra.said ?? null,
  }
}

/** How an off-day post is made, before the write-back: its route (a carousel, a meme or a Notes image in a Claude
 *  session with the Codex plugin; a voiceover short or a meme video on the ve route; Ruling, Krish, 2026-11-13;
 *  _makeRoute.ts), else the plain hand-off to Growth. */
export function offdayHead(route: MakeRoute | null): string {
  if (!route) return 'Growth makes and posts off-day posts (krishanraja/growth-makeyourmindup), to content-engine docs/CAROUSEL-STANDARD.md and the rejection floor. Make or post exactly what Krish approved, nothing else.\n\n'
  return `${routeLine(route)}\n\nMake exactly what Krish approved, nothing else, to the rejection floor`
    + `${route === 'still' ? ' and content-engine docs/CAROUSEL-STANDARD.md' : ''}; Growth (krishanraja/growth-makeyourmindup) posts it.\n\n`
}

/** What the prompt says to do with the story, by where the piece is (Ruling, Krish, 2026-11-16: "Even though this piece is
 *  locked, I should be able to tweak the narrative slightly in it by opening a session with Claude"). */
export interface StoryState { approved: boolean; path?: string | null }
function storyLines(story: StoryState | null | undefined): string {
  if (!story) return ''
  const file = story.path ? `The story is ${story.path}.` : 'The story is its narrative file in this week\'s docs/plans folder (narrative-lock-<day>.md, found by its piece_id line).'
  return story.approved
    ? `${file} Krish has approved it. If his notes below change the story (a new angle is a rewrite, not a patch), write the changed story into the same file and take his approval line off its end (a story changed under his approval is not the story he approved: making.py refuses it), so the board asks him to approve the new story. Otherwise take the next step.\n\n`
    : `${file} Krish has not approved it yet. If his notes below ask for a change or a different angle, rewrite it to them, then tell him it is ready to approve on the board. If something in it is still open, settle it with him first.\n\n`
}

/** The one Claude prompt for an item: what it is, where it stands, how it is made and how to report back to the board.
 *  Contract 1.17.0: it asks for his notes first (`notes`, saved as his comment on the day). The board only copies it
 *  (contract 1.22.0). `head`, when given, says how an off-day post is made at its stage in place of offdayHead. */
export function itemPrompt(week: string, it: { day: PostedDay; date: string; title: string; line: string; kind_label: string; piece_id: string | null; key: string }, step: string, route: MakeRoute | null = null, story: StoryState | null = null, decisions: PieceDecisions | null = null, reportAs: string | null = null, head: string | null = null): ModelAction {
  const what = it.piece_id ? `the ${DAY_WORD[it.day]} ${it.date} piece ${it.piece_id}` : `the ${DAY_WORD[it.day]} ${it.date} off-day post ${it.key} (${it.kind_label})`
  const growth = !it.piece_id
  const prompt = `You are picking up ${what} of the Make Your Mind Up content engine with no prior context: "${it.title}". `
    + `Where it stands: ${it.line}\n\n`
    + (head ?? (growth
      ? offdayHead(route)
      : 'The repository is krishanraja/content-engine: read AGENTS.md and CLAUDE.md once for the house rules. Work freely; when you need Krish, ask him the one question that changes the work most.\n\n'))
    + storyLines(story)
    + writeBack({ pieceId: it.piece_id ?? reportAs, week, day: it.day, step, decisions })
  const base = thoughtPress(it.day, stepAnchor(step))
  const save: PressAction = { ...base, label: 'Your notes for Claude', done: 'Saved on the board, and in the prompt.',
    body: { ...base.body, use: 'claude_notes', title: cut(it.title, 300), ...(it.piece_id ? { piece_id: it.piece_id } : { item: it.key }) },
    words: { path: 'text', ask: 'Your notes for Claude', required: true } }
  const action: PromptAction = { kind: 'prompt', label: CLAUDE_LABEL, tool: 'claude', prompt,
    notes: { ask: 'Your notes for Claude: what to change, or what you think the next step is', heading: NOTES_HEADING, save } }
  return action
}
/** A step as the comment anchor's last part: lower case letters, digits and dashes. */
const stepAnchor = (step: string): string => (step.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'next')

/** A press that does the thing: the engine's own route or a run on GitHub, never a page of the archive. */
function doable(a: Action | undefined): boolean {
  if (!a) return false
  if (a.kind === 'run' || a.kind === 'research') return true
  if (a.kind === 'open') return /^https:\/\//.test(a.href)
  if (a.kind === 'press') return a.collection !== 'comments' && a.op !== 'material'
  return false
}

const isLive = (a: Action, match: Body): boolean => a.kind === 'press' && a.op === 'live' && isObj(a.body)
  && Object.entries(match).every(([k, v]) => String((a.body as Body)[k] ?? '').toLowerCase() === String(v).toLowerCase())

/** A path with its first `done` steps done and the next one current; each done step with its day where the record has it. */
function steps(path: ReadonlyArray<{ key: string; label: string }>, done: number, when: Array<string | null> = []): ModelStep[] {
  return path.map((s, n) => ({ key: s.key, label: s.label, state: n < done ? 'done' : n === done ? 'current' : 'todo', when: n < done ? when[n] ?? null : null }))
}
/** Where an item is: the furthest step done, or Approved when none is (a piece his Approve placed, not branded yet). */
function stageOf(path: ReadonlyArray<{ key: string; label: string }>, done: number): { key: string; label: string } {
  return done > 0 ? { key: path[done - 1].key, label: path[done - 1].label } : { key: 'approved', label: 'Approved' }
}

/** A series day's piece on the board: its path, where it is and its one next action. */
function pieceItem(m: ModelInputs, d: DayView): ModelItem | null {
  if (!d.piece_id || !SERIES_DAYS.includes(d.day)) return null
  const p = d.pieces.find(x => x.id === d.piece_id)
  if (!p || !p.approval) return null
  const isDone = (k: string) => d.path?.steps.find(s => s.key === k)?.state === 'done'
  const stage = (k: string) => d.path?.stages.find(s => s.key === k)
  const out = d.who === 'done' || p.stage?.state === 'live'
  const flags = [isDone('story'), isDone('look'), isDone('board'), stage('after_recording')?.state === 'done' || isDone('cut'), out]
  // A later step done means the ones before are too, except that scripts agreed (board) never mark the look picked: the
  // view's own steps already carry that (_view.ts), so only a take recorded or a piece out reaches back past the look.
  for (let k = flags.length - 1; k > 0; k--) if (flags[k] && k !== 2) flags[k - 1] = true
  // A path is a prefix: scripts agreed before the look leave the piece at Fleshed out until he picks it (_view.ts).
  const done = Math.max(0, flags.findIndex(f => !f)) || (flags.every(Boolean) ? flags.length : 0)
  const when = [stage('agreed')?.when ?? null, stage('flesh_out')?.when ?? null, null, stage('after_recording')?.when ?? null, out ? (p.stage?.at?.slice(0, 10) ?? d.date) : null]
  const path = steps(PIECE_PATH, done, when)
  const missed = d.who === 'missed'
  const raw = rawOption(m, d.day, d.piece_id)
  const row = m.pieces.find(x => String(x.id).toLowerCase() === d.piece_id) ?? null
  const read = withWork(readOf(raw, { row, research: [...(d.path?.materials || []).map(x => x.title), ...d.materials.map(x => x.title)] }), m, [d.piece_id, dayScope(m.week, d.day)])
  const where = stageOf(PIECE_PATH, done)
  const label = where.label
  const base = { key: `piece:${d.piece_id}`, type: 'piece' as const, day: d.day, date: d.date, kind: PIECE_KIND.key, kind_label: d.series,
    title: workingTitle(m, d.piece_id, d.title, out), approved: p.approval.label, stage: where, path, missed, read, piece_id: d.piece_id,
    item: null, supports: null, move: p.move ?? null, links: p.stage?.links ?? [], stories: null, stories_planned: null, others: [] as PressAction[] }
  if (out) return { ...base, line: p.stage?.state === 'live' ? p.stage.label : d.next, next: null, decision: false }
  // His Approve for publish on the made piece, bound to its manifest: his decision for the day.
  const publish = d.manifest?.press && d.manifest.state !== 'approved' ? d.manifest.press as unknown as PressAction : null
  const yes = d.actions.find(a => a.kind === 'press' && a.collection === 'picks' && isObj(a.body) && (a.body as Body).kind === 'yes')
  const decision = publish ?? yes ?? null
  const line = missed ? `Missed: ${d.label} passed and it is not marked live. If it went out, press It's live with its link.` : `${label}. ${d.next.replace(/[.\s]+$/, '')}.`
  if (decision && !missed) return { ...base, line, next: decision, decision: true }
  // His pick of the thumbnail (contract 1.16.0, _thumbs.ts): while a judged set waits on him, it is his decision for the
  // day; the board opens the options at their own shapes, and the choice is the fallback a board that cannot draw them
  // still makes.
  const thumbs = missed ? null : thumbsPress(d.thumbs ?? null)
  if (thumbs) return { ...base, line: `${label}. ${d.thumbs!.line}`, next: thumbs as unknown as Action, decision: true }
  const live = d.actions.find(a => isLive(a, { piece_id: d.piece_id! }))
  if (live && (missed || d.who === 'growth')) return { ...base, line, next: { ...live, label: "It's live" } as Action, decision: false }
  // His production pick, before a take is recorded: the look, the motion style and the captions, each one press (the
  // engine's look and style routes). At the look step the look is his decision for the day; at any earlier step the
  // three wait in the read sheet, so he can pick before or after he signs the lock.
  const recorded = isDone('record') || isDone('cut') || out
  const picks = recorded || missed ? [] : lookPresses(d.piece_id, d.path?.style)
  // After his approval of the story the prompt stays beside the picks, so he can still change the story (Ruling, Krish,
  // 2026-11-16).
  const story = (approved: boolean, path: string | null = null): StoryState => ({ approved, path })
  if (d.path?.current === 'look' && picks.length) {
    return { ...base, line, next: picks[0] as Action, decision: true,
      others: [itemPrompt(m.week, { ...base, line }, 'look', null, story(true), m.decisions?.[d.piece_id] ?? null) as unknown as PressAction, ...picks.slice(1)] }
  }
  // His "Signed." on the lock on file, one press, when the story is the step.
  const toSign = m.locksToSign?.[d.piece_id]
  if (d.path?.current === 'story' && toSign && !missed) {
    const prompt = itemPrompt(m.week, { ...base, line }, 'story', null, story(false, toSign.path), m.decisions?.[d.piece_id] ?? null) as unknown as PressAction
    return { ...base, read: { ...read, sources: [lockSource(toSign.path), ...read.sources] }, line, next: signPress(m.week, d.piece_id, toSign) as Action,
      decision: true, others: [prompt, ...picks] }
  }
  // The scripts filed for his Approve on the day's own piece: his Approve scripts leads, bound to the exact words filed,
  // as on a placed piece (F47). Wed 18 Nov sat at "Make the storyboard and the script together" with both scripts filed
  // (Krish, 2026-11-17: "the board just has no idea of the work done or what next steps are (I need to approve the
  // scripts)").
  const ready = !recorded && !missed && d.path?.current === 'board' ? scriptsReady(m, d.day, d.piece_id, d.title, label) : null
  if (ready) {
    const { press, line: readyLine } = ready
    return { ...base, line: readyLine, next: press as Action, decision: true,
      others: [itemPrompt(m.week, { ...base, line: readyLine }, 'board', null, isDone('story') ? story(true) : null, m.decisions?.[d.piece_id] ?? null) as unknown as PressAction, ...picks] }
  }
  // His approval counts; a send the server held is said in one line, and the next action checks the scripts and sends.
  const held = !recorded && !missed ? heldSend(m, d.piece_id) : null
  if (held) {
    const edit = approveAgainPress(m, d.day, d.piece_id, d.title)
    return { ...base, line: held.line, next: (edit ?? itemPrompt(m.week, { ...base, line: held.line }, 'teleprompter', null, isDone('story') ? story(true) : null, m.decisions?.[d.piece_id] ?? null)) as Action,
      decision: Boolean(edit), others: [...(edit ? [itemPrompt(m.week, { ...base, line: held.line }, 'teleprompter', null, isDone('story') ? story(true) : null, m.decisions?.[d.piece_id] ?? null) as unknown as PressAction] : []), ...picks] }
  }
  // Scripts approved: his takes in the Inbox, then the one post-production prompt (_takesIn.ts).
  const scriptsMade = m.decisions?.[d.piece_id]?.items.find(x => x.key === 'scripts')?.made === true
  const produce = scriptsMade && !out && !missed && !isDone('cut') ? productionStage(m, { pieceId: d.piece_id, title: d.title, item: null, style: d.path?.style, offday: false,
    read, decided: m.decisions?.[d.piece_id] ?? null, reportAs: null, base }) : null
  const link = d.actions.find(a => a.kind === 'open' && doable(a))
  if (produce) return { ...base, line: produce.line, next: produce.next, decision: produce.decision, others: [...produce.others, ...(link ? [link as unknown as PressAction] : []), ...picks] }
  const lead = d.actions[0]
  if (doable(lead) && !(lead.kind === 'press' && lead.op === 'live')) {
    const tweak = recorded || missed ? [] : [itemPrompt(m.week, { ...base, line }, d.path?.current || 'next', null, isDone('story') ? story(true) : null, m.decisions?.[d.piece_id] ?? null) as unknown as PressAction]
    return { ...base, line, next: lead, decision: false, others: [...tweak, ...picks] }
  }
  const signedStory = isDone('story') && !recorded ? story(true) : null
  return { ...base, line, next: itemPrompt(m.week, { ...base, line }, d.path?.current || 'next', null, signedStory, m.decisions?.[d.piece_id] ?? null), decision: false, others: picks }
}

/** A piece his approval holds on a day that is not the day's own piece (moved there, or kept alongside). */
/** What a placed piece waits on next, by the step his decisions leave (_decisions.ts). */
const PLACED_NEXT: Record<'story' | 'look' | 'board' | 'record', string> = {
  story: 'Next: sign the narrative lock',
  look: 'Next: the production picks not made yet (look, motion style, captions)',
  board: 'Your production picks are in. Next: the storyboard and both scripts, for your Approve',
  record: 'Scripts approved. Next: record both cuts from your Teleprompter',
}

function placedPieceItem(m: ModelInputs, d: DayView, p: DayView['pieces'][number]): ModelItem {
  const row = m.pieces.find(x => String(x.id).toLowerCase() === p.id) ?? null
  const out = p.published || p.stage?.state === 'live'
  // Its signed narrative lock comes with it (a lock follows its piece, not its day), so a piece moved to another day
  // keeps Branded; and a day that passed with it not out says it was missed, like every other item.
  const branded = (m.signedLocks || []).includes(p.id)
  // His decisions on it (F46): the look he picked moves it on to Fleshed out, and its step is the first one he has not
  // made, never a step he has already pressed (Tue 17 Nov: "step look" after his three picks at 11:09).
  const decided = m.decisions?.[p.id] ?? null
  const lookPicked = Boolean(m.placedStyles?.[p.id]?.treatment.picked)
  const scriptsOk = decided?.items.find(x => x.key === 'scripts')?.made === true
  // An approval whose send never reached his Teleprompter leaves the card at Production planned, his words to Approve (F50).
  const unsent = !out && scriptsOk && Boolean(heldSend(m, p.id))
  const done = out ? PIECE_PATH.length : branded ? (lookPicked ? (scriptsOk && !unsent ? 3 : 2) : 1) : 0
  // What it says now: the signed lock, never the idea row it started from (F47).
  const said = m.lockReads?.[p.id]
  const missed = !out && d.date < m.today
  const base = { key: `piece:${p.id}`, type: 'piece' as const, day: d.day, date: d.date, kind: PIECE_KIND.key, kind_label: p.series ? p.series.replace(/_/g, '.') : d.series,
    title: workingTitle(m, p.id, p.title, out), approved: p.approval?.label ?? null, stage: stageOf(PIECE_PATH, done), path: steps(PIECE_PATH, done), missed,
    read: withWork(withLock(readOf(null, { row }), said), m, [p.id]), piece_id: p.id, item: null, supports: null, move: p.move ?? null, links: p.stage?.links ?? [], stories: null,
    stories_planned: null, others: [] as PressAction[] }
  const step = decided?.next_step ?? (branded ? 'look' : 'next')
  const line = out ? 'Live.' : missed ? `Missed: ${d.label} passed and it is not marked live. If it went out, press It's live with its link.`
    : `${branded ? 'Branded: its narrative lock is signed' : 'Approved'} for ${d.label}. ${branded && decided?.next_step ? `${PLACED_NEXT[decided.next_step]}.` : 'Its make picks up from where it is.'}`
  const picks = out || missed ? [] : lookPresses(p.id, m.placedStyles?.[p.id])
  const toSign = !out && !missed && !branded ? m.locksToSign?.[p.id] : undefined
  if (toSign) {
    const signLine = `Approved for ${d.label}. Read the narrative lock and sign it, or say what to change.`
    return { ...base, read: { ...base.read, sources: [lockSource(toSign.path), ...base.read.sources] }, line: signLine,
      next: signPress(m.week, p.id, toSign) as Action, decision: true,
      others: [itemPrompt(m.week, { ...base, line: signLine }, 'story', null, { approved: false, path: toSign.path }, decided) as unknown as PressAction, ...picks] }
  }
  // Signed and its look not picked: his production pick leads, as on a series day (Tue 17's piece is still a piece).
  const lookPress = picks.find(a => a.op === 'look')
  if (branded && !lookPicked && lookPress) {
    const brandedLine = `Branded for ${d.label}. Pick the look: the recommended one, another, or fold in your inspiration.`
    return { ...base, line: brandedLine, next: lookPress as Action, decision: true,
      others: [itemPrompt(m.week, { ...base, line: brandedLine }, 'look', null, { approved: true }, decided) as unknown as PressAction, ...picks.filter(a => a !== lookPress)] }
  }
  // His production picks in and the scripts filed for his Approve: his Approve scripts leads, in his words, bound to the
  // exact words filed (F47). Only his press approves; a session filing them only puts the press in front of him.
  const ready = branded && lookPicked && !scriptsOk && step === 'board' && !missed ? scriptsReady(m, d.day, p.id, p.title, `Branded for ${d.label}. Your production picks are in`) : null
  if (ready) {
    const { press, line: readyLine } = ready
    return { ...base, line: readyLine, next: press as Action, decision: true,
      others: [itemPrompt(m.week, { ...base, line: readyLine }, 'board', null, { approved: true }, decided) as unknown as PressAction, ...picks] }
  }
  const held = !out && !missed && scriptsOk ? heldSend(m, p.id) : null
  if (held) {
    // His scripts lead, to read, edit and send (F50); the session prompt stays beside them.
    const edit = approveAgainPress(m, d.day, p.id, p.title)
    const prompt = itemPrompt(m.week, { ...base, line: held.line }, 'teleprompter', null, { approved: true }, decided)
    return { ...base, line: held.line, next: (edit ?? prompt) as Action, decision: Boolean(edit), others: [...(edit ? [prompt as unknown as PressAction] : []), ...picks] }
  }
  const stage = !out && !missed && scriptsOk ? productionStage(m, { pieceId: p.id, title: p.title, item: null, style: m.placedStyles?.[p.id], offday: false,
    read: base.read, decided, reportAs: null, base }) : null
  if (stage) return { ...base, line: stage.line, next: stage.next, decision: stage.decision, others: [...stage.others, ...picks] }
  return { ...base, line, next: out ? null : itemPrompt(m.week, { ...base, line }, step, null, branded && !out && !missed ? { approved: true } : null, decided), decision: false, others: picks }
}

/** The one rule every card that carries a piece obeys (Ruling, Krish, 2026-11-17: board feedback is done to every day,
 *  present and future): scripts filed on the piece and not yet approved by him make his Approve scripts the card's next
 *  action, bound to the exact words filed (F47). A series day's own piece (pieceItem) and a piece moved to another day
 *  (placedPieceItem) both call it; tests/control-plane/board-every-card.test.ts holds every card kind to it. */
export function scriptsReady(m: Pick<ModelInputs, 'week' | 'scripts' | 'decisions' | 'picks'>, day: string, pieceId: string, title: string, where: string): { press: PressAction; line: string } | null {
  const filed = m.scripts?.[pieceId] ?? []
  if (!filed.length || m.decisions?.[pieceId]?.items.find(x => x.key === 'scripts')?.made === true) return null
  const press = scriptsPress(m.week, day, pieceId, cut(title, 150), filed, m.picks || [])
  // An approval of earlier words says so, so he knows why the press is back (pieceDecisions, scriptsChanged).
  const note = m.decisions?.[pieceId]?.items.find(x => x.key === 'scripts')?.note
  const line = `${where.replace(/[.\s]+$/, '')}. ${note ? 'Rewritten since you approved them, so they need your Approve again' : `${filed.length > 1 ? 'Both scripts are' : 'The script is'} ready for your Approve`}: ${filed.map(f => f.title).join('; ')}.`
  return { press, line }
}

/** What is on file and who reported last, for any card on any day (Ruling, Krish, 2026-11-17: "any feedback on the
 *  board UI or UX must be done to every single day present and future"). Every card builder calls it with its own
 *  scopes: a piece's id, and for a card that owns its day's reports (the day's own piece, an off-day post) the day's
 *  scope too. Tue 17's habits voiceover had nine reports and a dozen materials on day:2026-11-16/tue and its card
 *  showed none of them. The materials' titles go in `research`; the newest session's line goes in `said` when
 *  nothing else is said there. */
export function withWork(read: ModelRead, m: Pick<ModelInputs, 'work'>, scopes: string[]): ModelRead {
  const work = scopes.map(s => m.work?.[s]).filter((x): x is NonNullable<typeof x> => Boolean(x))
  if (!work.length) return read
  const materials = work.flatMap(w => w.materials).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
  const research = [...new Set([...read.research, ...materials.map(x => x.title)])].slice(0, 40)
  const last = work.flatMap(w => w.sessions).filter(x => x.doing).sort((a, b) => b.last_at.localeCompare(a.last_at))[0]
  const said = read.said ?? (last ? cut(`${last.by}, ${last.last_at.slice(0, 16).replace('T', ' ')} UTC (${last.state}${last.step ? `, ${last.step}` : ''}): ${last.doing}`, 1200) : null)
  return { ...read, research, said }
}
/** The day's own scope for the work on file. */
const dayScope = (week: string, day: string) => `day:${week}/${day}`

/** The read sheet with the signed lock's words in place of the idea row's (F47). */
function withLock(read: ModelRead, said: { so_what: string | null; story: string | null } | undefined): ModelRead {
  if (!said) return read
  return { ...read, so_what: said.so_what ?? read.so_what, story: said.story ? cut(said.story, 4000) : read.story }
}

/** His Approve scripts on a piece, in his words (picks/<day>-scripts-words, the shape the engine checks: _contracts.ts
 *  wordsBody, scriptsBody), carrying the exact words of each filed cut so his approval binds those words (F47). */
export function scriptsPress(week: string, day: string, pieceId: string, title: string, filed: FiledScript[], picks: Array<{ doc_id: string; revision?: number }> = []): PressAction {
  const doc = wordsDocId(day, 'scripts', pieceId)
  const ordered = [...filed].sort((a, b) => (a.cut === b.cut ? 0 : a.cut === 'long' ? -1 : 1))
  const texts = Object.fromEntries(ordered.map(f => [f.cut, f.text]))
  // The Teleprompter folder keeps the piece's own title, so a send never makes a second folder (review of F49).
  const named = title
  const titles = Object.fromEntries(ordered.map(f => [f.cut, cut(`${named}: ${f.cut === 'long' ? 'long cut' : 'short cut'}`, 200)]))
  const words = (t: string) => t.split(/\s+/).filter(Boolean).length
  const both = ordered.length > 1
  return { kind: 'press', label: both ? 'Read and approve the scripts' : 'Read and approve the script', collection: 'picks', id: doc, revision: picks.find(x => x.doc_id === doc)?.revision ?? 0,
    body: { kind: 'approve_scripts', day, via: 'words', approved: true, piece_id: pieceId, texts, titles, folder_title: cut(named, 200),
      said_where: 'the Publish Board in Control Centre', session_ref: boardAt(week, day) },
    // A board before contract 1.21.0 still asks his words this way; a board that knows `scripts` shows the review instead.
    words: { path: 'words', ask: `Your words to approve ${both ? 'both scripts' : 'the script'} as filed ("Approved.")`, required: true }, stamp: ['at', 'said_at'],
    scripts: {
      path: 'texts', approve: both ? 'Approve both scripts' : 'Approve the script', approve_edited: both ? 'Approve both scripts, with my edits' : 'Approve the script, with my edits',
      edited_note: 'Your edits are saved with your approval and become the scripts. Approve sends them to your Teleprompter straight away; the scripts\' check and fresh readers run after and report to you, and never change or hold your words.',
      cuts: ordered.map(f => ({ cut: f.cut, label: f.cut === 'long' ? 'Long cut' : 'Short cut', text: f.text, words: words(f.text),
        minutes: Math.round((words(f.text) / 150) * 10) / 10, filed_at: f.at, material_id: f.id })),
    },
    goes: `Approves ${both ? 'both scripts' : 'the script'} exactly as shown, with any edits you made, and sends ${both ? 'them' : 'it'} to your Teleprompter now.`,
    done: 'Approved and sent to your Teleprompter. The card moves on to recording.' } as PressAction
}

/** The scripts on every card that holds them, every day (Ruling, Krish, 2026-11-17: "I want the board in a state where I
 *  can see the script and edit it, and then press approve"): filed and not approved, his Approve scripts review, which
 *  on an off-day post he records is the card's next action; approved, Edit the scripts (the same review, ending in his
 *  Approve of the words he leaves) and Take back my approval beside the card's own action. A card that already offers the
 *  review is left as it is. */
export function scriptsOnCard(m: ModelInputs, d: DayView, it: ModelItem): ModelItem {
  if (it.missed || it.stage.key === 'live') return it
  // Every off-day kind once it has its record (#804; Krish, 2026-11-17: "there is copy on every single post").
  const pid = it.piece_id ?? (it.type === 'post' ? postRecord(m, d, it.key) : null)
  if (!pid) return it
  const filed = m.scripts?.[pid] ?? []
  if (!filed.length) return it
  const all = [it.next, ...(it.others || [])].filter(Boolean) as Body[]
  if (all.some(a => a.kind === 'press' && isObj(a.scripts))) return it
  const title = it.title
  const approval = scriptsApproval(m.picks || [], pid)
  if (!approval) {
    if (it.type !== 'post') return it
    const press = scriptsPress(m.week, d.day, pid, title, filed, m.picks || [])
    const line = `${it.line.replace(/[.\s]+$/, '')}. ${filed.length > 1 ? 'Both scripts are' : 'The script is'} on the card: read it, edit it if you like, and approve it.`
    return { ...it, line, next: press as Action, decision: true, others: [...(it.next ? [it.next as unknown as PressAction] : []), ...(it.others || [])] }
  }
  const edit = { ...scriptsPress(m.week, d.day, pid, title, filed, m.picks || []), label: filed.length > 1 ? 'Edit the scripts' : 'Edit the script',
    goes: 'Opens the approved words to read and edit. Your Approve at the end approves the words you leave and sends them to your Teleprompter straight away; the checks run after and report to you (F49).' } as PressAction
  const back = takeBackPress(m, d.day, pid)
  return { ...it, others: [...(it.others || []), edit, back] }
}
/** His Take back my approval on a piece's scripts: they wait on his Approve again; Teleprompter keeps what it has. */
export function takeBackPress(m: Pick<ModelInputs, 'picks'>, day: string, pieceId: string): PressAction {
  const doc = backDocId(day, 'scripts', pieceId)
  return { kind: 'press', label: 'Take back my approval', collection: 'picks', id: doc, revision: (m.picks || []).find(x => x.doc_id === doc)?.revision ?? 0,
    body: { kind: 'take_back', what: 'scripts', day, piece_id: pieceId, approved: false }, stamp: ['at'],
    goes: 'Your approval of these scripts stops counting, and the card asks for your Approve again. Nothing in your Teleprompter is deleted.',
    done: 'Taken back. The scripts wait on your Approve again.' } as PressAction
}
/** The engine record of an off-day post on the card, once it exists: the piece id its option names or the one derived
 *  from the week and the option (_offdayPiece.ts). */
function postRecord(m: ModelInputs, d: DayView, key: string): string | null {
  const optionId = key.replace(/^off-[a-z]{3}-/, '')
  const raw = rawOption(m, d.day, optionId)
  return recordedPiece(m, raw) ?? linkedPiece(m, offdayPieceId(m.week, key, raw))
}

/** An approved off-day post on the board: its kind, its path, where it is and its one next action. */
/** An off-day post, with his sound picks beside its other presses until it is scheduled: the voice and the music under
 *  it on a voiceover short, the track over a carousel (contract 1.20.0, _audio.ts; Krish, 2026-11-17: "I always want
 *  to be given a few options in my control center"). */
function postItem(m: ModelInputs, d: DayView, o: ViewOption): ModelItem {
  const it = postItemBase(m, d, o)
  const settled = it.missed || o.stage?.state === 'live' || o.stage?.state === 'scheduled'
  // An off-day post cut on the ve route gets a piece's look, motion and caption picks, saved on its own record
  // (_offdayPiece.ts; Krish, 2026-11-17: "at no point does a voiceover short give me the same controls as a mon/wed/fri
  // piece in terms of the motion, captions etc etc. why not?"). `item` lets the press make that record when it has none.
  const raw = rawOption(m, d.day, o.id)
  const video = !settled && videoOffday(it.kind, str(raw?.format) ?? o.format)
  const pid = video ? offdayPieceId(m.week, o.doc_id, raw) : null
  const row = pid ? m.pieces.find(x => String(x.id).toLowerCase() === pid) : undefined
  const style = pid && m.offdayStyle ? m.offdayStyle(pid, row?.meta) : null
  const shown = new Set([it.next, ...(it.others || [])].map(a => (isObj(a) ? String((a as Body).label) : '')))
  const looks = pid && style ? lookPresses(pid, style).filter(a => !shown.has(a.label)).map(a => ({ ...a, body: { ...(a.body as Body), item: o.doc_id } }) as PressAction) : []
  const sound = [...looks, ...(settled ? [] : audioPresses({ key: o.doc_id, kind: it.kind }, m.picks || []))]
  // The session making it reads his picks in its prompt: an ElevenLabs voice, or his own take through Teleprompter.
  const said = soundLine({ key: o.doc_id, kind: it.kind }, m.picks || [])
  const told = <T,>(a: T): T => (said && isObj(a) && (a as Body).kind === 'prompt' && typeof (a as Body).prompt === 'string'
    ? { ...a, prompt: `${(a as Body).prompt}${said}` } : a)
  const out = said ? { ...it, next: told(it.next), others: (it.others || []).map(told) } : it
  return sound.length ? { ...out, others: [...(out.others || []), ...sound] } : out
}
function postItemBase(m: ModelInputs, d: DayView, o: ViewOption): ModelItem {
  const raw = rawOption(m, d.day, o.id)
  const { kind, supports } = offdayKind({ ...(raw || {}), format: raw?.format ?? o.format })
  const kind_label = kindLabel(kind, supports)
  const state = o.stage?.state ?? 'approved'
  const made = (o.posts || []).some(p => p.state === 'made') || (d.posts || []).some(p => p.option === o.id && p.assets.length > 0)
  const scheduled = (o.posts || []).some(p => p.state === 'scheduled')
  const doneOf: Record<string, number> = { approved: 1, made: 2, scheduled: 3, live: 4 }
  const done = state === 'missed' ? (scheduled ? 3 : made ? 2 : 1) : doneOf[state] ?? 1
  const path = steps(POST_PATH, done, [o.outcome?.at?.slice(0, 10) ?? null, null, o.stage?.state === 'scheduled' ? o.stage.at?.slice(0, 10) ?? null : null, o.stage?.state === 'live' ? o.stage.at?.slice(0, 10) ?? null : null])
  const missed = state === 'missed'
  const stories = kind === 'good_news' ? storiesOf(raw, o) : null
  // An off-day piece he records has its own record in the engine (placeOffday): its reports and materials, and its
  // prompt's write-back, go to that piece; the day's scope is read beside it, where sessions reported before it had one.
  const own = recordedPiece(m, raw) ?? linkedPiece(m, offdayPieceId(m.week, o.doc_id, raw))
  const read = withWork(readOf(raw, { text: o.text, said: o.said, source: o.source }), m, [...(own ? [own] : []), dayScope(m.week, d.day)])
  const base = { key: o.doc_id, type: 'post' as const, day: d.day, date: d.date, kind, kind_label, title: cut(o.title, 200), approved: o.outcome?.label ?? null,
    stage: stageOf(POST_PATH, done), path, missed, read, piece_id: null,
    item: o.item?.key ?? null, supports, move: o.move ?? null, links: o.stage?.links ?? [], stories, stories_planned: kind === 'good_news' ? GOOD_NEWS_STORIES : null, others: [] as PressAction[] }
  if (state === 'live') return { ...base, line: o.stage!.label, next: null, decision: false }
  const where = o.stage?.label ?? 'Approved by you'
  // How many of its five stories good news holds is said by its stories (`stories`, `stories_planned`), never twice.
  const line = (missed ? `Missed: ${d.label} passed and it is not marked live. If it went out, press It's live with its link.` : `${where}.`).replace(/\.\./g, '.')
  // A choice the approved post is still missing: its direction (the look), offered as his presses after his Approve.
  const choice = (o.actions || []).filter(a => /direction/i.test(a.label))
  if (choice.length && !missed) {
    const yes = choice.find(a => /^Approve/.test(a.label)) ?? choice[0]
    return { ...base, line: `${where}. Its direction waits on your answer.`, next: yes, decision: true, others: choice.filter(a => a !== yes) }
  }
  const live = d.actions.find(a => isLive(a, { option: o.doc_id }))
  if (live && (missed || state === 'scheduled')) return { ...base, line, next: { ...live, label: "It's live" } as Action, decision: false }
  // Good news short of its five stories: the run finds the rest on its topic.
  if (stories && stories.length < GOOD_NEWS_STORIES && !made && !missed) {
    return { ...base, line, decision: false,
      next: { kind: 'run', label: `Find the other ${GOOD_NEWS_STORIES - stories.length} stories`, job: 'saturday-goodnews', input: { week: m.week, fill: o.doc_id }, runs_on: 'GitHub · saturday-goodnews.yml' } }
  }
  if (state === 'scheduled') return { ...base, line, next: null, decision: false }
  // A post he records himself, its script approved: the next session assumes the take is in the Video Engine Inbox and
  // cuts it (Krish, 2026-11-17: "when it gets to this stage and the files are in teleprompter, the next action presumes I
  // have recorded the video and put it in the inbox").
  const scripts = !made && !missed && recordsItself(kind, m.picks || [], o.doc_id) ? offdayScripts(m.picks || [], raw) : null
  if (scripts) {
    const held = scripts.send && scripts.send !== 'sent' ? heldSend(m, scripts.piece_id) : null
    const decided = own ? m.decisions?.[own] ?? null : null
    if (held) {
      const heldLine = `${where}. ${held.line}`.replace(/\.\./g, '.')
      const edit = approveAgainPress(m, d.day, scripts.piece_id, base.title)
      const prompt = itemPrompt(m.week, { ...base, line: heldLine }, 'record', 'motion', null, decided, own, recordHead(scripts))
      return { ...base, line: heldLine, next: (edit ?? prompt) as Action, decision: Boolean(edit), others: edit ? [prompt as unknown as PressAction] : [] }
    }
    // Approved and in his Teleprompter: his takes in the Inbox, then the one post-production prompt (_takesIn.ts).
    const row = m.pieces.find(x => String(x.id).toLowerCase() === scripts.piece_id)
    const stage = productionStage(m, { pieceId: scripts.piece_id, title: base.title, item: o.doc_id, style: m.offdayStyle?.(scripts.piece_id, row?.meta) ?? null, offday: true,
      read, decided, reportAs: own, base, recordHead: recordHead(scripts) })
    if (stage) {
      const line = `${where}. ${stage.line}`.replace(/\.\./g, '.')
      return { ...base, line, next: stage.next, decision: stage.decision, others: stage.others }
    }
  }
  // Scripts filed on its own record and not approved yet: his edit and Approve scripts lead, the same press a piece's card
  // offers (scriptsReady), on every off-day kind and every day (Krish, 2026-11-17: "I want the board in a state where I can
  // see the script and edit it, and then press approve"; "just add the scripts section to the off-day card").
  const ready = own && !made && !missed && !scriptsApproval(m.picks || [], own) ? scriptsReady(m, d.day, own, base.title, where) : null
  if (ready) {
    return { ...base, line: ready.line, next: ready.press as Action, decision: true,
      others: [itemPrompt(m.week, { ...base, line: ready.line }, 'post', makeRoute(kind, str(raw?.format) ?? o.format), null, m.decisions?.[own!] ?? null, own) as unknown as PressAction] }
  }
  return { ...base, line, next: itemPrompt(m.week, { ...base, line }, 'post', makeRoute(kind, str(raw?.format) ?? o.format), null, own ? m.decisions?.[own] ?? null : null, own), decision: false }
}

/** Whether an off-day post has a recorded step: a voiceover short whose voice is his own take (Record it myself, his
 *  pick or the default until a voice holds on a whole script; _audio.ts). An ElevenLabs voice has no take to wait for. */
export function recordsItself(kind: string, picks: Array<{ doc_id: string; body: Body; updated_by?: string }>, item: string): boolean {
  return kind === 'voiceover' && voiceOf(picks, item) === RECORD_MYSELF
}

/** His approval of an off-day post's script, read by the piece id its option carries, whether or not the engine has a row
 *  for it (Tue 17's habits voiceover, 701a2c55, has none): his Approve scripts press (picks/<day>-scripts, his login) or
 *  his typed approval (picks/<day>-scripts-words[-<8 hex>], wordsBody, read past the server's own send answer). Any day:
 *  a post moved after he approved keeps the approval saved under the day it was on. */
export interface OffdayScripts { piece_id: string; at: string | null; on: string | null; words: string | null; texts: Record<string, string>; titles: Record<string, string>; folder: string | null; send: string | null; send_error: string | null
  /** When the server's send answered, and the checks still to run after his own press sent (F49). */
  send_at?: string | null; checks?: string | null }
const SCRIPTS_DOC = /^(mon|tue|wed|thu|fri|sat|sun)-scripts(-words(-[0-9a-f]{8})?)?$/
export function offdayScripts(picks: Array<{ doc_id: string; body: Body; updated_by?: string; updated_at?: string }>, raw: Body | null): OffdayScripts | null {
  const id = typeof raw?.piece_id === 'string' && UUID_RE.test(raw.piece_id) ? raw.piece_id.toLowerCase() : null
  return id ? scriptsApproval(picks, id) : null
}
/** His approval of a piece's scripts, by its id, on any day: his Approve scripts press or his typed approval, newest first,
 *  with the server's own Teleprompter answer beside it (send, send_error), never counted against it. */
export function scriptsApproval(picks: Array<{ doc_id: string; body: Body; updated_by?: string; updated_at?: string }>, pieceId: string): OffdayScripts | null {
  const id = pieceId.toLowerCase()
  const doc = [...picks].sort((a, b) => String(b.updated_at || b.body?.at || '').localeCompare(String(a.updated_at || a.body?.at || ''))).filter(p => SCRIPTS_DOC.test(p.doc_id) && isObj(p.body) && String(p.body.piece_id || '').toLowerCase() === id && p.body.approved === true)
    .find(p => /-words/.test(p.doc_id) ? wordsBody(p.doc_id, asWritten(p.body)) : p.updated_by === 'Krish')
  if (!doc) return null
  const b = doc.body
  // Taken back since (17 Nov): it no longer counts, and the scripts wait on his Approve again.
  const madeAt = Date.parse(String(b.said_at || b.at || doc.updated_at || ''))
  if (Number.isFinite(madeAt) && madeAt <= takenBackAt(picks, 'scripts', id)) return null
  const strings = (v: unknown): Record<string, string> => (isObj(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string')) : {})
  const at = str(b.said_at) ?? str(b.at) ?? str(doc.updated_at)
  const on = at && Number.isFinite(Date.parse(at)) ? new Date(at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '') : null
  return { piece_id: id, at: at && Number.isFinite(Date.parse(at)) ? new Date(at).toISOString() : null, on, words: str(b.words), texts: strings(b.texts), titles: strings(b.titles), folder: str(b.folder_title),
    send: isObj(b.send) ? str(b.send.status) : null, send_error: isObj(b.send) ? str(b.send.error) : null,
    send_at: isObj(b.send) ? str(b.send.at) : null, checks: isObj(b.send) ? str(b.send.checks) : null }
}

/** After his approved scripts are in his Teleprompter, on every card holding the piece (Krish, 2026-11-17: "whenever I
 *  press approve script, the new board state should be waiting for me to confirm the videos are in the Inbox"): his
 *  press My takes are in the Inbox until he makes it; then the takes by name, a production pick still missing as his
 *  press, and then the one post-production prompt (_takesIn.ts). Null once a cut is made. */
export function productionStage(m: ModelInputs, p: { pieceId: string; title: string; item: string | null; style: DayStyle | null | undefined; offday: boolean;
  read: ModelRead; decided: PieceDecisions | null; reportAs: string | null; base: { day: PostedDay; date: string; title: string; kind_label: string; piece_id: string | null; key: string };
  /** How the take is made, for the record step's prompt (an off-day post's recordHead). */
  recordHead?: string | null }):
  { line: string; next: Action; decision: boolean; others: PressAction[] } | null {
  const row = m.pieces.find(x => String(x.id).toLowerCase() === p.pieceId.toLowerCase())
  const meta = isObj(row?.meta) ? row!.meta as Body : {}
  const making = isObj(meta.making) ? meta.making as Body : {}
  if (Array.isArray(making.video_assets) && making.video_assets.length) return null
  // Takes the home pass or the take-placing job already put on the making record count as his takes too.
  const placed = (Array.isArray(making.recordings) ? making.recordings : []).filter(isObj)
  const takes: TakesIn | null = takesInOf(meta) ?? (placed.length ? { confirmed_at: String(placed[0].at || ''), by: 'the take-placing job', since: null,
    files: placed.map(r => ({ name: String(r.path), drive_id: String(r.path), bytes: null, sha256: /([0-9a-f]{64})/.exec(String(r.path))?.[1] ?? null, md5: null, modified: String(r.at || '') })) } : null)
  const promptOf = (line: string, head: string | null) => itemPrompt(m.week, { ...p.base, line }, 'produce', p.offday ? 'motion' : null, null, p.decided, p.reportAs, head) as unknown as PressAction
  if (!takes || !takes.files.length) {
    const sent = sentNote(scriptsApproval(m.picks || [], p.pieceId))
    const line = (p.offday ? 'Your script is approved. Record it from your Teleprompter, drop the take in the Video Engine Inbox, then press My takes are in the Inbox.'
      : 'Your scripts are approved. Record both cuts from your Teleprompter, drop the takes in the Video Engine Inbox, then press My takes are in the Inbox.')
      .replace(/^Your scripts? (is|are) approved\. /, sent ? `${sent} ` : '$&')
    // His own press sent words no check has seen yet (F49): the next session runs those checks first and reports them to
    // him, so the card's promise is kept (review of F49).
    const approved = scriptsApproval(m.picks || [], p.pieceId)
    const checksHead = approved?.send === 'sent' && approved.checks ? checksFirst(approved) : null
    const record = itemPrompt(m.week, { ...p.base, line }, 'record', p.offday ? 'motion' : null, null, p.decided, p.reportAs,
      [checksHead, p.recordHead ?? null].filter(Boolean).join('\n\n') || null) as unknown as PressAction
    return { line, next: takesPress(p.pieceId, p.item) as unknown as Action, decision: true, others: [record] }
  }
  // Every production pick decided before the one-shot cut: a missing one is his press first, unless a take is already
  // recorded on the making record (a recorded take is never sent back to the look); then the prompt names it.
  const layers = (['treatment', 'motion', 'captions'] as const).filter(l => p.style && !p.style[l].picked)
  const missing = lookPresses(p.pieceId, p.style).filter(a => /^Pick /.test(a.label)).map(a => (p.item ? { ...a, body: { ...(a.body as Body), item: p.item } } as PressAction : a))
  if (layers.length && missing.length && !placed.length) {
    const line = `${takesLine(takes)} First, ${missing[0].label.toLowerCase()}, so the cut is fully decided.`
    return { line, next: missing[0] as unknown as Action, decision: true, others: missing.slice(1) }
  }
  const picked = (l: 'treatment' | 'motion' | 'captions', word: string) => {
    const L = p.style?.[l]
    const o = L?.options.find(x => x.id === L.picked)
    return L?.picked ? `${word}: ${o?.name ?? L.picked} (${L.picked}), picked by ${L.picked_by === 'spec' ? 'Krish in the spec he signed' : 'Krish'}${L.picked_at ? ` on ${L.picked_at.slice(0, 10)}` : ''}.` : null
  }
  const approval = scriptsApproval(m.picks || [], p.pieceId)
  const decisions = [picked('treatment', 'The look'), picked('motion', 'The motion style'), picked('captions', 'The captions'),
    approval ? `The scripts: approved by Krish${approval.on ? ` on ${approval.on}` : ''}${approval.words ? `, in his words "${cut(approval.words, 160)}"` : ''}; the words are below.` : 'The scripts: approved by Krish.']
    .filter((x): x is string => Boolean(x))
  const word = { treatment: 'the look', motion: 'the motion style', captions: 'the captions' }
  for (const l of layers) decisions.push(`Not picked yet: ${word[l]}. Use the option marked recommended on the board, say so in your done report, and leave his Pick press open.`)
  const line = takesLine(takes)
  const head = productionBrief({ pieceId: p.pieceId, title: p.title, takes, decisions, research: p.read.research, scripts: approval?.texts ?? {}, offday: p.offday })
  return { line, next: promptOf(line, head) as unknown as Action, decision: false, others: missing }
}

/** "Scripts approved Tue 17 Nov, sent to your Teleprompter at 16:20 UTC." once his press sent them, so the card shows
 *  what his press did (F49), with a line when the checks on his own words still run after it. Null before a send. */
export function sentNote(a: OffdayScripts | null): string | null {
  if (!a || a.send !== 'sent') return null
  const t = a.send_at && Number.isFinite(Date.parse(a.send_at)) ? new Date(a.send_at).toISOString().slice(11, 16) : null
  const n = Object.keys(a.texts).length
  return `${n > 1 ? 'Scripts' : 'Script'} approved${a.on ? ` ${a.on}` : ''}, sent to your Teleprompter${t ? ` at ${t} UTC` : ''}.`
    + (a.checks ? ' The checks on your words run next and report to you; they never hold or change them.' : '')
}

/** The first job of the session after his own press sent unchecked words (F49): run the checks on exactly those words
 *  and report what they find to him; never rewrite or resend them, never ask him to press again. */
export function checksFirst(a: OffdayScripts): string {
  return `First, before the recording step: his own Approve scripts press${a.on ? ` (${a.on})` : ''} sent his exact words to his Teleprompter `
    + 'before their checks ran (F49; Ruling, Krish, 2026-11-17: "the approve scripts button auto sends to teleprompter"). Run them now on exactly '
    + 'the words he approved (the texts of his approval on the week\'s picks, piece ' + a.piece_id + '): the scripts\' check (making.py scripts), two '
    + 'fresh readers (making.py read-back) and the tone floor against his AI Music take (making.py tone-floor). Report what they find to him on the '
    + 'board in plain words. Never rewrite or resend his words, and never ask him to press Approve again. Still to run: ' + cut(String(a.checks), 400)
}

/** The card's title: the title his approved scripts speak (spokenTitle), as a working title, else the piece's own. His
 *  edited scripts asked "Where does AI get built when towns say no?" under the idea headline "OpenAI pledges to pay for
 *  data center power after election highlights AI concerns" (F49). The final title is his pick with the finished video. */
export function workingTitle(m: Pick<ModelInputs, 'picks' | 'decisions'>, pieceId: string, fallback: string, out = false): string {
  // Only while it is a working title: not once the piece is out, not once he picked its titles, and only from an approval
  // that still counts (review of F49).
  const titled = (m.picks || []).some(p => /-titles$/.test(p.doc_id) && isObj(p.body) && String((p.body as Body).piece_id || '').toLowerCase() === pieceId.toLowerCase())
  const counts = m.decisions?.[pieceId]?.items.find(x => x.key === 'scripts')?.made === true
  const a = out || titled || !counts ? null : scriptsApproval(m.picks || [], pieceId)
  return cut((a && spokenTitle(a.texts)) || fallback, 200)
}

/** His approved words back in front of him when their send never reached his Teleprompter (F50; Krish, 2026-11-17: "I
 *  want the [...] piece to be at the stage where it has my hand edited scripts in there, and the board is at the stage
 *  where i can edit the scripts and then press appove"): the Approve scripts review, filled with the words he approved,
 *  newest first. His Approve sends them at once (F49), into the folder already there (sendInput). */
export function approveAgainPress(m: Pick<ModelInputs, 'week' | 'picks'>, day: string, pieceId: string, title: string): PressAction | null {
  const a = scriptsApproval(m.picks || [], pieceId)
  if (!a) return null
  const filed: FiledScript[] = Object.entries(a.texts).filter(([c]) => c === 'long' || c === 'short')
    .map(([c, text]) => ({ cut: c as 'long' | 'short', id: '', title: c, text, at: a.at }))
  return filed.length ? scriptsPress(m.week, day, pieceId, a.folder ?? cut(title, 150), filed, m.picks || []) : null
}

/** His approved scripts that the server's send did not put in his Teleprompter (held, refused, failed or no key), with the
 *  making record not showing them in it since: his approval counts, the card says why they are not there yet, and the
 *  next action is the session that checks them and sends (Krish, 2026-11-17: "the button does not seem to work. Would it
 *  not just send to teleprompter directly and change the board state immediately?"). Null when nothing waits. */
export function heldSend(m: Pick<ModelInputs, 'picks' | 'pieces'>, pieceId: string): { line: string; approval: OffdayScripts } | null {
  const a = scriptsApproval(m.picks || [], pieceId)
  if (!a || !a.send || a.send === 'sent') return null
  const row = m.pieces.find(x => String(x.id).toLowerCase() === pieceId.toLowerCase())
  const making = isObj(row?.meta) && isObj((row!.meta as Body).making) ? (row!.meta as Body).making as Body : null
  const tp = making && isObj(making.teleprompter) && isObj(making.teleprompter.cuts) ? making.teleprompter.cuts as Body : null
  const cuts = Object.keys(a.texts)
  if (tp && cuts.length && cuts.every(c => isObj(tp[c]) && typeof (tp[c] as Body).script_id === 'string' && !(tp[c] as Body).error)) return null
  // In his words, never the engine's (Krish, 2026-11-17: "I cannot see or edit the scripts"; F50): why they are not in
  // his Teleprompter, and that the scripts are below to read, edit and send.
  const n = cuts.length > 1
  const why = a.send === 'held' ? 'the send before today\'s fix waited on checks that your own words no longer wait on'
    : a.send === 'no_key' ? 'the engine has no Teleprompter key yet' : 'the send did not go through'
  const line = `Your approved ${n ? 'scripts are' : 'script is'} saved${a.on ? ` (${a.on})` : ''} but never reached your Teleprompter: ${why}. `
    + `Read or edit ${n ? 'them' : 'it'}, then press Approve to send exactly ${n ? 'those words' : 'those words'} to your Teleprompter.`
  return { line, approval: a }
}

/** How a post he records is made once its script is approved: get his take from the Inbox and cut it on the ve route. */
export function recordHead(sc: OffdayScripts): string {
  const cuts = Object.keys(sc.texts)
  const named = cuts.map(c => `${c}${sc.titles[c] ? ` ("${sc.titles[c]}")` : ''}`).join(', ')
  return `Krish records this one himself, and he has approved its script${sc.on ? ` (${sc.on}` : ''}${sc.words ? `${sc.on ? ', ' : ' ('}in his words: "${cut(sc.words, 200)}")` : sc.on ? ')' : ''}. `
    + `Its piece id is ${sc.piece_id}${named ? `; the approved words are the ${named} script on the week's picks` : ''}${sc.folder ? `, in his Teleprompter folder "${sc.folder}"` : ''}. `
    + 'Assume he has recorded it from his Teleprompter and dropped the take in the Video Engine Inbox. The repository is krishanraja/content-engine: read AGENTS.md and CLAUDE.md once for the house rules.\n\n'
    + '1. Get the take: python scripts/post-pack/recording.py list, then python scripts/post-pack/recording.py get NAME (AGENTS.md rule 9). '
    + 'If no take for this post is in the Inbox, check his Teleprompter holds exactly the approved words'
    + `${sc.send && sc.send !== 'sent' ? ` (the board's own send was ${sc.send})` : ''}; if it does not, send them (scripts/post-pack/teleprompter_send.py). `
    + 'Then tell Krish in one line that it waits on his recording, and stop.\n'
    + '2. Check the take says the approved words, and measure picture against sound before anything is built on it (scripts/av_sync.py).\n'
    + `3. Cut it in this Claude session on the ve route, with the Codex plugin building its pictures. ${ROUTE_RULING} `
    + 'Read docs/ve/ENGINE.md, then follow docs/ve/RUNBOOK.md: one signed spec (creative-direction.json, schema_version 2) '
    + 'from his take and the approved words; Codex builds the devices and plates from cards (ve card, ve dispatch, ve verify-card); '
    + 've renders the cut; a separate reviewer watches and listens to it at full size against the approved words before it is called ready.\n'
    + `4. File it in the post's 3 Posts folder. Krish approves; Growth posts it through its approved route. ${NEVER_HEADLESS}\n\n`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** An off-day post's own record once it exists (_offdayPiece.ts linkOffdayPiece): its reports and its prompt's write-back
 *  go to it, as for a piece he records. */
function linkedPiece(m: Pick<ModelInputs, 'pieces'>, id: string): string | null {
  return m.pieces.some(x => String(x.id).toLowerCase() === id) ? id : null
}
/** The engine record an off-day option names (its piece_id, a piece he records), only when that record exists: an id
 *  with no row (Tue 17's habits voiceover, 701a2c55, never made) is never handed to a session as a piece. */
export function recordedPiece(m: Pick<ModelInputs, 'pieces'>, raw: Body | null): string | null {
  const id = typeof raw?.piece_id === 'string' && UUID_RE.test(raw.piece_id) ? raw.piece_id.toLowerCase() : null
  return id && m.pieces.some(x => String(x.id).toLowerCase() === id) ? id : null
}

/** Why an idea is on the ideas board, in one line. */
function ideaLine(o: ViewOption): { why: ModelIdea['why']; line: string } | null {
  if (o.status === 'held') return { why: 'held', line: o.held ?? 'Held: not approved by you.' }
  if (o.status === 'revised') return { why: 'revised', line: 'Revised from your words: waiting on your answer.' }
  if (o.status === 'open' && !o.outcome) return { why: 'open', line: 'Waiting on your answer.' }
  return null
}

/** A day's one line. Done only when every item on it is live: on Fri 13 Nov the piece was out and the day said "Done:
 *  everything on it is live" while two approved posts on it were not. */
export function dayLine(d: Pick<ModelDay, 'label' | 'items' | 'decisions' | 'ideas'>): string {
  if (!d.items.length) return d.ideas ? `Nothing approved for ${d.label} yet. Its ideas are on the ideas board.` : `Nothing approved for ${d.label}.`
  if (d.decisions) return `${d.decisions === 1 ? 'One decision' : `${d.decisions} decisions`} for you.`
  if (d.items.some(i => i.missed)) return `Missed: ${d.label} passed and not everything on it is marked live.`
  const live = d.items.filter(i => i.stage.key === 'live').length
  if (live === d.items.length) return 'Done: everything on it is live.'
  const rest = d.items.length - live
  const going = `${rest === 1 ? 'One item' : `${rest} items`} in progress.`
  return live ? `${live} of ${d.items.length} live. ${going}` : going
}

const DAY_MS = 86_400_000
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS)
const STAGE_WORD: Record<RecentOut['stage'], string> = { live: 'went out', scheduled: 'is scheduled', approved: 'was approved' }
/** The canonical primary source of a plan option, or null: its own `source`, else the first of its `sources`. */
export function primaryUrl(raw: Body | null, fallback: unknown = null): string | null {
  const first = (v: unknown): string | null => (isObj(v) ? str(v.url) ?? str(v.href) : str(v))
  const list = raw && Array.isArray(raw.sources) ? raw.sources : []
  const url = first(raw?.source) ?? first(raw?.source_url) ?? (list.length ? first(list[0]) : null) ?? first(fallback)
  return url && /^https?:\/\//i.test(url) ? canonicalUrl(url) : null
}
/** Every source an option cites: the canonical URLs anywhere in its source fields, and its label's named sources, one per
 *  ';' part, as words (dates and all). Two options citing two or more of the same named sources tell the same story
 *  (Tue 17's "Why does Microsoft get OpenAI's rival to check OpenAI's work?" cited three of the five sources of Fri 13's
 *  "Your AI thinks it's the best"). */
export function citesOf(raw: Body | null): { urls: string[]; parts: string[] } {
  const urls = new Set<string>(), parts = new Set<string>()
  const take = (v: unknown) => {
    if (isObj(v)) { take(v.url); take(v.href); take(v.label); return }
    const t = str(v)
    if (!t) return
    for (const m of t.match(/https?:\/\/[^\s"')<>]+/gi) || []) { const c = canonicalUrl(m); if (c) urls.add(c) }
    for (const part of t.replace(/https?:\/\/\S+/gi, ' ').split(';')) { const w = titleNorm(part); if (w.split(' ').length >= 3) parts.add(w) }
  }
  take(raw?.source); take(raw?.source_url)
  if (raw && Array.isArray(raw.sources)) raw.sources.forEach(take)
  return { urls: [...urls], parts: [...parts] }
}
/** A hook as words only, for an exact match; null when it is too short to mean anything. */
export function hookNorm(v: unknown): string | null {
  const s = titleNorm(str(v) ?? '')
  return s.split(' ').length >= 4 ? s : null
}
/** The earlier thing an item or idea retells, or null. Only a piece or post an earlier board offered counts (a story he
 *  already chose), dated from 14 days before it to the end of its own week; never itself (an item carried into this week
 *  is matched by its key). Retelling is the same primary source, the same hook (never for the weekly good news, whose
 *  hook is the same every week by design), or two or more named sources in common. The line says which. */
export function repeatOf(own: { keys: string[]; week: string; date: string; url: string | null; hook: string | null; recurring?: boolean; cites?: { urls: string[]; parts: string[] } }, recent: RecentOut[]): ModelRepeatOf | null {
  const why = (r: RecentOut): string | null => {
    if (own.url && (r.url === own.url || (r.cites?.urls || []).includes(own.url))) return 'Same source as'
    if (r.url && (own.cites?.urls || []).includes(r.url)) return 'Same source as'
    if (own.hook && r.hook === own.hook && !own.recurring && !r.recurring) return 'Same hook as'
    const mine = new Set(own.cites?.parts || [])
    const shared = (r.cites?.parts || []).filter(x => mine.has(x)).length
    return shared >= 2 ? `Shares ${shared} sources with` : null
  }
  const end = shiftDays(own.week, 6)
  const hits = recent.filter(r => !r.keys.some(k => own.keys.includes(k)) && r.week < own.week && daysBetween(own.date, r.date) <= 14 && r.date <= end)
    .map(r => ({ r, how: why(r) })).filter((x): x is { r: RecentOut; how: string } => Boolean(x.how))
    .sort((a, b) => ['live', 'scheduled', 'approved'].indexOf(a.r.stage) - ['live', 'scheduled', 'approved'].indexOf(b.r.stage) || b.r.date.localeCompare(a.r.date))
  const hit = hits[0]
  if (!hit) return null
  const { r } = hit
  const when = new Date(`${r.date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  return { title: cut(r.title, 200), date: r.date, day: r.day, stage: r.stage, kind: r.kind,
    line: `${hit.how} "${cut(r.title, 120).replace(/[.\s]+$/, '')}", which ${STAGE_WORD[r.stage]} on ${when}.` }
}

/** What earlier boards put out or on its way, from 14 days before the week to its end, for the repeat check: every
 *  approved off-day item an earlier board offered (its stage from Growth's posting record) and the series pieces of the
 *  14 days before the week (content_ideas rows the view reads). This week's own board is never its own repeat: a twin
 *  on it is the Sunday run's to refuse (board_feed.py gate). Pure. */
export function recentOutOf(m: Pick<ModelInputs, 'week' | 'ideas' | 'plans' | 'pieces'>, _days: DayView[], items: OffdayItem[] | null, pastPieces: Body[]): RecentOut[] {
  const from = shiftDays(m.week, -14), to = shiftDays(m.week, 6)
  const out: RecentOut[] = []
  for (const it of items || []) {
    const board = it.origin_week || it.week || ''
    if (it.state !== 'approved' || !it.date || it.date < from || it.date > to || !board || board >= m.week) continue
    const stage: RecentOut['stage'] = it.posts.some(p => p.state === 'live') ? 'live' : it.posts.some(p => p.state === 'scheduled') ? 'scheduled' : 'approved'
    const raw = isObj(it.option) && Object.keys(it.option).length ? it.option : rawOption(m as ModelInputs, it.day || '', it.option_id)
    out.push({ keys: [it.item, ...(it.doc ? [`${board}:${it.doc}`] : [])], kind: 'post', title: cut(raw?.hook ?? raw?.title ?? raw?.copy ?? it.option_id, 200),
      url: primaryUrl(raw) ?? primaryUrl(rawOption(m as ModelInputs, it.day || '', it.option_id)), hook: hookNorm(raw?.hook ?? raw?.title), date: it.date, day: it.day || '', stage,
      week: board, recurring: offdayKind(raw || {}).kind === 'good_news', cites: citesOf(raw) })
  }
  for (const r of pastPieces) {
    const date = str(r.scheduled_for)?.slice(0, 10)
    if (!date || date < from || date >= m.week || r.buried_at) continue
    const at = new Date(`${date}T00:00:00Z`)
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][at.getUTCDay()]
    out.push({ keys: [`piece:${String(r.id).toLowerCase()}`], kind: 'piece', title: cut(r.idea ?? r.thesis, 200),
      url: str(r.canonical_url) ?? primaryUrl(null, r.source_url), hook: hookNorm(r.idea), date, day,
      stage: r.state === 'published' ? 'live' : 'approved', week: shiftDays(date, -((at.getUTCDay() + 6) % 7)) })
  }
  return out
}

/** The week model from the view's days (already gated and staged from the records). Pure. */
export function weekModel(days: DayView[], m: ModelInputs): WeekModel {
  const ideas: ModelIdea[] = []
  const ideaRepeats = new Map<string, ModelRepeatOf>()
  const out: ModelDay[] = days.map(d => {
    const items: ModelItem[] = []
    const piece = pieceItem(m, d)
    if (piece) items.push(piece)
    // Every other piece his approval holds on the day (contract 1.13.0): one he moved here, or one he kept alongside the
    // piece that replaced it. Drawn as a piece with its Move to…, never hidden behind the day's own piece.
    // An off-day piece he records is drawn once, as its off-day post (its record follows it there, recordedPiece).
    const recordedHere = new Set(d.options.filter(o => o.doc_id.startsWith('off-') && o.status === 'approved' && o.outcome?.id === 'approved')
      .map(o => recordedPiece(m, rawOption(m, d.day, o.id))).filter((x): x is string => Boolean(x)))
    for (const p of d.pieces) if (p.approval && p.id !== piece?.piece_id && !recordedHere.has(p.id)) items.push(placedPieceItem(m, d, p))
    for (const o of d.options) {
      // The day's piece is drawn as the piece; a publishing day's other Sunday options and every off-day option he has
      // not approved are ideas, on the ideas board only.
      if (SERIES_DAYS.includes(d.day) && d.piece_id && o.id.toLowerCase() === d.piece_id) continue
      const offday = o.doc_id.startsWith('off-')
      if (offday && o.status === 'approved' && o.outcome?.id === 'approved') { items.push(postItem(m, d, o)); continue }
      const why = ideaLine(o)
      if (why && (offday || /^(mon|wed|fri)-\d+$/.test(o.doc_id))) {
        const idea = ideaOf(m, d, o, why)
        const raw = rawOption(m, d.day, o.id)
        const rep = repeatOf({ keys: [`${m.week}:${o.doc_id}`, ...(o.item?.key ? [o.item.key] : []), ...(idea.piece_id ? [`piece:${idea.piece_id}`] : [])], week: m.week, date: d.date,
          url: primaryUrl(raw, o.source), hook: hookNorm(raw?.hook ?? o.title), recurring: idea.kind === 'good_news', cites: citesOf(raw) }, m.recentOut || [])
        if (rep) ideaRepeats.set(o.doc_id, rep)
        ideas.push(idea)
      }
    }
    for (const h of (m.heldPieces || []).filter(x => x.day === d.day)) {
      const id = String(h.piece.id).toLowerCase()
      ideas.push({ doc_id: `piece-${id}`, piece_id: id, day: d.day, date: d.date, kind: PIECE_KIND.key, kind_label: d.series, title: cut(h.piece.idea ?? h.piece.thesis, 200),
        why: 'held_piece', line: 'Held: on this day with no Approve of yours.', read: readOf(null, { row: h.piece }), actions: [h.press], stories: null, move: null })
    }
    // The scripts on every card that holds them (scriptsOnCard; Krish, 2026-11-17).
    for (let n = 0; n < items.length; n++) items[n] = scriptsOnCard(m, d, items[n])
    const day: ModelDay = { day: d.day, date: d.date, label: d.label, series: SERIES_DAYS.includes(d.day) ? d.series : null, items,
      decisions: items.filter(i => i.decision).length, ideas: ideas.filter(x => x.day === d.day).length, line: '' }
    day.line = dayLine(day)
    return day
  })
  // What no longer waits on him leaves the ideas board (Krish, 2026-11-13: the board shows "the current state of affairs
  // on what needs to be done"): an idea for a day that has passed, and an idea that is the same post as an item already
  // out or scheduled on a day (Thu 12 Nov's "POV: your AI agent..." still asked for his Approve after the one post went
  // out on Fri 13). The plan keeps every one; only the board stops asking.
  const goneOut = new Set(out.flatMap(md => md.items.filter(it => it.item && (it.stage.key === 'live' || it.stage.key === 'scheduled')).map(it => it.item!)))
  const twinOf = new Map(days.flatMap(d => d.options.filter(o => o.same_post?.item).map(o => [o.doc_id, o.same_post!.item] as const)))
  // A piece his approval already holds on a day of the week is never also an idea elsewhere in it (Fri 20's "Voters just
  // said no to AI's power bill" still waited on his answer after he moved that piece to Tue 17 on 13 Nov).
  const onDay = new Set(out.flatMap(md => md.items.map(it => it.piece_id).filter((x): x is string => Boolean(x))))
  // An idea that retells something already approved, scheduled or live leaves the board too, said once in `repeats`
  // (contract 1.17.0; Ruling, Krish, 2026-11-16): on 16 Nov four of the week's options retold last week's posts.
  const recent = m.recentOut || []
  const repeats: ModelRepeat[] = []
  for (const md of out) for (const it of md.items) {
    if (it.stage.key === 'live') continue
    const raw = it.piece_id ? rawOption(m, md.day, it.piece_id) : rawOption(m, md.day, it.key.replace(/^off-[a-z]{3}-/, ''))
    const row = it.piece_id ? m.pieces.find(x => String(x.id).toLowerCase() === it.piece_id) ?? null : null
    const rep = repeatOf({ keys: [`${m.week}:${it.key}`, ...(it.item ? [it.item] : []), ...(it.piece_id ? [`piece:${it.piece_id}`] : [])], week: m.week, date: it.date,
      url: primaryUrl(raw, row?.source_url), hook: hookNorm(raw?.hook ?? it.title), recurring: it.kind === 'good_news', cites: citesOf(raw) }, recent)
    if (rep) it.repeat = rep
  }
  const fresh = ideas.filter(i => {
    const rep = ideaRepeats.get(i.doc_id) ?? null
    if (rep && i.date >= m.today) repeats.push({ doc_id: i.doc_id, piece_id: i.piece_id, day: i.day, date: i.date, title: i.title, of: rep })
    return !rep
  })
  const waiting = fresh.filter(i => i.date >= m.today && !goneOut.has(twinOf.get(i.doc_id) ?? '') && !(i.piece_id && onDay.has(i.piece_id)))
  if (waiting.length !== ideas.length) {
    for (const md of out) {
      md.ideas = waiting.filter(x => x.day === md.day).length
      md.line = dayLine(md)
    }
  }
  return {
    version: 1,
    kinds: [...OFFDAY_KINDS.map(k => ({ key: k.key, label: k.label })), { key: PIECE_KIND.key, label: PIECE_KIND.label }],
    piece_path: PIECE_PATH.map(s => ({ key: s.key, label: s.label })),
    post_path: POST_PATH.map(s => ({ key: s.key, label: s.label })),
    days: out,
    ideas: waiting,
    repeats,
  }
}
const shiftDays = (ymd: string, n: number): string => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ideaOf(m: ModelInputs, d: DayView, o: ViewOption, w: { why: ModelIdea['why']; line: string }): ModelIdea {
  const raw = rawOption(m, d.day, o.id)
  const series = !o.doc_id.startsWith('off-')
  const { kind, supports } = series ? { kind: PIECE_KIND.key as string, supports: null } : offdayKind({ ...(raw || {}), format: raw?.format ?? o.format })
  const pieceId = UUID.test(o.id) ? o.id.toLowerCase() : str(raw?.piece_id)?.toLowerCase() ?? null
  const row = pieceId ? m.pieces.find(x => String(x.id).toLowerCase() === pieceId) ?? null : null
  return {
    doc_id: o.doc_id, piece_id: pieceId, day: d.day, date: d.date, kind, kind_label: series ? d.series : kindLabel(kind as OffdayKind, supports),
    title: cut(o.title, 200), why: w.why, line: w.line,
    read: readOf(raw, { text: o.text, said: o.said, row, source: o.source }),
    actions: o.actions || [],
    stories: kind === 'good_news' ? storiesOf(raw, o) : null,
    move: o.move ?? null,
  }
}

/** Every rule the model keeps, for the tests and the guard: nothing on a day he did not approve, one action an item,
 *  a kind from the list, a path from the list, and good news with its five stories or saying how many it has. */
export function modelProblems(model: WeekModel, days: DayView[]): string[] {
  const out: string[] = []
  const kinds = new Set(model.kinds.map(k => k.key))
  for (const md of model.days) {
    const d = days.find(x => x.day === md.day)
    for (const it of md.items) {
      if (!kinds.has(it.kind)) out.push(`${md.day} ${it.key}: kind ${it.kind} is not on the list`)
      if (it.type === 'post') {
        const o = d?.options.find(x => x.doc_id === it.key)
        if (!o || o.status !== 'approved' || o.outcome?.id !== 'approved') out.push(`${md.day} ${it.key}: on the day without his approval`)
        if (it.path.length !== POST_PATH.length) out.push(`${md.day} ${it.key}: not on the post path`)
      } else {
        const p = d?.pieces.find(x => `piece:${x.id}` === it.key)
        if (!p?.approval) out.push(`${md.day} ${it.key}: a piece on the day without his approval`)
        if (it.path.length !== PIECE_PATH.length) out.push(`${md.day} ${it.key}: not on the piece path`)
      }
      if (it.stage.key !== 'live' && !it.next && it.stage.key !== 'scheduled') out.push(`${md.day} ${it.key}: not live and no next action`)
      if (it.next?.kind === 'prompt' && it.next.label !== CLAUDE_LABEL) out.push(`${md.day} ${it.key}: a prompt not named ${CLAUDE_LABEL}`)
      if (it.next && (it.next.kind === 'open' && !/^https:\/\//.test(it.next.href))) out.push(`${md.day} ${it.key}: an action that opens the archive`)
      if (it.next && (it.next.kind === 'look' || it.next.kind === 'review')) out.push(`${md.day} ${it.key}: an action of the old board`)
      if (it.kind === 'good_news' && (!it.stories || it.stories_planned !== GOOD_NEWS_STORIES)) out.push(`${md.day} ${it.key}: good news without its stories`)
    }
    if (model.ideas.some(i => md.items.some(it => it.key === i.doc_id))) out.push(`${md.day}: an idea on the day`)
  }
  return out
}
