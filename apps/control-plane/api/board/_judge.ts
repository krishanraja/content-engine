import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { READY_AT, runPanel, standing, type DeterministicFinding, type JudgeVerdict, type PanelInput, type PanelResult } from '../_judges/panel.js'
import { voiceMechanics } from '../_judges/deterministic.js'
import { ROSTER_VERSION } from '../_judges/roster.js'
import { copyLint, copyLintReason } from '../_copyLint.js'
import { houseRulesBlock } from '../_houseRules.js'

// content-engine's 10/10 judges on every carousel and Short (Ruling, Krish, 2026-11-12: "Judge them; count passes.
// Every Growth carousel goes through the same 10/10 judges, and each one that passes and goes live counts.").
//
// content-engine makes every asset (Ruling, Krish, 2026-11-26), so its make flow asks before a carousel or a Short is
// handed to Growth (scripts/post-pack/judge_assets.py, on the engine operator's key, recorded as written by
// content-engine); Growth keeps bind and live on its own key. Both reach POST /api/board/<Monday>/judge:
//   {op: judge, item, format, channel, concept_id?, claim?, words, assets: [{name, sha256}]}
//       the draft judges' panel (the same roster, rubric and READY_AT bar a draft is judged on) reads the post's exact
//       words with what it carries; a copy-lint hit fails it before any model is paid. It passes only when the panel
//       stands ready. The answer carries every judge's one fix that did not pass, so a fail comes back with its reasons.
//       The same artifact judged again on the same roster answers from the record, paying nothing.
//   {op: bind, artifact_sha256, buffer_post_id, payload_sha256?, item?}   a passing verdict tied to the saved post
//   {op: live, posts: [{buffer_post_id, url, at}]}                         posts gone out: marked for bound artifacts only,
//                                                                          each live row carrying the item it was bound to
//   {op: bindings, buffer_post_ids: [...]}                                 read only: the board item and artifact each Buffer
//                                                                          post was bound to when it was saved, and whether it
//                                                                          went live (I-09: a post is tied to its board item by
//                                                                          id at the moment it is saved, never matched by title)
// Every row goes to asset_judgements (append only); Control Center's reader counts each artifact whose latest verdict
// is a pass and that went live in the last 7 days. At most DAILY_CAP panels a day are paid for (docs/COST_GUARDS.md).
//
// The judges see the pictures, and a pass is the North Star's bar (Ruling, Krish, 2026-11-15: a carousel cover must
// look like a front cover, body cards use the page centrally with real visual effort). A carousel's request names each
// card's Drive view_url, and the route reads the cards itself (or the request carries them as `images`, each the bytes
// of the asset at the same place or a phone-size rendition of it); each card's sha256 is checked here, and the
// drawn cards' receipt from `python3 scripts/carousel_check.py --cards` (`layout`, bound to the same sha256s); a
// missing or failed receipt is refused before any judge is paid. Until 15 Nov a pass was the panel's lower median at
// READY_AT (7), with the pictures "seen by the reader, not shown to you": the 14 Nov "decades-old mistakes" carousel
// passed at 9 that way. A pass now means every judge that scores passes it (10 of 10 judges, the bar
// docs/NORTH_STAR.md names): each scores at least READY_AT, none kills or abstains. Verdicts from the old bar are never
// served again (BAR, in the recorded roster_version).

export const JUDGED_FORMATS = ['carousel', 'short-video'] as const
/** Panels a day: three or four posts go out a day, about half of them carousels or Shorts. */
export const DAILY_CAP = 40
/** The bar a recorded verdict was judged to; a verdict to an older bar is judged again, never served. */
export const BAR = 'every-judge-passes-2026-11-15'
export const LAYOUT_CHECK = 'carousel_check --cards'
const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
/** A card is sent as its own bytes or as a phone-size rendition of them (`of`: the asset's sha256), within the
 *  route's body limit: at most 600 KB a card and 3.5 MB in all. */
