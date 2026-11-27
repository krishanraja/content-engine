import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { V5_OUTRO, V5_OUTRO_TRACKS, V5_OUTRO_WORDS } from '../apps/renderer/src/engine/chrome/V5Outro'

// scripts/quick-edit/kit.py: the shared per-piece kit, so a new piece renders
// through make.py without a graphics script of its own (the end cards, the
// wide frame, the tall cut's dress, every picture as a panel and a starter config whose
// cue words make.py finds in the script). scripts/post-pack/plan_files.py:
// where a piece's scripts and pictures are on whichever machine runs it, so
// kit.py finds them where every tool finds them.

const ROOT = join(__dirname, '..')
const QUICK_EDIT = join(ROOT, 'scripts', 'quick-edit')
const POST_PACK = join(ROOT, 'scripts', 'post-pack')
const PY = process.platform === 'win32' ? 'python' : 'python3'
// The library on the machine running the tests is never read: a sent pack
// there would change where a picture is found.
const env: NodeJS.ProcessEnv = { ...process.env }
delete env.MINDMAKE_LIBRARY_ROOT

function run(script: string, args: string[]) {
  return spawnSync(PY, [script, ...args], { encoding: 'utf8', cwd: ROOT, env })
}

const scratch = mkdtempSync(join(tmpdir(), 'kit-test-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

// The two pieces the review found kit.py could not make (2026-10-12): their
// scripts are in the repository only as the dated drafts beside the plan.
const MONDAY = { plan: '2026-10-12-monday', date: '2026-10-12' }
const PIECES = [MONDAY, { plan: '2026-10-09-friday', date: '2026-10-09' }]

type Found = { kind: string; cut: string | null; file: string; path: string | null; why: string | null; tried: string[] }

describe('the shared video kit', () => {
  it('kit.py --self-test: pictures to paragraphs, cue words make.py finds, columns cut at gaps, where files are found, missing pictures', () => {
    const result = run(join(QUICK_EDIT, 'kit.py'), ['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/kit self-test passed: \d+ checks/)
  }, 180_000)

  it('plan_files.py --self-test: the places in order, packed names as build.py gives them, clashes refused', () => {
    const result = run(join(POST_PACK, 'plan_files.py'), ['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/plan_files self-test passed: \d+ checks/)
  }, 60_000)

  for (const piece of PIECES) {
    const post = join(ROOT, 'docs', 'plans', piece.plan, 'post.json')
    it.runIf(existsSync(post))(`${piece.plan}: both cuts get their scripts with no --files, from the drafts the repository keeps`, () => {
      const result = run(join(POST_PACK, 'plan_files.py'), [post, '--json'])
      expect([0, 1], result.stdout + result.stderr).toContain(result.status)
      const files: Found[] = JSON.parse(result.stdout).files
      const scripts = Object.fromEntries(files.filter(f => f.kind === 'video-script').map(f => [f.cut, [f.path, f.why]]))
      expect(scripts).toEqual({
        long: [`docs/plans/${piece.date}-draft-script.md`, 'the draft beside the plan'],
        short: [`docs/plans/${piece.date}-draft-script-90s.md`, 'the draft beside the plan'],
      })
      // Every picture is found, or named with every place looked in.
      for (const picture of files.filter(f => f.kind === 'image')) {
        expect(picture.why !== null || picture.tried.length > 0, picture.file).toBe(true)
      }
    })
  }

  it('kit.py takes only Krish\'s own words to go without a picture, and stops (exit 2) before writing anything', () => {
    const out = join(scratch, 'words')
    const result = run(join(QUICK_EDIT, 'kit.py'), [join(ROOT, 'docs', 'plans', MONDAY.plan, 'post.json'), '--cut', 'long',
      '--recording', join(scratch, 'take.mov'), '--out', out, '--allow-missing', 'fine, skip them'])
    expect(result.status, result.stdout + result.stderr).toBe(2)
    expect(result.stderr).toMatch(/--allow-missing takes Krish's own words/)
    expect(existsSync(out)).toBe(false)
  })

  it('a script that is nowhere stops kit.py (exit 2), naming the draft and every other place it looked', () => {
    const plan = join(scratch, 'docs', 'plans', '2026-10-12-monday')
    mkdirSync(plan, { recursive: true })
    writeFileSync(join(plan, 'post.json'), JSON.stringify({
      date: '2026-10-12', subchannel: 'follow.the.money', subject: 'Nowhere', files: [{ kind: 'video-script', file: 'script.md', cut: 'long' }],
    }))
    const out = join(scratch, 'nowhere')
    const result = run(join(QUICK_EDIT, 'kit.py'), [join(plan, 'post.json'), '--cut', 'long', '--recording', join(scratch, 'take.mov'), '--out', out])
    expect(result.status, result.stdout + result.stderr).toBe(2)
    expect(result.stderr).toMatch(/Looked in/)
    expect(result.stderr).toContain('2026-10-12-draft-script.md (the draft beside the plan)')
    expect(existsSync(out)).toBe(false)
  })

  it('its folder holds HTML templates only, and nothing it commits has an em or en dash', () => {
    const files = [join(QUICK_EDIT, 'kit.py'), join(POST_PACK, 'plan_files.py')]
    for (const [folder, expected] of Object.entries({
      kit: ['endcard.html', 'frame16.html', 'panel.html'],
      'kit-v5': ['v5-close.html', 'v5-frame.html', 'v5-outro.html', 'v5-panel.html'],
    })) {
      const templates = readdirSync(join(QUICK_EDIT, folder)).sort()
      expect(templates).toEqual(expected)
      files.push(...templates.map(name => join(QUICK_EDIT, folder, name)))
    }
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toContain(String.fromCharCode(0x2014))
      expect(text, file).not.toContain(String.fromCharCode(0x2013))
    }
  })

  // From 26 Nov the kit's close is the v5 outro card ve draws (Ruling, Krish, 2026-11-26: "1 agreed"): the Library's
  // video-vertical-outro and video-wide-outro. kit.py keeps its own copy of V5Outro.tsx's numbers to film the card in a
  // browser; this holds the two to one another, so the quick-edit close and ve's close never drift apart.
  it("kit.py's outro is V5Outro.tsx's: the same template, mark, words, bars, motion and grain", () => {
    const result = spawnSync(PY, ['-c', [
      'import json, sys', `sys.path.insert(0, ${JSON.stringify(QUICK_EDIT)})`, 'import kit',
      'print(json.dumps({"outro": kit.OUTRO, "tracks": kit.OUTRO_TRACKS, "words": kit.OUTRO_WORDS, "seconds": kit.ENDCARD_SECONDS_BY_SHAPE}))',
    ].join('\n')], { encoding: 'utf8', cwd: ROOT, env })
    expect(result.status, result.stderr).toBe(0)
    const kit = JSON.parse(result.stdout) as {
      outro: Record<string, { item: string; frames: number; hold_from: number; mark: object; invitation: object
        site: object; bars: { top: number; height: number; edges: number[] }; enter: object }>
      tracks: { drop: number[][]; pulse: number[]; pulse_frames: number } & Record<string, number[]>
      words: Record<string, string>; seconds: Record<string, number> }
    for (const [aspect, shape] of [['9:16', '9x16'], ['16:9', '16x9']] as const) {
      const ve = V5_OUTRO[aspect]
      const mine = kit.outro[shape]!
      expect([mine.item, mine.frames, mine.hold_from]).toEqual([ve.item, ve.frames, ve.holdFrom])
      expect([mine.mark, mine.invitation, mine.site, mine.enter]).toEqual([ve.mark, ve.invitation, ve.site, ve.enter])
      expect({ ...mine.bars, edges: [...mine.bars.edges] }).toEqual({ ...ve.bars, edges: [...ve.bars.edges] })
      // The close runs as long in the kit as in ve (closeFrames at 30 fps).
      expect(kit.seconds[shape]! * 30).toBe(ve.closeFrames)
    }
    expect(kit.tracks.drop.map(([start, duration]) => ({ start, duration }))).toEqual(V5_OUTRO_TRACKS.drop)
    expect([kit.tracks.pulse, kit.tracks.pulse_frames]).toEqual([V5_OUTRO_TRACKS.pulse, V5_OUTRO_TRACKS.pulseFrames])
    for (const name of ['make', 'your', 'disc', 'lock', 'mind', 'up'] as const)
      expect({ start: kit.tracks[name]![0], duration: kit.tracks[name]![1] }).toEqual(V5_OUTRO_TRACKS[name])
    expect(kit.words).toEqual(V5_OUTRO_WORDS)
    // The Library's grain tile, the same PNG in the template as in V5Outro.tsx.
    const grain = (text: string) => text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/)![0]
    expect(grain(readFileSync(join(QUICK_EDIT, 'kit-v5', 'v5-outro.html'), 'utf8')))
      .toBe(grain(readFileSync(join(ROOT, 'apps', 'renderer', 'src', 'engine', 'chrome', 'V5Outro.tsx'), 'utf8')))
  })
})
