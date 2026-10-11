// The making record: where one piece is on its way from the workroom to
// every channel, kept on content_ideas.meta.making so Control Center's
// realtime subscription on content_ideas carries every change to the screen
// within a second, with no second table and no polling.
//
// Krish, 2026-10-10: the control centre "becomes more of a progress tracker,
// suggestions compiler, and ideas generator, which then saves my choices to
// the durable system and then a session here picks up that durable system",
// and "it's crucial that everything is fresh and synchronised in real time".
//
// Who writes it: Claude Code sessions (through scripts/post-pack/making.py
// and the pack tools), the control centre's "Make it in Claude Code" button
// (session), and Krish's own cookie when he ticks a channel off. Everything
// here is a record of something that happened; nothing here sends, posts,
// spends or deletes.
//
// The same shape is mirrored in control-center/src/lib/making.ts. Change one,
// change the other (docs/CONTENT_ENGINE.md, "The split").

/** Every channel a piece can go to, in the order Krish posts them
 *  (docs/AMPLIFICATION.md). Krish, 2026-10-11: "I always want to repost to
 *  YouTube and then Shorts, TikTok, and Instagram." The first five are the
 *  standing set; LinkedIn, WhatsApp and Substack Notes stay available when
 *  he wants them and never hold a piece back. */
export const MAKING_CHANNELS = ['substack', 'youtube', 'shorts', 'tiktok', 'reels', 'linkedin', 'whatsapp', 'notes'] as const
export type MakingChannel = (typeof MAKING_CHANNELS)[number]
export const CORE_CHANNELS: readonly MakingChannel[] = ['substack', 'youtube', 'shorts', 'tiktok', 'reels']
export const MAKING_CUTS = ['long', 'short'] as const
export type MakingCut = (typeof MAKING_CUTS)[number]

export interface MakingCheck { passed: boolean; checked_at: string; problems: string[] }
export interface MakingLink { url: string; at: string }
export interface MakingPack { folder: string; packed_at: string; files: number; sent_at?: string; headline?: string }
export interface MakingRecording { cut: MakingCut; path: string; at: string; seconds?: number }
export interface MakingVideoAsset { cut: MakingCut; name: string; path: string; at: string; url?: string; seconds?: number }
export interface MakingChannelPost { url?: string; posted_at: string }
export interface MakingSession { url: string; started_at: string; by: string }

export interface Making {
  workroom?: MakingLink
  publish_manager?: MakingLink
  visual_gate?: MakingCheck
  script_check?: MakingCheck & { cuts?: MakingCut[] }
  pack?: MakingPack
  recordings?: MakingRecording[]
  video_assets?: MakingVideoAsset[]
  channels?: Partial<Record<MakingChannel, MakingChannelPost>>
  session?: MakingSession
  updated_at: string
  by: string
}

export type MakingPatch = Partial<Omit<Making, 'updated_at' | 'by'>>

const MAX_PROBLEMS = 40
const MAX_LIST = 40
const MAX_TEXT = 600

function isObj(v: unknown): v is Record<string, unknown> { return Boolean(v) && typeof v === 'object' && !Array.isArray(v) }
function str(v: unknown, max = MAX_TEXT): string | null { return typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null }
function when(v: unknown, fallback: string): string { const s = str(v, 40); return s && !Number.isNaN(Date.parse(s)) ? s : fallback }
function https(v: unknown): string | null { const s = str(v, 2000); return s && /^https:\/\/\S+$/.test(s) ? s : null }

/** Reads a patch from a request body: unknown keys are dropped, bad values
 *  are reported by name so the caller fixes its call instead of guessing. */
