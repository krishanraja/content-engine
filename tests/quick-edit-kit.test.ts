import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// scripts/quick-edit/kit.py: the shared per-piece kit, so a new piece renders
// through make.py without a graphics script of its own (the end cards, the
// wide frame, the strap, every picture as a panel and a starter config whose
// cue words make.py finds in the script).

const ROOT = join(__dirname, '..')
const QUICK_EDIT = join(ROOT, 'scripts', 'quick-edit')
const PY = process.platform === 'win32' ? 'python' : 'python3'

describe('the shared video kit', () => {
  it('kit.py --self-test: pictures to paragraphs, cue words make.py finds, columns cut at gaps, the end card clip', () => {
    const result = spawnSync(PY, [join(QUICK_EDIT, 'kit.py'), '--self-test'], { encoding: 'utf8', cwd: ROOT })
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/kit self-test passed: \d+ checks/)
  }, 180_000)

  it('its folder holds HTML templates only, and nothing it commits has an em dash', () => {
    const templates = readdirSync(join(QUICK_EDIT, 'kit'))
    expect(templates.sort()).toEqual(['endcard.html', 'frame16.html', 'panel.html', 'strap.html'])
    for (const file of [join(QUICK_EDIT, 'kit.py'), ...templates.map(name => join(QUICK_EDIT, 'kit', name))]) {
      expect(readFileSync(file, 'utf8'), file).not.toContain(String.fromCharCode(0x2014))
    }
  })
})
