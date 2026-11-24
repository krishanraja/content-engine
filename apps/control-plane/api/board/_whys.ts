import { NO_WHY_LADDER, WHY_STRENGTHS, checkWhyLadder, parseWhyLadder, type WhyLadder, type WhyStrength } from '../../../../packages/contracts/src/whys.js'
import { patchMeta, type StoreDb } from '../_pieceStore.js'

// The piece's why-ladder, read from its research (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid
// of everything that suggests predictions, calls, dated, odds or scores). The research prompt (_researchPrompt.ts) asks
// for a fenced why-ladder block right after the piece_id line. When he presses Paste research, or Research it now
// files the engine's answer (_research.ts fileMaterial), the block is read and checked rung by rung here and kept on
// the piece as meta.whys = { ladder, problems, checked_at } beside the Markdown material. A rung that falls short is
// kept and shown as a problem ("Why 3 needs a second source"), never dropped; research with no ladder is filed as
// Markdown exactly as before and leaves meta.whys alone. The read sheet shows it as read.whys (view contract 1.34.0).

/** One thing short on a ladder. source 'parse' marks what the parser said about the block itself (it would not read, a
 *  rung was malformed): parseWhyLadder normalises what it reads, so the stored ladder no longer shows that fault, and
 *  the WHY_LADDER publish check keeps these as filed. Problems with no source are checkWhyLadder's, rerun on the stored
 *  ladder whenever it is checked (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys). */
export interface WhysProblem { rung: number | null; problem: string; source?: 'parse' }
export interface PieceWhys {
  ladder: WhyLadder | null
  problems: WhysProblem[]
  checked_at: string
  /** The research material the ladder was read from. */
  material_id?: string
}

/** The ladder in a piece of research, checked: null when the research holds no why-ladder block at all. */
export function whysFromResearch(content: string, at: string, materialId?: string): PieceWhys | null {
  const parsed = parseWhyLadder(content)
  if (!parsed.ladder && parsed.problems.length === 1 && parsed.problems[0] === NO_WHY_LADDER) return null
  const problems: WhysProblem[] = [
    ...parsed.problems.map(problem => ({ rung: rungNamed(problem), problem, source: 'parse' as const })),
    ...(parsed.ladder ? checkWhyLadder(parsed.ladder) : []),
  ]
  return { ladder: parsed.ladder, problems, checked_at: at, ...(materialId ? { material_id: materialId } : {}) }
}

/** "Why 3: ..." or "Why 3 needs ..." names rung 3. */
function rungNamed(problem: string): number | null {
  const m = /^Why (\d+)\b/.exec(problem)
  return m ? Number(m[1]) : null
}

/** Keep the ladder on the piece (meta.whys), guarded like every meta write (patchMeta): a write landing in between is
 *  kept, never overwritten. Never throws: the research is already filed whatever happens here. */
export async function saveWhys(db: StoreDb, pieceId: string, whys: PieceWhys): Promise<boolean> {
  try {
    const saved = await patchMeta(db, pieceId, meta => ({ ...meta, whys }))
    return saved.ok
  } catch {
    // A piece gone missing (StoreError 404) or a store that will not answer: the ladder waits for the next filing.
    return false
  }
}

/** What the press answers about the ladder it read: how many Whys and every problem, in words. */
export function whysSummary(whys: PieceWhys, saved: boolean): { rungs: number; problems: string[]; saved: boolean } {
  return { rungs: whys.ladder?.rungs.length ?? 0, problems: whys.problems.map(p => p.problem), saved }
}

/** One Why as the read sheet shows it: ok, or what it still needs. */
export interface ModelWhyRung { n: number; question: string; strength: WhyStrength; status: 'ok' | 'needs_work'; problems: string[]; stop: string | null }
/** The piece's ladder on the read sheet (read.whys). */
export interface ModelWhys {
  question: string
  rungs: ModelWhyRung[]
  landing: { shows: string; open_question: string } | null
  /** What falls short on the ladder as a whole (its length, its landing, a block that would not read). */
  problems: string[]
  checked_at: string | null
}

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** The read sheet's ladder from a piece's meta, or null when it has none. Read defensively: meta.whys is stored data. */
export function whysView(meta: unknown): ModelWhys | null {
  const w = isObj(meta) && isObj(meta.whys) ? meta.whys : null
  if (!w) return null
  const ladder = isObj(w.ladder) ? w.ladder : null
  const problems = (Array.isArray(w.problems) ? w.problems : []).filter(isObj)
    .map(p => ({ rung: typeof p.rung === 'number' ? p.rung : rungNamed(text(p.problem)), problem: text(p.problem, 400) }))
    .filter(p => p.problem)
  const rungs: ModelWhyRung[] = (ladder && Array.isArray(ladder.rungs) ? ladder.rungs : []).filter(isObj).slice(0, 12).map((r, k) => {
    const n = typeof r.n === 'number' && Number.isInteger(r.n) ? r.n : k + 1
    const own = problems.filter(p => p.rung === n).map(p => p.problem)
    const strength = (WHY_STRENGTHS as readonly string[]).includes(text(r.strength)) ? text(r.strength) as WhyStrength : 'open'
    return { n, question: text(r.question, 400), strength, status: own.length ? 'needs_work' : 'ok', problems: own, stop: text(r.stop) || null }
  })
  const numbered = new Set(rungs.map(r => r.n))
  const landing = ladder && isObj(ladder.landing) ? { shows: text(ladder.landing.shows), open_question: text(ladder.landing.open_question) } : null
  if (!ladder && !problems.length) return null
  return {
    question: ladder ? text(ladder.question, 400) : '',
    rungs,
    landing,
    problems: problems.filter(p => p.rung === null || !numbered.has(p.rung)).map(p => p.problem),
    checked_at: typeof w.checked_at === 'string' ? w.checked_at : null,
  }
}
