// What every prompt the board copies out says about reporting back, and what the board shows of the sessions and the
// materials on each day (docs/PUBLISH_BOARDS.md, "Sessions and materials"; api/_pieceStore.ts).
//
// Krish, 2026-11-11: "If I copy a Claude prompt out of the content publish board ... that session should automatically
// update the board once it's done or as it's going."
//
// The instruction is short and stable, names the piece, the week, the day and the step, and carries no key: a session
// reports through Control Centre's connector (signed in already, in a claude.ai chat and in a Claude Code session alike)
// or, in a checkout of this repository, through scripts/post-pack/board_session.py, which uses the engine key the
// machine already holds (scripts/engine.py). Both land on the same routes and the same database rules.

import { DECISIONS_RULE, decisionsText, type PieceDecisions } from './_decisions.js'

type Body = Record<string, unknown>
const obj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/** The marker every carried instruction starts with, so it is added once and a test can find it. */
export const WRITE_BACK_HEAD = 'Keep the board current as you work'

/** The research rule every carried instruction and the plan-week, make-piece and produce-video skills say (Ruling, Krish,
 *  2026-11-11; docs/DRIVE.md, "The research library"). tests/control-plane/research-library.test.ts holds all four to it. */
export const RESEARCH_RULE = 'Research is never left in scratch or a chat: file each research document on the piece as you write it, '
  + 'and when Krish sends a Markdown file, file it on the piece first. Each is copied into his Research library in Drive.'

/** What no session does on the board (Ruling, Krish, 2026-11-11: one live board, in Control Centre; Ruling, Krish,
 *  2026-11-13: the old publish boards are retired for good), said once in every copied prompt; how to use the board is
 *  docs/PUBLISH_BOARDS.md. */
export const WALLS = 'This Publish Board in Control Centre is the only place to put the work; the old pages at '
  + 'content.krishraja.com/board are retired and redirect here. Never post or publish anything, and never put an idea on '
  + 'the publish board: propose it, and only Krish\'s Approve places it.'

/** How every session ends, so nothing it did is left for the next one to guess (Ruling, Krish, 2026-11-17: "Every prompt
 *  created for Claude or Perplexity should leave the new session with nothing to assume, and it should also close the loop
 *  on updating the board, the drive, and everything else as it goes"). */
export const CLOSE_LOOP = 'Close the loop as you go, not only at the end: every file you make is on the piece the moment it exists; '
  + 'anything for his Drive goes where docs/DRIVE.md places it (research filed on the piece is copied to his Research library by itself; '
  + 'a finished post asset goes in that post\'s own folder); work in the repository is committed and pushed by its own rules, with its '
  + 'closeout note (AGENTS.md, "Commit and closeout"). Before you stop, report done (or blocked) with one line saying what changed and '
  + 'where each thing now is, and end your last message with the one next step and who takes it. Filing a file in Drive does not update the board: '
  + 'write the record the card reads, read the board back, and report done only when it shows the change (Krish, 2026-11-18).'

/** Where his typed approval of a lock or scripts goes (Ruling, Krish, 2026-11-12: "Scripts and locks only."). On 13 Nov
 *  he had approved Mon 16's and Wed 18's stories and scripts in sessions, and the board said "No approved scripts are
 *  filed yet": the approvals stayed in the chats and in draft files the board never reads. */
export const APPROVAL_RULE = 'When Krish approves the narrative lock or the scripts in this session, file his exact typed words at once, '
  + 'with when and where he typed them: the board counts his approval only from there, never from this chat or a draft file.'

export interface WriteBackTarget { pieceId: string | null; week: string; day: string; step: string; decisions?: PieceDecisions | null }

