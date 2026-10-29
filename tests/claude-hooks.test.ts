import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { SECRET_PATTERNS } from '../scripts/secret-patterns.js'

// The Claude Code guardrails in .claude/hooks: each one lets the ordinary call through and stops the one it guards.
const repoRoot = join(import.meta.dirname, '..')

function hook(name: string, event: Record<string, unknown>) {
  const result = spawnSync(process.execPath, [join(repoRoot, '.claude', 'hooks', name)], { input: JSON.stringify(event), encoding: 'utf8' })
  expect(result.status).toBe(0)
  const out = result.stdout.trim()
  return out ? (JSON.parse(out) as { hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string } }).hookSpecificOutput : undefined
}

const bash = (command: string) => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } })
const write = (file_path: string, content: string) => ({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path, content } })
const mcp = (tool_name: string) => ({ hook_event_name: 'PreToolUse', tool_name, tool_input: {} })
// Built at run time so this file never holds a whole secret shape itself.
const fakeToken = ['ghp', 'A'.repeat(36)].join('_')

describe('secret-guard', () => {
  it('reads exactly the list check-no-secrets.ts scans with', async () => {
    const lib = await import(pathToFileURL(join(repoRoot, '.claude', 'hooks', 'lib.mjs')).href) as { secretPatterns: () => RegExp[] }
    expect(lib.secretPatterns().map(String)).toEqual(SECRET_PATTERNS.map(String))
  })
  it('lets ordinary commands and writes through', () => {
    expect(hook('secret-guard.mjs', bash('npm run verify'))).toBeUndefined()
    expect(hook('secret-guard.mjs', write('docs/x.md', 'GITHUB_TOKEN is read from the environment'))).toBeUndefined()
    expect(hook('secret-guard.mjs', write('.env.example', 'SUPABASE_URL=\n'))).toBeUndefined()
  })
  it('refuses a secret-shaped string and any .env write', () => {
    expect(hook('secret-guard.mjs', bash(`curl -H "x: ${fakeToken}" https://example.com`))?.permissionDecision).toBe('deny')
    expect(hook('secret-guard.mjs', write('scripts/x.ts', `const t = '${fakeToken}'`))?.permissionDecision).toBe('deny')
    expect(hook('secret-guard.mjs', write('.env', 'A=1\n'))?.permissionDecision).toBe('deny')
    expect(hook('secret-guard.mjs', write('apps/control-plane/.env.local', 'A=1\n'))?.permissionDecision).toBe('deny')
    expect(hook('secret-guard.mjs', bash('echo A=1 >> .env'))?.permissionDecision).toBe('deny')
  })
})

describe('publish-guard', () => {
  it('leaves the standing lanes and reads alone', () => {
    expect(hook('publish-guard.mjs', bash('python3 scripts/post-pack/send.py FOLDER --as "3 Posts/x"'))).toBeUndefined()
    expect(hook('publish-guard.mjs', bash('git push -u origin claude-code-parity'))).toBeUndefined()
    expect(hook('publish-guard.mjs', mcp('mcp__Teleprompter__update_script'))).toBeUndefined()
    expect(hook('publish-guard.mjs', mcp('mcp__Gmail__create_draft'))).toBeUndefined()
  })
  it('puts every send, post, publish and schedule to Krish', () => {
    for (const tool of ['mcp__Gmail__send_message', 'mcp__Slack__slack_schedule_message', 'mcp__Descript__publish_project', 'mcp__n8n__publish_workflow', 'mcp__Riverside__social_upload_create', 'mcp__Vercel__create_deployment']) {
      expect(hook('publish-guard.mjs', mcp(tool))?.permissionDecision).toBe('ask')
    }
    expect(hook('publish-guard.mjs', bash('git push origin main'))?.permissionDecision).toBe('ask')
    expect(hook('publish-guard.mjs', bash('vercel deploy --prod'))?.permissionDecision).toBe('ask')
    expect(hook('publish-guard.mjs', bash('curl -X POST https://api.linkedin.com/v2/ugcPosts -d @post.json'))?.permissionDecision).toBe('ask')
  })
  it('never lets a session move his scripts or change his folders', () => {
    expect(hook('publish-guard.mjs', mcp('mcp__Teleprompter__move_script'))?.permissionDecision).toBe('deny')
    expect(hook('publish-guard.mjs', mcp('mcp__Teleprompter__update_folder'))?.permissionDecision).toBe('deny')
  })
})

