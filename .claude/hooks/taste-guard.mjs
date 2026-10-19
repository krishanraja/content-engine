// PreToolUse on Write, Edit and MultiEdit: the North Star, the mandates and the taste rules are Krish's.
// AGENTS.md: the North Star "Only Krish changes it"; "Every durable taste or performance rule needs explicit
// user approval"; "The mandate is the test ... read live. Never copy a mandate". The scripted lanes that record
// his words (title_check.py, story_check.py and the like) run through Bash and are not touched by this hook.
import { decide, readEvent, repoPath, writtenText } from './lib.mjs'

const event = readEvent()
const input = event.tool_input || {}
const path = repoPath(input.file_path)

if (path === 'docs/NORTH_STAR.md') {
  decide('deny', 'taste-guard: docs/NORTH_STAR.md is Krish\'s ambition and only he changes it (AGENTS.md). Propose the change to him in words instead.')
}

// The files that hold taste rules a session may only change with his approval.
const TASTE_FILES = new Set([
  'apps/control-plane/api/_houseRules.ts',
  'config/hook-playbook.json',
  'config/title-verdicts.json',
  'config/rejected-lines.json',
  'config/golden-examples.json',
  'config/style-references.json',
  'config/story-intro-outro.json',
  'config/intro-sting.json',
  'config/carousel-visual-direction.json',
  'config/techniques.json',
])
if (TASTE_FILES.has(path)) {
  decide('ask', `taste-guard: ${path} holds taste rules. A rule becomes active only when Krish approves it (AGENTS.md); he approves this edit in person, or it does not run.`)
}

// Mandates live only in venture_formats.mandate; a migration that writes one changes a mandate.
if (/^supabase\/migrations\/.+\.sql$/.test(path) && /\bmandate\b/i.test(writtenText(input))) {
  decide('ask', `taste-guard: ${path} writes a subchannel mandate. Mandates are Krish's and are read live, never copied; he approves this edit in person, or it does not run.`)
}
process.exit(0)
