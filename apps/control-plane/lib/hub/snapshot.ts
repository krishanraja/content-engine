import { z } from 'zod'
import { sectors, stocks, type Snapshot } from './types.js'

const number = z.number().nullable()
const index = z.object({ day_pct: number, month_pct: number, series: z.array(z.number()) })
const video = z.object({ id: z.string(), url: z.url(), posted_at: z.string().nullable() }).nullable()
const image = z.object({ kind: z.enum(['person','company','generated']).nullable(), url: z.url().nullable(),
  credit: z.string().optional(), file_page: z.url().optional(), brief: z.string().optional() }).refine(photo => {
    if (photo.kind === null) return photo.url === null
    if (photo.kind === 'generated') return !!(photo.url || photo.brief)
    return !!photo.credit?.trim() && !!photo.file_page?.startsWith('https://commons.wikimedia.org/wiki/File:') &&
      !!photo.url?.startsWith('https://upload.wikimedia.org/wikipedia/commons/')
  })
const sector = z.string().refine(s => sectors.some(row => row.key === s))
const shape = z.object({
  ok: z.literal(true), version: z.literal(1), generated_at: z.iso.datetime(), edition_date: z.iso.date(),
  subsectors: z.array(z.object({ key: sector, label: z.string(), line: z.string(), story_count: z.int().nonnegative(), index })).length(6),
  items: z.array(z.object({ id: z.string().min(1), subsector: sector, date: z.iso.date(), source: z.string().min(1), url: z.url(),
    headline: z.string().min(1), dek: z.string().min(1), why: z.string().min(1), companies: z.array(z.string()),
    tickers: z.array(z.string()), coverage: z.int().positive(), image })).min(8).max(12),
  ticker: z.object({ as_of: z.string().nullable(), index: index.extend({ name: z.literal('Creative 24') }),
    stocks: z.record(z.string(),z.object({ name: z.string(), subsector: sector, price: number, currency: z.string().nullable(),
      day_pct: number, month_pct: number, spark: z.array(z.number()), spark_dates: z.array(z.iso.date()).optional(),
      as_of: z.string().nullable(), missing: z.boolean() })) }),
  attention: z.array(z.object({ name: z.string(), wiki_title: z.string(), views_today: z.int().nonnegative(),
    avg_30d: z.number().nonnegative(), spiking: z.boolean(), as_of: z.iso.date() })),
  pieces: z.array(z.object({ piece_id: z.string(), title: z.string(), series: z.string().nullable(), published_at: z.string(),
    article_url: z.url().nullable(), video, short: video })).max(3),
})
export function readSnapshot(payload: unknown): Snapshot | null {
  const result = shape.safeParse(payload)
  if (!result.success) return null
  const s = result.data
  if (new Set(s.items.map(item => item.id)).size !== s.items.length || sectors.some(({key}) =>
    s.subsectors.find(r => r.key === key)?.story_count !== s.items.filter(i => i.subsector === key).length) ||
    Object.keys(stocks).some(symbol => !Object.hasOwn(s.ticker.stocks, symbol))) return null
  return s as Snapshot
}
