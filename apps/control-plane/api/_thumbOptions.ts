// A piece's thumbnail options on its making record (meta.making.thumbnail_options): the thumbnail-designer skill's
// two or three options, the independent critic's verdict on them and Krish's pick, each bound to the files' sha256.
//
// The cover standard Krish approved (docs/production/COVER-STANDARD.md, Krish, 2026-11-09: "approve the cover standard
// as written"), point 8: "Two or three options, never one, each shown in a mock of his grid beside the last five
// posts." scripts/pages/build.py --thumbs --options draws them (scripts/pages/thumb_options.py) and
// scripts/post-pack/making.py PIECE thumbnails records them. The record keeps what the set is (each option's two files
// by sha256, the grid mock's sha256), what the critic said of those exact bytes, and his pick with his own words. It
// refuses a verdict or a pick whose hashes are not the set's (thumbnailOptionsProblems), the way the board's judge binds
// a picture to its asset's sha256. It never touches asset_judgements: the critic is not the board's judge panel, and
// the content North Star count is untouched. Nothing here sends, posts or files anything.

import { createHash } from 'node:crypto'

export const THUMB_OPTION_IDS = ['a', 'b', 'c'] as const
export const THUMB_SHAPES = ['wide', 'tall'] as const
/** The QA list the critic answers on every option (.agents/skills/thumbnail-designer/references/qa.md). */
export const THUMB_CHECKS = ['readable_at_grid', 'words_max', 'three_parts', 'logos_named', 'no_badges', 'title_hidden', 'promise_matches'] as const
export type ThumbCheck = (typeof THUMB_CHECKS)[number]

export interface MakingThumbFile { shape: (typeof THUMB_SHAPES)[number]; file: string; sha256: string }
export interface MakingThumbOption { id: string; note: string; files: MakingThumbFile[] }
export interface MakingThumbVerdictOption { id: string; files: Array<{ file: string; sha256: string }>; checks: Record<ThumbCheck, 'pass' | 'fail'>; blocking: boolean; findings: string[] }
export interface MakingThumbVerdict { reviewer: string; reviewed_at: string; best: string | null; blocking: boolean; qa_sha256?: string; options: MakingThumbVerdictOption[] }
export interface MakingThumbPick { option: string; files: MakingThumbFile[]; krish_words: string; at: string; by: string }
export interface MakingThumbnailOptions {
  set_sha256: string
  drawn_at: string
  skin: string | null
  headline: string
  options: MakingThumbOption[]
  grid_mock: { sha256: string; past_read: number; note: string }
  verdict?: MakingThumbVerdict
  pick?: MakingThumbPick
  at: string
  by: string
}
/** A patch: a whole new set (options, with the verdict when the critic has judged it), or, for the set on the record
 *  (set_sha256), a verdict or his pick. */
export type ThumbnailOptionsPatch = Partial<Omit<MakingThumbnailOptions, 'at' | 'by' | 'pick'>> & { set_sha256: string; pick?: Omit<MakingThumbPick, 'at' | 'by'> }

const SHA = /^[a-f0-9]{64}$/
const FILE = /^options\/[abc]\/[a-z0-9-]{1,60}\.(jpg|png)$/
const MAX_FINDINGS = 12
const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() && v.length <= max && !/[\r\n]/.test(v) ? v.trim() : null)
const time = (v: unknown): string | null => (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : null)

/** One hash for a set, the same as thumb_options.py set_digest: each option's id and its files' shape, path and sha256. */
export function setDigest(options: Array<Pick<MakingThumbOption, 'id' | 'files'>>): string {
  return createHash('sha256').update(JSON.stringify(options.map(o => [o.id, o.files.map(f => [f.shape, f.file, f.sha256])]))).digest('hex')
}

function parseFiles(v: unknown, at: string, problems: string[]): MakingThumbFile[] | null {
  if (!Array.isArray(v) || v.length !== THUMB_SHAPES.length) { problems.push(`${at}.files is the option's wide and tall thumbnails, each {shape, file, sha256}`); return null }
  const files: MakingThumbFile[] = []
  for (const f of v) {
    if (!isObj(f) || !(THUMB_SHAPES as readonly string[]).includes(String(f.shape)) || typeof f.file !== 'string' || !FILE.test(f.file) || typeof f.sha256 !== 'string' || !SHA.test(f.sha256)) {
      problems.push(`${at}.files: each is {shape: wide or tall, file: options/<id>/<name>.jpg, sha256: 64 hex}`)
      return null
    }
    files.push({ shape: f.shape as MakingThumbFile['shape'], file: f.file, sha256: f.sha256 })
  }
  if (new Set(files.map(f => f.shape)).size !== THUMB_SHAPES.length) { problems.push(`${at}.files holds one wide and one tall`); return null }
  return files
}