export function parseMakingPatch(body: unknown, now: string): { patch: MakingPatch; problems: string[] } {
  const problems: string[] = []
  const patch: MakingPatch = {}
  if (!isObj(body)) return { patch, problems: ['patch must be an object'] }

  for (const key of ['workroom', 'publish_manager'] as const) {
    if (body[key] === undefined) continue
    const v = body[key]
    const url = https(isObj(v) ? v.url : v)
    if (!url) { problems.push(`${key} needs an https url`); continue }
    patch[key] = { url, at: when(isObj(v) ? v.at : undefined, now) }
  }
  for (const key of ['visual_gate', 'script_check'] as const) {
    if (body[key] === undefined) continue
    const v = body[key]
    if (!isObj(v) || typeof v.passed !== 'boolean') { problems.push(`${key} needs {passed: boolean, problems: string[]}`); continue }
    const list = Array.isArray(v.problems) ? v.problems.filter(p => typeof p === 'string').map(p => String(p).slice(0, MAX_TEXT)).slice(0, MAX_PROBLEMS) : []
    const check: MakingCheck & { cuts?: MakingCut[] } = { passed: v.passed, checked_at: when(v.checked_at, now), problems: list }
    if (key === 'script_check' && Array.isArray(v.cuts)) check.cuts = v.cuts.filter((c): c is MakingCut => (MAKING_CUTS as readonly string[]).includes(String(c)))
    patch[key] = check
  }
  if (body.pack !== undefined) {
    const v = body.pack
    const folder = isObj(v) ? str(v.folder, 200) : null
    if (!folder) problems.push('pack needs {folder, files}')
    else {
      const pack: MakingPack = { folder, packed_at: when(isObj(v) ? v.packed_at : undefined, now), files: Math.max(0, Math.floor(Number((v as any).files) || 0)) }
      const sent = isObj(v) && v.sent_at !== undefined ? when(v.sent_at, now) : null
      if (sent) pack.sent_at = sent
      const headline = isObj(v) ? str(v.headline, 300) : null
      if (headline) pack.headline = headline
      patch.pack = pack
    }
  }
  if (body.recordings !== undefined) {
    if (!Array.isArray(body.recordings)) problems.push('recordings must be a list of {cut, path}')
    else {
      patch.recordings = []
      for (const r of body.recordings.slice(0, MAX_LIST)) {
        const cut = isObj(r) && (MAKING_CUTS as readonly string[]).includes(String(r.cut)) ? (r.cut as MakingCut) : null
        const path = isObj(r) ? str(r.path, 400) : null
        if (!cut || !path) { problems.push('each recording needs cut (long or short) and path'); continue }
        const rec: MakingRecording = { cut, path, at: when(r.at, now) }
        if (Number.isFinite(Number(r.seconds)) && Number(r.seconds) > 0) rec.seconds = Math.round(Number(r.seconds))
        patch.recordings.push(rec)
      }
    }
  }
  if (body.video_assets !== undefined) {
    if (!Array.isArray(body.video_assets)) problems.push('video_assets must be a list of {cut, name, path}')
    else {
      patch.video_assets = []
      for (const a of body.video_assets.slice(0, MAX_LIST)) {
        const cut = isObj(a) && (MAKING_CUTS as readonly string[]).includes(String(a.cut)) ? (a.cut as MakingCut) : null
        const name = isObj(a) ? str(a.name, 200) : null
        const path = isObj(a) ? str(a.path, 400) : null
        if (!cut || !name || !path) { problems.push('each video asset needs cut, name and path'); continue }
        const asset: MakingVideoAsset = { cut, name, path, at: when(a.at, now) }
        const url = https(a.url)
        if (url) asset.url = url
        if (Number.isFinite(Number(a.seconds)) && Number(a.seconds) > 0) asset.seconds = Math.round(Number(a.seconds))
        patch.video_assets.push(asset)
      }
    }
  }
  if (body.channels !== undefined) {
    if (!isObj(body.channels)) problems.push('channels must be an object keyed by channel')
    else {
      patch.channels = {}
      for (const [k, v] of Object.entries(body.channels)) {
        if (!(MAKING_CHANNELS as readonly string[]).includes(k)) { problems.push(`unknown channel "${k}" (${MAKING_CHANNELS.join(', ')})`); continue }
        if (v === null) { (patch.channels as Record<string, unknown>)[k] = null; continue }
        const post: MakingChannelPost = { posted_at: when(isObj(v) ? v.posted_at : undefined, now) }
        const url = https(isObj(v) ? v.url : v)
        if (url) post.url = url
        patch.channels[k as MakingChannel] = post
      }
    }
  }
  if (body.session !== undefined) {
    const v = body.session
    const url = https(isObj(v) ? v.url : v)
    if (!url) problems.push('session needs an https url')
    else patch.session = { url, started_at: when(isObj(v) ? v.started_at : undefined, now), by: (isObj(v) && str(v.by, 60)) || 'Claude Code' }
  }
  return { patch, problems }
}

