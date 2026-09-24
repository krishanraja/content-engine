// The panel: who judges, and the one question each of them owns.
//
// Krish's ask: a panel of judges that reads every idea, his and the machine's,
// from the angles he actually cares about, and then he makes the call. Same
// again on the draft once he has picked a channel.
//
// There is already a precedent for this in the repo rather than a new idea: the
// carousel reset put three concepts in front of two blinded judges scoring out
// of 80, and the editorial radar runs two independent series lenses over one
// signal. This is that, given a roster and made permanent.
//
// Design rules, each of which is the difference between a panel and slop:
//
//   One judge, one question. A judge that scores "is this good" has not
//   judged. Each entry below owns exactly one axis and is told to ignore the
//   others, which is what makes disagreement between them informative.
//
//   Blinded and independent. No judge sees another's verdict. They run in
//   parallel from the same artifact and their own rubric, so agreement means
//   something.
//
//   Deterministic first. The free checks run before any model call and can
//   short-circuit the whole panel, because paying a model to notice a duplicate
//   is the sort of thing that makes an engine expensive and slow for no reason.
//
//   The prosecutor is not a formality. Krish's own doctrine is that an idea is
//   half-wrong by default; one judge's entire job is to argue for killing it,
//   and its verdict is reported next to the others rather than averaged away.
//
//   Nobody here decides. The panel ranks and argues. Krish decides. The only
//   blocking gates remain the hard ones: truth, rights, confidentiality,
//   transcript fidelity, naming.
//
// ANTI-ECHO. This is load-bearing and check-judges.ts enforces it. Judges score
// form, craft and evidence. No judge may score a candidate higher because Krish
// has shown interest in its subject: seventeen approvals are the most
// concentrated statement of interest this system has, and letting them feed the
// ranker is exactly the echo chamber api/_arcScore.ts was built to avoid. Which
// shapes he finishes is a fact about him as a writer. Which subjects he likes
// is the thing the machine is supposed to be able to surprise him about.

export const ROSTER_VERSION = 'panel-v2'

export type Gate = 'idea' | 'draft'

export interface Judge {
  /** Stable key. Appears in judge_verdicts.judge and in calibration. */
  key: string
  /** The one question this judge owns, in Krish's words. */
  question: string
  /** What the judge is told to do. One axis, explicitly not the others. */
  rubric: string
  /** What it must return as evidence, or it is an abstention. */
  evidence: string
  /** Adversarial judges argue for killing. Reported, never averaged in. */
  adversarial?: boolean
}

/** The idea gate. Everything entering, from Krish's brain dumps and from the
 *  machine's radar, creator and Drive lanes, is read by the same six. */
