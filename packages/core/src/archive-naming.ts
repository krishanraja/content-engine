// Where a finished video is filed: one folder per piece, whose name says the
// date, what it is about and where to post it.
//
// Krish, 2026-10-06: "Can you ensure all videos are always archived properly
// in folder with date/subject/where I can post it in the folder name?" The
// Studio used to file an approved package under its bare job id, and
// quick-edit filed nothing, so nobody could tell from the archive what a
// folder held or where it went.
//
// The same rule is in scripts/quick-edit/archive.py. Both are tested against
// every case in config/archive-naming.cases.json, so the two cannot drift.
// Change the rule there first, then here and in the Python.
//
// Pure: no file system, no clock. The archive itself is archiveJob in
// package.ts.

import type { VideoPlatformV1 } from '@mindmake/contracts'

/** Every place a video can be posted, in the order a name lists them. */
export const ARCHIVE_PLACES = ['YouTube', 'Substack', 'Shorts', 'Reels', 'TikTok', 'LinkedIn'] as const
export type ArchivePlace = typeof ARCHIVE_PLACES[number]

/** The Studio's four-platform package, in plain names: YouTube Shorts and
 *  Instagram Reels are what people call Shorts and Reels. */
export const ARCHIVE_PLACE_FOR_PLATFORM: Readonly<Record<VideoPlatformV1, ArchivePlace>> = Object.freeze({
  youtube_shorts: 'Shorts',
  instagram_reels: 'Reels',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
})

/** The longest folder name, in characters. Windows stops a whole path at 260
 *  by default, and the Drive archive folder takes about 70 of them. */
export const ARCHIVE_FOLDER_MAX = 150
/** The highest copy number, " (999)", before the archive refuses. */
export const ARCHIVE_COPY_MAX = 999
/** Krish's clock: the day a video was archived is the day in London. */
export const ARCHIVE_TIME_ZONE = 'Europe/London'

export type ArchiveShape = 'tall' | 'wide'
const SHAPE_LABEL: Readonly<Record<ArchiveShape, string>> = Object.freeze({ tall: 'tall 9x16', wide: 'wide 16x9' })

// Control characters and every kind of space become a plain space, so a line
// break between two words keeps them apart. The list is spelled out, here and
// in the Python, because the two languages disagree on what \s means.
const SPACE_LIKE = /[\u0000-\u001f\u007f-\u009f\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/gu
// What Windows refuses in a name. Drive takes the same rule on a Windows machine.
const UNSAFE = /[<>:"/\\|?*]/g
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/

/** A text counted as a person counts it: an emoji or an accented letter is one. */
const characters = (text: string): string[] => Array.from(text)

/** The text with everything a Windows or Drive name cannot hold taken out:
 *  control characters and odd spaces become spaces, < > : " / \ | ? * go,
 *  runs of spaces become one, and nothing is left at either end but text
 *  (a dot at the end goes too: Windows drops it without saying). */
export function archiveSafeText(text: string): string {
  return text
    .replace(SPACE_LIKE, ' ')
    .replace(UNSAFE, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +| +$/g, '')
    .replace(/[. ]+$/, '')
}

/** The places, each once, in the fixed order. A name is matched whatever its
 *  capitals; anything outside the six is refused. */
export function archivePlaces(places: readonly string[]): ArchivePlace[] {
  const byName = new Map<string, ArchivePlace>(ARCHIVE_PLACES.map((place) => [place.toLowerCase(), place]))
  const chosen = new Set<ArchivePlace>()
  for (const raw of places) {
    const place = byName.get(raw.replace(SPACE_LIKE, ' ').replace(/^ +| +$/g, '').toLowerCase())
    if (!place) throw new Error(`"${raw}" is not a place to post: use YouTube, Substack, Shorts, Reels, TikTok or LinkedIn`)
    chosen.add(place)
  }
  if (!chosen.size) throw new Error('a video needs at least one place to post it')
  return ARCHIVE_PLACES.filter((place) => chosen.has(place))
}

/** The places for the Studio's platforms, in the fixed order. */
export function archivePlacesForPlatforms(platforms: readonly VideoPlatformV1[]): ArchivePlace[] {
  return archivePlaces(platforms.map((platform) => ARCHIVE_PLACE_FOR_PLATFORM[platform]))
}

/** "YouTube, Substack, Shorts": the where list as a name shows it. */
export function archiveWhere(places: readonly string[]): string {
  return archivePlaces(places).join(', ')
}

/** Refuses anything but a real calendar date written YYYY-MM-DD. */
export function assertArchiveDate(date: string): string {
  const match = DATE.exec(date)
  const [year, month, day] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0]
  // setUTCFullYear, because Date.UTC reads the years 0 to 99 as 1900 to 1999.
  const parsed = new Date(0)
  parsed.setUTCFullYear(year, month - 1, day)
  if (!match || year < 1 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`"${date}" is not a date in the form YYYY-MM-DD`)
  }
  return date
}

