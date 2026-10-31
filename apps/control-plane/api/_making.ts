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

import { activeManualReviews, bodyHash, effectiveBlocking } from './_factGate.js'
import { MediaRefSchema, mediaReviewProblems, type MediaRef } from '../../../packages/core/src/media-quality.js'
import { mediaQualityEnforced } from '../../../packages/core/src/media-rollout.js'
import type { ClipPlacement, ClipUseRecord } from './_routedClips.js'

/** Every channel a piece can go to, in the order Krish posts them
 *  (docs/AMPLIFICATION.md). Krish, 2026-10-11: "I always want to repost to
 *  YouTube and then Shorts, TikTok, and Instagram." The first five are the
 *  standing set; LinkedIn, WhatsApp and Substack Notes stay available when
 *  he wants them and never hold a piece back. */
// feature_youtube and feature_spotify: the 15-minute feature's own two posts, on a feature piece only (config/board-layout.json).
// instagram, x, threads and facebook: posts Growth makes and reports through POST /api/board/<Monday>/posted (2026-10-30).
export const MAKING_CHANNELS = ['substack', 'youtube', 'shorts', 'tiktok', 'reels', 'linkedin', 'whatsapp', 'notes', 'spotify', 'feature_youtube', 'feature_spotify', 'instagram', 'x', 'threads', 'facebook'] as const
export type MakingChannel = (typeof MAKING_CHANNELS)[number]
export const CORE_CHANNELS: readonly MakingChannel[] = ['substack', 'youtube', 'shorts', 'tiktok', 'reels']
/** The two cuts every piece gets (house rule TWO_CUTS). */
export const MAKING_CUTS = ['long', 'short'] as const
/** Every cut a record can hold: the two, and the 15-minute feature on a
 *  piece Krish called one for (house rule FEATURE; Krish, 2026-10-21: "From
 *  time to time I might do a special 15 min feature"; config/features.json,
 *  read by scripts/post-pack/making.py, which records the feature's hash
 *  only on such a piece). A record holding a feature hash needs the feature
 *  recorded and produced too (makingCuts). */
export const MAKING_ALL_CUTS = ['long', 'short', 'feature'] as const
export type MakingCut = (typeof MAKING_ALL_CUTS)[number]
function isCut(c: unknown): c is MakingCut { return (MAKING_ALL_CUTS as readonly string[]).includes(String(c)) }

export interface MakingCheck { passed: boolean; checked_at: string; problems: string[] }
/** The scripts' check. `hashes` is the sha256 of each cut's words
 *  (scripts/post-pack/making.py script_hash: NFC, LF line endings, trailing
 *  spaces stripped, blank lines trimmed at both ends). `checked_at` moves
 *  only when the words change, so re-checking the same words never makes a
 *  take look older than its script. `changed_at` is when each cut's words
 *  last changed, so a change to one cut never makes the other's take look
 *  old (scripts/post-pack/recording_match.py's time rule). */
export type MakingScriptCheck = MakingCheck & { cuts?: MakingCut[]; hashes?: Partial<Record<MakingCut, string>>; changed_at?: Partial<Record<MakingCut, string>>; read_back?: Partial<Record<MakingCut, MakingReadBack>>; /** The one question the piece answers (house rule ONE_SPINE): the publish page then needs a passing spine check. */ spine?: string; /** An off-day piece he records is one short cut (Ruling, Krish, 2026-10-29), written by the server when he approves its option; makingCuts then asks for the short alone. */ one_cut?: boolean }
/** A cut read back by two fresh readers, each an ordinary 12-year-old
 *  hearing it once, who found nothing that lost them (house rule R7, the hard
 *  gate on every script; Krish, 2026-10-12: "Every single script should be
 *  understandable by a 12-year-old"). `script_sha256` is the hash of the
 *  words they heard: a read-back holds only while the cut's words are the
 *  same. Written by making.py read-back; only a pass is recorded. Krish's
 *  own sign-off stands in for the readers when he gives it in words (Krish,
 *  2026-10-14: "Fix it in the engine"): found 'approved by Krish', with his
 *  words in `krish_words` (starting "Krish"), and any readers who heard it. */
