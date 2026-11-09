// Builds the live board's page (docs/plans/2026-11-09-board-desk/PLAN.md): the React client in
// apps/control-plane/board-next (Vite, one self-contained HTML file) into apps/control-plane/api/board/_deskPage.ts,
// which the board serves. `node scripts/build-desk-page.mjs --check` builds it again and fails when the committed
// module is out of date, so the page served is always the page reviewed.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const app = `${root}apps/control-plane/board-next`
const out = `${root}apps/control-plane/api/board/_deskPage.ts`
execFileSync('npx', ['tsc', '-p', `${app}/tsconfig.json`], { stdio: 'inherit', cwd: root })
execFileSync('npx', ['vite', 'build', '--config', `${app}/vite.config.ts`], { stdio: ['ignore', 'ignore', 'inherit'], cwd: root })
const page = readFileSync(`${app}/dist/index.html`, 'utf8')
const built = `// Built by scripts/build-desk-page.mjs from apps/control-plane/board-next. Do not edit by hand.\nexport const DESK_PAGE: string = ${JSON.stringify(page)}\n`
if (process.argv.includes('--check')) {
  let now = ''
  try { now = readFileSync(out, 'utf8') } catch {}
  if (now !== built) { console.error('api/board/_deskPage.ts is out of date: run node scripts/build-desk-page.mjs'); process.exit(1) }
  console.log('desk page is current')
} else { writeFileSync(out, built); console.log(`built api/board/_deskPage.ts (${Math.round(page.length / 1024)} KB)`) }
