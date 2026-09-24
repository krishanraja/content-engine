import { createHash, randomUUID } from 'node:crypto'
import { callClaude, robustJson, type ClaudeCall } from '../_content.js'
import { JUDGE_MODEL } from '../_models.js'
import { isDeferred } from './deferred.js'
import {
  CONTESTED_POINTS, MATERIAL_DISAGREEMENT_POINTS, ROSTER_VERSION, ROUTER_FIT_FLOOR, ROUTER_TIEBREAK,
  rosterFor, type Gate, type Judge, type RouterVerdict,
} from './roster.js'

// Running a panel.
//
// Judges run in parallel from the same artifact and their own rubric, and never
// see each other. Their verdicts are stored as given: the spread and the
// dissent are the output, not an average. A mean of six judges is a number that
// cannot be acted on and hides the disagreement, which is the part worth
// reading.
//
// Nothing here advances a piece. The panel reports; Krish decides. The only
// blocking gates in this engine remain the hard ones, and they live elsewhere.

export interface DeterministicFinding {
  judge: string
  verdict: 'pass' | 'revise' | 'kill'
  score: number
  the_one_fix: string | null
  evidence: string[]
}

export interface PanelInput {
  gate: Gate
  subjectTable: 'content_ideas' | 'weekly_briefs'
  subjectId: string
  /** Exactly what is being judged. Verdicts bind to this hash. */
  artifact: string
  /** Context every judge may read: voice block, corpus, recent ideas, sources. */
  context: string
  /** Free checks already run by the caller. They are recorded as verdicts and
   *  can short-circuit the panel before any model call. */
  deterministic?: DeterministicFinding[]
  /** Stop before spending when a deterministic judge already says kill. */
  shortCircuitOnKill?: boolean
  idempotencyKey?: string
  timeoutMs?: number
  /** How the judges reach the model. Defaults to a live call; the batched
   *  sweep passes its own, which answers from a reply already paid for or
   *  defers. Nothing else about the panel changes between the two. */
  call?: ClaudeCall
  /** Which independent draw of this panel this is. Only the bury confirmation
   *  sets it, and only so a batched re-read of an identical artifact is a real
   *  second reading rather than the first one served from cache. */
  sample?: number
}

export interface JudgeVerdict {
  judge: string
  score: number | null
  verdict: 'pass' | 'revise' | 'kill' | 'abstain'
  the_one_fix: string | null
  evidence: string[]
  confidence: number | null
  deterministic: boolean
  model: string | null
  adversarial: boolean
}

export interface PanelResult {
  panel_run_id: string
  idempotency_key: string
  gate: Gate
  artifact_hash: string
  roster_version: string
  verdicts: JudgeVerdict[]
  spread: {
    /** Lowest and highest non-adversarial score, and who gave them. */
    low: { judge: string; score: number } | null
    high: { judge: string; score: number } | null
    kills: string[]
    /** The prosecutor's case, always surfaced separately. */
    prosecution: { score: number | null; the_one_fix: string | null } | null
  }
  dissent: boolean
  short_circuited: boolean
  cost_usd: number
  started_at: string
  finished_at: string
}

export function artifactHash(text: string): string {
  return createHash('sha256').update(text ?? '').digest('hex')
}

const VERDICTS = new Set(['pass', 'revise', 'kill', 'abstain'])

/** Strict, because a judge that returns a shape we did not ask for has not
 *  answered the question. A malformed reply becomes an abstention with the
 *  reason recorded, never a guessed score: a fabricated number here would
 *  propagate into calibration and quietly corrupt the panel's own report card. */
