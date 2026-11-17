// The production plan he opens, reviews and changes before the one production session (view contract 1.25.0; Krish,
// 2026-11-17: "it should look for the recorded audio or video in the inbox, bring the file in to the piece, and create
// the final production plan for me to open, review and then press the Claude production prompt button to copy the final
// e2e prompt to the clipboard [...] The UI should also have mocked up 2 or 3 scenes using my real content stills using
// the visual styles I selected, and give me the final opportunity to switch something out if it does not work before I
// press Claude production prompt for the final time").
//
// - His My takes are in the Inbox press puts the takes on the piece and starts the plan run (production-plan.yml, a
//   Claude Code job on his subscription; docs/production/PRODUCTION_PLAN.md). It measures the take (edit_pass.py:
//   restarts, silences, length, the speed that fits a short under 90 seconds), plans the picture beat by beat, finds
//   the humour already in his words, mocks two or three scenes from real stills in his picked styles, and files the
//   plan on the piece as one JSON material (role production_plan) with the scene stills beside it (role plan_scene).
// - The card draws the plan (item.plan): the edit numbers, the mocked scenes, and every beat with its picture and the
//   others it could be. His Use this on another option is a press saved on the week's picks (picks/plan-<8 hex>, kind
//   plan_swaps, bound to the plan's sha256), never a change to the plan file.
// - The card's Claude production prompt carries the whole plan with his swaps applied (planBrief), so the session he
//   pastes it into makes exactly what he reviewed.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 600): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** The kinds of picture a beat can be, in the words the card shows. */
export const PICTURE_KINDS: Readonly<Record<string, string>> = Object.freeze({
  face: 'You on camera',
  logo: 'Logo or wordmark',
  real_image: 'Real photo or footage',
  screenshot: 'Screenshot of the real page',
  social_post: 'A real social post',
  motion: 'Motion design',
  generated: 'Generated scene',
  humour: 'Comic absurdity',
})

/** The longest a short may run (seconds); a longer cut has no cap. */
export const SHORT_CAP_SECONDS = 90
/** The plan run's file on the piece. */
export const PLAN_ROLE = 'production_plan'
export const SCENE_ROLE = 'plan_scene'
const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/
const MATERIAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const UUID = MATERIAL

/** `recipe`: for a generated picture, exactly how it is made with higgsfield-generator (model, prompt, the still it starts from, length,
 *  estimated credits), so the cost is seen before anything is spent. */
export interface PlanOption { id: string; kind: string; what: string; source: string | null; recipe: string | null }
export interface PlanBeat { id: string; from: number; to: number; words: string; picture: PlanOption; options: PlanOption[]; humour: { mechanism: string; gag: string } | null }
export interface PlanScene { beat: string; still: string; caption: string; style: string }
export interface PlanEdit { raw_seconds: number; restarts: Array<{ at: number; said: string }>; silences_cut: number; kept_seconds: number; cap_seconds: number | null; speed: number; final_seconds: number
  /** Even 1.25x leaves it over the cap (edit_pass.py): the plan must name what to cut, never claim it fits. */
  over_cap: boolean }
export interface ProductionPlan {
  version: 1; piece_id: string; made_at: string; takes: string[]; edit: PlanEdit
  /** A series piece's long cut, measured the same way with no cap (never sped up); null for a short alone. */
  edit_long: PlanEdit | null
  style: { look: string | null; motion: string | null; captions: string | null }
  beats: PlanBeat[]; scenes: PlanScene[]; humour: Array<{ words: string; mechanism: string; gag: string; beat: string | null }>
  /** The sha256 of the material's text, which his swaps bind. */
  sha256: string
}

function option(v: unknown): PlanOption | null {
  if (!isObj(v)) return null
  const id = str(v.id, 40); const kind = str(v.kind, 30); const what = str(v.what, 500)
  if (!id || !ID.test(id) || !kind || !Object.hasOwn(PICTURE_KINDS, kind) || !what) return null
  return { id, kind, what, source: str(v.source, 500), recipe: str(v.recipe, 800) }
}

/** The plan as the run filed it, or null when the text is not a plan for this piece. Anything malformed in a beat drops
 *  that beat, never the plan; a scene whose still is not a material id is dropped. */
