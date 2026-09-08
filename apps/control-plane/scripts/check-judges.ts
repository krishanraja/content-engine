// The panel's own invariants.
//
// A judge panel is easy to build and easy to make worthless. These are the
// properties that separate the two, each of which would otherwise erode
// quietly over a few edits:
//
//   1. One judge, one question. The moment a judge scores two axes, agreement
//      between judges stops meaning anything and the spread becomes noise.
//   2. Evidence is mandatory. A verdict with no citation is an opinion with a
//      number attached.
//   3. The panel does not decide. No route may advance, approve or bin a piece
//      from a verdict. Krish decides; that is the whole contract.
//   4. Anti-echo. Judges score form, craft and evidence. Nothing may rank a
//      candidate higher because Krish showed interest in its subject. This is
//      the same rule check-slate-calibration.ts enforces on the arc scorer, and
//      it matters more here because the panel sees everything.
//   5. Deterministic before paid. The free checks run first and can end the
//      panel, or every duplicate costs six model calls.
//
//   npx tsx scripts/check-judges.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DRAFT_JUDGES, IDEA_JUDGES, ROSTER_VERSION, rosterFor } from '../api/_judges/roster.js'
import { buildJudgePrompt, parseVerdict, summarise } from '../api/_judges/panel.js'
import { deterministicFindings, voiceMechanics } from '../api/_judges/deterministic.js'

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

// ── 1. One judge, one question ──────────────────────────────────────────────
for (const [gate, roster] of [['idea', IDEA_JUDGES], ['draft', DRAFT_JUDGES]] as const) {
  assert.ok(roster.length >= 5, `${gate} panel is too small to disagree with itself`)
  const keys = roster.map(j => j.key)
  assert.equal(new Set(keys).size, keys.length, `${gate} panel has a duplicate judge key`)
  for (const judge of roster) {
    assert.match(judge.key, /^[a-z][a-z0-9_]{1,39}$/, `${judge.key} is not a stable key`)
    assert.ok(judge.question.trim().endsWith('?'), `${judge.key} does not own a question`)
    assert.ok(judge.rubric.length > 120, `${judge.key} has no real rubric`)
    assert.ok(judge.evidence.trim().length > 20, `${judge.key} does not demand evidence`)
    // The rubric has to tell the judge to stay in its lane, or the panel
    // collapses into six general opinions.
    const prompt = buildJudgePrompt(judge, gate)
    assert.match(prompt, /THE ONLY QUESTION YOU OWN/, `${judge.key} is not told which question it owns`)
    assert.match(prompt, /Judge only your question/, `${judge.key} is not told to ignore the other axes`)
    assert.match(prompt, /cannot see the other judges/, `${judge.key} is not told it is blinded`)
  }
  // Exactly one prosecutor: two adversarial judges double-count the objection,
  // none and the panel only ever argues for publishing.
  const adversarial = roster.filter(j => j.adversarial)
  assert.equal(adversarial.length, 1, `${gate} panel must have exactly one prosecutor`)
  assert.equal(adversarial[0]!.key, 'prosecutor')
}
assert.deepEqual(rosterFor('idea'), IDEA_JUDGES)
assert.deepEqual(rosterFor('draft'), DRAFT_JUDGES)
assert.match(ROSTER_VERSION, /^[a-z0-9][a-z0-9._-]{0,39}$/)

// ── 2. Evidence is mandatory ────────────────────────────────────────────────
{
  const judge = IDEA_JUDGES[0]!
  const noEvidence = parseVerdict(judge, JSON.stringify({ score: 9, verdict: 'pass', evidence: [], confidence: 0.9 }))
  assert.equal(noEvidence.verdict, 'abstain', 'a verdict with no evidence must not stand as a score')
  assert.equal(noEvidence.score, null)

  const good = parseVerdict(judge, JSON.stringify({ score: 7.5, verdict: 'revise', the_one_fix: 'sharpen the claim', evidence: ['a prior idea says the same'], confidence: 0.8 }))
  assert.equal(good.verdict, 'revise')
  assert.equal(good.score, 7.5)

  // A malformed reply is an abstention with a reason, never a guessed number:
  // a fabricated score would propagate into calibration and corrupt the
  // panel's own report card.
  for (const bad of ['not json at all', JSON.stringify({ verdict: 'maybe' }), JSON.stringify({ score: 42, verdict: 'pass', evidence: ['x'] })]) {
    const v = parseVerdict(judge, bad)
    assert.equal(v.verdict, 'abstain', `malformed reply must abstain: ${bad.slice(0, 40)}`)
    assert.equal(v.score, null)
    assert.ok(v.the_one_fix, 'an abstention must say why')
  }
}

