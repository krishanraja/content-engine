import { z } from 'zod'

// The Studio's series.
//
// money_of_ai and built_with_ai were the Studio's names for its two series
// before the publication settled its three subchannels on 2026-09-25; they
// became follow.the.money and under.the.hood. They stay valid for good: they
// sit inside hashed and signed records (briefs, jobs, projections, render
// manifests) that are re-parsed strictly, so dropping or rewriting them would
// break every record made under them. New briefs carry the live names
// (Krish, 2026-09-26: teach the video side the three names).
export const RETIRED_SERIES_IDS = ['money_of_ai', 'built_with_ai'] as const
export const LIVE_SERIES_IDS = ['follow_the_money', 'mind_the_gap', 'under_the_hood'] as const
export const SERIES_IDS = [...RETIRED_SERIES_IDS, ...LIVE_SERIES_IDS] as const

export const StudioSeriesSchema = z.enum(SERIES_IDS)
export type StudioSeries = z.infer<typeof StudioSeriesSchema>
export type LiveSeries = typeof LIVE_SERIES_IDS[number]

/** The live subchannel each series belongs to: a retired id is the past name
 *  of the subchannel it became. */
export const SERIES_LINE: Readonly<Record<StudioSeries, LiveSeries>> = Object.freeze({
  money_of_ai: 'follow_the_money',
  built_with_ai: 'under_the_hood',
  follow_the_money: 'follow_the_money',
  mind_the_gap: 'mind_the_gap',
  under_the_hood: 'under_the_hood',
})

export function isStudioSeries(value: unknown): value is StudioSeries {
  return typeof value === 'string' && (SERIES_IDS as readonly string[]).includes(value)
}

export function isLiveSeries(value: unknown): value is LiveSeries {
  return typeof value === 'string' && (LIVE_SERIES_IDS as readonly string[]).includes(value)
}

/** True when two series ids name the same subchannel, so a rule, preset or
 *  device approved for money_of_ai also serves follow_the_money. Old jobs keep
 *  exactly the matches they had: each retired id still matches only itself and
 *  its successor. */
export function sameSeriesLine(a: unknown, b: unknown): boolean {
  return isStudioSeries(a) && isStudioSeries(b) && SERIES_LINE[a] === SERIES_LINE[b]
}

/** An eligibility list written when the Studio had only its two series and
 *  listed both meant "every series"; it serves all three subchannels. A list
 *  naming one retired id serves that id's subchannel. */
export function seriesEligible(list: readonly string[], series: StudioSeries): boolean {
  if (list.includes(series)) return true
  if (RETIRED_SERIES_IDS.every((id) => list.includes(id))) return true
  return list.some((entry) => sameSeriesLine(entry, series))
}
