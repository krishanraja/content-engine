// Krish's house rules, in one place.
//
// Krish, 2026-09-25: "Think about the GitHub engine as a modular set of
// components that work together to come alive. You should be updating and
// upgrading each relative or relevant component part as you go across the
// entire engine, whether that be brainstorming an idea and judging it,
// implementing gates and checks prior to publish that have come from some of
// the guidelines I've given."
//
// Every ruling he has given in words is one record here: what it says, his
// exact words, when, whether it is live, and the stages that must enforce it.
// The writers (VOICE_GUARDRAILS), the judges (judgeContext), the final pass
// (VOICE_ABSOLUTES) and the pre-publish checks (api/_publishChecks.ts) all read this
// list, and tests/control-plane/house-rules.test.ts fails if a live rule is
// enforced nowhere. A new ruling is added here once, not in five prompts.
//
// Pure and import-free, so every module can read it. The mechanical checks
// that enforce the rules before approval live in api/_publishChecks.ts.

export type Stage =
  | 'judge_idea'    // the panel, judging an idea or angle
  | 'judge_draft'   // the panel, judging a draft
  | 'write'         // every writer: draft, revise, chat, synthesize, channel cuts
  | 'final_pass'    // the ship-moment check
  | 'publish_check' // a mechanical check before approval or publication
  | 'visual'        // pages, Shorts and carousels

export interface HouseRule {
  id: string
  /** Plain name, as Krish would say it. */
  name: string
  /** The instruction a writer or judge reads. */
  text: string
  /** His words, verbatim, and where they are recorded. */
  said: string
  on: string
  source: string
  status: 'live' | 'trial'
  stages: Stage[]
  /** A subchannel slug when the rule belongs to one subchannel only. */
  scope?: string
}

export const HOUSE_RULES: readonly HouseRule[] = Object.freeze([
  {
    id: 'R2', name: 'No "Not X, Y"',
    text: 'Never use the "Not X, Y" construction, at any scale and in either order: no "Not X, Y", no "it\'s not X, it\'s Y", no "X isn\'t the story, Y is", no "Y, not X", no "never X, it was Y". State the sharper take directly. Plain factual negation ("Amazon did not say why") is fine.',
    said: 'Cut it everywhere.', on: '2026-09-24', source: 'walk log R2', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass', 'publish_check'],
  },
  {
    id: 'R4', name: 'Openings hook on consequence',
    text: 'The opening hooks on consequence: the reader should feel this matters and start thinking about what could happen next. More personality, a sharper point, and it may provoke, but it lets the reader reach the conclusion instead of arguing them into a verdict.',
    said: 'The first opening has to really hook the reader until they need to know this or what might happen as a result. The average reader needs to feel like this is consequential and make them think about what could happen, as opposed to us forcing our opinion on them. But it should probably be a bit more inflammatory in that way.',
    on: '2026-09-25', source: 'ledger sequence 66; walk log R4', status: 'live',
    stages: ['judge_idea', 'judge_draft', 'write', 'final_pass'],
  },
  {
    id: 'R6', name: 'Plain words',
    text: 'Plain words only: no word the reader has to interpret. That covers technical jargon and also our own coined labels, nicknames and shorthand for sections, devices or ideas. If a term cannot be avoided (a product name, a quoted source), say what it means in plain English the first time it appears.',
    said: "We do say no jargon everywhere and I don't just mean technical jargon. I mean words that someone needs to interpret.",
    on: '2026-09-25', source: 'ledger magic_rejected on piece 2; walk log R6', status: 'live',
    stages: ['judge_idea', 'judge_draft', 'write', 'final_pass', 'publish_check', 'visual'],
  },
  {
    id: 'R7', name: 'Reading age 12, with humour',
    text: 'Write for a reading age of 12: short sentences, everyday words, and real humour and personality. The joke points at the hype, never the reader, and never replaces the finding.',
    said: 'This entire media channel needs to be radically simplistic with an average reading age of 12 and a huge sense of humour and fun and personality.',
    on: '2026-09-25', source: 'walk log R7', status: 'live',
    stages: ['judge_idea', 'judge_draft', 'write', 'final_pass', 'publish_check'],
  },
  {
    id: 'FACTS', name: 'Every fact checked twice',
    text: 'Every number, date, name and quote must be traceable to a source, in that source\'s own words where it is quoted or attributed. Never round, rescale or paraphrase inside a quote, and never add a detail from memory.',
    said: 'Stats and facts needs to probably be passed through a separate verification gate using perplexity or something, we cannot afford even a chance of factual errors slipping in.',
    on: '2026-09-25', source: 'the fact gate, api/_factGate.ts', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass', 'publish_check'],
  },
  {
    id: 'CALL', name: 'Every piece makes a dated prediction',
    text: 'Every piece ends with our prediction: what will happen, a date to check it by, and how sure we are as a percentage. It is ruled held, broke or unclear in public on that date, and misses go up as big as hits.',
    said: 'I want these to be signature bulletproof formats that can run across any article FYI, if they are going in, they need to go in for everything.',
    on: '2026-09-25', source: 'docs/CREATIVE_IDENTITY_UPGRADE.md (P6); makeyourmindup.ai, "Every piece makes a call. We keep score."', status: 'live',
    stages: ['judge_idea', 'judge_draft', 'write', 'final_pass', 'publish_check'],
  },
  {
    id: 'NO_SERMONS', name: 'Show the working, no sermons',
    text: 'Show the working and let the reader make their mind up. No closing moral, no telling the reader what to think.',
    said: 'as opposed to us forcing our opinion on them',
    on: '2026-09-25', source: 'ledger sequence 66; brand book, "No added sermons"', status: 'live',
    stages: ['judge_draft', 'write', 'final_pass'],
  },
  {
    id: 'NO_EXCLAMATION', name: 'No exclamation marks',
    text: 'No exclamation marks, except inside a quotation.',
    said: 'No em dashes. No exclamation marks.', on: '2026-09-25', source: 'makeyourmindup brand book v1.0, "The house rules"', status: 'live',
    stages: ['write', 'final_pass', 'publish_check'],
  },
  {
    id: 'NO_EM_DASH', name: 'No em dashes',
    text: 'No em dashes anywhere. Use commas, full stops or brackets.',
    said: 'No em dashes. No exclamation marks.', on: '2026-09-25', source: 'makeyourmindup brand book v1.0; voice doctrine', status: 'live',
    stages: ['write', 'final_pass', 'publish_check'],
  },
  {
    id: 'TIMELINE', name: 'mind.the.gap maps then, now and the forks',
    text: 'A mind.the.gap piece shows what used to be the case, what is the case now, where it could go, and how it could fork into different futures, including what each future means for ordinary people using the product. The futures fork and never rejoin; the prediction sits on one of them.',
    said: 'map out, over time, visually: what used to be the case / what is the case now / where this could go / how it could fork off into different scenarios',
    on: '2026-09-25', source: 'walk log R5; brand book, mind.the.gap device', status: 'live', scope: 'mind_the_gap',
    stages: ['judge_idea', 'judge_draft', 'write', 'visual'],
  },
  {
    id: 'BOLD', name: 'Bold and colourful, never Bloomberg',
    text: 'Every page, Short and carousel is bold, colourful and fun, in the makeyourmindup house style: one loud thing per block, colour blocks loud because the rest is quiet. Never the grey, dense look of a financial terminal.',
    said: 'this design needs to be bold, vivacious and colourful like everything else we creatively bring to life. everything is so boring and Bloomberg right now.',
    on: '2026-09-25', source: 'walk log, piece 2', status: 'live',
    stages: ['visual'],
  },
  {
    id: 'ALIGNED', name: 'Everything lines up',
    text: 'Every element lines up: shared left edges, markers centred on their lines, no overlaps, nothing touching the thing below it. Check at phone width and at desktop width before showing anyone.',
    said: 'There are some alignment issues. Keep watch for those.',
    on: '2026-09-25', source: 'ledger magic_rejected on piece 2', status: 'live',
    stages: ['visual'],
  },
  {
    id: 'R1', name: 'Argue from labelled guesses when evidence is thin',
    text: 'Where evidence is thin, argue from clearly labelled guesses and reasoned predictions instead of dropping the piece. A guess is marked as a guess.',
    said: 'In the absence of tons of evidence, we need to look at hypotheticals and sense-backed predictions.',
    on: '2026-09-24', source: 'walk log R1', status: 'trial',
    stages: ['judge_idea', 'write'],
  },
])

