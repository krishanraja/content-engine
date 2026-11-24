// The corpus a piece's narrative is built from (Ruling, Krish, 2026-11-19: "at this stage of every piece, I need to be able to
// drag and drop multiple files in (the perplexity repsonse and accompanying files images etc). It should save all of that to
// the right place in Drive, file it in the board properly, and then the Claude production prompt should be able to refer to it
// as the corpus by which we are going to flesh out the full narrative arc and story, ensuring we trace everything back with the
// 5 Whys and also make the narrative incredibly fun to consume").
//
// One place: every Claude prompt for a piece whose narrative lock is not yet signed carries these lines (itemPrompt, through
// StoryState.corpus), and Control Centre's "Re-run the narrative" copies that same prompt. What counts as research is the
// research library's own rule (_researchLibrary.ts inLibrary: the research kinds, or a research role), so what the prompt
// names is what Drive's `6 Research library` holds.
import { LIBRARY_KINDS, LIBRARY_ROLES } from '../_researchLibrary.js'

export interface CorpusItem { id: string; title: string; kind: string }

/** The research on file for a piece, newest first as the view lists them, once each by id. */
export function corpusOf(materials: Array<{ id?: unknown; title?: unknown; kind?: unknown; role?: unknown }>): CorpusItem[] {
  const out: CorpusItem[] = []
  const seen = new Set<string>()
  for (const m of materials) {
    const id = typeof m.id === 'string' ? m.id : ''
    const kind = typeof m.kind === 'string' ? m.kind : ''
    const role = typeof m.role === 'string' ? m.role : ''
    if (!id || seen.has(id)) continue
    if (!(LIBRARY_KINDS as readonly string[]).includes(kind) && !(LIBRARY_ROLES as readonly string[]).includes(role)) continue
    seen.add(id)
    out.push({ id, title: typeof m.title === 'string' && m.title.trim() ? m.title.trim().slice(0, 160) : 'Untitled', kind })
  }
  return out.slice(0, 60)
}

/** The prompt's lines: the corpus by id and title, and how the narrative is built from it. */
export function corpusLines(corpus: CorpusItem[]): string {
  const list = corpus.length
    ? corpus.map(c => `- ${c.id}: ${c.title} (${c.kind})`).join('\n')
    : '- Nothing is filed as research yet. Say so on the board as blocked, and ask Krish for his research (or the Perplexity prompt\'s answer) before you write.'
  return 'The corpus. Everything filed on this piece as research is what the narrative is built from, and nothing else is a source. '
    + 'Read every item whole before you write a word, with read_piece_material on the Control Center connector (or board_session.py PIECE read <id>):\n'
    + `${list}\n`
    + 'Build the full narrative arc from it: the hook, the turn, what is at stake, the payoff, and the one thing a reader does next. '
    + 'Trace every claim back with the 5 Whys: ask why it matters, then why again, until you reach the root cause, and note beside each step the corpus item it rests on, by id. '
    + 'A claim the corpus does not hold is left out or named as a question for Krish. '
    + 'Make it incredibly fun to consume: open straight on the hook, keep the tension, humour where it is earned, plain words a 12-year-old can follow, and the house voice rules (AGENTS.md). '
    + 'Then write it as the narrative lock and file it for his signature; never sign it for him.\n\n'
}