export function parseVerdict(judge: Judge, raw: string): JudgeVerdict {
  const abstain = (why: string): JudgeVerdict => ({
    judge: judge.key,
    score: null,
    verdict: 'abstain',
    the_one_fix: why,
    evidence: [],
    confidence: null,
    deterministic: false,
    model: JUDGE_MODEL,
    adversarial: judge.adversarial === true,
  })

  const parsed = robustJson(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return abstain('the judge did not return an object')

  const verdict = String((parsed as Record<string, unknown>).verdict ?? '').toLowerCase()
  if (!VERDICTS.has(verdict)) return abstain(`the judge returned an unknown verdict: ${verdict.slice(0, 40)}`)
  if (verdict === 'abstain') return abstain(String((parsed as Record<string, unknown>).the_one_fix ?? 'the judge abstained'))

  const rawScore = Number((parsed as Record<string, unknown>).score)
  if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 10) {
    return abstain('the judge returned a score outside 0 to 10')
  }

  const fixValue = (parsed as Record<string, unknown>).the_one_fix
  const the_one_fix = typeof fixValue === 'string' && fixValue.trim() ? fixValue.trim().slice(0, 600) : null

  const rawEvidence = (parsed as Record<string, unknown>).evidence
  const evidence = Array.isArray(rawEvidence)
    ? rawEvidence.filter((x): x is string => typeof x === 'string' && Boolean(x.trim())).map(x => x.trim().slice(0, 600)).slice(0, 8)
    : []
  // Evidence is the whole difference between a judgement and an opinion. A
  // verdict that cannot cite anything is downgraded rather than trusted.
  if (!evidence.length) return abstain('the judge returned no evidence for its verdict')

  const rawConfidence = Number((parsed as Record<string, unknown>).confidence)
  const confidence = Number.isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
    ? Math.round(rawConfidence * 100) / 100
    : null

  return {
    judge: judge.key,
    score: Math.round(rawScore * 100) / 100,
    verdict: verdict as 'pass' | 'revise' | 'kill',
    the_one_fix,
    evidence,
    confidence,
    deterministic: false,
    model: JUDGE_MODEL,
    adversarial: judge.adversarial === true,
  }
}

export function buildJudgePrompt(judge: Judge, gate: Gate): string {
  return [
    `You are one judge on a panel reading ${gate === 'idea' ? 'a content idea' : 'a draft'} for Krish Raja.`,
    '',
    `THE ONLY QUESTION YOU OWN: ${judge.question}`,
    '',
    judge.rubric,
    '',
    'Rules that make this panel worth running:',
    '- Judge only your question. Other judges own the other axes; if you score theirs the panel learns nothing.',
    '- You cannot see the other judges and they cannot see you. Do not hedge toward a consensus that does not exist.',
    '- Never score something higher because the subject looks like something Krish has liked before. Judge the form,',
    '  the craft and the evidence. His interest in a topic is not a reason for a candidate to rank.',
    `- Evidence is mandatory: ${judge.evidence}`,
    '- If you genuinely cannot judge from what you were given, return verdict "abstain" and say why in the_one_fix.',
    '  An honest abstention is worth more than a confident guess.',
    '',
    'Return ONE JSON object and nothing else:',
    '{"score": 0-10, "verdict": "pass"|"revise"|"kill"|"abstain", "the_one_fix": "the single most important thing to change, or null",',
    ' "evidence": ["quote or fact supporting your verdict"], "confidence": 0-1}',
  ].join('\n')
}

function toVerdict(finding: DeterministicFinding): JudgeVerdict {
  return {
    judge: finding.judge,
    score: finding.score,
    verdict: finding.verdict,
    the_one_fix: finding.the_one_fix,
    evidence: finding.evidence,
    confidence: 1,
    deterministic: true,
    model: null,
    adversarial: false,
  }
}

/** Where the panel landed, with the disagreement kept. */
export function summarise(verdicts: JudgeVerdict[]): { spread: PanelResult['spread']; dissent: boolean } {
  const scored = verdicts.filter(v => v.score !== null && !v.adversarial) as Array<JudgeVerdict & { score: number }>
  const sorted = [...scored].sort((a, b) => a.score - b.score)
  const low = sorted[0] ? { judge: sorted[0].judge, score: sorted[0].score } : null
  const high = sorted.length > 1 ? { judge: sorted[sorted.length - 1]!.judge, score: sorted[sorted.length - 1]!.score } : low
  const prosecutorVerdict = verdicts.find(v => v.adversarial) ?? null

  const kills = verdicts.filter(v => v.verdict === 'kill').map(v => v.judge)
  // Material disagreement: opposite verdicts, or scores far apart. Either is a
  // reason to look rather than to average.
  const verdictKinds = new Set(scored.map(v => v.verdict))
  const dissent = (low !== null && high !== null && high.score - low.score >= MATERIAL_DISAGREEMENT_POINTS)
    || (verdictKinds.has('pass') && verdictKinds.has('kill'))

  return {
    spread: {
      low,
      high,
      kills,
      prosecution: prosecutorVerdict
        ? { score: prosecutorVerdict.score, the_one_fix: prosecutorVerdict.the_one_fix }
        : null,
    },
    dissent,
  }
}