export const IDEA_JUDGES: Judge[] = [
  {
    key: 'novelty',
    question: 'Has this been said, by Krish or by the field?',
    rubric:
      'Score how non-obvious this is. 10 is a claim you have not seen made; 5 is a familiar claim with a new angle; '
      + '1 is a restatement of the consensus. Judge the CLAIM, not the topic: a well-worn topic with a genuinely new '
      + 'position scores high, a fresh topic carrying an obvious take scores low. You are shown recent ideas already '
      + 'in the system; overlap with them is the strongest evidence of low novelty.',
    evidence: 'Name the closest existing idea or the widely held version of this claim, and say how this differs.',
  },
  {
    key: 'evidence',
    question: 'Can this be proven, and what would prove it?',
    rubric:
      'Score how provable the claim is with sources that exist. 10 means specific, checkable, and the proof is named; '
      + '5 means arguable with work; 1 means it is a vibe or an unfalsifiable prediction. Do not score whether the '
      + 'claim is TRUE, score whether it can be SHOWN. An honest "no evidence exists yet" is a low score, not a kill.',
    evidence: 'Name what would have to be shown, and whether such a source plausibly exists.',
  },
  {
    key: 'consequence',
    question: 'What does the reader do differently on Monday?',
    rubric:
      'Score the reader consequence. 10 means a named person changes a decision, a budget, or a plan because of it; '
      + '5 means they think differently; 1 means they nod and carry on. Interesting is not consequential. '
      + 'Be concrete about who and what: if you cannot name the action, the score is low however clever the idea.',
    evidence: 'Name the reader and the specific thing they do or stop doing.',
  },
  {
    key: 'reader',
    question: 'Will the leader this is written for actually read it?',
    rubric:
      'Score reach into the readership: a senior leader in a business doing roughly five to fifty million pounds '
      + 'who will not admit, to anyone, that they are not ready for what is happening. 10 means it speaks to a '
      + 'problem they have this quarter; 1 means it is for practitioners, peers, or nobody in particular. Do not '
      + 'reward flattery of that reader; reward usefulness to them. Judge the readership only. Whether it reaches '
      + 'anyone who might hire him is the buyer judge and not yours.',
    evidence: 'Name the situation that reader is in where this lands.',
  },
  {
    key: 'buyer',
    question: 'Does this reach someone who might hire him for a thirty-day build?',
    rubric:
      'Score commercial reach: a commercial leader who might engage Krish on a short-term basis to build an AI '
      + 'brain or an AI go-to-market plan. 10 means it lands in front of a problem that engagement solves; 1 means '
      + 'it is for an audience that will never buy anything. Judge commercial reach only. Whether the wider '
      + 'readership enjoys it belongs to the reader judge, and the two of you disagreeing on one idea is a finding '
      + 'rather than a fault.',
    evidence: 'Name the situation a prospective client is in where this lands.',
  },
  {
    key: 'connection',
    question: 'Does this tie several threads into one observation, or is it one news item?',
    rubric:
      'Score synthesis. 10 means it joins three or more separate threads, shifts or themes into a single '
      + 'observation that no one source states; 5 means it joins two, or joins them loosely; 1 means it reports one '
      + 'thing that happened. The threads must resolve into ONE argument with one spine: a piece that surveys '
      + 'several subjects without joining them scores low, because a roundup is not a synthesis. Judge the '
      + 'connection, never whether the subject matters.',
    evidence: 'Name each thread it joins, and the observation that only appears once they are put together.',
  },
  {
    key: 'fun',
    question: 'Would he enjoy reading this, and enjoy writing it?',
    rubric:
      'Score whether this is a pleasure to read. 10 means a reader repeats the observation to someone else the '
      + 'same day; 5 means competently interesting; 1 means dutiful, worthy, or a briefing. Wit points at claims, '
      + 'hype, incentives and decisions, never at a named person\'s competence. Dry is fine and smug is not, and a '
      + 'joke that costs the evidence its credibility scores low however funny it is. Judge only whether it is a '
      + 'pleasure. Whether it is correct or provable is other judges\' work.',
    evidence: 'Quote the line a reader would repeat, or say plainly that there is not one.',
  },
  {
    key: 'standing',
    question: 'Can Krish say this from his own experience, not as commentary?',
    rubric:
      'Score standing. 10 means he has built, sold, run or lived the thing and can say something only he can say; '
      + '5 means he has adjacent experience and can reason credibly; 1 means he would be summarising other people. '
      + 'The corpus and his build record are the evidence. Absence of standing is not a kill, it is a reason to '
      + 'reshape the piece toward what he has actually done.',
    evidence: 'Name the experience that gives him standing, or say plainly that none is visible.',
  },
  {
    key: 'prosecutor',
    question: 'What is the strongest reason to kill this?',
    rubric:
      'You are not balanced. Build the best case against publishing this at all: it is derivative, it is unprovable, '
      + 'it dates badly, it invites an obvious rebuttal he cannot answer, it is off-audience, or he lacks the '
      + 'standing. Score how strong your own best objection is: 10 means the objection is fatal and he should not '
      + 'write it; 1 means you tried and the idea survives. A high score from you is an argument to kill.',
    evidence: 'State the single strongest objection in one sentence, and what would have to be true to defeat it.',
    adversarial: true,
  },
]

/** The draft gate. Runs per channel, because the same argument fails
 *  differently as a Short and as an essay. */
