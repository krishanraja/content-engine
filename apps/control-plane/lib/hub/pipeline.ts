import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardOperatorOrCron } from '../../api/_auth.js'
import { supabase } from '../../api/_supabase.js'
import { readSnapshot } from './snapshot.js'
import { latest, discover, markets, pieces, save } from './store.js'
import { writeEdition } from './editorial.js'
import { announceEdition } from './announce.js'
import { buildMarkets } from './markets.js'
import { chooseImage, wikiClient } from './wiki.js'
import { isoDay, sectors, optional, type Attention, type Snapshot } from './types.js'

type Mode = 'daily' | 'prices'

export async function refresh(mode: Mode, now: number) {
  const date = isoDay(now)
  const stored = await latest()
  const previous = stored?.snapshot
  if (mode === 'daily' && previous?.edition_date === date) return { skipped: 'already published' }
  if (mode === 'prices' && !previous) throw Error('edition_missing')
  const claim = await supabase.rpc('hub_claim_run',{ run_day: date, run_mode: mode })
  if (claim.error) throw Error('lease_unavailable')
  if (!claim.data) {
    const state = await supabase.from('hub_runs').select('complete,attempts,lease_until').eq('day',date).eq('mode',mode).single()
    if (state.error || (!state.data.complete && Date.parse(state.data.lease_until) <= now)) throw Error('attempts_exhausted')
    return { skipped: state.data.complete ? 'already complete' : 'run in progress' }
  }

  const readMarket = () => optional('market stage',null,() => markets(now,previous?.ticker))
  const generated_at = new Date(now).toISOString()
  let snapshot: Snapshot
  if (mode === 'prices') {
    const market = await readMarket()
    if (!market?.fresh) throw Error('prices_unavailable')
    snapshot = { ...previous, generated_at, ticker: market.ticker,
      subsectors: previous.subsectors.map(s => ({ ...s, index: market.indexes[s.key] })) }
  } else {
    const [market, catalogue, drafts] = await Promise.all([
      readMarket(), optional('catalogue',previous?.pieces || [],pieces),
      optional('editorial stage',[],() => discover(now).then(writeEdition)),
    ])
    if (drafts.length < 8) throw Error('insufficient_verified_stories')
    const wiki = wikiClient(now + 580_000)
    const items = await Promise.all(drafts.map(async (d,i) => ({ ...d.item, image: await chooseImage(d,i,wiki.image) })))
    const entities = new Map(drafts.flatMap(d => [...d.people,...d.organisations]).map(e => [e.wiki_title.replace(/_/g,' ').toLowerCase(),e]))
    const attention: Attention[] = []
    for (const entity of entities.values()) {
      const current = await optional('pageviews ' + entity.wiki_title,null,() => wiki.attention(entity,now))
      const entry = current || previous?.attention.find(a => a.wiki_title === entity.wiki_title)
      if (entry) attention.push(entry)
      else console.warn('hub pageviews missing',entity.wiki_title)
    }
    const fallback = buildMarkets(now,[],{})
    snapshot = { ok: true, version: 1, generated_at, edition_date: date, items, attention, pieces: catalogue,
      ticker: market?.ticker ?? previous?.ticker ?? fallback.ticker,
      subsectors: sectors.map(({ key,label,line }) => ({ key,label,line,story_count: items.filter(i => i.subsector === key).length,
        index: market?.indexes[key] ?? previous?.subsectors.find(s => s.key === key)?.index ?? fallback.indexes[key] })) }
  }

  if (!readSnapshot(snapshot)) throw Error('invalid_snapshot')
  await save(snapshot,mode === 'prices' ? stored.revision : undefined)
  const finished = await supabase.from('hub_runs').update({ complete: true }).eq('day',date).eq('mode',mode)
  if (finished.error) throw Error('run_record_failed')
  const summary = { edition_date: snapshot.edition_date, items: snapshot.items.length, stocks: Object.keys(snapshot.ticker.stocks).length }
  return mode === 'daily' ? { ...summary, indexnow: await announceEdition() } : summary
}

export function cron(mode: Mode) {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (guardOperatorOrCron(req,res,['GET'])) return
    try { return res.status(200).json({ ok: true, ...await refresh(mode,Date.now()) }) }
    catch (err) {
      const reason = err instanceof Error && /^[a-z_]+$/.test(err.message) ? err.message : 'hub_stage_failed'
      console.error('hub',mode,reason)
      return res.status(503).json({ ok: false, error: reason })
    }
  }
}
