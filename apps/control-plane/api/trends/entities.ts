import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { withContentRun } from '../_runs.js'
import { matchEntities, type Entity } from './_entities.js'

// Tag observations with the entities they mention.
//
// The nine lanes are a taxonomy of SUBJECTS: model, economics, governance and
// so on. They answer "is agentic orchestration rising" and they cannot answer
// "how is Anthropic's share of coverage moving against OpenAI", because until
// trend_entities there was no company, lab, model or person anywhere in the
// system. Every interesting competitive question is about things that act, and
// the taxonomy has no room for one.
//
// This is the cheap extractor and it is deliberately the first one: curated
// aliases, word-boundary matched, no model call, no API key, fully
// deterministic and reproducible. It will miss a lab nobody has added to the
// registry yet, and that miss is visible and fixable by adding a row, which is
// a far better failure than an LLM quietly inventing an entity or tagging the
// same company three ways.
//
// It writes to trend_observation_entities with extractor='alias'. That table
// is append only and keyed on (observation, entity, extractor), so a smarter
// extractor added later writes ALONGSIDE this one rather than over it, and the
// two stay comparable. Re-running this job is free.
//
//   GET (CRON_SECRET) — daily 02:00 UTC   ·   POST — manual backfill

const LOOKBACK_DAYS = 7
const MAX_OBSERVATIONS = 5000

async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (guardCronRoute(req, res)) return

  try {
    const { data: entityRows, error: entErr } = await supabase
      .from('trend_entities')
      .select('slug, aliases')
    if (entErr) throw new Error(entErr.message)
    const entities: Entity[] = (entityRows || []).map(r => ({
      slug: r.slug as string,
      aliases: Array.isArray(r.aliases) ? (r.aliases as string[]) : [],
    }))
    // An empty registry means the seed never landed. Tagging nothing and
    // reporting success would leave the series permanently, silently empty.
    if (entities.length === 0) {
      return res.status(500).json({ ok: false, error: 'trend_entities is empty: nothing can be tagged' })
    }

    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)
    const { data: observations, error: obsErr } = await supabase
      .from('trend_observations')
      .select('id, title, snippet')
      .gte('observed_on', since)
      .order('id', { ascending: true })
      .limit(MAX_OBSERVATIONS)
    if (obsErr) throw new Error(obsErr.message)
    if (!observations?.length) return res.json({ ok: true, scanned: 0, tagged: 0, already: 0 })

    // Already-tagged ids in this window. The id column is ascending, so one
    // bounded range query answers it without a NOT EXISTS PostgREST cannot
    // express and without paging the whole join table.
    const minId = observations[0].id as number
    const { data: existing, error: exErr } = await supabase
      .from('trend_observation_entities')
      .select('observation_id')
      .eq('extractor', 'alias')
      .gte('observation_id', minId)
    if (exErr) throw new Error(exErr.message)
    const done = new Set((existing || []).map(r => r.observation_id as number))

    const rows: Array<Record<string, unknown>> = []
    let scanned = 0
    for (const o of observations) {
      if (done.has(o.id as number)) continue
      scanned++
      const text = `${o.title ?? ''} ${o.snippet ?? ''}`
      for (const hit of matchEntities(text, entities)) {
        rows.push({
          observation_id: o.id,
          entity_slug: hit.slug,
          extractor: 'alias',
          confidence: 1,
          matched_on: hit.matchedOn,
        })
      }
    }

    let tagged = 0
    for (let i = 0; i < rows.length; i += 500) {
      const { error, count } = await supabase
        .from('trend_observation_entities')
        .upsert(rows.slice(i, i + 500), {
          onConflict: 'observation_id,entity_slug,extractor',
          ignoreDuplicates: true,
          count: 'exact',
        })
      if (error) throw new Error(error.message)
      tagged += count ?? 0
    }

    return res.json({
      ok: true,
      entities: entities.length,
      scanned,
      already: observations.length - scanned,
      tagged,
    })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}

export default withContentRun('trend_entities', handler)
