import type { Approval } from '../../apps/control-plane/api/board/_gate'
import { dayDate, SERIES_DAYS, type PostedDay } from '../../apps/control-plane/api/board/_posted'

// Approvals for test weeks (the ideas gate, docs/PUBLISH_BOARDS.md): a view is built only with the approvals that stand,
// so a fixture whose pieces stand for pieces he approved says so here. A test of the gate itself builds its own.

type Body = Record<string, unknown>
const DAYS: PostedDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** His Approve on one piece for one day, as board_approvals_now returns it. */
export function approval(week: string, day: PostedDay, ideaId: string, extra: Partial<Approval> = {}): Approval {
  const series = SERIES_DAYS.includes(day)
  return {
    idea_id: ideaId.toLowerCase(), day, date: dayDate(week, day), via: series ? 'pick' : 'offday',
    doc: series ? `picks/${day}` : `queue/off-${day}-${ideaId}`, option_ref: series ? `${day}-1` : `off-${day}-${ideaId}`, revision: 1,
    decided_at: '2026-11-08T14:07:00Z', option_sha256: null, words: null, source: 'publish_board', ...extra,
  }
}

/** An approval for every piece scheduled in the week: the pieces of a fixture that stand for pieces he approved. */
export function approvedAll(week: string, pieces: Body[]): Approval[] {
  return pieces.flatMap(p => {
    const day = DAYS.find(d => dayDate(week, d) === String(p.scheduled_for || '').slice(0, 10))
    return day && typeof p.id === 'string' ? [approval(week, day, p.id)] : []
  })
}

/** The inputs with approvals for every piece, unless the inputs name their own. */
export function withApprovals<T extends { week: string; pieces: Body[]; approvals?: Approval[] | null }>(i: T): T & { approvals: Approval[] | null } {
  return { ...i, approvals: i.approvals === undefined ? approvedAll(i.week, i.pieces) : i.approvals }
}
