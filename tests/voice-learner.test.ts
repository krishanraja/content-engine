import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// scripts/voice/learner.py and .github/workflows/voice-learner.yml (Krish, 2026-10-31: "start the weekly voice
// learner too"): what repeats across his read-aloud takes becomes a proposal, never a rule.

const ROOT = join(__dirname, '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'

function learn(takes: object[], minTakes = 3) {
  const r = spawnSync(PY, ['-c', `import sys, json; sys.path.insert(0, 'scripts/voice'); import learner
print(json.dumps(learner.candidates({'takes': {str(i): t for i, t in enumerate(json.loads(sys.argv[1]))}}, int(sys.argv[2]))))`,
    JSON.stringify(takes), String(minTakes)], { encoding: 'utf8', cwd: ROOT })
  expect(r.status, r.stderr).toBe(0)
  return JSON.parse(r.stdout)
}

const take = (name: string, examples: object, counts: Partial<Record<string, number>> = {}) => ({
  name, status: 'matched',
  delta: { words_script: 100, swapped: 1, cut: 0, added: 0, contracted: 0, expanded: 0, ...counts, examples },
})
const swap = { swapped: [{ script: 'firms', said: 'companies' }] }

describe('the weekly voice learner', () => {
  it('proposes a swap he makes in three pieces, with its evidence', () => {
    const got = learn(['Mon 12 Oct', 'Wed 14 Oct', 'Fri 16 Oct'].map(d => take(`${d} - 90-second - A piece.mp4`, swap)))
    const rule = got.candidates.find((c: { kind: string }) => c.kind === 'swap')
    expect(rule.rule).toContain('"companies" where the draft has "firms"')
    expect(rule.takes).toHaveLength(3)
  })
  it('counts the long and short take of one piece once', () => {
    const got = learn([
      take('Mon 12 Oct - 90-second - A piece.mp4', swap), take('Mon 12 Oct - 5-minute - A piece.mp4', swap),
      take('Wed 14 Oct - 90-second - Another.mp4', swap)])
    expect(got.pieces).toBe(2)
    expect(got.candidates).toEqual([])
  })
  it('never makes a rule of filler words, and reads unmatched takes not at all', () => {
    const filler = { added: [{ script: '', said: 'which the' }] }
    const got = learn([...['Mon 12 Oct', 'Wed 14 Oct', 'Fri 16 Oct'].map(d => take(`${d} - 90-second - P.mp4`, filler)),
      { name: 'slice.mp4', status: 'unmatched' }])
    expect(got.candidates).toEqual([])
    expect(got.matched_takes).toBe(3)
  })
  it('proposes contracting more when he contracts in three pieces', () => {
    const got = learn(['Mon 12 Oct', 'Wed 14 Oct', 'Fri 16 Oct'].map(d => take(`${d} - 90-second - P.mp4`, {}, { contracted: 3 })))
    expect(got.candidates.map((c: { rule: string }) => c.rule).join(' ')).toContain('Contract more in spoken scripts')
  })
})

describe('the learner workflow', () => {
  const text = readFileSync(join(ROOT, '.github', 'workflows', 'voice-learner.yml'), 'utf8')
  it('runs no model and writes nothing but its summary', () => {
    expect(text).not.toMatch(/claude-code-action|anthropic-ai|CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY|npx claude|\bclaude -p\b/)
    expect(text).toContain('permissions:\n  contents: read')
    expect(text).not.toMatch(/making\.py|week_board|api\/workbench|report_to_taste/)
  })
  it('keeps the report between runs, never a transcript or a recording', () => {
    expect(text).toContain('rm -f .cache/spoken/*.words.json')
    const cached = [...text.matchAll(/path: ([^\n]+)/g)].map(m => m[1]!.trim())
    expect(cached).toEqual(['~/.cache/huggingface', '.cache/spoken/backfill.json', '.cache/spoken/backfill.json'])
  })
})
