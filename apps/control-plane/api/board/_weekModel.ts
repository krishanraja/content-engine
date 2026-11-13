import { SERIES_DAYS, type PostedDay } from './_posted.js'
import { writeBack } from './_writeBack.js'
import type { MoveSpec } from './_offdayItems.js'
import type { PressAction, ViewOption } from './_viewExtras.js'
import type { Action, DayView } from './_view.js'

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
/** The one label every hand-off to a session wears. */
export const CLAUDE_LABEL = 'Copy prompt for Claude'

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
}
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
}

/** What the model reads besides the view's days: the week, today, the week's plan and the pieces' rows. */
export interface ModelInputs {
  week: string
  today: string
  ideas: Body | null
  /** Every plan beside this week's, by Monday (an item carried from another week keeps its words there). */
  plans?: Record<string, Body | null>
  pieces: Body[]
  /** Pieces held off a day by the gate that no option offers, each with its Approve. */
  heldPieces?: Array<{ day: PostedDay; piece: Body; press: PressAction }>
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

/** The one Claude prompt for an item: what it is, where it stands, and how to report back to the board. */
export function itemPrompt(week: string, it: { day: PostedDay; date: string; title: string; line: string; kind_label: string; piece_id: string | null; key: string }, step: string): ModelAction {
  const what = it.piece_id ? `the ${DAY_WORD[it.day]} ${it.date} piece ${it.piece_id}` : `the ${DAY_WORD[it.day]} ${it.date} off-day post ${it.key} (${it.kind_label})`
  const growth = !it.piece_id
  const prompt = `You are picking up ${what} of the Make Your Mind Up content engine with no prior context: "${it.title}". `
    + `Where it stands: ${it.line}\n\n`
    + (growth
      ? 'Growth makes and posts off-day posts (krishanraja/growth-makeyourmindup), to content-engine docs/CAROUSEL-STANDARD.md and the rejection floor. Make or post exactly what Krish approved, nothing else.\n\n'
      : 'The repository is krishanraja/content-engine: read AGENTS.md and CLAUDE.md once for the house rules, then take the next step with Krish, one question at a time.\n\n')
    + writeBack({ pieceId: it.piece_id, week, day: it.day, step })
  return { kind: 'prompt', label: CLAUDE_LABEL, prompt }
}

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
  for (let k = flags.length - 1; k > 0; k--) if (flags[k]) flags[k - 1] = true
  const done = flags.filter(Boolean).length
  const when = [stage('agreed')?.when ?? null, stage('flesh_out')?.when ?? null, null, stage('after_recording')?.when ?? null, out ? (p.stage?.at?.slice(0, 10) ?? d.date) : null]
  const path = steps(PIECE_PATH, done, when)
  const missed = d.who === 'missed'
  const raw = rawOption(m, d.day, d.piece_id)
  const row = m.pieces.find(x => String(x.id).toLowerCase() === d.piece_id) ?? null
  const read = readOf(raw, { row, research: [...(d.path?.materials || []).map(x => x.title), ...d.materials.map(x => x.title)] })
  const where = stageOf(PIECE_PATH, done)
  const label = where.label
  const base = { key: `piece:${d.piece_id}`, type: 'piece' as const, day: d.day, date: d.date, kind: PIECE_KIND.key, kind_label: d.series,
    title: cut(d.title, 200), approved: p.approval.label, stage: where, path, missed, read, piece_id: d.piece_id,
    item: null, supports: null, move: null, links: p.stage?.links ?? [], stories: null, stories_planned: null, others: [] as PressAction[] }
  if (out) return { ...base, line: p.stage?.state === 'live' ? p.stage.label : d.next, next: null, decision: false }
  // His Approve for publish on the made piece, bound to its manifest: his decision for the day.
  const publish = d.manifest?.press && d.manifest.state !== 'approved' ? d.manifest.press as unknown as PressAction : null
  const yes = d.actions.find(a => a.kind === 'press' && a.collection === 'picks' && isObj(a.body) && (a.body as Body).kind === 'yes')
  const decision = publish ?? yes ?? null
  const line = missed ? `Missed: ${d.label} passed and it is not marked live. If it went out, press It's live with its link.` : `${label}. ${d.next.replace(/[.\s]+$/, '')}.`
  if (decision && !missed) return { ...base, line, next: decision, decision: true }
  const live = d.actions.find(a => isLive(a, { piece_id: d.piece_id! }))
  if (live && (missed || d.who === 'growth')) return { ...base, line, next: { ...live, label: "It's live" } as Action, decision: false }
  const lead = d.actions[0]
  if (doable(lead) && !(lead.kind === 'press' && lead.op === 'live')) return { ...base, line, next: lead, decision: false }
  return { ...base, line, next: itemPrompt(m.week, { ...base, line }, d.path?.current || 'next'), decision: false }
}

