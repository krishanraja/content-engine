// The failure loop's capture (Krish, 2026-11-04: "how can your system autonomously understand the difference between a
// repeated failure, why it happened, what was being done when the failure occurred and how it was being done"; then
// "yes, build part 1 and the weekly loop"). One engine_incidents row per thing that went wrong in production, written
// the moment it happened, with the preflight receipt the piece then held (meta.making.preflight: which standards the
// session read first, and their versions), so the weekly loop (scripts/learning/) can tell a repeat from a first and
// trace it to why it kept happening.
//
// Writers on the server: Krish's Reject asset, Reject proof and "None of these" styles presses (board/_presses.ts) and
// a second round (content-ideas/[id]/making.ts). Writers in Python go through POST /api/learning/incidents
// (scripts/incidents.py). A write never blocks the press or the record it rides on: a failure is logged and dropped.

import type { SupabaseClient } from '@supabase/supabase-js'

export const INCIDENT_STAGES = ['brief', 'script', 'storyboard', 'style', 'proof', 'cut', 'package', 'post', 'board', 'session'] as const
export const INCIDENT_MAKERS = ['claude', 'codex', 've', 'krish', 'unknown'] as const
export const INCIDENT_KINDS = ['krish_reject', 'critic_block', 'override', 'guard_fired', 'second_round'] as const
export type IncidentStage = (typeof INCIDENT_STAGES)[number]
export type IncidentMaker = (typeof INCIDENT_MAKERS)[number]
export type IncidentKind = (typeof INCIDENT_KINDS)[number]

