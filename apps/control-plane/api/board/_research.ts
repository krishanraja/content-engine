import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { meterScope, perplexityCall } from '../_meter.js'
import { readMaterials, type Material } from '../_content.js'
import { StoreError, addToWorkingSet, type StoreDb } from '../_pieceStore.js'

// The live board's Research step (Krish, 2026-11-09: "use sonar-pro for research now"). "Research it now" runs the
// piece's research brief (_prompts.researchPrompt) through Perplexity sonar-pro, the model the engine already uses and
// meters (api/_enrich.ts; every call goes to meter_daily, docs/COST_GUARDS.md G12), and files the Markdown answer on the
// piece as a material. A file he drops on the day (his own Perplexity Deep Research, say) is filed the same way.
// Every later step and session reads the piece's materials (GET /api/content-ideas/<id>/materials).

export const MAX_MATERIAL = 400_000
const MODEL = 'sonar-pro'

type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>

/** One research run: the answer as Markdown, with its sources listed at the end. Empty text when the call fails. */
export async function runResearch(prompt: string, env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch as unknown as Fetcher, meter = perplexityCall): Promise<{ text: string; sources: string[] }> {
  const key = env.PERPLEXITY_API_KEY
  if (!key) return { text: '', sources: [] }
  try {
    const r = await fetcher('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a precise research assistant. Cite every fact, date every figure, mark estimates, never speculate. Answer in Markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2, max_tokens: 4000,
      }),
    })
    const j = (await r.json().catch(() => ({}))) as { usage?: unknown; citations?: unknown; choices?: Array<{ message?: { content?: string } }> }
    await meter({ agent: 'board_research', model: MODEL, usage: j?.usage, failed: !r.ok })
    if (!r.ok) return { text: '', sources: [] }
    const sources = Array.isArray(j.citations) ? j.citations.filter((c): c is string => typeof c === 'string') : []
    const body = j.choices?.[0]?.message?.content || ''
    return { text: body ? body + (sources.length ? `\n\n## Sources\n\n${sources.map((s, n) => `${n + 1}. ${s}`).join('\n')}\n` : '') : '', sources }
  } catch {
    return { text: '', sources: [] }
  }
}

export class MaterialError extends Error { constructor(public status: number, message: string) { super(message) } }

/** File one piece of research on the piece (meta.materials), as Krish's. Returns what was filed, without its text. */
export async function fileMaterial(db: SupabaseClient, pieceId: string, m: { kind: 'file' | 'research'; title: string; content: string; by: string })
  : Promise<{ id: string; title: string; bytes: number; at: string }> {
  const content = String(m.content || '')
  if (!content.trim()) throw new MaterialError(400, 'empty_material')
  if (content.length > MAX_MATERIAL) throw new MaterialError(413, 'material_too_large')
  const at = new Date().toISOString()
  const material: Material = { id: randomUUID(), kind: m.kind, title: m.title.slice(0, 200), content, bytes: Buffer.byteLength(content), at, by: m.by }
  // Guarded on the row's updated_at (api/_pieceStore.ts): a write landing in between is read again, never overwritten;
  // the database files it in the piece materials store in the same write.
  let added: Awaited<ReturnType<typeof addToWorkingSet>>
  try { added = await addToWorkingSet(db as unknown as StoreDb, pieceId, material) } catch (e) {
    if (e instanceof StoreError) throw new MaterialError(e.status, e.message)
    throw e
  }
  if (added.ok === false) throw new MaterialError(added.reason === 'materials_full' ? 409 : 503, added.reason === 'materials_full' ? 'materials_full' : 'board_store_unavailable')
  return { id: material.id, title: material.title || '', bytes: material.bytes || 0, at }
}

export interface LookPick { production: string; experiment: string | null; inspiration: string[]; by: string; at: string }

/** His pick of the look for a piece (meta.look): a production format, an optional experiment and the inspiration cards he folded in. */
export async function saveLook(db: SupabaseClient, pieceId: string, pick: { production: string; experiment?: string | null; inspiration?: string[] },
  formats: Set<string>): Promise<LookPick> {
  if (!formats.has(pick.production)) throw new MaterialError(400, 'unknown_format')
  if (pick.experiment && !formats.has(pick.experiment)) throw new MaterialError(400, 'unknown_format')
  const inspiration = (pick.inspiration || []).filter(x => typeof x === 'string' && x.length <= 200).slice(0, 6)
  const read = await db.from('content_ideas').select('id,meta').eq('id', pieceId).single()
  if (read.error || !read.data) throw new MaterialError(404, 'piece_not_found')
  const meta = (read.data.meta || {}) as Record<string, unknown>
  const look: LookPick = { production: pick.production, experiment: pick.experiment || null, inspiration, by: 'Krish', at: new Date().toISOString() }
  const write = await db.from('content_ideas').update({ meta: { ...meta, look }, updated_at: look.at }).eq('id', pieceId)
  if (write.error) throw new MaterialError(503, 'board_store_unavailable')
  return look
}

/** A research run for this piece already filed in the last ten minutes: a second press is refused, so a double tap never pays twice. */
export async function recentResearch(db: SupabaseClient, pieceId: string, now = Date.now()): Promise<boolean> {
  const read = await db.from('content_ideas').select('meta').eq('id', pieceId).single()
  if (read.error || !read.data) return false
  return readMaterials(read.data.meta).some(m => m.kind === 'research' && typeof m.at === 'string' && now - Date.parse(m.at) < 10 * 60_000)
}

/** One research run with its spend stamped on the piece (meter_daily). */
export function researchForPiece(pieceId: string, prompt: string) {
  return meterScope({ pieceId, runId: null }, () => runResearch(prompt))
}
