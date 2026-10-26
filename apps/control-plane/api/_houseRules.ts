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
//
// A rule about finishing a recorded video (its sting, its music bed, its
// thumbnails) is on the 'production' stage only. No writer, judge or shot
// planner reads that stage: the tools that make the cut enforce it
// (scripts/quick-edit, scripts/pages --thumbs, the visual gate and the making
// record), so a script or a channel cut never carries LUFS figures or a sting
// that is not approved. tests/control-plane/house-rules.test.ts holds each
// such rule to the tools its source names.

export type Stage =
  | 'judge_idea'    // the panel, judging an idea or angle
  | 'judge_draft'   // the panel, judging a draft
  | 'write'         // every writer: draft, revise, chat, synthesize, channel cuts
  | 'final_pass'    // the ship-moment check
  | 'publish_check' // a mechanical check before approval or publication
  | 'visual'        // pages, Shorts and carousels
  | 'production'    // finishing a recorded video: enforced by the tools, read by no prompt

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

/** One series line: said first in every video script of its series. */
export interface SeriesOpener { day: string; series: string; line: string }

// The three series lines (house rule SERIES_OPENER), in one place for every
// tool: scripts/post-pack/story_check.py reads the object between the two
// marker lines below as JSON, so it stays JSON (double quotes, no trailing
// commas) and keeps its markers. Krish, 2026-10-12, picked each line.
// RETIRED from scripts as of 2026-10-21 (Krish: "we need to cut that opening
// line from every content piece moving forward and just launch straight in"):
// no writer opens on these and no check asks for them. They stay, unchanged,
// because records and history made under them refer to them.
// SERIES_OPENERS:BEGIN
export const SERIES_OPENERS: Readonly<Record<string, SeriesOpener>> = Object.freeze({
  "follow_the_money": { "day": "Monday", "series": "follow.the.money", "line": "I've been following how money is changing because of AI. I'm Krish." },
  "under_the_hood": { "day": "Wednesday", "series": "under.the.hood", "line": "I've been looking at what's really inside the AI everyone's selling us. I'm Krish." },
  "mind_the_gap": { "day": "Friday", "series": "mind.the.gap", "line": "I've been keeping a beady eye on what's coming with AI, before everyone notices. I'm Krish." }
})
// SERIES_OPENERS:END

/** The line a video script of this series opens with. Always null since
 *  2026-10-21: the series line is retired from scripts (house rule
 *  SERIES_OPENER), so no writer opens on one. */
export function seriesOpener(_series?: string | null): string | null {
  return null
}

/** The line a script recorded before 2026-10-21 opened with, for history and
 *  tools that read old records. Nothing writes or requires it. */
export function retiredSeriesOpener(series?: string | null): string | null {
  const hit = series ? SERIES_OPENERS[series] : undefined
  return hit ? hit.line : null
}

/** The mechanical half of the reading-age gate on a video script (house
 *  rule R7). */
export interface ScriptReading { max_sentence_words: number; max_average_words: number; max_grade: number; max_quote_words: number; jargon: string[] }

// The reading-age gate's numbers and its grown-up words, in one place:
// scripts/post-pack/story_check.py reads the object between the two marker
// lines below as JSON and refuses a script that breaks any of them, so it
// stays JSON (double quotes, no trailing commas) and keeps its markers.
// Krish, 2026-10-12: "Every single script should be understandable by a
// 12-year-old."
// SCRIPT_READING:BEGIN
export const SCRIPT_READING: Readonly<ScriptReading> = Object.freeze({
  "max_sentence_words": 20,
  "max_average_words": 12,
  "max_grade": 6,
  "max_quote_words": 4,
  "jargon": [
    "licensing", "licence", "licences", "licensed", "license", "licenses", "litigation", "complaint", "complaints",
    "plaintiff", "plaintiffs", "settlement", "settlements", "revenue", "revenues", "royalty", "royalties", "token", "tokens",
    "model", "models", "default", "defaults", "infrastructure", "monetise", "monetised", "monetising", "monetize",
    "monetized", "monetizing", "margin", "margins", "subsidy", "subsidies", "inference", "compute", "API", "APIs",
    "fair use", "copyright", "copyrighted", "copyrights", "damages", "statutory", "valuation", "valuations", "equity",
    "stakeholder", "stakeholders", "leverage", "ecosystem", "ecosystems", "paradigm", "paradigms", "framework",
    "frameworks", "scalable"
  ]
})
// SCRIPT_READING:END