/** The next record: lists are merged by their key (path, channel), a null
 *  channel removes it, everything else is replaced by the patch. */
export function mergeMaking(prev: Making | null | undefined, patch: MakingPatch, by: string, now: string): Making {
  const base: Making = prev && isObj(prev) ? { ...prev } : { updated_at: now, by }
  const next: Making = { ...base, updated_at: now, by }
  for (const key of ['workroom', 'publish_manager', 'visual_gate', 'script_check', 'pack', 'session'] as const) {
    if (patch[key] !== undefined) (next as any)[key] = patch[key]
  }
  for (const key of ['recordings', 'video_assets'] as const) {
    if (!patch[key]) continue
    const byPath = new Map<string, any>((base[key] || []).map((x: any) => [x.path, x]))
    for (const item of patch[key] as any[]) byPath.set(item.path, item)
    ;(next as any)[key] = [...byPath.values()].slice(-MAX_LIST)
  }
  if (patch.channels) {
    const channels: Making['channels'] = { ...(base.channels || {}) }
    for (const [k, v] of Object.entries(patch.channels)) {
      if (v === null) delete channels[k as MakingChannel]
      else channels[k as MakingChannel] = v as MakingChannelPost
    }
    next.channels = channels
  }
  return next
}

export type MakingStepState = 'done' | 'now' | 'todo' | 'failed'
export type MakingOwner = 'Claude' | 'Krish' | 'Codex'
export interface MakingStep { key: string; label: string; state: MakingStepState; owner: MakingOwner; at?: string; link?: string; note?: string }

/** Who does each step (Krish, 2026-10-11): Claude Code owns ideation, the
 *  article and the publish board; Codex owns video production; Krish records
 *  and posts. A tool never writes a step it does not own. Mirrored in
 *  control-center/src/lib/making.ts and read by both tools' skills. */
/**
 * Whether a piece was made with the making record: any step written by a
 * session, or any channel beyond the Substack post. The publish watcher's
 * first version stamped old pieces with a record holding only the Substack
 * tick (live on 2026-10-11 for Higgsfield and article 1); such a stub is
 * not a record, so those pieces still close their board items on publish.
 */
export function madeWithRecord(meta: Record<string, any> | null | undefined): boolean {
  const m = isObj(meta) && isObj(meta.making) ? meta.making : null
  if (!m) return false
  if (['workroom', 'publish_manager', 'visual_gate', 'script_check', 'pack', 'session'].some(k => isObj(m[k]))) return true
  if (['recordings', 'video_assets'].some(k => Array.isArray(m[k]) && m[k].length > 0)) return true
  return isObj(m.channels) && Object.keys(m.channels).some(c => c !== 'substack')
}

export const MAKING_OWNERS: Record<string, MakingOwner> = {
  workroom: 'Claude', draft: 'Claude', visual_gate: 'Claude', scripts: 'Claude', pack: 'Claude',
  record: 'Krish', video: 'Codex', publish: 'Krish',
}

/** The row of steps a reader sees, from the piece's row. `meta.fact_check`
 *  is the fact gate written by content-ideas/[id]/fact-check.ts. Mirrored in
 *  control-center/src/lib/making.ts. */
