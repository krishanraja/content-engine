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
// Who writes it: Claude Code and Codex sessions (through
// scripts/post-pack/making.py, whose --by names the tool on every write, and
// the pack tools), scripts/post-pack/recording_match.py when it ties a take in
// the Inbox to its piece, the control centre's "Make it in Claude Code" button
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
/** The scripts' check. `hashes` is the sha256 of each cut's words
 *  (scripts/post-pack/making.py script_hash: NFC, LF line endings, trailing
 *  spaces stripped, blank lines trimmed at both ends). `checked_at` moves
 *  only when the words change, so re-checking the same words never makes a
 *  take look older than its script. `changed_at` is when each cut's words
 *  last changed, so a change to one cut never makes the other's take look
 *  old (scripts/post-pack/recording_match.py's time rule). */
export type MakingScriptCheck = MakingCheck & { cuts?: MakingCut[]; hashes?: Partial<Record<MakingCut, string>>; changed_at?: Partial<Record<MakingCut, string>> }
export interface MakingLink { url: string; at: string }
export interface MakingPack { folder: string; packed_at: string; files: number; sent_at?: string; headline?: string }
/** A recording's path is the engine's copy, `recordings/<sha256>.<ext>`
 *  (scripts/post-pack/recording_match.py writes it so), which says exactly
 *  which take it was and lets the next match skip it. `script_sha256` is the
 *  hash of the script it was taken from; a take of an older script stops
 *  counting (makingSteps). A take with none was recorded before the hashes
 *  were kept, and still counts. `use_words` are Krish's words letting a take
 *  of older words count for the current script (making.py --krish-words). */
export interface MakingRecording { cut: MakingCut; path: string; at: string; seconds?: number; script_sha256?: string; use_words?: string }
/** The thumbnail made with a cut, beside it in the pack (Krish, 2026-10-12:
 *  "I always want a video thumbnail for all video sizes produced as an asset
 *  every time"). */
export interface MakingThumbnail { path: string; url?: string }
/** `music` is the licensed track's id in config/music-library.json. */
export interface MakingVideoAsset { cut: MakingCut; name: string; path: string; at: string; url?: string; seconds?: number; thumbnail?: MakingThumbnail; music?: string }
export interface MakingChannelPost { url?: string; posted_at: string }
export interface MakingSession { url: string; started_at: string; by: string }
/** Where one cut's script is in Descript (Krish, 2026-10-12: "Descript is
 *  now my tool of choice for video script readouts on my phone - scripts
 *  should automatically be sent there, with the ability for Descript to put
 *  the video in the correct place when recorded"). One view-access project
 *  per cut with two compositions: Script, the pages video he reads, and
 *  Record here, where he records. `script_sha256` is the hash of the words
 *  the Script composition holds; `known_media` is every media name the
 *  project held after the send, so a take recorded there later is a name
 *  not on it; `error` says why the last send failed and `failed_at` when, on
 *  the project the cut already had, alone when it had none, or on the bare
 *  project import_media made before the send failed (project_id and no
 *  compositions), which the next send finishes rather than making a second.
 *  Written by scripts/post-pack/descript_send.py record (making.py descript). */
export interface MakingDescriptCut {
  project_id?: string
  script_composition?: string
  record_composition?: string
  script_link?: string
  record_link?: string
  script_sha256?: string
  media?: string
  known_media?: string[]
  sent_at: string
  by: string
  error?: string
  failed_at?: string
}
export interface MakingDescript { drive_id: string; cuts: Partial<Record<MakingCut, MakingDescriptCut>> }

export interface Making {
  /** When the record began: written on its first write and never moved, so
   *  re-running a step never makes a take look as if it came before the
   *  piece (recording_match.py's lower bound). */
  started_at?: string
  workroom?: MakingLink
  publish_manager?: MakingLink
  visual_gate?: MakingCheck
  script_check?: MakingScriptCheck
  pack?: MakingPack
  recordings?: MakingRecording[]
  video_assets?: MakingVideoAsset[]
  channels?: Partial<Record<MakingChannel, MakingChannelPost>>
  session?: MakingSession
  /** Where each cut's script is in Descript; merged cut by cut. */
  descript?: MakingDescript
  updated_at: string
  by: string
}

export type MakingPatch = Partial<Omit<Making, 'updated_at' | 'by' | 'started_at'>>

