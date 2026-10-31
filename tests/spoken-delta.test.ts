import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mergeMaking, parseMakingPatch } from '../apps/control-plane/api/_making.js'

// scripts/voice/spoken_delta.py: what Krish changes reading his script aloud (Krish, 2026-10-31:
// "start the script vs recording comparison"), and the making record field that keeps it.

const ROOT = join(__dirname, '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
const DELTA = join(ROOT, 'scripts', 'voice', 'spoken_delta.py')
const NOW = '2026-10-31T16:00:00.000Z'
const SHA = 'a'.repeat(64)

function take(said: string) {
  return { words: said.split(' ').map((w, i) => ({ w, s: i * 0.4, e: i * 0.4 + 0.3 })) }
}

function compare(script: string, said: string) {
  const dir = mkdtempSync(join(tmpdir(), 'delta-'))
  writeFileSync(join(dir, 'script.txt'), script)
  writeFileSync(join(dir, 'take.json'), JSON.stringify(take(said)))
  const r = spawnSync(PY, [DELTA, 'compare', join(dir, 'script.txt'), join(dir, 'take.json'), '--json'], { encoding: 'utf8', cwd: ROOT })
  expect(r.status, r.stderr).toBe(0)
  return JSON.parse(r.stdout)
}

describe('the script against what he said', () => {
  it('counts contractions, swaps, ad-libs and cuts, each once', () => {
    const d = compare('It is not about the model. Do not worry about the price, it is the setting that matters. Ask two things.',
      "Look it's not about the model don't worry about the cost it's the setting that really matters ask two things")
    expect([d.contracted, d.expanded, d.swapped, d.added, d.cut]).toEqual([3, 0, 1, 2, 0])
    expect(d.examples.contracted).toContainEqual({ script: 'do not', said: "don't" })
    expect(d.examples.swapped).toEqual([{ script: 'price', said: 'cost' }])
    expect(d.examples.added.map((e: { said: string }) => e.said)).toEqual(['look', 'really'])
  })
  it('counts a contraction he spelled out, and the words he left out', () => {
    const d = compare("It's simple. Here's the catch, though.", 'it is simple here is the catch')
    expect([d.expanded, d.contracted, d.cut]).toEqual([2, 0, 1])
  })
  it('reads a take said word for word as no change', () => {
    const d = compare('Name each team\'s future seniors.', "name each team's future seniors")
    expect(d.changes).toBe(0)
    expect(d.examples).toEqual({})
  })
  it('refuses an empty take with exit 2', () => {
    const dir = mkdtempSync(join(tmpdir(), 'delta-'))
    writeFileSync(join(dir, 'script.txt'), 'Words.')
    writeFileSync(join(dir, 'take.json'), JSON.stringify({ words: [] }))
    const r = spawnSync(PY, [DELTA, 'compare', join(dir, 'script.txt'), join(dir, 'take.json')], { encoding: 'utf8', cwd: ROOT })
    expect(r.status).toBe(2)
  })
})

describe('spoken_delta on the making record', () => {
  it('takes what the script writes, and merges cut by cut', () => {
    const d = compare('Do not worry about the price.', "don't worry about the cost")
    const long = parseMakingPatch({ spoken_delta: { long: { ...d, script_sha256: SHA, at: NOW } } }, NOW)
    expect(long.problems).toEqual([])
    const first = mergeMaking(null, long.patch, 'Claude Code', NOW)
    const short = parseMakingPatch({ spoken_delta: { short: { ...d, script_sha256: SHA } } }, NOW)
    const next = mergeMaking(first, short.patch, 'Claude Code', NOW)
    expect(Object.keys(next.spoken_delta || {}).sort()).toEqual(['long', 'short'])
    expect(next.spoken_delta?.long?.contracted).toBe(1)
  })
  it('refuses a transcript, an unknown cut, a long example or a missing hash', () => {
    const d = compare('Do not worry.', "don't worry")
    const bad = [
      { spoken_delta: { tall: { ...d, script_sha256: SHA } } },
      { spoken_delta: { long: { ...d } } },
      { spoken_delta: { long: { ...d, script_sha256: SHA, examples: { swapped: [{ script: 'x'.repeat(121), said: 'y' }] } } } },
      { spoken_delta: { long: { ...d, script_sha256: SHA, transcript: 'every word he said', swapped: 'many' } } },
    ]
    for (const body of bad) expect(parseMakingPatch(body, NOW).problems.length).toBeGreaterThan(0)
    // A key the record does not know is dropped, never kept.
    const extra = parseMakingPatch({ spoken_delta: { long: { ...d, script_sha256: SHA, transcript: 'every word' } } }, NOW)
    expect(JSON.stringify(extra.patch)).not.toContain('every word')
  })
})

describe('the backfill pairs takes with their dated scripts', () => {
  function py(code: string) {
    const r = spawnSync(PY, ['-c', `import sys, json; sys.path.insert(0, 'scripts/voice'); import spoken_delta as s\n${code}`], { encoding: 'utf8', cwd: ROOT })
    expect(r.status, r.stderr).toBe(0)
    return JSON.parse(r.stdout)
  }
  it('reads the day and the length from the Inbox name, and never guesses one it cannot read', () => {
    const got = py(`print(json.dumps([[str(p.name) if p else None, c] for p, c in (
      s.take_plan("Mon 19 Oct - 90-second - Why AI prices keep changing.mp4"),
      s.take_plan("Wed 21 Oct - 5-minute - Muse vs Grok.mp4"),
      s.take_plan("Fri 16 Oct - 3-minute - Soon you won't pick your AI.mp4"),
      s.take_plan("slice_75A3360A.mp4"))]))`)
    expect(got).toEqual([
      ['2026-10-19-draft-script-90s.md', 'short'],
      ['2026-10-21-draft-script.md', 'long'],
      [null, 'no_script_on_file'],
      [null, 'not_named_by_day'],
    ])
  })
  it('adds up matched takes only, by cut', () => {
    const got = py(`d = lambda n: {'words_script': 100, 'swapped': n, 'cut': 0, 'added': 0, 'contracted': n, 'expanded': 0, 'changes': 2 * n, 'minutes': 1.0}
print(json.dumps(s.summarise([{'status': 'matched', 'cut': 'long', 'delta': d(5)}, {'status': 'matched', 'cut': 'short', 'delta': d(1)},
                              {'status': 'unmatched', 'cut': None}])))`)
    expect([got.matched, got.unmatched, got.all.changes, got.long.changes_per_minute, got.short.contracted]).toEqual([2, 1, 12, 10, 1])
  })
})
