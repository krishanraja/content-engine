import { createHash } from 'node:crypto'

// What an off-day option showed Krish, side by side, and the hash his press on each side is bound to: the same values
// scripts/post-pack/week_plan.py reads from the week's plan files (read_offdays, off_rich, side_sha), so a press made on
// the live board is the same record, binds the same words, and reads the same to offday_pending.py, Growth and the
// revise job.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const PITCH = ['see', 'lands', 'why_now', 'share'] as const
const DIRECTION = ['look', 'format', 'tone', 'kit', 'inspo_url'] as const

/** week_plan._line: the words on one line, cut at cap characters, or null. */
export function line(v: unknown, cap: number): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  return Array.from(v.trim().split(/\s+/).join(' ')).slice(0, cap).join('')
}

/** Python's json.dumps(v, sort_keys=True, separators=(',', ':')), ensure_ascii included. */
export function pyJson(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : JSON.stringify(v)
  if (typeof v === 'string') return JSON.stringify(v).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
  if (Array.isArray(v)) return '[' + v.map(pyJson).join(',') + ']'
  const o = v as Body
  return '{' + Object.keys(o).sort().map(k => pyJson(k) + ':' + pyJson(o[k])).join(',') + '}'
}
const sha = (v: unknown) => createHash('sha256').update(pyJson(v), 'utf8').digest('hex')

export interface OffdaySides {
  id: string
  format: string
  source: string
  copy: string
  copy_sha256: string
  hook: string | null
  pitch: Record<string, string> | null
  direction: Body | null
  revised: { side: string; words: string } | null
  idea_sha256: string
  direction_sha256: string | null
  shown_idea: Body
}

/** One option as the full board reads it (read_offdays), with each side's hash. */
export function offdaySides(o: Body): OffdaySides {
  const src = o.source
  const label = isObj(src) ? (src.label || src.url) : src
  const copy = String(o.copy || '').trim()
  const hook = o.hook != null ? line(o.hook, 140) : null
  const pitch = isObj(o.pitch) ? Object.fromEntries(PITCH.map(k => [k, line((o.pitch as Body)[k], 600)]).filter(([, v]) => v)) as Record<string, string> : null
  let cards: unknown = null
  if (Array.isArray(o.cards)) cards = o.cards.map(c => ({ words: String((c as Body).words).trim().split(/\s+/).join(' '), picture: String((c as Body).picture).trim().split(/\s+/).join(' ') }))
  let direction: Body | null = null
  if (isObj(o.direction)) {
    const d = o.direction
    direction = Object.fromEntries(DIRECTION.map(k => [k, line(d[k], 600)]).filter(([, v]) => v))
    if (Array.isArray(d.frames) && d.frames.length) direction.frames = d.frames.map(f => ({ words: line((f as Body).words, 200), picture: line((f as Body).picture, 300) }))
  }
  const rev = isObj(o.revised) && ['idea', 'direction', 'mock'].includes(String(o.revised.side)) && line(o.revised.words, 2000)
    ? { side: String(o.revised.side), words: line(o.revised.words, 2000)! } : null
  const shown_idea: Body = { copy, hook: o.hook != null ? hook : null, pitch: o.pitch != null ? pitch : null, cards: o.cards != null ? cards : null }
  return {
    id: String(o.id), format: String(o.format || '').trim(), source: String(label || '').trim(), copy,
    copy_sha256: createHash('sha256').update(copy, 'utf8').digest('hex'),
    hook, pitch, direction, revised: rev,
    idea_sha256: sha(shown_idea),
    direction_sha256: direction ? sha(direction) : null,
    shown_idea,
  }
}
