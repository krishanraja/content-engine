import { callClaude, robustJson, type ClaudeCall } from '../_content.js'
import { UTILITY_MODEL } from '../_models.js'
import { isDeferred } from './deferred.js'

// Expand the seed into the piece it could be, BEFORE any judge reads it.
//
// This is the change Krish's own grading asked for, and it is the difference
// between a panel that scores headlines and one that scores work.
//
// On 2026-09-24 he graded ten ideas the panel had already judged. The panel was
// harsher than him on eight and kinder on none, mean 3.8 against his 6.0. The
// gap was not calibration. Eight of his ten notes were not grades at all, they
// were EXPANSION INSTRUCTIONS: he was scoring the piece he would write, and the
// panel was scoring the headline it was handed. He said so in the clearest
// possible terms about a seed he scored 6 and the panel scored 3:
//
//   "This is a good example where we could bring to life what is, on the
//    surface, a fairly boring headline and quite technical and quite
//    statistics-heavy, into what this actually means for the world, what it
//    means for society, the economy, work, and labor."
//
// So the seed is not the thing to judge. The angle is. Everything below is
// quoted or drawn from his own ten notes rather than invented, because the
// whole point is that his expansion is the one worth reproducing.

export interface Expansion {
  /** The sharpened one-line claim, after the expansion. */
  angle: string
  /** Who is moved, and how. His most repeated ask. */
  implications: { party: string; effect: string }[]
  /** Where it goes next. "map out future scenarios". */
  scenarios: string[]
  /** "based on what kind of business you are, which would be better". */
  decision_rule: string | null
  /** What is known, what is inferred, and what is not knowable yet. */
  known: string[]
  inferred: string[]
  /** Empty when the seed carried nothing to expand. An honest nothing. */
  ok: boolean
  why_not: string | null
}

const SYSTEM = [
  'You take one content seed for Krish Raja and work out the piece underneath it, before anyone judges it.',
  '',
  'A seed is usually a headline. The piece is never the headline. Your job is the move Krish makes in his head',
  'when he looks at a dull technical item and sees something worth writing. In his words, about a seed he rated',
  'well above what it looked like: "bring to life what is, on the surface, a fairly boring headline and quite',
  'technical and quite statistics-heavy, into what this actually means for the world, what it means for society,',
  'the economy, work, and labor."',
  '',
  'DO THESE FIVE THINGS. They are taken from how he actually grades, not from a style guide.',
  '',
  '1. TRACE THE CONSEQUENCE TO EVERY PARTY IT TOUCHES. His most repeated instruction: "map out what the',
  '   implications are to: the AI lab, the business, the customer, economics in general". Name each party and say',
  '   what specifically changes for them. A party you cannot say anything concrete about should be left out.',
  '',
  '2. RUN IT FORWARD. "and/or where it could go in the future", "this could be really interesting if it just maps',
  '   out future scenarios". Give two or three scenarios that are genuinely different from each other, not one',
  '   prediction hedged three ways.',
  '',
  '3. SEGMENT THE READER. "it should really lean in on what this means for those building AI-native startups',
  '   compared to a SaaS world, and this needs to be clearer by B2B vs B2C." The same fact lands differently on',
  '   different businesses. Say which.',
  '',
  '4. LAND ON A DECISION RULE. "we would need to map out, based on what kind of business you are, which would be',
  '   better." The reader should finish able to work out which side of the call they are on. Not advice, a rule.',
  '',
  '5. SEPARATE WHAT IS KNOWN FROM WHAT YOU ARE INFERRING, and say so plainly. Krish: "In the absence of tons of',
  '   evidence, we need to look at hypotheticals and sense-backed predictions." A labelled inference is legitimate',
  '   here and a good piece is full of them. An inference PRESENTED AS A FINDING is not. Never invent a number, a',
  '   source, a quote or an event. If you reason past the evidence, put it in `inferred` and say what it rests on.',
  '',
  'DO NOT PREACH. No closing moral, no lesson for leaders, no sentence telling the reader what to conclude or',
  'become. This overrides everything else here.',
  '',
  'If the seed is too thin or too broken to expand, say so in `why_not` and return ok false. A truncated fragment,',
  'a bare product name, a headline with no claim in it: these are honest nothings and pretending otherwise puts a',
  'confident number on top of rubbish.',
  '',
  'THAT IS THE ONLY REASON TO REFUSE. Not fitting a subchannel is not one: on 2026-09-24 a security story filed',
  'under the wrong one was declined for being "not for that subchannel", which left it judged as a bare headline',
  'and scored accordingly. Where it belongs is decided after you, by something that reads all three. Work out the',
  'piece and let it be placed.',
  '',
  'Return ONE JSON object and nothing else:',
  '{"ok": true|false, "why_not": null or "why this cannot be expanded",',
  ' "angle": "the one-line claim the piece makes, after the expansion",',
  ' "implications": [{"party": "who", "effect": "what changes for them, specifically"}],',
  ' "scenarios": ["where this goes if X", "where it goes if Y"],',
  ' "decision_rule": "how a reader works out which side of this they are on, or null",',
  ' "known": ["what is actually established, with who said it"],',
  ' "inferred": ["what you are reasoning to, and what it rests on"]}',
].join('\n')

