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
  it('passes Monday 2 November\'s article, written to every gate (bar 6 since "anti AI scanning techniques by 10X")', () => {
    const r = spawnSync(PY, [CHECK, join(ROOT, 'docs', 'plans', '2026-11-02-monday', 'article.md'), '--json'], { encoding: 'utf8', cwd: ROOT })
    const out = JSON.parse(r.stdout)
    expect(out.max_score).toBe(6)
    expect(out.passes).toBe(true)
    expect(r.status).toBe(0)
  })
  it('fails Wednesday 14 October\'s article on the two rulings that came after it, and only those', () => {
    // It passed when it was written. Krish, 2026-10-28: articles speak as "we"; voice profile Ruling 1, 31 Oct 2026:
    // no rhetorical questions in articles.
    const r = spawnSync(PY, [CHECK, join(ROOT, 'docs', 'plans', '2026-10-14-draft-body.md'), '--json'], { encoding: 'utf8', cwd: ROOT })
    const out = JSON.parse(r.stdout)
    const habits = out.findings.map((f: { habit: string }) => f.habit)
    expect(out.passes).toBe(false)
    expect(habits).toContain('the writer as "I"')
    expect(habits).toContain('a rhetorical question')
    expect(out.score - 2 * (out.max_score + 1)).toBeLessThanOrEqual(out.max_score)
  })
})