// ── 3. The panel does not decide ────────────────────────────────────────────
{
  const route = read('api/content-ideas/[id]/judge.ts')
  // It may read the row; it may not move it.
  assert.doesNotMatch(route, /\.update\(|\.upsert\(/, 'the judge route must never mutate the piece it judges')
  assert.doesNotMatch(route, /state:\s*'(approved|dropped|published|review)'/, 'the judge route must never set a state')
  assert.match(route, /Krish decides/, 'the response must say plainly who decides')
  // Deterministic checks run before the paid ones.
  const deterministicAt = route.indexOf('deterministicFindings')
  const panelAt = route.indexOf('runPanel')
  assert.ok(deterministicAt > 0 && panelAt > deterministicAt, 'the free checks must run before the model calls')
}

// ── 4. Anti-echo ────────────────────────────────────────────────────────────
{
  const roster = read('api/_judges/roster.ts')
  assert.match(roster, /ANTI-ECHO/, 'the roster must state the anti-echo rule it lives under')
  for (const judge of [...IDEA_JUDGES, ...DRAFT_JUDGES]) {
    const prompt = buildJudgePrompt(judge, 'idea').toLowerCase()
    assert.match(
      prompt,
      /never score something higher because the subject/,
      `${judge.key} is not told that interest in a subject is not a reason to rank`,
    )
  }
  // The scorer that decides what surfaces must not learn to read the ledger or
  // the verdicts. This is the same shape as check-slate-calibration's rule.
  const scorer = read('api/_arcScore.ts')
  assert.doesNotMatch(scorer, /judge_verdicts|content_edit_events|panel_runs/, 'the arc scorer must not read the panel or the edit ledger: form and craft may inform it, a record of what Krish liked may not')
}

// ── 5. The spread is preserved, never averaged ──────────────────────────────
{
  const verdicts = [
    { judge: 'novelty', score: 9, verdict: 'pass' as const, the_one_fix: null, evidence: ['x'], confidence: 0.9, deterministic: false, model: 'm', adversarial: false },
    { judge: 'buyer', score: 2, verdict: 'kill' as const, the_one_fix: 'wrong reader', evidence: ['y'], confidence: 0.8, deterministic: false, model: 'm', adversarial: false },
    { judge: 'prosecutor', score: 8, verdict: 'kill' as const, the_one_fix: 'derivative', evidence: ['z'], confidence: 0.7, deterministic: false, model: 'm', adversarial: true },
  ]
  const { spread, dissent } = summarise(verdicts)
  assert.equal(dissent, true, 'a pass beside a kill is dissent and must be surfaced')
  assert.equal(spread.low?.judge, 'buyer')
  assert.equal(spread.high?.judge, 'novelty')
  assert.ok(spread.prosecution, 'the prosecution case must be reported separately')
  // The prosecutor argues for killing, so folding its score into the range
  // would make a strong objection look like a strong endorsement.
  assert.notEqual(spread.high?.judge, 'prosecutor', 'the prosecutor must never set the high score')
  assert.deepEqual(spread.kills, ['buyer', 'prosecutor'])
  const source = read('api/_judges/panel.ts')
  assert.doesNotMatch(source, /reduce\([^)]*\+[^)]*\)\s*\/\s*/, 'the panel must not average its judges into one number')
}

// ── 6. The free checks actually catch things ────────────────────────────────
{
  const thin = deterministicFindings({ text: 'too short', minChars: 40 })
  assert.equal(thin[0]?.judge, 'substance')
  assert.equal(thin[0]?.verdict, 'kill')

  const dupe = deterministicFindings({ text: 'x'.repeat(100), minChars: 40, existing: { id: 'abc', idea: 'the same thing' } })
  assert.equal(dupe[0]?.judge, 'duplicate')

  assert.equal(voiceMechanics('A clean sentence that says one thing.'), null)
  const banned = voiceMechanics('Let us delve into the realm of synergy.')
  assert.ok(banned, 'the banned-phrase list must still fire')
  assert.equal(banned?.verdict, 'revise', 'a mechanical voice fault is fixable, not fatal')
}