export interface MakingReadBack { script_sha256: string; at: string; by: string; readers: string[]; found: 'nothing lost' | 'approved by Krish'; krish_words?: string }
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
export interface MakingVideoAsset { cut: MakingCut; name: string; path: string; at: string; url?: string; seconds?: number; thumbnail?: MakingThumbnail; music?: string; sha256?: string; quality_receipt?: MediaRef; quality_review?: unknown }
/** buffer_post_id: the Buffer post Growth posted it with (board/_posted.ts), when Growth posted it. */
export interface MakingChannelPost { url?: string; posted_at: string; buffer_post_id?: string }
export interface MakingSession { url: string; started_at: string; by: string }
/** Where one cut's script is in Krish's teleprompter.com account. Krish,
 *  2026-10-12: "Also note that Descript is permanently gone, teleprompter.com
 *  is permanently in, connected via MCP here", on these terms: "One script
 *  per cut, in a folder per piece (e.g. "Mon 12 Oct follow.the.money"). When
 *  the words change, the same script is updated in place. Nothing is ever
 *  deleted." His standing yes of that day ("Yes, automatic, Monday now")
 *  gave way on 2026-10-28 to "Once I approve, the two scripts will go to
 *  teleprompter": a script goes only once he approves its exact words. `script_id` is the script's id (an
 *  uppercase UUID), `title` its title, and `script_sha256` the hash of the
 *  words it holds (making.py script_hash); `error` says why the last send
 *  failed and `failed_at` when, on the script the cut already had, or alone
 *  when none was made. Written by scripts/post-pack/teleprompter_send.py
 *  record (making.py teleprompter), or by teleprompterPatch
 *  (api/_teleprompter.ts) after a server send. */
export interface MakingTeleprompterCut {
  script_id?: string
  title?: string
  script_sha256?: string
  sent_at: string
  by: string
  error?: string
  failed_at?: string
}
/** The piece's one folder and its scripts, merged cut by cut. `folder_id`
 *  is absent only while no folder was made (a send that failed first). */
export interface MakingTeleprompter { folder_id?: string; folder_name?: string; cuts: Partial<Record<MakingCut, MakingTeleprompterCut>> }

/** The choices Krish put under test (Rulings, Krish, 2026-10-29: "we need to
 *  test and learn"): which opening, which lead picture and which sound on the
 *  big moment this piece used, so a retrospective can join each to how the
 *  piece did. The defaults and their options live once, in
 *  config/reference-cuts.json `under_test`; this record keeps only what was
 *  used, merged choice by choice. A record, never a gate. */
export const PRODUCTION_CHOICES = ['opening', 'lead_picture', 'big_moment_sound'] as const
export type ProductionChoice = (typeof PRODUCTION_CHOICES)[number]
export type MakingProductionChoices = Partial<Record<ProductionChoice, string>> & { at: string }
const CHOICE_VALUE = /^[a-z][a-z0-9_]{0,59}$/

/** What Krish changed reading one cut's script aloud (scripts/voice/spoken_delta.py): counts, rates and a
 *  few short examples, never the transcript (Krish, 2026-10-31: "start the script vs recording comparison"). */
export const SPOKEN_COUNTS = ['words_script', 'words_said', 'kept', 'swapped', 'cut', 'added', 'contracted', 'expanded', 'changes'] as const
export const SPOKEN_KINDS = ['swapped', 'cut', 'added', 'contracted', 'expanded'] as const
const SPOKEN_EXAMPLES = 8
const SPOKEN_EXAMPLE_CHARS = 120
export interface MakingSpokenExample { script: string; said: string }
export type MakingSpokenDelta = Record<(typeof SPOKEN_COUNTS)[number], number> & {
  minutes: number | null
  changes_per_minute: number | null
  changes_per_100_words: number | null
  examples: Partial<Record<(typeof SPOKEN_KINDS)[number], MakingSpokenExample[]>>
  script_sha256: string
  at: string
}

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
  /** Where each cut's script is in Teleprompter; merged cut by cut. */
  teleprompter?: MakingTeleprompter
  /** What the piece used of each choice under test; merged choice by choice. */
  production_choices?: MakingProductionChoices
  /** What he changed reading each cut aloud; merged cut by cut. */
  spoken_delta?: Partial<Record<MakingCut, MakingSpokenDelta>>
  /** Where each cut plays the Inspiration clips routed to the piece (_routedClips.ts), keyed by card id; merged
   *  cut by cut and clip by clip. making.py video refuses a cut that leaves out a clip his words say to play with
   *  its sound. */
  clip_placements?: Partial<Record<MakingCut, Record<string, ClipPlacement>>>
  /** Krish's own words on how a linked card is used (show_with_sound or reference), keyed by card id; merged card by
   *  card. Never inferred: a card with no entry is a reference. */
  clip_uses?: Record<string, ClipUseRecord>
  /** Retired on 2026-10-12, when Descript was (Krish: "Descript is
   *  permanently gone"). Records written before then still hold it; it is
   *  kept as it is, so they still parse, and nothing reads it. */
  descript?: unknown
  updated_at: string
  by: string
}

export type MakingPatch = Partial<Omit<Making, 'updated_at' | 'by' | 'started_at' | 'descript'>>

const MAX_PROBLEMS = 40
const MAX_LIST = 40
const MAX_TEXT = 600

