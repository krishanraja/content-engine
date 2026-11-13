import captionThemes from '../../../../config/caption-themes.json' with { type: 'json' }
import styleSamples from '../../../../config/ve/style-samples.json' with { type: 'json' }
import type { SupabaseClient } from '@supabase/supabase-js'
import { patchMeta, StoreError, type StoreDb } from '../_pieceStore.js'
import type { LiveGate } from './_live.js'

// The style choices on a piece (view contract 1.4.0, day.path.style; docs/PUBLISH_BOARDS.md, "The style choices"):
// Krish picks the piece's motion style and caption style on the board, beside its treatment (the look, path.look), and
// says "Not this" to any he does not want. Each layer lists every option with its name, one line on what it is, its
// rules, whether the engine recommends it and why, a rendered sample when one exists, and the press that answers it.
//
// - Motion: the bank's motion layer (config/style-references.json, layer "motion"), read with the rest of the bank.
//   Up to three are recommended: each made for every format the piece makes, sharing a point type with the piece when
//   its spec names them (style.points), one ve can draw now (its ve_route has no needs_device, the rule ve styles keeps:
//   needs_device holds a style back until his yes on its test render), never one he called not for us, and never one
//   he said "Not this" to on this piece; those that suit the channel often first, then his liked ones, then the most
//   point types matched.
// - Captions: config/caption-themes.json, one per name in apps/renderer/src/engine/captions/names.ts; the one with a
//   recommended_why (his pick) is recommended unless he said "Not this" to it here.
// - Treatment: the looks (path.look) in the same shape, so the three choices draw alike; its press is the look op.
//
// His press is POST /api/board/<Monday>/style (saveStyle): it writes content_ideas.meta.style beside meta.look, guarded
// on the row's updated_at (patchMeta), so a write landing in between is kept, never overwritten; the content_ideas
// trigger bumps the week's board_signal. It never edits a creative-direction.json: make-piece and ve read meta.style as
// the default for a new spec's style.motion and brand.caption_theme. Picked shows his press first, then his Pick a
// style gate on the making record, then a spec he signed.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

export type StyleLayerKey = 'motion' | 'captions'
export const STYLE_LAYERS: readonly StyleLayerKey[] = ['motion', 'captions']
/** The layers a "Not this" is kept for: the two style layers and the treatment (the looks). */
export type RejectLayerKey = StyleLayerKey | 'treatment'
/** A press on an option: POST /api/board/<Monday>/<op> with the body, as a press action with an op does. */
export interface StylePress { label: string; op: 'style' | 'look'; body: Body; done: string }
export interface StyleOption {
  id: string
  name: string
  /** One line on what it is. */
  line: string
  rules: string[]
  /** Motion only: the kinds of point it draws, the formats it is made for, and whether ve can draw it now (false while
   *  its route says needs_device: it waits on a device and his yes on its test render). */
  point_types?: string[]
  formats?: string[]
  ready?: boolean
  recommended: boolean
  /** Why the engine recommends it, in plain words; null when it does not. */
  why: string | null
  /** A rendered sample on this site (config/ve/style-samples.json), or null. */
  sample_url: string | null
  /** He said "Not this" to it on this piece, or called it not for us. */
  rejected: boolean
  presses: { yes: StylePress; not_this?: StylePress }
}
export interface StyleLayer {
  options: StyleOption[]
  picked: string | null
  /** Krish (his press on the board or his Pick a style gate), spec (a creative direction he signed), or null. */
  picked_by: 'Krish' | 'spec' | null
  picked_at: string | null
}
export interface DayStyle { motion: StyleLayer; captions: StyleLayer; treatment: StyleLayer }

/** One motion style from the bank's motion layer. */
export interface MotionModule { id: string; name: string; how: string; rules: string[]; point_types: string[]; formats: string[]; fits: string; krish_verdict: string; ve_route: string[] }
export interface Look { id: string; name: string; pitch: string; status: string }

