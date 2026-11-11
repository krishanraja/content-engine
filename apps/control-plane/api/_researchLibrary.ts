import { createHash } from 'node:crypto'
import { liveBoardUrl } from './board/_liveBoard.js'

// The research library: a readable copy in Krish's Drive of every piece's research (docs/DRIVE.md, "The research
// library"; Ruling, Krish, 2026-11-11).
//
// Krish, 2026-11-11: "I also want to have a specific folder in Drive where all of the research from every post goes.
// ... the underlying research that we do for each piece is quite deep and should be kept in a library because one of
// the most important prospects that we have over time is connecting the dots on historical data."
//
// One home per fact: the record is the piece materials store (api/_pieceStore.ts), which keeps every material by its
// sha256 and never deletes one. This copies the research kinds into `makeyourmindup > 6 Research library`, one folder
// per week, one per piece or day inside it, and adds a row to the library's `00 Index` Sheet. It only adds: a folder, a
// file, a row. It never renames, moves, overwrites or deletes anything, and it makes nothing when the library itself is
// gone. Idempotent by the material: a copy already in Drive (binned ones too) is never made again, and a row already in
// the index is never added again. A copy that fails loses nothing; the store holds it and the next sweep copies it.
//
// This file decides; the Google calls live behind LibraryDrive and LibraryIndex (api/_researchLibraryGoogle.ts), so a
// test runs every rule against a fake Drive.

/** makeyourmindup > 6 Research library. config/research-library.json folder_id holds the same ID. */
export const RESEARCH_LIBRARY_FOLDER_ID = '12FKoQhLlUkzwJDKYao95YIY_H_HQupS6'
/** Its `00 Index` Google Sheet. config/research-library.json index_id holds the same ID. */
export const RESEARCH_LIBRARY_INDEX_ID = '1UejePwOc_6abqX1A3TrKXDZxej4C1OOvwVM3K3C29lo'

/** The kinds that are research: a write-up, a corpus, notes, and a paste (a verbatim source excerpt). */
export const LIBRARY_KINDS = ['research', 'corpus', 'note', 'paste'] as const
/** A material of another kind is research too when its role says so (a PDF filed as research, a sources file). */
export const LIBRARY_ROLES = ['research', 'sources', 'source', 'corpus', 'notes'] as const
/** The sweep leaves a material this young to the write that filed it, which copies it at once; so the two never race. */
export const SETTLE_MS = 10 * 60_000
/** The biggest file copied (the store's own limit for one file). */
export const MIRROR_FILE_MAX = 64 * 1024 * 1024
/** The index's columns, in order; the header row Krish sees is the same words. */
export const INDEX_COLUMNS = ['Week', 'Day', 'Piece', 'Series', 'Kind', 'Title', 'Date added', 'Drive link', 'sha256', 'Version', 'Added by', 'Piece id', 'Material id'] as const
/** The column of the material id (M), which makes a row idempotent. */
export const INDEX_MATERIAL_COLUMN = 'M'

/** The properties every folder and file the mirror makes carries, so it is found again whatever it is called. */
export const PROP = { root: 'ce_root', kind: 'ce_library', week: 'ce_week', slot: 'ce_slot', material: 'ce_material', sha: 'ce_sha256' } as const

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_NAMES: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SERIES: Record<string, string> = { follow_the_money: 'follow.the.money', under_the_hood: 'under.the.hood', mind_the_gap: 'mind.the.gap' }
const TEXT_TYPES: Record<string, string> = { md: 'text/markdown', markdown: 'text/markdown', txt: 'text/plain', json: 'application/json', csv: 'text/csv', html: 'text/html', htm: 'text/html', srt: 'text/plain', vtt: 'text/vtt', tsv: 'text/tab-separated-values' }

/** One row of piece_materials, as the mirror reads it. */
export interface StoredMaterial {
  id: string
  scope: string
  piece_id: string | null
  week: string | null
  day: string | null
  material_key: string
  version: number
  kind: string
  role: string | null
  title: string
  note: string | null
  sha256: string
  bytes: number
  content_type: string | null
  storage: 'text' | 'bucket' | 'link' | string
  text_sha256: string | null
  object_key: string | null
  added_by: string
  added_at: string
  archived_at: string | null
}

/** A piece as the library names it. */
export interface PieceInfo { id: string; idea: string | null; scheduled_for: string | null; series: string | null }

export interface LibraryFolder { id: string; name: string; props: Record<string, string> }
export interface LibraryFile { id: string; name: string; link: string; sha256: string | null; material: string; trashed?: boolean }