const JARGON_LIST = SCRIPT_READING.jargon.join(', ')

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
    text: 'When a mechanism is unfamiliar, add a real historical parallel, a familiar analogy or a comical exaggeration that makes the point easier to grasp. Make the comparison visibly a comparison, keep the underlying fact exact, and remove it if it changes what happened. The analogy and the exaggeration live in the video scripts, where Krish explains casually; an article uses a real parallel or a worked example, with at most a brief comparison, and a picture never acts one out (ANALOGY_IN_SCRIPTS_ONLY).',
    said: 'We should also add parallels (when this has happened before), analogies to things people will relate to, or comical exaggerations to make the point where it does not distort fact. Then, 2026-10-16: The analogies should only be in my casual narrative explanation style.',
    on: '2026-10-03', source: 'workbench reply on piece 1; narrowed to the scripts on 2026-10-16 (ANALOGY_IN_SCRIPTS_ONLY)', status: 'live',
    stages: ['judge_draft', 'write', 'final_pass'],
  },
  {
    id: 'R7', name: 'Reading age 12, with humour',
    text: `Write for a reading age of 12: short sentences, everyday words, and real humour and personality. The joke points at the hype, never the reader, and never replaces the finding. Every video script must be understood by a smart, non-technical manager at a 200-person company hearing it once (Krish, 2026-10-19: "My customers are medium sized enterprises. This script is 20% too dumbed down", then "agree on all 4"), and a hard gate holds it to that before it is recorded, packed or sent: no spoken sentence over ${SCRIPT_READING.max_sentence_words} words; at most ${SCRIPT_READING.max_average_words} words a sentence on average; a reading grade of ${SCRIPT_READING.max_grade} or less; no quotation longer than ${SCRIPT_READING.max_quote_words} words (a quote cannot be heard as one, and it brings in grown-up language: say it in plain words); and none of these words unless the same sentence says what it means in plain words: ${JARGON_LIST}. Then two fresh readers, each an ordinary 12-year-old hearing it once, must find nothing that loses them, and their retellings must match the script's point.`,
    said: 'This entire media channel needs to be radically simplistic with an average reading age of 12 and a huge sense of humour and fun and personality. Then, 2026-10-12, of the scripts on his teleprompter: I also feel like these scripts are too complicated for a layman to understand. Every single script should be understandable by a 12-year-old. I can\'t even understand what I\'m reading off the teleprompter. I thought we had hard gates for this?',
    on: '2026-09-25', source: 'walk log R7; the hard gate on every script (2026-10-12): scripts/post-pack/story_check.py reads SCRIPT_READING in this file and refuses a script that breaks it, then make-piece\'s two read-back readers, recorded on the making record\'s script check (read_back)', status: 'live',
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
    text: 'Every piece ends with our prediction: what will happen, a date to check it by, and how sure we are as a percentage. It is ruled right, wrong or too close to call in public on that date, and the wrong ones go up as big as the right ones. Write it as a last section headed "## OUR PREDICTION": one paragraph that opens with the date ("By 30 June 2027, ..."), then a line on its own, "How sure we are: 75%." The Short shows that call word for word, so give one date and one whole percentage.',
    said: 'I want these to be signature bulletproof formats that can run across any article FYI, if they are going in, they need to go in for everything.',
    on: '2026-09-25', source: 'docs/CREATIVE_IDENTITY_UPGRADE.md (P6); makeyourmindup.ai, "Every piece makes a call. We keep score."', status: 'live',
    stages: ['judge_idea', 'judge_draft', 'write', 'final_pass', 'publish_check'],
  },
  {
    id: 'CLEAR_STANCE', name: 'Take a clear stance',
    text: 'Our prediction takes a clear stance. Back the outcome we believe with a confident number, 80% or more; anything lower reads as sitting on the fence, and the publish check refuses it (Krish, 2026-10-19).',
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
    stages: ['write', 'final_pass'],
  },
  {
    id: 'NO_EM_DASH', name: 'No em dashes',
    text: 'No em dashes anywhere. Use commas, full stops or brackets.',
    said: 'No em dashes. No exclamation marks.', on: '2026-09-25', source: 'makeyourmindup brand book v1.0; voice doctrine', status: 'live',
    stages: ['write', 'final_pass'],
  },
  {
    id: 'BRITISH_SPELLING', name: 'British spelling',
    text: 'Use British spelling: colour, centre, theatre, organise, analyse, defence, labour, modelling, travelled, grey. A quotation and a name keep their own spelling.',
    said: 'Just get in line with what those updates are at the live website.',
    on: '2026-09-26', source: 'makeyourmindup.ai, "Contains British spelling" (live 2026-09-26)', status: 'live',
    stages: ['write', 'final_pass'],
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
    id: 'THREE_LENSES', name: 'What it means for the consumer, for the builder, and how the old way is changing',
    text: 'Every piece answers three questions in plain words, each in its own section or beat, from checked facts with our reads labelled: what this means for the consumer (the person who buys, watches or uses the thing); what it means for someone starting or building a business; and how the old way of doing things is changing, both creatively and in who gets paid. The video script and the social posts carry all three too. A piece that leaves one out is not finished.',
    said: 'Always always make sure, like the last piece we released, we talk about: what this means for the consumer / what this means for someone starting a business or building a business / how the paradigm is shifting from the way things have typically been done in this world, creatively and economically',
    on: '2026-10-06', source: 'chat, the Higgsfield piece for under.the.hood', status: 'live',
    stages: ['judge_draft', 'write', 'final_pass', 'visual'],
  },
  {
    id: 'LOGOS_AND_FACE', name: 'Real logos, and Krish\'s face on the cover',
    text: 'Show the real logo of every company a visual names, taken from the company\'s own brand files (Brandfetch), never redrawn or imitated, in its own colours where they read and in its light version on dark. Put Krish\'s face on the cover and on the social share picture, one of his funny headshots, so the reader sees him taking the subject apart: scripts/pages draws the cover site\'s "closer look" photo with "portrait": true in the cover\'s facts.',
    said: 'Once again don\'t be afraid to use the real logos for any companies mentioned. And even one of the funny headshots on the cover pictures or social share pictures like this that make it even more personal that it\'s me analysing it',
    on: '2026-10-06', source: 'chat, the Higgsfield piece for under.the.hood', status: 'live',
    stages: ['visual'],
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
    text: 'A visual exists only to make one critical point of the piece land faster than the words can. Before making one, write that point in one sentence and the reader\'s question it answers. Build it from the piece\'s real, checked numbers, quotes and evidence, and show the mechanism or the comparison that carries the point. Show the actual product, the way a genuine review does: real screenshots of the apps and their settings, and charts of real statistics from a named source, each labelled with what it measures, its scale and which way is better. Never decorate: no figures walking to boxes, no icons acting out an analogy, no motion that adds nothing the words already said. Test: a reader who sees only the visual understands the point. If it fails, cut it.',
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
    text: 'Design every image for the places Substack shows it. The cover is 1200 x 800 (3:2), with every word and logo inside x 220 to 980 and y 84 to 716: the phone feed shows the whole cover, and that box is the part the 16:9 share card and the square archive tile also keep. A phone shows every image about 358 pixels wide: the cover in the feed, and each image inside the article, which Substack keeps whole and shrinks to fit. So every word a reader needs must come out at 14 pixels or more there, and fine print such as sources at 11 or more: on the 1200-wide cover, draw words at 47 pixels or more and fine print at 37 or more; on a 1360-wide image, 54 and 42. Never put more words in an image than a phone can read; put the rest in the article. Outlook and many work inboxes hide every picture from a sender the reader has not trusted yet and show its alt text instead, so each picture\'s alt text says its point in one plain sentence, and the post makes sense with the pictures off. Before publishing, look at the cover\'s crop preview, at every image at phone width, and at the email with pictures off.',
    said: '"Also bear in mind what happens to your artwork when I\'m looking at the article in Substack once it\'s posted.", then, 2026-10-06, of a subscriber\'s Outlook showing the launch email with no pictures: "is there any way around this?"',
    on: '2026-10-05', source: 'chat, article 1 on Substack; walk log F64 and F66 (docs/walks/2026-09-three-piece-walk.md); checked by scripts/pages', status: 'live',
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
  {
    id: 'FOR_THE_EAR', name: 'A script makes sense out loud',
    text: 'A video script is written to be said, and heard once. Never cut it from the article\'s headings or section labels. Say what the thing is before taking it apart. Explain every number the moment it is said: what it means and why it matters. Never speak a label the listener has not heard explained ("the chooser", "the engines", "REAL, with small print"). Read it aloud; any sentence that needs a second pass is rewritten.',
    said: 'I can\'t even say it out loud as it confuses the hell out of me reading it. Then: they need to actually make sense to humans. That is kind of important.',
    on: '2026-10-06', source: 'walk log F75', status: 'live',
    stages: ['judge_draft', 'write', 'final_pass'],
  },
  {
    id: 'STORY_ARC', name: 'One story, start to finish',
    text: 'Every piece and every script tells one story. Open on one clear question, in plain words. Every section or beat either sets that question up or answers it, and each one follows from the last. Set up every claim before judging it: say what was claimed and why it matters before stamping it real or theatre. Every takeaway follows from something already told. The ending answers the opening question, then makes the call. A spoken script of a minute or more then closes as SCRIPT_CLOSE says, after the call: what Krish would do with this info, then where the full deep dive is; it never ends on the number.',
    said: 'what does that mean? We\'ve never introduced that concept yet, and I dont get why it matters to whats been said thus far. It also barely connects to the next bits, the takeaways. ... now it just ends randomly on 85%, with nothing after that, no outro. Then, of the five-point story check: yes, i agree with it being there. happy with that idea.',
    on: '2026-10-06', source: 'walk log F75', status: 'live',
    stages: ['judge_draft', 'write', 'final_pass'],
  },
  {
    id: 'BIG_PICTURE', name: 'The big picture, never the small headline',
    text: 'Every piece is about the big, lasting shift, never one small, temporary news headline. A headline of the week (a report, a price change, a launch) is evidence inside the bigger story, one section at most, and never the story itself. Before choosing an angle or a title, name the bigger pattern it belongs to and lead with that; if a draft would be out of date in a month, it is about the headline and must be reframed.',
    said: 'I think the story is bigger - it\'s story I asked for about why there are so many models now, and what that actually means. ... The $20/5X the AI is a sub story within that bigger story. We need to always focus on the bigger picture, never the one small picture temporary news headline - make sure you ALWAYS remember this',
    on: '2026-10-09', source: 'the Friday workroom, his own words on the angle card', status: 'live',
    stages: ['judge_idea', 'judge_draft', 'write', 'final_pass'],
  },
  {
    id: 'VOICE_ON_CAMERA', name: 'The script is Krish reacting, with opinion and dry wit',
    text: 'The article states the facts. A video script is Krish reacting to them, in his own voice, with opinion and humour. A script of a minute or more carries at least three of these five: one dry, self-deprecating line about himself or this publication (never that it is made with AI or with Claude: NO_AI_DISCLOSURE_LINE); one sarcastic line aimed at the hype, never at the reader or a named person; one exaggeration made obvious by its size; one analogy a twelve-year-old would get; and one opinion said as opinion ("I reckon", "I think", "my call": on camera he turns "my bet" into "I reckon", SCRIPT_AS_HE_TALKS), kept apart from the checked facts so the listener and the fact gate both know which is which. A joke never sits inside a sentence the fact gate holds and never replaces the finding. Offer two options for each joke as a choice beside the script, never inside it; cutting them is Krish\'s.',
    said: 'What about making my scripts for video have more personality and opinion, not in a factual way? More humor? Self deprecating dry wit, sarcasm, exaggeration, analogy? Then, of the proposed rule: do all the things you suggested. Then, 2026-10-12, of the self-deprecating line about making it with Claude: Eliminate the "I made this with AI" entirely - no need, it\'s like verbal diahorrea. Then, for every script: correct, make that a rule.',
    on: '2026-10-09', source: 'chat, planning piece 2 and the 100x plan (docs/ENGINE_100X.md); the made-with-Claude example cut on 2026-10-12 (NO_AI_DISCLOSURE_LINE); checked softly by storyArcIssues\' companion voiceOnCameraIssues and scripts/post-pack/story_check.py', status: 'live',
    stages: ['judge_draft', 'write', 'final_pass'],
  },
  {
    id: 'NO_AI_DISCLOSURE_LINE', name: 'No line saying it was made with AI',
    text: 'A script, a piece or a post never says that it, the video or the publication was made with AI, with Claude or with any other model ("I made this with Claude\'s help", "this video was made with AI"). It adds nothing for the viewer. A self-deprecating line is about something else.',
    said: 'Eliminate the "I made this with AI" entirely - no need, it\'s like verbal diahorrea. Then, for Friday\'s script and every script: correct, make that a rule.',
    on: '2026-10-12', source: 'his workroom picks for Monday\'s piece, then Friday\'s (commits dd43765 and 39e08c6, which cut the line from both 3-minute scripts); checked softly by scripts/post-pack/story_check.py and voiceOnCameraIssues (packages/core/src/editorial.ts)', status: 'live',
    stages: ['judge_draft', 'write', 'final_pass'],
  },
  {
    id: 'SCRIPT_ONLY', name: 'A script is only the words Krish says',
    text: 'A video script handed to Krish is only the words he says, in the order he says them, as plain paragraphs. Nothing else goes in it: no stage directions or "on screen" notes, no beat numbers, headings or timings, no joke alternatives, no notes to him, and no lines that talk about the script instead of the subject ("here is what you are looking at", "now the part that matters"). What goes on screen lives in a separate shot list, and joke options are offered as choices beside the script.',
    said: 'make sure my video scripts are literally just scripts without all the excess internal monologue commentary (forever)',
    on: '2026-10-09', source: 'chat, Friday piece 2 script review; checked by scripts/post-pack/story_check.py', status: 'live',
    stages: ['write', 'final_pass'],
  },
  {
    id: 'VISUAL_EVIDENCE', name: 'Real logos, real pages, and a cover with personality',
    text: 'Every picture and every video frame that names a company shows that company\'s real logo, from its own brand files (Brandfetch), and all of them when the piece is about several (every AI lab, every bank). A piece about volume or velocity (so many launches, releases every few months, a growing menu) shows the real thing: screenshots of the actual pages, dated, piled on top of one another so the reader feels the overwhelm, never a drawn stand-in. The cover is drawn by the house cover drawer with the wordmark, Krish\'s face, the real logos and the evidence behind it, in the house colours and type, never a flat card. A plan for any visual starts by listing the companies it names and the real artefacts it can show.',
    said: 'we need to add all the logos of the busineses that are related to what we are talking about. Sometimes, that is just one business - but here, it\'s all the LLMs. This needs to be considered in every post possible. ... an article like this should screenshot as many live articles of model releases ... it should pile up on top of one another visually. That kind of visual creative thinking has to apply to every video moving forward. I also think The cover and email thumbnail is really boring and losing it\'s personality ... it needs to be a literal gate that stuff like this cannot be produced, whether in static asset form or video.',
    on: '2026-10-10', source: 'chat, Friday piece 2 cover review; the mechanical gate is scripts/post-pack/visual_gate.py (logos, evidence pages, the cover drawer\'s receipt), run by build.py before any pack', status: 'live',
    stages: ['visual', 'write', 'judge_draft'],
  },
  {
    id: 'HOOK_AND_CTA', name: 'Open on a provocation, close on the article',
    text: 'A video opens straight on the hook (SERIES_OPENER): the most provocative true thing in the piece, said in the first two sentences, such as what Krish did ("I put GrokBot and Muse head to head"), a surprising number, a comparison or a claim that makes the viewer feel they are missing something, then the one question the video answers. It never opens on a series line, a greeting, throat-clearing or a definition. It closes as SCRIPT_CLOSE says: "Here\'s what I\'d do with this info if I were you", the actions, and then the last sentence, "The full deep dive is at makeyourmindup.ai.", said out loud so the line works on every channel without "link below". No question for the comments and no sign-off. The vertical cut keeps both, inside 90 seconds.',
    said: 'make the intro more provocative and hooking, and the outro more CTA based, acknowledging there is a full article. Then, 2026-10-21: "we need to cut that opening line from every content piece moving forward and just launch straight in to "I put GrokBot and Muse head to head" etc. Also trim the closing to "the full deep dive is at makeyourmindup.ai." right after a "Here\'s what I\'d do with this info if I were you" closing line. That needs to be the format moving forward for all scripts."',
    on: '2026-10-09', source: 'chat, Friday piece 2 script review, then the 2026-10-21 ruling; checked by scripts/post-pack/story_check.py', status: 'live',
    stages: ['judge_draft', 'write', 'final_pass'],
  },
  {
    id: 'SERIES_OPENER', name: 'Scripts open straight on the hook: no series line and no "I\'m Krish"',
    text: 'A video script opens straight on the hook, with what Krish did or found ("I put GrokBot and Muse head to head"). It has no series line before the hook, no greeting, and no "I\'m Krish" anywhere, opening or close. This holds for every series, the 5-minute, the 90-second and the deep cut. The three old series lines (SERIES_OPENERS in this file) are retired and kept only because records made under them refer to them: no writer opens on one and no check asks for one. The article and the posts never carried it.',
    said: 'we need to cut that opening line from every content piece moving forward and just launch straight in to "I put GrokBot and Muse head to head" etc. (2026-10-21; it retires the series line he asked for on 2026-10-12: "We need something catchy at the start of a video script like "Here\'s what you need to know about how money is changing because of AI. I\'m Krish." at the start of follow.the.money videos." Then he picked the Wednesday and Friday lines, and "Drop it at the end" for the sign-off (2026-10-12); the "Reflective version" (2026-10-13); and rewrote the mind.the.gap line as "I\'ve been keeping a beady eye on what\'s coming with AI" (2026-10-16).)',
    on: '2026-10-21', source: 'chat, the 2026-10-21 ruling on every script; the writer opens on the hook (api/_video.ts SCRIPT_OPENING); scripts/post-pack/story_check.py no longer asks for a series line (series_problems) and still accepts --series; the old lines stay in SERIES_OPENERS for history', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
  },
  {
    id: 'SCRIPT_CLOSE', name: 'Every script closes on what he would do, then the deep dive line',
    text: 'Every video script of a minute or more closes in two parts. After the call comes a beat that starts exactly "Here\'s what I\'d do with this info if I were you" and then says, in plain words, the concrete things the listener can do. The script\'s final sentence is exactly "The full deep dive is at makeyourmindup.ai." with nothing after it: no sign-off, no "I\'m Krish", no question for the comments, no ask to like or subscribe. Both cuts carry it, and the deep cut too. scripts/post-pack/story_check.py refuses a script that has no such beat in its last three beats, or that ends on any other sentence.',
    said: 'Also trim the closing to "the full deep dive is at makeyourmindup.ai." right after a "Here\'s what I\'d do with this info if I were you" closing line. That needs to be the format moving forward for all scripts.',
    on: '2026-10-21', source: 'chat, the 2026-10-21 ruling on every script; checked by scripts/post-pack/story_check.py (close_problems), which build.py and making.py scripts run before a script is packed or recorded; the writer closes on it (api/_video.ts SCRIPT_CLOSE)', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
  },
  {
    id: 'TWO_CUTS', name: 'A five-minute video and a ninety-second one',
    text: 'Every piece gets two videos, each recorded from its own script with its own hook and its own outro. The long cut is about five minutes: 675 to 825 spoken words at an unhurried 150 a minute, wide, for the Substack post and YouTube. The short cut is at most 90 seconds: 160 to 225 spoken words, tall, for YouTube Shorts, TikTok and Instagram Reels. Both keep the hook and the call to action (HOOK_AND_CTA). Material that does not fit is cut, never spoken faster.',
    said: 'I always want a 3-minute video and a 90-second version. I always want to repost to YouTube and then Shorts, TikTok, and Instagram. Then, 2026-10-19: "from here moving forward, let\'s make the 3-minute scripts into 5-minute scripts and videos. Scrap the 3-minute format in favor of the 5-minute format."',
    on: '2026-10-19', source: 'chat, weekly planning; checked by scripts/post-pack/story_check.py (the cut lengths)', status: 'live',
    stages: ['write', 'final_pass'],
  },
  {
    id: 'FEATURE', name: 'A 15-minute feature, only when Krish calls one',
    text: 'Every piece is a 90-second and a 5-minute video (TWO_CUTS). From time to time Krish calls a special feature for one piece: about 15 minutes, 2,025 to 2,475 spoken words, wide, recorded as a third cut beside the other two, for YouTube long-form and Spotify, and written from the full article for the ear, opening straight on the hook (SERIES_OPENER), at reading age 12, and closing as SCRIPT_CLOSE says. Only he calls one; no session proposes one each week. His call is recorded in config/features.json. It replaced the weekly 8 to 12 minute deep cut (DEEP_CUT, 2026-10-14 to 2026-10-21); deep cuts already recorded in config/deep-cuts.json stay as they were.',
    said: 'Bear in mind that all videos are generally 90 sec and 5 min. From time to time I might do a special 15 min feature. Asked whether that replaces the weekly deep cut: "Yes, replace it".',
    on: '2026-10-21', source: 'chat, standardising the publish board; checked by scripts/post-pack/story_check.py (--cut feature) and shown by week_board.py (config/board-layout.json cuts)', status: 'live',
    stages: ['write', 'final_pass', 'production'],
  },
  {
    id: 'INTRO_STING', name: 'A short animated makeyourmindup sting before Krish\'s face',
    text: 'Every video is to open with the animated makeyourmindup sting, 1 to 2 seconds (1.5 by default), before Krish\'s face comes in, in both shapes and in the colour of the piece\'s series (follow.the.money\'s when it has none). It is joined in front of the captioned video, so no word, caption or graphic moves, and the music is up over it. Only a design Krish approved in words is used (config/intro-sting.json, status "approved", bound to the source hash of the exact previews he saw). No design is approved yet: on 2026-10-12 he rejected the first one shown to him ("it\'s ok, it\'s a bit boring and colourless and vanilla - and just what Powerpoint would do in 2008"), so until he approves another, every cut goes without a sting, its report says so, and a missing sting never stops a render. A clip named in a cut\'s config is used only when it is the approved render, or on Krish\'s own words in "intro_override". For the quick-edit cuts this replaces "nothing at the opening" (2026-09-26); the Studio keeps that placement, with no music, until its own audio ledger exists.',
    said: 'I also want the video to have a 1-2 sec animated make your mind up intro visual before my face comes in',
    on: '2026-10-12', source: 'chat, the video production request, then his word on the first design (config/intro-sting.json, "last_decision"); made by scripts/quick-edit/intro.py and make.py, the approval in config/intro-sting.json', status: 'live',
    stages: ['production'],
  },
  {
    id: 'MUSIC_BED', name: 'Licensed music under every video: up for the intro, low under Krish, up for the outro',
    text: 'Every video carries a licensed music bed: high over the intro, low while Krish is talking, higher over the outro. Only a track in the music ledger (config/music-library.json) that Krish approved in his words, whose licence is in date and covers every place the cut is posted, cleared for YouTube Content ID, is ever used. The files live in Drive at makeyourmindup > 00_Brand-Assets > 07_Music (MINDMAKE_MUSIC_ROOT), and nobody browses Drive for audio. The levels are about -16 LUFS over the intro, about -31 under his voice (about 17 LU below it) and about -18 over the end card, ramping down over half a second as his face comes in and up over 0.8 seconds after his last word; the whole mix then finishes at -14 LUFS integrated with true peak at most -1 dBTP, measured after the encode. The levels stay proposed until he approves them by ear. With no approved track, a cut has his voice only and its report says so.',
    said: 'I am also going to get some licensed audio to put behind my videos, so help me prepare to put it somewhere you and codex will always know where that is, and use it correctly (high volume during the intro, low whilst I am talking, higher during the outro). Then, of makeyourmindup > 00_Brand-Assets > 07_Music: thats where it will live and the video runners need to know this',
    on: '2026-10-12', source: 'chat, the video production request; mixed by scripts/quick-edit/make.py with music.py, the ledger config/music-library.json', status: 'live',
    stages: ['production'],
  },
  {
    id: 'THUMBNAIL_EVERY_SIZE', name: 'A thumbnail for every video size, every time',
    text: 'Every video comes with its own thumbnail, every time: 1280 x 720 for the wide 16:9 cut (YouTube and the Substack video) and 1080 x 1920 for the tall 9:16 cut (the cover on Reels and TikTok), drawn by the house cover drawer from the piece\'s cover facts, with Krish\'s face and the real logo of every company the piece names (LOGOS_AND_FACE), inside each platform\'s safe area. A cut without the thumbnail of its shape is not packed, and its Video assets step is not done; only Krish\'s own words in "thumbnail_override" let a pack through without one.',
    said: 'I always want a video thumbnail for all video sizes produced as an asset every time.',
    on: '2026-10-12', source: 'chat, the video production request; drawn by scripts/pages/build.py --thumbs, required by scripts/post-pack/build.py and scripts/post-pack/visual_gate.py and by the Video assets step (apps/control-plane/api/_making.ts)', status: 'live',
    stages: ['production'],
  },
  {
    id: 'STORY_INTRO_OUTRO', name: 'An animated intro made for each story, its audio treatment, and an animated outro card, in every format',
    text: 'Every video, in every format (the 16:9 long cut and the 9:16 short cut), opens with a proper animated, branded intro made for that specific story, carries a designed audio treatment, and closes on a proper animated outro card made for that piece. Design comes first: the designs are shown to Krish and only his words approve one (krish-design). Until then no cut is finished: its report says "story intro and outro not designed yet", and production stops before the final render.',
    said: 'when the videos come back bear in mind that I want a proper animated branded intro to this specific story visually, the audio treatment, and then a proper animated outro card. Across all formats, and this should be part of the system moving forward.',
    on: '2026-10-12', source: 'chat, as Monday\'s takes came back; held by .agents/skills/produce-video (the required step before the final render), which reads config/story-intro-outro.json, status "awaiting_design" until he approves a design', status: 'live',
    stages: ['production'],
  },
  {
    id: 'ARTICLE_LENGTH', name: 'Articles about 30% shorter: about 1,400 words at most',
    text: 'An article (the Substack piece) runs about 1,000 to 1,400 words, never more than 1,400: about 30% shorter than the roughly 2,000-word pieces of 12 October. Cut by keeping one argument and its strongest evidence, never by thinning every paragraph: drop the second example, the recap and the throat-clearing first.',
    said: 'moving forward the articles need to be about 30% shorter.',
    on: '2026-10-12', source: 'chat, after Monday\'s piece (about 2,000 words) went to his publish board', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
  },
  {
    id: 'SHARP_PREDICTION', name: 'A near-term prediction we back, that a reader can check',
    text: 'Every prediction names one specific event that a reader can check on a stated date no more than about three months away (92 days; the publish check CALL_HORIZON refuses a later one). It is what we believe will happen next, given the piece\'s own evidence, backed at 80% or more (CLEAR_STANCE refuses less). It must not already have happened. Never a long shot pushed a year out to look bold, and never a middling number. A vague trend ("more deals", "more options") is never a prediction.',
    said: 'The current one feels pretty obvious that its going to happen in hindsight. (2026-10-12.) Then, 2026-10-19, after changing Monday\'s call to 95% by the end of 2026 as he recorded it: "I\'m done with sitting on the fence and putting predictions a year away: 55%. There\'s no point in that. Given how this article reads it\'s pretty obvious someone\'s going to shift their price again in the next month."',
    on: '2026-10-19', source: 'chat, on Monday\'s prediction (Universal or Sony make a deal with Suno by 31 December 2027, 70%)', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
  },
  {
    id: 'TITLE_EARNS_THE_CLICK', name: 'Every title earns the click, from the piece, never from nothing',
    text: 'Every title a reader sees first (the article title, the YouTube and Shorts titles, the cover headline, the video title card and every picture\'s heading) makes someone think "I need to read that". It names who did what, or gives the number that surprises, taken from the piece\'s own checked words. Never a straw man (knocking down a claim nobody made: "X isn\'t Y", "X vs Y isn\'t a fair fight", "X isn\'t just Y"), never the obvious, never a bare topic label ("Three kinds of AI", "Whose side is it on?"), never a stock phrase (explained, here\'s why, everything you need to know, the truth about). scripts/post-pack/title_check.py is the floor. What is good is what Krish picks: every title goes to him as a few options written against the lessons of his past picks (config/title-verdicts.json: first person, a question mid-title, a payoff that points at the reader, short with the surprise last), and is used only once he has picked it; video_card.py, publish_manager.py, the cover drawer and story_io.py refuse any other.',
    said: 'no one has ever said "Muse versus ChatGPT" is a fair fight! The titles can\'t be boring, but they also can\'t just be made from nothing. Of course, Muse isn\'t ChatGPT. That\'s a stupid thing to say. It\'s dumb. We need an anti-dumb filter. We need titles that people will go, "Oh, I need to read that. That\'s going to be awesome." ... this sort of crap cannot be allowed to pass in the future, ever',
    on: '2026-10-14', source: 'chat, on Wednesday\'s title and card headings ("Muse isn\'t ChatGPT", "Muse vs ChatGPT isn\'t a fair fight"); he liked "Muse\'s real rival: Siri."', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
  },
  {
    id: 'ONE_SPINE', name: 'One spine: every section answers the one question',
    text: 'Every piece answers ONE question, its spine, approved by Krish at the outline with its one-line answer. The outline states "Spine: <question>?", "Answer: <one line>" and at most six sections, each as "<HEADING> | proves: <the part of the answer it proves>"; the draft\'s sections are exactly those, in that order, plus the closing "3 things you can do tomorrow" section (THREE_THINGS_TOMORROW), which is not an outline section and is not counted in the six. Every section must help the reader reach the spine\'s answer: a section that is true, interesting or related but answers a different question is cut. A new angle is a new spine and a new outline from scratch, approved again, never sections added on top of an approved outline. scripts/post-pack/spine_check.py checks the outline and the draft\'s sections; the engine\'s judge (POST /api/content-ideas/:id/spine-check) reads every section against the spine; making.py refuses scripts and the publish page until both pass on the current words.',
    said: 'I also think we ended up with an absolute ton of drift here. We were supposed to be scoring Muse and Siri, then we started talking about Apple and Walmart, then we started talking about ads, but then we have content about the three different types of AI. All of this could have been turned into something coherent, but it\'s ended up sprawling quite a lot. I\'m not sure why that is, but the engine cannot do this again.',
    on: '2026-10-14', source: 'chat, on Wednesday\'s Muse piece, re-angled five times with each angle added as sections; then "Build out number 3 to sort out the drift"', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
  },
  {
    id: 'SOUNDS_LIKE_KRISH', name: 'Sounds like Krish, not like a machine',
    text: 'Write the way Krish talks, with his own view and his own details, and none of the habits of machine prose: no run of paragraphs that open the same way (at most three bold lead-ins), no formula on repeat ("My read:" and the like), no stock phrases (delve, landscape, navigate, seamless, unlock, heavy lifting, plainly, the reality is), no "it\'s not X, it\'s Y", no lists of three again and again, no question answered at once by the next line, no colon reveal ("Here\'s why:"), no neat signposting ("Two limits. First... Second..."), no closing recap, no em dash. Sentences vary a lot in length; some paragraphs are one line. "I" and "my" carry his view: a moment from his own work, what he did, what he would do. Contract the way he talks, outside quotes: "it\'s", "don\'t", "you\'re", "I\'d", never "it is", "do not", "you are", "I would", and use the everyday shortcuts a person types (vs, eg, "a bit", "honestly", "pretty much"), so no AI-writing scan flags it. Then the scanner habits: no chat-model vocabulary (significant, comprehensive, foster, ensure, insights, ultimately and the rest), no paragraphs glued with "However" or "Additionally", no ", making it..." tails, no "not only... but also", no explainer tics ("think of it as", "here\'s the question"), not every sentence a comfortable 12 to 24 words: some fragments of five words or fewer, a bracketed aside or an open question every few hundred words, and names, numbers and dates throughout. Two gates, both before the fact gate: scripts/post-pack/voice_check.py (bar 6) and scripts/post-pack/ai_scan.py, which reads the piece with a language model and fails it when it is as predictable as machine prose, naming the sentences to rewrite.',
    said: 'And they get flagged as 93% AI generated, can we do anything about this? ... build the sounds like Krish pass now. Then: the article MUST not trigger AI written scans either - you need to bake this in and figure out how to add humanisms in there, abbreviations, "you\'re" instead of "you are". Then: we need more aggressive anti AI scanning techniques by 10X',
    on: '2026-10-13', source: 'chat, on Monday\'s and Friday\'s articles; checked by scripts/post-pack/voice_check.py', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
  },
  {
    id: 'PERSONAL_INTRO', name: 'The script opens the way Krish would',
    text: 'A script opens the way Krish talks, straight on the hook with no series line before it (SERIES_OPENER): what he has been doing with the thing, why it matters in plain words, and that he wants to break it down for you. On 2026-10-21 he gave the shape of the very first words: "I put GrokBot and Muse head to head". His own example (config/golden-examples.json): "I\'ve been having a little play around with Muse, Meta\'s new personal assistant. It\'s an important evolution in how AI is going to come into our personal lives, and so I wanted to break it down for you." Then, before anything else, say why this thing is different from what the viewer already uses (for Muse: why not just ChatGPT or Claude). Krish, 2026-10-13: "it doesn\'t introduce why Muse is different to just using Claude". Name every actor and every thing on every line: never "the company" or a bare "it" that the ear has to work out ("Who is \"the company\"? What is \"It\"?"; both are in config/rejected-lines.json). Never open on a fact out of context, a news-reader line or an anecdote with no set-up; the example comes after the intro. Only say he has used something when he has said so.',
    said: 'I think these scripts need to be a little sharper on the intro as well. The first line should be more like something like: "I\'ve been having a little play around with Muse Meta\'s new personal assistant. It\'s an important evolution in how AI is going to come into our personal lives, and so I wanted to break it down for you." Thats something I would actually say, how can you redo todays scripts and then log that for the future?',
    on: '2026-10-13', source: 'chat, on Wednesday\'s Muse scripts; his line is the first entry in config/golden-examples.json; checked softly by scripts/post-pack/story_check.py', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
  },
  {
    id: 'ONE_THREAD', name: 'A script follows one line of thought',
    text: 'A video script is one line of thought, never a list of facts. It opens on a puzzle Krish noticed, asks the one question it answers, follows the clues in the order they lead, lands one insight of his own said as an idea (Wednesday 14 October: "the ad doesn\'t need your eyes any more, it needs your helper\'s choice"), then what it means and the prediction. Every beat leads to the next with "so", "but", "now think about": a viewer can say why each line follows the one before. Plain words for a 12-year-old (R7) are applied to that thread, never by chopping it into separate facts; when a reading-age fix breaks the flow, rewrite the beat, do not delete the link.',
    said: 'these video scripts are absolute garbage in terms of making any sense - the quality has deteriorated drastically in terms narrative flow, unique insight',
    on: '2026-10-13', source: 'chat, on Wednesday\'s Muse scripts after four rounds of reading-age fixes', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
  },
  {
    id: 'REFLECTIVE_VOICE', name: 'Reflective, not breaking news',
    text: 'Krish sounds like someone thinking out loud about what he has noticed, never a newsreader. Open from curiosity ("I keep noticing...", "Something odd is going on with..."), walk the viewer or reader through what he is seeing, the way Johnny Harris does: a question he could not shake, the evidence turned over slowly, his own doubt said out loud, then where he has landed. The wit stays dry and quiet, a raised eyebrow, never a punchline shouted. No urgency words (breaking, huge, insane, you need to know), no announcer cadence, no stacking of short punchy lines for drama. Applies to every script and every article.',
    said: 'I also want to reduce the "breaking news, I\'m Krish" tone, and have it be a more reflective, pensive, "here\'s what I\'m seeing" but still humorous dry wit tone. Johnny Harris style',
    on: '2026-10-13', source: 'chat, on Wednesday\'s Muse scripts', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
  },
  {
    id: 'PLAIN_SCORES', name: 'No score without something to measure it against',
    text: 'Never give a reader or a viewer a bare score: a benchmark or index number ("it scored 42", "58 in top gear", "7 to 20 points") means nothing to someone who has never seen the test. Say what the number shows as a plain comparison ("it did much better in its top gear", "the older one in top gear beat the new one in its lowest"), a share ("about a third higher") or a multiple ("about eleven times the cost"). A score may appear only with its scale and what it compares to in the same sentence. On screen, a chart may show the real statistic the spoken words leave out, when it names its source and says what the number measures, its scale and which way is better (Krish, 2026-10-16: "The visuals should look like genuine reviews of the actual product, with statistics"); a bare number is as lost on screen as aloud.',
    said: 'What does 42 even mean? that is not understandable. We need to simplify this. (Earlier the same day: 7-20 points of improvement is too complex)',
    on: '2026-10-16', source: 'board comment on Friday\'s 90-second script; checked by scripts/post-pack/story_check.py (score_problems), which refuses a script that says one', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass', 'visual'],
  },
  {
    id: 'ANALOGY_IN_SCRIPTS_ONLY', name: 'Analogies in the spoken scripts; the article and the pictures show the real thing',
    text: 'Analogies, comic comparisons and exaggeration belong in the video scripts, where Krish explains things casually in his own voice (the Hannah Fry style he is trying). The article stays more professional: describe the product in its own terms (the model, its thinking setting, the price, the test result), with at most a brief comparison where a reader would otherwise be lost, never an analogy carried through the piece. Pictures and video graphics never act out an analogy: they look like a genuine review of the actual product, with real screenshots of the apps and their settings and charts of real statistics from a named source, each labelled with what it measures, its scale and which way is better. A picture of a car, a race or a gearbox standing for an AI is out, however clear it seems.',
    said: 'No that\'s car visual is not clear. The gear beat the new badge. I don\'t think the visuals should have analogies in them. The visuals should look like genuine reviews of the actual product, with statistics, rather than having analogies. The analogies should only be in my casual narrative explanation style. The article itself shouldn\'t have them as they shouldn\'t go 10 out of 10 on analogies. The article should remain slightly more professional. Only the script is what I wanted to experiment with in the casual Hannah Fry style.',
    on: '2026-10-16', source: 'chat, on the race picture drawn for Friday\'s 90-second cut; checked by scripts/post-pack/visual_gate.py (REAL THINGS), which refuses a picture that does not say what real thing it shows', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass', 'visual'],
  },
  {
    id: 'TITLES_AFTER_RECORDING', name: 'Titles, headlines and thumbnail words are signed off after he records',
    text: `Every line that packages a piece (the Substack headline and cover words, the YouTube title and thumbnail words, the Shorts title, the video's title card, every picture heading and chapter divider) is signed off by Krish only after he has recorded the piece, never before. Reading the script out loud is where he finds his message: he changes or understands more then than while the script is written. So the scripts go to the teleprompter without them; once the takes are in, the options are written from what he actually said on camera (scripts/post-pack/narration_diff.py lists it) and from his hook playbook for each surface (config/hook-playbook.json), put to him together at the right moment, and only then drawn. Never put packaging to him, or draw it, before a take of the piece is on the record.`,
    said: `I need to approve/sign off on titles and headers and thumbnail headings and whatnot after recording is an important distinction because only after recording do I really feel like I've got a message. Usually I change or understand a fair bit more after reading a script out loud than I do creating a script.`,
    on: '2026-10-17', source: 'chat, on Friday 16 Oct\'s headings; enforced by scripts/post-pack/title_check.py (a pick on a packaging surface is refused while the piece has no take on the record)', status: 'live',
    stages: ['final_pass', 'production'],
  },
  {
    id: 'SCRIPT_AS_HE_TALKS', name: 'The script is written the way he says it',
    text: `Krish rewrites a script as he reads it (9% of what he said on camera was his own words on 12 October, 38% by 16 October: docs/narration/week-of-12-oct), so write it the way he says it, as measured from his own takes. About one sentence in three opens with So, And, But, Now or See (he does it in every take, about twice as often as the scripts did): So before a result, a verdict or the prediction; "Now," before a new step or a question; And to carry a point on. Keep the full stop (reading age 12) and say the link in that opening word, never leave it for the listener to work out. Write the prediction as one spoken lead-in run straight into the claim ("So my prediction is that...", "So I reckon..."), never a bare label ("My prediction:", "Here's my bet."), and say its deadline as a period ("by the end of December 2027"), keeping the exact day in the article and the prediction record. Write his words: "no one", not "nobody"; "I reckon", not "I bet". Give a question with no verb its verb ("Is that half the cake, or is it just the crumbs?"). In a contrast, say the shared word again ("before the singers get paid", not "before the singers do"). Put every fact, figure, name and source in one short fixed line that carries the whole fact, with a score's scale and comparison (PLAIN_SCORES): short lines are the ones he keeps word for word, so keep facts out of the set-up and the turns, where he riffs. Soften one or two of his own verdicts the way he does ("kind of", "probably", "I reckon"), never a fact; put "actually" on the turn of the piece; after his view, give its reason in plain words. Budget the length for what he adds: about 200 script words for the 90-second cut and about 400 for the 3-minute cut (he speaks 170 to 180 words a minute and adds 15 to 38% more).`,
    said: `I also need you to list everything about my narration that deviated from the script, down to the fact that I talk in, let's say, about 30% of that. Thats how script should be written in the future.`,
    on: '2026-10-17', source: 'chat, after his 14-minute Friday take; measured by scripts/post-pack/narration_diff.py over the week\'s seven takes (config/narration-ledger.json; the rules each checked against every take, docs/narration/week-of-12-oct/habits-and-rules.json); checked softly by scripts/post-pack/story_check.py', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
  },
  {
    id: 'THREE_THINGS_TOMORROW', name: 'Every article ends with "3 things you can do tomorrow"',
    text: 'Every article ends with a clearly headed section, "3 things you can do tomorrow" (the heading says exactly that), holding exactly three concrete actions a reader can take the next day. Each is one short plain sentence that starts with a verb, names the thing to do, and follows from the piece\'s own checked evidence: no new claim, number or source goes in it. It is the last section, after the prediction. It is not an outline section (ONE_SPINE), and it is the one list of three the house wants (SOUNDS_LIKE_KRISH asks for no others on repeat). The video script does the same job in his own words in its closing beat (SCRIPT_CLOSE). The publish check THREE_THINGS_TOMORROW reads the heading and the three items.',
    said: 'The articles all need to have a really clear "3 things you can do tomorrow" at the end of every piece too.',
    on: '2026-10-21', source: 'chat, the 2026-10-21 ruling on every piece; checked by publishChecks THREE_THINGS_TOMORROW (api/_publishChecks.ts), which reads the heading and the three items', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass', 'publish_check'],
  },
  {
    id: 'TONE_OBSERVANT_WITTY', name: 'Observational, witty and positive, with a dry Hannah Fry edge',
    text: 'In every series, in the article and the script, Krish\'s tone is observational (he notices a true, specific detail and says what it shows), witty and positive. The wit is dry and deadpan, in the manner of Hannah Fry: a quiet aside that grows out of a true detail already in the piece, never an invented one. It is aimed at the hype, the situation or himself, never at a real person, a named person\'s looks, job or character, or the reader. Positive means the reader leaves better equipped and curious, not cynical or scared: a hard finding is said straight and followed by what can be done about it. A joke never sits inside a sentence the fact gate holds, and a piece with no true detail worth a smile has no joke. Scripts carry more of it than articles (ANALOGY_IN_SCRIPTS_ONLY, VOICE_ON_CAMERA).',
    said: 'Generally yes - observational and witty and positive are my general go tos. (Of the question whether "Bit of dry wit and hannah fry sarcasm too" applies to every series.)',
    on: '2026-10-21', source: 'chat, his answer on tone for every series; read by every writer and draft judge through this registry', status: 'live',
    stages: ['write', 'judge_draft', 'final_pass'],
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
