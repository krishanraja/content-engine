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

type Body = Record<string, unknown>
const obj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/** The marker every carried instruction starts with, so it is added once and a test can find it. */
export const WRITE_BACK_HEAD = 'Keep the board current as you work'

/** The research rule every carried instruction and the plan-week, make-piece and produce-video skills say (Ruling, Krish,
 *  2026-11-11; docs/DRIVE.md, "The research library"). tests/control-plane/research-library.test.ts holds all four to it. */
export const RESEARCH_RULE = 'Research is never left in scratch or a chat: file each research document on the piece as you write it, '
  + 'and when Krish sends a Markdown file, file it on the piece first. Each is copied into his Research library in Drive.'

/** What no session does on the board (Ruling, Krish, 2026-11-11: one live board, in Control Centre; the old board is a
 *  read-only archive), said once in every copied prompt; how to use the board is docs/PUBLISH_BOARDS.md. */
export const WALLS = 'This Publish Board in Control Centre is the only place to put the work; content.krishraja.com/board is a '
  + 'read-only archive. Never post or publish anything, and never put an idea on the publish board: propose it, and only '
  + 'Krish\'s Approve places it.'

export interface WriteBackTarget { pieceId: string | null; week: string; day: string; step: string }

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
    + `1. First see what is already on file and who else is on it: get_piece_board on the Control Center connector with ${where}. `
    + `In a checkout of krishanraja/content-engine: python3 scripts/post-pack/board_session.py ${cli} show\n`
    + `2. Choose a session id once (for example ${step}- and four random letters) and report with it: report_board_session with ${where}, `
    + `your session_id, step "${step}" and one plain line, as kind start when you begin, progress at each milestone, and done when you finish `
    + `(blocked, saying what you need, if you stop). The script: board_session.py ${cli} start|progress|done|blocked "one line" --session <your id> --step ${step}\n`
    + `3. File everything you make or draw on (research, scripts, storyboards, screenshots, links) on the piece with add_piece_material, `
    + `or board_session.py ${cli} add <file or text>. Never leave it only in this chat. Read a material with read_piece_material or board_session.py ${cli} read <id>.\n`
    + `4. ${RESEARCH_RULE} The script: board_session.py ${cli} add <file> --kind research\n`
    + `5. ${WALLS}\n`
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
function stepOf(d: DayLike, label: string): string {
  if (/growth/i.test(label)) return 'post'
  if (/mock/i.test(label)) return 'look'
  return d.path?.current || (d.who === 'growth' ? 'post' : 'next')
}

/** Every Claude or Growth prompt on the view carries the instruction, once. A Perplexity prompt does not: that is not a
 *  session that can report. Mutates the actions in place (yours shares them) and returns the days. */
export function withWriteBack<T extends DayLike>(week: string, days: T[]): T[] {
  for (const d of days) {
    const add = (prompt: string, step: string) => (prompt.includes(WRITE_BACK_HEAD) ? prompt
      : `${prompt}\n\n${writeBack({ pieceId: d.piece_id, week, day: d.day, step })}`)
    for (const a of d.actions) {
      if (a.kind !== 'prompt' || typeof a.prompt !== 'string' || typeof a.label !== 'string' || /perplexity/i.test(a.label)) continue
      a.prompt = add(a.prompt, stepOf(d, a.label))
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

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }
/** The week's overlay in one read, or null when the store cannot be read (the view then says no sessions and no materials). */
export async function readOverlay(db: Rpc, week: string, pieceIds: string[]): Promise<Overlay | null> {
  try {
    const r = await db.rpc('board_overlay', { p_pieces: pieceIds, p_week: week, p_all_versions: false, p_archived: false })
    if (r.error || !obj(r.data)) return null
    return { sessions: Array.isArray(r.data.sessions) ? r.data.sessions as Body[] : [], materials: Array.isArray(r.data.materials) ? r.data.materials as Body[] : [] }
  } catch { return null }
}