const MAX_IMAGE_BYTES = 600_000
const MAX_IMAGES_BYTES = 3_500_000
/** A card the route reads from Drive itself is not in the request body, so it may be the full-size card. */
const MAX_FETCHED_BYTES = 4_500_000
const SHA256 = /^[a-f0-9]{64}$/
const POST_ID = /^[A-Za-z0-9_-]{6,64}$/
const CHANNEL = /^[a-z][a-z0-9-]{0,30}$/
type Body = Record<string, unknown>
type Answer = { status: number; body: Body }
type Panel = (input: PanelInput) => Promise<PanelResult>
/** A card's bytes by its Drive file id, as the owner of his Drive; null when it cannot be read. */
export type CardReader = (driveId: string) => Promise<{ mime: string; data: string } | null>
export interface JudgeDeps { panel?: Panel; now?: () => Date; writtenBy?: string; readCard?: CardReader }

/** The default reader: the Drive file's own bytes (files/<id>?alt=media) on the owner's Drive token (_drivePosts.ts). */
export const driveCardReader: CardReader = async (driveId) => {
  const { ownerDriveToken } = await import('./_drivePosts.js')
  const token = await ownerDriveToken().catch(() => null)
  if (!token) return null
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
  if (!r || !r.ok) return null
  const mime = String(r.headers.get('content-type') || '').split(';')[0].trim()
  const bytes = Buffer.from(await r.arrayBuffer())
  if (!IMAGE_MIME.has(mime) || !bytes.length || bytes.length > MAX_FETCHED_BYTES) return null
  return { mime, data: bytes.toString('base64') }
}

/** Growth sends each card's Drive view_url (growth-makeyourmindup #119); the route reads the cards itself, so the judges
 *  are shown exactly what is in Drive. A card that cannot be read leaves images unset, and the request is refused. */
async function readCards(b: Body, read: CardReader): Promise<Body> {
  if (b.format !== 'carousel' || b.images !== undefined) return b
  const assets = b.assets as Body[]
  const { driveIdOf } = await import('./_drivePosts.js')
  const ids = assets.map(a => driveIdOf(a.view_url))
  if (!ids.length || ids.some(id => !id)) return b
  const images = await Promise.all(ids.map(id => read(id!).catch(() => null)))
  if (images.some(i => !i)) return { ...b, cards_unreadable: true }
  return { ...b, images, images_fetched: true }
}

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
    Array.isArray(b.images) && b.images.length
      ? `Pictures: ${assets.map(a => a.name).join(', ')} (shown to you above, in this order, at the size the reader sees)`
      : `Pictures: ${assets.map(a => a.name).join(', ') || 'none'}`].filter(Boolean).join('\n')
}

const CONTEXT = ['This is a derived post made from a piece the publication already published: a carousel or a Short on',
  'a social channel. Judge it as the publication\'s own post on that channel, to the same bar as any draft: would the',
  'reader stop, understand the one point, and want the full piece. You are shown its pictures: judge them as hard as the',
  'words. A carousel\'s first card must look like a front cover and nothing like the cards after it; every card after it',
  'uses the page centrally with real visual effort, never plain, bland or off centre; every card carries one full plain',
  'sentence a stranger can follow cold (Ruling, Krish, 2026-11-15).'].join(' ')

/** Every judge that scores passes it: the North Star's "10/10 judges" (Ruling, Krish, 2026-11-15). */
export function everyJudgePasses(verdicts: JudgeVerdict[]): boolean {
  const panel = verdicts.filter(v => !v.adversarial && !v.deterministic)
  return panel.length > 0 && panel.every(v => v.verdict !== 'kill' && v.verdict !== 'abstain' && v.score !== null && v.score >= READY_AT)
}

/** A carousel arrives with its cards as images (each the asset's own bytes) and a passing drawn-cards receipt for those
 *  same bytes, or the reason it is refused. Nothing is paid before both hold. */