export const DRAFT_JUDGES: Judge[] = [
  {
    key: 'hook',
    question: 'Does the opening earn the next line?',
    rubric:
      'Score the first line, or the first three seconds if this is spoken. 10 means a specific claim or image that '
      + 'makes the next line necessary; 5 means a competent setup; 1 means throat-clearing, a definition, or a '
      + 'question the reader has no reason to care about. Judge only the opening. Ignore the rest of the piece.',
    evidence: 'Quote the opening and say what it promises.',
  },
  {
    key: 'clarity',
    question: 'Is the complex thing made simple without being made wrong?',
    rubric:
      'Score simplification of the complex, which is the thing this engine exists to do. 10 means a hard idea is now '
      + 'obvious and still accurate; 5 means it is followable with effort; 1 means it is either still jargon or has '
      + 'been flattened into something untrue. Penalise both directions equally: a simplification that loses the '
      + 'point is worse than the jargon it replaced.',
    evidence: 'Name the hardest idea in the piece and quote how it is explained.',
  },
  {
    key: 'personality',
    question: 'Does a person say this, and specifically him?',
    rubric:
      'Score whether a reader would know a human wrote this and would recognise which human. 10 means it carries a '
      + 'point of view, a real example, and a way of talking nobody else would produce; 5 means competent and '
      + 'anonymous; 1 means it reads as generated. You are scoring presence, not correctness and not warmth.',
    evidence: 'Quote the most and least characteristic sentence.',
  },
  {
    key: 'evidence_integrity',
    question: 'Is every claim still supported by what the approved idea carried?',
    rubric:
      'Score fidelity to the evidence. 10 means every factual claim traces to something in the approved idea or its '
      + 'sources; 5 means one claim has drifted past what was supported; 1 means the draft invents figures, sources, '
      + 'quotes or certainty that were not there. This is the one axis where a low score should read as a stop, '
      + 'because a fabricated claim is not a style problem.',
    evidence: 'List any claim in the draft that is not supported by the supplied material.',
  },
  {
    key: 'voice',
    question: 'Does it violate his voice rules?',
    rubric:
      'Score against the supplied voice block and kill list. 10 means clean; 1 means it is full of the patterns he '
      + 'bans. Deterministic checks have already stripped em dashes and the obvious tells, so what you are looking '
      + 'for is the subtler kind: stacked two-word fragments, the rhetorical turn after three short sentences, '
      + 'preachy meta-lines, false balance, and words on the kill list.',
    evidence: 'Quote each violation.',
  },
  {
    key: 'channel_fit',
    question: 'Is this the right shape for where it is going?',
    rubric:
      'Score fit to the named channel. A Short must land one idea in under a minute with a spoken cadence. A '
      + 'Substack post can carry an argument with sources and earns its length. A carousel needs one idea per slide '
      + 'that survives being read alone. 10 means it could not be better shaped for this channel; 1 means it is the '
      + 'right idea in the wrong form and should be re-cut, not edited.',
    evidence: 'Name what would have to change to fit the channel.',
  },
  {
    key: 'prosecutor',
    question: 'What is the strongest reason this flops?',
    rubric:
      'You are not balanced. Build the best case that this piece lands badly or not at all: the opening loses them, '
      + 'the argument is thinner than it looks, the ending asks nothing, the proof is weak, it is too long for what '
      + 'it says. Score your own best objection: 10 means it will flop and should not ship as written; 1 means you '
      + 'tried and it holds.',
    evidence: 'State the single strongest objection and the smallest change that would defeat it.',
    adversarial: true,
  },
]

export function rosterFor(gate: Gate): Judge[] {
  return gate === 'idea' ? IDEA_JUDGES : DRAFT_JUDGES
}

/** Two judges materially disagree when they land on opposite verdicts, or when
 *  their scores are more than this far apart. That is the trigger for a
 *  tiebreaker, mirroring the divergence doctrine already used for design. */
export const MATERIAL_DISAGREEMENT_POINTS = 4

// ── The router ──────────────────────────────────────────────────────────────
//
// Krish, 2026-09-24: "does it actually fit the narrative of each sub channel".
//
// The router is NOT a judge and must never be added to a roster. A judge owns
// one axis and returns one score; the router answers a different kind of
// question and returns three. Folding it into the panel would break the one
// property that makes the panel worth running, and would also hide the thing
// worth seeing: a piece that fits two channels well, or none at all.
//
// It scores fit against all three mandates and names the winner. Two outcomes
// the old "pick one" shape could not express:
//   - low on all three is HOMELESS, which is a verdict. Before this, such a
//     piece was silently filed under whichever channel was least bad.
//   - high on two is CONTESTED, and that is the case the mandates exist to
//     settle. It goes to Krish rather than being resolved by a coin toss.
//
// The mandates are passed in at call time and never copied into this file.
// venture_formats.mandate is the only truth for what each channel is, and a
// copy here would drift the first time Krish changed one. He changed all three
// on 2026-09-24.

export interface RouterVerdict {
  /** slug -> 0-10 fit. Every live subchannel appears, including the losers. */
  fits: Record<string, number>
  /** The best fit, or null when nothing cleared the floor. */
  winner: string | null
  /** Slugs within CONTESTED_POINTS of the winner. Krish settles these. */
  contested: string[]
  confidence: number | null
  /** Which question the piece asks, in one sentence. The reason for the call. */
  why: string
}

/** Below this, the piece does not belong to any channel and says so. */
export const ROUTER_FIT_FLOOR = 6

/** Two channels this close is a contested call, not a decided one. */
export const CONTESTED_POINTS = 1.5

/** The one rule that settles a contested piece. Krish, 2026-09-24. It is in
 *  every mandate now, and repeated here because the router is the thing that
 *  applies it. */
export const ROUTER_TIEBREAK =
  'What does the reader change next? If they would go and change a price, a budget or a contract, it is '
  + 'split_the_bill. If they would change what they build or buy, it is lift_the_lid. If they would change how they '
  + 'think or what they expect, it is mind_the_gap. The question the piece asks decides, never its surface subject.'
