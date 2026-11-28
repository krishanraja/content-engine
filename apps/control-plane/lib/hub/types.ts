import sources from '../../../../config/hub-sources.json' with { type: 'json' }
import universe from '../../../../config/hub-stocks.json' with { type: 'json' }
import type { CatalogueEntry } from '../../api/_publicationCatalogue.js'

export const sectors = sources.subsectors
export const stocks = universe
export const validSector = (key: unknown): key is string => sectors.some(s => s.key === key)
export const dayMs = 86_400_000
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const userAgent = 'MakeYourMindUpEdition/1.0 (+https://makeyourmindup.ai)'
export type Index = { day_pct: number | null; month_pct: number | null; series: number[] }
export type Stock = { name: string; subsector: string; price: number | null; currency: string | null;
  day_pct: number | null; month_pct: number | null; spark: number[]; spark_dates?: string[]; as_of: string | null; missing: boolean }
export type Ticker = { as_of: string | null; index: Index & { name: 'Creative 24' }; stocks: Record<string, Stock> }
export type Image = { kind: 'person' | 'company' | 'generated' | null; url: string | null; credit?: string; file_page?: string; brief?: string }
export type Entity = { name: string; wiki_title: string }
export type Story = { id: string; subsector: string; date: string; source: string; url: string;
  headline: string; dek: string; why: string; companies: string[]; tickers: string[]; coverage: number; image: Image }
export type Draft = { item: Story; people: Entity[]; organisations: Entity[]; accusation: boolean; subject: string }
export type Attention = Entity & { views_today: number; avg_30d: number; spiking: boolean; as_of: string }
export type Snapshot = { ok: true; version: 1; generated_at: string; edition_date: string;
  subsectors: { key: string; label: string; line: string; story_count: number; index: Index }[];
  items: Story[]; ticker: Ticker; attention: Attention[]; pieces: CatalogueEntry[] }

export async function mapLimit<T, U>(rows: T[], limit: number, fn: (row: T) => Promise<U>): Promise<U[]> {
  const output: U[] = []
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, async () => {
    while (next < rows.length) {
      const i = next++
      output[i] = await fn(rows[i])
    }
  }))
  return output
}
// A stage that fails falls back, except for the reasons named in `keep`: those are a decision (the week's budget is spent),
// never a hiccup, and they reach the run's own error so the cron's 503 says why no edition came (27 Nov 2026: the
// editorial stage's budget refusal was read as "no stories" for every run, and the site showed its frozen snapshot).
export async function optional<T>(stage: string, fallback: T, read: () => Promise<T>, keep: readonly string[] = []): Promise<T> {
  try { return await read() } catch (err) {
    if (err instanceof Error && keep.includes(err.message)) throw err
    console.warn('hub unavailable:', stage)
    return fallback
  }
}