export async function runPanel(input: PanelInput): Promise<PanelResult> {
  const started = new Date()
  const hash = artifactHash(input.artifact)
  const deterministic = (input.deterministic ?? []).map(toVerdict)

  // The free checks can end it. Paying six models to notice a duplicate is how
  // an engine becomes expensive and slow for no reason.
  const blocked = input.shortCircuitOnKill !== false && deterministic.some(v => v.verdict === 'kill')
  if (blocked) {
    const { spread, dissent } = summarise(deterministic)
    return {
      panel_run_id: randomUUID(),
      idempotency_key: input.idempotencyKey ?? randomUUID(),
      gate: input.gate,
      artifact_hash: hash,
      roster_version: ROSTER_VERSION,
      verdicts: deterministic,
      spread,
      dissent,
      short_circuited: true,
      cost_usd: 0,
      started_at: started.toISOString(),
      finished_at: new Date().toISOString(),
    }
  }

  const roster = rosterFor(input.gate)

  // ── THE FAN-OUT WAS PAYING FULL PRICE NINE TIMES ──────────────────────────
  //
  // Nine blinded judges read the SAME brief and the SAME artifact; only the
  // rubric differs. Until 2026-09-24 the rubric went in `system` and the brief
  // and artifact went in `user`, so the varying part was in the cacheable slot
  // and the shared part was not. cacheableSystem also only fires above 6000
  // characters and a rubric is about 1650, so in practice NOTHING was cached
  // and the shared context was sent nine times at full rate, every idea.
  //
  // Caching is a prefix match rendered tools, then system, then messages, so
  // the shared content has to come first to be cacheable at all. It does now:
  //
  //   systemStable  the brief, read by every judge of every idea in the sweep
  //   system        this idea's artifact, read by the other eight judges
  //   systemTail    the rubric, the only thing that varies, and still in the
  //                 SYSTEM role: moving it to `user` would have bought the
  //                 saving with a behaviour change.
  //
  // A 1h TTL because a sweep runs longer than the five minute default and an
  // entry that expires mid-run is a second full-price write.
  const brief = ['## Context you may use', input.context].join('\n')
  const artifact = [input.gate === 'idea' ? '## The idea' : '## The draft', input.artifact].join('\n')

  const call = input.call || callClaude
  const results = await Promise.all(roster.map(async judge => {
    try {
      const raw = await call({
        systemStable: brief,
        system: artifact,
        cache: true,
        cacheTtl: '1h',
        systemTail: buildJudgePrompt(judge, input.gate),
        user: 'Judge it.',
        model: JUDGE_MODEL,
        maxTokens: 900,
        temperature: 0.2,
        agent: `judge-${judge.key}`,
        ...(input.sample ? { sample: input.sample } : {}),
        ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
      })
      return parseVerdict(judge, raw)
    } catch (e) {
      // A DEFERRAL IS NOT AN ABSTENTION and this is the single most dangerous
      // catch in the batched path. The batch transport throws to say the reply
      // is not back yet; turning that into an abstention would give every judge
      // of every idea `score: null`, standing() would correctly return the
      // `unjudged` band for all of them, and the sweep would write a complete,
      // well-formed judgment of nothing. Exactly the spend-cap failure of
      // 2026-09-24, rebuilt on purpose.
      if (isDeferred(e)) throw e
      // One judge failing is not the panel failing. It abstains, visibly, and
      // the rest still report.
      return {
        judge: judge.key,
        score: null,
        verdict: 'abstain' as const,
        the_one_fix: `the judge could not be reached: ${(e as Error)?.message?.slice(0, 120) || 'unknown error'}`,
        evidence: [],
        confidence: null,
        deterministic: false,
        model: JUDGE_MODEL,
        adversarial: judge.adversarial === true,
      }
    }
  }))

  const verdicts = [...deterministic, ...results]
  const { spread, dissent } = summarise(verdicts)

  return {
    panel_run_id: randomUUID(),
    idempotency_key: input.idempotencyKey ?? randomUUID(),
    gate: input.gate,
    artifact_hash: hash,
    roster_version: ROSTER_VERSION,
    verdicts,
    spread,
    dissent,
    short_circuited: false,
    cost_usd: 0,
    started_at: started.toISOString(),
    finished_at: new Date().toISOString(),
  }
}

