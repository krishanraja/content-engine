import type { SupabaseClient } from '@supabase/supabase-js'
import { dayDate, piecesByDay, SERIES_DAYS, type PostedDay } from './_posted.js'
import { liveDay, type LiveDay } from './_live.js'
import { readRuns, ENGINE_REPO, type JobName, type RunInfo } from './_run.js'
import { offdaySides, type OffdaySides } from './_offdaySides.js'

// The live board ("The Desk", /board/next): one view of the week as it stands now, built on every read from the
// pieces' making records, his presses on the board, the week's plan files on main and the runs on GitHub. Nothing is a
// snapshot. docs/plans/2026-11-09-board-desk/PLAN.md.
//
// The rule (Krish, 2026-11-09): "I should always open it with something to do for each piece or for the week, unless
// the day or the week is complete", and "Absolutely everything that isn't 100% complete needs an action button". So
// every day that is not done carries exactly one next step, and that step carries at least one action; viewProblems()
// refuses a view that breaks this, and the tests hold every state to it. An action names the machine that does the
// work: a run on GitHub (_run.ts), a press on the board, a link to what to read or watch, or, only for work that is a
// conversation with Krish, the prompt for a new session.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
export const VIEW_DAYS: readonly PostedDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const SERIES: Record<string, string> = { mon: 'follow.the.money', wed: 'under.the.hood', fri: 'mind.the.gap' }
const DAY_NAME: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' }
export const STOPS = ['Idea', 'Story', 'Make', 'Approve', 'Live'] as const

export type Who = 'you' | 'engine' | 'growth' | 'stuck' | 'done'
export type Action =
  | { kind: 'run'; label: string; job: JobName; input: Record<string, unknown>; runs_on: string }
  | { kind: 'open'; label: string; href: string }
  | { kind: 'prompt'; label: string; prompt: string }
  | { kind: 'review'; label: string }
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
}
export interface WeekView {
  week: string
  as_of: string
  days: DayView[]
  yours: Array<{ key: string; day: PostedDay; label: string; next: string; actions: Action[]; review?: NonNullable<DayView['reviews']>[number] }>
  moved: Array<{ at: string; text: string }>
  north_star: { current: number; target: number } | null
  runs: Partial<Record<JobName, RunInfo>>
  sources: Record<string, boolean>
}

export interface ViewInputs {
  week: string
  now: Date
  pieces: Body[]
  picks: Array<{ doc_id: string; body: Body; updated_by: string; updated_at?: string }>
  queue: Array<{ doc_id: string; body: Body; updated_by: string; updated_at?: string; revision?: number }>
  history: Array<{ collection: string; doc_id: string; updated_at: string; updated_by: string }>
  ideas: Body | null
  locks: Partial<Record<PostedDay, string | null>>
  runs: Partial<Record<JobName, RunInfo>>
  north_star: { current: number; target: number } | null
}

const RAW = `https://raw.githubusercontent.com/${ENGINE_REPO}/main`
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
const running = (r?: RunInfo) => Boolean(r && (r.state === 'queued' || r.state === 'running'))
const GH = (job: JobName) => `GitHub · ${job}.yml`

function stepState(live: LiveDay, key: string) { return live.steps.find(s => s.key === key)?.state }

