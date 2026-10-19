import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The guards on every failure Krish raised (config/failures.json), run on
// every push. Krish, 2026-10-14: "how are you going to ensure all this stuff
// and all the other issues we've had today can never be had again in a 100%
// guaranteed durable way?"

const ROOT = join(__dirname, '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
const py = (args: string[], input?: string) =>
  spawnSync(PY, args, { cwd: ROOT, encoding: 'utf8', input, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })

describe('the engine gates', () => {
  for (const [name, args] of [
    ['every failure in the register still has its guard', ['scripts/check_failures.py']],
    ['the title gate', ['scripts/post-pack/title_check.py', '--self-test']],
    ['the engine stamp', ['scripts/post-pack/engine_stamp.py']],
    ['the week board, its publish check and its thumbnails', ['scripts/post-pack/week_board.py', '--self-test']],
    ['the publish page', ['scripts/post-pack/publish_manager.py', '--self-test']],
    ['the making record, drive-link and thumbnails', ['scripts/post-pack/making.py', '--self-test']],
    ['one spine per piece', ['scripts/post-pack/spine_check.py', '--self-test']],
    ['the style references: cuts, zooms and the ledger', ['scripts/quick-edit/references.py', '--self-test']],
    ['the cover drawer and thumbnails', ['scripts/pages/build.py', '--self-test']],
    ['video transcript clocks, word cues, continuous music and delivery evidence', ['tests/quick_edit_quality_test.py']],
  ] as const) {
    it(name, () => {
      const r = py([...args])
      expect(r.status, r.stdout + r.stderr).toBe(0)
    }, 240_000)
  }

  it('the photo turns over each publishing day: two new photos, then the original (Krish, 2026-10-14)', () => {
    const r = py(['-c', 'import sys; sys.path.insert(0, "scripts/pages"); import brand; print(",".join(brand.portrait_for(d) for d in ["2026-10-14", "2026-10-16", "2026-10-19", "2026-10-21", "2026-10-23"]))'])
    expect(r.stdout.trim(), r.stderr).toBe('krish,krish-pointing,krish-this-guy,krish,krish-pointing')
  })

  it('the publish hook blocks a hand-edited board and lets an engine-built one through', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gate-'))
    const made = py(['-c', [
      'import sys; sys.path.insert(0, "scripts/post-pack"); import engine_stamp',
      'print(engine_stamp.stamp("<title>This Week\'s Publish Board</title>\\n<p>x</p>\\n", "week_board"), end="")',
    ].join('\n')])
    expect(made.status, made.stderr).toBe(0)
    const good = join(dir, 'week-board.html')
    const edited = join(dir, 'week-board-edited.html')
    writeFileSync(good, made.stdout)
    writeFileSync(edited, made.stdout.replace('<p>x</p>', '<p>y</p>'))
    const hook = (file: string) => py(['scripts/hooks/artifact_gate.py'],
      JSON.stringify({ tool_name: 'Artifact', tool_input: { file_path: file, url: 'https://claude.ai/artifact/x' } }))
    expect(hook(good).status).toBe(0)
    const blocked = hook(edited)
    expect(blocked.status).toBe(2)
    expect(blocked.stderr).toContain('hand edit')
  })
})
