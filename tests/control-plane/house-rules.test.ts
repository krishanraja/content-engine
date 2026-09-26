import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import { HOUSE_RULES, houseRulesBlock, rulesFor, type Stage } from '../../apps/control-plane/api/_houseRules.js'
import { predictionCheck, publishChecks, publishStatus, readingGrade } from '../../apps/control-plane/api/_publishChecks.js'
import { VOICE_GUARDRAILS } from '../../apps/control-plane/api/_content.js'
import { bodyHash } from '../../apps/control-plane/api/_factGate.js'
import { VOICE_ABSOLUTES } from '../../apps/control-plane/api/_finalPass.js'

// Krish, 2026-09-25: the engine is "a modular set of components that work
// together", and each guideline he gives should reach every stage it touches.
// The registry is the one place a ruling lives; these tests fail when a live
// ruling is recorded but enforced nowhere, or a stage drops one.
// Piece 2 as published in its edition (Krish set 75% on 2026-09-26), and the
// same text as it stood when it passed the fact gate, before he set it.
const PASSED = readFileSync('editions/2026-09-who-picks-your-ai/body.md', 'utf8')
const UNSET = PASSED.replace('How sure we are: 75%.', 'How sure we are: [Krish to set]')
const factsOk = { ok: true, reason: null }

