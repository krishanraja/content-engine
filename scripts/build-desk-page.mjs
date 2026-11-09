// Builds apps/control-plane/api/board/_deskPage.ts from apps/control-plane/board-next/desk.html, the live board's one
// source (docs/plans/2026-11-09-board-desk/PLAN.md). `node scripts/build-desk-page.mjs --check` fails when the built
// module is out of date, so the page served is always the page reviewed.
import { readFileSync, writeFileSync } from 'node:fs'
const src = new URL('../apps/control-plane/board-next/desk.html', import.meta.url)
const out = new URL('../apps/control-plane/api/board/_deskPage.ts', import.meta.url)
const page = readFileSync(src, 'utf8')
const built = `// Built by scripts/build-desk-page.mjs from apps/control-plane/board-next/desk.html. Do not edit by hand.\nexport const DESK_PAGE: string = ${JSON.stringify(page)}\n`
if (process.argv.includes('--check')) {
  let now = ''
  try { now = readFileSync(out, 'utf8') } catch {}
  if (now !== built) { console.error('api/board/_deskPage.ts is out of date: run node scripts/build-desk-page.mjs'); process.exit(1) }
  console.log('desk page is current')
} else { writeFileSync(out, built); console.log('built api/board/_deskPage.ts') }
