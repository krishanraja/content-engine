import { supabase } from './_supabase.js'
import { madeWithRecord, makingSteps, type MakingStep } from './_making.js'

// Board items close themselves when the piece they are about moves on.
//
// Krish, 2026-10-11: "we still have things on my control center board from
// Wednesday that should really be chalked off automatically when we are done
// with a publish flow, how can that happen?"
//
// An item is tied to a piece by work_board_items.idea_id, or, for items
// written before that column existed, by a link to the piece
// (#/content?idea=<uuid>). It closes when:
//   - the piece's publish step is done     -> done
//     (the standing five are ticked: Substack, YouTube, Shorts, TikTok and
//     Instagram; Krish, 2026-10-11. The Substack post alone, which is what
//     sets state 'published', leaves the reposts and their items open.)
//   - the piece is published and was not made with the making record
//     (made before it existed, so nothing ticks its channels; a record
//     holding only the watcher's Substack tick does not count) -> done
//   - its closes_on is 'published' and the Substack post is live -> done
//   - the piece is dropped or buried       -> archived
//   - its closes_on step is done           -> done
// Callers: the making route after every write, and the publish watcher's
// hourly pass (publish/watch.ts), which also catches a piece published any
// other way. A close never fails the write that triggered it.
//
// A question an engine tool holds for a session has no piece to close it: a
// take the recordings lane could not tie to a piece (take-<sha12>) and a post
// the publish watcher could not match (post-<id>). Their tools end them when
// the question goes away (the take is placed, the post matches a piece); one
// no session has touched for HELD_DAYS is let go by the hourly pass
// (heldToLetGo), so nothing sits in progress with no one on it
// (WORKBENCH.md: "Never leave an in_progress item behind you").

export const CLOSE_STEPS = ['workroom', 'draft', 'visual_gate', 'scripts', 'pack', 'record', 'video', 'publish', 'published'] as const

export interface OpenItem { id: string; lane: string; idea_id: string | null; closes_on: string | null; link: string | null }
/** How long a question held for a session waits for one before it is let go. */
export const HELD_DAYS = 7
/** Who lets it go, in updated_by and closed_by. */
export const LET_GO_BY = 'engine: no session took it'
const HELD_QUESTION = /^(take|post)-/
export interface PieceRow { id: string; state?: string | null; buried_at?: string | null; meta?: Record<string, any> | null }
export interface Close { id: string; lane: 'done' | 'archived'; by: string }

const UUID_IN_LINK = /[?&]idea=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

/** The piece an item is about: its column, else the piece its link opens. */
export function itemPiece(item: Pick<OpenItem, 'idea_id' | 'link'>): string | null {
  if (item.idea_id) return item.idea_id
  const m = UUID_IN_LINK.exec(item.link || '')
  return m ? m[1].toLowerCase() : null
}

/** Which of these open items the piece's current state closes, and how. */
export function itemsToClose(items: readonly OpenItem[], piece: PieceRow, steps: MakingStep[] = makingSteps(piece)): Close[] {
  const out: Close[] = []
  const published = piece.state === 'published'
  const hasRecord = madeWithRecord(piece.meta)
  const gone = piece.state === 'dropped' || Boolean(piece.buried_at)
  const done = new Set(steps.filter(s => s.state === 'done').map(s => s.key))
  const finished = done.has('publish') || (published && !hasRecord)
  for (const item of items) {
    if (item.lane !== 'on_you' && item.lane !== 'in_progress') continue
    if (itemPiece(item) !== piece.id) continue
    if (finished) { out.push({ id: item.id, lane: 'done', by: 'engine: piece published' }); continue }
    if (gone) { out.push({ id: item.id, lane: 'archived', by: 'engine: piece dropped' }); continue }
    if (published && item.closes_on === 'published') { out.push({ id: item.id, lane: 'done', by: 'engine: piece published' }); continue }
    // A take question tied to a piece ends when the piece's takes are in,
    // as it did before it said take_placed, until the done-check sweep's
    // take_placed check takes it over (step 4, part C).
    const step = item.closes_on === 'take_placed' ? 'record' : item.closes_on
    if (step && step !== 'published' && done.has(step)) {
      out.push({ id: item.id, lane: 'done', by: `engine: ${step} done`.slice(0, 40) })
    }
  }
  return out
}

/** The questions held for a session, with no piece, that no one has touched
 *  for HELD_DAYS: their ids, to archive. */
export function heldToLetGo(items: ReadonlyArray<OpenItem & { updated_at: string }>, now: Date): string[] {
  const before = now.getTime() - HELD_DAYS * 86_400_000
  return items
    .filter(i => i.lane === 'in_progress' && HELD_QUESTION.test(i.id) && !itemPiece(i) && Date.parse(i.updated_at) < before)
    .map(i => i.id)
}

/** Reads the open items tied to this piece and closes the ones its state closes. Returns their ids. */
export async function closeBoardItemsForPiece(piece: PieceRow): Promise<string[]> {
  try {
    const [byColumn, byLink] = await Promise.all([
      supabase.from('work_board_items').select('id,lane,idea_id,closes_on,link').eq('idea_id', piece.id).in('lane', ['on_you', 'in_progress']),
      supabase.from('work_board_items').select('id,lane,idea_id,closes_on,link').is('idea_id', null).ilike('link', `%idea=${piece.id}%`).in('lane', ['on_you', 'in_progress']),
    ])
    const items = [...((byColumn.data || []) as OpenItem[]), ...((byLink.data || []) as OpenItem[])]
    const closes = itemsToClose(items, piece)
    const now = new Date().toISOString()
    const closed: string[] = []
    for (const c of closes) {
      const { error } = await supabase.from('work_board_items').update({ lane: c.lane, updated_by: c.by, closed_by: c.by, updated_at: now }).eq('id', c.id).in('lane', ['on_you', 'in_progress'])
      if (!error) closed.push(c.id)
    }
    return closed
  } catch {
    return []
  }
}
