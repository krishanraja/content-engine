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
    id: 'CRYSTAL_CLEAR', name: 'Crystal clear before clever',
    text: 'Every sentence must make the actor, the action and the consequence clear on the first read. Never use a smart-sounding phrase that leaves the reader to work out what actually happened. If one reasonable reading differs from what we mean, rewrite it in literal, everyday words.',
    said: 'I never, ever want to say things that sound too smart and can be misinterpreted, things like this should be crystal clear as to what is happening, what does nudgeed even mean? Then: Ensure no other article is ever capable of being even 1% misinterpreted or confusing in the future, this is critical.',
    on: '2026-10-03', source: 'workbench replies on piece 1', status: 'live',
    stages: ['judge_draft', 'write', 'final_pass'],
  },
  {
    id: 'RELATABLE_EXPLANATION', name: 'Make unfamiliar ideas relatable',
    text: 'When a mechanism is unfamiliar, add a real historical parallel, a familiar analogy or a comical exaggeration that makes the point easier to grasp. Make the comparison visibly a comparison, keep the underlying fact exact, and remove it if it changes what happened.',
    said: 'We should also add parallels (when this has happened before), analogies to things people will relate to, or comical exaggerations to make the point where it does not distort fact.',
    on: '2026-10-03', source: 'workbench reply on piece 1', status: 'live',
    stages: ['judge_draft', 'write', 'final_pass', 'visual'],
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
    text: 'Every piece ends with our prediction: what will happen, a date to check it by, and how sure we are as a percentage. It is ruled held, broke or unclear in public on that date, and misses go up as big as hits. Write it as a last section headed "## OUR PREDICTION": one paragraph that opens with the date ("By 30 June 2027, ..."), then a line on its own, "How sure we are: 75%." The Short shows that call word for word, so give one date and one whole percentage.',
    said: 'I want these to be signature bulletproof formats that can run across any article FYI, if they are going in, they need to go in for everything.',
    on: '2026-09-25', source: 'docs/CREATIVE_IDENTITY_UPGRADE.md (P6); makeyourmindup.ai, "Every piece makes a call. We keep score."', status: 'live',
    stages: ['judge_idea', 'judge_draft', 'write', 'final_pass', 'publish_check'],
  },
  {
    id: 'CLEAR_STANCE', name: 'Take a clear stance',
    text: 'Our prediction takes a clear stance. Back the outcome we believe with a confident number; a confidence of 60% or so reads as sitting on the fence.',
    said: "In general I think I'd rather take a clearer stance than sit on the fence all the time and say 60%.",
    on: '2026-09-26', source: 'setting piece 2 at 75% instead of the 60% proposed', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass', 'publish_check'],
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
    id: 'BRITISH_SPELLING', name: 'British spelling',
    text: 'Use British spelling: colour, centre, theatre, organise, analyse, defence, labour, modelling, travelled, grey. A quotation and a name keep their own spelling.',
    said: 'Just get in line with what those updates are at the live website.',
    on: '2026-09-26', source: 'makeyourmindup.ai, "Contains British spelling" (live 2026-09-26)', status: 'live',
    stages: ['write', 'final_pass', 'publish_check'],
  },
  {
    id: 'STAMPS', name: 'Real or theatre stamps, as the brand book sets them',
    text: 'A stamp says REAL or THEATRE and nothing else, with the part it judges named above it in lowercase mono ("the stuffing", "the visor"). Bold mono, 0.18em tracking, a 3px border; REAL filled cream and tilted +3 degrees, THEATRE an outline at -4 degrees; a thin cream line from the stamp to an ink dot on the part. Stamps annotate the picture and never sit in the headline\'s line; on a cream spread they take the section\'s colours. Every stamp shows its evidence.',
    said: 'Just get in line with what those updates are at the live website.',
    on: '2026-09-26', source: 'makeyourmindup brand book v1.4, p.14 "Real, or theatre?"; makeyourmindup.ai', status: 'live', scope: 'under_the_hood',
    stages: ['visual'],
  },
  {
    id: 'TIMELINE', name: 'mind.the.gap maps then, now and the forks',
    text: 'A mind.the.gap piece shows what used to be the case, what is the case now, where it could go, and how it could fork into different futures, including what each future means for ordinary people using the product. The futures fork and never rejoin; the prediction sits on one of them.',
    said: 'map out, over time, visually: what used to be the case / what is the case now / where this could go / how it could fork off into different scenarios',
    on: '2026-09-25', source: 'walk log R5; brand book, mind.the.gap device', status: 'live', scope: 'mind_the_gap',
    stages: ['judge_idea', 'judge_draft', 'write', 'visual'],
  },
  {
    id: 'REAL_LIFE', name: 'Show it with something people really do',
    text: 'Land each key point with an everyday example of something a reader actually does: searching a shop for trainers, paying at checkout, asking an AI agent to buy something. Use real prices, fees and rules where they exist, and keep the example exact.',
    said: 'real world examples someone would do in real life are gold',
    on: '2026-10-05', source: 'chat, visuals for piece 1', status: 'live',
    stages: ['judge_draft', 'write', 'visual'],
  },
  {
    id: 'AI_AGENT', name: 'Call it an AI agent',
    text: 'Software that shops, books or acts for a person is an "AI agent" (for shopping, an "AI shopping agent"), never a robot or a bot. On first mention, say whose agent it is and what it does in plain words.',
    said: 'be clearer and refer to \'robot\' as "AI agent"',
    on: '2026-10-05', source: 'chat, launch visual for piece 1', status: 'live',
    stages: ['judge_draft', 'write', 'final_pass', 'visual'],
  },
  {
    id: 'MONEY_MECHANICS', name: 'Show how each side is paid, why it moved, and who gets stung',
    text: 'For every company in the story, explain in plain English what it actually gets paid for and by whom, the incentive that explains its move, and where the consumer and the merchant could get stung. Use the companies\' own reported numbers where they exist and label the rest as our read.',
    said: 'the whole article isn\'t very deep either, it doesn\'t really explain in plain english why they get paid for different things and what those different things are, what the incentives are for each company to make that decision, and where the consumer or merchant could get stung. Then: that feedback applies to the video, article and artifact',
    on: '2026-10-05', source: 'chat, piece 1 before launch', status: 'trial', scope: 'follow_the_money',
    stages: ['judge_draft', 'write', 'visual'],
  },
  {
    id: 'VISUAL_EXPLAINS', name: 'A visual makes a critical point land faster',
    text: 'A visual exists only to make one critical point of the piece land faster than the words can. Before making one, write that point in one sentence and the reader\'s question it answers. Build it from the piece\'s real, checked numbers, quotes and evidence, and show the mechanism or the comparison that carries the point. Never decorate: no figures walking to boxes, no icons acting out an analogy, no motion that adds nothing the words already said. Test: a reader who sees only the visual understands the point. If it fails, cut it.',
    said: 'The visuals need to explain something critical in the article in a way that would help them understand the point quicker. this needs to be a permanent rule, right now the visuals just feel like gimmicks - who cares about a person walking to a box that says "till"?',
    on: '2026-10-05', source: 'chat, launch visuals for piece 1', status: 'live',
    stages: ['visual'],
  },
  {
    // The numbers below are the constants scripts/pages checks with
    // (COVER_SAFE in build.py, the phone floors in card.py, which the cover
    // is held to as well);
    // tests/control-plane/house-rules.test.ts fails when the two drift apart.
    id: 'SUBSTACK_FIT', name: 'Artwork that survives Substack',
    text: 'Design every image for the places Substack shows it. The cover is 1200 x 800 (3:2), with every word and logo inside x 220 to 980 and y 84 to 716: the phone feed shows the whole cover, and that box is the part the 16:9 share card and the square archive tile also keep. A phone shows every image about 358 pixels wide: the cover in the feed, and each image inside the article, which Substack keeps whole and shrinks to fit. So every word a reader needs must come out at 14 pixels or more there, and fine print such as sources at 11 or more: on the 1200-wide cover, draw words at 47 pixels or more and fine print at 37 or more; on a 1360-wide image, 54 and 42. Never put more words in an image than a phone can read; put the rest in the article. Before publishing, look at the cover\'s crop preview and at every image at phone width.',
    said: "Also bear in mind what happens to your artwork when I'm looking at the article in Substack once it's posted.",
    on: '2026-10-05', source: 'chat, article 1 on Substack; walk log F64 (docs/walks/2026-09-three-piece-walk.md); checked by scripts/pages', status: 'live',
    stages: ['visual'],
  },
  {
    // The numbers and the line below are the constants in api/_packaging.ts,
    // which checks them in code; tests/control-plane/packaging.test.ts fails
    // when the two drift apart.
    id: 'YOUTUBE_PACKAGE', name: 'Titles, descriptions and subtitles: worth clicking, every word true',
    text: 'When writing the YouTube title and description for a video: the title names the people or companies in the story, puts them in a plain conflict or change, and leaves one question the video answers. It adds to the thumbnail text instead of repeating it, and fits in 60 characters so a phone shows all of it (YouTube stops at 100). The description opens with the hook in about 150 characters, because YouTube shows only that much before "more"; then two or three plain sentences; then the piece\'s dated prediction as the piece gives it; then "Read the full piece free at makeyourmindup.ai"; then at most three hashtags, or none. Every word is true and in the piece: every number is one it states, nothing is added that it does not say, and there is no made-up urgency ("just", "breaking", "shocking") and no shouting in capitals. The title and subtitle the piece itself goes out under on Substack keep the same rules for truth, numbers, hype and capitals. The Substack title names who is involved in a plain conflict or change, may differ from the YouTube title but never contradicts it, and aims for 60 characters, because Substack also sends it as the email\'s subject line and a phone cuts that short; it never passes 100, because Substack\'s feed on a phone cuts a title off at about 110. The subtitle\'s first sentence makes sense on its own and fits in about 60 characters, because the feed shows about one line of a subtitle and an email shows its start as the preview text; the whole subtitle aims for 150 characters or fewer.',
    said: '"whats a viral video title for this", then: "lets close this session out by ensuring everything I have asked for in terms of the content engine (like a viral youtube title and description) becomes a part of the durable engine.", then: "Also bear in mind what happens to your artwork when I\'m looking at the article in Substack once it\'s posted."',
    on: '2026-10-05', source: 'chat, the video for piece 1, and a phone screenshot of article 1 on Substack; walk log F59 and F65 (docs/walks/2026-09-three-piece-walk.md); checked by api/_packaging.ts', status: 'live',
    stages: ['write'],
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
