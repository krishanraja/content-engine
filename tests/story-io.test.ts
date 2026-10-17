import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fitError, fitLine, fitText, tokens, YES_NO, type FitBox, type Measure } from '../apps/renderer/src/story/fit'

// The story intro and outro (apps/renderer/src/story, rendered by
// scripts/quick-edit/story_io.py). Krish, 2026-10-13, on Wednesday's title
// card: "text that falls off the page and looks ridiculous". The title is
// fitted to its area, shrinking to a floor; below the floor the render fails.

const ROOT = join(__dirname, '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'

// A stand-in for the real face: every character half an em wide.
const half: Measure = (text, size) => text.length * size * 0.5

const box = (over: Partial<FitBox> = {}): FitBox => ({
  maxWidth: 840, maxHeight: 900, lineHeight: 1, maxSize: 168, minSize: 84, maxLines: 5, ...over,
})

describe('fitting a title to its area', () => {
  it('sets a short title at the largest size and keeps every line inside the width', () => {
    const fit = fitText('I SCORED MUSE AGAINST ITS RIVALS', half, box())!
    expect(fit).not.toBeNull()
    expect(fit.size).toBeLessThanOrEqual(168)
    for (const line of fit.lines) expect(half(line, fit.size)).toBeLessThanOrEqual(840)
    expect(fit.lines.length * fit.size).toBeLessThanOrEqual(900)
  })

  it('shrinks a longer title rather than letting it run off the area', () => {
    const short = fitText('I SCORED MUSE', half, box())!
    const long = fitText('I SCORED MUSE AGAINST CHATGPT GEMINI CLAUDE AND SIRI', half, box())!
    expect(long.size).toBeLessThan(short.size)
    for (const line of long.lines) expect(half(line, long.size)).toBeLessThanOrEqual(840)
  })

  it('fails (null) when the words cannot fit at the floor size, never overflows', () => {
    const headline = "I scored Meta's Muse against ChatGPT, Gemini, Claude and Siri. It tied with Siri, for opposite reasons.".toUpperCase()
    expect(fitText(headline, half, box())).toBeNull()
    // One word wider than the area at the floor size cannot be wrapped either.
    expect(fitText('SUPERCALIFRAGILISTICEXPIALIDOCIOUS', half, box({ maxWidth: 600 }))).toBeNull()
  })

  it('keeps the emphasis group on one line and counts its slab', () => {
    const fit = fitText('WHO GETS PAID FOR AI SONGS?', half, box({ keepPadEm: 0.3 }), 'GETS PAID')!
    expect(fit.lines.some((l) => l.includes('GETS PAID'))).toBe(true)
    expect(tokens('WHO GETS PAID FOR AI SONGS?', 'GETS PAID')).toContain('GETS PAID')
  })

  it('avoids a one-word last line when a slightly smaller size sets it without one', () => {
    const fit = fitText('WOULD YOU LET AN AD COMPANY CHOOSE FOR YOU?', half, box({ maxWidth: 700, maxSize: 120, minSize: 56 }))!
    expect(fit.lines[fit.lines.length - 1]).toContain(' ')
  })

  it('fits a one-line label or reports the floor', () => {
    expect(fitLine('Muse, by Meta', half, 600, 92, 48)).toBe(92)
    expect(fitLine('A very long product name indeed', half, 600, 92, 48)).toBeNull()
  })

  it('says what failed in words story_io.py surfaces', () => {
    const e = fitError('video title', 'X', '9x16', { maxWidth: 840, maxHeight: 900 }, 84, 'Shorten video_title.')
    expect(e.message).toMatch(/^STORY_FIT: the video title "X" does not fit its 9x16 area \(840 x 900 px\)/)
  })
})

describe('the outro\'s vote', () => {
  it('shows YES and NO only for a question answered yes or no', () => {
    expect(YES_NO.test('Would you let an ad company choose for you?')).toBe(true)
    expect(YES_NO.test('Do you ever change the model?')).toBe(true)
    expect(YES_NO.test('Which kind of AI do you actually use?')).toBe(false)
    expect(YES_NO.test('What would you hand over first?')).toBe(false)
    expect(YES_NO.test('Do you want to pick your AI, or let the app pick?')).toBe(false)
    expect(YES_NO.test('Would you let your AI decide how hard it thinks?')).toBe(true)
  })
})

describe('the safe areas and faces', () => {
  it('the renderer lays out to the same safe areas story_io.py checks', () => {
    const kit = readFileSync(join(ROOT, 'apps', 'renderer', 'src', 'story', 'standoff-kit.tsx'), 'utf8')
    const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'story-intro-outro.json'), 'utf8'))
    for (const shape of ['16x9', '9x16'] as const) {
      const a = cfg.check.safe_areas[shape]
      expect(kit).toContain(`'${shape}': { x0: ${a.x0}, y0: ${a.y0}, x1: ${a.x1}, y1: ${a.y1} }`)
    }
    for (const face of cfg.check.faces) expect(kit).toContain(`'${face}'`)
  })

  it('names no system or fallback font anywhere in the story clips', () => {
    for (const f of ['standoff-kit.tsx', 'StoryIntroStandoff.tsx', 'StoryOutroStandoff.tsx']) {
      const src = readFileSync(join(ROOT, 'apps', 'renderer', 'src', 'story', f), 'utf8')
      expect(src).not.toMatch(/sans-serif|Helvetica|Arial|Impact|Archivo Black|system-ui/)
    }
  })
})

describe('story_io.py', () => {
  it('--self-test: the title rule, the props of Monday, Wednesday and Friday, and the frame check', () => {
    const r = spawnSync(PY, [join(ROOT, 'scripts', 'quick-edit', 'story_io.py'), '--self-test'], { encoding: 'utf8', cwd: ROOT })
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toMatch(/story_io self-test passed: \d+ checks/)
  }, 120_000)
})