export function pictureProblem(b: Body): { status: number; error: string; reasons?: unknown[] } | null {
  const assets = b.assets as Array<{ sha256: string }>
  const images = b.images
  if (b.cards_unreadable === true) return { status: 503, error: 'cards_unreadable' }
  if (b.format === 'carousel' || images !== undefined) {
    if (!Array.isArray(images) || images.length !== assets.length) return { status: 400, error: 'images_required' }
    let total = 0
    for (const [i, img] of images.entries()) {
      if (!isObj(img) || !IMAGE_MIME.has(String(img.mime)) || typeof img.data !== 'string') return { status: 400, error: 'invalid_image' }
      const bytes = Buffer.from(img.data, 'base64')
      total += bytes.length
      const fetched = b.images_fetched === true
      if (!bytes.length || (!fetched && (bytes.length > MAX_IMAGE_BYTES || total > MAX_IMAGES_BYTES))) return { status: 400, error: 'invalid_image' }
      const own = createHash('sha256').update(bytes).digest('hex') === assets[i].sha256
      if (!own && img.of !== assets[i].sha256) return { status: 400, error: 'image_not_the_asset' }
    }
  }
  if (b.format !== 'carousel') return null
  const layout = b.layout
  if (!isObj(layout) || layout.check !== LAYOUT_CHECK || !Array.isArray(layout.assets)
    || layout.assets.length !== assets.length || layout.assets.some((s, i) => s !== assets[i].sha256)) {
    return { status: 400, error: 'layout_receipt_required' }
  }
  if (layout.passed !== true) {
    const reasons = Array.isArray(layout.problems) ? layout.problems.filter(x => typeof x === 'string').slice(0, 12) : []
    return { status: 422, error: 'layout_failed', reasons }
  }
  return null
}

function judgeBody(b: unknown): b is Body {
  if (!isObj(b) || !text(b.item, 200) || !String(b.item).trim()) return false
  if (!(JUDGED_FORMATS as readonly string[]).includes(String(b.format)) || typeof b.channel !== 'string' || !CHANNEL.test(b.channel)) return false
  if (typeof b.words !== 'string' || !b.words.trim() || b.words.length > 20_000) return false
  if (!Array.isArray(b.assets) || b.assets.length > 20 || !b.assets.every(a => isObj(a) && text(a.name, 200) && SHA256.test(String(a.sha256))
    && (a.view_url === undefined || text(a.view_url, 400)))) return false
  if (b.images !== undefined && (!Array.isArray(b.images) || b.images.length > 20)) return false
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
    if (body.op === 'judge') return await judge(db, week, body, now, by, deps.panel ?? runPanel, deps.readCard ?? driveCardReader)
    if (body.op === 'bind') return await bind(db, body, by)
    if (body.op === 'live') return await live(db, body, by)
    if (body.op === 'bindings') return await bindings(db, body)
  } catch {
    return { status: 503, body: { ok: false, error: 'judgements_unavailable' } }
  }
  return { status: 400, body: { ok: false, error: 'invalid_judge_op' } }
}