export function parsePlan(text: string, pieceId: string, sha256: string): ProductionPlan | null {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return null }
  if (!isObj(raw) || raw.version !== 1 || String(raw.piece_id || '').toLowerCase() !== pieceId.toLowerCase() || !isObj(raw.edit)) return null
  const editOf = (e: Body): PlanEdit => {
    const cap = num(e.cap_seconds); const final = num(e.final_seconds) ?? 0
    return {
      raw_seconds: num(e.raw_seconds) ?? 0,
      restarts: (Array.isArray(e.restarts) ? e.restarts : []).filter(isObj).map(r => ({ at: num(r.at) ?? 0, said: str(r.said, 300) ?? '' })).slice(0, 60),
      silences_cut: num(e.silences_cut) ?? 0, kept_seconds: num(e.kept_seconds) ?? 0, cap_seconds: cap, speed: num(e.speed) ?? 1, final_seconds: final,
      // Over the cap whenever the run says so, or its own figures show it: a plan never claims a fit it does not have.
      over_cap: e.over_cap === true || (cap !== null && final > cap),
    }
  }
  const edit = editOf(raw.edit)
  const beats: PlanBeat[] = (Array.isArray(raw.beats) ? raw.beats : []).filter(isObj).flatMap(b => {
    const id = str(b.id, 40); const picture = option(b.picture); const words = str(b.words, 1200)
    if (!id || !ID.test(id) || !picture || !words) return []
    const options = (Array.isArray(b.options) ? b.options : []).map(option).filter((o): o is PlanOption => Boolean(o) && o!.id !== picture.id).slice(0, 4)
    const h = isObj(b.humour) && str(b.humour.gag) ? { mechanism: str(b.humour.mechanism, 60) ?? 'absurdity', gag: str(b.humour.gag, 500)! } : null
    return [{ id, from: num(b.from) ?? 0, to: num(b.to) ?? 0, words, picture, options, humour: h }]
  }).slice(0, 60)
  if (!beats.length) return null
  const ids = new Set(beats.map(b => b.id))
  const scenes = (Array.isArray(raw.scenes) ? raw.scenes : []).filter(isObj).flatMap(s => {
    const beat = str(s.beat, 40); const still = str(s.still, 40)?.toLowerCase()
    return beat && ids.has(beat) && still && MATERIAL.test(still) ? [{ beat, still, caption: str(s.caption, 300) ?? '', style: str(s.style, 200) ?? '' }] : []
  }).slice(0, 3)
  const st = isObj(raw.style) ? raw.style : {}
  return {
    version: 1, piece_id: pieceId.toLowerCase(), made_at: str(raw.made_at, 40) ?? '', sha256,
    takes: (Array.isArray(raw.takes) ? raw.takes : []).map(t => str(t, 300)).filter((t): t is string => Boolean(t)).slice(0, 6),
    edit, edit_long: isObj(raw.edit_long) ? editOf(raw.edit_long) : null, style: { look: str(st.look, 120), motion: str(st.motion, 120), captions: str(st.captions, 120) }, beats, scenes,
    humour: (Array.isArray(raw.humour) ? raw.humour : []).filter(isObj).flatMap(h => {
      const words = str(h.words, 400); const gag = str(h.gag, 500)
      return words && gag ? [{ words, mechanism: str(h.mechanism, 60) ?? 'absurdity', gag, beat: str(h.beat, 40) }] : []
    }).slice(0, 12),
  }
}

/** His swaps' document on the week's picks: one per piece. */
export const planDocId = (pieceId: string) => `plan-${pieceId.toLowerCase().slice(0, 8)}`
export const PLAN_DOC = /^plan-[0-9a-f]{8}$/

/** His swaps for this plan: beat id to option id. Swaps made on another version of the plan do not count. */
export function swapsOf(picks: Array<{ doc_id: string; body: unknown; updated_by?: string | null }>, plan: ProductionPlan): Record<string, string> {
  // Only his own saves count, as every reader of his decisions does (the server already refuses any other writer).
  const doc = picks.find(p => p.doc_id === planDocId(plan.piece_id) && (p.updated_by === undefined || p.updated_by === 'Krish'))
  const b = doc && isObj(doc.body) ? doc.body : null
  if (!b || b.kind !== 'plan_swaps' || b.plan_sha256 !== plan.sha256 || !isObj(b.swaps)) return {}
  const out: Record<string, string> = {}
  for (const beat of plan.beats) {
    const v = b.swaps[beat.id]
    if (typeof v === 'string' && (v === beat.picture.id || beat.options.some(o => o.id === v))) out[beat.id] = v
  }
  return out
}