function isObj(v: unknown): v is Record<string, unknown> { return Boolean(v) && typeof v === 'object' && !Array.isArray(v) }
function str(v: unknown, max = MAX_TEXT): string | null { return typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null }
function when(v: unknown, fallback: string): string { const s = str(v, 40); return s && !Number.isNaN(Date.parse(s)) ? s : fallback }
function https(v: unknown): string | null { const s = str(v, 2000); return s && /^https:\/\/\S+$/.test(s) ? s : null }
/** A script's sha256, as making.py script_hash writes it. */
export const SCRIPT_SHA256 = /^[a-f0-9]{64}$/
/** A Teleprompter folder or script id: an uppercase UUID. */
export const TELEPROMPTER_ID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/
/** Teleprompter's limit on a folder name and a script title. */
const MAX_TELEPROMPTER_NAME = 200

function count(v: unknown): number | null { return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100000 ? v : null }
function rate(v: unknown): number | null | undefined { return v === null ? null : typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000 ? v : undefined }

const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SECONDS_MAX = 4 * 3600
function seconds(v: unknown): number | null | undefined {
  if (v === undefined) return undefined
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= SECONDS_MAX ? Math.round(v * 100) / 100 : null
}

/** One clip's place in one cut. Playing it, with its sound on or off, gives where (at_s, and end_s when known); leaving
 *  it out is omitted: true. Silence and leaving it out each take his words ("Krish, YYYY-MM-DD: ..."), checked again by
 *  missingClips, so a session never decides either alone. */
function parseClipPlacement(at: string, card: string, v: unknown, by: string, now: string): { entry?: ClipPlacement; problem?: string } {
  if (!CARD_ID.test(card)) return { problem: `${at}: the key is the Inspiration card's id (inspiration_items.id, a uuid)` }
  if (!isObj(v)) return { problem: `${at} must be an object` }
  const said = v.said === undefined ? undefined : str(v.said, MAX_TEXT)
  if (said === null || (said !== undefined && !/^Krish\b/.test(said))) return { problem: `${at}.said is Krish's own words, starting "Krish" and the date` }
  if (v.omitted === true) {
    if (!said) return { problem: `${at}: leaving a routed clip out of a cut takes Krish's words in said` }
    return { entry: { omitted: true, said, at: when(v.at, now), by } }
  }
  if (v.omitted !== undefined && v.omitted !== false) return { problem: `${at}.omitted is true or left out` }
  const start = seconds(v.at_s)
  const end = seconds(v.end_s)
  if (start === undefined || start === null) return { problem: `${at}.at_s is where the clip starts in the cut, in seconds` }
  if (end === null || (end !== undefined && end <= start)) return { problem: `${at}.end_s is where it ends, after at_s` }
  if (v.audio !== 'on' && v.audio !== 'off') return { problem: `${at}.audio is on or off: whether the clip's own sound plays` }
  if (v.audio === 'off' && !said) return { problem: `${at}: playing a routed clip silent takes Krish's words in said` }
  return { entry: { at_s: start, ...(end !== undefined ? { end_s: end } : {}), audio: v.audio, ...(said ? { said } : {}), at: when(v.at, now), by } }
}

/** One cut of a spoken_delta patch, or the reason it is refused. Only counts and short examples are taken. */
function parseSpokenDelta(cut: string, v: unknown, now: string): { entry?: MakingSpokenDelta; problem?: string } {
  const at = `spoken_delta.${cut}`
  if (!isCut(cut)) return { problem: `unknown cut "${cut}" in spoken_delta (long, short, feature)` }
  if (!isObj(v)) return { problem: `${at} must be an object` }
  const nums: Partial<Record<(typeof SPOKEN_COUNTS)[number], number>> = {}
  for (const k of SPOKEN_COUNTS) {
    const n = count(v[k])
    if (n === null) return { problem: `${at}.${k} is a whole number of words` }
    nums[k] = n
  }
  const rates: Record<string, number | null> = {}
  for (const k of ['minutes', 'changes_per_minute', 'changes_per_100_words'] as const) {
    const r = rate(v[k])
    if (r === undefined) return { problem: `${at}.${k} is a number or null` }
    rates[k] = r
  }
  const sha = typeof v.script_sha256 === 'string' && SCRIPT_SHA256.test(v.script_sha256) ? v.script_sha256 : null
  if (!sha) return { problem: `${at}.script_sha256 is the script's sha256, as making.py script_hash writes it` }
  const examples: MakingSpokenDelta['examples'] = {}
  const given = v.examples === undefined ? {} : v.examples
  if (!isObj(given)) return { problem: `${at}.examples maps a kind to its examples` }
  for (const [kind, list] of Object.entries(given)) {
    if (!(SPOKEN_KINDS as readonly string[]).includes(kind)) return { problem: `unknown kind "${kind}" in ${at}.examples (${SPOKEN_KINDS.join(', ')})` }
    if (!Array.isArray(list) || list.length > SPOKEN_EXAMPLES) return { problem: `${at}.examples.${kind} is a list of at most ${SPOKEN_EXAMPLES}` }
    const ok = list.map(e => isObj(e) && typeof e.script === 'string' && typeof e.said === 'string'
      && e.script.length <= SPOKEN_EXAMPLE_CHARS && e.said.length <= SPOKEN_EXAMPLE_CHARS ? { script: e.script, said: e.said } : null)
    if (ok.some(e => !e)) return { problem: `${at}.examples.${kind}: each is {script, said}, at most ${SPOKEN_EXAMPLE_CHARS} characters a side` }
    examples[kind as (typeof SPOKEN_KINDS)[number]] = ok as MakingSpokenExample[]
  }
  return { entry: { ...(nums as Record<(typeof SPOKEN_COUNTS)[number], number>), minutes: rates.minutes ?? null, changes_per_minute: rates.changes_per_minute ?? null, changes_per_100_words: rates.changes_per_100_words ?? null, examples, script_sha256: sha, at: when(v.at, now) } }
}

