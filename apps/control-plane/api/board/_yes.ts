// One yes anywhere (Ruling, Krish, 2026-11-02): his answer for each day, read from the board's picks. A day's answer is
// the latest by `at` of: his board yes (picks/yes-<day>-board, his login only), his typed yes carried from a session
// (picks/yes-<day>-words, his words verbatim with where, when and the session link), and his Approve for publish press
// (picks/<day>-publish, his login only). Growth's scheduler, the piece manifest and the board all read this one answer.
import { YES_ID } from './_contracts.js'

export type YesRow = { doc_id: string; body: unknown; updated_by?: string | null }
export type DayYes = { day: string; approved: boolean; at: string; via: 'board' | 'words' | 'publish_press'; words: string | null;
  said_where: string | null; session_ref: string | null }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const PUBLISH = /^(mon|wed|fri)-publish$/

export function yesByDay(rows: YesRow[]): Record<string, DayYes> {
  const out: Record<string, DayYes> = {}
  for (const row of rows) {
    const b = isObj(row.body) ? row.body : null
    if (!b || typeof b.at !== 'string' || !Number.isFinite(Date.parse(b.at))) continue
    let entry: DayYes | null = null
    const y = YES_ID.exec(row.doc_id)
    if (y && b.kind === 'yes' && b.day === y[1] && b.via === y[2]) {
      // A board yes counts only as his own press; a words yes only as his words.
      if (y[2] === 'board' && row.updated_by !== 'Krish') continue
      if (y[2] === 'words' && !(b.approved === true && typeof b.words === 'string' && b.words.trim())) continue
      entry = { day: y[1], approved: b.approved === true, at: b.at, via: y[2] as 'board' | 'words',
        words: typeof b.words === 'string' ? b.words : null, said_where: typeof b.said_where === 'string' ? b.said_where : null,
        session_ref: typeof b.session_ref === 'string' ? b.session_ref : null }
    }
    const p = PUBLISH.exec(row.doc_id)
    if (p && b.kind === 'approve_publish' && row.updated_by === 'Krish') {
      entry = { day: p[1], approved: b.approved === true, at: b.at, via: 'publish_press', words: null, said_where: null, session_ref: null }
    }
    if (entry && (!out[entry.day] || Date.parse(entry.at) > Date.parse(out[entry.day].at))) out[entry.day] = entry
  }
  return out
}
