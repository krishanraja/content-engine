// Where the live Publish Board is (Ruling, Krish, 2026-11-11: "your version of the publish board is 1000% where
// everything wires in to fresh and live and accurately"). Control Centre draws the week from GET /api/board/<Monday>/view
// and presses through this engine's routes; content.krishraja.com/board/<Monday> is kept as the archive.
//
// One constant: config/boards.json `live_board.url` holds the same text and tests/control-plane/board-view-contract.test.ts
// holds the two equal. Python reads it through scripts/post-pack/live_board.py. Dropping `?ui=next` after Control
// Centre's cutover is a one-line change here and there.
//
// Pure, no Node import: the archive page (apps/control-plane/board-next) bundles it for its banner.

export const LIVE_BOARD_URL = 'https://controlcenter.krishraja.com/?ui=next#/content'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** The live board at a week and, when given, a day (mon to sat): the link every message to Krish carries. */
export function liveBoardUrl(week?: string | null, day?: string | null): string {
  const q: string[] = []
  if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) q.push(`week=${week}`)
  const d = day ? day.toLowerCase().slice(0, 3) : ''
  if ((DAYS as readonly string[]).includes(d)) q.push(`day=${d}`)
  return q.length ? `${LIVE_BOARD_URL}?${q.join('&')}` : LIVE_BOARD_URL
}

/** The banner the archive carries, in his words. */
export const ARCHIVE_LINE = 'This is the archive. The live Publish Board is in Control Centre'