interface CaptionTheme { name: string; line: string; rules: string[]; recommended_why?: string }
/** The caption styles, in names.ts order. */
export const CAPTIONS: Array<{ id: string } & CaptionTheme> = Object.entries(captionThemes as Record<string, unknown>)
  .filter((e): e is [string, CaptionTheme] => !e[0].startsWith('_') && isObj(e[1]))
  .map(([id, t]) => ({ id, name: String(t.name), line: String(t.line), rules: strings(t.rules), ...(typeof t.recommended_why === 'string' ? { recommended_why: t.recommended_why } : {}) }))
const CAPTION_IDS = new Set(CAPTIONS.map(c => c.id))

/** The motion layer of the style bank (config/style-references.json), in bank order. */
export function motionBank(styles: unknown): MotionModule[] {
  const bank = isObj(styles) && Array.isArray(styles.bank) ? styles.bank : []
  return bank.filter(isObj).filter(m => m.layer === 'motion' && typeof m.id === 'string')
    .map(m => ({ id: String(m.id), name: String(m.name || m.id), how: String(m.how || ''), rules: strings(m.rules), point_types: strings(m.point_types),
      formats: strings(m.formats), fits: String(m.fits || ''), krish_verdict: String(m.krish_verdict || 'untested'), ve_route: strings(m.ve_route) }))
}

/** A rendered sample's same-site path, or null: never an outside link (the view carries none, by the media rule). */
export function sampleUrl(layer: StyleLayerKey, id: string, samples: unknown = styleSamples): string | null {
  const map = isObj(samples) && isObj(samples[layer]) ? samples[layer] as Body : {}
  const url = map[id]
  return typeof url === 'string' && /^\/(?!\/)[^\s]*$/.test(url) ? url : null
}

const NOT_FOR_US = new Set(['not for us', 'not_for_us', 'not-for-us', 'rejected'])
const FITS_ORDER: Record<string, number> = { often: 0, sometimes: 1, rarely: 2 }
const LIKED = new Set(['liked', 'tested'])
const MOTION_ID = /^[a-z0-9][a-z0-9_.-]{0,79}$/
/** Whether ve can draw a motion style now: its route does not say needs_device (scripts/velib/styles.py built). */
const ready = (m: MotionModule) => !m.ve_route.includes('needs_device')

/** His style on the piece (meta.style), read safely. */
export function styleOf(meta: unknown): { motion: string | null; captions: string | null; rejected: Record<RejectLayerKey, string[]>; at: string | null } {
  const s = isObj(meta) && isObj(meta.style) ? meta.style : {}
  const rejected = isObj(s.rejected) ? s.rejected : {}
  return { motion: typeof s.motion === 'string' ? s.motion : null, captions: typeof s.captions === 'string' ? s.captions : null,
    rejected: { motion: strings(rejected.motion), captions: strings(rejected.captions), treatment: strings(rejected.treatment) }, at: typeof s.at === 'string' ? s.at : null }
}

/** The plain reason a motion style is recommended for this piece. */
function motionWhy(m: MotionModule, hits: string[]): string {
  const parts: string[] = []
  if (LIKED.has(m.krish_verdict)) parts.push('You liked it before')
  if (hits.length) parts.push(`It draws the ${hits.join(' and ')} points this piece makes`)
  if (m.fits === 'often') parts.push('It suits the channel often')
  else if (m.fits) parts.push(`It suits the channel ${m.fits}`)
  return `${parts.join('. ')}.`
}

export interface StyleInputs {
  pieceId: string
  /** The piece's meta (meta.style, meta.look). */
  meta: Body
  /** Every format the piece makes (a series piece: the long and the short cut). */
  formats: string[]
  /** The kinds of point the piece makes, when its spec names them (style.points); null when unknown. */
  points: string[] | null
  motion: MotionModule[]
  looks: Look[]
  /** The Sunday room's recommended look for the idea, if any. */
  recommendedLook: string | null
  /** His Pick a style gate on the making record. */
  gate?: LiveGate
  /** The piece's creative direction (ve spec), when one is on file. */
  spec?: Body | null
  /** The production pick a session recommends for this piece, from its row in the week's plan (`style.motion`,
   *  `style.captions`): the one recommended, first, in place of the channel's own three. */
  recommendedMotion?: string | null
  recommendedCaptions?: string | null
}