// ── 7. The ledger refuses a row it cannot attribute ─────────────────────────
{
  const { validateEditEvent } = await import('../api/content-edits.js')
  const base = {
    idempotency_key: '11111111-1111-4111-8111-111111111111',
    subject_table: 'content_ideas', subject_id: 'abc', artifact_kind: 'draft',
    surface: 'composer', client: 'desktop',
  }
  const hash = 'a'.repeat(64)
  assert.equal(validateEditEvent({ ...base, action: 'magic_accepted', after_hash: hash }).ok, false, 'an accept must name what it accepted')
  assert.equal(validateEditEvent({ ...base, action: 'manual_edit', before_hash: hash }).ok, false, 'a change must name its result')
  assert.equal(validateEditEvent({ ...base, action: 'magic_accepted', before_hash: hash, after_hash: hash }).ok, true)
  assert.equal(validateEditEvent({ ...base, action: 'invented_action', after_hash: hash }).ok, false)
  assert.equal(validateEditEvent({ ...base, action: 'manual_edit', after_hash: 'not-a-hash' }).ok, false)
  assert.equal(validateEditEvent({ ...base, action: 'manual_edit', after_hash: hash, instruction: 'x'.repeat(2000) }).ok, false, 'the excerpt bound must hold')

  // The privacy line: the route stores hashes and a bounded diff, never bodies.
  const route = read('api/content-edits.ts')
  assert.doesNotMatch(route, /\bbody_text\b|\bfull_text\b|transcript/, 'the ledger must never carry a body or a transcript')
}

// ── 8. The ledger is actually written from the paths that matter ────────────
// A ledger nothing writes to is worse than no ledger: it reads as evidence of
// absence. These are the three paths that carry the signal, and each one has
// gone unrecorded before.
{
  const patch = read('api/content-ideas.ts')
  assert.match(patch, /content_edit_events/, 'the PATCH choke point must record manual edits: it is the only place that sees what Krish typed over the machine')
  assert.match(patch, /action: 'manual_edit'/, 'a body change must be recorded as a manual edit')
  assert.match(patch, /stateAction === 'published' \? 'published'|updates\.state === 'published' \? 'published'/, 'a publish must be recorded')
  assert.match(patch, /panel_run_id: panelRunId/, 'a decision must bind to the panel that preceded it, or calibration is guesswork')

  const revise = read('api/content-ideas/[id]/revise.ts')
  assert.match(revise, /action: 'magic_invoked'/, 'an invoked edit must be recorded')
  assert.match(revise, /confirmation_state: 'pending'/, 'an invocation is pending until Krish keeps or discards it')
  assert.match(revise, /edit_event_id/, 'the client needs the event id to resolve the invocation to accepted or rejected')
  // Both must be best-effort: the rewrite and the save are the product.
  assert.match(revise, /catch \{ \/\* the rewrite is the product/, 'a ledger failure must never cost the rewrite')
  assert.match(patch, /catch \{ \/\* the edit is the product/, 'a ledger failure must never cost the edit')
}

// ── 9. The migration matches the code ───────────────────────────────────────
{
  const migration = readFileSync(new URL('../../../supabase/migrations/20260909090000_edit_ledger_and_judge_panel.sql', import.meta.url), 'utf8')
  for (const table of ['content_edit_events', 'judge_verdicts', 'panel_runs', 'composer_sessions']) {
    assert.match(migration, new RegExp(`create table public\\.${table}`), `${table} is missing`)
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has no RLS`)
  }
  for (const table of ['content_edit_events', 'judge_verdicts']) {
    assert.match(migration, new RegExp(`${table}_append_only`), `${table} must be append-only: a ledger you can edit is a story`)
  }
  assert.match(migration, /create or replace view public\.judge_calibration/, 'the panel must be measurable against Krish')
  // The advisor caught both of these on the live database minutes after they
  // were created; keep them from coming back.
  assert.match(migration, /security_invoker = true/, 'the ledger views must read with the caller permissions, not the creator\'s')
  assert.match(migration, /revoke execute on function public\.content_edit_events_reject_mutation/, 'the append-only trigger must not also be an anon-callable RPC')
  assert.match(migration, /abstention is not a wrong answer/, 'an abstention must not read as disagreement')
  assert.match(migration, /v\.verdict not in \('pass', 'kill'\) then null/, 'only a pass or a kill is a prediction the action settles')
  // Every action and artifact kind the route accepts must exist in the CHECK,
  // or a valid write fails in production and nowhere else.
  const route = read('api/content-edits.ts')
  const actions = [...route.matchAll(/'([a-z_]+)',?\s*(?=\/\/|$)/gm)].map(m => m[1])
  for (const action of ['manual_edit', 'magic_invoked', 'magic_accepted', 'magic_rejected', 'section_kept', 'section_dropped', 'approved', 'binned', 'published', 'external_final_captured']) {
    assert.ok(route.includes(`'${action}'`), `the route does not accept ${action}`)
    assert.ok(migration.includes(`'${action}'`), `the migration does not allow ${action}`)
  }
  void actions
}

console.log(`PASS  ${IDEA_JUDGES.length} idea judges and ${DRAFT_JUDGES.length} draft judges, each owning one question, evidence mandatory, spread preserved, the panel does not decide, anti-echo held`)
