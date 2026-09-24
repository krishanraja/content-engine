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
//   3. The panel decides only at the extremes, and never in Krish's band.
//      This invariant CHANGED on 2026-09-24 and the change is his, not a
//      drift. It used to read "no route may advance, approve or bin a piece
//      from a verdict. Krish decides; that is the whole contract."
//
//      Ruling (Krish, 2026-09-24): "the judges should literally judge, in the
//      machine, before it's presented to me for triage with the judges scores.
//      I should always be able to review and override on things that score
//      between a 7>9 out of 10 if the machine could not find a way to improve
//      the story to get it to a 10/10 itself first."
//
//      So the contract is now narrower and sharper rather than gone. A piece
//      scoring at or above READY_AT is advanced; one below ESCALATE_FLOOR is
//      buried after its repair attempt, reversibly and with the weakest
//      judge's evidence as the reason. EVERYTHING BETWEEN THOSE TWO IS HIS,
//      and no route may resolve it. That band is the whole point: it is where
//      the machine tried, failed, and has to show its working.
//
//      api/content-ideas/[id]/judge.ts stays pure regardless. It is the
//      on-demand "judge this one" endpoint and it reads without moving
//      anything; the ladder is a separate route and carries the power.
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
import { buildJudgePrompt, parseVerdict, summarise, standing } from '../api/_judges/panel.js'
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