/** The piece's style choices: motion, captions and treatment, each with every option and the press that answers it. */
export function dayStyle(i: StyleInputs): DayStyle {
  const mine = styleOf(i.meta)
  const signed = isObj(i.spec) && isObj(i.spec.signed) && i.spec.signed.by === 'Krish' ? i.spec : null
  const signedOn = signed && isObj(signed.signed) && typeof signed.signed.on === 'string' ? signed.signed.on : null
  const press = (label: string, op: 'style' | 'look', body: Body, done: string): StylePress => ({ label, op, body: { piece_id: i.pieceId, ...body }, done })

  // Motion: up to three recommended, in their rank order, then every other option in bank order.
  const known = i.points && i.points.length ? i.points : null
  const ranked = i.motion.map((m, n) => ({ m, n, hits: known ? m.point_types.filter(p => known.includes(p)) : [] }))
    .filter(x => ready(x.m) && !mine.rejected.motion.includes(x.m.id) && !NOT_FOR_US.has(x.m.krish_verdict))
    .filter(x => i.formats.every(f => x.m.formats.includes(f)) && (!known || x.hits.length > 0))
    .sort((a, b) => (FITS_ORDER[a.m.fits] ?? 3) - (FITS_ORDER[b.m.fits] ?? 3) || Number(LIKED.has(b.m.krish_verdict)) - Number(LIKED.has(a.m.krish_verdict))
      || b.hits.length - a.hits.length || a.n - b.n)
    .slice(0, 3)
  const planned = i.recommendedMotion && i.motion.some(m => m.id === i.recommendedMotion) && !mine.rejected.motion.includes(i.recommendedMotion) ? i.recommendedMotion : null
  const recommended = planned ? new Map([[planned, 'The production pick recommended for this piece.']])
    : new Map(ranked.map(x => [x.m.id, motionWhy(x.m, x.hits)]))
  const motionIds = new Set(i.motion.map(m => m.id))
  const gateModule = i.gate?.state === 'picked' && i.gate.module && motionIds.has(i.gate.module) && !mine.rejected.motion.includes(i.gate.module) ? i.gate.module : null
  const specMotion = signed && isObj(signed.style) && isObj(signed.style.motion) && typeof signed.style.motion.module === 'string' ? signed.style.motion.module : null
  const motionPick: Pick<StyleLayer, 'picked' | 'picked_by' | 'picked_at'> = mine.motion && motionIds.has(mine.motion) ? { picked: mine.motion, picked_by: 'Krish', picked_at: mine.at }
    : gateModule ? { picked: gateModule, picked_by: 'Krish', picked_at: i.gate?.at ?? null }
    : specMotion && MOTION_ID.test(specMotion) && !mine.rejected.motion.includes(specMotion) ? { picked: specMotion, picked_by: 'spec', picked_at: signedOn }
    : { picked: null, picked_by: null, picked_at: null }
  const order = planned ? [...i.motion.filter(m => m.id === planned), ...i.motion.filter(m => m.id !== planned)]
    : [...ranked.map(x => x.m), ...i.motion.filter(m => !recommended.has(m.id))]
  const motion: StyleLayer = {
    options: order.map(m => ({ id: m.id, name: m.name, line: m.how, rules: m.rules, point_types: m.point_types, formats: m.formats, ready: ready(m),
      recommended: recommended.has(m.id), why: recommended.get(m.id) ?? null, sample_url: sampleUrl('motion', m.id),
      rejected: mine.rejected.motion.includes(m.id) || NOT_FOR_US.has(m.krish_verdict),
      presses: { yes: press('Yes', 'style', { motion: m.id }, `Picked. ${m.name} is the motion style for this piece.`),
        not_this: press('Not this', 'style', { reject: { layer: 'motion', id: m.id } }, 'Noted. It is not recommended for this piece any more.') } })),
    ...motionPick,
  }

  // Captions: the one with his reason recommended, unless he said "Not this" to it here.
  const specCaption = signed && isObj(signed.brand) && typeof signed.brand.caption_theme === 'string' ? signed.brand.caption_theme : null
  const captionPick: Pick<StyleLayer, 'picked' | 'picked_by' | 'picked_at'> = mine.captions && CAPTION_IDS.has(mine.captions) ? { picked: mine.captions, picked_by: 'Krish', picked_at: mine.at }
    : specCaption && CAPTION_IDS.has(specCaption) && !mine.rejected.captions.includes(specCaption) ? { picked: specCaption, picked_by: 'spec', picked_at: signedOn }
    : { picked: null, picked_by: null, picked_at: null }
  const captions: StyleLayer = {
    options: CAPTIONS.map(c => {
      const rejected = mine.rejected.captions.includes(c.id)
      const plannedCaption = i.recommendedCaptions && CAPTION_IDS.has(i.recommendedCaptions) && !mine.rejected.captions.includes(i.recommendedCaptions) ? i.recommendedCaptions : null
      const rec = plannedCaption ? c.id === plannedCaption : Boolean(c.recommended_why) && !rejected
      const why = plannedCaption ? (rec ? 'The production pick recommended for this piece.' : null) : rec ? c.recommended_why! : null
      return { id: c.id, name: c.name, line: c.line, rules: c.rules, recommended: rec, why, sample_url: sampleUrl('captions', c.id), rejected,
        presses: { yes: press('Yes', 'style', { captions: c.id }, `Picked. ${c.name} is the caption style for this piece.`),
          not_this: press('Not this', 'style', { reject: { layer: 'captions', id: c.id } }, 'Noted. It is not recommended for this piece any more.') } }
    }),
    ...captionPick,
  }

  // Treatment: the looks, answered by the look op; his experiment and inspiration on the look are kept. "Not this" on a
  // look is kept on the piece's style (meta.style.rejected.treatment), as on motion and captions, and takes it off the
  // recommended; a later Yes on it takes it back.
  const look = isObj(i.meta.look) && typeof i.meta.look.production === 'string' ? i.meta.look : null
  const keep = { experiment: look && typeof look.experiment === 'string' ? look.experiment : null, inspiration: look ? strings(look.inspiration) : [] }
  const treatment: StyleLayer = {
    options: i.looks.map(l => {
      // A look he picked after saying "Not this" to it (the look op) is his pick, never also a no.
      const rejected = mine.rejected.treatment.includes(l.id) && !(look && look.production === l.id)
      const rec = l.id === i.recommendedLook && !rejected
      return { id: l.id, name: l.name, line: l.pitch, rules: [], recommended: rec,
        why: rec ? 'The Sunday room recommends it for this idea.' : null, sample_url: null, rejected,
        // The picked look takes no "Not this": a no would leave it picked (the look op holds the pick); he picks another.
        presses: { yes: press('Yes', 'look', { production: l.id, ...keep }, `Picked. ${l.name} is the look for this piece.`),
          ...(look && look.production === l.id ? {} : { not_this: press('Not this', 'style', { reject: { layer: 'treatment', id: l.id } }, 'Noted. It is not recommended for this piece any more.') }) } }
    }),
    picked: look ? String(look.production) : null, picked_by: look ? 'Krish' : null, picked_at: look && typeof look.at === 'string' ? look.at : null,
  }
  return { motion, captions, treatment }
}

