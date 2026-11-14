import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { runPanel, standing, type DeterministicFinding, type PanelInput, type PanelResult } from '../_judges/panel.js'
import { voiceMechanics } from '../_judges/deterministic.js'
import { ROSTER_VERSION } from '../_judges/roster.js'
import { copyLint, copyLintReason } from '../_copyLint.js'
import { houseRulesBlock } from '../_houseRules.js'

// content-engine's 10/10 judges on every Growth carousel and Short (Ruling, Krish, 2026-11-12: "Judge them; count
// passes. Every Growth carousel goes through the same 10/10 judges, and each one that passes and goes live counts.").
//
// Growth asks before a carousel or a Short is saved or handed off (growth-makeyourmindup engine/run/judges.py), on its
// own board key, at POST /api/board/<Monday>/judge:
//   {op: judge, item, format, channel, concept_id?, claim?, words, assets: [{name, sha256}]}
//       the draft judges' panel (the same roster, rubric and READY_AT bar a draft is judged on) reads the post's exact
//       words with what it carries; a copy-lint hit fails it before any model is paid. It passes only when the panel
//       stands ready. The answer carries every judge's one fix that did not pass, so a fail comes back with its reasons.
//       The same artifact judged again on the same roster answers from the record, paying nothing.
//   {op: bind, artifact_sha256, buffer_post_id, payload_sha256?, item?}   a passing verdict tied to the saved post
//   {op: live, posts: [{buffer_post_id, url, at}]}                         posts gone out: marked for bound artifacts only
// Every row goes to asset_judgements (append only); Control Center's reader counts each artifact whose latest verdict
// is a pass and that went live in the last 7 days. At most DAILY_CAP panels a day are paid for (docs/COST_GUARDS.md).

export const JUDGED_FORMATS = ['carousel', 'short-video'] as const
/** Panels a day: Growth makes three or four posts a day, about half of them carousels or Shorts. */
export const DAILY_CAP = 40
const SHA256 = /^[a-f0-9]{64}$/
const POST_ID = /^[A-Za-z0-9_-]{6,64}$/
const CHANNEL = /^[a-z][a-z0-9-]{0,30}$/
type Body = Record<string, unknown>
type Answer = { status: number; body: Body }
type Panel = (input: PanelInput) => Promise<PanelResult>
export interface JudgeDeps { panel?: Panel; now?: () => Date; writtenBy?: string }

const isObj = (v: unknown): v is Body => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max

/** What a verdict binds, the same canonical JSON growth's judges.artifact_sha256 hashes: the format, the channel, the
 *  exact words and each picture's sha256, in order (keys sorted, no spaces). */
export function artifactSha256(format: string, channel: string, words: string, assets: Array<{ sha256: string }>): string {
  const canon = JSON.stringify({ assets: assets.map(a => a.sha256), channel, format, words })
  return createHash('sha256').update(canon, 'utf8').digest('hex')
}

/** The post as the judges read it. */
export function postArtifact(b: Body): string {
  const assets = (b.assets as Array<{ name: string }>)
  return [`Format: ${b.format} on ${b.channel}${b.format === 'carousel' ? `, ${assets.length} slides` : ''}`,
    b.claim ? `The claim it carries, from the published piece: ${b.claim}` : '',
    'The words, exactly as posted:', String(b.words),
    `Pictures: ${assets.map(a => a.name).join(', ') || 'none'} (seen by the reader, not shown to you)`].filter(Boolean).join('\n')
}

const CONTEXT = ['This is a derived post Growth made from a piece the publication already published: a carousel or a Short on',
  'a social channel. Judge it as the publication\'s own post on that channel, to the same bar as any draft: would the',
  'reader stop, understand the one point, and want the full piece. The pictures are the approved mocks; judge the words',
  'and what they promise.'].join(' ')