const str = (v: unknown, cap = 400): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, cap) : null
const strs = (v: unknown, cap = 300, max = 6): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
    .map(x => x.trim().slice(0, cap)).slice(0, max) : []

export function parseExpansion(raw: string): Expansion {
  const nothing = (why: string): Expansion => ({
    angle: '', implications: [], scenarios: [], decision_rule: null,
    known: [], inferred: [], ok: false, why_not: why,
  })
  // robustJson strips a code fence and tolerates prose either side of the
  // object. The greedy `match(/\{[\s\S]*\}/)` that used to be here did
  // neither, and a truncated reply has no closing brace at all, which is why
  // the token ceiling below moved at the same time.
  const parsed = robustJson(raw) as Record<string, unknown> | null
  if (!parsed || typeof parsed !== 'object') {
    // The reason is specific so the failure rate is diagnosable rather than a
    // single "did not expand" bucket covering four different problems.
    return nothing(raw.trim().length >= 1
      ? 'the model returned something that was not an object'
      : 'the model returned nothing')
  }
  if (parsed.ok === false) return nothing(str(parsed.why_not) || 'the seed could not be expanded')
  const angle = str(parsed.angle, 500)
  // An expansion with no angle is not an expansion. Refusing here rather than
  // passing an empty one through is what stops the panel scoring a blank.
  if (!angle) return nothing('the expansion produced no angle')
  const implications = Array.isArray(parsed.implications)
    ? (parsed.implications as unknown[])
      .map(x => (x && typeof x === 'object' ? x as Record<string, unknown> : {}))
      .map(x => ({ party: str(x.party, 80) || '', effect: str(x.effect, 300) || '' }))
      .filter(x => x.party && x.effect).slice(0, 8)
    : []
  return {
    ok: true, why_not: null, angle, implications,
    scenarios: strs(parsed.scenarios),
    decision_rule: str(parsed.decision_rule, 400),
    known: strs(parsed.known), inferred: strs(parsed.inferred),
  }
}

/** What the judges read instead of the raw seed. The seed is kept at the top
 *  so novelty and standing can still see what it came from. */
export function expansionArtifact(seed: string, e: Expansion): string {
  if (!e.ok) return seed
  const lines = ['## The seed, as it arrived', seed, '', '## The angle', e.angle]
  if (e.implications.length) {
    lines.push('', '## Who it moves')
    for (const i of e.implications) lines.push(`- ${i.party}: ${i.effect}`)
  }
  if (e.scenarios.length) { lines.push('', '## Where it goes'); for (const s of e.scenarios) lines.push(`- ${s}`) }
  if (e.decision_rule) lines.push('', '## The decision it leaves the reader with', e.decision_rule)
  if (e.known.length) { lines.push('', '## Established'); for (const k of e.known) lines.push(`- ${k}`) }
  if (e.inferred.length) { lines.push('', '## Inferred, and what it rests on'); for (const i of e.inferred) lines.push(`- ${i}`) }
  return lines.join('\n')
}

/**
 * How this expansion reaches the model, and which draw of it this is.
 *
 * `sample` is what tells the batch transport that a second expansion of the
 * same seed must be an INDEPENDENT draw rather than the first one handed back.
 * The bury confirmation is the only caller that sets it, and it is the whole
 * reason that confirmation means anything: only 2 of 10 seeds expanded to the
 * same angle twice, so a cached second expansion would agree with itself every
 * time and the row would claim a confirmation nothing tested.
 */
export interface ExpandOpts { call?: ClaudeCall; sample?: number }

export async function expand(
  seed: string, mandates: string, whatKrishDoes: string, opts: ExpandOpts = {},
): Promise<Expansion> {
  const call = opts.call || callClaude
  try {
    const raw = await call({
      system: SYSTEM,
      ...(opts.sample ? { sample: opts.sample } : {}),
      user: [
        '## The seed', seed, '',
        // All three, always. Work out the piece; the router places it after.
        '## The three things Krish publishes. Work the seed up for whichever it really is,',
        '## and never refuse because it does not suit one of them.', mandates, '',
        '## What Krish actually does, so you can tell when this touches his own work', whatKrishDoes,
      ].join('\n'),
      model: UTILITY_MODEL, maxTokens: 2600, temperature: 0.5,
      agent: 'ladder-expand', timeoutMs: 90_000,
    })
    return parseExpansion(raw)
  } catch (e) {
    // A deferral is not a failed expansion. The batch transport throws it to
    // say "not yet", and swallowing it here would record `why_not: the
    // expansion call failed` on every idea of every tick — a sweep that judged
    // nothing, reporting the shape of one that judged everything, which is the
    // failure this engine keeps finding in its own code.
    if (isDeferred(e)) throw e
    return {
      angle: '', implications: [], scenarios: [], decision_rule: null, known: [], inferred: [],
      ok: false, why_not: `the expansion call failed: ${(e as Error)?.message?.slice(0, 160) || 'unknown'}`,
    }
  }
}