/** A beat's picture once his swap is applied. */
export function chosenPicture(beat: PlanBeat, swaps: Record<string, string>): PlanOption {
  const id = swaps[beat.id]
  return (id && beat.options.find(o => o.id === id)) || beat.picture
}

/** A swap body's shape (the picks contract): kind plan_swaps, the piece, the plan's sha256 and beat-to-option ids. */
export function planSwapsBody(id: string, body: Body): boolean {
  if (!PLAN_DOC.test(id) || body.kind !== 'plan_swaps' || typeof body.piece_id !== 'string' || !UUID.test(body.piece_id)) return false
  if (!body.piece_id.startsWith(id.slice(5)) || !/^[a-f0-9]{64}$/.test(String(body.plan_sha256)) || !isObj(body.swaps)) return false
  const entries = Object.entries(body.swaps)
  return entries.length <= 60 && entries.every(([k, v]) => ID.test(k) && typeof v === 'string' && ID.test(v))
    && Object.keys(body).every(k => ['kind', 'piece_id', 'plan_sha256', 'swaps', 'at'].includes(k))
}

const secs = (n: number) => { const t = Math.round(n); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }

/** The edit numbers in one plain line. */
export function editLine(e: PlanEdit): string {
  const parts = [`Your take runs ${secs(e.raw_seconds)}`]
  if (e.restarts.length) parts.push(`${e.restarts.length} restarted sentence${e.restarts.length > 1 ? 's' : ''} clipped`)
  if (e.silences_cut) parts.push(`${e.silences_cut} silence${e.silences_cut > 1 ? 's' : ''} cut`)
  parts.push(`${secs(e.kept_seconds)} kept`)
  if (e.over_cap && e.cap_seconds) {
    parts.push(`and even sped up ${Math.round((e.speed - 1) * 100)}% it runs ${secs(e.final_seconds)}, ${Math.ceil(e.final_seconds - e.cap_seconds)} seconds over the ${e.cap_seconds}-second limit, so lines must come out`)
    return `${parts.join(', ')}.`
  }
  if (e.speed > 1.001) parts.push(`sped up ${Math.round((e.speed - 1) * 100)}% to ${secs(e.final_seconds)}${e.cap_seconds ? `, under the ${e.cap_seconds}-second limit` : ''}`)
  else if (e.cap_seconds) parts.push(`under the ${e.cap_seconds}-second limit as it is`)
  return `${parts.join(', ')}.`
}

/** What the card draws: the plan with his swaps, each other option with its Use this press. */
/** How long a plan run may take before the card stops saying it is being made. */
export const PLAN_RUN_MS = 2 * 60 * 60 * 1000
/** The plan run as his press started it (meta.takes_in.plan_run): sent or not, and when. */
export interface PlanRun { sent: boolean; at: string; reason: string | null }
export function planRunOf(takesIn: unknown): PlanRun | null {
  const r = isObj(takesIn) && isObj(takesIn.plan_run) ? takesIn.plan_run : null
  return r && typeof r.sent === 'boolean' && typeof r.at === 'string' ? { sent: r.sent, at: r.at, reason: str(r.reason, 120) } : null
}