describe('taste-guard', () => {
  it('lets ordinary files and registers through', () => {
    expect(hook('taste-guard.mjs', write('docs/STATE.md', 'x'))).toBeUndefined()
    expect(hook('taste-guard.mjs', write('config/learnings.json', '{}'))).toBeUndefined()
    expect(hook('taste-guard.mjs', write('supabase/migrations/20990101000000_x.sql', 'create table x ();'))).toBeUndefined()
  })
  it('refuses the North Star and puts taste rules and mandates to Krish', () => {
    expect(hook('taste-guard.mjs', write('docs/NORTH_STAR.md', 'x'))?.permissionDecision).toBe('deny')
    expect(hook('taste-guard.mjs', write(join(repoRoot, 'docs', 'NORTH_STAR.md'), 'x'))?.permissionDecision).toBe('deny')
    expect(hook('taste-guard.mjs', write('apps/control-plane/api/_houseRules.ts', 'x'))?.permissionDecision).toBe('ask')
    expect(hook('taste-guard.mjs', write('config/title-verdicts.json', '{}'))?.permissionDecision).toBe('ask')
    expect(hook('taste-guard.mjs', write('supabase/migrations/20990101000000_x.sql', "update venture_formats set mandate = 'x';"))?.permissionDecision).toBe('ask')
  })
  it('knows a guarded file in any worktree of this repository, and nothing in another repository', async () => {
    // A linked worktree's .git is a file naming its git folder, whose commondir names the repository's own .git.
    // Built in a temporary folder, so the test never adds a worktree to the repository itself.
    const lib = await import(pathToFileURL(join(repoRoot, '.claude', 'hooks', 'lib.mjs')).href) as { gitCommonDir: (top: string) => string | null }
    const common = lib.gitCommonDir(repoRoot)
    expect(common).toBeTruthy()
    const tmp = mkdtempSync(join(tmpdir(), 'taste-guard-'))
    try {
      mkdirSync(join(tmp, 'gitdir'))
      writeFileSync(join(tmp, 'gitdir', 'commondir'), `${common}\n`)
      const worktree = join(tmp, 'wt', 'i-copy')
      mkdirSync(worktree, { recursive: true })
      writeFileSync(join(worktree, '.git'), `gitdir: ${join(tmp, 'gitdir')}\n`)
      const other = join(tmp, 'other')
      mkdirSync(join(other, '.git'), { recursive: true })
      expect(hook('taste-guard.mjs', write(join(worktree, 'apps', 'control-plane', 'api', '_houseRules.ts'), 'x'))?.permissionDecision).toBe('ask')
      expect(hook('taste-guard.mjs', write(join(worktree, 'config', 'intro-sting.json'), '{}'))?.permissionDecision).toBe('ask')
      expect(hook('taste-guard.mjs', write(join(worktree, 'docs', 'NORTH_STAR.md'), 'x'))?.permissionDecision).toBe('deny')
      expect(hook('taste-guard.mjs', write(join(worktree, 'docs', 'STATE.md'), 'x'))).toBeUndefined()
      expect(hook('taste-guard.mjs', write(join(other, 'apps', 'control-plane', 'api', '_houseRules.ts'), 'x'))).toBeUndefined()
      expect(hook('taste-guard.mjs', write(join(tmp, 'apps', 'control-plane', 'api', '_houseRules.ts'), 'x'))).toBeUndefined()
      expect(hook('secret-guard.mjs', write(join(worktree, '.env'), 'A=1\n'))?.permissionDecision).toBe('deny')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('the hooks are wired', () => {
  it('registers every guard and the stop check in .claude/settings.json', () => {
    const settings = readFileSync(join(repoRoot, '.claude', 'settings.json'), 'utf8')
    for (const name of ['secret-guard.mjs', 'publish-guard.mjs', 'taste-guard.mjs', 'stop-check.mjs', 'cost_gate.py']) expect(settings).toContain(name)
    expect(JSON.parse(settings).model).toBe('opus')
  })
  it('keeps the chat backstop on SessionEnd (W3.3, "Local file, runner posts")', () => {
    const settings = JSON.parse(readFileSync(join(repoRoot, '.claude', 'settings.json'), 'utf8'))
    expect(JSON.stringify(settings.hooks.SessionEnd)).toContain('scripts/taste_backstop.py')
  })
  it('steps aside on a stop the hook itself caused', () => {
    const result = spawnSync(process.execPath, [join(repoRoot, '.claude', 'hooks', 'stop-check.mjs')], { input: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: true }), encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })
})
