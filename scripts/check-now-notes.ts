// check:now-notes: every closeout note in now-notes/ folds into NOW.md, judged by the fold's own code.
//
// A pull request closes out through a note (AGENTS.md, "Commit and closeout"), and once it merges auto-merge.yml folds
// the note into NOW.md with the harness's `.claude/hooks/harness-closeout.mjs --fold`. The harness's closeout job
// (harness-repository-context.yml) reads notes with the same code, but it is not a check auto-merge waits on. So on 11
// and 12 Nov three notes whose North Star line began "- " merged on green CI, never folded, and every merge after them
// reported a failed fold step, while NOW.md went without them.
//
// This guard is part of `npm run verify`, so CI (verify:quick) runs it before every merge. It imports the very
// `parseNote` and `foldNotes` the fold runs and folds every note in the tree into the real NOW.md in memory: one rule in
// one place, so a note that passes here always folds on main. It writes nothing.
//
//   npm run check:now-notes
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
/** The harness's closeout hook: its parser and its fold are the rule; this file only calls them. */
export const HOOK = join(ROOT, '.claude', 'hooks', 'harness-closeout.mjs')

interface Note { path: string; problems: string[] }
interface Hook {
  NOTES: string
  NOW: string
  parseNote(path: string, text: string): Note
  foldNotes(nowText: string, notes: Note[]): { text: string; folded: string[]; problems: string[] }
}

export interface NotesCheck { notes: string[]; folded: string[]; problems: string[] }

/** What the fold would do with every note in `root`'s now-notes/, against `root`'s NOW.md, without writing. */
export async function checkNotes(root: string = ROOT, hookPath: string = HOOK): Promise<NotesCheck> {
  const hook = (await import(pathToFileURL(hookPath).href)) as Hook
  const dir = join(root, hook.NOTES)
  const names = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : []
  if (!names.length) return { notes: [], folded: [], problems: [] }
  const texts = names.map((f) => [`${hook.NOTES}/${f}`, readFileSync(join(dir, f), 'utf8')] as const)
  const notes = texts.map(([path, text]) => hook.parseNote(path, text))
  const nowPath = join(root, hook.NOW)
  if (!existsSync(nowPath)) return { notes: notes.map((n) => n.path), folded: [], problems: [`${hook.NOW} does not exist, so no note can fold.`] }
  const { folded, problems } = hook.foldNotes(readFileSync(nowPath, 'utf8'), notes)
  // The fold's own words say what is missing; name the one mistake that cost three notes, so the fix is plain.
  const dashed = texts.filter(([, text]) => /^\s*[-*]\s+North Star check \(/m.test(text)).map(([path]) =>
    `${path}: its North Star line starts with a dash. A note writes the line with no dash in front, `
    + '"North Star check (YYYY-MM-DD): holds."; the fold adds the dash when it writes NOW.md.')
  return { notes: notes.map((n) => n.path), folded, problems: [...dashed, ...problems] }
}

const main = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (main) {
  const result = await checkNotes()
  if (result.problems.length) {
    console.log(`check:now-notes FAILED: ${result.problems.length} problem(s); the fold would leave these notes unfolded on main:`)
    for (const p of result.problems) console.log(`  ${p}`)
    process.exit(1)
  }
  console.log(result.notes.length
    ? `check:now-notes passed: all ${result.notes.length} closeout note(s) fold into NOW.md (${result.folded.join(', ')}).`
    : 'check:now-notes passed: no closeout notes waiting.')
}