// ── 3b. The ladder decides the ends and never the middle ────────────────────
{
  const ladder = read('api/judge/ladder.ts')

  // The band between the thresholds is Krish's. If this route ever learns to
  // resolve it, the whole arrangement collapses into a machine that picks his
  // work for him, which is the thing he reserved for himself by name.
  assert.match(ladder, /band === 'weak'/, 'the ladder must branch explicitly on the weak band')
  const buryAt = ladder.indexOf('buried_at = ')
  const buryPatch = ladder.indexOf('patch.buried_at')
  assert.ok(buryPatch > 0, 'the ladder must bury through buried_at')
  const weakBranch = ladder.indexOf("if (s.band === 'weak')")
  assert.ok(weakBranch > 0 && buryPatch > weakBranch && buryPatch - weakBranch < 400,
    'the only bury must sit inside the weak branch, never in the escalate band')
  assert.doesNotMatch(ladder, /'repairable'[^\n]*buried|buried[^\n]*'repairable'/,
    'nothing may bury a piece in the band Krish reserved')

  // Reversible, always. A delete would take the row out of the desk's "what
  // you have told me" view and out of detect.ts's reach at the same time.
  assert.doesNotMatch(ladder, /\.delete\(/, 'the ladder must never delete a row: burying is the house archive verb')

  // A bury with no reason is the exact failure the triage desk was rebuilt to
  // stop, and an unattended one is worse because nobody watched it happen.
  assert.match(ladder, /buried_reason/, 'an automatic bury must carry its reason')

  // Two attempts, his number. A cap that drifts upward turns a repair into a
  // rewrite of something he never approved.
  assert.match(ladder, /const MAX_ATTEMPTS = 2/, 'the repair cap must stay at the two attempts Krish set')

  // The calibration join. Without this the weekly compiler has nothing to
  // measure the judges against, which is how the panel sat unmeasured for a
  // year in the first place.
  assert.match(ladder, /panel_run_id/, 'the ladder must record panel_run_id or nothing can be calibrated')

  // A human's subchannel is not the router's to overwrite.
  assert.match(ladder, /if \(!idea\.lane_slot && router\?\.winner/,
    'the router may only set a subchannel that is empty')

  // ── The repair must be able to go and look ────────────────────────────────
  //
  // On the first full ladder run every single repair declined, all ten for the
  // same reason: the judges asked for a named person or a verified figure, the
  // repair pass is forbidden to invent one, and nothing in the path could go
  // and find one. A repairer told not to invent and given no way to look can
  // only ever refuse, so the ladder had a ceiling built in that no rubric
  // change could lift.
  assert.match(ladder, /webResearch/,
    'the repair must be able to research, or it can only ever decline for want of evidence')
  const gatherAt = ladder.indexOf('const found = await gather(')
  const repairAt = ladder.indexOf('await repair(')
  assert.ok(gatherAt > 0 && repairAt > gatherAt,
    'the research must happen BEFORE the repair, or the repair is briefed on nothing')

  // Krish's own research is read from the same field the composer reads, so
  // "research this for me" and "here is my own research" reach the judges
  // through one door rather than two.
  assert.match(ladder, /function ownMaterials/,
    'the ladder must read meta.materials: his own research is the evidence the judges keep asking for')

  // An attempt that declined WITH research in hand is a finished idea. One that
  // declined with none is a missing lookup. A run that cannot tell them apart
  // reports ten identical refusals and teaches nothing, which is what the first
  // run did.
  // EVERY push, not merely one of them: the first version of this assertion
  // matched a single occurrence and passed with the other recording site
  // stripped, which is the "a probe that finds nothing has to be proved able to
  // find something" lesson in AGENTS.md arriving in a new costume.
  const pushes = (ladder.match(/attempts\.push\(\{/g) || []).length
  const marked = (ladder.match(/researched: Boolean\(/g) || []).length
  assert.ok(pushes > 0 && marked === pushes,
    `every attempt must record whether it had research (${marked} of ${pushes} do), or a refusal cannot be read`)

  // Nothing Krish wrote may be exempt from judging for having been written.
  // research-topic.ts — the one route that takes a topic he names or research
  // he brings back himself — writes state 'drafting' WITH a body, so a
  // `body is null` filter here silently excused his own thinking from the panel
  // while judging everything the machine scraped.
  assert.doesNotMatch(ladder, /body\.is\.null/,
    'the ladder must not skip a piece for having a body: that filter excluded every idea Krish researched himself')
  assert.match(ladder, /'seeded', 'researching', 'drafting'/,
    'the ladder must judge drafted pieces too, or the one path carrying his own research bypasses the judges')

  // `ids` sat in the POST body type and in the route's own doc comment from the
  // day it was written, and nothing read it: asking for ten named ideas
  // silently returned an arbitrary ten, with no error and a well-formed
  // response. An advertised option that does nothing is worse than a missing
  // one, because the caller believes it worked.
  assert.match(ladder, /\.in\('id', ids\)/,
    'the ladder must honour the ids it advertises in its own body type, or a named request silently judges something else')

  // Recorded is not the same as reported. The first run to carry `researched`
  // left it out of the response projection, so four repairs that had plainly
  // read the research — and said so in their own stated reason — came back
  // looking like refusals with nothing to work from. A field you cannot read
  // is a field that was never set, as far as anyone measuring is concerned.
  const projection = ladder.slice(ladder.indexOf('attempts: attempts.map('), ladder.indexOf('attempts: attempts.map(') + 500)
  // A repair may never leave a piece worse than it found it. Caught on a live
  // run: an idea the panel scored 7 was "improved", re-judged at 3 on the new
  // wording, and buried on that 3 — so the machine could destroy a good idea by
  // sharpening it and then file the wreck as its own reason for burying it.
  assert.match(ladder, /after\.score < before\.score/,
    'the ladder must compare the repaired score against the one before it')
  const regressAt = ladder.indexOf('after.score < before.score')
  const revertAt = ladder.indexOf('current = previous')
  assert.ok(revertAt > regressAt && revertAt - regressAt < 200,
    'a repair judged worse must restore the earlier wording, not keep the worse one')
  assert.match(ladder, /outcome: 'regressed'/,
    'a repair that went backwards must be recorded as such: it says the brief was wrong, not the idea')

  // Anchored on a word boundary, not a substring: the first version of this
  // assertion passed against `x_researched:`, which is the "a probe that finds
  // nothing has to be proved able to find something" rule catching me a second
  // time in one session.
  for (const field of ['researched', 'sources', 'briefed']) {
    assert.match(projection, new RegExp(`(^|[^A-Za-z0-9_])${field}:`),
      `the response must surface ${field}: a repair's evidence is unreadable without it`)
  }
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

  // ── The score is the lower median, and it is an order statistic ───────────
  //
  // Ruling (Krish, 2026-09-24): score a piece on the median of the eight
  // judges, not the weakest one. The minimum was his own earlier rule and the
  // measurement overturned it — over the same ten ideas he had graded, the
  // minimum landed 2.8 low and agreed with him on 2 of 10, the lower median
  // 0.4 low and 8 of 10. Rewriting the judge doing the killing changed nothing,
  // because with eight noisy rubrics a new one immediately took over: a minimum
  // samples the tail, not the quality.
  //
  // The LOWER median rather than the interpolated one, so the score is always
  // one of the judges' real numbers. An interpolated median of an even panel is
  // a mean of two judges, which the rule above forbids, and the regex would not
  // have caught it written as `(a + b) / 2`.
  assert.match(source, /sorted\[Math\.floor\(\(sorted\.length - 1\) \/ 2\)\]/,
    'the score must be the lower median by index: an interpolated median averages two judges')
  assert.doesNotMatch(source, /const score = sorted\[0\]/,
    'the score must not be the minimum: one miscalibrated rubric would hold a veto over every piece')

  // Proved by running it, not by reading it. Eight judges, one three points
  // below the rest: the minimum would call this a 3, the median calls it a 7,
  // and `weakest` still names the judge to brief the repair on.
  const eight = [3, 7, 7, 7, 8, 8, 9, 9].map((score, i) => ({
    judge: `j${i}`, score, verdict: 'revise' as const, the_one_fix: `fix ${i}`,
    evidence: ['e'], confidence: 0.8, deterministic: false, model: 'm', adversarial: false,
  }))
  const st = standing(eight)
  assert.equal(st.score, 7, 'the lower median of [3,7,7,7,8,8,9,9] is 7, not the minimum 3')
  assert.equal(st.weakest, 'j0', 'the weakest judge must still be named: it is what the repair is briefed on')
  assert.equal(st.band, 'ready', 'one outlier judge must not be able to veto a piece the other seven passed')
  assert.ok(st.brief.some(b => b.judge === 'j0'), "the outlier's fix must still reach the repair brief")

  // An odd panel, and one where the outlier really is the story: five judges
  // agreeing it is weak must still read as weak.
  assert.equal(standing(eight.slice(0, 5)).score, 7, 'the lower median of five is the 3rd lowest')
  const mostlyWeak = [2, 3, 3, 4, 9, 9, 9, 9].map((score, i) => ({ ...eight[0]!, judge: `k${i}`, score }))
  assert.equal(standing(mostlyWeak).score, 4, 'a panel that mostly says weak must score weak')
  assert.equal(standing(mostlyWeak).band, 'weak')
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
  const { validateEditEvent } = await import('../api/_editEvents.js')
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

  // The privacy line: the ledger stores hashes and a bounded diff, never bodies.
  const rules = read('api/_editEvents.ts')
  const route = read('api/content-edits.ts')
  assert.doesNotMatch(rules + route, /\bbody_text\b|\bfull_text\b|transcript/, 'the ledger must never carry a body or a transcript')

  // What decides the evidence must be checkable without the evidence store.
  // Both of these once lived in their route, which imports the database client
  // at module load, so the guard and the test that cover them could only run on
  // a machine that happened to have credentials in its shell. That is not a
  // passing check, it is an unrun one.
  for (const rel of ['api/_editEvents.ts', 'api/learning/_patterns.ts']) {
    const imports = [...read(rel).matchAll(/^\s*import\s[^\n]*?from\s+'([^']+)'/gm)].map(m => m[1])
    const impure = imports.filter(spec => !spec.startsWith('node:'))
    assert.deepEqual(impure, [], `${rel} must import nothing but the node standard library: it has to run with no database, no network and no key`)
  }
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
  // Both ledger writes must be best-effort: the rewrite and the save are the
  // product. Asserted STRUCTURALLY, not textually.
  //
  // This used to pin the literal comment `catch { /* the rewrite is the
  // product`, so improving the wording broke the build while the invariant it
  // guards sat untouched. Same failure as check-inspiration-lane pinning a
  // message's exact sentence, which kept main red for a day on 2026-09-19. A
  // guard tied to a sentence fails every time the sentence improves, which
  // teaches people either to stop improving it or to stop believing the guard.
  //
  // Two invariants now. The second is new, and its absence is a large part of
  // why this table held exactly one row, a smoke test, for a fortnight:
  //
  //   never fatal    the write sits in a try/catch that does not rethrow
  //   never silent   supabase-js RETURNS its errors rather than throwing, so a
  //                  discarded result makes a rejected row indistinguishable
  //                  from a written one, and the catch never fires either
  for (const [what, src] of [['rewrite', revise], ['edit', patch]] as const) {
    const at = src.indexOf("content_edit_events').insert")
    assert.notEqual(at, -1, `the ${what} path must write to the edit ledger`)
    const window = src.slice(Math.max(0, at - 400), at + 1400)
    assert.match(window, /try \{/, `a ledger failure must never cost the ${what}`)
    const caught = /catch\s*(?:\([^)]*\))?\s*\{([\s\S]*?)\n\s*\}/.exec(src.slice(at))
    assert.ok(caught, `the ${what}'s ledger write must be caught`)
    assert.doesNotMatch(caught[1], /\bthrow\b/, `a ledger failure must never cost the ${what}`)
    assert.match(window, /const \{ error \} = await supabase\.from\('content_edit_events'\)\.insert/,
      `the ${what}'s ledger write must read supabase's RETURNED error: insert does not throw one`)
    assert.match(window, /console\.warn/, `a rejected ledger row must be said out loud on the ${what} path`)
  }
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
  // Every action and artifact kind the ledger accepts must exist in the CHECK,
  // or a valid write fails in production and nowhere else.
  const rules = read('api/_editEvents.ts')
  for (const action of ['manual_edit', 'magic_invoked', 'magic_accepted', 'magic_rejected', 'section_kept', 'section_dropped', 'approved', 'binned', 'published', 'external_final_captured']) {
    assert.ok(rules.includes(`'${action}'`), `the ledger does not accept ${action}`)
    assert.ok(migration.includes(`'${action}'`), `the migration does not allow ${action}`)
  }
}

console.log(`PASS  ${IDEA_JUDGES.length} idea judges and ${DRAFT_JUDGES.length} draft judges, each owning one question, evidence mandatory, spread preserved, the panel does not decide, anti-echo held`)