export class StyleError extends Error { constructor(public status: number, message: string) { super(message) } }
export interface StylePick { motion?: string; captions?: string; reject?: { layer: RejectLayerKey; id: string } }
export interface SavedStyle { motion: string | null; captions: string | null; rejected: Record<RejectLayerKey, string[]>; by: 'Krish'; at: string }

/** A look's id, as the style bank names its formats. */
const LOOK_ID = /^[a-z0-9][a-z0-9_.-]{0,79}$/

/** Whether a press names the motion layer, so the bank must be read to check it. */
export function needsMotion(body: Body): boolean {
  return body.motion !== undefined || (isObj(body.reject) && body.reject.layer === 'motion')
}

/** His press, checked: a known motion style, a known caption style, or a "Not this" on one of either. motionIds is the
 *  bank's motion layer, read when the press names motion (null when it could not be read). */
export function stylePick(body: Body, motionIds: Set<string> | null): StylePick {
  const out: StylePick = {}
  const motion = (id: unknown) => {
    if (!motionIds || !motionIds.size) throw new StyleError(503, 'styles_unavailable')
    if (typeof id !== 'string' || !motionIds.has(id)) throw new StyleError(400, 'unknown_motion')
    return id
  }
  const caption = (id: unknown) => {
    if (typeof id !== 'string' || !CAPTION_IDS.has(id)) throw new StyleError(400, 'unknown_caption')
    return id
  }
  if (body.motion !== undefined) out.motion = motion(body.motion)
  if (body.captions !== undefined) out.captions = caption(body.captions)
  if (body.reject !== undefined) {
    const r = body.reject
    if (!isObj(r) || (r.layer !== 'motion' && r.layer !== 'captions' && r.layer !== 'treatment')) throw new StyleError(400, 'invalid_reject')
    // A look is checked by its shape here; the board draws "Not this" only on the looks the bank lists.
    if (r.layer === 'treatment' && (typeof r.id !== 'string' || !LOOK_ID.test(r.id))) throw new StyleError(400, 'unknown_look')
    out.reject = { layer: r.layer, id: r.layer === 'motion' ? motion(r.id) : r.layer === 'captions' ? caption(r.id) : String(r.id) }
  }
  if (!out.motion && !out.captions && !out.reject) throw new StyleError(400, 'nothing_to_record')
  return out
}

