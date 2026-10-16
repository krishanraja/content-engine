import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// scripts/post-pack/voice_check.py: house rule SOUNDS_LIKE_KRISH. Krish,
// 2026-10-13, on articles a detector called 93% AI generated: "build the
// sounds like Krish pass now".

const ROOT = join(__dirname, '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
const CHECK = join(ROOT, 'scripts', 'post-pack', 'voice_check.py')

describe('the sounds-like-Krish check', () => {
  it('passes its own self-test: machine prose fails, his kind of prose passes', () => {
    const r = spawnSync(PY, [CHECK, '--self-test'], { encoding: 'utf8', cwd: ROOT })
    expect(r.stdout).toContain('voice check self-test passed')
    expect(r.status).toBe(0)
  })
  it('fails Monday 12 October\'s article, which a detector called 93% AI', () => {
    const r = spawnSync(PY, [CHECK, join(ROOT, 'docs', 'plans', '2026-10-12-draft-body.md'), '--json'], { encoding: 'utf8', cwd: ROOT })
    const out = JSON.parse(r.stdout)
    expect(out.passes).toBe(false)
    expect(out.findings.map((f: { habit: string }) => f.habit)).toContain('every paragraph opens the same way')
    expect(r.status).toBe(1)
  })
  it('passes Wednesday 14 October\'s article, written to both gates (bar 6 since "anti AI scanning techniques by 10X")', () => {
    const r = spawnSync(PY, [CHECK, join(ROOT, 'docs', 'plans', '2026-10-14-draft-body.md'), '--json'], { encoding: 'utf8', cwd: ROOT })
    const out = JSON.parse(r.stdout)
    expect(out.max_score).toBe(6)
    expect(out.passes).toBe(true)
    expect(r.status).toBe(0)
  })
})