// ── Running the router ──────────────────────────────────────────────────────
//
// Separate from the panel on purpose. See the note in roster.ts: the router
// answers a different shape of question and must never dilute a judge.

export function buildRouterPrompt(mandates: { slug: string; label: string; mandate: string }[]): string {
  return [
    'You route one content idea to one of Krish Raja\'s three subchannels, or to none of them.',
    '',
    'THE MANDATES. These are the only definition of each channel. Read them as written.',
    '',
    ...mandates.map(m => `### ${m.slug} (${m.label})\n${m.mandate}`),
    '',
    'THE TIEBREAK, which settles every contested piece:',
    ROUTER_TIEBREAK,
    '',
    'Score fit for EVERY channel, including the ones that lose. A piece that fits none is homeless and that is a',
    'real answer: do not award a channel a passing score because something has to win. A piece that fits two is',
    'contested, which is also a real answer, and Krish settles it.',
    '',
    'Judge the QUESTION the piece asks, never its surface subject. The same pricing page can belong to any of the',
    'three depending on what it is being asked.',
    '',
    'Return ONE JSON object and nothing else:',
    `{"fits": {${mandates.map(m => `"${m.slug}": 0-10`).join(', ')}},`,
    ' "why": "the question this piece asks, in one sentence", "confidence": 0-1}',
  ].join('\n')
}

/** Strict, for the same reason parseVerdict is: a guessed route is worse than
 *  no route, because it silently files a piece under the wrong mandate and
 *  every downstream judge then reads it against the wrong rules. */
