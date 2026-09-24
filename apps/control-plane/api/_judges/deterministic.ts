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

// Krish, 2026-09-24, asked what the rule is for the "Not X, Y" move: "Cut it
// everywhere", which he confirmed covers both orders. The prompts say so; this
// catches a model that does it anyway. Plain factual negation ("Amazon did not
// say why") is not the move and must never be flagged, or the check becomes
// noise people learn to ignore.
const NOT_XY = [
  // Sentence-initial: "Not the compliance story, the version where..."
  /(?:^|[.!?]["'”’)]?\s+)Not\s+(?!(?:surprisingly|only|least|yet|once|quite|to mention|much|many|all|every\w*)\b)[^.!?\n,]{2,80},\s+(?!and\b|or\b|so\b|because\b|which\b|who\b)\S[^.!?\n]{0,40}/g,
  // After a colon or semicolon: "...a news cycle: not what Amazon says, what a judge says"
  /[:;]\s+not\s+(?!(?:surprisingly|only|least|yet|once|quite|to mention|much|many|all|every\w*)\b)[^.!?\n,]{2,80},\s+(?!and\b|or\b|so\b|because\b|which\b|who\b)\S[^.!?\n]{0,40}/gi,
  // "isn't X, it's Y", "is not X. It's Y", "aren't X, they're Y"
  /\b(?:isn['’]t|is not|wasn['’]t|was not|aren['’]t|are not)\s+[^.!?\n]{1,80}?[,;.]\s+(?:it|this|that|they)(?:['’]s|['’]re| is| are| was| were)\b[^.!?\n]{0,30}/gi,
  // "it's not X, it's Y"
  /\b(?:it|this|that|they)(?:['’]s|['’]re| is| are) not\s+[^.!?\n]{1,80}?[,;.]\s+(?:it|this|that|they)(?:['’]s|['’]re| is| are)\b[^.!?\n]{0,30}/gi,
  // "never X, it was Y"
  /\bnever\s+[^.!?\n]{1,60}?,\s+(?:it|this|that|they)\s+(?:was|were|is|are)\b[^.!?\n]{0,30}/gi,
  // The reverse order, "Y, not X": "measured, not projected."
  /[^.!?\n,]{0,40},\s+not\s+(?!only\b|least\b|surprisingly\b|yet\b|always\b|quite\b)(?:a |an |the )?[\w'’-]+(?:\s+[\w'’-]+){0,3}(?=[.,;!?]|$)/gim,
]

// "is not established. It's our inference" is a hedge, not the move: a bare
// participle on the negated side names a state of evidence, not a rival take.
const HEDGE = /\b(?:is|was|are|were|isn['’]t|wasn['’]t) not (?:yet )?\w+ed[.,;]/i

/** Every "Not X, Y" construction in the text, trimmed for evidence, in order. */
export function notXYConstructions(text: string): string[] {
  const found: { at: number; text: string }[] = []
  for (const re of NOT_XY) {
    re.lastIndex = 0
    for (const m of text.matchAll(re)) {
      if (HEDGE.test(m[0])) continue
      found.push({ at: m.index ?? 0, text: m[0].replace(/^[.!?"'”’)\s]+/, '').trim().slice(0, 120) })
    }
  }
  found.sort((a, b) => a.at - b.at)
  // One sentence can match two shapes; report it once.
  return found.filter((f, i) => !found.slice(0, i).some(g => g.text.includes(f.text) || f.text.includes(g.text))).map(f => f.text)
}

/** The first "Not X, Y" construction in the text, or null. */
export function notXYConstruction(text: string): string | null {
  return notXYConstructions(text)[0] ?? null
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

  // Every hit, not the first: one flag for seven uses reads as one fix.
  const notXY = notXYConstructions(text)
  for (const hit of notXY.slice(0, 5)) problems.push(`the "Not X, Y" construction: "${hit}"`)
  if (notXY.length > 5) problems.push(`and ${notXY.length - 5} more "Not X, Y" constructions`)

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