function parseVerdict(v: unknown, problems: string[]): MakingThumbVerdict | null {
  const before = problems.length
  if (!isObj(v) || !Array.isArray(v.options)) { problems.push('thumbnail_options.verdict is {reviewer, reviewed_at, best, blocking, options: [...]}'); return null }
  const reviewer = text(v.reviewer, 60)
  const reviewedAt = time(v.reviewed_at)
  if (!reviewer || !reviewedAt) problems.push('thumbnail_options.verdict names its reviewer (the critic, never the drawer) and when it reviewed')
  const options: MakingThumbVerdictOption[] = []
  for (const [i, o] of v.options.entries()) {
    const at = `thumbnail_options.verdict.options[${i}]`
    if (!isObj(o) || !(THUMB_OPTION_IDS as readonly string[]).includes(String(o.id))) { problems.push(`${at}.id is a, b or c`); continue }
    const files = Array.isArray(o.files) ? o.files.filter(isObj).map(f => ({ file: String(f.file), sha256: String(f.sha256) })) : []
    if (files.length !== THUMB_SHAPES.length || files.some(f => !FILE.test(f.file) || !SHA.test(f.sha256))) { problems.push(`${at}.files names the option's two files with their sha256`); continue }
    const checks = isObj(o.checks) ? o.checks : {}
    if (Object.keys(checks).length !== THUMB_CHECKS.length || THUMB_CHECKS.some(k => checks[k] !== 'pass' && checks[k] !== 'fail')) {
      problems.push(`${at}.checks answers each of ${THUMB_CHECKS.join(', ')} with pass or fail`); continue
    }
    if (typeof o.blocking !== 'boolean') { problems.push(`${at}.blocking is true or false`); continue }
    const findings = (Array.isArray(o.findings) ? o.findings : []).filter((x): x is string => typeof x === 'string').map(x => x.slice(0, 300)).slice(0, MAX_FINDINGS)
    options.push({ id: String(o.id), files, checks: checks as Record<ThumbCheck, 'pass' | 'fail'>, blocking: o.blocking, findings })
  }
  if (new Set(options.map(o => o.id)).size !== options.length) problems.push('thumbnail_options.verdict judges each option once')
  const best = v.best === null || v.best === undefined ? null : String(v.best)
  if (best !== null && !options.some(o => o.id === best && !o.blocking)) problems.push('thumbnail_options.verdict.best is an option that does not block, or null')
  if (typeof v.blocking !== 'boolean' || v.blocking !== (options.length > 0 && options.every(o => o.blocking))) problems.push('thumbnail_options.verdict.blocking is true exactly when every option blocks')
  if (v.qa_sha256 !== undefined && (typeof v.qa_sha256 !== 'string' || !SHA.test(v.qa_sha256))) problems.push('thumbnail_options.verdict.qa_sha256 is the QA list\'s sha256')
  if (problems.length > before) return null
  return { reviewer: reviewer!, reviewed_at: reviewedAt!, best, blocking: v.blocking as boolean, ...(typeof v.qa_sha256 === 'string' ? { qa_sha256: v.qa_sha256 } : {}), options }
}

/** Reads thumbnail_options from a making patch's body. Bad values are named in problems. */
export function parseThumbnailOptions(v: unknown, problems: string[]): ThumbnailOptionsPatch | null {
  const before = problems.length
  if (!isObj(v) || typeof v.set_sha256 !== 'string' || !SHA.test(v.set_sha256)) {
    problems.push('thumbnail_options names its set (set_sha256): a whole set {options, grid_mock, ...}, or for the set on the record a verdict or his pick')
    return null
  }
  const out: ThumbnailOptionsPatch = { set_sha256: v.set_sha256 }
  if (v.options !== undefined) {
    if (!Array.isArray(v.options) || v.options.length < 2 || v.options.length > 3) {
      problems.push('thumbnail_options.options is two or three options, never one (COVER-STANDARD point 8)')
      return null
    }
    const options: MakingThumbOption[] = []
    for (const [i, o] of v.options.entries()) {
      const at = `thumbnail_options.options[${i}]`
      if (!isObj(o) || !(THUMB_OPTION_IDS as readonly string[]).includes(String(o.id))) { problems.push(`${at}.id is a, b or c`); continue }
      const note = text(o.note, 200)
      if (!note) { problems.push(`${at}.note says in one line what the option tries`); continue }
      const files = parseFiles(o.files, at, problems)
      if (files) options.push({ id: String(o.id), note, files })
    }
    if (new Set(options.map(o => o.id)).size !== options.length) problems.push('thumbnail_options.options: each option has its own id')
    const mock = v.grid_mock
    if (!isObj(mock) || typeof mock.sha256 !== 'string' || !SHA.test(mock.sha256) || !Number.isInteger(mock.past_read) || Number(mock.past_read) < 0 || Number(mock.past_read) > 5 || !text(mock.note, 300)) {
      problems.push('thumbnail_options.grid_mock is {sha256, past_read: 0 to 5, note}: the mock of his grid every option is shown in')
    }
    const drawn = time(v.drawn_at)
    if (!drawn) problems.push('thumbnail_options.drawn_at is when the set was drawn')
    const headline = text(v.headline, 300)
    if (!headline) problems.push('thumbnail_options.headline is the words every option carries')
    if (problems.length > before) return null
    if (setDigest(options) !== v.set_sha256) { problems.push('thumbnail_options.set_sha256 is not the hash of its options\' files: the set changed after it was drawn'); return null }
    Object.assign(out, { options, drawn_at: drawn!, headline: headline!, skin: text(v.skin, 40),
      grid_mock: { sha256: (mock as Record<string, string>).sha256, past_read: Number((mock as Record<string, unknown>).past_read), note: text((mock as Record<string, unknown>).note, 300)! } })
  }
  if (v.verdict !== undefined) {
    const verdict = parseVerdict(v.verdict, problems)
    if (verdict) out.verdict = verdict
  }
  if (v.pick !== undefined) {
    const p = v.pick
    const words = isObj(p) ? text(p.krish_words, 600) : null
    if (!isObj(p) || !(THUMB_OPTION_IDS as readonly string[]).includes(String(p.option))) problems.push('thumbnail_options.pick.option is a, b or c')
    else if (!words || !/^Krish\b/.test(words)) problems.push('thumbnail_options.pick.krish_words are Krish\'s own words, starting "Krish" and the date: the pick is his')
    else {
      const files = parseFiles(p.files, 'thumbnail_options.pick', problems)
      if (files) out.pick = { option: String(p.option), files, krish_words: words }
    }
    if (out.options) problems.push('thumbnail_options: his pick goes on the set already on the record, never with a new set')
  }
  if (!out.options && !out.verdict && !out.pick && problems.length === before) problems.push('thumbnail_options carries a set, a verdict or his pick')
  return problems.length > before ? null : out
}

