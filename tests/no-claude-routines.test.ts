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
// Code that could call the triggers API itself: the scripts and the engine's routes.
const CODE = [...files('scripts', (p) => /\.(py|ts|mts|mjs|cjs|js|ps1|sh|cmd|bat)$/.test(p) && !/node_modules/.test(p)),
  ...files('apps/control-plane/api', (p) => /\.(ts|mts|js)$/.test(p))]
// The only secrets a workflow that runs Claude Code may name: his subscription, the board, and GitHub's own token.
const CLAUDE_SECRETS = new Set(['CLAUDE_CODE_OAUTH_TOKEN', 'ENGINE_OPERATOR_TOKEN', 'GITHUB_TOKEN'])
const runsClaude = (text: string) => /anthropics\/claude-code-action|\bclaude\s+(?:-p|--print)\b|npx\s+@anthropic-ai\/claude-code/.test(text)

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

  it('no workflow or skill creates, changes or fires a Claude routine, nor does a script or an engine route', () => {
    expect(CODE).toEqual(expect.arrayContaining(['scripts/engine.py', 'scripts/sunday_ideas.py', 'apps/control-plane/api/week/options.ts']))
    const found: string[] = []
    for (const path of [...WORKFLOWS, ...SKILLS, ...CODE]) {
      const text = read(path)
      for (const pattern of ROUTINE) if (pattern.test(text)) found.push(`${path}: ${pattern}`)
    }
    expect(found).toEqual([])
  })

  it('every workflow that runs Claude Code runs it on CLAUDE_CODE_OAUTH_TOKEN, never an API key', () => {
    const claude = WORKFLOWS.filter((path) => runsClaude(read(path)))
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
      // No other secret reaches it: a key under another name would pass the API_KEY patterns.
      const named = [...text.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]!)
      expect(named.filter((name) => !CLAUDE_SECRETS.has(name)), path).toEqual([])
    }
  })

  it('an unattended Claude step is fenced by permissions: no bare Bash, Write or Edit, no /proc, no kept GitHub credential', () => {
    const claude = WORKFLOWS.filter((path) => runsClaude(read(path)))
    expect(claude.length).toBeGreaterThan(0)
    for (const path of claude) {
      const text = read(path)
      const lists = [...text.matchAll(/--allowedTools\s+"([^"]*)"/g)].map((m) => m[1]!)
      expect(lists.length, `${path}: each Claude Code step names its tools`).toBe((text.match(/uses:\s*anthropics\/claude-code-action@/g) || []).length)
      for (const list of lists) {
        const tools = list.split(',').map((tool) => tool.trim())
        // A bare Bash lets a prompt injection on a fetched page run curl with the step's secrets, or git push.
        for (const bare of ['Bash', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit']) expect(tools, `${path}: bare ${bare}`).not.toContain(bare)
        expect(tools.filter((tool) => /^Bash\((?:curl|wget|sh|bash|env|printenv|git push|git config|gh|npx|npm|node -e|python3? -c)\b/.test(tool)), path).toEqual([])
      }
      expect(text, path).toContain('--disallowedTools "Read(//proc/**)"')
      // Every checkout leaves no token in .git/config for Claude to push with.
      const checkouts = text.match(/uses:\s*actions\/checkout@\S+/g) || []
      expect((text.match(/^\s+persist-credentials:\s*false\s*$/gm) || []).length, path).toBe(checkouts.length)
    }
    // The check catches what it is for: the tool list both runs had until 29 October.
    const old = 'Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,Task,TodoWrite'.split(',')
    expect(['Bash', 'Write', 'Edit'].filter((bare) => old.includes(bare))).toHaveLength(3)
  })

  it('a make run starts CI on its branch, since a push with GitHub\'s own token starts none', () => {
    expect(read('.github/workflows/ci.yml')).toMatch(/^\s+workflow_dispatch:/m)
    const text = read('.github/workflows/make-piece.yml')
    expect(text).toContain('gh workflow run ci.yml --ref "$BRANCH"')
    expect(text).toMatch(/permissions:[\s\S]*actions: write/)
    expect(text).not.toMatch(/gh pr merge/)
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

  it('the weekly failure loop runs on Sunday off the hour, outside the morning rush, deterministic first, and a hand run is a dry run', () => {
    // Krish, 2026-11-04: "yes, build part 1 and the weekly loop". GitHub is the scheduler; it builds no board.
    const text = read('.github/workflows/engine-learning-weekly.yml')
    const crons = [...text.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1]!)
    expect(crons).toHaveLength(1)
    const [minute, hour, , , weekday] = crons[0]!.split(/\s+/)
    expect(weekday).toBe('0')
    expect(Number(minute)).not.toBe(0)
    // 06:00 to 09:00 Pacific is 13:00 to 17:00 UTC across both clock changes.
    expect(Number(hour) < 13 || Number(hour) >= 17).toBe(true)
    expect(text).toMatch(/dry_run:[\s\S]*?default: true/)
    expect(text).toContain(`if [ "$EVENT" = "schedule" ] || [ "$DRY" = "false" ]; then echo "apply=true"`)
    expect(text.indexOf('loop.py weekly deterministic')).toBeLessThan(text.indexOf('anthropics/claude-code-action'))
    expect(text).toMatch(/if: steps\.det\.outputs\.model == 'true'\n\s+uses: anthropics\/claude-code-action/)
    expect(text).toContain('gh workflow run ci.yml -R "$REPO" --ref "$branch"')
    expect(text).not.toMatch(/week_board\.py|board_web\.py|gh pr merge/)
  })

  it('a make runs once per piece, only when started, never on a schedule', () => {
    const text = read('.github/workflows/make-piece.yml')
    expect(text).not.toMatch(/^\s*schedule:/m)
    expect(text).toContain('repository_dispatch:\n    types: [make-piece]')
    expect(text).toMatch(/group: make-piece-\$\{\{ github\.event\.inputs\.piece_id \|\| github\.event\.client_payload\.piece_id \}\}/)
    expect(text).toContain('cancel-in-progress: false')
    expect(text).toContain('every question for Krish goes on the day\'s tab')
  })

  it('exactly three scheduled jobs may touch a publish board, and only two of them are Claude: Sunday ideas and Thursday good news', () => {
    // Exactly two scheduled Claude jobs may build a board (Ruling, Krish, 2026-11-07: "Happy to break the "no Claude
    // schedules" rule for Saturday's good news. We might as well just keep that on an automatic schedule."). The third,
    // the Monday final board, is built by code from the overnight runner, never by a workflow on a timer.
    const scheduled = WORKFLOWS.filter((path) => /^\s*schedule:/m.test(read(path)))
    const boards = scheduled.filter((path) => /week_board\.py|board_web\.py/.test(read(path)))
    expect(boards).toEqual(['.github/workflows/saturday-goodnews.yml', '.github/workflows/sunday-ideas.yml'])
    // Every other scheduled job that runs Claude Code builds no board.
    for (const path of scheduled.filter((p) => runsClaude(read(p)) && !boards.includes(p))) {
      expect(read(path), path).not.toMatch(/week_board\.py|board_web\.py/)
    }
    const agents = read('AGENTS.md')
    expect(agents).toContain('Exactly three scheduled jobs may touch a publish board')
    expect(agents).toContain('.github/workflows/saturday-goodnews.yml')
  })

  it('the Sunday run no longer finds the good news; the Thursday run does, off the hour, outside the morning rush, idempotent, by hand too', () => {
    const sunday = read('.github/workflows/sunday-ideas.yml')
    expect(sunday).not.toMatch(/gn_due|sunday_ideas\.py goodnews|"The Saturday good news"/)
    const text = read('.github/workflows/saturday-goodnews.yml')
    const crons = [...text.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1]!)
    expect(crons).toHaveLength(2)  // the second is only a retry
    for (const cron of crons) {
      const [minute, hour, , , weekday] = cron.split(/\s+/)
      expect(weekday, cron).toBe('4')  // Thursday, UTC
      expect([0, 30], cron).not.toContain(Number(minute))
      // 06:00 to 09:00 Pacific is 13:00 to 17:00 UTC across both clock changes.
      expect(Number(hour) < 13 || Number(hour) >= 17, cron).toBe(true)
    }
    expect(text).toMatch(/workflow_dispatch:\n\s+inputs:\n\s+week:/)
    expect(text).toContain('python3 scripts/saturday_goodnews.py "$@" >> "$GITHUB_OUTPUT"')
    expect(text).toContain('EVENT: ${{ github.event_name }}')
    expect(text).toMatch(/if: steps\.guard\.outputs\.go == 'true'\n\s+uses: anthropics\/claude-code-action/)
    expect(text).toContain('"The Saturday good news"')
    expect(text).not.toMatch(/gh pr merge/)

    const py = (code: string) => spawnSync('python3', ['-c', code], { cwd: ROOT, encoding: 'utf8' })
    const run = py(`
import sys, json, tempfile, datetime as dt
from pathlib import Path
sys.path.insert(0, 'scripts'); sys.path.insert(0, 'scripts/post-pack')
import saturday_goodnews as g
d = dt.date.fromisoformat
print(g.goodnews_monday(d('2026-11-19')), g.goodnews_monday(d('2026-11-21')), g.goodnews_monday(d('2026-11-15')))
with tempfile.TemporaryDirectory() as t:
    folder = Path(t) / '2026-11-16-week'; folder.mkdir()
    opt = {'id': 'goodnews', 'weekly': 'good_news', 'stories_due': '2026-11-19'}
    (folder / 'ideas.json').write_text(json.dumps({'offdays': {'sat': [opt]}}))
    m = d('2026-11-16')
    live = lambda monday: False
    print(g.decide(m, d('2026-11-17'), 'schedule', False, Path(t), live)[0], g.decide(m, d('2026-11-19'), 'schedule', False, Path(t), live)[0])
    print(g.decide(m, d('2026-11-19'), 'schedule', False, Path(t), lambda monday: True)[0])
    print(g.decide(d('2026-11-09'), d('2026-11-12'), 'schedule', False, Path(t), live)[0])
    (folder / 'ideas.json').write_text(json.dumps({'offdays': {'sat': [dict(opt, stories=[{}])]}}))
    print(g.decide(m, d('2026-11-19'), 'schedule', False, Path(t), live)[0], g.decide(m, d('2026-11-19'), 'workflow_dispatch', True, Path(t), live)[0])
`)
    expect(run.stderr).toBe('')
    // Thursday 19 Nov serves the week of 16 Nov; Saturday too; Sunday serves the week that starts the next day.
    // Not due on the Tuesday, due on the Thursday; not again once live; never on a schedule before 19 Nov; force reruns.
    expect(run.stdout.trim().split(/\r?\n/)).toEqual(['2026-11-16 2026-11-16 2026-11-16', 'False True', 'False', 'False', 'False True'])
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
print(s.monday_arg('2026-11-09').isoformat())
for typed in ('20261109', '2026-W46-1', '2026-11-10', ''):
    try:
        s.monday_arg(typed); print('taken', typed)
    except ValueError:
        print('refused')
`)
    expect(run.stderr).toBe('')
    expect(run.stdout.trim().split(/\r?\n/)).toEqual(['2026-11-09', '2026-11-09', '2026-11-09', 'False', 'True', '2026-11-09',
      'refused', 'refused', 'refused', 'refused'])
    // The workflow puts the normalised Monday, never the typed text, into its output.
    expect(read('.github/workflows/sunday-ideas.yml')).toContain('monday=$(python3 scripts/sunday_ideas.py week --date "$WEEK")')
  })
})