export function planView(plan: ProductionPlan | null, ctx: { picks: Array<{ doc_id: string; body: unknown; revision?: number; updated_by?: string | null }>; run: PlanRun | null; now: Date }): Body | null {
  if (!plan) {
    if (!ctx.run) return null
    const age = ctx.now.getTime() - Date.parse(ctx.run.at)
    if (ctx.run.sent && Number.isFinite(age) && age < PLAN_RUN_MS)
      return { status: 'making', line: 'Your production plan is being made from your take: the edit, the picture for every beat, and two or three scenes mocked from real stills. It shows here when it is ready.', made_at: null, edit: null, scenes: [], beats: [] }
    // Never "being made" forever (review, 17 Nov): a run that did not start, or has not filed a plan in two hours.
    return { status: 'not_made', line: `Your production plan was not made (${ctx.run.sent ? 'the plan run has filed nothing in two hours' : 'the plan run did not start'}). The Claude production prompt makes the plan first, then the cut.`,
      made_at: null, edit: null, scenes: [], beats: [] }
  }
  const swaps = swapsOf(ctx.picks as never, plan)
  const revision = ctx.picks.find(p => p.doc_id === planDocId(plan.piece_id))?.revision ?? 0
  const press = (beat: PlanBeat, o: PlanOption) => ({ kind: 'press', label: 'Use this', collection: 'picks', id: planDocId(plan.piece_id), revision,
    body: { kind: 'plan_swaps', piece_id: plan.piece_id, plan_sha256: plan.sha256, swaps: { ...swaps, [beat.id]: o.id } }, stamp: ['at'],
    goes: `Beat ${beat.id} becomes: ${o.what}`, done: 'Swapped. The Claude production prompt now carries it.' })
  const pic = (o: PlanOption) => ({ id: o.id, kind: o.kind, label: PICTURE_KINDS[o.kind], what: o.what, source: o.source, recipe: o.recipe })
  const beats = plan.beats.map(b => {
    const chosen = chosenPicture(b, swaps)
    return { id: b.id, from: b.from, to: b.to, words: b.words, picture: pic(chosen), swapped: chosen.id !== b.picture.id, humour: b.humour,
      options: [b.picture, ...b.options].filter(o => o.id !== chosen.id).map(o => ({ ...pic(o), press: press(b, o) })) }
  })
  return {
    status: 'ready', line: `Your production plan is ready: ${editLine(plan.edit)}${plan.edit_long ? ` The long cut: ${editLine(plan.edit_long).replace(/^Your take/, 'its take')}` : ''} Open it, swap anything that does not work, then copy the Claude production prompt.`,
    made_at: plan.made_at, edit: plan.edit, edit_long: plan.edit_long, style: plan.style, humour: plan.humour,
    scenes: plan.scenes.map(s => {
      const b = beats.find(x => x.id === s.beat)!
      return { beat: s.beat, src: `/api/content-ideas/store?op=read&id=${s.still}`, caption: s.caption, style: s.style, words: b.words, picture: b.picture }
    }),
    beats,
  }
}

/** The plan as the production session reads it: the edit to make, then every beat's picture with his swaps applied. */
export function planBrief(plan: ProductionPlan, swaps: Record<string, string>): string {
  const e = plan.edit
  const beats = plan.beats.map(b => {
    const p = chosenPicture(b, swaps)
    return `- ${b.id} (${b.from.toFixed(1)} to ${b.to.toFixed(1)} s, on the kept take) "${b.words}"\n    picture: ${PICTURE_KINDS[p.kind]}: ${p.what}${p.source ? ` (source: ${p.source})` : ''}`
      + `${p.id !== b.picture.id ? '   [Krish swapped this in]' : ''}${p.recipe ? `\n    recipe: ${p.recipe}` : ''}${b.humour && p.kind === 'humour' ? `\n    the gag: ${b.humour.gag} (${b.humour.mechanism})` : ''}`
  }).join('\n')
  return `The production plan he reviewed (plan sha256 ${plan.sha256.slice(0, 12)}, made ${plan.made_at.slice(0, 16).replace('T', ' ')} UTC; read it whole `
    + 'with read_piece_material, role production_plan). Make exactly this; his swaps are final.\n'
    + `The edit${plan.edit_long ? ' (the short cut)' : ''}: ${editLine(e)}${e.restarts.length ? ` The restarts it found: ${e.restarts.map(r => `at ${r.at.toFixed(1)} s "${r.said}"`).join('; ')}.` : ''} `
    + (plan.edit_long ? `The long cut: ${editLine(plan.edit_long)} `: '')
    + 'Check each cut against the approved words and by ear before you build on it.\n'
    + 'The beat times below are on the edited take before any speed-up: once it is sped up, transcribe the sped file afresh and re-time every '
    + 'beat, cut and caption from that transcript (learning speedup-without-glitches), never by scaling these times.\n'
    + `Styles: look ${plan.style.look ?? 'as picked'}, motion ${plan.style.motion ?? 'as picked'}, captions ${plan.style.captions ?? 'as picked'}.\n`
    + `The beats:\n${beats}\n`
    + (plan.scenes.length ? `The scenes he saw mocked (match them): ${plan.scenes.map(s => `${s.beat} (${s.style})`).join(', ')}.\n` : '')
}
