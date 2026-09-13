// A permanent, independent film jury for Mindmake's explanatory films.
//
// The jury borrows its lenses from the published Cannes Lions Film, Film
// Craft, Creative Strategy, Digital Craft and Integrity criteria, then adds
// the constraints this particular film system must satisfy. It is a benchmark,
// not an affiliation or an imitation of the Cannes Lions judging process.
//
// One judge owns one question. Every verdict must cite an observable frame,
// timecode, artifact or test result. Scores are never averaged: the low, high,
// prosecution and dissent are the useful output. The panel reports; Krish
// decides. Nothing in this module generates footage or spends credits.

export const FILM_JURY_VERSION = 'film-jury-v1'

export type FilmStage = 'style_test' | 'animatic' | 'rough_cut' | 'final'
export type FilmVerdictKind = 'pass' | 'revise' | 'kill' | 'abstain'
export type FilmJudgeDomain = 'idea' | 'strategy' | 'story' | 'craft' | 'experience' | 'integrity'
export type FilmEvidenceKind = 'frame' | 'timecode' | 'metadata' | 'brief' | 'user_test'

export interface FilmJudge {
  /** Stable key used in reports and later calibration. */
  key: string
  /** The published or Mindmake-specific lens this judge owns. */
  domain: FilmJudgeDomain
  /** Exactly one question. */
  question: string
  /** A deliberately narrow scoring instruction. */
  rubric: string
  /** The observable evidence required for a verdict. */
  evidence: string
  /** The prosecutor argues for rejection and is reported separately. */
  adversarial?: boolean
}

export interface FilmEvidence {
  kind: FilmEvidenceKind
  /** A timecode, frame id, filename, test id or similarly checkable locator. */
  locator: string
  /** What is directly observable there. Inference belongs in the verdict. */
  observation: string
}

export interface FilmJudgeVerdict {
  judge: string
  score: number | null
  verdict: FilmVerdictKind
  the_one_fix: string | null
  evidence: FilmEvidence[]
  confidence: number | null
  adversarial: boolean
}

export type FilmHardGateStatus = 'pass' | 'fail' | 'unverified' | 'not_applicable'
export type FilmHardGateEffect = 'kill' | 'revise'

export interface FilmHardGate {
  key: string
  question: string
  effect: FilmHardGateEffect
  evidence: string
}

export interface FilmHardGateResult {
  gate: string
  status: FilmHardGateStatus
  evidence: FilmEvidence[]
  note: string | null
}

export interface FilmJurySummary {
  roster_version: string
  spread: {
    low: { judge: string; score: number } | null
    high: { judge: string; score: number } | null
    kills: string[]
    revisions: string[]
    abstentions: string[]
    prosecution: { score: number | null; the_one_fix: string | null } | null
  }
  hard_gates: {
    failed: string[]
    unverified: string[]
  }
  dissent: boolean
  /** A demanding release signal, never an automatic approval. */
  award_ready: boolean
}