/** The rules a stage enforces, for one subchannel or the house as a whole. */
export function rulesFor(stage: Stage, subchannel?: string | null): HouseRule[] {
  return HOUSE_RULES.filter(r => r.stages.includes(stage) && (!r.scope || r.scope === subchannel))
}

const HEADER: Partial<Record<Stage, string>> = {
  judge_idea: "KRISH'S HOUSE RULES. Judge whether the finished piece could keep every one of these; do not mark an idea down for something only a draft can have. Where your rubric disagrees, these win.",
  judge_draft: "KRISH'S HOUSE RULES. A draft that breaks one of these is not ready, whatever else it does well. Name the rule it breaks. Where your rubric disagrees, these win.",
}

/** Only the rules that belong to one subchannel, for a writer that already
 *  reads the house-wide ones through VOICE_GUARDRAILS. */
export function subchannelRulesBlock(stage: Stage, subchannel?: string | null): string {
  const rules = rulesFor(stage, subchannel).filter(r => r.scope)
  if (!rules.length) return ''
  return [`KRISH'S RULES FOR THIS SUBCHANNEL (they win over the mandate where they disagree):`, ...rules.map(r => `- ${r.name}: ${r.text}`)].join('\n')
}

/** The rules as a block a model reads. House rules win over a mandate or a
 *  voice note that says otherwise. */
export function houseRulesBlock(stage: Stage, subchannel?: string | null): string {
  const rules = rulesFor(stage, subchannel)
  if (!rules.length) return ''
  return [
    HEADER[stage] || "KRISH'S HOUSE RULES (they win over any mandate, rubric or voice note that says otherwise):",
    ...rules.map(r => `- ${r.name}${r.status === 'trial' ? ' (on trial)' : ''}: ${r.text}`),
  ].join('\n')
}
