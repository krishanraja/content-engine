import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Ruling (Krish, 2026-11-11): one live board, in Control Centre; the old board is a read-only archive.
// Krish, 2026-11-12: "Also, does every part of the engine know that this new publish board is the only place to put
// stuff and how to use it?"
// So every actor that tells a session, a run or Krish where the board is, or how to work on it (the rules, the skills,
// the workflow prompts, the docs, the configs and the scripts that print a link) names the live board in Control
// Centre's Content tab, names content.krishraja.com/board only as the archive, never puts ?ui=next on a live board
// link, never lets an unattended run publish a board page, and lets every run that researches or makes report and
// file on the piece. How to use the board is docs/PUBLISH_BOARDS.md; this test only holds the actors to it.

const ROOT = join(__dirname, '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')

function files(dir: string, keep: (path: string) => boolean, deep = true): string[] {
  const out: string[] = []
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name)
      if (statSync(path).isDirectory()) { if (deep && name !== 'node_modules') walk(path) }
      else if (keep(path)) out.push(relative(ROOT, path).replace(/\\/g, '/'))
    }
  }
  if (existsSync(join(ROOT, dir))) walk(join(ROOT, dir))
  return out.sort()
}

// The records (his rejections, the failure and learning registers, the dated history, handovers and plans) keep what
// was said when it was said; they are not actors. docs/REPO_MAP.md is generated from the code.
const RECORDS = /^(config\/(failures|learnings|rejection-floor)\.json|docs\/REPO_MAP\.md)$/
const ACTORS = [
  'AGENTS.md', 'CLAUDE.md', 'WORKBENCH.md', 'README.md',
  ...files('docs', (p) => p.endsWith('.md'), false),
  ...files('docs/prompts', (p) => p.endsWith('.md')),
  ...files('docs/ve', (p) => p.endsWith('.md'), false),
  ...files('.agents/skills', (p) => /\.(md|json)$/.test(p)),
  ...files('.claude/skills', () => true),
  ...files('.claude/agents', () => true),
  ...files('.github/workflows', (p) => /\.ya?ml$/.test(p)),
  ...files('config', (p) => p.endsWith('.json'), false),
  ...files('scripts', (p) => /\.(py|ts|mts|mjs|sh|ps1)$/.test(p)),
  ...files('apps/control-plane/api/board', (p) => p.endsWith('.ts') && !p.endsWith('_deskPage.ts')),
].filter((path) => !RECORDS.test(path))

