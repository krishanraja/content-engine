// SUITE: ideas-history — do the ideas board's checks catch what Krish refused, without blocking anything he picked?
//
// The ideas quality plan, item 11: "Using only what was known before each board, every check must pass three tests.
// (a) It catches the 16 Nov Infosys main option: a warning and never rank 1 before P6, and a block after. (b) It fails
// the 16 Nov Infosys off-day return for coming back unchanged. (c) It blocks none of your 11 main picks, none of your 9
// off-day approvals, and no option that answers your own ask."
//
// No model and no spend: each arm replays the checks (scripts/post-pack/idea_checks.py, the same code the Sunday run's
// gate runs) on one past board of the fixture, cases/ideas-history.json, which holds ids, names and short hashes only.
//
//   checks            the checks as they ship: P6 waits for his yes, so a soft refusal warns and never leads a day
//   checks-p6         as if he had approved P6: the same soft refusal blocks
//   no-refused-check  the refused-subject check switched off: the control, which must fail the 16 Nov board
//
//   npx tsx scripts/eval/run.ts ideas-history --fixture scripts/eval/cases/ideas-history.json --repeats 1
//
// A new check joins only once every board scores 1 in `checks` and `checks-p6`. tests/ideas_history_test.py runs the
// same replay on every pull request.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GenResult, Suite, Variant } from '../_types.ts'

interface Case { id: string; week: string }

const ROOT = resolve(import.meta.dirname, '../../../../..')
const DEFAULT = resolve(import.meta.dirname, '../cases/ideas-history.json')

function replay(week: string, fixture: string, args: string[]): GenResult {
  const t0 = Date.now()
  const output = execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['scripts/post-pack/ideas_history.py', 'replay', '--fixture', fixture, '--week', week, ...args],
    { cwd: ROOT, encoding: 'utf8' })
  return { output, ms: Date.now() - t0, usd: 0 }
}

let fixturePath = DEFAULT
const arm = (name: string, note: string, args: string[]): Variant<Case> => ({ name, note, run: async c => replay(c.week, fixturePath, args) })

export const suite: Suite<Case> & { requires: string[] } = {
  name: 'ideas-history',
  describe: 'The ideas board checks replayed on his past boards: catch what he refused, block none of his picks, approvals or asks.',
  scale: '0-1 (1: the board meets the history test)',
  requires: [],
  async loadCases({ fixture, limit }) {
    fixturePath = fixture ? resolve(fixture) : DEFAULT
    const data = JSON.parse(readFileSync(fixturePath, 'utf8')) as { boards: Array<{ week: string }> }
    return data.boards.slice(0, limit || undefined).map(b => ({ id: b.week, week: b.week }))
  },
  groupOf: c => (c.week === '2026-11-16' ? 'the Infosys board' : 'earlier boards'),
  variants: [
    arm('checks', 'as shipped: P6 waits for his yes', []),
    arm('checks-p6', 'as if he had approved P6', ['--p6']),
    arm('no-refused-check', 'control: the refused-subject check switched off', ['--mutate', 'refused']),
  ],
  async judge(_c, output) {
    const got = JSON.parse(output) as { ok: boolean; misses: string[] }
    return { score: got.ok ? 1 : 0, detail: { misses: got.misses } }
  },
}
