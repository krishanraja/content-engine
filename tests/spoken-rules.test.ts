import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// scripts/voice/spoken_rules.py and GET /api/learning/spoken-rules: the read-aloud rules Krish kept, his wording first,
// live for drafting a spoken script, on the engine key.

const ROOT = join(__dirname, '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'

function run(answer: unknown) {
  const code = `import sys, json; sys.path.insert(0, 'scripts/voice'); import spoken_rules as s
got = json.loads(sys.argv[1])
try:
    print(json.dumps({'rules': s.rules(lambda m, p, b: tuple(got) if isinstance(got, list) else got)}))
except RuntimeError as e:
    print(json.dumps({'refused': str(e)}))`
  const r = spawnSync(PY, ['-c', code, JSON.stringify(answer)], { encoding: 'utf8', cwd: ROOT })
  expect(r.status, r.stderr).toBe(0)
  return JSON.parse(r.stdout)
}

describe('the read-aloud rules he kept', () => {
  it('lists each kept rule, marking his own wording', () => {
    const got = run([200, JSON.stringify({ ok: true, rules: [
      { rule: 'Use the everyday word first.', reworded: true, decided_at: '2026-11-02T10:00:00Z' },
      { rule: 'He adds a short spoken aside.', reworded: false, decided_at: '2026-11-01T10:00:00Z' },
      { rule: '  ', reworded: false }] })])
    expect(got.rules).toEqual([
      { rule: 'Use the everyday word first.', decided_at: '2026-11-02T10:00:00Z', reworded: true },
      { rule: 'He adds a short spoken aside.', decided_at: '2026-11-01T10:00:00Z', reworded: false }])
  })
  it('reads an empty list as none kept', () => {
    expect(run([200, JSON.stringify({ ok: true, rules: [] })]).rules).toEqual([])
  })
  it('never reads a refused key or a wrong shape as none kept', () => {
    expect(run([401, JSON.stringify({ ok: false, error: { code: 'unauthorized' } })]).refused).toContain('401')
    expect(run([200, JSON.stringify({ ok: true, proposals: [] })]).refused).toContain('200')
  })
})

describe('the route', () => {
  const text = readFileSync(join(ROOT, 'apps', 'control-plane', 'api', 'learning', 'spoken-rules.ts'), 'utf8')
  it('is read only, on the engine key, and lists only the spoken rules he kept or reworded', () => {
    expect(text).toContain("guardEngine(req, res, ['GET'])")
    expect(text).toContain(".in('status', ['approved', 'corrected'])")
    expect(text).toContain(".like('scope->>key', 'spoken:%')")
    expect(text).not.toMatch(/\.(insert|update|delete|upsert)\(/)
  })
})
