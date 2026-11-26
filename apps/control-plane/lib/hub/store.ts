import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { supabase } from '../../api/_supabase.js'
import { readCatalogue } from '../readCatalogue.js'
import { readSnapshot } from './snapshot.js'
import { type Snapshot, type Ticker, optional, isoDay, dayMs, mapLimit } from './types.js'
import { feeds, parseFeed, feedHealth, type Health } from './feeds.js'
import { readPage } from './articles.js'
import { buildMarkets, fetchMarkets, type Close } from './markets.js'

export async function latest() {
  // One indexed query normally. A malformed or future-format row never masks an older good edition.
  let before: string | null = null
  for (;;) {
    let query = supabase.from('hub_snapshots').select('edition_date,revision,payload').order('edition_date',{ ascending: false }).limit(1)
    if (before) query = query.lt('edition_date',before)
    const { data, error } = await query.maybeSingle()
    if (error) throw Error('snapshot_read_failed')
    if (!data) return null
    const snapshot = readSnapshot(data.payload)
    if (snapshot && snapshot.edition_date === data.edition_date) return { snapshot, revision: String(data.revision) }
    console.warn('hub invalid snapshot', data.edition_date)
    before = data.edition_date
  }
}

// One published edition by its date, for the site's dated edition pages. A malformed row is treated as missing.
export async function byDate(date: string) {
  const { data, error } = await supabase.from('hub_snapshots').select('edition_date,payload').eq('edition_date',date).maybeSingle()
  if (error) throw Error('snapshot_read_failed')
  if (!data) return null
  const snapshot = readSnapshot(data.payload)
  return snapshot && snapshot.edition_date === date ? snapshot : null
}

// Every published edition date, newest first, for the site's archive and sitemap.
export async function editionDates(limit = 400) {
  const { data, error } = await supabase.from('hub_snapshots').select('edition_date').order('edition_date',{ ascending: false }).limit(limit)
  if (error) throw Error('snapshot_read_failed')
  return (data ?? []).map(row => String(row.edition_date))
}

export async function discover(now: number) {
  const today = isoDay(now)
  const { data, error } = await supabase.from('hub_feed_health').select('*')
  if (error) console.warn('hub feed history unavailable')
  const health = new Map((data || []).map((h: Health) => [h.url,h]))
  const batches = await mapLimit(feeds,5, async feed => {
    const prior = health.get(feed.url)
    if (prior?.retry_on && prior.retry_on > today) { console.info('hub feed resting',feed.url,prior.retry_on); return [] }
    const rows = await optional('feed ' + feed.url, [], async () => parseFeed((await readPage(feed.url)).body,feed,now))
    if (!error) {
      const next = feedHealth(feed.url,today,!!rows.length,prior)
      if (next.retry_on) console.warn('hub feed suspended',feed.url,next.retry_on)
      const saved = await supabase.from('hub_feed_health').upsert(next)
      if (saved.error) console.warn('hub feed health write failed',feed.url)
    }
    return rows
  })
  return batches.flat()
}

export async function markets(now: number, prior?: Ticker) {
  const [charts, history] = await Promise.all([fetchMarkets(now),
    supabase.from('hub_price_closes').select('symbol,day,price,currency').gte('day',isoDay(now - 39 * dayMs)).lte('day',isoDay(now)).order('day').limit(1000)])
  if (history.error) console.warn('hub close history unavailable')
  const fresh = Object.values(charts).flatMap(chart => chart?.closes ?? [])
  if (fresh.length) {
    const saved = await supabase.from('hub_price_closes').upsert(fresh,{ onConflict: 'day,symbol' })
    if (saved.error) console.warn('hub close history write failed')
  }
  const result = buildMarkets(now, (history.data || []) as Close[],charts,prior)
  return { ...result, fresh: Object.values(charts).some(Boolean) }
}
export async function pieces() { return (await readCatalogue(3)).entries }

export async function save(snapshot: Snapshot, revision?: string) {
  const checked = readSnapshot(snapshot)
  if (!checked) throw Error('invalid_snapshot')
  const row = { edition_date: snapshot.edition_date, payload: checked, revision: randomUUID() }
  const write = revision ? supabase.from('hub_snapshots').update(row).eq('edition_date',row.edition_date).eq('revision',revision)
    : supabase.from('hub_snapshots').insert(row)
  const { data,error } = await write.select('revision,payload').single()
  if (error || data?.revision !== row.revision || !isDeepStrictEqual(readSnapshot(data.payload),checked)) throw Error('snapshot_write_failed')
}
