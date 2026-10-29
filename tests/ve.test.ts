import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ProductionSpecV2Schema } from '../packages/contracts/src/production-spec'

// ve, the spec-driven video engine (docs/ve/ENGINE.md). Friday 23 Oct's failures are fixtures here:
// a spec that carries one is refused, and media that shows one fails QC.
const ROOT = join(__dirname, '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
const py = (args: string[]) => spawnSync(PY, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
const fixture = () => JSON.parse(readFileSync(join(ROOT, 'fixtures/ve/my-test-19s/spec.json'), 'utf8'))

describe('ve', () => {
  it('the my-test proof spec passes the schema', () => {
    const parsed = ProductionSpecV2Schema.safeParse(fixture())
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  })

  it('captions cannot be switched off', () => {
    const spec = fixture(); spec.brand.captions = 'none'
    expect(ProductionSpecV2Schema.safeParse(spec).success).toBe(false)
  })

  it('mind.the.gap cannot ship without its dated call', () => {
    const spec = fixture(); delete spec.call
    expect(ProductionSpecV2Schema.safeParse(spec).success).toBe(false)
  })

  it('generated media can never be evidence', () => {
    const spec = fixture()
    spec.assets.push({ id: 'fake', kind: 'screenshot', origin: 'generated', path: 'x.png', sha256: '0'.repeat(64), licence: 'generated', tool: 'imagegen' })
    expect(ProductionSpecV2Schema.safeParse(spec).success).toBe(false)
  })

  it('a generated picture needs no on-screen ILLUSTRATION label (Krish, 28 Oct 2026: "Yes remove those.")', () => {
    const spec = fixture()
    spec.assets.push({ id: 'plate', kind: 'illustration', origin: 'generated', path: 'plate.png', sha256: '0'.repeat(64), licence: 'generated', tool: 'imagegen' })
    const parsed = ProductionSpecV2Schema.safeParse(spec)
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  })

  for (const [name, file] of [
    ['the crew lints refuse every Friday failure a spec can carry', 'tests/ve_lint_test.py'],
    ['QC measures holds, redraw loops, dead air and loudness on real media', 'tests/ve_qc_test.py'],
    ['removing a card worktree never follows its node_modules link', 'tests/ve_cards_test.py'],
    ['ve qc runs the calibrated cut gates: words, joins in gaps, captions clock and renderer truth (W2.4)', 'tests/ve_gates_test.py'],
    ['ve conform cuts only in gaps both aligners agree on, with 20-40 ms fades and one speed for picture and sound (F09, F10)', 'tests/ve_conform_test.py'],
    ['ve in shadow: draft locks wait for Gate 2, file needs READY, briefs carry the floor, golden slots wait for his words', 'tests/ve_shadow_test.py'],
    ['one local layout: every reader resolves from config/studio.json and the path guard fails on a planted path', 'tests/ve_local_roots_test.py'],
    ['the route check at parity: per-piece code is banned only for a move that has a device', 'tests/ve_route_test.py'],
    ['the weekly device sprint: briefs, cards from filled fields, Gate 2 in his words, the Archive feed', 'tests/ve_sprint_test.py'],
  ] as const) {
    it(name, () => {
      const r = py([file])
      expect(r.status, r.stdout + r.stderr).toBe(0)
    }, 300_000)
  }
})