async function judge(db: SupabaseClient, week: string, sent: Body, now: Date, by: string, panel: Panel, readCard: CardReader): Promise<Answer> {
  if (!judgeBody(sent)) return { status: 400, body: { ok: false, error: 'invalid_judge_request' } }
  const b = await readCards(sent, readCard)
  const assets = b.assets as Array<{ name: string; sha256: string }>
  const artifact = artifactSha256(String(b.format), String(b.channel), String(b.words), assets)
  const refused = pictureProblem(b)
  if (refused) return { status: refused.status, body: { ok: false, error: refused.error, ...(refused.reasons ? { reasons: refused.reasons } : {}) } }
  const recorded = `${ROSTER_VERSION}+${BAR}`
  const held = await latestJudged(db, artifact)
  if (held && held.roster_version === recorded) {
    return { status: 200, body: { ok: true, verdict: held.verdict, score: held.score, band: held.band, reasons: held.reasons, artifact_sha256: artifact, again: true } }
  }
  const today = await db.from('asset_judgements').select('id', { count: 'exact', head: true }).eq('event', 'judged')
    .gte('created_at', `${now.toISOString().slice(0, 10)}T00:00:00Z`)
  if (today.error) throw new Error('judgements_unreadable')
  if ((today.count ?? 0) >= DAILY_CAP) return { status: 429, body: { ok: false, error: 'judge_cap_reached' } }
  const lint = lintFinding(String(b.words), String(b.format))
  const result = await panel({ gate: 'draft', subjectTable: 'content_ideas', subjectId: String(b.item), artifact: postArtifact(b),
    context: [houseRulesBlock('judge_draft'), CONTEXT].join('\n\n'), deterministic: lint ? [lint] : [], shortCircuitOnKill: true,
    ...(Array.isArray(b.images) && b.images.length ? { images: (b.images as Body[]).map(i => ({ mime: String(i.mime), data: String(i.data) })) } : {}) })
  const s = standing(result.verdicts)
  const pass = !lint && s.band === 'ready' && everyJudgePasses(result.verdicts)
  const reasons = (lint ? [{ judge: 'copy_lint', score: 0, fix: lint.the_one_fix }] : s.brief).slice(0, 12)
  const row = { event: 'judged', artifact_sha256: artifact, item: String(b.item), week, format: String(b.format), channel: String(b.channel),
    concept_id: typeof b.concept_id === 'string' ? b.concept_id : null, verdict: pass ? 'pass' : 'fail', score: s.score, band: lint ? 'weak' : s.band,
    reasons, judges: result.verdicts.map(v => ({ judge: v.judge, score: v.score, verdict: v.verdict, adversarial: v.adversarial })),
    roster_version: `${result.roster_version}+${BAR}`, cost_usd: Math.max(0, Number(result.cost_usd) || 0), judged_at: now.toISOString(), written_by: by }
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
  const bound = await db.from('asset_judgements').select('artifact_sha256,buffer_post_id,event,item').in('buffer_post_id', ids).in('event', ['bound', 'live'])
  if (bound.error) throw new Error('judgements_unreadable')
  const rows = (bound.data || []) as Body[]
  const already = new Set(rows.filter(r => r.event === 'live').map(r => `${r.artifact_sha256}:${r.buffer_post_id}`))
  let marked = 0
  for (const r of rows.filter(r => r.event === 'bound')) {
    const key = `${r.artifact_sha256}:${r.buffer_post_id}`
    if (already.has(key)) continue
    const post = posts.find(p => p.buffer_post_id === r.buffer_post_id)!
    const wrote = await db.from('asset_judgements').insert({ event: 'live', artifact_sha256: r.artifact_sha256, buffer_post_id: r.buffer_post_id,
      item: typeof r.item === 'string' ? r.item : null, url: post.url, live_at: new Date(String(post.at)).toISOString(), written_by: by })
    if (wrote.error && !/duplicate|23505/.test(String(wrote.error.message || wrote.error.code))) throw new Error('judgements_unwritable')
    already.add(key)
    marked += 1
  }
  return { status: 200, body: { ok: true, marked } }
}

/** Read only: what each Buffer post was bound to when it was saved. The board tick and Control Center read this, by the
 *  post's id, instead of matching a post to an item by its title. The newest binding of a post wins; a post never bound
 *  is listed with item null, so the caller sees it is unbound rather than guessing. */
async function bindings(db: SupabaseClient, b: Body): Promise<Answer> {
  const ids = Array.isArray(b.buffer_post_ids) ? [...new Set(b.buffer_post_ids.map(String))] : null
  if (!ids || !ids.length || ids.length > 200 || !ids.every(id => POST_ID.test(id))) return { status: 400, body: { ok: false, error: 'invalid_bindings' } }
  const read = await db.from('asset_judgements').select('artifact_sha256,buffer_post_id,event,item,url,live_at,created_at')
    .in('buffer_post_id', ids).in('event', ['bound', 'live']).order('created_at', { ascending: false })
  if (read.error) throw new Error('judgements_unreadable')
  const rows = (read.data || []) as Body[]
  const out = ids.map((id) => {
    const bound = rows.find(r => r.buffer_post_id === id && r.event === 'bound')
    const went = bound ? rows.find(r => r.buffer_post_id === id && r.event === 'live' && r.artifact_sha256 === bound.artifact_sha256) : undefined
    return {
      buffer_post_id: id,
      item: bound && typeof bound.item === 'string' ? bound.item : null,
      artifact_sha256: bound ? String(bound.artifact_sha256) : null,
      bound_at: bound && typeof bound.created_at === 'string' ? bound.created_at : null,
      live: went ? { url: went.url ?? null, at: went.live_at ?? null } : null,
    }
  })
  return { status: 200, body: { ok: true, bindings: out } }
}