export const FILM_JUDGES: FilmJudge[] = [
  {
    key: 'idea',
    domain: 'idea',
    question: 'Would the film still have a compelling reason to exist without its visual polish?',
    rubric:
      'Score the organising idea, not beauty, production value or novelty of technique. A 10 means one precise and ownable visual proposition makes the subject newly graspable; a 5 means the premise is useful but familiar; a 1 means craft is disguising the absence of an idea. Ignore whether the shots are attractive.',
    evidence: 'State the film in one plain sentence and cite the beat that proves this is the idea actually on screen.',
  },
  {
    key: 'business_challenge',
    domain: 'strategy',
    question: 'Does the film answer a real problem faced by the owner or senior leader it is for?',
    rubric:
      'Score the connection between the film and a decision, anxiety or ambition its intended senior audience genuinely has. A 10 makes a current business problem visible and easier to act on; a 5 is relevant but generic; a 1 is an internal process demonstration with no audience need. Do not reward technical completeness.',
    evidence: 'Name the audience situation and cite the on-screen moment that acknowledges or resolves it.',
  },
  {
    key: 'mindmake_fit',
    domain: 'strategy',
    question: 'Could this film only belong to Mindmake rather than any company selling AI?',
    rubric:
      'Score strategic and brand specificity. A 10 expresses Mindmake as a governed business operating system through its distinctive world, authority model and practical outcomes; a 5 carries the visual identity but a generic AI promise; a 1 could take another logo without changing meaning. Do not confuse palette consistency with strategic ownership.',
    evidence: 'Cite the most Mindmake-specific choice and the most generic choice, using frames or timecodes.',
  },
  {
    key: 'three_second_read',
    domain: 'experience',
    question: 'What does an unfamiliar viewer understand in the first three seconds?',
    rubric:
      'Score the opening read at normal playback speed and without explanatory copy. A 10 establishes the business situation, functional world or productive tension immediately; a 5 establishes a beautiful mechanism but not its job; a 1 supplies only atmosphere. Judge the first three seconds in isolation and do not use later knowledge to rescue them.',
    evidence: 'Cite only evidence visible or audible between 00:00 and 00:03 and state the likely first reading.',
  },
  {
    key: 'causal_story',
    domain: 'story',
    question: 'Can a viewer follow the change from input through bounded work to output?',
    rubric:
      'Score causal legibility rather than the number of events. A 10 lets an unfamiliar viewer track what entered, what distinct work happened, what was retained or rejected and what emerged; a 5 shows a sequence whose logic needs inference; a 1 is a montage of magical motion. Do not let elegance stand in for cause and effect.',
    evidence: 'Cite at least one input, transformation and output at separate locators and explain the observable connection.',
  },
  {
    key: 'role_identity',
    domain: 'story',
    question: 'Is each contributor or division recognisable from the work it visibly performs?',
    rubric:
      'Score functional differentiation after mentally masking every plaque and written label. A 10 gives each role a distinct input, behaviour, tool language, rhythm and output; a 5 depends partly on familiar props or labels; a 1 shows interchangeable machines. Small diegetic labels may confirm meaning but must not manufacture it.',
    evidence: 'For every role shown, cite the visible action and output that identify its job without reading a label.',
  },
  {
    key: 'business_consequence',
    domain: 'strategy',
    question: 'Does the output visibly matter beyond the workshop that produced it?',
    rubric:
      'Score consequence in the outside business world. A 10 makes the practical result unmistakable, such as a prepared conversation, a published communication, a product built to specification or a restored operation; a 5 produces an artifact but leaves its value implicit; a 1 ends when the machine stops moving. Do not infer value from glow or spectacle.',
    evidence: 'Cite the final output and the visual proof of who or what it is for, without relying on narration.',
  },
  {
    key: 'art_direction',
    domain: 'craft',
    question: 'Does every visual choice belong to one coherent and memorable world?',
    rubric:
      'Score production design, material language, composition, scale, palette, props and restraint. A 10 feels authored down to the smallest object and uses detail to strengthen meaning; a 5 is attractive but uneven or decorative; a 1 is a collage of styles. Penalise visual clutter, random infographic shorthand and props that create panic rather than comprehension.',
    evidence: 'Cite two choices that strengthen the world and any choice that breaks or cheapens it.',
  },
  {
    key: 'cinematography_motion',
    domain: 'craft',
    question: 'Do camera and object movement reveal meaning with precision and flair?',
    rubric:
      'Score framing, lens logic, depth, lighting, camera motivation and choreography of moving parts. A 10 guides attention and makes the business logic more vivid; a 5 is polished coverage; a 1 is restless or inert motion disconnected from meaning. Reward theatrical control, not mere movement, and inspect whether important actions remain readable at speed.',
    evidence: 'Cite one movement that clarifies the job and one movement, if present, that competes with comprehension.',
  },
  {
    key: 'editing_duration',
    domain: 'craft',
    question: 'Does every second earn its place for the contexts in which the film will be used?',
    rubric:
      'Score order, pace, shot duration, transitions and practical runtime across website, presentation and talk use. A 10 feels inevitable and can be understood in one viewing; a 5 contains useful material but repeats or rushes key logic; a 1 is either an overlong mood piece or an unreadable burst. Judge the supplied stage, not an imagined later cut.',
    evidence: 'Cite the strongest transition, the weakest or redundant beat and the exact runtime metadata.',
  },
  {
    key: 'sound_silence',
    domain: 'craft',
    question: 'Does the film communicate completely in silence and gain meaning when sound is present?',
    rubric:
      'Score the two obligations separately but answer one question: muted playback must preserve the full explanatory chain, while mechanisms, room tone and restrained music should sharpen hierarchy rather than supply missing meaning. A 10 passes muted and becomes richer with sound; a 5 depends on one mode; a 1 is unintelligible muted or sonically generic.',
    evidence: 'Cite the muted comprehension result and, when an audio stream exists, the sound event that adds the most meaning.',
  },
  {
    key: 'craft_integrity',
    domain: 'craft',
    question: 'Does close inspection reveal a controlled finished film rather than generated approximation?',
    rubric:
      'Score animation, visual effects, continuity, physics, grading, typography where allowed and absence of generative defects. A 10 survives frame-by-frame scrutiny with consistent objects and purposeful transformations; a 5 contains minor repairable drift; a 1 exposes morphing, impossible continuity, faux interfaces or AI artifacts that break trust. Beauty at playback speed is not enough.',
    evidence: 'Cite exact frames or timecodes for continuity, artifacts, physical logic and finish, including a clean example.',
  },
  {
    key: 'format_accessibility',
    domain: 'experience',
    question: 'Will the film remain understandable and usable across its promised formats and access needs?',
    rubric:
      'Score 16:9, vertical and square crop resilience, presentation legibility, reduced-motion behaviour, poster fallback, transcript and accessibility description where the stage requires them. A 10 preserves the essential action and meaning everywhere; a 5 needs format-specific repair; a 1 only works in one ideal playback. Abstain where promised variants do not yet exist.',
    evidence: 'Cite each supplied format or accessibility artifact and name any essential action lost, obscured or still untested.',
  },
  {
    key: 'integrity',
    domain: 'integrity',
    question: 'Can every claim, artifact and production choice withstand a hostile credibility check?',
    rubric:
      'Score truth, provenance, privacy, rights, evidence versus demonstration, and honest presentation of AI-assisted craft. A 10 makes every source and synthetic element traceable and keeps private information absent; a 5 has incomplete records but no misleading claim; a 1 invents operational evidence, hides material provenance or exposes private data. Do not award trust on visual tone.',
    evidence: 'Cite the asset, claim, provenance and redaction records supplied, or identify exactly what is missing.',
  },
  {
    key: 'prosecutor',
    domain: 'idea',
    question: 'What is the strongest reason this film should not ship?',
    rubric:
      'You are not balanced. Make the strongest single case that the film is beautiful but pointless, confusing, generic, untrustworthy, unusable or strategically wrong. Score your objection: 10 means it is fatal at this stage and 1 means the film survives the best attack. Do not repeat a list of minor notes and do not reward effort already spent.',
    evidence: 'State one prosecution case, cite the decisive observable evidence and name the smallest condition that would defeat it.',
    adversarial: true,
  },
]

