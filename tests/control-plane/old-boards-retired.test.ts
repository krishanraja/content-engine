import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { describe, expect, it } from 'vitest'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { LIVE_BOARD_URL } from '../../apps/control-plane/api/board/_liveBoard.js'

// OLD_BOARD_RETIRED. Ruling (Krish, 2026-11-13): "We need to retire the old publish boards now permanently". The one
// live board is Control Centre's Content tab (Ruling, Krish, 2026-11-11). The engine's own board pages (the baked week
// board week_board.py built and board_web.py publish-web put live, the desk the board-next client drew, and the
// read-only archive both became) are gone: every old address answers a permanent redirect to the live board at the
// same week, and nothing builds, publishes or serves a board page again. This test fails if any of it comes back, or
// if anything a session reads first sends anyone to content.krishraja.com/board to work. What was retired and where it
// lived: docs/history/2026-11-13-old-boards-retired.md.

const ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')

function files(dir: string, keep: (path: string) => boolean, deep = true): string[] {
  const out: string[] = []
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name)
      if (statSync(path).isDirectory()) { if (deep && name !== 'node_modules' && name !== 'dist') walk(path) }
      else if (keep(path)) out.push(relative(ROOT, path).replace(/\\/g, '/'))
    }
  }
  if (existsSync(join(ROOT, dir))) walk(join(ROOT, dir))
  return out.sort()
}

/** One request to the board's handler with no store at all: a redirect must answer before anything is read. */
async function ask(query: Record<string, string>, method = 'GET') {
  const handler = createBoardHandler(async () => { throw new Error('an old board address must not reach the store') })
  const out: { status: number; location: string | null; headers: Record<string, string> } = { status: 0, location: null, headers: {} }
  const res = {
    setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v },
    status(code: number) { out.status = code; return this },
    json() { return this }, send() { return this }, end() { return this },
    redirect(code: number, url: string) { out.status = code; out.location = url; return this },
  } as unknown as VercelResponse
  await handler({ method, headers: {}, query } as unknown as VercelRequest, res)
  return out
}

// What was retired. Each must stay gone.
const RETIRED_PATHS = [
  // The baked week board: its builder, templates and client, its layout lock and the checks that drew it.
  'scripts/post-pack/week_board.py', 'scripts/post-pack/week_board', 'scripts/post-pack/board_v4.py',
  'scripts/post-pack/board_today.py', 'scripts/post-pack/board_shots.py', 'scripts/check_board_layout.py',
  'config/board-layout.json', 'fixtures/week-board',
  // Its publisher's other halves: the Claude-artifact importer and the two-account sync hook.
  'scripts/post-pack/board_import.py', 'scripts/hooks/board_sync.py',
  // The desk (/board/<Monday> from 10 Nov) and the read-only archive both pages became.
  'apps/control-plane/board-next', 'apps/control-plane/api/board/_deskPage.ts', 'apps/control-plane/api/board/_readOnly.ts',
  'scripts/build-desk-page.mjs', 'scripts/check-desk-devices.mjs',
  // The workflow that rebuilt and republished a week's page.
  '.github/workflows/board-rebuild.yml',
]