function judgeBody(b: unknown): b is Body {
  if (!isObj(b) || !text(b.item, 200) || !String(b.item).trim()) return false
  if (!(JUDGED_FORMATS as readonly string[]).includes(String(b.format)) || typeof b.channel !== 'string' || !CHANNEL.test(b.channel)) return false
  if (typeof b.words !== 'string' || !b.words.trim() || b.words.length > 20_000) return false
  if (!Array.isArray(b.assets) || b.assets.length > 20 || !b.assets.every(a => isObj(a) && text(a.name, 200) && SHA256.test(String(a.sha256)))) return false
  return (b.concept_id === undefined || b.concept_id === null || text(b.concept_id, 200)) && (b.claim === undefined || text(b.claim, 2000))
}

/** The free checks as one deterministic judge: a copy-lint hit, an em dash, a banned phrase or a "Not X, Y" fails a
 *  public post before any model is paid (the house rules NO_EM_DASH and R2, the copy lint). */
function lintFinding(words: string, format: string): DeterministicFinding | null {
  const hits = copyLint(words, format === 'carousel' ? 'carousel_text' : 'channel_copy')
  const voice = voiceMechanics(words)
  if (!hits.length && !voice) return null
  const fixes = [...hits.map(h => copyLintReason(h.id)).filter(Boolean), ...(voice?.evidence ?? [])]
  return { judge: 'copy_lint', verdict: 'kill', score: 0, the_one_fix: fixes.slice(0, 4).join('; '),
    evidence: [...hits.slice(0, 5).map(h => h.match), ...(voice?.evidence ?? []).slice(0, 3)] }
}

async function latestJudged(db: SupabaseClient, artifact: string) {
  const read = await db.from('asset_judgements').select('verdict,score,band,reasons,roster_version,judged_at')
    .eq('artifact_sha256', artifact).eq('event', 'judged').order('created_at', { ascending: false }).limit(1)
  if (read.error) throw new Error('judgements_unreadable')
  return ((read.data || []) as Body[])[0] ?? null
}

export async function judgeAsset(db: SupabaseClient, week: string, body: unknown, deps: JudgeDeps = {}): Promise<Answer> {
  const now = (deps.now ?? (() => new Date()))()
  const by = deps.writtenBy ?? 'growth'
  if (!isObj(body)) return { status: 400, body: { ok: false, error: 'invalid_judge_request' } }
  try {
    if (body.op === 'judge') return await judge(db, week, body, now, by, deps.panel ?? runPanel)
    if (body.op === 'bind') return await bind(db, body, by)
    if (body.op === 'live') return await live(db, body, by)
  } catch {
    return { status: 503, body: { ok: false, error: 'judgements_unavailable' } }
  }
  return { status: 400, body: { ok: false, error: 'invalid_judge_op' } }
}

async function judge(db: SupabaseClient, week: string, b: Body, now: Date, by: string, panel: Panel): Promise<Answer> {
  if (!judgeBody(b)) return { status: 400, body: { ok: false, error: 'invalid_judge_request' } }
  const assets = b.assets as Array<{ name: string; sha256: string }>
  const artifact = artifactSha256(String(b.format), String(b.channel), String(b.words), assets)
  const held = await latestJudged(db, artifact)
  if (held && held.roster_version === ROSTER_VERSION) {
    return { status: 200, body: { ok: true, verdict: held.verdict, score: held.score, band: held.band, reasons: held.reasons, artifact_sha256: artifact, again: true } }
  }
  const today = await db.from('asset_judgements').select('id', { count: 'exact', head: true }).eq('event', 'judged')
    .gte('created_at', `${now.toISOString().slice(0, 10)}T00:00:00Z`)
  if (today.error) throw new Error('judgements_unreadable')
  if ((today.count ?? 0) >= DAILY_CAP) return { status: 429, body: { ok: false, error: 'judge_cap_reached' } }
  const lint = lintFinding(String(b.words), String(b.format))
  const result = await panel({ gate: 'draft', subjectTable: 'content_ideas', subjectId: String(b.item), artifact: postArtifact(b),
    context: [houseRulesBlock('judge_draft'), CONTEXT].join('\n\n'), deterministic: lint ? [lint] : [], shortCircuitOnKill: true })
  const s = standing(result.verdicts)
  const pass = !lint && s.band === 'ready'
  const reasons = (lint ? [{ judge: 'copy_lint', score: 0, fix: lint.the_one_fix }] : s.brief).slice(0, 12)
  const row = { event: 'judged', artifact_sha256: artifact, item: String(b.item), week, format: String(b.format), channel: String(b.channel),
    concept_id: typeof b.concept_id === 'string' ? b.concept_id : null, verdict: pass ? 'pass' : 'fail', score: s.score, band: lint ? 'weak' : s.band,
    reasons, judges: result.verdicts.map(v => ({ judge: v.judge, score: v.score, verdict: v.verdict, adversarial: v.adversarial })),
    roster_version: result.roster_version, cost_usd: Math.max(0, Number(result.cost_usd) || 0), judged_at: now.toISOString(), written_by: by }
  const wrote = await db.from('asset_judgements').insert(row)
  if (wrote.error) throw new Error('judgements_unwritable')
  return { status: 200, body: { ok: true, verdict: row.verdict, score: row.score, band: row.band, reasons, artifact_sha256: artifact } }
}