/** One cut of a teleprompter patch, or the reason it is refused. */
function parseTeleprompterCut(cut: string, v: unknown, by: string, now: string): { entry?: MakingTeleprompterCut; problem?: string } {
  const at = `teleprompter.cuts.${cut}`
  if (!isCut(cut)) return { problem: `unknown cut "${cut}" in teleprompter.cuts (long, short, feature)` }
  if (!isObj(v)) return { problem: `${at} must be an object` }
  const entry: MakingTeleprompterCut = { sent_at: when(v.sent_at, now), by: str(v.by, 60) || by }
  if (v.error !== undefined) {
    const error = str(v.error)
    if (!error) return { problem: `${at}.error is what Teleprompter said, at most ${MAX_TEXT} characters` }
    entry.error = error
    entry.failed_at = when(v.failed_at, now)
  }
  if (v.script_id === undefined) {
    // A send that failed before any script was made: the error alone.
    return entry.error ? { entry } : { problem: `${at} needs script_id, title and script_sha256, or the error that stopped the send` }
  }
  if (typeof v.script_id !== 'string' || !TELEPROMPTER_ID.test(v.script_id)) return { problem: `${at}.script_id is the script's id, an uppercase UUID` }
  const title = str(v.title, MAX_TELEPROMPTER_NAME)
  if (!title || /[\r\n\t]/.test(title)) return { problem: `${at}.title is the script's title, one line of at most ${MAX_TELEPROMPTER_NAME} characters` }
  if (typeof v.script_sha256 !== 'string' || !SCRIPT_SHA256.test(v.script_sha256)) return { problem: `${at}.script_sha256 is the sha256 of the words the script holds, 64 lowercase hex characters` }
  Object.assign(entry, { script_id: v.script_id, title, script_sha256: v.script_sha256 })
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
    if (key === 'script_check' && typeof v.spine === 'string' && v.spine.trim()) (check as MakingScriptCheck).spine = String(v.spine).trim().slice(0, 300)
    if (key === 'script_check' && Array.isArray(v.cuts)) check.cuts = v.cuts.filter(isCut)
    if (key === 'script_check' && v.one_cut === true) (check as MakingScriptCheck).one_cut = true
    if (key === 'script_check' && v.hashes !== undefined) {
      const entries = isObj(v.hashes) ? Object.entries(v.hashes) : null
      if (!entries || !entries.every(([c, h]) => isCut(c) && typeof h === 'string' && SCRIPT_SHA256.test(h))) {
        problems.push('script_check.hashes is the sha256 of each cut\'s script: {long, short, feature}, each 64 lowercase hex characters')
        continue
      }
      check.hashes = Object.fromEntries(entries) as Partial<Record<MakingCut, string>>
    }
    if (key === 'script_check' && v.changed_at !== undefined) {
      const entries = isObj(v.changed_at) ? Object.entries(v.changed_at) : null
      if (!entries || !entries.every(([c, t]) => isCut(c) && typeof t === 'string' && t.length <= 40 && !Number.isNaN(Date.parse(t)))) {
        problems.push('script_check.changed_at is when each cut\'s words last changed: {long, short, feature}, each a time')
        continue
      }
      check.changed_at = Object.fromEntries(entries) as Partial<Record<MakingCut, string>>
    }
    if (key === 'script_check' && v.read_back !== undefined) {
      const entries = isObj(v.read_back) ? Object.entries(v.read_back) : null
      const krish = (r: Record<string, unknown>) => r.found === 'approved by Krish' && typeof r.krish_words === 'string'
        && str(r.krish_words, 600) === r.krish_words && /^krish/i.test(r.krish_words)
      const ok = (c: string, r: unknown) => isCut(c) && isObj(r) && typeof r.script_sha256 === 'string' && SCRIPT_SHA256.test(r.script_sha256)
        && (r.found === 'nothing lost' || krish(r)) && Array.isArray(r.readers) && r.readers.length >= (r.found === 'nothing lost' ? 2 : 0) && r.readers.length <= 6
        && r.readers.every(n => typeof n === 'string' && str(n, 200) === n && !/[\r\n\t]/.test(n))
      if (!entries || !entries.every(([c, r]) => ok(c, r))) {
        problems.push('script_check.read_back is each cut\'s read-back: {long, short, feature}, each {script_sha256, at, by, readers: two to six names, found: "nothing lost"}, or Krish\'s sign-off {script_sha256, at, by, readers: up to six, found: "approved by Krish", krish_words: his words, starting "Krish"}')
        continue
      }
      check.read_back = Object.fromEntries(entries.map(([c, r]: [string, any]) => [c, {
        script_sha256: r.script_sha256, at: when(r.at, now), by: str(r.by, 60) || str(body.by, 60) || 'Claude Code', readers: [...r.readers],
        ...(r.found === 'approved by Krish' ? { found: 'approved by Krish' as const, krish_words: r.krish_words } : { found: 'nothing lost' as const }),
      }])) as Partial<Record<MakingCut, MakingReadBack>>
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
        const cut = isObj(r) && isCut(r.cut) ? r.cut : null
        const path = isObj(r) ? str(r.path, 400) : null
        if (!cut || !path) { problems.push('each recording needs cut (long, short or feature) and path'); continue }
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
        const cut = isObj(a) && isCut(a.cut) ? a.cut : null
        const name = isObj(a) ? str(a.name, 200) : null
        const path = isObj(a) ? str(a.path, 400) : null
        if (!cut || !name || !path) { problems.push('each video asset needs cut, name and path'); continue }
        const asset: MakingVideoAsset = { cut, name, path, at: when(a.at, now) }
        if (a.sha256 !== undefined) {
          if (typeof a.sha256 !== 'string' || !SCRIPT_SHA256.test(a.sha256)) { problems.push('video sha256 must bind the delivered bytes'); continue }
          asset.sha256 = a.sha256
        }
        if (a.quality_receipt !== undefined) {
          const ref = MediaRefSchema.safeParse(a.quality_receipt)
          if (!ref.success) { problems.push('video quality_receipt must name exact library evidence'); continue }
          asset.quality_receipt = ref.data
        }
        // quality_review is server-derived. A producer cannot patch it directly.
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
  if (body.teleprompter !== undefined) {
    const v = isObj(body.teleprompter) ? body.teleprompter : {}
    const folder = v.folder_id === undefined ? undefined : typeof v.folder_id === 'string' && TELEPROMPTER_ID.test(v.folder_id) ? v.folder_id : null
    const name = v.folder_name === undefined ? undefined : str(v.folder_name, MAX_TELEPROMPTER_NAME)
    if (folder === null) problems.push('teleprompter.folder_id is the folder\'s id, an uppercase UUID')
    else if (name === null || (typeof name === 'string' && /[\r\n\t]/.test(name))) problems.push(`teleprompter.folder_name is the folder's name, one line of at most ${MAX_TELEPROMPTER_NAME} characters`)
    else if (!isObj(v.cuts) || !Object.keys(v.cuts).length) problems.push('teleprompter.cuts needs the long or short cut')
    else {
      const cuts: MakingTeleprompter['cuts'] = {}
      const before = problems.length
      for (const [cut, c] of Object.entries(v.cuts)) {
        const { entry, problem } = parseTeleprompterCut(cut, c, str(body.by, 60) || 'Claude Code', now)
        if (problem) problems.push(problem)
        else cuts[cut as MakingCut] = entry
      }
      // A script lives in the piece's folder: a cut with a script needs it.
      if (problems.length === before && !folder && Object.values(cuts).some(c => c?.script_id)) problems.push('teleprompter needs folder_id, the folder its scripts are in')
      if (problems.length === before) patch.teleprompter = { ...(folder ? { folder_id: folder } : {}), ...(name ? { folder_name: name } : {}), cuts }
    }
  }
  if (body.production_choices !== undefined) {
    const v = body.production_choices
    const given = isObj(v) ? Object.entries(v).filter(([k]) => k !== 'at') : null
    const choices: Partial<Record<ProductionChoice, string>> = {}
    for (const [k, value] of given || []) {
      if (!(PRODUCTION_CHOICES as readonly string[]).includes(k)) problems.push(`unknown production choice "${k}" (${PRODUCTION_CHOICES.join(', ')})`)
      else if (typeof value !== 'string' || !CHOICE_VALUE.test(value)) problems.push(`production_choices.${k} is the option used, such as hook_is_intro (lower case, digits and underscores)`)
      else choices[k as ProductionChoice] = value
    }
    if (!given || !given.length) problems.push(`production_choices needs at least one of ${PRODUCTION_CHOICES.join(', ')}`)
    else if (Object.keys(choices).length === given.length) patch.production_choices = { ...choices, at: when(isObj(v) ? v.at : undefined, now) }
  }
  if (body.spoken_delta !== undefined) {
    const v = body.spoken_delta
    if (!isObj(v) || !Object.keys(v).length) problems.push('spoken_delta needs a cut: long, short or feature')
    else {
      const cuts: Partial<Record<MakingCut, MakingSpokenDelta>> = {}
      const before = problems.length
      for (const [cut, d] of Object.entries(v)) {
        const { entry, problem } = parseSpokenDelta(cut, d, now)
        if (problem || !entry) problems.push(problem || `${cut}: no delta`)
        else cuts[cut as MakingCut] = entry
      }
      if (problems.length === before) patch.spoken_delta = cuts
    }
  }
  if (body.clip_uses !== undefined) {
    const v = body.clip_uses
    if (!isObj(v) || !Object.keys(v).length) problems.push('clip_uses maps an Inspiration card id to {use, said}')
    else {
      const uses: Record<string, ClipUseRecord> = {}
      const before = problems.length
      for (const [card, u] of Object.entries(v)) {
        const at = `clip_uses.${card}`
        const said = isObj(u) ? str(u.said, MAX_TEXT) : null
        if (!CARD_ID.test(card)) problems.push(`${at}: the key is the Inspiration card's id (inspiration_items.id, a uuid)`)
        else if (!isObj(u) || (u.use !== 'show_with_sound' && u.use !== 'reference')) problems.push(`${at}.use is show_with_sound or reference`)
        else if (!said || !/^Krish\b/.test(said)) problems.push(`${at}.said is Krish's own words, starting "Krish" and the date: how a clip is used is his call`)
        else uses[card] = { use: u.use, said, at: when(u.at, now), by: str(body.by, 60) || 'Claude Code' }
      }
      if (problems.length === before) patch.clip_uses = uses
    }
  }
  if (body.clip_placements !== undefined) {
    const v = body.clip_placements
    if (!isObj(v) || !Object.keys(v).length) problems.push('clip_placements needs a cut: long, short or feature')
    else {
      const cuts: NonNullable<Making['clip_placements']> = {}
      const before = problems.length
      for (const [cut, clips] of Object.entries(v)) {
        if (!isCut(cut)) { problems.push(`unknown cut "${cut}" in clip_placements (long, short, feature)`); continue }
        if (!isObj(clips) || !Object.keys(clips).length) { problems.push(`clip_placements.${cut} maps a card id to its place`); continue }
        const held: Record<string, ClipPlacement> = {}
        for (const [card, p] of Object.entries(clips)) {
          const { entry, problem } = parseClipPlacement(`clip_placements.${cut}.${card}`, card, p, str(body.by, 60) || 'Claude Code', now)
          if (problem || !entry) problems.push(problem || `${cut}.${card}: no placement`)
          else held[card] = entry
        }
        cuts[cut as MakingCut] = held
      }
      if (problems.length === before) patch.clip_placements = cuts
    }
  }
  // Descript was retired on 2026-10-12; a record of a send there is not taken.
  if (body.descript !== undefined) problems.push('descript was retired on 2026-10-12 (Krish: "Descript is permanently gone, teleprompter.com is permanently in"): record the Teleprompter send in teleprompter')
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
  if (patch.production_choices) {
    // Choice by choice: recording the sound after the render keeps the opening and the lead picture.
    const held = isObj(base.production_choices) ? base.production_choices : {}
    next.production_choices = { ...held, ...patch.production_choices }
  }
  if (patch.spoken_delta) {
    // Cut by cut: the short's delta never drops the long's.
    const held = isObj(base.spoken_delta) ? base.spoken_delta : {}
    next.spoken_delta = { ...held, ...patch.spoken_delta }
  }
  if (patch.clip_uses) {
    // Card by card: his words on one clip keep the others.
    next.clip_uses = { ...(isObj(base.clip_uses) ? base.clip_uses : {}), ...patch.clip_uses }
  }
  if (patch.clip_placements) {
    // Cut by cut, clip by clip: placing a clip in the short keeps the long's placements.
    const held = isObj(base.clip_placements) ? base.clip_placements : {}
    const merged: NonNullable<Making['clip_placements']> = { ...held }
    for (const [cut, clips] of Object.entries(patch.clip_placements)) {
      const before = isObj(held[cut as MakingCut]) ? held[cut as MakingCut] : {}
      merged[cut as MakingCut] = { ...before, ...clips }
    }
    next.clip_placements = merged
  }
  if (patch.teleprompter) {
    // Cut by cut: a send of one cut keeps the other, and the folder the
    // record holds stays unless the patch names one. Nothing in Teleprompter
    // is ever deleted, so a script on the record is never dropped here.
    const held = isObj(base.teleprompter) ? base.teleprompter : null
    const folder = patch.teleprompter.folder_id || (held && typeof held.folder_id === 'string' ? held.folder_id : undefined)
    const sameFolder = Boolean(held && held.folder_id && held.folder_id === folder)
    const name = patch.teleprompter.folder_name || (sameFolder && typeof held!.folder_name === 'string' ? held!.folder_name : undefined)
    next.teleprompter = {
      ...(folder ? { folder_id: folder } : {}), ...(name ? { folder_name: name } : {}),
      cuts: { ...(held && isObj(held.cuts) ? held.cuts : {}), ...patch.teleprompter.cuts },
    }
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

/** What Teleprompter holds for each cut against the words the scripts'
 *  check passed: 'in' (those words), 'older' (words that changed since),
 *  'failed' (the last send failed), 'missing' (never sent). Only for a check
 *  that passed with hashes, since a send needs them. Mirrored in
 *  control-center/src/lib/making.ts and making.py teleprompter_state. */
export type TeleprompterState = 'in' | 'older' | 'failed' | 'missing'
export function teleprompterStates(m: Partial<Making>): Partial<Record<MakingCut, TeleprompterState>> {
  const out: Partial<Record<MakingCut, TeleprompterState>> = {}
  const check = m.script_check
  if (!check?.passed || !isObj(check.hashes)) return out
  for (const cut of MAKING_ALL_CUTS) {
    const hash = check.hashes[cut]
    if (!hash) continue
    const sent = isObj(m.teleprompter) && isObj(m.teleprompter.cuts) ? m.teleprompter.cuts[cut] : undefined
    out[cut] = sent?.error ? 'failed' : !sent?.script_id ? 'missing' : sent.script_sha256 === hash ? 'in' : 'older'
  }
  return out
}

/** The Scripts step's word on Teleprompter: "in Teleprompter", "Teleprompter
 *  has an older script", "the Teleprompter send failed" or "not in
 *  Teleprompter yet", naming the cut when only one is so. Never holds the
 *  step back. */
export function teleprompterNote(m: Partial<Making>): string {
  const states = teleprompterStates(m)
  const cuts = MAKING_ALL_CUTS.filter(c => states[c])
  if (!cuts.length) return ''
  const of = (s: TeleprompterState) => cuts.filter(c => states[c] === s)
  if (of('in').length === cuts.length) return 'in Teleprompter'
  const which = (list: MakingCut[]) => (list.length === cuts.length ? '' : ` for the ${list.join(' and ')} cut`)
  return [
    of('older').length ? `Teleprompter has an older script${which(of('older'))}` : '',
    of('failed').length ? `the Teleprompter send failed${which(of('failed'))}` : '',
    of('missing').length ? `not in Teleprompter yet${which(of('missing'))}` : '',
  ].filter(Boolean).join('; ')
}

/** An off-day piece he records, one short cut (Ruling, Krish, 2026-10-29: "could be a short with motion designed
 *  subtitles and branding, or voiceover with motion designed infographics"): its check says one_cut and holds the
 *  short's hash alone. Mirrored in making.py one_cut. */
export function oneCut(m: Partial<Making>): boolean {
  const check = m.script_check, hashes = isObj(check?.hashes) ? Object.keys(check!.hashes!) : []
  return check?.one_cut === true && hashes.length === 1 && hashes[0] === 'short'
}

/** The cuts a piece is recorded and produced in: the two every piece gets,
 *  and the 15-minute feature when its script check holds a feature hash
 *  (making.py records one only on a piece Krish called a feature for). */
export function makingCuts(m: Partial<Making>): MakingCut[] {
  // An off-day piece he records: the short alone, and only while its check holds the short's hash and no other.
  if (oneCut(m)) return ['short']
  const feature = isObj(m.script_check?.hashes) && typeof m.script_check?.hashes?.feature === 'string'
  return feature ? [...MAKING_CUTS, 'feature'] : [...MAKING_CUTS]
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
export function makingSteps(row: { id?: string; state?: string | null; body?: string | null; meta?: Record<string, any> | null }): MakingStep[] {
  const meta = isObj(row.meta) ? row.meta : {}
  const m = (isObj(meta.making) ? meta.making : {}) as Partial<Making>
  const factGate = isObj(meta.fact_check) ? meta.fact_check : null
  const steps: Array<Omit<MakingStep, 'owner'>> = []
  steps.push(m.workroom ? { key: 'workroom', label: 'Workroom', state: 'done', at: m.workroom.at, link: m.workroom.url } : { key: 'workroom', label: 'Workroom', state: 'todo' })
  // A run that left blocking lines passes once Krish has signed every one off
  // in his own words, as the gate itself counts it (gateStatus).
  const hasManualReview = activeManualReviews(meta).length > 0
  const manualBodyCurrent = !hasManualReview || typeof row.body === 'string' && bodyHash(row.body) === factGate?.body_hash
  const signedThrough = !!factGate && manualBodyCurrent && (Array.isArray(factGate.signed_off) && factGate.signed_off.length > 0 || hasManualReview) && Array.isArray(factGate.claims)
    && effectiveBlocking(meta).length + (Number(factGate.unchecked) || 0) === 0
  const factPassed = factGate ? factGate.passed === true || factGate.status === 'passed' || factGate.ok === true || signedThrough : false
  steps.push(factGate
    ? { key: 'draft', label: 'Fact-checked draft', state: factPassed ? 'done' : 'failed', at: str(factGate.ran_at) || undefined, note: factPassed ? undefined : 'the fact gate did not pass' }
    : { key: 'draft', label: 'Fact-checked draft', state: 'todo' })
  steps.push(m.visual_gate
    ? { key: 'visual_gate', label: 'Visual gate', state: m.visual_gate.passed ? 'done' : 'failed', at: m.visual_gate.checked_at, note: m.visual_gate.passed ? undefined : m.visual_gate.problems[0] }
    : { key: 'visual_gate', label: 'Visual gate', state: 'todo' })
  // Where the scripts are in Teleprompter is said on the step and never holds it back.
  steps.push(m.script_check
    ? { key: 'scripts', label: 'Scripts', state: m.script_check.passed ? 'done' : 'failed', at: m.script_check.checked_at, note: m.script_check.passed ? [(m.script_check.cuts || []).join(' and '), teleprompterNote(m)].filter(Boolean).join('; ') || undefined : m.script_check.problems[0] }
    : { key: 'scripts', label: 'Scripts', state: 'todo' })
  steps.push(m.pack
    ? { key: 'pack', label: m.pack.sent_at ? 'Pack in Drive' : 'Pack built', state: m.pack.sent_at ? 'done' : 'now', at: m.pack.sent_at || m.pack.packed_at, note: m.pack.folder }
    : { key: 'pack', label: 'Pack', state: 'todo' })
  // Both cuts, every piece (TWO_CUTS, Krish, 2026-10-11), whatever cuts a
  // script check recorded: one recording or one video never finishes a step.
  // The one exception is an off-day piece he records, one short cut (oneCut;
  // Ruling, Krish, 2026-10-29).
  // A take counts only for the script it was taken from: one whose
  // script_sha256 is not the current hash for its cut was recorded from words
  // that have changed since (a take with no hash predates the hashes).
  // A feature piece's feature counts the same way (makingCuts).
  const needed = makingCuts(m)
  const takes = m.recordings || []
  const recorded = new Set(takes.filter(r => takeCounts(r, m.script_check)).map(r => r.cut))
  const olderScript = needed.filter(c => !recorded.has(c) && takes.some(r => r.cut === c))
  const missingCuts = needed.filter(c => !recorded.has(c) && !olderScript.includes(c))
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
  const readinessAssets = !mediaQualityEnforced() ? assets : assets.filter(a => a.sha256 && a.quality_receipt && !mediaReviewProblems(a.quality_review, {
    piece_id: String(row.id), role: 'video', cut: a.cut, stage: 'final', artifacts: [{ path: a.path, sha256: a.sha256 }],
  }).length)
  const produced = new Set(readinessAssets.map(a => a.cut))
  const missingAssets = needed.filter(c => !produced.has(c))
  const thumbed = new Set(readinessAssets.filter(a => a.thumbnail?.path).map(a => a.cut))
  const missingThumbs = needed.filter(c => produced.has(c) && !thumbed.has(c))
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

/** A piece as pieceVerdict reads it. */
export interface PieceState { id: string; state?: string | null; buried_at?: string | null; meta?: Record<string, any> | null }

/**
 * Whether a piece's state ends an item that waits on one of its steps
 * (closes_on a making step or 'published'): 'done' when the step is done,
 * 'moot' when the piece is gone, else null. The engine uses it only to
 * refuse an item whose step is already done (api/workbench.ts,
 * already_done); Control Center's done-check sweep closes items by the same
 * rules, from this piece's steps (GET /api/content-ideas/<id>/making).
 *
 *   - the publish step is done (the standing five; Krish, 2026-10-11), or
 *     the piece is published and was not made with the making record -> done
 *   - closes_on 'published' and the Substack post is live          -> done
 *   - the piece is dropped, absorbed or buried                       -> moot
 *   - its closes_on step is done                                     -> done
 */
export function pieceVerdict(piece: PieceState, closesOn: string, steps: MakingStep[] = makingSteps(piece)): 'done' | 'moot' | null {
  const published = piece.state === 'published'
  const done = new Set(steps.filter(s => s.state === 'done').map(s => s.key))
  if (done.has('publish') || (published && !madeWithRecord(piece.meta))) return 'done'
  if (piece.state === 'dropped' || piece.state === 'absorbed' || piece.buried_at) return 'moot'
  if (published && closesOn === 'published') return 'done'
  return closesOn !== 'published' && done.has(closesOn) ? 'done' : null
}