const MAX_PROBLEMS = 40
const MAX_LIST = 40
const MAX_TEXT = 600

function isObj(v: unknown): v is Record<string, unknown> { return Boolean(v) && typeof v === 'object' && !Array.isArray(v) }
function str(v: unknown, max = MAX_TEXT): string | null { return typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null }
function when(v: unknown, fallback: string): string { const s = str(v, 40); return s && !Number.isNaN(Date.parse(s)) ? s : fallback }
function https(v: unknown): string | null { const s = str(v, 2000); return s && /^https:\/\/\S+$/.test(s) ? s : null }
/** A script's sha256, as making.py script_hash writes it. */
export const SCRIPT_SHA256 = /^[a-f0-9]{64}$/
/** A Descript drive, project or composition id. */
export const DESCRIPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const MAX_KNOWN_MEDIA = 100

/** One cut of a descript patch, or the reason it is refused. */
function parseDescriptCut(cut: string, v: unknown, by: string, now: string): { entry?: MakingDescriptCut; problem?: string } {
  const at = `descript.cuts.${cut}`
  if (!(MAKING_CUTS as readonly string[]).includes(cut)) return { problem: `unknown cut "${cut}" in descript.cuts (long, short)` }
  if (!isObj(v)) return { problem: `${at} must be an object` }
  const entry: MakingDescriptCut = { sent_at: when(v.sent_at, now), by: str(v.by, 60) || by }
  if (v.error !== undefined) {
    const error = str(v.error)
    if (!error) return { problem: `${at}.error is what Descript said, at most ${MAX_TEXT} characters` }
    entry.error = error
    entry.failed_at = when(v.failed_at, now)
  }
  if (v.project_id === undefined) {
    // A send that failed before any project was made: the error alone.
    return entry.error ? { entry } : { problem: `${at} needs project_id and its compositions, or the error that stopped the send` }
  }
  const project = typeof v.project_id === 'string' && DESCRIPT_ID.test(v.project_id) ? v.project_id : null
  if (!project) return { problem: `${at}.project_id is the Descript project's id, a lower case uuid` }
  if (entry.error && v.script_composition === undefined && v.record_composition === undefined) {
    // import_media made the project, then the send failed: kept, so the next send finishes it there.
    entry.project_id = project
    return { entry }
  }
  for (const key of ['script_composition', 'record_composition'] as const) {
    if (typeof v[key] !== 'string' || !DESCRIPT_ID.test(v[key] as string)) return { problem: `${at}.${key} is a Descript composition id, a lower case uuid` }
  }
  if (v.script_composition === v.record_composition) return { problem: `${at}: the Script and Record here compositions are two different compositions` }
  const link = new RegExp(`^https://web\\.descript\\.com/${project}/[A-Za-z0-9]{5}$`)
  for (const key of ['script_link', 'record_link'] as const) {
    if (typeof v[key] !== 'string' || !link.test(v[key] as string)) return { problem: `${at}.${key} opens a composition of its project: https://web.descript.com/${project}/<short id>` }
  }
  if (typeof v.script_sha256 !== 'string' || !SCRIPT_SHA256.test(v.script_sha256)) return { problem: `${at}.script_sha256 is the sha256 of the words the Script composition holds, 64 lowercase hex characters` }
  const media = str(v.media, 200)
  const known = Array.isArray(v.known_media) ? v.known_media : null
  if (!media) return { problem: `${at}.media is the name the pages video was uploaded under` }
  if (!known || !known.length || known.length > MAX_KNOWN_MEDIA || !known.every(n => typeof n === 'string' && str(n, 200) === n)) {
    return { problem: `${at}.known_media is every media name the project lists, 1 to ${MAX_KNOWN_MEDIA} names` }
  }
  if (!known.includes(media)) return { problem: `${at}.known_media does not hold its media, "${media}"` }
  Object.assign(entry, {
    project_id: project, script_composition: v.script_composition, record_composition: v.record_composition,
    script_link: v.script_link, record_link: v.record_link, script_sha256: v.script_sha256, media, known_media: [...new Set(known as string[])],
  })
  return { entry }
}

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
    const check: MakingScriptCheck = { passed: v.passed, checked_at: when(v.checked_at, now), problems: list }
    if (key === 'script_check' && Array.isArray(v.cuts)) check.cuts = v.cuts.filter((c): c is MakingCut => (MAKING_CUTS as readonly string[]).includes(String(c)))
    if (key === 'script_check' && v.hashes !== undefined) {
      const entries = isObj(v.hashes) ? Object.entries(v.hashes) : null
      if (!entries || !entries.every(([c, h]) => (MAKING_CUTS as readonly string[]).includes(c) && typeof h === 'string' && SCRIPT_SHA256.test(h))) {
        problems.push('script_check.hashes is the sha256 of each cut\'s script: {long, short}, each 64 lowercase hex characters')
        continue
      }
      check.hashes = Object.fromEntries(entries) as Partial<Record<MakingCut, string>>
    }
    if (key === 'script_check' && v.changed_at !== undefined) {
      const entries = isObj(v.changed_at) ? Object.entries(v.changed_at) : null
      if (!entries || !entries.every(([c, t]) => (MAKING_CUTS as readonly string[]).includes(c) && typeof t === 'string' && t.length <= 40 && !Number.isNaN(Date.parse(t)))) {
        problems.push('script_check.changed_at is when each cut\'s words last changed: {long, short}, each a time')
        continue
      }
      check.changed_at = Object.fromEntries(entries) as Partial<Record<MakingCut, string>>
    }
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
        if (r.script_sha256 !== undefined) {
          if (typeof r.script_sha256 !== 'string' || !SCRIPT_SHA256.test(r.script_sha256)) { problems.push(`the ${cut} recording's script_sha256 is the sha256 of the script it was taken from, 64 lowercase hex characters`); continue }
          rec.script_sha256 = r.script_sha256
        }
        if (r.use_words !== undefined) {
          const words = str(r.use_words)
          if (!words || !/^krish/i.test(words)) { problems.push(`the ${cut} recording's use_words are Krish's own words, starting "Krish", at most ${MAX_TEXT} characters`); continue }
          rec.use_words = words
        }
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
        if (a.thumbnail !== undefined) {
          const t = a.thumbnail
          const thumbPath = str(isObj(t) ? t.path : t, 400)
          const thumbUrl = isObj(t) && t.url !== undefined ? https(t.url) : null
          if (!thumbPath || (isObj(t) && t.url !== undefined && !thumbUrl)) { problems.push(`the ${cut} cut's thumbnail needs a path, and an https url if it has one`); continue }
          asset.thumbnail = thumbUrl ? { path: thumbPath, url: thumbUrl } : { path: thumbPath }
        }
        if (a.music !== undefined) {
          const music = str(a.music, 120)
          if (!music) { problems.push(`the ${cut} cut's music is the track id from config/music-library.json`); continue }
          asset.music = music
        }
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
  if (body.descript !== undefined) {
    const v = isObj(body.descript) ? body.descript : {}
    const drive = typeof v.drive_id === 'string' && DESCRIPT_ID.test(v.drive_id) ? v.drive_id : null
    if (!drive) problems.push('descript needs drive_id, the Descript drive\'s id (a lower case uuid)')
    else if (!isObj(v.cuts) || !Object.keys(v.cuts).length) problems.push('descript.cuts needs the long or short cut')
    else {
      const cuts: MakingDescript['cuts'] = {}
      const before = problems.length
      for (const [cut, c] of Object.entries(v.cuts)) {
        const { entry, problem } = parseDescriptCut(cut, c, str(body.by, 60) || 'Claude Code', now)
        if (problem) problems.push(problem)
        else cuts[cut as MakingCut] = entry
      }
      if (problems.length === before) patch.descript = { drive_id: drive, cuts }
    }
  }
  return { patch, problems }
}

