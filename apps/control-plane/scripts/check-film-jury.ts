// Structural guard for the permanent film jury.
//
// This is intentionally separate from the text-content panel. Film evidence is
// visual, temporal and format-specific, so forcing it through a quote-oriented
// content judge would create false confidence rather than reuse.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  FILM_HARD_GATES,
  FILM_JUDGES,
  FILM_JURY_VERSION,
  buildFilmJudgePrompt,
  summariseFilmJury,
  type FilmHardGateResult,
  type FilmJudgeVerdict,
} from '../api/_judges/film.js'

assert.match(FILM_JURY_VERSION, /^[a-z0-9][a-z0-9._-]{0,39}$/)
assert.ok(FILM_JUDGES.length >= 14, 'a film jury this broad needs enough narrow judges to disagree')
assert.equal(new Set(FILM_JUDGES.map(judge => judge.key)).size, FILM_JUDGES.length, 'film judge keys must be unique')
assert.deepEqual(FILM_JUDGES.filter(judge => judge.adversarial).map(judge => judge.key), ['prosecutor'], 'the film jury must have exactly one prosecutor')

for (const judge of FILM_JUDGES) {
  assert.match(judge.key, /^[a-z][a-z0-9_]{1,39}$/, `${judge.key} is not a stable key`)
  assert.ok(judge.question.endsWith('?'), `${judge.key} does not own a question`)
  assert.equal((judge.question.match(/\?/g) ?? []).length, 1, `${judge.key} owns more than one question`)
  assert.ok(judge.rubric.length > 120, `${judge.key} has no real rubric`)
  assert.ok(judge.evidence.length > 40, `${judge.key} does not demand checkable evidence`)
  const prompt = buildFilmJudgePrompt(judge, 'animatic')
  assert.match(prompt, /THE ONLY QUESTION YOU OWN/, `${judge.key} is not held to one axis`)
  assert.match(prompt, /cannot see the other judges/, `${judge.key} is not independent`)
  assert.match(prompt, /Cite observable evidence/, `${judge.key} may return unsupported opinion`)
  assert.match(prompt, /Never let visual polish rescue unclear meaning/, `${judge.key} can be distracted by craft`)
}

for (const domain of ['idea', 'strategy', 'story', 'craft', 'experience', 'integrity'] as const) {
  assert.ok(FILM_JUDGES.some(judge => judge.domain === domain), `the film jury is missing the ${domain} lens`)
}

const requiredJudges = [
  'idea',
  'business_challenge',
  'mindmake_fit',
  'three_second_read',
  'causal_story',
  'role_identity',
  'business_consequence',
  'art_direction',
  'cinematography_motion',
  'editing_duration',
  'sound_silence',
  'craft_integrity',
  'format_accessibility',
  'integrity',
  'prosecutor',
]
assert.deepEqual(FILM_JUDGES.map(judge => judge.key), requiredJudges, 'the film jury lost one of its distinct lenses')

const requiredGates = [
  'object_only',
  'writing_contract',
  'evidence_honesty',
  'privacy_rights',
  'muted_semantic_chain',
  'human_authority',
  'no_text_rescue',
  'use_context',
]
assert.deepEqual(FILM_HARD_GATES.map(gate => gate.key), requiredGates, 'the film jury lost a release gate')
assert.equal(new Set(requiredGates).size, FILM_HARD_GATES.length, 'film hard gates must be unique')

const visualEvidence = [{ kind: 'frame' as const, locator: 'frame-001', observation: 'The required evidence is directly visible.' }]
const verdicts: FilmJudgeVerdict[] = FILM_JUDGES.map(judge => ({
  judge: judge.key,
  score: judge.adversarial ? 2 : 8,
  verdict: 'pass',
  the_one_fix: null,
  evidence: visualEvidence,
  confidence: 0.9,
  adversarial: judge.adversarial === true,
}))
const gates: FilmHardGateResult[] = FILM_HARD_GATES.map(gate => ({
  gate: gate.key,
  status: 'pass',
  evidence: visualEvidence,
  note: null,
}))
const summary = summariseFilmJury(verdicts, gates)
assert.equal(summary.award_ready, true, 'the release signal cannot be unreachable')
assert.equal(summary.spread.prosecution?.score, 2, 'the prosecutor must remain separate')
assert.notEqual(summary.spread.high?.judge, 'prosecutor', 'the prosecutor cannot raise the endorsement range')

const source = readFileSync(new URL('../api/_judges/film.ts', import.meta.url), 'utf8')
assert.doesNotMatch(source, /\baverage\b\s*[:=]|\bmean(?:_score)?\b\s*[:=]|reduce\([^)]*\+[^)]*\)\s*\//i, 'the film jury must never average disagreement away')
assert.doesNotMatch(source, /callClaude|fetch\(|supabase|process\.env/, 'the film jury core must stay pure and spend nothing')

console.log(`PASS  ${FILM_JUDGES.length} independent film judges, ${FILM_HARD_GATES.length} hard gates, evidence mandatory, no averages, no spend`)