async function bind(db: SupabaseClient, b: Body, by: string): Promise<Answer> {
  if (!SHA256.test(String(b.artifact_sha256)) || !POST_ID.test(String(b.buffer_post_id))
    || (b.payload_sha256 !== undefined && b.payload_sha256 !== null && !SHA256.test(String(b.payload_sha256)))) {
    return { status: 400, body: { ok: false, error: 'invalid_bind' } }
  }
  const held = await latestJudged(db, String(b.artifact_sha256))
  if (!held || held.verdict !== 'pass') return { status: 409, body: { ok: false, error: 'not_passed' } }
  const wrote = await db.from('asset_judgements').insert({ event: 'bound', artifact_sha256: b.artifact_sha256, buffer_post_id: b.buffer_post_id,
    payload_sha256: b.payload_sha256 ?? null, item: typeof b.item === 'string' ? b.item.slice(0, 200) : null, written_by: by })
  if (wrote.error) throw new Error('judgements_unwritable')
  return { status: 200, body: { ok: true } }
}

async function live(db: SupabaseClient, b: Body, by: string): Promise<Answer> {
  const posts = Array.isArray(b.posts) ? b.posts.filter(isObj).filter(p => POST_ID.test(String(p.buffer_post_id))
    && typeof p.url === 'string' && /^https:\/\/\S{1,2040}$/.test(p.url) && Number.isFinite(Date.parse(String(p.at)))) : null
  if (!posts || posts.length > 200) return { status: 400, body: { ok: false, error: 'invalid_live' } }
  if (!posts.length) return { status: 200, body: { ok: true, marked: 0 } }
  const ids = [...new Set(posts.map(p => String(p.buffer_post_id)))]
  const bound = await db.from('asset_judgements').select('artifact_sha256,buffer_post_id,event').in('buffer_post_id', ids).in('event', ['bound', 'live'])
  if (bound.error) throw new Error('judgements_unreadable')
  const rows = (bound.data || []) as Body[]
  const already = new Set(rows.filter(r => r.event === 'live').map(r => `${r.artifact_sha256}:${r.buffer_post_id}`))
  let marked = 0
  for (const r of rows.filter(r => r.event === 'bound')) {
    const key = `${r.artifact_sha256}:${r.buffer_post_id}`
    if (already.has(key)) continue
    const post = posts.find(p => p.buffer_post_id === r.buffer_post_id)!
    const wrote = await db.from('asset_judgements').insert({ event: 'live', artifact_sha256: r.artifact_sha256, buffer_post_id: r.buffer_post_id,
      url: post.url, live_at: new Date(String(post.at)).toISOString(), written_by: by })
    if (wrote.error && !/duplicate|23505/.test(String(wrote.error.message || wrote.error.code))) throw new Error('judgements_unwritable')
    already.add(key)
    marked += 1
  }
  return { status: 200, body: { ok: true, marked } }
}
