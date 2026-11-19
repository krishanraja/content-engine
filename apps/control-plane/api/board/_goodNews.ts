// Saturday is good-news carousels only (Krish, 2026-11-19, of Sat 28's ideas board: "These are still all just one idea,
// mostly, and they're not good news carousels. Some of them are memes that are sneaking through"). The ideas board holds
// a Saturday option that is not one, with the reason, so it is never offered as Saturday's; the Sunday run's gate
// (scripts/post-pack/idea_checks.py goodnews_findings) refuses it before it is written. One config: config/good-news.json.
import goodNews from '../../../../config/good-news.json' with { type: 'json' }

type Body = Record<string, unknown>
export const GOOD_NEWS_FROM: string = (goodNews as { from: string }).from

/** Whether an option is a good-news carousel: kind good_news, the weekly series, or a format that says so (never a meme). */
export function isGoodNews(o: Body): boolean {
  if (o.kind === 'good_news' || o.weekly === 'good_news') return true
  const fmt = String(o.format ?? '').toLowerCase()
  return /uplifting|good[- ]news/.test(fmt) && !/\bmeme/.test(fmt)
}

/** Why a Saturday option is held on the ideas board, or null when it may be offered. An option he approved is never held
 *  here: his press stands. */
export function saturdayHold(week: string, day: string, o: Body, approved: boolean): string | null {
  if (day !== 'sat' || week < GOOD_NEWS_FROM || approved || isGoodNews(o)) return null
  return 'Saturday offers only good-news carousels (Krish, 19 Nov), so this is not offered for Saturday. Move it to Tuesday or Thursday if you want it.'
}
