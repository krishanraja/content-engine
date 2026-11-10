// Every prompt the live board copies out (docs/plans/2026-11-09-board-desk/PLAN.md, "The prompts, one shape for all").
//
// Krish, 2026-11-09: "The prompts that are copied when I click a "Copy Prompt" button should be all-encompassing. They
// should assume a new session knows nothing. They should enable the session to work freely and creatively and not be
// too restrictive. They should not micromanage the Claude Code session too much so that it gets stuck in loops or in
// endless rounds of approvals. The prompt should be creative and enable maximum creative freedom but with a laser focus
// on an incredibly strong visual and scripted narrative arc that lands the message incredibly well."
//
// So every prompt has the same five parts: who and what (nothing assumed), where everything lives, the goal and the
// arc, freedom (make the craft calls, ask only what only Krish can answer, in one message), and the one thing to show
// him at the end. tests/control-plane/board-desk.test.ts holds every prompt to that shape.

export interface PieceBrief {
  week: string
  day: string
  dayName: string
  date: string
  series: string
  pieceId: string
  idea: string
  story?: string | null
  brief?: string | null
  materials: string[]
  lock: { path: string; signed: boolean } | null
  look?: { production?: string | null; experiment?: string | null; inspiration?: string[] } | null
  styleHint?: { production?: string | null; script?: string | null; experiment?: string | null; why?: string | null } | null
}

const REPO = 'krishanraja/content-engine'
export const ARC = 'Aim for one arc a listener can follow hearing it once. Open straight on the hook. Every line earns its picture and every '
  + 'picture proves a line. Build to the one moment it clicks, and close on the one thing a leader would do on Monday.'
export const FREEDOM = 'Work freely. Make the craft calls yourself and do not stop for permission. Take creative liberties wherever they make '
  + 'the point land faster. Ask Krish only what only he can answer, all in one short message, and only if the story truly needs it.'

function context(p: PieceBrief): string {
  const where = [
    `- the piece's making record: python3 scripts/post-pack/making.py ${p.pieceId} show`,
    `- the week's plan, ideas and notes: docs/plans/${p.week}-week/`,
    p.materials.length ? `- the research on the piece (meta.materials, GET /api/content-ideas/${p.pieceId}/materials): ${p.materials.join('; ')}` : '',
    p.lock ? `- the narrative lock: ${p.lock.path} (${p.lock.signed ? 'signed by Krish' : 'written, not yet signed'})` : '',
    p.look?.production ? `- the look he picked: ${p.look.production}${p.look.experiment ? `, with "${p.look.experiment}" as the experiment` : ''} (config/style-references.json formats)` : '',
    p.look?.inspiration?.length ? `- inspiration he folded in: ${p.look.inspiration.join('; ')}` : '',
    '- his production inspiration: GET /api/inspiration/candidates?role=look (newest and never used first)',
  ].filter(Boolean).join('\n')
  return `You are picking up one piece of the Make Your Mind Up content engine with no prior context. The repository is ${REPO}: `
    + 'read AGENTS.md and CLAUDE.md once for the house rules, then trust your judgement.\n\n'
    + `The piece: piece_id ${p.pieceId}, ${p.dayName} ${p.date}, the ${p.series} series.\n`
    + `The idea: ${p.idea}${p.story ? `\nThe story so far: ${p.story}` : ''}${p.brief ? `\nKrish's own words on it: "${p.brief}"` : ''}\n\n`
    + `Where everything lives:\n${where}`
}

/** The research brief, for Perplexity by hand or the engine's own run (sonar-pro). */
export function researchPrompt(p: PieceBrief): string {
  return `You are researching one piece for Make Your Mind Up, Krish Raja's publication about what AI is really doing to business. `
    + 'Find out what is true and what is surprising.\n\n'
    + `The piece: ${p.dayName} ${p.date}, the ${p.series} series.\nThe idea: ${p.idea}${p.story ? `\nThe story so far: ${p.story}` : ''}`
    + `${p.brief ? `\nKrish's words: "${p.brief}"` : ''}\n\n`
    + 'Use primary sources: filings, earnings, regulators, rating agencies and the companies\' own pages. Date every figure and '
    + 'mark every estimate as one. Write one Markdown file with: a one-paragraph answer; the ten most surprising facts, each sourced; '
    + 'a table of the main players and the numbers that matter; what the sceptics and the believers each say; and the open questions. '
    + 'Follow the evidence where it goes, and if the real story differs from the idea, say so first.'
}

/** Settle the story and write the narrative lock: a short back-and-forth with Krish. */
export function storyPrompt(p: PieceBrief): string {
  return `${context(p)}\n\nThe job: find the deeper story under the news, with Krish, and write the narrative lock he signs. `
    + 'Read the research whole first. Then put to him, in one message, the two or three questions that decide the story, each with your '
    + `best guess, so he can answer in a line. Write the lock to docs/plans/${p.week}-week/narrative-lock-${p.day}.md (its surface story, `
    + `deeper story, arc, the fun, the use, his close), and take his signature.\n\n${ARC}\n\n${FREEDOM}`
}

/** Storyboard and script, together, before he records (Krish, 2026-11-09). */
export function storyboardPrompt(p: PieceBrief): string {
  return `${context(p)}\n\nThe job: make the script and the storyboard together, before he records, so he records the right words in his `
    + 'own voice and every line already has its picture. Two cuts: about 5 minutes and about 90 seconds. Use the look he picked as the '
    + 'spine, and be bold with the visuals: borrow from his inspiration where it makes the point land faster.\n\n'
    + `${ARC}\n\n${FREEDOM}\n\nWhen you have it, send him one HTML file with both cuts' scripts side by side with their storyboard frames `
    + '(rough mock frames are fine), the run time of each cut, and the three lines you are least sure of. His Approve press on the board '
    + 'sends the scripts to his Teleprompter.'
}

/** A mock of the look on his own footage (ve styles, on his home computer). */
export function mockPrompt(p: PieceBrief): string {
  return `${context(p)}\n\nThe job: show Krish what the look he picked will feel like, before anything is scripted. Run \`python scripts/ve.py styles\` `
    + 'for this piece on his own footage (his last take of this format when the piece has none yet; never stock footage), and send him '
    + `the clips side by side with one line each on what it does for this story.\n\n${FREEDOM}`
}

/** The fallback for any step: do the step, from the record, with him. */
export function stepPrompt(p: PieceBrief, step: string): string {
  return `${context(p)}\n\nThe step it is on: ${step}. Do it, working from the record first.\n\n${ARC}\n\n${FREEDOM}\n\n`
    + 'Show Krish what you made in one message before anything is sent or published.'
}
