import { createHash, randomUUID } from 'node:crypto'
import { callClaude, robustJson } from '../_content.js'
import { JUDGE_MODEL } from '../_models.js'
import { MATERIAL_DISAGREEMENT_POINTS, ROSTER_VERSION, rosterFor, type Gate, type Judge } from './roster.js'

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
  const user = [
    input.gate === 'idea' ? '## The idea' : '## The draft',
    input.artifact,
    '',
    '## Context you may use',
    input.context,
  ].join('\n')

  const results = await Promise.all(roster.map(async judge => {
    try {
      const raw = await callClaude({
        system: buildJudgePrompt(judge, input.gate),
        user,
        model: JUDGE_MODEL,
        maxTokens: 900,
        temperature: 0.2,
        agent: `judge-${judge.key}`,
        ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
      })
      return parseVerdict(judge, raw)
    } catch (e) {
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
