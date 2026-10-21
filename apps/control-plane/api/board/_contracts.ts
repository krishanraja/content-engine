import { createHash } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { hasEngineAccess, operatorBearerAllowed } from '../_auth.js'

export const collections = ['ticks', 'links', 'edits', 'picks', 'queue', 'comments'] as const
export type Collection = typeof collections[number]
export const MAX_HTML = 16 * 1024 * 1024
export const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(value)
}
export function monday(value: string): boolean {
  const d = new Date(`${value}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(+d) && d.toISOString().slice(0, 10) === value && d.getUTCDay() === 1
}
export const validId = (id: string) => /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(id)
export const revision = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0
export function actor(req: VercelRequest, operatorOnly = false): string | null {
  if (operatorBearerAllowed(req)) return 'engine_operator'
  if (operatorOnly || !hasEngineAccess(req)) return null
  if (!['GET', 'HEAD'].includes(req.method || '')) {
    const origins = ['https://content.krishraja.com', 'https://controlcenter.krishraja.com', process.env.APP_ORIGIN].filter(Boolean)
    if (!origins.includes(String(req.headers.origin || ''))) return null
  }
  return 'Krish'
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function validBody(collection: string, id: string, body: unknown): boolean {
  if (!validId(id) || !object(body) || Buffer.byteLength(JSON.stringify(body)) > 256 * 1024) return false
  if ('at' in body && (typeof body.at !== 'string' || !Number.isFinite(Date.parse(body.at)))) return false
  const day = (v: unknown) => ['mon', 'wed', 'fri'].includes(String(v))
  const text = (k: string, max = 150000) => typeof body[k] === 'string' && (body[k] as string).length <= max
  if (collection === 'ticks') return typeof body.done === 'boolean' && day(body.day) && text('piece_id', 100) && text('step', 80) && text('label', 300) && id === `${body.day}-${body.step}`
  if (collection === 'links') return day(id) && ['article', 'youtube'].every(k => text(k, 2048) && (!body[k] || /^https?:\/\//.test(body[k] as string)))
  if (collection === 'edits') return text('text') && day(body.day) && text('item', 100) && id === `${body.day}-${body.item}`
  if (collection === 'picks') return day(id) && day(body.day) && text('pick', 160) && text('story')
  // A Combine tap on the Queue tab's "Could combine" card: his choice only, recorded as queue/combine-<n>; the next
  // session runs synthesize on his word (Krish, 2026-10-21: nothing in the queue is combined without it).
  if (collection === 'queue' && body.combine !== undefined) return /^combine-\d{1,3}$/.test(id) && body.combine === true && body.pick === id
    && Array.isArray(body.members) && body.members.length >= 2 && body.members.length <= 5
    && body.members.every(m => typeof m === 'string' && UUID.test(m)) && new Set(body.members).size === body.members.length
  if (collection === 'queue') return text('pick', 160) && typeof body.queued === 'boolean'
  if (collection === 'comments') return text('text', 30000) && text('thread_id', 160) && validId(String(body.thread_id)) && text('anchor', 160) && validId(String(body.anchor))
    && commentExtras(body)
  return false
}
// What a comment may carry beyond its words (Krish, 2026-10-21: comment on any passage of a draft, and his taps on
// "Also changed" and "What I learned from your edits"): where in which draft and the words he picked, or one of his
// taps (act) on one change or proposal (ref). Each optional, each bounded; nothing else is checked here.
export const COMMENT_ACTS = ['undo', 'apply', 'lesson_yes', 'lesson_no'] as const
function commentExtras(body: Record<string, unknown>): boolean {
  if ('box' in body && !(typeof body.box === 'string' && validId(body.box))) return false
  if ('paragraph' in body && !(Number.isSafeInteger(body.paragraph) && Number(body.paragraph) >= 0 && Number(body.paragraph) < 10000)) return false
  if ('quote' in body && !(typeof body.quote === 'string' && body.quote.length > 0 && body.quote.length <= 2000)) return false
  if ('act' in body || 'ref' in body) {
    if (!(COMMENT_ACTS as readonly string[]).includes(String(body.act))) return false
    if (!(typeof body.ref === 'string' && validId(body.ref))) return false
  }
  return true
}
/** A Combine tap is his word to combine queued ideas, so only Krish writes one (the access-cookie actor); a session
 *  holding the operator key could otherwise write a tap that the next session relays as his. */
export function combineWriterRefused(collection: string, body: unknown, who: string | null): boolean {
  return collection === 'queue' && object(body) && body.combine !== undefined && who !== 'Krish'
}
/** The writes a session relays as his words: a Combine tap, a saved edit of a draft (edit_sweep.py carries it into
 *  every other draft and the ledger as decided_by Krish), and his taps on a change or a lesson (a comment with act).
 *  Only Krish writes them; any other writer gets the code to refuse with. A plain comment stays open to the engine. */
export function hisOnlyRefusal(collection: string, body: unknown, who: string | null): string | null {
  if (who === 'Krish') return null
  if (combineWriterRefused(collection, body, who)) return 'combine_is_his_tap'
  if (collection === 'edits') return 'edit_is_his_save'
  if (collection === 'comments' && object(body) && 'act' in body) return 'tap_is_his'
  return null
}
// Source archives retain the export's selectors, missing anchors and synthesized
// reply identifiers verbatim. Canonical comments still use validBody above.
export function validSourceBody(collection: string, id: unknown, body: unknown): boolean {
  if (collection !== 'comments') return typeof id === 'string' && validBody(collection, id, body)
  const sourceId = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 300 && !/[\x00-\x1f]/.test(value)
  return sourceId(id) && object(body) && Buffer.byteLength(JSON.stringify(body)) <= 256 * 1024
    && sourceId(body.thread_id) && (body.anchor === null || typeof body.anchor === 'string' && body.anchor.length <= 1000)
    && typeof body.text === 'string' && body.text.length <= 30000
    && (!('at' in body) || typeof body.at === 'string' && Number.isFinite(Date.parse(body.at)))
}
export type BoardFile = { sha256: string; bytes: number; type: string; name: string; key: string }
export type Manifest = { version: 1; week: string; html: BoardFile; assets: Record<string, BoardFile> }
export function fileSpec(week: string, v: unknown, html = false): v is BoardFile {
  if (!object(v) || !/^[a-f0-9]{64}$/.test(String(v.sha256)) || !Number.isSafeInteger(v.bytes) || Number(v.bytes) <= 0) return false
  if (Number(v.bytes) > (html ? MAX_HTML : 2 * 1024 ** 3)) return false
  if (typeof v.type !== 'string' || !/^[a-z]+\/[a-z0-9.+-]+$/.test(v.type)) return false
  if (html && v.type !== 'text/html') return false
  if (typeof v.name !== 'string' || !/^[^/\\\x00-\x1f]{1,200}$/.test(v.name)) return false
  return v.key === `boards/${week}/${v.sha256}`
}
export function validManifest(week: string, v: unknown): v is Manifest {
  return object(v) && v.version === 1 && v.week === week && fileSpec(week, v.html, true) && object(v.assets)
    && Object.keys(v.assets).length <= 250 && Object.entries(v.assets).every(([id, f]) => validId(id) && fileSpec(week, f))
}