const sameFiles = (a: Array<{ file: string; sha256: string }>, b: Array<{ file: string; sha256: string }>) =>
  a.length === b.length && a.every(x => b.some(y => y.file === x.file && y.sha256 === x.sha256))

/** Why a patch's verdict or pick is not bound to the set it names, or []: the record that stores them refuses a verdict
 *  whose files' hashes are not the set's, a verdict that skips an option, and a pick before the verdict, of an option
 *  not on the set, or naming other bytes. A new set may carry its verdict; a pick never comes with a new set. */
export function thumbnailOptionsProblems(prev: MakingThumbnailOptions | null | undefined, patch: ThumbnailOptionsPatch | undefined): string[] {
  if (!patch) return []
  const set = patch.options ? patch : prev
  if (!set || !Array.isArray(set.options) || set.set_sha256 !== patch.set_sha256) {
    return [`thumbnail_options: the record holds no set ${patch.set_sha256.slice(0, 12)} to judge or pick from: record the set first, and judge and pick the set on the record`]
  }
  const out: string[] = []
  const options = set.options as MakingThumbOption[]
  const verdict = patch.verdict
  if (verdict) {
    const judged = verdict.options.map(o => o.id).sort()
    if (judged.join() !== options.map(o => o.id).sort().join()) out.push(`thumbnail_options.verdict judges ${judged.join(', ') || 'nothing'}; the set holds ${options.map(o => o.id).join(', ')}: every option once`)
    for (const o of verdict.options) {
      const on = options.find(x => x.id === o.id)
      if (on && !sameFiles(o.files, on.files)) out.push(`thumbnail_options.verdict: option ${o.id}'s files and sha256s are not the set's: a verdict on other bytes is refused`)
    }
  }
  if (patch.pick) {
    if (!verdict && !prev?.verdict) out.push('thumbnail_options.pick: the critic has not judged this set: the options go to Krish only after the verdict')
    const on = options.find(o => o.id === patch.pick!.option)
    if (!on) out.push(`thumbnail_options.pick: option ${patch.pick.option} is not on the set`)
    else if (!sameFiles(patch.pick.files, on.files)) out.push(`thumbnail_options.pick: the files named are not option ${on.id}'s on the set`)
  }
  return out
}

/** The next record: a new set replaces the old one whole (its verdict and pick with it); a verdict or a pick lands on
 *  the set on the record. Call only after thumbnailOptionsProblems found nothing. */
export function mergeThumbnailOptions(prev: MakingThumbnailOptions | null | undefined, patch: ThumbnailOptionsPatch, by: string, now: string): MakingThumbnailOptions {
  if (patch.options) {
    const { pick: _ignored, ...set } = patch
    return { ...(set as Omit<MakingThumbnailOptions, 'at' | 'by'>), at: now, by }
  }
  const base = prev as MakingThumbnailOptions
  return {
    ...base,
    ...(patch.verdict ? { verdict: patch.verdict } : {}),
    ...(patch.pick ? { pick: { ...patch.pick, at: now, by } } : {}),
    at: now, by,
  }
}