// A builder, publisher or server of a board page brought back into use: imported, run, served or called, by the names
// they went by. (A comment that records what the old builder did is history, not a revival.)
const REVIVAL = /\bimport week_board\b|\bfrom week_board import\b|python3? [^\s'"`]*week_board\.py|\b(board_v4|board_today|board_shots|board_import|check_board_layout)\.py\b|import (board_v4|board_today|board_shots|board_import)\b|build-desk-page|check-desk-devices|_deskPage\.js|DESK_PAGE|readOnlyArchive|_readOnly\.js|board-next\/|board_web\.py (publish-web|download|rollback|convert-export)|['"]publish-web['"]|rpc\('board_activate'|board_sync\.py|check:board-layout|check:desk-page/
const CODE = [
  ...files('scripts', (p) => /\.(py|ts|mts|mjs|js|sh|ps1)$/.test(p)),
  ...files('apps/control-plane/api', (p) => /\.ts$/.test(p)),
  ...files('apps/control-plane/scripts', (p) => /\.(ts|py|mjs)$/.test(p)),
  ...files('.github/workflows', (p) => /\.ya?ml$/.test(p)),
  ...files('.claude', (p) => /\.(json|mjs|sh)$/.test(p)),
  'package.json', 'apps/control-plane/vercel.json',
].filter((path) => !/(^|\/)_presses\.ts$/.test(path)) // a press records who read the words back by the name it had then

// Everything a session, a run or Krish is pointed by: the rules, the skills, the workflow prompts, the docs a session
// reads, the configs and the scripts that print a link. The records (his rejections, the failure and learning
// registers, the dated history, handovers and plans) keep what was said when it was said; they are not actors.
// docs/REPO_MAP.md is generated from the code.
const RECORDS = /^(config\/(failures|learnings|rejection-floor|reference-cuts)\.json|docs\/REPO_MAP\.md)$/
const ACTORS = [
  'AGENTS.md', 'CLAUDE.md', 'WORKBENCH.md', 'README.md',
  ...files('docs', (p) => p.endsWith('.md'), false),
  ...files('docs/prompts', (p) => p.endsWith('.md')),
  ...files('docs/ve', (p) => p.endsWith('.md'), false),
  ...files('.agents/skills', (p) => /\.(md|json)$/.test(p)),
  ...files('.claude/skills', () => true),
  ...files('.claude/agents', () => true),
  ...files('.github/workflows', (p) => /\.ya?ml$/.test(p)),
  ...files('config', (p) => p.endsWith('.json'), false),
  ...files('scripts', (p) => /\.(py|ts|mts|mjs|sh|ps1|md)$/.test(p)),
].filter((path) => !RECORDS.test(path))

const OLD_BOARD = /content\.krishraja\.com\/board(?!\/standards)/
/** Lines naming an old board address with no word within three lines either side saying it is retired or redirects. */
function unmarked(text: string): number[] {
  const lines = text.split('\n')
  const out: number[] = []
  lines.forEach((line, i) => {
    if (!OLD_BOARD.test(line)) return
    const near = lines.slice(Math.max(0, i - 3), i + 4).join(' ')
    if (!/retired|redirect/i.test(near)) out.push(i + 1)
  })
  return out
}

describe('the old publish boards are retired for good (Ruling, Krish, 2026-11-13)', () => {
  it('every old board address answers a permanent redirect to the live board at the same week, before any read', async () => {
    const week = `${LIVE_BOARD_URL}?week=2026-10-26`
    // /board/<Monday> (and #monday, which the browser keeps to itself), the older baked board, the desk, a phone's HEAD.
    for (const [query, method] of [
      [{ week: '2026-10-26', op: 'html' }, 'GET'],
      [{ week: '2026-10-26', op: 'html', archive: '1' }, 'GET'],
      [{ week: '2026-10-26', op: 'next' }, 'GET'],
      [{ week: '2026-10-26', op: 'html' }, 'HEAD'],
      [{ week: '2026-10-26', op: 'html' }, 'POST'],
    ] as const) {
      const r = await ask({ ...query }, method)
      expect([r.status, r.location], JSON.stringify(query) + method).toEqual([308, week])
    }
    // A day the address names, the newest board (/board) and the desk with no week.
    expect((await ask({ week: '2026-11-16', op: 'html', day: 'wed' })).location).toBe(`${LIVE_BOARD_URL}?week=2026-11-16&day=wed`)
    expect(await ask({ op: 'latest' })).toMatchObject({ status: 308, location: LIVE_BOARD_URL })
    expect(await ask({ op: 'next' })).toMatchObject({ status: 308, location: LIVE_BOARD_URL })
    // Not a Monday: the live board, which opens on this week.
    expect(await ask({ week: '2026-10-27', op: 'html' })).toMatchObject({ status: 308, location: LIVE_BOARD_URL })
  })

  it('routes every old page address to that redirect, and keeps no route for a page, an upload, an import or a build', () => {
    const v = JSON.parse(read('apps/control-plane/vercel.json')) as { rewrites: Array<{ source: string; destination: string }> }
    const page = (source: string) => v.rewrites.find((r) => r.source === source)?.destination ?? ''
    expect(page('/board')).toMatch(/[?&]op=latest\b/)
    expect(page('/board/:week')).toMatch(/[?&]op=html\b/)
    expect(page('/board/next')).toMatch(/[?&]op=next\b/)
    expect(page('/board/next/:week')).toMatch(/[?&]op=next\b/)
    const ops = v.rewrites.map((r) => /[?&]op=([a-z-]+)/.exec(r.destination)?.[1]).filter(Boolean)
    for (const gone of ['state', 'uploads', 'imports', 'sources', 'assets']) expect(ops, gone).not.toContain(gone)
  })

  it('leaves the old pages, their builders, their publishers and their workflow gone', () => {
    expect(RETIRED_PATHS.filter((path) => existsSync(join(ROOT, path)))).toEqual([])
    expect(CODE.length).toBeGreaterThan(100)
    const revived = CODE.filter((path) => path !== 'tests/control-plane/old-boards-retired.test.ts' && REVIVAL.test(read(path)))
    expect(revived, 'an old board page, builder or publisher came back').toEqual([])
    // The board's store is read and signalled from a session, never published to.
    const web = read('scripts/post-pack/board_web.py')
    expect([...web.matchAll(/add_parser\('([a-z-]+)'/g)].map((m) => m[1])).toEqual(['read', 'touch'])
    // And the check catches what it is for.
    expect(REVIVAL.test('    import week_board')).toBe(true)
    expect(REVIVAL.test('python3 scripts/post-pack/week_board.py --week 2026-11-16 --out board.html')).toBe(true)
    expect(REVIVAL.test("python3 scripts/post-pack/board_web.py publish-web week.html --apply")).toBe(true)
    expect(REVIVAL.test("const r = await db.rpc('board_activate', {})")).toBe(true)
    expect(REVIVAL.test("import { DESK_PAGE } from './_deskPage.js'")).toBe(true)
    expect(REVIVAL.test('import week_plan')).toBe(false)
    expect(REVIVAL.test('# the old board (week_board.py run_sheet) read these until it was retired')).toBe(false)
  })

  it('sends nobody to content.krishraja.com/board to work: every mention says it is retired and redirects', () => {
    expect(ACTORS).toEqual(expect.arrayContaining(['AGENTS.md', 'WORKBENCH.md', 'docs/PUBLISH_BOARDS.md', 'docs/STATE.md',
      '.agents/skills/make-piece/SKILL.md', '.claude/skills/plan-week/SKILL.md', 'config/boards.json', 'scripts/post-pack/live_board.py']))
    const found: string[] = []
    for (const path of ACTORS) for (const line of unmarked(read(path))) found.push(`${path}:${line}`)
    expect(found, 'name the old board only as retired, its addresses redirecting to the live board').toEqual([])
    // The check catches what it is for, and leaves the standards page (not a board) alone.
    expect(unmarked('Read the archive at content.krishraja.com/board/2026-11-09.')).toEqual([1])
    expect(unmarked('content.krishraja.com/board/<Monday> is retired; it redirects to the live board.')).toEqual([])
    expect(unmarked('He decides them at content.krishraja.com/board/standards.')).toEqual([])
    // The link config names the live board alone.
    const boards = JSON.parse(read('config/boards.json')) as Record<string, unknown>
    expect(Object.keys(boards).sort()).toEqual(['_about', 'live_board', 'weeks'])
    expect(read('scripts/post-pack/live_board.py')).not.toMatch(/def archive_url/)
  })
})