describe('every ruling carries his words and reaches a stage', () => {
  test('each rule has his verbatim words, a date and at least one stage', () => {
    for (const r of HOUSE_RULES) {
      assert.ok(r.said.length > 8, r.id)
      assert.match(r.on, /^\d{4}-\d{2}-\d{2}$/, r.id)
      assert.ok(r.stages.length > 0, r.id)
    }
    assert.equal(new Set(HOUSE_RULES.map(r => r.id)).size, HOUSE_RULES.length)
  })
  test('every writer reads every house-wide writing rule', () => {
    for (const r of rulesFor('write')) assert.ok(VOICE_GUARDRAILS.includes(r.text), r.id)
  })
  test('the final pass checks every final-pass rule', () => {
    for (const r of rulesFor('final_pass')) assert.ok(VOICE_ABSOLUTES.some(a => a.includes(r.text)), r.id)
  })
  test('every publish-check rule has a mechanical check', () => {
    const ids = new Set(publishChecks(PASSED, factsOk).map(c => c.id))
    for (const r of rulesFor('publish_check')) assert.ok(ids.has(r.id), r.id)
  })
  test('both judge gates read the rules for their gate, with the subchannel', async () => {
    process.env.SUPABASE_URL ||= 'http://127.0.0.1:9'
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'not-a-key'
    const { judgeContext } = await import('../../apps/control-plane/api/content-ideas/[id]/judge.js')
    const row = { idea: 'x', thesis: 'y', meta: {}, lane_slot: 'mind_the_gap' }
    const base = { voice: 'V', corpusSlice: 'C', recentIdeas: [], channel: null, row }
    const idea = judgeContext({ ...base, gate: 'idea', sub: null })
    for (const r of rulesFor('judge_idea', 'mind_the_gap')) assert.ok(idea.includes(r.text), `idea gate: ${r.id}`)
    const sub = { slug: 'mind_the_gap', label: 'mind.the.gap', mandate: 'M' }
    const draft = judgeContext({ ...base, gate: 'draft', sub })
    for (const r of rulesFor('judge_draft', 'mind_the_gap')) assert.ok(draft.includes(r.text), `draft gate: ${r.id}`)
    // The overnight ladder builds its own context; it must read the same list.
    assert.match(readFileSync('apps/control-plane/api/judge/ladder.ts', 'utf8'), /houseRulesBlock\('judge_idea', idea\.lane_slot\)/)
  })
  test('a joke pass keeps the writing rules', async () => {
    const { buildHumourSystem } = await import('../../apps/control-plane/api/_humor.js')
    const h = buildHumourSystem({ register: 'witty', voice: '', channelCorpus: '', materialsBlock: '' })
    for (const r of rulesFor('write')) assert.ok(h.includes(r.text), r.id)
  })
  test('the drafter and the rewriter read the rules that belong to their subchannel, and put the house rules above the mandate', async () => {
    const { buildReviseSystem } = await import('../../apps/control-plane/api/_revisePrompt.js')
    const sys = buildReviseSystem({ voice: '', channelCorpus: '', materialsBlock: '', mandate: { label: 'mind.the.gap', text: 'M', slug: 'mind_the_gap' } } as any, { value: 'tighter' } as any)
    assert.ok(sys.includes('fork into different futures'))
    assert.ok(!sys.includes('the mandate wins.`') && sys.includes("Krish's house rules win over both"))
    const draft = readFileSync('apps/control-plane/api/content-ideas/[id]/draft.ts', 'utf8')
    assert.match(draft, /subchannelRulesBlock\('write', sub\.slug\)/)
    assert.match(draft, /Krish's house rules win over both/)
  })
  test('a rule scoped to one subchannel reaches only that subchannel', () => {
    assert.ok(houseRulesBlock('write', 'mind_the_gap').includes('fork into different futures'))
    assert.ok(!houseRulesBlock('write', 'follow_the_money').includes('fork into different futures'))
    assert.ok(!VOICE_GUARDRAILS.includes('fork into different futures'))
  })
  test('the stages named are the stages that exist', () => {
    const stages: Stage[] = ['judge_idea', 'judge_draft', 'write', 'final_pass', 'publish_check', 'visual']
    for (const r of HOUSE_RULES) for (const s of r.stages) assert.ok(stages.includes(s), `${r.id}: ${s}`)
  })
})

describe('the checks before approval, on real text', () => {
  test('piece 2 as it passed the fact gate clears everything but the confidence Krish sets', () => {
    const checks = publishChecks(UNSET, factsOk)
    const failing = publishStatus(checks).failing.map(c => c.id)
    assert.deepEqual(failing, ['CALL'])
    assert.match(checks.find(c => c.id === 'CALL')!.detail, /no confidence yet/)
    assert.ok(readingGrade(PASSED) <= 8)
  })
  test('with Krish\'s 75% set, it is ready, and the fact check still holds', () => {
    // Krish, 2026-09-26: 75%. The confidence is his judgement, not a fact, so
    // setting it leaves the passed check in force (api/_factGate.ts bodyHash).
    const set = PASSED
    assert.ok(set.includes('How sure we are: 75%.') && UNSET !== set)
    assert.equal(publishStatus(publishChecks(set, factsOk)).ok, true)
    assert.equal(bodyHash(UNSET), bodyHash(set))
    const edition = JSON.parse(readFileSync('editions/2026-09-who-picks-your-ai/edition.json', 'utf8'))
    assert.equal(bodyHash(set.trim()), edition.fact_check.body_hash)
    assert.equal(bodyHash(set.replace('75%.', '60%')), bodyHash(set))
  })
  test('only the number is exempt: words added to the confidence line are checked like any other', () => {
    const set = PASSED
    assert.notEqual(bodyHash(set.replace('75%.', '75%, because OpenAI said so.')), bodyHash(set))
    assert.notEqual(bodyHash(set.replace('By 30 September 2027', 'By 30 September 2028')), bodyHash(set))
  })
  test('a fence-sitting confidence warns, and never blocks', () => {
    const at = (n: number) => publishChecks(PASSED.replace('75%.', `${n}%.`), factsOk).find(c => c.id === 'CLEAR_STANCE')!
    assert.equal(at(60).ok, false); assert.equal(at(60).blocking, false); assert.match(at(60).detail, /sitting on the fence/)
    assert.equal(at(75).ok, true)
    assert.equal(publishStatus(publishChecks(PASSED.replace('75%.', '60%.'), factsOk)).ok, true)
  })
  test('the prediction can be a bold paragraph, as piece 1 writes it', () => {
    assert.equal(predictionCheck('**The Call.** By 30 June 2027, Amazon opens a route. Confidence: 70%.').ok, true)
    assert.equal(predictionCheck('**The Call.** Amazon opens a route. Confidence: 70%.').ok, false)
  })
  test('an em dash, an exclamation mark or a "Not X, Y" blocks', () => {
    const ids = (t: string) => publishStatus(publishChecks(t + '\n\n## OUR PREDICTION\n\nBy 1 June 2027, it ships. How sure we are: 60%.', factsOk)).failing.map(c => c.id)
    assert.ok(ids('It shipped — late.').includes('NO_EM_DASH'))
    assert.ok(ids('It shipped late!').includes('NO_EXCLAMATION'))
    assert.ok(!ids('He said "ship it!" and it shipped.').includes('NO_EXCLAMATION'))
    assert.ok(ids("It's not a price cut, it's a land grab.").includes('R2'))
  })
  test('dense writing fails the reading age', () => {
    const dense = 'Notwithstanding considerable institutional heterogeneity, organisational procurement methodologies systematically prioritise interoperability considerations, consequently diminishing comparative evaluation opportunities. '.repeat(4)
    const r7 = publishChecks(dense, factsOk).find(c => c.id === 'R7')!
    assert.ok(!r7.ok && r7.blocking)
    assert.doesNotMatch(r7.detail, /grade/i)
  })
  test('a little above age 12 warns without blocking, and says so in ages', () => {
    // Piece 2 before its line edits read at about 12.5: the formula is rough,
    // so between 12 and 13 is a nudge to shorten sentences, not a refusal.
    const before = readFileSync('tests/fixtures/control-plane/piece2-before-line-edits.md', 'utf8')
    const r7 = publishChecks(before, factsOk).find(c => c.id === 'R7')!
    assert.equal(r7.ok, false); assert.equal(r7.blocking, false)
    assert.match(r7.detail, /about age 12\.5, a little above 12/)
    const plain = 'The cat sat on the mat. It was a warm day. We had tea. '.repeat(10)
    assert.ok(publishChecks(plain, factsOk).find(c => c.id === 'R7')!.ok)
    // Krish's go on the line edits (2026-09-26) brought it to about 11.5.
    assert.ok(publishChecks(PASSED, factsOk).find(c => c.id === 'R7')!.ok, 'the edited edition reads at 12 or under')
  })
  test('each word to explain is listed once', () => {
    const r6 = publishChecks('A token here, two tokens there, the API and an api.', factsOk).find(c => c.id === 'R6')!
    assert.match(r6.detail, /: token, API\.$/)
  })
  test('an unchecked text is never ready, whatever else it passes', () => {
    assert.equal(publishStatus(publishChecks(PASSED, { ok: false, reason: 'not checked' })).ok, false)
  })
  test('the PATCH to approved or published asks the checks', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas.ts', 'utf8')
    assert.match(src, /if \(updates\.state === 'approved' \|\| updates\.state === 'published'\) \{\s*\n\s*const checks = publishChecks\(effective, gate\)/)
    assert.match(src, /reason: 'publish_gate'/)
  })
})
