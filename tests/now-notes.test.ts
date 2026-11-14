import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkNotes } from '../scripts/check-now-notes'

// The closeout check and the fold are one rule (AGENTS.md, "Commit and closeout"): check:now-notes runs the fold's own
// parser and fold over every note, so a note that passes it always folds. On 11 and 12 Nov three notes whose North Star
// line began "- " (the form AGENTS.md then showed) merged on green CI and never folded.

const NOW = [
  '---', 'as_of: 2026-11-10', '---', '# A repository: where it is right now', '',
  '## Where it is right now (as of 2026-11-10)', '', '- Something true. (2026-11-10)', '',
  '## What changed recently', '', '- 2026-11-10 something.', '',
  '## What is next and what is waiting on Krish', '', '- Next (2026-11-10): the old next step.',
  '- North Star check (2026-11-10): holds.', '',
].join('\n')

const NOTE = (check: string) => [
  'Status: the closeout check and the fold are one rule now, in one place.',
  'Next: Krish reads the folded line in NOW.md.',
  check,
].join('\n') + '\n'

let dirs: string[] = []
function repo(notes: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'now-notes-'))
  dirs.push(root)
  writeFileSync(join(root, 'NOW.md'), NOW)
  mkdirSync(join(root, 'now-notes'))
  for (const [name, text] of Object.entries(notes)) writeFileSync(join(root, 'now-notes', name), text)
  return root
}
afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs = [] })

describe('check:now-notes', () => {
  it('fails a note whose North Star line starts with a dash, the form that never folds', async () => {
    const root = repo({ '2026-11-12-dashed.md': NOTE('- North Star check (2026-11-12): holds.') })
    const result = await checkNotes(root)
    expect(result.folded).toEqual([])
    expect(result.problems.join('\n')).toMatch(/now-notes\/2026-11-12-dashed\.md: its North Star line starts with a dash/)
    expect(result.problems.join('\n')).toMatch(/needs one line "North Star check \(2026-11-12\): holds\."/)
  })

  it('passes and folds the same note written with no dash, through the fold\'s own code', async () => {
    const root = repo({ '2026-11-12-plain.md': NOTE('North Star check (2026-11-12): holds.') })
    const result = await checkNotes(root)
    expect(result.problems).toEqual([])
    expect(result.folded).toEqual(['now-notes/2026-11-12-plain.md'])
    // The check writes nothing: the fold on main does.
    expect(readFileSync(join(root, 'NOW.md'), 'utf8')).toBe(NOW)
  })

  it('fails the whole set when one note of several would not fold, naming that note', async () => {
    const root = repo({
      '2026-11-11-good.md': NOTE('North Star check (2026-11-11): holds.'),
      '2026-11-12-bad.md': NOTE('* North Star check (2026-11-12): holds.'),
    })
    const result = await checkNotes(root)
    expect(result.folded).toEqual(['now-notes/2026-11-11-good.md'])
    expect(result.problems.some((p) => p.startsWith('now-notes/2026-11-12-bad.md'))).toBe(true)
  })

  it('passes with no notes waiting', async () => {
    expect(await checkNotes(repo({}))).toEqual({ notes: [], folded: [], problems: [] })
  })

  it('passes every note on this branch, so none is left unfolded on main', async () => {
    expect((await checkNotes()).problems).toEqual([])
  })
})