/** Drive, as the mirror uses it. Every method adds or reads; none renames, moves, overwrites or deletes. */
export interface LibraryDrive {
  /** The library folder itself: there, not binned, and open to new files. */
  root(rootId: string): Promise<{ ok: true } | { ok: false; why: string }>
  /** Every folder the mirror made inside the library, by its properties (not binned), oldest first. */
  folders(rootId: string): Promise<LibraryFolder[]>
  /** The copies already made: of these materials, or of every material when none are named. Binned copies count. */
  files(rootId: string, materialIds?: string[]): Promise<LibraryFile[]>
  createFolder(parentId: string, name: string, props: Record<string, string>): Promise<string>
  createFile(input: { parentId: string; name: string; mime: string; bytes: Uint8Array; description: string; props: Record<string, string> }): Promise<LibraryFile>
}

/** The `00 Index` Sheet: read the material ids already listed, add rows. Never edits a row. */
export interface LibraryIndex {
  materialIds(): Promise<Set<string>>
  append(rows: string[][]): Promise<void>
}

/** Where the store's records and bytes come from. */
export interface LibrarySource {
  materials(only?: string[]): Promise<StoredMaterial[]>
  pieces(ids: string[]): Promise<Map<string, PieceInfo>>
  bytes(m: StoredMaterial): Promise<Uint8Array | null>
}

export interface MirrorOptions {
  rootId?: string
  /** Copy only these materials, now, with no settling time (the write that filed them, or a hand run). */
  only?: string[]
  now?: number
  /** Stop starting new copies after this long; the rest wait for the next sweep. */
  budgetMs?: number
  settleMs?: number
}

export interface MirrorReport {
  ok: boolean
  error?: string
  eligible: number
  already: number
  mirrored: number
  indexed: number
  settling: number
  later: number
  failed: Array<{ id: string; why: string }>
  index_error?: string
  copies: Array<{ material: string; link: string; created: boolean }>
}