const STEP = /^[a-z][a-z0-9_-]{0,40}$/
/** A step as a short key the board shows ("storyboard", "post"), from a path key or a label. */
export function stepKey(raw: string | null | undefined): string {
  const k = String(raw || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return STEP.test(k) ? k : 'next'
}

/** The instruction itself. Plain words, one target, no key. */
export function writeBack(t: WriteBackTarget): string {
  const step = stepKey(t.step)
  const where = t.pieceId ? `piece_id ${t.pieceId}` : `week ${t.week} and day ${t.day}`
  const cli = t.pieceId ? t.pieceId : `day:${t.week}/${t.day}`
  return `${WRITE_BACK_HEAD} (${where}, step ${step}). Krish sees it live on the Publish Board, and other sessions may be working on this piece at the same time.\n`
    + (t.decisions ? `${decisionsText(t.decisions)}\n` : '')
    + `1. First see what is already on file, who else is on it and his decisions (look, motion, captions, lock, scripts): get_piece_board on the Control Center connector with ${where}. `
    + `${DECISIONS_RULE} The connector works everywhere; the script needs the engine's own address, which a cloud session's network may not allow. `
    + `In a checkout of krishanraja/content-engine: python3 scripts/post-pack/board_session.py ${cli} show\n`
    + `2. Choose a session id once (for example ${step}- and four random letters) and report with it: report_board_session with ${where}, `
    + `your session_id, step "${step}" and one plain line, as kind start when you begin, progress at each milestone, and done when you finish `
    + `(blocked, saying what you need, if you stop). The script: board_session.py ${cli} start|progress|done|blocked "one line" --session <your id> --step ${step}\n`
    + `3. File everything you make or draw on (research, scripts, storyboards, screenshots, links) on the piece with add_piece_material, `
    + `or board_session.py ${cli} add <file or text>. Never leave it only in this chat. Read a material with read_piece_material or board_session.py ${cli} read <id>.\n`
    + `4. ${RESEARCH_RULE} The script: board_session.py ${cli} add <file> --kind research\n`
    + (t.pieceId ? `5. ${APPROVAL_RULE} The script: board_session.py ${cli} approve lock|scripts (docs/PUBLISH_BOARDS.md, "His typed approval")\n` : '')
    + `${t.pieceId ? 6 : 5}. ${WALLS}\n`
    + `${t.pieceId ? 7 : 6}. ${CLOSE_LOOP}\n`
    + 'Nothing on file is ever deleted or overwritten, so add, never replace. No key belongs in this prompt: the connector is already signed in, '
    + 'and the script uses the engine key this machine already holds.'
}

interface DayLike {
  day: string
  date: string
  piece_id: string | null
  who: string
  actions: Array<Body>
  path?: { current: string | null; prompts?: Record<string, string> } | null
}

/** The step a day's prompts are for: its path's current step, Growth's post, or what the action names. */
function stepOf(d: DayLike, label: string, decided: PieceDecisions | null = null): string {
  if (/growth/i.test(label)) return 'post'
  if (/mock/i.test(label)) return 'look'
  // A piece with no day path of its own (placed off its series day) takes its step from his decisions (F46).
  return d.path?.current || decided?.next_step || (d.who === 'growth' ? 'post' : 'next')
}

/** Every Claude or Growth prompt on the view carries the instruction, once. A Perplexity prompt does not: that is not a
 *  session that can report. Mutates the actions in place (yours shares them) and returns the days. */
export function withWriteBack<T extends DayLike>(week: string, days: T[], decisions: Record<string, PieceDecisions> = {}): T[] {
  for (const d of days) {
    const decided = d.piece_id ? decisions[d.piece_id] ?? null : null
    const add = (prompt: string, step: string) => (prompt.includes(WRITE_BACK_HEAD) ? prompt
      : `${prompt}\n\n${writeBack({ pieceId: d.piece_id, week, day: d.day, step, decisions: decided })}`)
    for (const a of d.actions) {
      if (a.kind !== 'prompt' || typeof a.prompt !== 'string' || typeof a.label !== 'string' || /perplexity/i.test(a.label)) continue
      a.prompt = add(a.prompt, stepOf(d, a.label, decided))
    }
    const prompts = d.path?.prompts
    if (prompts) for (const k of Object.keys(prompts)) if (k !== 'research' && typeof prompts[k] === 'string') prompts[k] = add(prompts[k], k === 'mock' ? 'look' : k === 'storyboard' ? 'board' : k)
  }
  return days
}

// ── what the view carries (view.schema.json, day.sessions and day.materials) ─────────────────────────────────────────

export interface ViewSession {
  session_id: string; label: string | null; surface: string | null; by: string
  state: string; step: string | null; doing: string | null; started_at: string; last_at: string
}
export interface ViewMaterial {
  id: string; kind: string; title: string; size: number; added_by: string; at: string | null
  thumbnail: string | null; role: string | null; version: number; where: 'piece' | 'day'
  /** The file's sha256 (a stored file), so a press can bind to exactly what he saw (the proof); null for a link or text. */
  sha256: string | null
}
export interface Overlay { sessions: Body[]; materials: Body[] }

const sessionOf = (s: Body): ViewSession => ({
  session_id: String(s.session_id), label: typeof s.label === 'string' ? s.label : null, surface: typeof s.surface === 'string' ? s.surface : null,
  by: String(s.by || ''), state: String(s.state || 'quiet'), step: typeof s.step === 'string' ? s.step : null, doing: typeof s.doing === 'string' ? s.doing : null,
  started_at: String(s.started_at || ''), last_at: String(s.last_at || ''),
})
const materialOf = (m: Body): ViewMaterial => {
  const type = typeof m.content_type === 'string' ? m.content_type : ''
  return {
    id: String(m.id), kind: String(m.kind), title: String(m.title), size: Number(m.bytes) || 0, added_by: String(m.added_by || ''),
    at: typeof m.at === 'string' ? m.at : null, thumbnail: type.startsWith('image/') ? String(m.id) : null,
    role: typeof m.role === 'string' ? m.role : null, version: Number(m.version) || 1, where: m.piece_id ? 'piece' : 'day',
    sha256: typeof m.sha256 === 'string' && /^[a-f0-9]{64}$/.test(m.sha256) ? m.sha256 : null,
  }
}

/** Each day's sessions (working first, then the newest) and materials (the piece's and the day's), from one overlay. */
export function attachOverlay<T extends { day: string; piece_id: string | null }>(week: string, days: T[], overlay: Overlay | null): Array<T & { sessions: ViewSession[]; materials: ViewMaterial[] }> {
  const rank: Record<string, number> = { working: 0, blocked: 1, quiet: 2, done: 3, ended: 4 }
  return days.map(d => {
    const scopes = new Set([...(d.piece_id ? [d.piece_id] : []), `day:${week}/${d.day}`])
    const sessions = (overlay?.sessions || []).filter(s => obj(s) && scopes.has(String(s.scope))).map(sessionOf)
      .sort((a, b) => (rank[a.state] ?? 9) - (rank[b.state] ?? 9) || b.last_at.localeCompare(a.last_at)).slice(0, 12)
    const materials = (overlay?.materials || []).filter(m => obj(m) && scopes.has(String(m.scope))).map(materialOf).slice(0, 60)
    return { ...d, sessions, materials }
  })
}

/** The week's work on file by scope (a piece id, or day:<Monday>/<day>), so every card on every day reads its own
 *  sessions and materials through one rule (workOf in _weekModel.ts; Ruling, Krish, 2026-11-17). */
export function workByScope(overlay: Overlay | null): Record<string, { sessions: ViewSession[]; materials: ViewMaterial[] }> {
  const out: Record<string, { sessions: ViewSession[]; materials: ViewMaterial[] }> = {}
  const at = (scope: string) => (out[scope] ??= { sessions: [], materials: [] })
  for (const s of overlay?.sessions || []) if (obj(s) && s.scope) at(String(s.scope)).sessions.push(sessionOf(s))
  for (const m of overlay?.materials || []) if (obj(m) && m.scope) at(String(m.scope)).materials.push(materialOf(m))
  return out
}

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }
/** The week's overlay in one read, or null when the store cannot be read (the view then says no sessions and no materials). */
export async function readOverlay(db: Rpc, week: string, pieceIds: string[]): Promise<Overlay | null> {
  try {
    const r = await db.rpc('board_overlay', { p_pieces: pieceIds, p_week: week, p_all_versions: false, p_archived: false })
    if (r.error || !obj(r.data)) return null
    return { sessions: Array.isArray(r.data.sessions) ? r.data.sessions as Body[] : [], materials: Array.isArray(r.data.materials) ? r.data.materials as Body[] : [] }
  } catch { return null }
}
