// The live board's one door to the server. Every call carries his login cookie; a 401 is said plainly, never swallowed.

export type Who = 'you' | 'engine' | 'growth' | 'stuck' | 'done'
export type Action =
  | { kind: 'run'; label: string; job: string; input: Record<string, unknown>; runs_on: string }
  | { kind: 'open'; label: string; href: string }
  | { kind: 'prompt'; label: string; prompt: string }
  | { kind: 'review'; label: string }
  | { kind: 'research'; label: string; piece_id: string }
  | { kind: 'look'; label: string; piece_id: string }
export interface Run { job: string; workflow: string; state: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'; started_at: string; updated_at: string; url: string }
export interface LookOption { id: string; name: string; pitch: string; status: string }
export interface OffdaySides { id: string; format: string; source: string; copy: string; copy_sha256: string; hook: string | null; pitch: Record<string, string> | null
  direction: { look?: string; format?: string; frames?: Array<{ words: string; picture: string }> } | null; revised: { side: string; words: string } | null
  idea_sha256: string; direction_sha256: string | null; shown_idea: Record<string, unknown> }
export interface Review { doc_id: string; revision: number | null; side: string; option: OffdaySides; prev: Record<string, unknown> | null }
export type PathKey = 'research' | 'story' | 'look' | 'board' | 'record' | 'cut'
export interface DayPath {
  steps: Array<{ key: PathKey; label: string; state: 'done' | 'current' | 'todo' }>
  current: PathKey | null
  materials: Array<{ id: string; title: string; kind: string; bytes: number; at: string | null }>
  research_file: boolean
  look: { recommended: { production: LookOption | null; experiment: LookOption | null; script: LookOption | null; why: string | null }
    options: LookOption[]; picked: { production: string; experiment: string | null; inspiration: string[]; at: string } | null }
  inspiration: { cards: Array<{ id: string; name: string; words: string; saved: string | null }>; unread: number }
  prompts: { research: string; story: string; storyboard: string; mock: string }
  storyboard: { title: string; at: string | null } | null
}
export interface Day {
  day: string; date: string; label: string; kind: string; series: string; title: string; piece_id: string | null
  stop: number; who: Who; next: string; runs_on: string; actions: Action[]; run?: Run
  detail: Array<{ h: string; p: string }>; reviews?: Review[]; path?: DayPath
}
export interface View {
  ok: true; week: string; as_of: string; days: Day[]
  yours: Array<{ key: string; day: string; label: string; next: string; actions: Action[]; review?: Review }>
  moved: Array<{ at: string; text: string }>; north_star: { current: number; target: number } | null
}

export class BoardError extends Error { constructor(public status: number, message: string) { super(message) } }

export const week = (location.pathname.match(/\d{4}-\d{2}-\d{2}/) || [''])[0]

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers || {}) } })
  const body = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; reason?: string }
  if (!r.ok || body.ok === false) throw new BoardError(r.status, body.error || body.reason || `error ${r.status}`)
  return body as T
}
// The archive writes nothing (Ruling, Krish, 2026-11-11: one live board, in Control Centre; the old board is a read-only
// archive). Every press is made on the live board; the server refuses a write from this page too (_handler.ts).
const readOnly = <T,>(): Promise<T> => Promise.reject(new BoardError(423, 'archive_read_only'))
const post = <T,>(_op: string, _payload: unknown) => readOnly<T>()

export const api = {
  view: () => call<View>(`/api/board/${week}/view`),
  weeks: () => call<{ weeks: string[] }>('/api/board/weeks'),
  run: (job: string, input: Record<string, unknown>) => post<{ sent: boolean; workflow: string }>('run', { job, input }),
  research: (piece_id: string) => post<{ material: { title: string; bytes: number }; sources: number }>('research', { piece_id }),
  material: (piece_id: string, title: string, content: string, role?: 'storyboard') => post<{ material: { title: string; bytes: number } }>('material', { piece_id, title, content, ...(role ? { role } : {}) }),
  look: (piece_id: string, production: string, experiment: string | null, inspiration: string[]) => post<{ look: unknown }>('look', { piece_id, production, experiment, inspiration }),
  put: (_collection: string, _id: string, _body: unknown, _revision: number) => readOnly<{ revision: number }>(),
  /** His long-form words on a step are saved on the live board now. */
  feedback: (_day: string, _step: string, _text: string) => readOnly<unknown>(),
}

export function sayError(e: unknown): string {
  if (e instanceof BoardError) {
    if (e.status === 423) return 'This is the archive: do this on the live board in Control Centre.'
    if (e.status === 401) return 'Unlock the board again, then press it again. Nothing was lost.'
    if (e.status === 409) return 'This changed elsewhere. The page has reloaded it; press again.'
    if (e.message === 'not_configured') return 'The board has no GitHub key to start it. Nothing was sent.'
    if (e.message === 'research_failed') return 'Research did not come back. Press again, or copy the Perplexity prompt.'
    if (e.message === 'research_just_ran') return 'Research ran on this piece in the last ten minutes. It is in the list above.'
    if (e.message === 'styles_unavailable') return 'The looks could not be read just now. Press again in a moment.'
    return `Not done (${e.message}). Press again.`
  }
  return 'The board could not be reached. Press again.'
}