export function makingSteps(row: { state?: string | null; meta?: Record<string, any> | null }): MakingStep[] {
  const meta = isObj(row.meta) ? row.meta : {}
  const m = (isObj(meta.making) ? meta.making : {}) as Partial<Making>
  const factGate = isObj(meta.fact_check) ? meta.fact_check : null
  const steps: Array<Omit<MakingStep, 'owner'>> = []
  steps.push(m.workroom ? { key: 'workroom', label: 'Workroom', state: 'done', at: m.workroom.at, link: m.workroom.url } : { key: 'workroom', label: 'Workroom', state: 'todo' })
  const factPassed = factGate ? factGate.passed === true || factGate.status === 'passed' || factGate.ok === true : false
  steps.push(factGate
    ? { key: 'draft', label: 'Fact-checked draft', state: factPassed ? 'done' : 'failed', at: str(factGate.ran_at) || undefined, note: factPassed ? undefined : 'the fact gate did not pass' }
    : { key: 'draft', label: 'Fact-checked draft', state: 'todo' })
  steps.push(m.visual_gate
    ? { key: 'visual_gate', label: 'Visual gate', state: m.visual_gate.passed ? 'done' : 'failed', at: m.visual_gate.checked_at, note: m.visual_gate.passed ? undefined : m.visual_gate.problems[0] }
    : { key: 'visual_gate', label: 'Visual gate', state: 'todo' })
  steps.push(m.script_check
    ? { key: 'scripts', label: 'Scripts', state: m.script_check.passed ? 'done' : 'failed', at: m.script_check.checked_at, note: m.script_check.passed ? (m.script_check.cuts || []).join(' and ') || undefined : m.script_check.problems[0] }
    : { key: 'scripts', label: 'Scripts', state: 'todo' })
  steps.push(m.pack
    ? { key: 'pack', label: m.pack.sent_at ? 'Pack in Drive' : 'Pack built', state: m.pack.sent_at ? 'done' : 'now', at: m.pack.sent_at || m.pack.packed_at, note: m.pack.folder }
    : { key: 'pack', label: 'Pack', state: 'todo' })
  // Both cuts, every piece (TWO_CUTS, Krish, 2026-10-11), whatever cuts a
  // script check recorded: one recording or one video never finishes a step.
  const recorded = new Set((m.recordings || []).map(r => r.cut))
  const missingCuts = MAKING_CUTS.filter(c => !recorded.has(c))
  steps.push(recorded.size
    ? { key: 'record', label: 'Recorded', state: missingCuts.length ? 'now' : 'done', at: (m.recordings || []).map(r => r.at).sort().pop(), note: missingCuts.length ? `${missingCuts.join(' and ')} cut still to record` : undefined }
    : { key: 'record', label: 'Record', state: 'todo' })
  const assets = m.video_assets || []
  const produced = new Set(assets.map(a => a.cut))
  const missingAssets = MAKING_CUTS.filter(c => !produced.has(c))
  steps.push(assets.length
    ? { key: 'video', label: 'Video assets', state: missingAssets.length ? 'now' : 'done', at: assets.map(a => a.at).sort().pop(), note: missingAssets.length ? `${missingAssets.join(' and ')} cut still to produce` : `${assets.length} file${assets.length === 1 ? '' : 's'}` }
    : { key: 'video', label: 'Video assets', state: 'todo' })
  // The publish step is done when the standing five are ticked (Krish,
  // 2026-10-11). State 'published' means the Substack post is live
  // (publish/watch.ts), so it counts as Substack's tick and nothing more.
  const isOut = (c: MakingChannel) => Boolean(m.channels?.[c]) || (c === 'substack' && row.state === 'published')
  const posted = MAKING_CHANNELS.filter(c => m.channels?.[c])
  const core = CORE_CHANNELS.filter(isOut)
  const allFive = core.length === CORE_CHANNELS.length
  steps.push(posted.length || row.state === 'published'
    ? { key: 'publish', label: 'Published', state: allFive ? 'done' : 'now', at: posted.map(c => m.channels![c]!.posted_at).sort().pop(), note: `${row.state === 'published' && !allFive ? 'Substack is out; ' : ''}${core.length} of ${CORE_CHANNELS.length} channels` }
    : { key: 'publish', label: 'Publish', state: 'todo' })
  // The first step that is not done is where the piece is now.
  const first = steps.find(s => s.state === 'todo' || s.state === 'failed' || s.state === 'now')
  if (first && first.state === 'todo') first.state = 'now'
  return steps.map(s => ({ ...s, owner: MAKING_OWNERS[s.key] || 'Claude' }))
}
