import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Ruling (Krish, 2026-10-29): "FYI, I want zero Claude routines. No Claude schedules of any kind in this
// architecture". Then: "Could you not get Github to trigger Claude subscription to do something and then update the
// content.krishraja.com board?", and "happy with $15 a week".
// So nothing in a workflow or a skill creates or fires a Claude routine (a claude.ai scheduled or fired trigger), and
// Claude Code in a GitHub Actions job runs on his subscription (CLAUDE_CODE_OAUTH_TOKEN, from `claude setup-token`),
// never on an API key.

const ROOT = join(__dirname, '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

function files(dir: string, keep: (path: string) => boolean): string[] {
  const out: string[] = []
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (keep(path)) out.push(relative(ROOT, path).replace(/\\/g, '/'))
    }
  }
  if (existsSync(join(ROOT, dir))) walk(join(ROOT, dir))
  return out.sort()
}

const WORKFLOWS = files('.github/workflows', (p) => /\.ya?ml$/.test(p))
const SKILLS = [...files('.agents/skills', () => true), ...files('.claude/skills', () => true)]

// What creates, changes or fires a Claude routine: the claude.ai triggers API and its tools, and the routine id the
// old "Make it in Claude Code" press fired.
const ROUTINE = [
  /\/v1\/code\/triggers/i,
  /claude\.ai\/api\/[^\s'"]*trigger/i,
  /CLAUDE_MAKE_ROUTINE_ID/,
  /\b(?:create|fire|update|delete)_trigger\b/,
  /\bsend_later\b/,
  /\bRemoteTrigger\b/,
  /\bCron(?:Create|Delete)\b/,
]
// Claude Code on an API key instead of his subscription.
const API_KEY = [/ANTHROPIC_API_KEY/, /\banthropic_api_key\s*:/i, /CLAUDE_API_KEY/]

describe('zero Claude routines (Krish, 2026-10-29)', () => {
  it('finds the workflows and skills it guards, so a clean result means something', () => {
    expect(WORKFLOWS).toEqual(expect.arrayContaining(['.github/workflows/sunday-ideas.yml', '.github/workflows/make-piece.yml']))
    expect(SKILLS).toEqual(expect.arrayContaining(['.agents/skills/plan-week/SKILL.md', '.agents/skills/make-piece/SKILL.md',
      '.agents/skills/plan-week/references/sunday-room.md', '.claude/skills/plan-week/SKILL.md']))
    // The patterns catch what they are for: the two lines the Sunday room's reference held until 29 October.
    const old = 'the routine it fires (`CLAUDE_MAKE_ROUTINE_ID`) ... fire the make routine with `fire_trigger`'
    expect(ROUTINE.filter((p) => p.test(old))).toHaveLength(2)
    expect(ROUTINE.some((p) => p.test('POST https://api.anthropic.com/v1/code/triggers/trig_1/run'))).toBe(true)
  })

  it('no workflow or skill creates, changes or fires a Claude routine', () => {
    const found: string[] = []
    for (const path of [...WORKFLOWS, ...SKILLS]) {
      const text = read(path)
      for (const pattern of ROUTINE) if (pattern.test(text)) found.push(`${path}: ${pattern}`)
    }
    expect(found).toEqual([])
  })

  it('every workflow that runs Claude Code runs it on CLAUDE_CODE_OAUTH_TOKEN, never an API key', () => {
    const claude = WORKFLOWS.filter((path) => /anthropics\/claude-code-action|\bclaude\s+(?:-p|--print)\b|npx\s+@anthropic-ai\/claude-code/.test(read(path)))
    expect(claude).toEqual(expect.arrayContaining(['.github/workflows/sunday-ideas.yml', '.github/workflows/make-piece.yml']))
    for (const path of WORKFLOWS) {
      const text = read(path)
      for (const pattern of API_KEY) expect(text, `${path} names ${pattern}`).not.toMatch(pattern)
    }
    for (const path of claude) {
      const text = read(path)
      const uses = text.match(/uses:\s*anthropics\/claude-code-action@\S+/g) || []
      const tokens = text.match(/claude_code_oauth_token:\s*\$\{\{\s*secrets\.CLAUDE_CODE_OAUTH_TOKEN\s*\}\}/g) || []
      expect(uses.length, path).toBeGreaterThan(0)
      expect(tokens.length, `${path}: each Claude Code step takes the subscription token`).toBe(uses.length)
      // Without the token it fails at once, naming the one setup step, before anything is installed or run.
      expect(text).toContain("One setup step for Krish: run 'claude setup-token'")
      expect(text.indexOf('if [ -z "$CLAUDE_CODE_OAUTH_TOKEN" ]')).toBeLessThan(text.indexOf('anthropics/claude-code-action'))
      // Never permissions bypassed in an unattended run.
      expect(text).not.toMatch(/dangerously-skip-permissions|bypassPermissions/)
    }
  })

  it('the Sunday ideas run is idempotent, fires early on Saturday, and can be started by hand', () => {
    const text = read('.github/workflows/sunday-ideas.yml')
    const crons = [...text.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1]!)
    expect(crons.length).toBeGreaterThan(0)
    for (const cron of crons) {
      const [minute, hour, , , weekday] = cron.split(/\s+/)
      expect(weekday, cron).toBe('6')  // Saturday, UTC
      // Five hours late plus a four-hour run still lands before 06:00 Sunday New York (10:00 UTC in summer time).
      expect(Number(hour) * 60 + Number(minute) + 9 * 60, cron).toBeLessThan((24 + 10) * 60)
    }
    expect(text).toContain('workflow_dispatch:')
    expect(text).toContain('python3 scripts/sunday_ideas.py built')
    expect(text).toMatch(/if: steps\.guard\.outputs\.go == 'true'\n\s+uses: anthropics\/claude-code-action/)
    expect(text).toContain('Stop\n            after step 7.')
  })

  it('a make runs once per piece, only when started, never on a schedule', () => {
    const text = read('.github/workflows/make-piece.yml')
    expect(text).not.toMatch(/^\s*schedule:/m)
    expect(text).toContain('repository_dispatch:\n    types: [make-piece]')
    expect(text).toMatch(/group: make-piece-\$\{\{ github\.event\.inputs\.piece_id \|\| github\.event\.client_payload\.piece_id \}\}/)
    expect(text).toContain('cancel-in-progress: false')
    expect(text).toContain('every question for Krish goes on the day\'s tab')
  })

  it('the guard plans the week eight days after the recording Sunday and reads only a live Ideas tab as built', () => {
    const py = (code: string) => spawnSync('python3', ['-c', code], { cwd: ROOT, encoding: 'utf8' })
    const run = py(`
import sys, datetime as dt
sys.path.insert(0, 'scripts'); sys.path.insert(0, 'scripts/post-pack')
import sunday_ideas as s, week_board as w
for d in ('2026-10-31', '2026-11-01', '2026-10-27'):
    print(s.target_monday(dt.date.fromisoformat(d)).isoformat())
print(s.has_ideas(w.ideas_waiting_panel(w.monday_of('2026-11-09'), False)))
import inspect
print(s.IDEAS_LIVE in inspect.getsource(w.ideas_panel))
`)
    expect(run.stderr).toBe('')
    expect(run.stdout.trim().split('\n')).toEqual(['2026-11-09', '2026-11-09', '2026-11-09', 'False', 'True'])
  })
})
