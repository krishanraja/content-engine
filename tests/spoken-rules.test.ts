import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// scripts/voice/spoken_rules.py: the read-aloud rules Krish kept, his wording first, live for drafting a spoken script.

const ROOT = join(__dirname, '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'

function rules(answer: object) {
  const code = `import sys, json; sys.path.insert(0, 'scripts/voice'); import spoken_rules as s
print(json.dumps(s.rules(lambda m, p, b: json.loads(sys.argv[1]))))`
  const r = spawnSync(PY, ['-c', code, JSON.stringify(answer)], { encoding: 'utf8', cwd: ROOT })
  expect(r.status, r.stderr).toBe(0)
  return JSON.parse(r.stdout)
}

describe('the read-aloud rules he kept', () => {
  it('lists each kept rule, his rewording winning, and marks which are his words', () => {
    const got = rules({ ok: true, rules: [
      { rule: 'Use the everyday word first.', decision_note: 'Use the everyday word first.', decided_at: '2026-11-02T10:00:00Z' },
      { rule: 'He adds a short spoken aside.', decision_note: null, decided_at: '2026-11-01T10:00:00Z' },
      { rule: '  ', decision_note: null }] })
    expect(got).toEqual([
      { rule: 'Use the everyday word first.', decided_at: '2026-11-02T10:00:00Z', reworded: true },
      { rule: 'He adds a short spoken aside.', decided_at: '2026-11-01T10:00:00Z', reworded: false }])
  })
  it('reads nothing kept as none, never as an error', () => {
    expect(rules({ ok: true, proposals: [] })).toEqual([])
  })
})