export const FILM_HARD_GATES: FilmHardGate[] = [
  {
    key: 'object_only',
    question: 'Is the film free of people, faces, hands, silhouettes, skin, human reflections, robots and anthropomorphic AI?',
    effect: 'kill',
    evidence: 'Record the inspection method and cite every exception, or the sampled or exhaustive frames that were clean.',
  },
  {
    key: 'writing_contract',
    question: 'Is visible writing limited to approved diegetic division plaques and the designed sign-off stamp?',
    effect: 'kill',
    evidence: 'Cite every readable or writing-like mark and classify it as approved, removable or prohibited.',
  },
  {
    key: 'evidence_honesty',
    question: 'Are real evidence, generated illustration and reconstructed demonstration unmistakably separated?',
    effect: 'kill',
    evidence: 'Bind every evidential artifact to provenance and identify any synthetic or reconstructed element.',
  },
  {
    key: 'privacy_rights',
    question: 'Are private information, unapproved likenesses and unlicensed assets absent?',
    effect: 'kill',
    evidence: 'Cite the redaction and rights inspection, including any unresolved source or identifier.',
  },
  {
    key: 'muted_semantic_chain',
    question: 'Can an unfamiliar viewer understand input, work, output and consequence while muted?',
    effect: 'revise',
    evidence: 'Cite a muted comprehension test and the beats viewers could and could not state accurately.',
  },
  {
    key: 'human_authority',
    question: 'Does the final consequential decision remain visibly unresolved for human approval?',
    effect: 'revise',
    evidence: 'Cite the empty decision position, unresolved control or approved sign-off device and prove no action proceeds beyond it.',
  },
  {
    key: 'no_text_rescue',
    question: 'Does the visual story remain understandable when the approved plaque and stamp are masked?',
    effect: 'revise',
    evidence: 'Record the masked test and cite the non-written cues that still identify the work and result.',
  },
  {
    key: 'use_context',
    question: 'Has the film been proven in every website, presentation and talk context claimed for this release?',
    effect: 'revise',
    evidence: 'Cite the actual playback, crop, poster, reduced-motion and accessibility checks relevant to the release stage.',
  },
]