const clean = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/[\\/]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, max).trim()
const shortWords = (s: string, max: number) => {
  const t = clean(s, 400)
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const at = cut.lastIndexOf(' ')
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:-]+$/, '')} ...`
}
const mondayOf = (date: string) => { const d = new Date(`${date.slice(0, 10)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
const dayOf = (date: string) => DAYS[(new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7]
const plusDays = (monday: string, day: string) => { const d = new Date(`${monday}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + Math.max(0, DAYS.indexOf(day as typeof DAYS[number]))); return d.toISOString().slice(0, 10) }
const dayLabel = (date: string) => { const d = new Date(`${date}T00:00:00Z`); return `${DAY_NAMES[dayOf(date)]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` }
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) && !isNaN(+new Date(`${s.slice(0, 10)}T00:00:00Z`))

/** Is this material research the library keeps a copy of? */
export function inLibrary(m: Pick<StoredMaterial, 'kind' | 'role' | 'storage' | 'archived_at' | 'bytes'>): boolean {
  if (m.archived_at) return false
  if (m.storage !== 'text' && m.storage !== 'bucket') return false
  if (!(Number(m.bytes) >= 0) || Number(m.bytes) > MIRROR_FILE_MAX) return false
  return (LIBRARY_KINDS as readonly string[]).includes(m.kind) || (LIBRARY_ROLES as readonly string[]).includes(String(m.role || ''))
}

/** A paste is a verbatim source excerpt: it goes in the piece's `Sources` folder, the rest at the top of it. */
export const isSource = (m: Pick<StoredMaterial, 'kind' | 'role'>) => m.kind === 'paste' || m.role === 'sources' || m.role === 'source'

export interface Place {
  week: string
  /** The piece id, or day:<Monday>/<day|week>. */
  slot: string
  weekName: string
  slotName: string
  /** The day of the week (mon..sun), or 'week'. */
  day: string
  sources: boolean
}

/** Where a material's copy goes: its piece's week (the piece's own date, else the day it was filed) and its piece or day. */
export function placeOf(m: StoredMaterial, piece: PieceInfo | null): Place {
  const scheduled = piece && isDate(piece.scheduled_for) ? piece.scheduled_for.slice(0, 10) : null
  const filed = isDate(m.added_at) ? m.added_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
  if (m.piece_id) {
    const week = scheduled ? mondayOf(scheduled) : isDate(m.week) ? m.week.slice(0, 10) : mondayOf(filed)
    const day = scheduled ? dayOf(scheduled) : (DAYS as readonly string[]).includes(String(m.day)) ? String(m.day) : dayOf(filed)
    const series = piece?.series ? SERIES[piece.series] || piece.series : ''
    const idea = shortWords(piece?.idea || 'Untitled piece', 70)
    const when = scheduled ? dayLabel(scheduled) : 'No date'
    return { week, slot: m.piece_id, weekName: week, day, sources: isSource(m),
      slotName: clean(`${when}${series ? ` ${series}` : ''} - ${idea} (${m.piece_id.slice(0, 8)})`, 150) }
  }
  const match = /^day:(\d{4}-\d{2}-\d{2})\/(mon|tue|wed|thu|fri|sat|sun|week)$/.exec(m.scope)
  const week = match ? match[1] : isDate(m.week) ? m.week.slice(0, 10) : mondayOf(filed)
  const day = match ? match[2] : String(m.day || 'week')
  return { week, slot: `day:${week}/${day}`, weekName: week, day, sources: isSource(m),
    slotName: day === 'week' ? 'Whole week' : `${dayLabel(plusDays(week, day))} (no piece yet)` }
}

const extOf = (s: string) => (s.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || '')

/** The copy's file name: the date it was filed, its title, its version when there is more than one, its extension. */
export function fileNameOf(m: StoredMaterial): string {
  const date = isDate(m.added_at) ? m.added_at.slice(0, 10) : ''
  const keyExt = m.storage === 'bucket' && m.object_key ? extOf(m.object_key) : ''
  const titleExt = extOf(m.title)
  const ext = keyExt || (titleExt && TEXT_TYPES[titleExt] ? titleExt : m.storage === 'text' ? 'md' : '')
  const base = clean(titleExt && titleExt === ext ? m.title.slice(0, -(ext.length + 1)) : m.title, 120) || 'Untitled'
  return `${date ? `${date} ` : ''}${base}${m.version > 1 ? ` (v${m.version})` : ''}${ext ? `.${ext}` : ''}`
}

/** The content type the copy is filed with: the store's own for a file, the extension's for a text. */
export function mimeOf(m: StoredMaterial): string {
  if (m.storage === 'bucket' && m.content_type) return m.content_type
  return TEXT_TYPES[extOf(fileNameOf(m))] || 'text/plain'
}

/** The copy's Drive description: what it is a copy of, and the link back to the piece on the live board. */
export function descriptionOf(m: StoredMaterial, piece: PieceInfo | null, place: Place): string {
  const what = piece ? `piece ${piece.id} (${shortWords(piece.idea || 'Untitled piece', 120)})` : place.day === 'week' ? `the week of ${place.week}` : `${place.day} of the week of ${place.week}`
  return [
    `A copy of ${m.kind} material ${m.id}, version ${m.version}, on ${what}.`,
    `sha256 ${m.sha256}. Filed ${isDate(m.added_at) ? m.added_at.slice(0, 10) : 'on an unknown date'} by ${clean(m.added_by || 'unknown', 80)}.`,
    `The record is the content engine's piece store; this file is its mirror and is never changed.`,
    `Publish Board: ${liveBoardUrl(place.week, place.day === 'week' ? null : place.day)}`,
  ].join('\n')
}

/** The index row for one copy, in INDEX_COLUMNS order. */
export function indexRowOf(m: StoredMaterial, piece: PieceInfo | null, place: Place, link: string): string[] {
  return [
    place.week, place.day === 'week' ? 'week' : DAY_NAMES[place.day] || place.day, place.slotName,
    piece?.series ? SERIES[piece.series] || piece.series : '', m.kind, clean(m.title, 300), isDate(m.added_at) ? m.added_at.slice(0, 10) : '',
    link, m.sha256, String(m.version), clean(m.added_by || '', 80), m.piece_id || '', m.id,
  ]
}

const sha256Hex = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')

/** Copy what is missing and list what is not yet in the index. One pass of the sweep, or one write's own copy. */
export async function mirror(source: LibrarySource, drive: LibraryDrive, index: LibraryIndex, opts: MirrorOptions = {}): Promise<MirrorReport> {
  const rootId = opts.rootId || RESEARCH_LIBRARY_FOLDER_ID
  const now = opts.now ?? Date.now()
  const budget = opts.budgetMs ?? 80_000
  const settle = opts.settleMs ?? SETTLE_MS
  const only = opts.only?.length ? [...new Set(opts.only)] : undefined
  const report: MirrorReport = { ok: true, eligible: 0, already: 0, mirrored: 0, indexed: 0, settling: 0, later: 0, failed: [], copies: [] }

  const all = await source.materials(only)
  const eligible = all.filter(inLibrary).sort((a, b) => String(a.added_at).localeCompare(String(b.added_at)) || a.version - b.version)
  report.eligible = eligible.length
  if (!eligible.length) return report

  // Read Drive before writing anything: when it cannot be read, nothing is made (so nothing is made twice).
  const root = await drive.root(rootId)
  if ('why' in root) return { ...report, ok: false, error: `research_library_unavailable: ${root.why}` }
  let copies: LibraryFile[]
  let folders: LibraryFolder[]
  try {
    copies = await drive.files(rootId, only ? eligible.map(m => m.id) : undefined)
    folders = await drive.folders(rootId)
  } catch (e) {
    return { ...report, ok: false, error: `research_library_unreadable: ${(e as Error).message.slice(0, 160)}` }
  }
  const copyOf = new Map<string, LibraryFile>()
  for (const f of copies) if (f.material && !copyOf.has(f.material)) copyOf.set(f.material, f)
  const weekFolder = new Map<string, string>()
  const slotFolder = new Map<string, string>()
  const sourcesFolder = new Map<string, string>()
  for (const f of folders) {
    const kind = f.props[PROP.kind]
    if (kind === 'week' && f.props[PROP.week] && !weekFolder.has(f.props[PROP.week])) weekFolder.set(f.props[PROP.week], f.id)
    if (kind === 'slot' && f.props[PROP.slot] && !slotFolder.has(f.props[PROP.slot])) slotFolder.set(f.props[PROP.slot], f.id)
    if (kind === 'sources' && f.props[PROP.slot] && !sourcesFolder.has(f.props[PROP.slot])) sourcesFolder.set(f.props[PROP.slot], f.id)
  }

  let listed: Set<string> | null = null
  try { listed = await index.materialIds() } catch (e) { report.index_error = `index_unreadable: ${(e as Error).message.slice(0, 160)}` }

  const pieces = await source.pieces([...new Set(eligible.map(m => m.piece_id).filter((x): x is string => Boolean(x)))])
  const base = { [PROP.root]: rootId }
  const ensure = async (cache: Map<string, string>, key: string, parent: string, name: string, props: Record<string, string>) => {
    const found = cache.get(key)
    if (found) return found
    const id = await drive.createFolder(parent, name, { ...base, ...props })
    cache.set(key, id)
    return id
  }

  const rows: string[][] = []
  const started = Date.now()
  for (const m of eligible) {
    // A young material is the write's that filed it (its copy and its row both): the sweep leaves it alone.
    const age = now - +new Date(m.added_at)
    if (!only && Number.isFinite(age) && age < settle) { report.settling++; continue }
    const piece = m.piece_id ? pieces.get(m.piece_id) ?? null : null
    const place = placeOf(m, piece)
    let copy = copyOf.get(m.id)
    if (copy) {
      report.already++
      report.copies.push({ material: m.id, link: copy.link, created: false })
    } else {
      if (Date.now() - started > budget) { report.later++; continue }
      try {
        const bytes = await source.bytes(m)
        if (!bytes) { report.failed.push({ id: m.id, why: 'bytes_unavailable' }); continue }
        if (bytes.byteLength !== Number(m.bytes) || sha256Hex(bytes) !== m.sha256) { report.failed.push({ id: m.id, why: 'store_bytes_differ' }); continue }
        const weekId = await ensure(weekFolder, place.week, rootId, place.weekName, { [PROP.kind]: 'week', [PROP.week]: place.week })
        const slotId = await ensure(slotFolder, place.slot, weekId, place.slotName, { [PROP.kind]: 'slot', [PROP.slot]: place.slot })
        const parent = place.sources ? await ensure(sourcesFolder, place.slot, slotId, 'Sources', { [PROP.kind]: 'sources', [PROP.slot]: place.slot }) : slotId
        copy = await drive.createFile({
          parentId: parent, name: fileNameOf(m), mime: mimeOf(m), bytes, description: descriptionOf(m, piece, place),
          props: { ...base, [PROP.kind]: 'material', [PROP.material]: m.id, [PROP.sha]: m.sha256 },
        })
        copyOf.set(m.id, copy)
        // Drive's own sha256 of what it holds: a copy that differs is reported, and left for Krish to see, never replaced.
        if (copy.sha256 && copy.sha256.toLowerCase() !== m.sha256) report.failed.push({ id: m.id, why: 'drive_bytes_differ' })
        report.mirrored++
        report.copies.push({ material: m.id, link: copy.link, created: true })
      } catch (e) {
        report.failed.push({ id: m.id, why: (e as Error).message.slice(0, 120) || 'drive_failed' })
        continue
      }
    }
    if (listed && !listed.has(m.id)) { rows.push(indexRowOf(m, piece, place, copy.link)); listed.add(m.id) }
  }

  if (rows.length && listed) {
    try { await index.append(rows); report.indexed = rows.length } catch (e) { report.index_error = `index_append_failed: ${(e as Error).message.slice(0, 160)}` }
  }
  report.ok = report.failed.length === 0 && !report.index_error
  if (!report.ok && !report.error) report.error = report.index_error || `${report.failed.length} cop${report.failed.length === 1 ? 'y' : 'ies'} failed: ${report.failed.slice(0, 3).map(f => f.why).join(', ')}`
  return report
}
