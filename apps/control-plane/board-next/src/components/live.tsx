// The archive is read-only (Ruling, Krish, 2026-11-11: one live board, in Control Centre; the old board is a read-only
// archive). Every press this page used to make is this link instead: the same week and day on the live board.
import * as React from 'react'
import { week } from '../api'
import { liveBoardUrl } from '../../../api/board/_liveBoard'
import { cx } from './ui'

export const LIVE_PRESS = 'Do this on the live board'

export function LiveLink({ day, primary = false, label = LIVE_PRESS }: { day?: string | null; primary?: boolean; label?: string }) {
  return (
    <a href={liveBoardUrl(week, day ?? null)} data-testid="live-press"
      className={cx('inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold',
        primary ? 'border-ink bg-ink text-bg' : 'border-line bg-card text-ink hover:bg-soft')}>
      {label}<span aria-hidden>↗</span>
    </a>
  )
}
