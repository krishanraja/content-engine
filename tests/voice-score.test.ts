import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// scripts/post-pack/voice_score.mjs: the voice profile's measure, read live from ai-harness
// (Krish, 2026-10-31: "yes do it all"). The test stands in a local measure so it never touches
// the network; the real one is ai-harness evals/voice/fingerprint.mjs.

const ROOT = join(__dirname, '..')
const SCORE = join(ROOT, 'scripts', 'post-pack', 'voice_score.mjs')

function fakeHarness(): string {
  const dir = mkdtempSync(join(tmpdir(), 'harness-'))
  const voice = join(dir, 'evals', 'voice')
  spawnSync('mkdir', ['-p', voice])
  writeFileSync(join(voice, 'fingerprint.json'), JSON.stringify({ registers: { long_form: {} } }))
  writeFileSync(join(voice, 'fingerprint.mjs'), `export function score(text, fp, register) {
    if (!fp.registers[register]) throw new Error('no fingerprint for register ' + register)
    return { register, distance: text.includes('Moreover') ? 0.9 : 0.1, parts: { formal_connectives_per_1k: text.includes('Moreover') ? 1 : 0 } }
  }`)
  return dir
}

function run(text: string, args: string[] = [], env: Record<string, string> = {}) {
  const draft = join(mkdtempSync(join(tmpdir(), 'draft-')), 'draft.md')
  writeFileSync(draft, text)
  return spawnSync('node', [SCORE, draft, ...args], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, ...env } })
}

describe('the voice score', () => {
  it('reads the measure from a local ai-harness and names the habit that is far from his', () => {
    const r = run('# Title\n\nMoreover, it is fine.', [], { AI_HARNESS_DIR: fakeHarness() })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('voice distance 0.9')
    expect(r.stdout).toContain('formal connectives')
    expect(r.stdout).toContain('a signal, not a gate')
  })
  it('scores close prose as close, and says where the measure came from', () => {
    const r = run("It's fine. Really.", ['--json'], { AI_HARNESS_DIR: fakeHarness() })
    const out = JSON.parse(r.stdout)
    expect(out.distance).toBe(0.1)
    expect(out.source).toMatch(/^local /)
  })
  it('refuses with exit 2 when the draft cannot be read', () => {
    const r = spawnSync('node', [SCORE, join(tmpdir(), 'no-such-draft.md')], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, AI_HARNESS_DIR: fakeHarness() } })
    expect(r.status).toBe(2)
  })
})
