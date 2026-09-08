import { sanitizeVoice } from '../_content.js'
import type { DeterministicFinding } from './panel.js'

// The free judges.
//
// These run before any model call, cost nothing, and can end the panel. Paying
// six models to notice that a draft is forty words long, or that the same post
// was already ingested, is how an engine becomes slow and expensive for no
// reason at all.
//
// They are also the honest ones: a duplicate is a fact, not an opinion, and
// recording it as a verdict alongside the model judges keeps the whole panel in
// one place rather than splitting "checks" from "judgement".

/** Nothing to judge. A two-line thought is a capture, not an idea, and the
 *  panel should say so rather than hallucinate six opinions about it. */
export function thinness(text: string, minChars: number): DeterministicFinding | null {
  const length = text.trim().length
  if (length >= minChars) return null
  return {
    judge: 'substance',
    verdict: 'kill',
    score: 0,
    the_one_fix: `There is not enough here to judge yet: ${length} characters. Say what the claim is.`,
    evidence: [`length ${length} < ${minChars}`],
  }
}

/** Already in the system. The unique indexes on content_ideas catch this at
 *  write time; catching it here saves the panel spend and tells Krish which
 *  row it collides with. */
export function duplicate(existing: { id: string; idea: string } | null): DeterministicFinding | null {
  if (!existing) return null
  return {
    judge: 'duplicate',
    verdict: 'kill',
    score: 0,
    the_one_fix: 'This is already in the system. Open the existing one rather than starting again.',
    evidence: [`${existing.id}: ${existing.idea.slice(0, 200)}`],
  }
}

/** The voice rules that are mechanical. sanitizeVoice already strips em dashes
 *  and their lookalikes on every write path, so anything this finds is a rule a
 *  model would otherwise be asked to notice and would sometimes miss. */
export function voiceMechanics(text: string): DeterministicFinding | null {
  const cleaned = sanitizeVoice(text)
  const problems: string[] = []
  if (cleaned !== text) problems.push('em dashes or their lookalikes are present')

  // The banned-word list Krish enforces in public copy. Kept short and exact:
  // a long fuzzy list produces false positives that train people to ignore it.
  const banned = [
    'delve', 'leverage the power', 'in today\'s fast-paced', 'game-changer', 'unlock the potential',
    'navigate the complexities', 'it\'s not just', 'testament to', 'tapestry', 'realm of',
  ]
  const lower = text.toLowerCase()
  for (const word of banned) if (lower.includes(word)) problems.push(`banned phrase: ${word}`)

  if (!problems.length) return null
  return {
    judge: 'voice_mechanics',
    verdict: 'revise',
    // Mechanical, so it is a fixable fault rather than a fatal one: 4 says
    // "this needs a pass", not "this is worthless".
    score: 4,
    the_one_fix: 'Run the voice fix: the mechanical rules are broken before anyone reads it.',
    evidence: problems.slice(0, 8),
  }
}

/** Everything free, in one call. Order matters: the cheapest and most decisive
 *  first, so a short-circuit happens as early as possible. */
export function deterministicFindings(opts: {
  text: string
  minChars: number
  existing?: { id: string; idea: string } | null
  checkVoice?: boolean
}): DeterministicFinding[] {
  const found: DeterministicFinding[] = []
  const thin = thinness(opts.text, opts.minChars)
  if (thin) found.push(thin)
  const dupe = duplicate(opts.existing ?? null)
  if (dupe) found.push(dupe)
  if (opts.checkVoice) {
    const voice = voiceMechanics(opts.text)
    if (voice) found.push(voice)
  }
  return found
}
