import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// scripts/quick-edit: the opening, the licensed music bed and the final
// loudness pass. Krish, 2026-10-12: "use it correctly (high volume during the
// intro, low whilst I am talking, higher during the outro)"; 2026-10-28: "Yes
// I think music should be audible throughout but just lower."; and 2026-10-29,
// picking "The hook is the intro" over the 12 October sting: "Let's go with
// number one for now." (house rule HOOK_IS_THE_INTRO).

const ROOT = join(__dirname, '..')
const QUICK_EDIT = join(ROOT, 'scripts', 'quick-edit')
const PY = process.platform === 'win32' ? 'python' : 'python3'
// The tests use the committed ledger and their own stand-ins, never a
// machine's music folder.
const env: NodeJS.ProcessEnv = { ...process.env }
delete env.MINDMAKE_MUSIC_ROOT
delete env.MINDMAKE_MUSIC_LEDGER

function run(script: string, args: string[] = []) {
  return spawnSync(PY, [join(QUICK_EDIT, script), ...args], { encoding: 'utf8', env, cwd: ROOT })
}

describe('quick-edit checks itself', () => {
  it('make.py --self-test: the cuts, the clock, the previews, the opening, the dress and no name on screen', () => {
    const result = run('make.py', ['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/quick-edit self-test passed: \d+ checks/)
  }, 120_000)

  it('music.py --self-test: the ledger, the pick, a real bed measured against the levels, and a bed that never runs out', () => {
    const result = run('music.py', ['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/music self-test passed: \d+ checks/)
  }, 120_000)

  it('intro.py --self-test: a synthetic sting through the finishing path, the approval gate, and the sting retired', () => {
    const result = run('intro.py', ['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/intro self-test passed: \d+ checks/)
  }, 120_000)

  it('mix_test.py: real renders from synthetic media meet the loudness and level targets', () => {
    const result = run('mix_test.py')
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/mix test passed: \d+ checks/)
  }, 1_200_000)
})

describe('the music and the opening wait for Krish', () => {
  it('the committed ledger has the agreed shape and proposed levels, and no audio', () => {
    const ledger = JSON.parse(readFileSync(join(ROOT, 'config', 'music-library.json'), 'utf8'))
    expect(ledger.schema_version).toBe(1)
    expect(ledger.root_env).toBe('MINDMAKE_MUSIC_ROOT')
    const approval = ['approval_words', 'approved_by', 'approved_on']
    expect(Object.keys(ledger.levels).filter((k) => !approval.includes(k)).sort()).toEqual(
      ['bed_lufs', 'final_integrated_lufs', 'intro_lufs', 'max_true_peak_dbtp', 'outro_lufs', 'ramp_down_s', 'ramp_up_s', 'status', 'tolerance_lu'].sort())
    if (ledger.levels.status === 'approved') {
      expect(String(ledger.levels.approved_by)).toMatch(/^Krish/)
      expect(String(ledger.levels.approval_words).trim()).not.toBe('')
    }
    for (const track of ledger.tracks) {
      if (track.status === 'approved') {
        expect(String(track.approved_by)).toMatch(/^Krish/)
        expect(String(track.approval_words).trim()).not.toBe('')
      }
    }
  })

  it('the music folder is the same in the ledger, the Studio config and the example environment', () => {
    const ledger = JSON.parse(readFileSync(join(ROOT, 'config', 'music-library.json'), 'utf8'))
    const studio = JSON.parse(readFileSync(join(ROOT, 'config', 'studio.json'), 'utf8'))
    const environment = readFileSync(join(ROOT, '.env.example'), 'utf8')
    expect(studio.runtime.music_root).toBe(ledger.root_default_windows)
    expect(environment).toContain(`MINDMAKE_MUSIC_ROOT=${ledger.root_default_windows}`)
    // A folder of the makeyourmindup library, never inside Video Engine,
    // whose Inbox the recordings lane reads.
    expect(ledger.root_default_windows.startsWith(`${studio.runtime.library_root}\\`)).toBe(true)
    expect(ledger.root_default_windows.startsWith(`${studio.runtime.drive_root}\\`)).toBe(false)
  })

  it('the sting is 1 to 2 seconds, one composition per shape, rendered per series, only used once approved, and retired only on his words', () => {
    const sting = JSON.parse(readFileSync(join(ROOT, 'config', 'intro-sting.json'), 'utf8'))
    expect(sting.schema_version).toBe(1)
    expect(['candidate', 'approved', 'retired']).toContain(sting.status)
    // Krish, 2026-10-29: "The hook is the intro" (house rule HOOK_IS_THE_INTRO); no cut opens on a sting.
    if (sting.status === 'retired') {
      expect(sting.retired.by).toBe('Krish')
      expect(sting.retired.rule).toBe('HOOK_IS_THE_INTRO')
      expect(String(sting.retired.words)).toMatch(/^I'd pick number one here/)
    }
    expect(sting.seconds).toBeGreaterThanOrEqual(1)
    expect(sting.seconds).toBeLessThanOrEqual(2)
    expect(Object.keys(sting.compositions).sort()).toEqual(['16x9', '9x16'])
    // Each series renders the sting in its own colour; a piece with none
    // gets follow_the_money's.
    expect([...sting.series].sort()).toEqual(['follow_the_money', 'mind_the_gap', 'under_the_hood'])
    // His latest word on a design is kept, a rejection included, in his words.
    if (sting.last_decision) {
      expect(String(sting.last_decision.by)).toMatch(/^Krish/)
      expect(['approved', 'rejected']).toContain(sting.last_decision.decision)
      expect(String(sting.last_decision.words).trim()).not.toBe('')
    }
    if (sting.status === 'approved') {
      // An approval is bound to the exact source of the previews he saw:
      // no 64-hex hash, no approval.
      expect(String(sting.approved_by)).toMatch(/^Krish/)
      expect(sting.source_sha256).toMatch(/^[0-9a-f]{64}$/)
      if (sting.last_decision) expect(sting.last_decision.decision).toBe('approved')
    } else {
      expect(sting.source_sha256).toBeNull()
    }
  })

  it('the renderer\'s source is LF on every checkout, so the sting\'s approval hash is the same on Windows', () => {
    const attributes = readFileSync(join(ROOT, '.gitattributes'), 'utf8')
    // text=auto: git's own check leaves a binary of a type not listed alone (a .lottie, a .riv).
    expect(attributes).toMatch(/^apps\/renderer\/\*\* text=auto eol=lf$/m)
    // Pictures and fonts there stay binary: never turned into LF.
    for (const ending of ['png', 'jpg', 'woff2', 'ttf', 'mp4', 'wav', 'lottie', 'riv']) {
      expect(attributes).toMatch(new RegExp(`^apps/renderer/\\*\\*/\\*\\.${ending} binary$`, 'm'))
    }
  })
})

describe('archive.py checks itself', () => {
  it('archive.py --self-test: the naming rule, and the archive folder found as the music folder is', () => {
    const result = run('archive.py', ['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/archive naming self-test passed: \d+ checks/)
  })
})
