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
// (see scripts/check-teardown-beat.ts).

/** Event-shaped stories that are not, by themselves, the beat. */
export const OFF_BEAT =
  /\b(launch(es|ed)?|releases?|unveil(s|ed)?|announc(e|es|ed|ement)|introduc(e|es|ing)|debuts?|benchmark|leaderboard|state of the art|SOTA|outperform|beats? (GPT|Claude|Gemini|Llama)|model card|context window|parameters?|open.?sourc|regulat(e|ion|ory)|governance|compliance|EU AI Act|executive order|policy|guardrails?|pilot programme?|pilot program|proof of concept|POC|partnership|integrat(es|ion) with|funding round|raises? \$|Series [A-F]\b)/i

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
 * Deliberately NOT in here: lawsuits, copyright and regulation. "Who actually
 * gets paid when a machine reads the work" is one of the eleven tracked
 * questions, so a copyright suit is on-theme, and "Texas banned hyperscale data
 * centres, the IPO math changed" is a Money story wearing a ban. Those stay in
 * OFF_BEAT where an economic sentence can still rescue them.
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

/**
 * True when a candidate belongs on the MYMU: Teardown beat.
 *
 * Three tiers, in order. A NEVER_BEAT topic is refused outright. Otherwise
 * economic substance anywhere wins. Otherwise a pure event story is rejected.
 *
 * NEVER_BEAT and OFF_BEAT both read the HEADLINE only, while ON_BEAT reads the
 * number sentence too. That asymmetry is load bearing: the headline says what
 * the story is, and the supporting sentence can only ever rescue it. Testing
 * the refusal against both killed "Companies struggle to achieve ROI from
 * increased AI spending", which is exactly the beat, because its thesis
 * mentioned a risk in passing.
 */
export function onTeardownBeat(headline: string, numberSentence?: string | null): boolean {
  if (NEVER_BEAT.test(headline)) return false
  const text = `${headline} ${numberSentence || ''}`
  if (ON_BEAT.test(text)) return true
  return !OFF_BEAT.test(headline)
}
