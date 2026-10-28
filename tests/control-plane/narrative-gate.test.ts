import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

// scripts/post-pack/making.py, the narrative gate. Krish, 2026-10-28: "Claude interviews me on all three ideas to
// nail down the narrative arc, make it really powerful, useful, and fun to consume, and really find the deeper story
// beneath the surface story." The Sunday room (plan-week) writes one narrative lock per piece and he signs it once.
// From the week of 9 Nov 2026 the scripts step refuses without it, and the signed lock is the outline's approval.
// Pieces from before 9 Nov (the backlog) are untouched.

const ROOT = join(__dirname, '..', '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
// Nothing here may reach the engine: no key, and an address that cannot resolve.
const env: NodeJS.ProcessEnv = { ...process.env, ENGINE_BASE_URL: 'https://engine.invalid', ENGINE_CREDENTIALS_ENV_ONLY: '1', PYTHONIOENCODING: 'utf-8' }
delete env.ENGINE_OPERATOR_TOKEN
delete env.MAKING_BY
for (const name of Object.keys(env)) if (name.startsWith('CODEX')) delete env[name]
const PIECE = '7d5e2c1a-3b4f-4a6d-8e9f-0a1b2c3d4e5f'
const work = mkdtempSync(join(tmpdir(), 'narrative-gate-test-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

function making(args: string[]) {
  return spawnSync(PY, [join(ROOT, 'scripts', 'post-pack', 'making.py'), ...args], { encoding: 'utf8', env, cwd: work })
}

/** A plans folder with the two dated drafts, and a week folder for the lock. */
function plans(name: string, date: string) {
  const dir = join(work, name)
  mkdirSync(join(dir, `${date.slice(0, 10)}-week`), { recursive: true })
  for (const file of [`${date}-draft-script.md`, `${date}-draft-script-90s.md`]) writeFileSync(join(dir, file), 'Words.\n')
  return { dir, scripts: [join(dir, `${date}-draft-script.md`), join(dir, `${date}-draft-script-90s.md`)] }
}

function lock(signature = 'Signed by Krish: "yes, lock it", 2026-11-01') {
  return [
    '# Narrative lock: Mon 9 Nov follow.the.money - Cheap models', '',
    `piece_id: ${PIECE}`, 'Publishes: 2026-11-09', '',
    '## Surface story', '', 'Three firms cut prices in one week.', '',
    '## Deeper story', '', 'The price is the bait.', '',
    '## Arc', '', '- Open on the cut', '- Turn on who pays', '- Close on the bill', '',
    '## The fun', '', 'The receipt that never stops printing.', '',
    '## His close', '', 'Check what you pay for before Monday.', '',
    '## Facts to check', '', '- The price cut | https://example.org | to check', '',
    '## Outline', '', 'Spine: Who pays for the cheap model?', 'Answer: You do, later.',
    '1. THE CUT | proves: the price fell', '2. THE BILL | proves: you pay later', '',
    '## Style recipe', '', 'Script: receipt. Production: statement wall.', '',
    '## Music bed', '', 'The approved follow.the.money bed.', '',
    signature, '',
  ].join('\n')
}

describe('the narrative gate in making.py', () => {
  it('refuses the scripts of a piece from 9 Nov with no narrative lock, before any engine call', () => {
    const { scripts } = plans('none', '2026-11-09')
    const result = making([PIECE, 'scripts', ...scripts])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/no signed narrative lock/)
    expect(result.stderr).not.toMatch(/engine key|Traceback/)
  })

  it('refuses a lock he has not signed, and the check says why', () => {
    const { dir, scripts } = plans('unsigned', '2026-11-09')
    writeFileSync(join(dir, '2026-11-09-week', 'narrative-lock-mon.md'), lock(''))
    const result = making([PIECE, 'scripts', ...scripts])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/not signed/)
    const check = making([PIECE, 'narrative', join(dir, '2026-11-09-week', 'narrative-lock-mon.md')])
    expect(check.status).toBe(1)
    expect(check.stderr).toMatch(/not signed/)
  })

  it('passes a signed lock: the check prints his words, and the scripts step goes past the gate to the engine', () => {
    const { dir, scripts } = plans('signed', '2026-11-09')
    const path = join(dir, '2026-11-09-week', 'narrative-lock-mon.md')
    writeFileSync(path, lock())
    const check = making([PIECE, 'narrative', path])
    expect(check.status, check.stdout + check.stderr).toBe(0)
    expect(check.stdout).toMatch(/Signed by Krish: "yes, lock it", 2026-11-01/)
    expect(check.stdout).toMatch(/spine: Who pays for the cheap model\?/)
    // No outline file and no "Approved by Krish" line: the signed lock is the approval. The step stops only at the
    // engine read, which this test cannot reach.
    const result = making([PIECE, 'scripts', ...scripts])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/engine key/)
    expect(result.stderr).not.toMatch(/narrative lock|approved outline|Traceback/)
  })

  it('leaves a piece from before 9 Nov to the outline gate alone', () => {
    const { scripts } = plans('backlog', '2026-11-02')
    const result = making([PIECE, 'scripts', ...scripts])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/no approved outline/)
    expect(result.stderr).not.toMatch(/narrative lock/)
  })
})