/** One series day (Mon, Wed, Fri): its piece's next step from the record, the lock and the runs. */
function seriesDay(i: ViewInputs, day: PostedDay, piece: Body | undefined): DayView {
  const week = i.week, date = dayDate(week, day)
  const base = { day, date, label: short(week, day), kind: 'Essay and two cuts', series: SERIES[day], detail: [] as DayView['detail'] }
  if (!piece) {
    return { ...base, title: 'No piece picked yet', piece_id: null, stop: 0, who: 'you', runs_on: 'A press on the board',
      next: `Pick ${DAY_NAME[day]}'s idea from the options`, actions: [{ kind: 'open', label: 'Pick the idea', href: boardTab(week, 'ideas') }] }
  }
  const id = String(piece.id).toLowerCase()
  const title = String(piece.idea || piece.thesis || 'Untitled').slice(0, 140)
  const live = liveDay(piece, date)
  const lock = i.locks[day]
  const signed = lockSigned(lock)
  const make = i.runs['make-piece']
  const scriptsApproved = i.picks.some(p => p.doc_id === `${day}-scripts` && p.updated_by === 'Krish' && p.body.approved === true && String(p.body.piece_id || '').toLowerCase() === id)
  const detail: DayView['detail'] = [
    { h: 'Narrative lock', p: signed ? 'Signed' : lock ? 'Written, waiting for your signature' : 'Not written yet' },
    { h: 'Making', p: live.steps.map(s => `${s.key} ${s.state}`).join(' · ') },
  ]
  const v = { ...base, title, piece_id: id, detail }
  const story = (text: string) => `piece_id: ${id}\nMake ${DAY_NAME[day]} ${date} (${SERIES[day]}). ${text}`
  if (live.verdict === 'done') return { ...v, stop: 4, who: 'done', next: 'Published on every channel', runs_on: '', actions: [] }
  if (!signed) {
    return { ...v, stop: 1, who: 'you', runs_on: 'A conversation with you in a new Claude session',
      next: lock ? 'Read the narrative lock and sign it, or say what to change' : 'Settle the story, one question at a time, then sign the narrative lock',
      actions: [{ kind: 'prompt', label: lock ? 'Copy prompt to sign the lock' : 'Copy prompt to start the story',
        prompt: story(lock ? `Show me the narrative lock docs/plans/${week}-week/narrative-lock-${day}.md and take my signature or my changes.`
          : `Start from my brief and my research in docs/plans/${week}-week/. Interview me one question at a time on the deeper story, then write the narrative lock for me to sign.`) }] }
  }
  const made = ['workroom', 'draft', 'scripts'].every(k => stepState(live, k) === 'done')
  if (!made) {
    const failed = live.steps.find(s => s.state === 'failed')
    return { ...v, stop: 2, who: failed ? 'stuck' : 'you', runs_on: GH('make-piece'), ...(make ? { run: make } : {}),
      next: failed ? `${failed.key} failed${failed.note ? `: ${failed.note}` : ''}. Run the make again`
        : running(make) ? 'A make is running on GitHub (its row shows the latest run of make-piece, for any piece); start this one if it is not yours'
        : 'Your lock is signed. Start the make: every fact checked first, then the scripts',
      actions: [{ kind: 'run', label: failed ? 'Run the make again' : 'Start the make', job: 'make-piece', input: { piece_id: id }, runs_on: GH('make-piece') }] }
  }
  if (!scriptsApproved) {
    return { ...v, stop: 3, who: 'you', runs_on: 'Your press on the board, then the server sends them to your Teleprompter',
      next: 'Read both scripts and approve them, or say what to change', actions: [{ kind: 'open', label: 'Read and approve the scripts', href: boardTab(week, day) }] }
  }
  const rec = stepState(live, 'record'), vid = stepState(live, 'video'), pub = stepState(live, 'publish')
  if (rec !== 'done') {
    return { ...v, stop: 3, who: 'you', runs_on: 'You, then your home computer places each take on its piece',
      next: 'Record both cuts from your Teleprompter; each take files itself', actions: [{ kind: 'open', label: 'Open Teleprompter', href: 'https://app.teleprompter.com' }] }
  }
  if (vid !== 'done') {
    const cut = i.runs['produce-day']
    return { ...v, stop: 3, who: 'you', ...(cut ? { run: cut } : {}), runs_on: `Your home computer overnight, or ${GH('produce-day')}`,
      next: 'Both takes are in. Cut the videos now, or let tonight\'s overnight run do it',
      actions: [{ kind: 'run', label: 'Cut the videos now', job: 'produce-day', input: { date, piece: id }, runs_on: GH('produce-day') }] }
  }
  return { ...v, stop: pub === 'now' ? 4 : 3, who: 'growth', runs_on: 'Growth posts it, after your Approve for publish',
    next: pub === 'now' ? 'Posting: some channels are out' : 'Watch both cuts and press Approve for publish', actions: [{ kind: 'open', label: 'Watch and approve', href: boardTab(week, day) }] }
}