export interface Incident {
  at?: string
  piece_id?: string | null
  piece_path?: string | null
  stage: IncidentStage
  maker?: IncidentMaker
  kind: IncidentKind
  session_ref?: string | null
  skill?: string | null
  artifact_ref?: string | null
  artifact_sha256?: string | null
  his_words?: string | null
  preflight?: unknown
  brief_score?: number | null
  floor_groups?: string[]
  failure_ids?: string[]
  meta?: Record<string, unknown>
  client_ref?: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA256 = /^[a-f0-9]{64}$/
const KEY = /^[A-Za-z0-9_.:-]{1,80}$/
const MAX_BATCH = 50

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function text(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return v as null | undefined
  return typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : undefined
}
function keys(v: unknown): string[] | undefined {
  if (v === undefined) return []
  if (!Array.isArray(v) || v.length > 40 || !v.every(x => typeof x === 'string' && KEY.test(x))) return undefined
  return [...new Set(v as string[])]
}

/** One incident as the table takes it, or the reasons it is refused. Only what the table holds is kept. */
export function parseIncident(v: unknown, now: string): { row?: Record<string, unknown>; problems: string[] } {
  const problems: string[] = []
  if (!isObj(v)) return { problems: ['an incident is an object'] }
  if (!(INCIDENT_STAGES as readonly string[]).includes(String(v.stage))) problems.push(`stage is one of ${INCIDENT_STAGES.join(', ')}`)
  if (!(INCIDENT_KINDS as readonly string[]).includes(String(v.kind))) problems.push(`kind is one of ${INCIDENT_KINDS.join(', ')}`)
  const maker = v.maker === undefined ? 'unknown' : String(v.maker)
  if (!(INCIDENT_MAKERS as readonly string[]).includes(maker)) problems.push(`maker is one of ${INCIDENT_MAKERS.join(', ')}`)
  const at = v.at === undefined ? now : typeof v.at === 'string' && !Number.isNaN(Date.parse(v.at)) ? v.at : null
  if (!at) problems.push('at is an ISO time')
  if (v.piece_id !== undefined && v.piece_id !== null && !(typeof v.piece_id === 'string' && UUID.test(v.piece_id))) problems.push('piece_id is the content_ideas uuid')
  if (v.artifact_sha256 !== undefined && v.artifact_sha256 !== null && !(typeof v.artifact_sha256 === 'string' && SHA256.test(v.artifact_sha256))) problems.push('artifact_sha256 is 64 lowercase hex characters')
  const fields: Array<[string, number]> = [['piece_path', 300], ['session_ref', 300], ['skill', 80], ['artifact_ref', 500], ['his_words', 2000], ['client_ref', 120]]
  const out: Record<string, unknown> = {}
  for (const [k, max] of fields) {
    const got = text(v[k], max)
    if (got === undefined && v[k] !== undefined) problems.push(`${k} is text of up to ${max} characters`)
    else if (got !== undefined) out[k] = got
  }
  // His words are his: never a session's paraphrase. A guard or a Critic has none.
  if (out.his_words && v.kind !== 'krish_reject') problems.push('his_words is only on a krish_reject: his typed words')
  const groups = keys(v.floor_groups), failures = keys(v.failure_ids)
  if (!groups) problems.push('floor_groups is a list of group keys')
  if (!failures) problems.push('failure_ids is a list of config/failures.json ids')
  const score = v.brief_score === undefined || v.brief_score === null ? null
    : typeof v.brief_score === 'number' && Number.isFinite(v.brief_score) && v.brief_score >= 0 && v.brief_score <= 100 ? v.brief_score : undefined
  if (score === undefined) problems.push('brief_score is a number from 0 to 100, or null')
  if (v.meta !== undefined && !isObj(v.meta)) problems.push('meta is an object')
  if (v.preflight !== undefined && v.preflight !== null && !Array.isArray(v.preflight) && !isObj(v.preflight)) problems.push('preflight is the receipt list or object')
  if (JSON.stringify(v.meta ?? {}).length > 8000 || JSON.stringify(v.preflight ?? null).length > 12000) problems.push('meta or preflight is too large')
  if (problems.length) return { problems }
  return {
    problems,
    row: {
      at, stage: v.stage, kind: v.kind, maker, piece_id: v.piece_id ?? null, ...out,
      artifact_sha256: v.artifact_sha256 ?? null, preflight: v.preflight ?? null, brief_score: score,
      floor_groups: groups, failure_ids: failures, meta: isObj(v.meta) ? v.meta : {},
    },
  }
}

export function parseIncidents(body: unknown, now: string): { rows: Record<string, unknown>[]; problems: string[] } {
  const list = isObj(body) && Array.isArray(body.incidents) ? body.incidents : null
  if (!list || !list.length) return { rows: [], problems: ['incidents is a non-empty list'] }
  if (list.length > MAX_BATCH) return { rows: [], problems: [`at most ${MAX_BATCH} incidents a call`] }
  const rows: Record<string, unknown>[] = [], problems: string[] = []
  list.forEach((item, i) => {
    const { row, problems: p } = parseIncident(item, now)
    if (row) rows.push(row)
    else problems.push(...p.map(x => `incidents.${i}: ${x}`))
  })
  return { rows, problems }
}

/** The preflight receipt the piece holds now (meta.making.preflight), or null when it holds none or cannot be read. */
export async function preflightOf(db: SupabaseClient, pieceId: string | null | undefined): Promise<unknown> {
  if (!pieceId || !UUID.test(pieceId)) return null
  try {
    const read = await db.from('content_ideas').select('meta').eq('id', pieceId).maybeSingle()
    const making = isObj(read.data?.meta) && isObj((read.data!.meta as Record<string, unknown>).making) ? (read.data!.meta as any).making : null
    return making && Array.isArray(making.preflight) ? making.preflight : null
  } catch {
    return null
  }
}

/** Files rows, once each (client_ref). 'filed', 'failed' or 'waits_on_migration'; never throws. */
export async function fileIncidents(db: SupabaseClient, rows: Record<string, unknown>[]): Promise<'filed' | 'failed' | 'waits_on_migration'> {
  try {
    const keyed = rows.filter(r => r.client_ref), loose = rows.filter(r => !r.client_ref)
    const errors = []
    if (keyed.length) errors.push((await db.from('engine_incidents').upsert(keyed, { onConflict: 'client_ref', ignoreDuplicates: true })).error)
    if (loose.length) errors.push((await db.from('engine_incidents').insert(loose)).error)
    const error = errors.find(Boolean) as { code?: string; message?: string } | undefined
    if (!error) return 'filed'
    console.warn(`engine_incidents: not filed: ${String(error.message || error.code).slice(0, 200)}`)
    return ['42P01', 'PGRST205'].includes(String(error.code || '')) ? 'waits_on_migration' : 'failed'
  } catch (e) {
    console.warn(`engine_incidents: not filed: ${String((e as Error)?.message || e).slice(0, 200)}`)
    return 'failed'
  }
}

/** One incident from the server, with the piece's preflight receipt read now when none is given. Never throws. */
export async function recordIncident(db: SupabaseClient, incident: Incident, now: string): Promise<'filed' | 'failed' | 'waits_on_migration' | 'refused'> {
  try {
    const preflight = incident.preflight !== undefined ? incident.preflight : await preflightOf(db, incident.piece_id)
    const { row, problems } = parseIncident({ ...incident, preflight }, now)
    if (!row) { console.warn(`engine_incidents: refused: ${problems.join('; ').slice(0, 300)}`); return 'refused' }
    return await fileIncidents(db, [row])
  } catch (e) {
    console.warn(`engine_incidents: not filed: ${String((e as Error)?.message || e).slice(0, 200)}`)
    return 'failed'
  }
}

/** The stage a rejected asset belongs to, from the asset's name on the board (a cut, a thumbnail, a cover...). */
export function stageOfAsset(asset: unknown, label: unknown): IncidentStage {
  const s = `${typeof asset === 'string' ? asset : ''} ${typeof label === 'string' ? label : ''}`.toLowerCase()
  if (/thumb|cover|title|caption|carousel|card|package/.test(s)) return 'package'
  if (/script/.test(s)) return 'script'
  if (/proof/.test(s)) return 'proof'
  if (/style/.test(s)) return 'style'
  if (/article|post|substack/.test(s)) return 'post'
  return 'cut'
}