const VERDICTS = new Set<FilmVerdictKind>(['pass', 'revise', 'kill', 'abstain'])
const EVIDENCE_KINDS = new Set<FilmEvidenceKind>(['frame', 'timecode', 'metadata', 'brief', 'user_test'])

function abstention(judge: FilmJudge, why: string): FilmJudgeVerdict {
  return {
    judge: judge.key,
    score: null,
    verdict: 'abstain',
    the_one_fix: why.slice(0, 600),
    evidence: [],
    confidence: null,
    adversarial: judge.adversarial === true,
  }
}

function parseObject(raw: string | Record<string, unknown>): Record<string, unknown> | null {
  if (typeof raw !== 'string') return raw && !Array.isArray(raw) ? raw : null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

/** Strict parsing prevents a fluent but unsupported opinion becoming a score. */
export function parseFilmVerdict(judge: FilmJudge, raw: string | Record<string, unknown>): FilmJudgeVerdict {
  const parsed = parseObject(raw)
  if (!parsed) return abstention(judge, 'the judge did not return one JSON object')

  const verdict = String(parsed.verdict ?? '').toLowerCase() as FilmVerdictKind
  if (!VERDICTS.has(verdict)) return abstention(judge, `the judge returned an unknown verdict: ${verdict.slice(0, 40)}`)
  if (verdict === 'abstain') return abstention(judge, String(parsed.the_one_fix ?? 'the judge could not assess this stage'))

  const score = Number(parsed.score)
  if (!Number.isFinite(score) || score < 0 || score > 10) return abstention(judge, 'the judge returned a score outside 0 to 10')

  const rawEvidence = Array.isArray(parsed.evidence) ? parsed.evidence : []
  const evidence = rawEvidence.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const value = item as Record<string, unknown>
    const kind = String(value.kind ?? '') as FilmEvidenceKind
    const locator = typeof value.locator === 'string' ? value.locator.trim().slice(0, 160) : ''
    const observation = typeof value.observation === 'string' ? value.observation.trim().slice(0, 600) : ''
    return EVIDENCE_KINDS.has(kind) && locator && observation ? [{ kind, locator, observation }] : []
  }).slice(0, 12)
  if (!evidence.length) return abstention(judge, 'the judge returned no checkable visual, artifact or test evidence')

  const rawFix = parsed.the_one_fix
  const the_one_fix = typeof rawFix === 'string' && rawFix.trim() ? rawFix.trim().slice(0, 600) : null
  const rawConfidence = Number(parsed.confidence)
  const confidence = Number.isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
    ? Math.round(rawConfidence * 100) / 100
    : null

  return {
    judge: judge.key,
    score: Math.round(score * 100) / 100,
    verdict,
    the_one_fix,
    evidence,
    confidence,
    adversarial: judge.adversarial === true,
  }
}

export function buildFilmJudgePrompt(judge: FilmJudge, stage: FilmStage): string {
  return [
    `You are one independent film judge reviewing a ${stage.replace('_', ' ')} for Mindmake.`,
    '',
    `THE ONLY QUESTION YOU OWN: ${judge.question}`,
    '',
    judge.rubric,
    '',
    'Rules:',
    '- Judge only your question. Other judges own the other axes.',
    '- You cannot see the other judges and they cannot see you. Do not guess a consensus.',
    '- Cite observable evidence. Separate what is visible or audible from what you infer.',
    '- Never let visual polish rescue unclear meaning, and never punish an early-stage artifact for deliverables not due at its stage.',
    '- Judge the artifact supplied, not the better film you imagine it could become.',
    `- Evidence required: ${judge.evidence}`,
    '- If the supplied evidence cannot answer your question, abstain and say exactly what is missing.',
    '',
    'Return one JSON object and nothing else:',
    '{"score": 0-10, "verdict": "pass"|"revise"|"kill"|"abstain", "the_one_fix": "one change or null",',
    ' "evidence": [{"kind": "frame"|"timecode"|"metadata"|"brief"|"user_test", "locator": "checkable locator", "observation": "direct observation"}], "confidence": 0-1}',
  ].join('\n')
}