/** One off day (Tue, Thu, Sat): the options in the week's ideas.json and his verdicts on them. */
function offDay(i: ViewInputs, day: PostedDay, piece: Body | undefined): DayView {
  const week = i.week, date = dayDate(week, day)
  const options = (isObj(i.ideas) && isObj(i.ideas.offdays) && Array.isArray(i.ideas.offdays[day]) ? i.ideas.offdays[day] : []) as Body[]
  const verdict = (o: Body) => i.queue.find(q => q.doc_id === `off-${day}-${String(o.id)}` && q.updated_by === 'Krish')?.body
  const sideVerdict = (b: Body | undefined, side: string) => (isObj(b) && isObj(b[side]) ? String((b[side] as Body).verdict || '') : '')
  const said = options.map(o => ({ o, b: verdict(o) }))
  const chosen = said.filter(x => ['approve', 'improve'].includes(sideVerdict(x.b, 'idea')) || ['improve'].includes(sideVerdict(x.b, 'direction')))
  const base = { day, date, label: short(week, day), series: day === 'sat' ? 'good news' : 'off day', piece_id: piece ? String(piece.id).toLowerCase() : null,
    detail: said.map(x => ({ h: String(x.o.id), p: [x.o.format, sideVerdict(x.b, 'idea') || 'no press', x.o.revised ? 'revised' : ''].filter(Boolean).join(' · ') })) }
  if (piece) {
    const live = liveDay(piece, date)
    const title = String(piece.idea || 'Off-day piece').slice(0, 140)
    if (live.verdict === 'done') return { ...base, kind: 'Off-day piece', title, stop: 4, who: 'done', next: 'Published', runs_on: '', actions: [] }
  }
  if (!options.length) {
    if (day === 'sat') {
      const gn = i.runs['saturday-goodnews']
      return { ...base, kind: 'Good news', title: "This week's good news", stop: 0, who: 'engine', ...(gn ? { run: gn } : {}),
        runs_on: `${GH('saturday-goodnews')}, runs itself on Thursday`, next: running(gn) ? 'Finding the stories now' : 'The Thursday run finds the stories; start it now if you want them sooner',
        actions: [{ kind: 'run', label: 'Find the stories now', job: 'saturday-goodnews', input: { week }, runs_on: GH('saturday-goodnews') }] }
    }
    const si = i.runs['sunday-ideas']
    return { ...base, kind: 'Off day', title: 'No options yet', stop: 0, who: 'engine', ...(si ? { run: si } : {}), runs_on: GH('sunday-ideas'),
      next: 'The Sunday ideas run writes the off-day options', actions: [{ kind: 'run', label: 'Write the options now', job: 'sunday-ideas', input: { week }, runs_on: GH('sunday-ideas') }] }
  }
  const lead = chosen[0]
  if (!lead) {
    return { ...base, kind: 'Off day', title: `${options.length} options to judge`, stop: 0, who: 'you', runs_on: 'Your presses on the board',
      next: 'Approve, improve or reject each option', actions: [{ kind: 'open', label: `Judge the ${options.length} options`, href: boardTab(week, 'ideas') }] }
  }
  const improving = (x: { o: Body; b?: Body }) => sideVerdict(x.b, 'idea') === 'improve' || sideVerdict(x.b, 'direction') === 'improve'
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
  const where = d.piece_id
    ? `piece_id: ${d.piece_id}\nThe piece's making record: python3 scripts/post-pack/making.py ${d.piece_id} show. Its week: docs/plans/${week}-week/.`
    : `The week of ${week}: docs/plans/${week}-week/ and the publish board at content.krishraja.com/board/next/${week}.`
  const options = d.reviews?.length ? `\nThe option${d.reviews.length > 1 ? 's' : ''} waiting on me: ${d.reviews.map(r => r.doc_id).join(', ')} (revised from my words).` : ''
  return `${where}\n${d.label} (${d.series}, ${d.kind}): ${d.title}.\nNext step: ${d.next}.${options}\n`
    + 'Do this step with me in this session: work it out from the record first, ask me only what you need, one question at a time, '
    + 'show me what you make before anything is sent, and record what we settle on the piece and the board.'
}

