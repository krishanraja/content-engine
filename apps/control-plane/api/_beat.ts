// _beat — the MYMU: Teardown beat gate (G0).
//
// Krish, 2026-08-06, defining the beat: "NOT technical news or things about
// governance, enterprise pilots and boring crap like that, but what are the
// second order effects of AI on pricing, positioning, corporate strategy, unit
// economics, the human labor, leaders etc."
//
// Enforced in code, not in a prompt, for the same reason the vendor-number rule
// is: a prompt instruction loses to a high-scoring candidate every time. The
// interestingness score selects hardest on asymmetry, and capability
// announcements score beautifully on asymmetry while being precisely the beat
// Krish excluded.
//
// The rule is NOT "never mention a model release". It is "the event is never the
// story, the second-order economic effect is the story". An off-beat headline
// therefore survives when the load-bearing sentence is about money or labour:
//   "GPT-5.5 launch quietly repriced the whole agent market"  -> ON beat
//   "OpenAI launches GPT-5.5 with a 2M token context window"  -> OFF beat
//
// Deliberately dependency-free so it can be checked without booting Supabase
// (see scripts/check-teardown-beat.ts). Its one import is config/beat.json.
//
// Ruling (Krish, 2026-11-24): the engine brings stories in his focus sectors
// (media, entertainment, content, arts, music, creator tech, with the economics
// of AI inside them) and not governance, regulation, security or data breaches.
// The words of that beat are rows in config/beat.json, never code here: its
// avoid list refuses a headline outright (governance, regulation, compliance,
// policy, security, privacy, surveillance, breaches), its focus sectors keep a
// focus-sector headline that the event rule below would otherwise drop
// ("Artist releases AI album" is the beat, "OpenAI launches GPT-5.5" is not),
// and an enterprise productivity headline is kept only with a focus-sector
// angle.

import beat from '../../../config/beat.json' with { type: 'json' }

/**
 * Event-shaped stories that are not, by themselves, the beat.
 *
 * Regulation, governance, compliance, EU AI Act, executive order and policy
 * used to sit here, rescuable by an economic sentence. Since Krish's
 * 2026-11-24 ruling they are on config/beat.json's avoid list and refused
 * outright (neverBeat below).
 */
export const OFF_BEAT =
  /\b(launch(es|ed)?|releases?|unveil(s|ed)?|announc(e|es|ed|ement)|introduc(e|es|ing)|debuts?|benchmark|leaderboard|state of the art|SOTA|outperform|beats? (GPT|Claude|Gemini|Llama)|model card|context window|parameters?|open.?sourc|guardrails?|pilot programme?|pilot program|proof of concept|POC|partnership|integrat(es|ion) with|funding round|raises? \$|Series [A-F]\b)/i

/**
 * Topics that are never the beat, whatever else rides along in the sentence.
 *
 * The tier above (OFF_BEAT) describes an event-shaped story that a second-order
 * economic sentence can rescue: a model launch becomes the beat when the launch
 * repriced something. These do not get rescued. A breach that cost money is
 * still a breach story, and a safety pause with a revenue figure in it is still
 * a safety story.
 *
 * Krish's 2026-08-06 definition quoted at the top of this file named governance
 * and enterprise pilots, so those went in OFF_BEAT, and safety and security
 * were never enumerated anywhere. Measured on the live corpus 2026-09-09: the
 * gate passed 88 percent of 113 rows and 18 of the passing rows were safety,
 * security and incident stories, including several the upstream pool had
 * already tagged `governance`. Krish, same day, naming what the tab was showing
 * him: "governance, risk, safety, negative things, and overly technical things.
 * That is not what I do." With this tier the gate passes 75 percent and leaks
 * none of them.
 *
 * Deliberately NOT in here: lawsuits, copyright and licensing. "Who actually
 * gets paid when a machine reads the work" is one of the eleven tracked
 * questions, so a copyright suit is on-theme, and licensing is the money of
 * creative work, the centre of the 2026-11-24 beat. "Texas banned hyperscale
 * data centres, the IPO math changed" is a Money story wearing a ban, and a ban
 * is not on the avoid list. Regulation was in this sentence until 2026-11-24,
 * when Krish ruled it off the beat; it now refuses through config/beat.json's
 * avoid list (neverBeat below), beside this tier.
 */
export const NEVER_BEAT =
  /\b(safety|unsafe|alignment|misalign\w*|bioweapon|existential|catastrophic|red.?team(ed|ing)?|jailbr\w*|breach(es|ed)?|hacks?|hacked|hacking|malware|ransomware|phishing|exfiltrat\w*|vulnerabilit\w*|exploit(s|ed|able)?|malicious|rogue|intrusion|cyber\w*|threat actor|attack(s|er|ers|ed)?)\b/i

/**
 * Second-order economic substance: the thing that makes a story a Teardown.
 *
 * The price term is prefix-tolerant (`\w*pric...`) because it was not, and the
 * gate therefore failed its own worked example. The header above documents
 * "GPT-5.5 launch quietly repriced the whole agent market" as ON beat; `priced?`
 * does not match "repriced", nothing else in this tier matched either, and
 * OFF_BEAT's "launch" won. So a launch story whose actual payload was a
 * repricing, the exact shape this gate exists to rescue, was being dropped.
 * Found 2026-09-09 by a test written against the comment.
 */
export const ON_BEAT =
  /\b(\w*pric(e|ed|es|ing)|margin|unit econom|cost per|cost to serve|revenue|monetis|monetiz|subsidy|subsidis|subsidiz|charge[sd]?|billing|seat|per.seat|contract value|churn|retention|headcount|layoff|redundanc|hiring|labou?r|job(s)?|role(s)?|wage|salary|procurement|budget|spend|capex|opex|P&L|gross margin|take rate|commission|positioning|competitive|market share|business model)/i

