import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

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
    const templates = readdirSync(join(QUICK_EDIT, 'kit'))
    // The name strap is retired (Krish, 2026-10-28: "Remember, no content refers to Krish, ever."); the dress took its place.
    expect(templates.sort()).toEqual(['dress.html', 'endcard.html', 'frame16.html', 'panel.html'])
    for (const file of [join(QUICK_EDIT, 'kit.py'), join(POST_PACK, 'plan_files.py'), ...templates.map(name => join(QUICK_EDIT, 'kit', name))]) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toContain(String.fromCharCode(0x2014))
      expect(text, file).not.toContain(String.fromCharCode(0x2013))
    }
  })
})
