// Runs the control plane's structural guards from apps/control-plane, where
// their inputs live (api/, lib/, vercel.json, the migration fixtures).
//
// Each guard encodes an invariant that already shipped broken once in Control
// Center; they came across with the routes in the 2026-09 unification. They
// are skipped on Windows: several build paths with `new URL().pathname`, which
// is not a Windows path, and the routes only ever run on Vercel's Linux.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const appRoot = resolve(fileURLToPath(new URL('../apps/control-plane/', import.meta.url)))

const GUARDS = [
  'check-env-example',
  'check-content-engine-schedule',
  'check-content-window',
  'check-unified-content-spine',
  'check-content-chain',
  'check-content-expiry',
  'check-content-vocabulary',
  'check-content-seed-security',
  'check-content-production-bridge',
  'check-editorial-radar',
  'check-build-signals',
  'check-arc-scoring',
  'check-card-lint',
  'check-slate-calibration',
  'check-teardown-beat',
  'check-selection',
  'check-anchor-attribution',
  'check-video-studio-control-plane',
  'check-video-studio-command-security',
  'check-video-studio-export',
  'check-studio-session-gateway',
]

if (process.platform === 'win32') {
  console.log('control-plane guards: skipped on Windows (Linux-only paths; the routes deploy to Linux)')
  process.exit(0)
}

let failed = 0
for (const guard of GUARDS) {
  const result = spawnSync('npx', ['tsx', `scripts/${guard}.ts`], { cwd: appRoot, stdio: 'inherit', env: process.env })
  if (result.status !== 0) { failed += 1; console.log(`FAIL  ${guard}`) }
}
if (failed) { console.log(`${failed} control-plane guard(s) failed`); process.exit(1) }
console.log(`PASS  ${GUARDS.length} control-plane guards`)