/** The day an instant falls on by Krish's clock, as YYYY-MM-DD. The same
 *  arithmetic as ymdIn in apps/control-plane/api/_timezone.ts. */
export function archiveLocalDate(at: Date, timeZone: string = ARCHIVE_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at)
  const part = (type: string): string => parts.find((item) => item.type === type)?.value ?? ''
  return assertArchiveDate(`${part('year')}-${part('month')}-${part('day')}`)
}

/** The subject cut to fit: at the last space that fits, or mid-word when one
 *  word is too long, with no space, dot, comma, semicolon or dash left at
 *  the end. */
function shortenSubject(subject: string, budget: number): string {
  const all = characters(subject)
  if (all.length <= budget) return subject
  let cut = all.slice(0, budget)
  if (all[budget] !== ' ') {
    const space = cut.lastIndexOf(' ')
    if (space > 0) cut = cut.slice(0, space)
  }
  return cut.join('').replace(/[ .,;\-\u2013\u2014]+$/u, '') || all.slice(0, budget).join('').replace(/[. ]+$/, '')
}

export interface ArchiveFolderInput {
  /** The publish date when known, else the day it was archived. */
  date: string
  /** The piece's short title, as given. Never a job id. */
  subject: string
  places: readonly string[]
  /** 1 for the first folder; 2 and up when an earlier one has the name. */
  copy?: number
}

/** "2026-10-05 Who gets paid (post to YouTube, Substack, Shorts, Reels,
 *  LinkedIn)", at most ARCHIVE_FOLDER_MAX characters, and the subject as it
 *  appears in it, for the file names inside. */
export function archiveFolder(input: ArchiveFolderInput): { name: string; subject: string } {
  const date = assertArchiveDate(input.date)
  const where = archiveWhere(input.places)
  const copy = input.copy ?? 1
  if (!Number.isInteger(copy) || copy < 1 || copy > ARCHIVE_COPY_MAX) throw new Error(`copy must be a whole number from 1 to ${ARCHIVE_COPY_MAX}`)
  const clean = archiveSafeText(input.subject)
  if (!clean) throw new Error('the subject has nothing a folder name can keep')
  const suffix = copy > 1 ? ` (${copy})` : ''
  // Only the subject gives way: the date, the where list and the copy number
  // always fit whole (at most 78 characters between them).
  const budget = ARCHIVE_FOLDER_MAX - characters(`${date}  (post to ${where})${suffix}`).length
  const subject = shortenSubject(clean, budget)
  return { name: `${date} ${subject} (post to ${where})${suffix}`, subject }
}

export function archiveFolderName(input: ArchiveFolderInput): string {
  return archiveFolder(input).name
}

/** The first free folder name, given the names already in the archive.
 *  Capitals are ignored, as Windows and Drive ignore them. The archive
 *  itself claims a folder by creating it, which fails when it exists, so two
 *  runs at once can never share one. */
export function nextArchiveFolder(input: ArchiveFolderInput, existing: Iterable<string>): { name: string; subject: string; copy: number } {
  const taken = new Set([...existing].map((name) => name.toLowerCase()))
  for (let copy = 1; copy <= ARCHIVE_COPY_MAX; copy += 1) {
    const folder = archiveFolder({ ...input, copy })
    if (!taken.has(folder.name.toLowerCase())) return { ...folder, copy }
  }
  throw new Error(`the archive already has ${ARCHIVE_COPY_MAX} folders named for this piece`)
}

export interface ArchiveFileInput {
  subject: string
  shape: ArchiveShape
  places: readonly string[]
  extension?: string
}

/** "Who gets paid - tall 9x16 - Shorts, Reels, LinkedIn.mp4": what the file
 *  is, its shape, and where it goes. */
export function archiveFileName(input: ArchiveFileInput): string {
  const subject = archiveSafeText(input.subject)
  if (!subject) throw new Error('the subject has nothing a folder name can keep')
  const where = archiveWhere(input.places)
  const extension = input.extension ?? 'mp4'
  if (!/^[a-z0-9]{1,8}$/i.test(extension)) throw new Error(`"${extension}" is not a file extension`)
  return `${subject} - ${SHAPE_LABEL[input.shape]} - ${where}.${extension}`
}