/** The record's stamp for a write at `now`: later than the record's own,
 *  even when this server's clock runs a little behind the last writer's, so
 *  a newer record always carries a later updated_at. The database keeps the
 *  record with the later stamp when a stale copy of meta is written back
 *  (supabase/migrations/20261012120000_keep_newer_making.sql). */
export function makingStamp(prev: Pick<Making, 'updated_at'> | null | undefined, now: string): string {
  const before = prev && typeof prev.updated_at === 'string' ? Date.parse(prev.updated_at) : NaN
  const at = Date.parse(now)
  return !Number.isNaN(before) && !Number.isNaN(at) && at <= before ? new Date(before + 1).toISOString() : now
}

/** When a record from before started_at was kept began: the earliest time
 *  any of its steps holds. */
function earliestStep(m: Partial<Making>): string | undefined {
  const times = [
    m.workroom?.at, m.publish_manager?.at, m.visual_gate?.checked_at, m.script_check?.checked_at, m.pack?.packed_at, m.session?.started_at,
    ...(m.recordings || []).map(r => r.at), ...(m.video_assets || []).map(a => a.at),
    ...Object.values(m.channels || {}).map(c => c?.posted_at),
  ].filter((t): t is string => typeof t === 'string' && !Number.isNaN(Date.parse(t)))
  return times.sort((a, b) => Date.parse(a) - Date.parse(b))[0]
}

