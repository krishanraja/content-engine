// Backfill step 1 of step 4 (one done-check sweep): give each open board
// item that says nothing about how it ends a kind, so the sweep can end it.
//
// Krish, 2026-10-11: "I am happy to Clear(complete)/Bump/Purge things off my
// lists as I go but the rest should be automatically done."
//
// Run once, after migration 20261022091000_on_you_closes_itself.sql is
// applied and the engine code that knows the kinds is live:
//
//   ACCESS_CODE=... npx tsx scripts/backfill_closes.ts --dry-run   print what it would write
//   ACCESS_CODE=... npx tsx scripts/backfill_closes.ts             write it
//
// It writes through POST /api/workbench as client control_center (Control
// Center's own job, on the access cookie), so the route checks every write as
// it checks any other. Every item stays in the lane it is in: this script
// never closes anything, never opens anything and never puts anything on
// Krish's list (planWrites refuses to build such a write; send refuses to send
// one). It strips the "Held from your list on <date>: ..." line the readiness
// migration wrote, because the held line is now Control Center's to say.
//
// The launch post's share image needs two facts from the launch post
// itself: which post it is (the one newsletter on the launch date, in the
// publication's own archive) and the file id of the share image it shows
// now (its own og:image: the Monday follow.the.money card the item names).
// That file id is "was", so the check closes the item only once the post
// shows a different image; it is never compared with another post's image.
// If either fact is not certain, the item is left as it is and the run says
// why, so the building session asks Krish which post it is.
//
// Read back with SQL afterwards (the step 4 plan, 4.4):
//   select id from work_board_items where lane in ('on_you','in_progress') and closes_on is null   -- no rows

import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

export const ENGINE = (process.env.ENGINE_BASE_URL || 'https://content-engine-flame-nu.vercel.app').replace(/\/$/, '')
export const PUBLICATION = 'https://home.makeyourmindup.ai'
export const ARCHIVE = `${PUBLICATION}/api/v1/archive?sort=new&limit=25`
/** The launch post went out on 6 October. */
export const LAUNCH_DATE = '2026-10-06'
const ZONE = 'America/New_York'

export interface BoardRow {
  id: string
  lane: string
  title?: string | null
  detail?: string | null
  link?: string | null
  link_label?: string | null
  closes_on?: string | null
}
export interface ArchivePost { id: number; url: string; posted_at: string; type: string }
export type Write = { id: string } & Record<string, unknown>
export interface Plan { writes: Write[]; skipped: Array<{ id: string; why: string }> }

const HELD = /^Held from your list on [^:]{1,40}: it [^.]*\.\s*/
const FILE_ID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_\d+x\d+\.(?:png|jpe?g|webp|gif))/i
/** Fields a backfill write may carry. Never lane, never closed_proof. */
const ALLOWED = new Set(['id', 'title', 'detail', 'link', 'link_label', 'closes_on', 'close_ref'])

/** The detail without the held line the readiness migration put in front of it. */
export function stripHeld(detail: string | null | undefined): string {
  return String(detail ?? '').replace(HELD, '')
}