const OLD_BOARD = /content\.krishraja\.com\/board/
// A link to the live board that would open the old UI's switch: the rebuilt UI is Control Centre's default since its
// cutover (Ruling, Krish, 2026-11-12), so a live board link carries the week and the day and nothing else.
const UI_NEXT_LINK = /(controlcenter\.krishraja\.com|#\/content)[^\s"'`)\]]*[?&]ui=next/

/** Lines naming the old board with no word within three lines either side saying it is the archive. */
function unmarked(text: string): number[] {
  const lines = text.split('\n')
  const out: number[] = []
  lines.forEach((line, i) => {
    if (!OLD_BOARD.test(line)) return
    const near = lines.slice(Math.max(0, i - 3), i + 4).join(' ')
    if (!/archive|archived/i.test(near)) out.push(i + 1)
  })
  return out
}

// Workflows that run Claude Code, each with the prompt and the tools it is given.
const WORKFLOWS = files('.github/workflows', (p) => /\.ya?ml$/.test(p))
const runsClaude = (text: string) => /anthropics\/claude-code-action/.test(text)
const toolsOf = (text: string) => [...text.matchAll(/--allowedTools\s+"([^"]*)"/g)].flatMap((m) => m[1]!.split(',').map((t) => t.trim()))

describe('one live board: every actor knows where it is and how to use it (Ruling, Krish, 2026-11-11)', () => {
  it('finds the actors it guards, and its checks catch what they are for', () => {
    expect(ACTORS).toEqual(expect.arrayContaining(['AGENTS.md', 'WORKBENCH.md', 'docs/GLOSSARY.md', 'docs/CADENCE.md',
      '.agents/skills/make-piece/SKILL.md', '.claude/skills/plan-week/SKILL.md', '.agents/skills/plan-week/references/offdays.md',
      '.github/workflows/make-piece.yml', '.github/workflows/sunday-ideas.yml', 'config/boards.json', 'config/overnight.json',
      'scripts/post-pack/making.py', 'scripts/hooks/artifact_gate.py', 'apps/control-plane/api/board/_writeBack.ts']))
    // The lines these actors held until 12 Nov 2026 fail each check.
    expect(unmarked('- **Publish board.** The week\'s page at content.krishraja.com/board/<Monday>:')).toEqual([1])
    expect(unmarked('Every link: content.krishraja.com/board/<Monday> is the read-only archive.')).toEqual([])
    expect(UI_NEXT_LINK.test('https://controlcenter.krishraja.com/?ui=next#/content?week=2026-11-16')).toBe(true)
    expect(UI_NEXT_LINK.test('#/content?week=2026-11-16&day=mon&ui=next')).toBe(true)
    expect(UI_NEXT_LINK.test('The address carries no `?ui=next`')).toBe(false)
  })

  it('names content.krishraja.com/board only as the archive', () => {
    const found: string[] = []
    for (const path of ACTORS) {
      if (path === 'config/boards.json') continue // its web block lists the archive's pages; held below
      for (const line of unmarked(read(path))) found.push(`${path}:${line}`)
    }
    expect(found, 'name the old board as the read-only archive, or point at docs/PUBLISH_BOARDS.md').toEqual([])
    const boards = JSON.parse(read('config/boards.json')) as { _about: string; live_board: { url: string }; web: Record<string, string> }
    expect(boards.live_board.url).toBe('https://controlcenter.krishraja.com/#/content')
    expect(boards._about).toMatch(/read-only archive/)
    expect(Object.values(boards.web).every((url) => OLD_BOARD.test(url))).toBe(true)
  })

  it('puts no ?ui=next on a link to the live board', () => {
    const found = ACTORS.filter((path) => UI_NEXT_LINK.test(read(path)))
    expect(found).toEqual([])
  })

  it('lets no unattended run build or publish a board page', () => {
    for (const path of WORKFLOWS) {
      const text = read(path)
      const tools = toolsOf(text)
      // A Claude run may read the board's store and bump its change signal; never publish, download or roll back a page.
      expect(tools.filter((t) => /board_web\.py(?::\*|\s+(publish-web|download|rollback|convert-export))/.test(t)), path).toEqual([])
      if (path === '.github/workflows/board-rebuild.yml') {
        // Kept as the record of how the archive was rebuilt; its first step stops it.
        const first = text.indexOf('- name:', text.indexOf('steps:'))
        expect(text.slice(first, first + 400)).toMatch(/Retired[\s\S]*exit 1/)
        continue
      }
      expect(text, path).not.toMatch(/board_web\.py publish-web|week_board\.py[^\n]*--out\b/)
    }
    // The overnight run on his home computers reports on the piece and bumps the signal; it builds no page.
    const overnight = JSON.stringify((JSON.parse(read('config/overnight.json')) as { board_steps: unknown }).board_steps)
    expect(overnight).not.toMatch(/week_board\.py|publish-web|"download"/)
    expect(overnight).toContain('scripts/post-pack/board_session.py')
    expect(overnight).toContain('"touch"')
  })

  it('lets every run that researches or makes report on the piece and file what it finds there', () => {
    const runs = WORKFLOWS.filter((path) => runsClaude(read(path)))
    const researching = runs.filter((path) => {
      const tools = toolsOf(read(path))
      return tools.includes('WebSearch') && /plan-week|make-piece|produce-video|offdays\.md/.test(read(path))
    })
    expect(researching).toEqual(expect.arrayContaining(['.github/workflows/make-piece.yml', '.github/workflows/sunday-ideas.yml',
      '.github/workflows/saturday-goodnews.yml']))
    for (const path of researching) {
      expect(toolsOf(read(path)), path).toContain('Bash(python3 scripts/post-pack/board_session.py:*)')
      expect(read(path), path).toMatch(/board_session\.py/)
    }
  })

  it('every skill a session starts from names the live board, the ruling and how to report to it', () => {
    for (const skill of ['make-piece', 'plan-week', 'produce-video']) {
      for (const root of ['.agents/skills', '.claude/skills']) {
        const text = read(`${root}/${skill}/SKILL.md`)
        expect(text, `${root}/${skill}`).toContain('one live board, in Control Centre; the old board is a read-only archive')
        expect(text, `${root}/${skill}`).toContain('live_board.py')
        expect(text, `${root}/${skill}`).toContain('board_session.py')
        expect(text, `${root}/${skill}`).toContain('docs/PUBLISH_BOARDS.md')
      }
    }
    // A skill or reference that still records how a page was built carries the routing that retires it.
    for (const path of [...files('.agents/skills', (p) => p.endsWith('.md')), ...files('.claude/skills', () => true)]) {
      const text = read(path)
      if (/board_web\.py publish-web|week_board\.py --draft/.test(text)) {
        expect(text, path).toContain('one live board, in Control Centre')
      }
    }
  })

  it('the rules every agent reads first point at the live board and the authority', () => {
    const agents = read('AGENTS.md')
    expect(agents).toContain('the one live board is Control Centre\'s Content tab')
    expect(agents).toContain('never build or publish a board page')
    expect(agents).not.toMatch(/every week's board lives at content\.krishraja\.com/)
    expect(read('docs/GLOSSARY.md')).toMatch(/Publish board\.\*\* The week in Control Centre's Content tab/)
    // The hook a session meets when it reaches for a Claude artifact sends it to the live board, not to a page build.
    const gate = read('scripts/hooks/artifact_gate.py')
    expect(gate).toContain('The one live board is Control')
    expect(gate).toContain('scripts/post-pack/live_board.py')
    expect(gate).not.toMatch(/Build the board with/)
  })
})