export function parseRouterVerdict(raw: string, slugs: string[]): RouterVerdict {
  const empty: RouterVerdict = { fits: {}, winner: null, contested: [], confidence: null, why: '' }
  const parsed = robustJson(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty

  const rawFits = (parsed as Record<string, unknown>).fits
  if (!rawFits || typeof rawFits !== 'object') return empty
  const fits: Record<string, number> = {}
  for (const slug of slugs) {
    const n = Number((rawFits as Record<string, unknown>)[slug])
    // A missing channel is not a zero. Zero is a judgement; absent is a
    // malformed reply, and treating them the same would let a truncated
    // answer read as "definitely not this one".
    if (!Number.isFinite(n) || n < 0 || n > 10) return empty
    fits[slug] = Math.round(n * 100) / 100
  }

  const ranked = Object.entries(fits).sort((a, b) => b[1] - a[1])
  const top = ranked[0]
  const winner = top && top[1] >= ROUTER_FIT_FLOOR ? top[0] : null
  const contested = winner
    ? ranked.filter(([slug, score]) => slug !== winner && top![1] - score <= CONTESTED_POINTS && score >= ROUTER_FIT_FLOOR).map(([slug]) => slug)
    : []

  const rawConfidence = Number((parsed as Record<string, unknown>).confidence)
  const whyValue = (parsed as Record<string, unknown>).why
  return {
    fits,
    winner,
    contested,
    confidence: Number.isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
      ? Math.round(rawConfidence * 100) / 100
      : null,
    why: typeof whyValue === 'string' ? whyValue.trim().slice(0, 400) : '',
  }
}

// ── The ladder ──────────────────────────────────────────────────────────────
//
// Krish, 2026-09-24: "the judges should literally judge, in the machine, before
// it's presented to me for triage with the judges scores. I should always be
// able to review and override on things that score between a 7>9 out of 10 if
// the machine could not find a way to improve the story to get it to a 10/10
// itself first by going deeper, finding contrarian evidence, asking why."
//
// THE SCORE OF A PIECE IS THE MEDIAN OF ITS JUDGES, and specifically the LOWER
// median: the 4th lowest of eight. Never the mean, and no longer the minimum.
//
// The minimum was the rule until 2026-09-24 and it was Krish's own. The reason
// for it was sound — a piece is as good as its worst axis — and the measurement
// killed it anyway. Two runs over the same ten ideas he had graded himself:
//
//   min over 8 judges     mean 3.2 against his 6.0   2 of 10 within a point
//   lower median          mean 5.6 against his 6.0   8 of 10 within a point
//
// The diagnosis is an order statistic, not a rubric. Rewriting the judge that
// was doing the killing moved the panel mean by nothing at all, because a new
// judge immediately took over: dropping ANY single judge other than the killer
// left the mean at 3.2 to one decimal place. With eight independent rubrics
// each roughly two points noisy, at least one lands three points low every
// time, so a minimum samples the tail rather than the quality. The eight
// together already agreed with him; the minimum was throwing that away.
//
// THE LOWER MEDIAN RATHER THAN THE TRUE ONE, for two reasons. It is a pure
// order statistic — one of the judges' actual scores, never two of them
// averaged — so the no-averaging rule holds in spirit and not merely in letter.
// And it agreed with him more often (8 of 10 against 6) while erring slightly
// low, which sends a borderline piece to him rather than passing it unseen.
//
// `weakest` is still the genuinely lowest judge, because that part of his rule
// was right and is what makes the repair brief write itself. The score says how
// good the piece is; the weakest judge says what to fix. They are two questions
// and the old rule answered both with one number.
//
// Ruling (Krish, 2026-09-24): score a piece on the median of the eight judges,
// not the weakest one.
//
// The prosecutor is excluded, as it is everywhere else. It argues for killing,
// so a strong objection would otherwise drag down everything it did its job on.

// CALIBRATED against Krish's own grades, 2026-09-24, not guessed.
//
// He scored ten ideas the panel had judged. His top score was 7 and he never
// went above it, so READY_AT of 9 sat above his ceiling and nothing could ever
// have been ready.
//
// On the lower median these thresholds split his ten 4 ready, 3 to him, 3
// buried. Under the minimum at the original bar it was 0 ready and 9 buried.

/** At or above this, the piece is ready and does not need Krish. His yes. */
export const READY_AT = 7
/** Below this, the piece is buried after its repair attempt. */
export const ESCALATE_FLOOR = 5

export interface Standing {
  /** The lower median of the non-adversarial scores, or null when every judge
   *  abstained. One of the judges' real scores, never two of them averaged. */
  score: number | null
  /** Which judge is genuinely lowest. The repair aims here first, and it is no
   *  longer the same thing as the score: how good it is and what to fix are two
   *  questions, and the old minimum rule answered both with one number. */
  weakest: string | null
  /** What to fix, in the judges' own words, weakest first. Includes the
   *  prosecutor's objection last, because the best counterpoint is usually the
   *  better piece rather than a reason to stop. */
  brief: { judge: string; score: number | null; fix: string }[]
  band: 'ready' | 'repairable' | 'weak' | 'unjudged'
}

export function standing(verdicts: JudgeVerdict[]): Standing {
  const scored = verdicts.filter(v => !v.adversarial && v.score !== null) as Array<JudgeVerdict & { score: number }>
  // Every judge abstaining is not a zero. It means the panel could not read the
  // piece, and treating that as a bad score would bury ideas for a model outage.
  if (!scored.length) return { score: null, weakest: null, brief: [], band: 'unjudged' }

  const sorted = [...scored].sort((a, b) => a.score - b.score)
  // The lower median: index (n-1)/2 floored. For the eight idea judges that is
  // the 4th lowest. Written as an index rather than an average of the two
  // middle scores on purpose — an interpolated median would be a mean of two
  // judges, which is the thing this panel is not allowed to do.
  const score = sorted[Math.floor((sorted.length - 1) / 2)]!.score
  const brief = sorted
    .filter(v => v.score < READY_AT && v.the_one_fix)
    .map(v => ({ judge: v.judge, score: v.score as number | null, fix: v.the_one_fix as string }))
  const prosecutor = verdicts.find(v => v.adversarial && v.the_one_fix)
  if (prosecutor) brief.push({ judge: prosecutor.judge, score: prosecutor.score, fix: prosecutor.the_one_fix as string })

  return {
    score,
    weakest: sorted[0]!.judge,
    brief,
    band: score >= READY_AT ? 'ready' : score >= ESCALATE_FLOOR ? 'repairable' : 'weak',
  }
}