/** The share image's file id (<uuid>_<w>x<h>.<ext>) in a post page's og:image, or null. */
export function shareFileId(html: string): string | null {
  const tag = /<meta[^>]+property=["']og:image["'][^>]*>/i.exec(html)?.[0]
    ?? /<meta[^>]+content=["'][^"']+["'][^>]+property=["']og:image["'][^>]*>/i.exec(html)?.[0]
  const content = tag ? /content=["']([^"']+)["']/i.exec(tag)?.[1] : undefined
  if (!content) return null
  let url = content.replace(/&amp;/g, '&')
  try { url = decodeURIComponent(url) } catch { /* keep it as it is */ }
  return FILE_ID.exec(url)?.[1] ?? null
}

/** The calendar day a post went out, in New York. */
export function dayOf(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

/** The one newsletter that went out on this day, or why there is not exactly one. */
export function oneNewsletterOn(posts: readonly ArchivePost[], day: string): ArchivePost | string {
  const found = posts.filter(p => p.type === 'newsletter' && dayOf(p.posted_at) === day)
  if (found.length === 1) return found[0]!
  return `${found.length} newsletters went out on ${day}, so which one it is is not certain`
}

export interface Facts {
  /** The launch post, or why it is not certain. */
  launch: ArchivePost | string
  /** The file id of the share image the launch post shows now (its own og:image), or null. */
  launchFileId: string | null
  /** Why that file id could not be read. */
  launchWhy?: string
  now: string
}

/** The writes backfill step 1 makes, item by item, from the open board. An
 *  item that is gone, closed, or already says how it ends is left alone. */
export function planWrites(board: readonly BoardRow[], facts: Facts): Plan {
  const writes: Write[] = []
  const skipped: Plan['skipped'] = []
  const open = new Map(board.filter(r => r.lane === 'on_you' || r.lane === 'in_progress').map(r => [r.id, r]))
  const take = (id: string): BoardRow | null => {
    const row = open.get(id)
    if (!row) { skipped.push({ id, why: 'not open on the board' }); return null }
    if (row.closes_on) { skipped.push({ id, why: `already says how it ends (${row.closes_on})` }); return null }
    return row
  }
  const detail = (row: BoardRow, more = '') => ({ detail: (stripHeld(row.detail) + more).slice(0, 2000) })

  const launch = take('you-launch-today')
  if (launch) {
    if (typeof facts.launch === 'string') skipped.push({ id: launch.id, why: `the launch post: ${facts.launch}. Ask Krish which post it is.` })
    else if (!facts.launchFileId || facts.launchWhy) skipped.push({ id: launch.id, why: `the launch post's share image: ${facts.launchWhy || 'its file id could not be read'}. Ask Krish which post it is.` })
    else {
      writes.push({
        id: launch.id,
        closes_on: 'share_image_changed',
        // What the launch post shows now: only a real swap closes it.
        close_ref: { url: facts.launch.url, was: facts.launchFileId },
        link: `${PUBLICATION}/publish/post/${facts.launch.id}`,
        link_label: 'Open the post settings',
        ...detail(launch),
      })
    }
  }

  const key = take('you-engine-github-key')
  if (key) {
    const more = ' A changed key reaches the engine only after a redeploy.'
    writes.push({
      id: key.id,
      title: "Replace the engine's GitHub key, then press Redeploy",
      closes_on: 'job_ok',
      close_ref: { job: 'build_signals', after: facts.now, probe: 'dry' },
      ...detail(key, stripHeld(key.detail).includes(more.trim()) ? '' : more),
    })
  }

  for (const row of board.filter(r => /^week-publish-board-\d{4}-\d{2}-\d{2}$/.test(r.id))) {
    const week = take(row.id)
    if (week) writes.push({ id: week.id, closes_on: 'week_published', ...detail(week) })
  }

  const welcome = take('you-welcome-days')
  if (welcome) {
    writes.push({
      id: welcome.id,
      closes_on: 'his_word',
      link: `${PUBLICATION}/publish/settings`,
      link_label: 'Open the welcome email settings',
      ...detail(welcome),
    })
  }

  // Session work: the session that holds it closes it, or the sweep lets it go after 7 untouched days.
  for (const id of ['ruling-fascinating', 'you-outside-tools', 'doing-remote-studio', 'doing-first-lease']) {
    const row = take(id)
    if (row) writes.push({ id: row.id, closes_on: 'session', ...(HELD.test(String(row.detail ?? '')) ? detail(row) : {}) })
  }

  // Anything else open and silent is named, never guessed.
  const named = new Set([...writes.map(w => w.id), ...skipped.map(s => s.id)])
  for (const row of open.values()) {
    if (!row.closes_on && !named.has(row.id)) skipped.push({ id: row.id, why: 'not in the step 4 plan; a session gives it a kind by hand' })
  }
  for (const w of writes) assertNeverCloses(w)
  return { writes, skipped }
}

/** A backfill write only says how an item ends. It never moves a lane, so it never closes, opens or puts anything on Krish. */
export function assertNeverCloses(w: Write): void {
  const bad = Object.keys(w).filter(k => !ALLOWED.has(k))
  if (bad.length) throw new Error(`refused: the backfill write for ${w.id} carries ${bad.join(', ')}; it may only say how the item ends`)
}

export function accessCookie(code: string): string {
  return `cc_access=${createHash('sha256').update(code).digest('hex')}`
}

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
  const text = await r.text()
  if (!r.ok) throw new Error(`${url.split('?')[0]} answered ${r.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text) as unknown
}

export function readArchive(raw: unknown): ArchivePost[] {
  if (!Array.isArray(raw)) return []
  return (raw as Array<Record<string, unknown>>).flatMap(p => {
    const url = typeof p.canonical_url === 'string' ? p.canonical_url : ''
    const at = typeof p.post_date === 'string' ? p.post_date : ''
    if (!/^https:\/\//.test(url) || Number.isNaN(Date.parse(at))) return []
    return [{ id: Number(p.id) || 0, url, posted_at: at, type: typeof p.type === 'string' ? p.type : 'newsletter' }]
  })
}

export async function gatherFacts(now: string): Promise<Facts> {
  const posts = readArchive(await getJson(ARCHIVE, { headers: { accept: 'application/json' } }))
  const launch = oneNewsletterOn(posts, LAUNCH_DATE)
  if (typeof launch === 'string') return { launch, launchFileId: null, now }
  // The share image the launch post itself shows now, never another post's.
  try {
    const r = await fetch(launch.url, { signal: AbortSignal.timeout(20_000) })
    if (!r.ok) return { launch, launchFileId: null, launchWhy: `the launch post answered ${r.status}`, now }
    const id = shareFileId(await r.text())
    return id ? { launch, launchFileId: id, now } : { launch, launchFileId: null, launchWhy: 'the launch post shows no share image with a file id', now }
  } catch (e) {
    return { launch, launchFileId: null, launchWhy: `the launch post could not be read (${(e as Error).message.slice(0, 80)})`, now }
  }
}

async function main(argv: string[]): Promise<number> {
  const dry = argv.includes('--dry-run')
  const code = process.env.ACCESS_CODE
  if (!code) {
    console.error('ACCESS_CODE is not set. It writes as Control Center, on the access cookie; set it in this shell (never paste it into a chat).')
    return 2
  }
  const headers = { cookie: accessCookie(code), 'content-type': 'application/json' }
  const board = await getJson(`${ENGINE}/api/workbench`, { headers }) as { items?: BoardRow[] }
  const now = new Date().toISOString()
  const plan = planWrites(board.items ?? [], await gatherFacts(now))
  for (const w of plan.writes) console.log(`${dry ? 'would write' : 'writing'}: ${JSON.stringify(w)}`)
  for (const s of plan.skipped) console.log(`left as it is: ${s.id}: ${s.why}`)
  if (dry || !plan.writes.length) {
    console.log(dry ? `Dry run: ${plan.writes.length} writes, nothing sent.` : 'Nothing to write.')
    return 0
  }
  for (const w of plan.writes) assertNeverCloses(w)
  const out = await getJson(`${ENGINE}/api/workbench`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'upsert_items', client: 'control_center', items: plan.writes }),
  }) as { ok?: boolean; written?: string[] }
  console.log(`Written: ${(out.written ?? []).join(', ')}. Read it back with SQL (the script's header).`)
  return out.ok ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then(code => process.exit(code), (e: Error) => { console.error(e.message); process.exit(1) })
}