// ── The 2026-11-24 beat, read from config/beat.json ──────────────────────

interface BeatRow { keywords: readonly string[] }

/** One keyword row as a regex alternative: escaped, a trailing * matches any
 *  ending, and a space or hyphen between words matches either. */
function keywordSource(keyword: string): string {
  const stem = keyword.trim().toLowerCase()
  const prefix = stem.endsWith('*')
  const words = (prefix ? stem.slice(0, -1) : stem)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return words.length ? words.join('[\\s-]+') + (prefix ? '\\w*' : '') : ''
}

/** Whole-word, case-blind regex over every keyword in some config rows. */
export function keywordRegex(rows: readonly BeatRow[], flags = 'i'): RegExp {
  const alts = rows.flatMap(r => r.keywords).map(keywordSource).filter(Boolean)
  return new RegExp(`\\b(?:${alts.join('|')})\\b`, flags)
}

const AVOID_EXCEPT = keywordRegex([{ keywords: beat.avoid_not_when }], 'gi')
const FOCUS_EXCEPT = keywordRegex([{ keywords: beat.focus_not_when }], 'gi')

/** Topics on Krish's 2026-11-24 avoid list (config/beat.json avoid). */
export const AVOID_BEAT = keywordRegex(beat.avoid)
/** His focus sectors (config/beat.json focus_sectors). */
export const FOCUS_BEAT = keywordRegex(beat.focus_sectors)
/** Enterprise productivity, kept only with a focus-sector angle. */
export const ENTERPRISE_BEAT = keywordRegex([beat.enterprise])
/** The economics of AI inside the focus sectors (config/beat.json
 *  economics_keywords): its keywords, and a money or share figure. */
export const ECONOMICS_BEAT = keywordRegex([beat.economics_keywords])
export const ECONOMICS_FIGURE = new RegExp(beat.economics_keywords.figure_pattern, 'i')

/**
 * Who the publication is for (config/beat.json reader). Krish approved the
 * North Star reader line on 2026-11-26 ("I approve the lines"): the reader
 * narrows to people who make the calls or make the work in the creative, arts,
 * music, entertainment, media and sports industries. One wording, read by the
 * relevance filter, the reader and buyer judges and the humour check.
 */
export const READER = beat.reader

/** On the avoid list, the exception phrases ("job security", "royalty
 *  policy") taken out first. */
export function onAvoidList(text: string): boolean {
  return AVOID_BEAT.test(text.replace(AVOID_EXCEPT, ' '))
}

/** In one of the focus sectors, the exception phrases ("state of the art",
 *  "game changer", "AI Studio") taken out first. */
export function inFocusSector(text: string): boolean {
  return FOCUS_BEAT.test(text.replace(FOCUS_EXCEPT, ' '))
}

/** Refused outright, whatever rides along: the safety and hack tier above and
 *  the avoid list. Reads the headline only. */
export function neverBeat(headline: string): boolean {
  return NEVER_BEAT.test(headline) || onAvoidList(headline)
}

/** The CTRL pool's own lanes that are off the beat (config/beat.json
 *  pool_categories_off_beat: governance and security). feed/ingest drops a
 *  pool story in one of them as off_beat unless its headline is in a focus
 *  sector (the pool files copyright and licensing under governance). */
export function poolCategoryOffBeat(category: string | null | undefined): boolean {
  if (!category) return false
  return (beat.pool_categories_off_beat as readonly string[]).includes(category.trim().toLowerCase())
}

/** The beat as a block for a model's system prompt, built from config/beat.json
 *  so the prompt and the gate read one list. */
export function beatPromptBlock(): string {
  const sectors = beat.focus_sectors.map(s => s.label).join('; ')
  const avoid = [...beat.avoid.map(a => a.label), beat.enterprise.label].join('; ')
  const words = beat.his_words[0]
  return [
    'THE BEAT',
    `Bring stories from Krish's focus sectors: ${sectors}. ${beat.tone}`,
    `Not the beat: ${avoid}. Return no_angle for a signal that is only one of these.`,
    `The model piece: "${beat.model_piece.title}". ${beat.model_piece.why}`,
    words ? `His words (${words.at.slice(0, 10)}): "${words.said}"` : '',
  ].filter(Boolean).join('\n')
}

/**
 * True when a candidate belongs on the MYMU: Teardown beat.
 *
 * Five tiers, in order. A NEVER_BEAT or avoid-list topic is refused outright.
 * An enterprise productivity headline with no focus-sector angle is refused.
 * Otherwise economic substance anywhere wins. Otherwise a focus-sector
 * headline is kept even when it is event-shaped ("Artist releases AI album").
 * Otherwise a pure event story is rejected.
 *
 * The refusals, the focus test and OFF_BEAT read the HEADLINE only, while
 * ON_BEAT reads the number sentence too. That asymmetry is load bearing: the
 * headline says what the story is, and the supporting sentence can only ever
 * rescue it. Testing the refusal against both killed "Companies struggle to
 * achieve ROI from increased AI spending", which is exactly the beat, because
 * its thesis mentioned a risk in passing.
 */
export function onTeardownBeat(headline: string, numberSentence?: string | null): boolean {
  if (neverBeat(headline)) return false
  const focus = inFocusSector(headline)
  if (!focus && ENTERPRISE_BEAT.test(headline)) return false
  const text = `${headline} ${numberSentence || ''}`
  if (ON_BEAT.test(text)) return true
  if (focus) return true
  return !OFF_BEAT.test(headline)
}