/** An approved off-day post on the board: its kind, its path, where it is and its one next action. */
function postItem(m: ModelInputs, d: DayView, o: ViewOption): ModelItem {
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
  const read = readOf(raw, { text: o.text, said: o.said, source: o.source })
  const base = { key: o.doc_id, type: 'post' as const, day: d.day, date: d.date, kind, kind_label, title: cut(o.title, 200), approved: o.outcome?.label ?? null,
    stage: stageOf(POST_PATH, done), path, missed, read, piece_id: null,
    item: o.item?.key ?? null, supports, move: o.move ?? null, links: o.stage?.links ?? [], stories, stories_planned: kind === 'good_news' ? GOOD_NEWS_STORIES : null, others: [] as PressAction[] }
  if (state === 'live') return { ...base, line: o.stage!.label, next: null, decision: false }
  const where = o.stage?.label ?? 'Approved by you'
  const short = stories && stories.length < GOOD_NEWS_STORIES ? ` ${stories.length} of ${GOOD_NEWS_STORIES} stories found.` : ''
  const line = `${missed ? `Missed: ${d.label} passed and it is not marked live. If it went out, press It's live with its link.` : `${where}.`}${short}`.replace(/\.\./g, '.')
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
  return { ...base, line, next: itemPrompt(m.week, { ...base, line }, 'post'), decision: false }
}

/** Why an idea is on the ideas board, in one line. */
function ideaLine(o: ViewOption): { why: ModelIdea['why']; line: string } | null {
  if (o.status === 'held') return { why: 'held', line: o.held ?? 'Held: not approved by you.' }
  if (o.status === 'revised') return { why: 'revised', line: 'Revised from your words: waiting on your answer.' }
  if (o.status === 'open' && !o.outcome) return { why: 'open', line: 'Waiting on your answer.' }
  return null
}

function dayLine(d: ModelDay, done: boolean): string {
  if (!d.items.length) return d.ideas ? `Nothing approved for ${d.label} yet. Its ideas are on the ideas board.` : `Nothing approved for ${d.label}.`
  if (d.decisions) return `${d.decisions === 1 ? 'One decision' : `${d.decisions} decisions`} for you.`
  if (d.items.some(i => i.missed)) return `Missed: ${d.label} passed and not everything on it is marked live.`
  if (done || d.items.every(i => i.stage.key === 'live')) return 'Done: everything on it is live.'
  return `${d.items.length === 1 ? 'One item' : `${d.items.length} items`} in progress.`
}

/** The week model from the view's days (already gated and staged from the records). Pure. */
export function weekModel(days: DayView[], m: ModelInputs): WeekModel {
  const ideas: ModelIdea[] = []
  const out: ModelDay[] = days.map(d => {
    const items: ModelItem[] = []
    const piece = pieceItem(m, d)
    if (piece) items.push(piece)
    for (const o of d.options) {
      // The day's piece is drawn as the piece; a publishing day's other Sunday options and every off-day option he has
      // not approved are ideas, on the ideas board only.
      if (SERIES_DAYS.includes(d.day) && d.piece_id && o.id.toLowerCase() === d.piece_id) continue
      const offday = o.doc_id.startsWith('off-')
      if (offday && o.status === 'approved' && o.outcome?.id === 'approved') { items.push(postItem(m, d, o)); continue }
      const why = ideaLine(o)
      if (why && (offday || /^(mon|wed|fri)-\d+$/.test(o.doc_id))) ideas.push(ideaOf(m, d, o, why))
    }
    for (const h of (m.heldPieces || []).filter(x => x.day === d.day)) {
      const id = String(h.piece.id).toLowerCase()
      ideas.push({ doc_id: `piece-${id}`, piece_id: id, day: d.day, date: d.date, kind: PIECE_KIND.key, kind_label: d.series, title: cut(h.piece.idea ?? h.piece.thesis, 200),
        why: 'held_piece', line: 'Held: on this day with no Approve of yours.', read: readOf(null, { row: h.piece }), actions: [h.press], stories: null, move: null })
    }
    const day: ModelDay = { day: d.day, date: d.date, label: d.label, series: SERIES_DAYS.includes(d.day) ? d.series : null, items,
      decisions: items.filter(i => i.decision).length, ideas: ideas.filter(x => x.day === d.day).length, line: '' }
    day.line = dayLine(day, d.who === 'done')
    return day
  })
  return {
    version: 1,
    kinds: [...OFFDAY_KINDS.map(k => ({ key: k.key, label: k.label })), { key: PIECE_KIND.key, label: PIECE_KIND.label }],
    piece_path: PIECE_PATH.map(s => ({ key: s.key, label: s.label })),
    post_path: POST_PATH.map(s => ({ key: s.key, label: s.label })),
    days: out,
    ideas,
  }
}
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