/** The next record: lists are merged by their key (path, channel), a null
 *  channel removes it, everything else is replaced by the patch. started_at
 *  is set on the first write (or, for a record from before it was kept,
 *  from its earliest step) and never moves; updated_at always moves on. */
export function mergeMaking(prev: Making | null | undefined, patch: MakingPatch, by: string, now: string): Making {
  const base: Making = prev && isObj(prev) ? { ...prev } : { updated_at: now, by }
  const stamp = makingStamp(prev && isObj(prev) ? prev : null, now)
  const started = typeof base.started_at === 'string' && !Number.isNaN(Date.parse(base.started_at))
    ? base.started_at : (prev && isObj(prev) ? earliestStep(prev) : undefined) || stamp
  const next: Making = { ...base, started_at: started, updated_at: stamp, by }
  for (const key of ['workroom', 'publish_manager', 'visual_gate', 'script_check', 'pack', 'session'] as const) {
    if (patch[key] !== undefined) (next as any)[key] = patch[key]
  }
  for (const key of ['recordings', 'video_assets'] as const) {
    if (!patch[key]) continue
    const byPath = new Map<string, any>(((base[key] || []) as any[]).map((x: any): [string, any] => [x.path, x]))
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
  if (patch.descript) {
    // Cut by cut: a send of one cut keeps the other. A different drive's
    // projects are not this drive's, so they go.
    const held = isObj(base.descript) && base.descript.drive_id === patch.descript.drive_id && isObj(base.descript.cuts) ? base.descript.cuts : {}
    next.descript = { drive_id: patch.descript.drive_id, cuts: { ...held, ...patch.descript.cuts } }
  }
  return next
}

export type MakingStepState = 'done' | 'now' | 'todo' | 'failed'
export type MakingOwner = 'Claude' | 'Krish' | 'Codex'
export interface MakingStep { key: string; label: string; state: MakingStepState; owner: MakingOwner; at?: string; link?: string; note?: string }

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

/** Whether a take counts for its cut: it has no script_sha256 (recorded
 *  before the hashes were kept), the check holds no hash for its cut, or the
 *  two are the same script. Mirrored in control-center/src/lib/making.ts. */
export function takeCounts(take: Pick<MakingRecording, 'cut' | 'script_sha256'>, check: MakingScriptCheck | null | undefined): boolean {
  const current = check?.hashes?.[take.cut]
  return !take.script_sha256 || !current || take.script_sha256 === current
}

/** What Descript holds for each cut against the words the scripts' check
 *  passed: 'in' (those words), 'older' (words that changed since), 'failed'
 *  (the last send failed), 'missing' (never sent). Only for a check that
 *  passed with hashes, since a send needs them. Mirrored in
 *  control-center/src/lib/making.ts and making.py descript_state. */
export type DescriptState = 'in' | 'older' | 'failed' | 'missing'
export function descriptStates(m: Partial<Making>): Partial<Record<MakingCut, DescriptState>> {
  const out: Partial<Record<MakingCut, DescriptState>> = {}
  const check = m.script_check
  if (!check?.passed || !isObj(check.hashes)) return out
  for (const cut of MAKING_CUTS) {
    const hash = check.hashes[cut]
    if (!hash) continue
    const sent = isObj(m.descript) && isObj(m.descript.cuts) ? m.descript.cuts[cut] : undefined
    out[cut] = sent?.error ? 'failed' : !sent?.project_id ? 'missing' : sent.script_sha256 === hash ? 'in' : 'older'
  }
  return out
}

/** The Scripts step's word on Descript: "in Descript", "Descript has an
 *  older script", "the Descript send failed" or "not in Descript yet",
 *  naming the cut when only one is so. Never holds the step back. */
export function descriptNote(m: Partial<Making>): string {
  const states = descriptStates(m)
  const cuts = MAKING_CUTS.filter(c => states[c])
  if (!cuts.length) return ''
  const of = (s: DescriptState) => cuts.filter(c => states[c] === s)
  if (of('in').length === cuts.length) return 'in Descript'
  const which = (list: MakingCut[]) => (list.length === cuts.length ? '' : ` for the ${list.join(' and ')} cut`)
  return [
    of('older').length ? `Descript has an older script${which(of('older'))}` : '',
    of('failed').length ? `the Descript send failed${which(of('failed'))}` : '',
    of('missing').length ? `not in Descript yet${which(of('missing'))}` : '',
  ].filter(Boolean).join('; ')
}

/** Who does each step (Krish, 2026-10-11): Claude Code owns ideation, the
 *  article and the publish board; Codex owns video production; Krish records
 *  and posts. A tool never writes a step it does not own. Mirrored in
 *  control-center/src/lib/making.ts and read by both tools' skills. */
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
  // Where the scripts are in Descript is said on the step and never holds it back.
  steps.push(m.script_check
    ? { key: 'scripts', label: 'Scripts', state: m.script_check.passed ? 'done' : 'failed', at: m.script_check.checked_at, note: m.script_check.passed ? [(m.script_check.cuts || []).join(' and '), descriptNote(m)].filter(Boolean).join('; ') || undefined : m.script_check.problems[0] }
    : { key: 'scripts', label: 'Scripts', state: 'todo' })
  steps.push(m.pack
    ? { key: 'pack', label: m.pack.sent_at ? 'Pack in Drive' : 'Pack built', state: m.pack.sent_at ? 'done' : 'now', at: m.pack.sent_at || m.pack.packed_at, note: m.pack.folder }
    : { key: 'pack', label: 'Pack', state: 'todo' })
  // Both cuts, every piece (TWO_CUTS, Krish, 2026-10-11), whatever cuts a
  // script check recorded: one recording or one video never finishes a step.
  // A take counts only for the script it was taken from: one whose
  // script_sha256 is not the current hash for its cut was recorded from words
  // that have changed since (a take with no hash predates the hashes).
  const takes = m.recordings || []
  const recorded = new Set(takes.filter(r => takeCounts(r, m.script_check)).map(r => r.cut))
  const olderScript = MAKING_CUTS.filter(c => !recorded.has(c) && takes.some(r => r.cut === c))
  const missingCuts = MAKING_CUTS.filter(c => !recorded.has(c) && !olderScript.includes(c))
  const recordTodo = [
    olderScript.length ? `${olderScript.join(' and ')} cut recorded from an older script` : '',
    missingCuts.length ? `${missingCuts.join(' and ')} cut still to record` : '',
  ].filter(Boolean).join('; ')
  steps.push(takes.length
    ? { key: 'record', label: 'Recorded', state: recordTodo ? 'now' : 'done', at: takes.map(r => r.at).sort().pop(), note: recordTodo || undefined }
    : { key: 'record', label: 'Record', state: 'todo' })
  // A thumbnail for every size, every time (Krish, 2026-10-12): a cut is
  // made only when its video and its thumbnail are both on the record.
  const assets = m.video_assets || []
  const produced = new Set(assets.map(a => a.cut))
  const missingAssets = MAKING_CUTS.filter(c => !produced.has(c))
  const thumbed = new Set(assets.filter(a => a.thumbnail?.path).map(a => a.cut))
  const missingThumbs = MAKING_CUTS.filter(c => produced.has(c) && !thumbed.has(c))
  const videoTodo = [
    missingAssets.length ? `${missingAssets.join(' and ')} cut still to produce` : '',
    missingThumbs.length ? `${missingThumbs.join(' and ')} cut thumbnail${missingThumbs.length === 1 ? '' : 's'} still to make` : '',
  ].filter(Boolean).join('; ')
  steps.push(assets.length
    ? { key: 'video', label: 'Video assets', state: videoTodo ? 'now' : 'done', at: assets.map(a => a.at).sort().pop(), note: videoTodo || `${assets.length} file${assets.length === 1 ? '' : 's'}` }
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