/** Validate a complete independent panel before treating it as a panel. */
export function validateFilmJuryVerdicts(verdicts: FilmJudgeVerdict[]): void {
  const expected = FILM_JUDGES.map(judge => judge.key)
  const actual = verdicts.map(verdict => verdict.judge)
  if (new Set(actual).size !== actual.length) throw new Error('film jury contains a duplicate verdict')
  const missing = expected.filter(key => !actual.includes(key))
  const unknown = actual.filter(key => !expected.includes(key))
  if (missing.length || unknown.length) {
    throw new Error(`film jury roster mismatch: missing ${missing.join(', ') || 'none'}; unknown ${unknown.join(', ') || 'none'}`)
  }
  for (const verdict of verdicts) {
    if (verdict.verdict !== 'abstain' && !verdict.evidence.length) throw new Error(`${verdict.judge} has no evidence`)
  }
}

/** Preserve disagreement and the prosecution. Never collapse judges to a mean. */
export function summariseFilmJury(
  verdicts: FilmJudgeVerdict[],
  hardGates: FilmHardGateResult[],
): FilmJurySummary {
  validateFilmJuryVerdicts(verdicts)

  const expectedGates = FILM_HARD_GATES.map(gate => gate.key)
  const suppliedGates = hardGates.map(result => result.gate)
  if (new Set(suppliedGates).size !== suppliedGates.length) throw new Error('film jury contains a duplicate hard gate')
  const missingGates = expectedGates.filter(key => !suppliedGates.includes(key))
  const unknownGates = suppliedGates.filter(key => !expectedGates.includes(key))
  if (missingGates.length || unknownGates.length) {
    throw new Error(`film jury gate mismatch: missing ${missingGates.join(', ') || 'none'}; unknown ${unknownGates.join(', ') || 'none'}`)
  }

  const scored = verdicts.filter(verdict => verdict.score !== null && !verdict.adversarial) as Array<FilmJudgeVerdict & { score: number }>
  const sorted = [...scored].sort((a, b) => a.score - b.score)
  const low = sorted[0] ? { judge: sorted[0].judge, score: sorted[0].score } : null
  const high = sorted.length ? { judge: sorted[sorted.length - 1]!.judge, score: sorted[sorted.length - 1]!.score } : null
  const prosecutor = verdicts.find(verdict => verdict.adversarial) ?? null
  const kills = verdicts.filter(verdict => verdict.verdict === 'kill').map(verdict => verdict.judge)
  const revisions = verdicts.filter(verdict => verdict.verdict === 'revise').map(verdict => verdict.judge)
  const abstentions = verdicts.filter(verdict => verdict.verdict === 'abstain').map(verdict => verdict.judge)
  const failed = hardGates.filter(result => result.status === 'fail').map(result => result.gate)
  const unverified = hardGates.filter(result => result.status === 'unverified').map(result => result.gate)
  const verdictKinds = new Set(scored.map(verdict => verdict.verdict))
  const dissent = Boolean(low && high && high.score - low.score >= 4)
    || (verdictKinds.has('pass') && verdictKinds.has('kill'))

  const prosecutorControlled = prosecutor?.score !== null && prosecutor?.score !== undefined && prosecutor.score <= 3
  const everyCraftBarMet = scored.length === FILM_JUDGES.filter(judge => !judge.adversarial).length
    && scored.every(verdict => verdict.score >= 8 && verdict.verdict === 'pass')
  const award_ready = failed.length === 0
    && unverified.length === 0
    && hardGates.every(result => result.status === 'pass' || result.status === 'not_applicable')
    && abstentions.length === 0
    && kills.length === 0
    && revisions.length === 0
    && everyCraftBarMet
    && prosecutorControlled

  return {
    roster_version: FILM_JURY_VERSION,
    spread: {
      low,
      high,
      kills,
      revisions,
      abstentions,
      prosecution: prosecutor ? { score: prosecutor.score, the_one_fix: prosecutor.the_one_fix } : null,
    },
    hard_gates: { failed, unverified },
    dissent,
    award_ready,
  }
}