/** The whole week's view from its inputs. Pure: the tests build every state from here. */
export function buildView(i: ViewInputs): WeekView {
  const byDay = new Map(piecesByDay(i.week, i.pieces).map(p => [p.day, p.piece]))
  const days = VIEW_DAYS.map(d => (SERIES_DAYS.includes(d) ? seriesDay(i, d, byDay.get(d)) : offDay(i, d, byDay.get(d))))
  for (const d of days) {
    if (d.who === 'done' || d.actions.some(a => a.kind === 'prompt')) continue
    d.actions.push({ kind: 'prompt', label: 'Copy Claude prompt', prompt: backupPrompt(i.week, d) })
  }
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
  return { week: i.week, as_of: i.now.toISOString(), days, yours, moved: moved.slice(0, 10), north_star: i.north_star, runs: i.runs,
    sources: { ideas: Boolean(i.ideas), runs: Object.keys(i.runs).length > 0 } }
}

/** Every rule the view must keep (PLAN.md): a day not done has a next step, and that step has at least one action. */
export function viewProblems(v: WeekView): string[] {
  const out: string[] = []
  for (const d of v.days) {
    if (d.who === 'done') continue
    if (!d.next) out.push(`${d.day}: not done and no next step`)
    if (!d.actions.length) out.push(`${d.day}: not done and no action`)
    if (!d.actions.some(a => a.kind === 'prompt')) out.push(`${d.day}: no Claude prompt as a backup`)
    if (d.actions[0]?.kind === 'prompt' && !/conversation|Growth/.test(d.runs_on)) out.push(`${d.day}: a prompt first where a machine could run it`)
  }
  return out
}

type Fetcher = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{ status: number; text(): Promise<string> }>
const fetchText = async (f: Fetcher, url: string) => { try { const r = await f(url); return r.status === 200 ? await r.text() : null } catch { return null } }

/** Read every input of the week now and build its view. Each source that cannot be read is said in sources, never a failure. */
export async function readView(db: SupabaseClient, week: string, env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch as unknown as Fetcher, now = new Date()): Promise<WeekView> {
  const [pieces, picks, queue, history, ideasText, nowText, runs, ...locks] = await Promise.all([
    db.from('content_ideas').select('id, idea, thesis, scheduled_for, lane_slot, state, buried_at, body, meta, updated_at')
      .gte('scheduled_for', week).lte('scheduled_for', dayDate(week, 'sun')).then(r => (r.error ? [] : r.data || [])),
    db.from('board_documents').select('doc_id,body,updated_by,updated_at').eq('week', week).eq('collection', 'picks').then(r => (r.error ? [] : r.data || [])),
    db.from('board_documents').select('doc_id,body,updated_by,updated_at,revision').eq('week', week).eq('collection', 'queue').then(r => (r.error ? [] : r.data || [])),
    db.from('board_history').select('collection,doc_id,updated_at,updated_by').eq('week', week).order('updated_at', { ascending: false }).limit(12)
      .then(r => (r.error ? [] : r.data || [])),
    // The week's revise branch first: offday-revise pushes his revised cards there, and GitHub Actions may not open
    // the pull request that brings them to main, so the board reads them where they are, the moment they exist.
    fetchText(fetcher, `https://raw.githubusercontent.com/${ENGINE_REPO}/offday-revise/${week}/docs/plans/${week}-week/ideas.json`)
      .then(t => t ?? fetchText(fetcher, `${RAW}/docs/plans/${week}-week/ideas.json`)),
    fetchText(fetcher, `${RAW}/NOW.md`),
    readRuns(env, fetcher as never),
    ...SERIES_DAYS.map(d => fetchText(fetcher, `${RAW}/docs/plans/${week}-week/narrative-lock-${d}.md`)),
  ])
  let ideas: Body | null = null
  try { ideas = ideasText ? JSON.parse(ideasText) : null } catch { ideas = null }
  let north: { current: number; target: number } | null = null
  const m = nowText ? /<!-- north-star-state (\{.*?\}) -->/.exec(nowText) : null
  try { if (m) { const s = JSON.parse(m[1]); north = { current: Number(s.current), target: Number(s.week_target) } } } catch { north = null }
  return buildView({ week, now, pieces: pieces as Body[], picks: picks as ViewInputs['picks'], queue: queue as ViewInputs['queue'],
    history: history as ViewInputs['history'], ideas, runs, north_star: north,
    locks: Object.fromEntries(SERIES_DAYS.map((d, k) => [d, locks[k] as string | null])) })
}