/** The style after one press: "Not this" first, then a pick (a pick takes a style back off the "Not this" list). */
export function nextStyle(meta: Body, pick: StylePick, at: string): SavedStyle {
  const now = styleOf(meta)
  const rejected = { motion: [...now.rejected.motion], captions: [...now.rejected.captions], treatment: [...now.rejected.treatment] }
  let { motion, captions } = now
  if (pick.reject) {
    const { layer, id } = pick.reject
    if (!rejected[layer].includes(id)) rejected[layer] = [...rejected[layer], id].slice(-60)
    if (layer === 'motion' && motion === id) motion = null
    if (layer === 'captions' && captions === id) captions = null
  }
  if (pick.motion) { motion = pick.motion; rejected.motion = rejected.motion.filter(x => x !== pick.motion) }
  if (pick.captions) { captions = pick.captions; rejected.captions = rejected.captions.filter(x => x !== pick.captions) }
  return { motion, captions, rejected, by: 'Krish', at }
}

/** Record his press on the piece (meta.style), guarded on the row's updated_at so a write in between is kept. */
export async function saveStyle(db: SupabaseClient, pieceId: string, pick: StylePick, now = new Date()): Promise<SavedStyle> {
  let saved: SavedStyle | null = null
  let result: Awaited<ReturnType<typeof patchMeta>>
  try {
    result = await patchMeta(db as unknown as StoreDb, pieceId, meta => {
      saved = nextStyle(meta, pick, now.toISOString())
      return { ...meta, style: saved }
    })
  } catch (e) {
    if (e instanceof StoreError) throw new StyleError(e.status, e.message)
    throw e
  }
  if (result.ok === false) throw new StyleError(result.reason === 'busy' ? 409 : 503, result.reason === 'busy' ? 'piece_busy' : 'board_store_unavailable')
  return saved!
}
