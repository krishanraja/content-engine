import { supabase } from './_supabase.js'
import { toObservationRow, type ObservationInput } from './_observation-shape.js'

// The writer for the permanent observation record. The identity rules and row
// shaping are in _observation-shape.ts, which is pure and carries the reasoning
// for all of this; this file is only the part that talks to the database.

export type {
  ObservationInput,
  ObservationOrigin,
  DropReason,
} from './_observation-shape.js'
export {
  sha256,
  normalizeUrl,
  hostOf,
  contentHash,
  todayUtc,
  toObservationRow,
} from './_observation-shape.js'

export interface RecordResult {
  ok: boolean
  attempted: number
  written: number
  reason?: string
}

const CHUNK = 500

/**
 * Write observations. Best effort by design: this is a record keeper sitting
 * beside the job that actually has to produce something, and a failure to
 * archive must never stop the feed from running or the purge from tidying.
 * The count comes back so the caller can put it in its response and therefore
 * in content_engine_runs, which is where a quietly failing writer shows up.
 *
 * The upsert is an ON CONFLICT DO NOTHING against trend_observations_identity,
 * never an update: re-running today's ingest writes nothing new, and a
 * genuinely changed headline writes a fresh row. Nothing already recorded is
 * touched, which the table's trigger would refuse anyway.
 */
export async function recordObservations(inputs: ObservationInput[]): Promise<RecordResult> {
  if (!inputs.length) return { ok: true, attempted: 0, written: 0 }

  // Collapse within the batch first. Two sources handing us the same story in
  // one run would otherwise make Postgres reject the whole chunk, because a
  // single INSERT cannot resolve a conflict against a row in its own payload.
  const seen = new Set<string>()
  const rows: Record<string, unknown>[] = []
  for (const input of inputs) {
    const row = toObservationRow(input)
    const key = `${row.origin}|${row.observed_on}|${row.url_hash ?? ''}|${row.content_hash}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(row)
  }

  let written = 0
  try {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const { error, count } = await supabase
        .from('trend_observations')
        .upsert(chunk, {
          onConflict: 'origin,observed_on,url_hash,content_hash',
          ignoreDuplicates: true,
          count: 'exact',
        })
      if (error) return { ok: false, attempted: rows.length, written, reason: error.message.slice(0, 200) }
      written += count ?? 0
    }
    return { ok: true, attempted: rows.length, written }
  } catch (e) {
    return { ok: false, attempted: rows.length, written, reason: (e as Error)?.message?.slice(0, 200) || 'insert threw' }
  }
}
