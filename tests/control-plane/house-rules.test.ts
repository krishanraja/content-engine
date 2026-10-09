import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'vitest'
import { HOUSE_RULES, houseRulesBlock, rulesFor, type Stage } from '../../apps/control-plane/api/_houseRules.js'
import { confidenceOf, predictionCheck, publishChecks, publishStatus, readingGrade } from '../../apps/control-plane/api/_publishChecks.js'
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

describe('a script makes sense out loud and tells one story (walk log F75)', () => {
  test('both rules are live and reach the writers, both judge gates and the final pass', () => {
    for (const id of ['FOR_THE_EAR', 'STORY_ARC']) {
      const r = HOUSE_RULES.find(x => x.id === id)
      assert.ok(r, id)
      assert.equal(r.status, 'live')
      for (const stage of ['write', 'judge_draft', 'final_pass'] as Stage[]) assert.ok(r.stages.includes(stage), `${id} ${stage}`)
    }
  })
  test('the script writer carries the story check and the outro for scripts of a minute or more', async () => {
    const video = await import('../../apps/control-plane/api/_video.js')
    assert.match(video.SCRIPT_STORY, /One opening question/)
    assert.match(video.SCRIPT_STORY, /Never end on the number/)
    assert.match(video.STORY_OUTRO, /makeyourmindup\.ai/)
    for (const f of video.VIDEO_FORMATS.filter(x => x.seconds >= 60)) assert.match(f.shape, /STORY_OUTRO/, f.id)
  })
})

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
  test('clarity and relatable explanations reach words and visuals without weakening the fact gate', () => {
    const clear = HOUSE_RULES.find(r => r.id === 'CRYSTAL_CLEAR')
    const relatable = HOUSE_RULES.find(r => r.id === 'RELATABLE_EXPLANATION')
    assert.ok(clear)
    assert.match(clear.text, /one reasonable reading differs/)
    assert.ok(relatable)
    assert.deepEqual(relatable.stages, ['judge_draft', 'write', 'final_pass', 'visual'])
    assert.match(relatable.text, /keep the underlying fact exact/)
    assert.ok(houseRulesBlock('write').includes(relatable.text))
    assert.ok(houseRulesBlock('visual').includes(relatable.text))
  })
  test('a visual must make a critical point land faster, and the script and channel cut planners read that', () => {
    const r = HOUSE_RULES.find(x => x.id === 'VISUAL_EXPLAINS')
    assert.ok(r)
    assert.equal(r.status, 'live')
    assert.match(r.said, /explain something critical in the article/)
    assert.match(r.text, /real, checked numbers, quotes and evidence/)
    assert.match(r.text, /a reader who sees only the visual understands the point/)
    assert.ok(houseRulesBlock('visual').includes(r.text))
    const video = readFileSync(join(__dirname, '../../apps/control-plane/api/_video.ts'), 'utf8')
    assert.match(video, /houseRulesBlock\('visual'\)/)
    assert.match(video, /houseRulesBlock\('write'\)/)
    const cut = readFileSync(join(__dirname, '../../apps/control-plane/api/content-ideas/[id]/channel-cut.ts'), 'utf8')
    assert.match(cut, /houseRulesBlock\('visual'\)/)
  })
  test('AI agent wording and the money mechanics reach the writers, judges and visuals', () => {
    const term = HOUSE_RULES.find(x => x.id === 'AI_AGENT')
    const money = HOUSE_RULES.find(x => x.id === 'MONEY_MECHANICS')
    assert.ok(term && money)
    assert.match(term.said, /refer to 'robot' as "AI agent"/)
    assert.ok(houseRulesBlock('write').includes(term.text))
    assert.ok(houseRulesBlock('visual').includes(term.text))
    assert.equal(money.scope, 'follow_the_money')
    assert.ok(houseRulesBlock('write', 'follow_the_money').includes(money.text))
    assert.ok(!houseRulesBlock('write', 'mind_the_gap').includes(money.text))
    assert.match(money.text, /where the consumer and the merchant could get stung/)
    const life = HOUSE_RULES.find(x => x.id === 'REAL_LIFE')
    assert.ok(life)
    assert.match(life.said, /real world examples someone would do in real life are gold/)
    assert.ok(houseRulesBlock('visual').includes(life.text) && houseRulesBlock('write').includes(life.text))
  })
  test('artwork that survives Substack carries his words, reaches the visuals, and states the numbers scripts/pages checks, the cover included', () => {
    const r = HOUSE_RULES.find(x => x.id === 'SUBSTACK_FIT')
    assert.ok(r)
    assert.equal(r.status, 'live')
    assert.equal(r.on, '2026-10-05')
    assert.deepEqual(r.stages, ['visual'])
    assert.ok(r.said.includes("Also bear in mind what happens to your artwork when I'm looking at the article in Substack once it's posted."))
    assert.ok(r.said.includes('is there any way around this?'))
    assert.match(r.source, /walk log F64 and F66/)
    // An email with its pictures hidden shows the alt text (walk log F66): the
    // ruling says so, and the page tool writes that view and flags thin alt text.
    assert.ok(r.text.includes('the post makes sense with the pictures off'))
    assert.ok(houseRulesBlock('visual').includes(r.text))
    // The tool and the ruling say the same numbers (walk log F64).
    const build = readFileSync('scripts/pages/build.py', 'utf8')
    const card = readFileSync('scripts/pages/card.py', 'utf8')
    const constant = (src: string, name: string) => Number(new RegExp(`^${name} = (\\d+)`, 'm').exec(src)?.[1])
    const column = constant(card, 'PHONE_COLUMN')
    const read = constant(card, 'MIN_READ_PX')
    const fine = constant(card, 'MIN_FINE_PX')
    assert.deepEqual([column, read, fine], [358, 14, 11])
    const at = (width: number, floor: number) => Math.ceil(floor * width / column)
    assert.ok(r.text.includes(`A phone shows every image about ${column} pixels wide: the cover in the feed`))
    assert.ok(r.text.includes(`${read} pixels or more there, and fine print such as sources at ${fine} or more`))
    assert.ok(r.text.includes(`on the 1200-wide cover, draw words at ${at(1200, read)} pixels or more and fine print at ${at(1200, fine)} or more; on a 1360-wide image, ${at(1360, read)} and ${at(1360, fine)}`))
    // The cover is held to card.py's floors and draws at card.py's sizes,
    // never at a copy of them.
    assert.match(build, /words, fine = card\.needed\(COVER_W\)/)
    assert.match(build, /small = card\.too_small\(words, COVER_W\)/)
    assert.doesNotMatch(build, /^(PHONE_COLUMN|MIN_READ_PX|MIN_FINE_PX) =/m)
    assert.match(build, /^COVER_W, COVER_H = 1200, 800$/m)
    assert.match(build, /^ALT_MIN_WORDS = \d+$/m)
    assert.match(build, /pictures_off\(sub_html, out\)/)
    assert.ok(r.text.includes('The cover is 1200 x 800 (3:2)'))
    const safe = /^COVER_SAFE = \((\d+), (\d+), (\d+), (\d+)\)/m.exec(build)
    assert.ok(safe)
    assert.ok(r.text.includes(`inside x ${safe[1]} to ${safe[3]} and y ${safe[2]} to ${safe[4]}`))
  })
  test('the three questions every piece answers, and real logos with Krish\'s face, reach the stages that make them', () => {
    const lenses = HOUSE_RULES.find(x => x.id === 'THREE_LENSES')
    const faces = HOUSE_RULES.find(x => x.id === 'LOGOS_AND_FACE')
    assert.ok(lenses && faces)
    assert.match(lenses.said, /what this means for someone starting a business or building a business/)
    assert.match(faces.said, /use the real logos for any companies mentioned/)
    for (const stage of ['write', 'judge_draft', 'final_pass', 'visual'] as Stage[]) {
      assert.ok(houseRulesBlock(stage).includes(lenses.text), stage)
    }
    for (const sub of ['follow_the_money', 'mind_the_gap', 'under_the_hood']) {
      assert.ok(houseRulesBlock('write', sub).includes(lenses.text), sub)
    }
    assert.ok(houseRulesBlock('visual').includes(faces.text))
    assert.match(faces.text, /"portrait": true/)
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
  test('piece 1\'s "Confidence: 70%" is read, so the stance is judged on its number', () => {
    // Walk log F35: v10 ends "**The Call.** ... Confidence: 70%." and the
    // check read only "How sure we are:", so CLEAR_STANCE showed green over
    // "No confidence set yet".
    const call = (line: string) => `Amazon's move is about ads.\n\n**The Call.** By 30 June 2027, Amazon opens an authorised route for shopping agents. ${line}`
    assert.equal(confidenceOf(call('Confidence: 70%.')), 70)
    assert.equal(confidenceOf('How sure we are: 75%.'), 75)
    const stance = (line: string) => publishChecks(call(line), factsOk).find(c => c.id === 'CLEAR_STANCE')!
    assert.equal(stance('Confidence: 70%.').ok, true)
    assert.equal(stance('Confidence: 70%.').detail, '70% is a clear stance.')
    assert.equal(stance('Confidence: 60%.').ok, false)
    assert.match(stance('Confidence: 60%.').detail, /sitting on the fence/)
  })
  test('a confidence without its label blocks the call and is never green', () => {
    // The Studio cannot tell which number is the confidence, so the call card
    // could not be drawn: CALL now refuses what the Studio refuses (H32).
    const text = 'Amazon\'s move is about ads.\n\n**The Call.** By 30 June 2027, Amazon opens an authorised route. We are 70% sure.'
    const checks = publishChecks(text, factsOk)
    const call = checks.find(c => c.id === 'CALL')!
    assert.equal(call.ok, false)
    assert.equal(call.blocking, true)
    assert.match(call.detail, /without "How sure we are:"/)
    const stance = checks.find(c => c.id === 'CLEAR_STANCE')!
    assert.equal(stance.ok, false)
    assert.equal(stance.blocking, false)
    const unset = publishChecks(UNSET, factsOk).find(c => c.id === 'CLEAR_STANCE')!
    assert.equal(unset.ok, false)
    assert.equal(unset.detail, 'No confidence set yet.')
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
  test('American spelling blocks; a quotation, a name, a link and look-alike words do not', () => {
    // makeyourmindup.ai, live 2026-09-26: "Contains British spelling".
    const check = (t: string) => publishChecks(t, factsOk).find(c => c.id === 'BRITISH_SPELLING')!
    const us = check('The data center was gray, so we analyzed it, organized a team and cut the modeling bill.')
    assert.equal(us.ok, false); assert.equal(us.blocking, true)
    assert.match(us.detail, /center \(write centre\)/)
    assert.match(us.detail, /analyzed \(write analysed\)/)
    assert.match(check('We utilize it.').detail, /utilize \(write use\)/)
    const fine = check('"We prioritize safety," she said. The Department of Defense and Kennedy Space Center agree. [See](https://example.com/color). `optimize` Its size, the prize, honorary, humorous, rigorous, the laboratory, Colorado, the program, a license, the aftermath.')
    assert.equal(fine.ok, true, fine.detail)
    assert.equal(check(PASSED).ok, true)
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
    // Just over the target reads as over it, never "about age 12, a little
    // above 12" (piece 1 at 12.03, 2026-09-30).
    const justOver = 'The cat sat on the mat. '.repeat(6) + 'Advertising revenue depends on shoppers noticing the sponsored listings. '.repeat(5)
    assert.equal(publishChecks(justOver, factsOk).find(c => c.id === 'R7')!.detail, 'Reads at about age 12.1, a little above 12. Shorten the longest sentences.')
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

describe('the reading age ends a sentence inside a closing quote', () => {
  // Piece 3 quotes its sources word for word. Until 2026-09-30 a sentence
  // ending '..."' ran on into the next, and the piece read a year older than
  // it is (walk log F46).
  test('a quote at the end of a sentence reads the same as no quote', () => {
    const plain = 'The paper says Koa stays below the best models. Tech Times says no one has checked. We agree.'
    const quoted = 'The paper says Koa stays "below the best models." Tech Times says "no one has checked." We agree.'
    assert.equal(readingGrade(quoted).toFixed(6), readingGrade(plain).toFixed(6))
  })
  test('the blocking message gives the age to one decimal, so it never reads "about age 13. Above 13"', () => {
    const long = Array.from({ length: 6 }, () => 'Organisational infrastructure considerations necessitate comprehensive evaluation methodologies, particularly regarding proprietary implementations.').join(' ')
    const r7 = publishChecks(long, factsOk).find(c => c.id === 'R7')!
    assert.equal(r7.blocking, true)
    assert.match(r7.detail, /^Reads at about age \d+\.\d\. Above 13 cannot be approved/)
  })
})

describe('the script is Krish reacting, with opinion and dry wit (VOICE_ON_CAMERA, 2026-10-09)', () => {
  test('the rule is live and reaches the writers, the draft judges and the final pass', () => {
    const r = HOUSE_RULES.find(x => x.id === 'VOICE_ON_CAMERA')
    assert.ok(r)
    assert.equal(r.status, 'live')
    for (const stage of ['write', 'judge_draft', 'final_pass'] as Stage[]) assert.ok(r.stages.includes(stage), stage)
    assert.match(r.text, /my bet/)
    assert.match(r.said, /personality and opinion/)
  })
  test('the script writer carries it as the sixth point of the story check', async () => {
    const video = await import('../../apps/control-plane/api/_video.js')
    assert.match(video.SCRIPT_STORY, /6\. It sounds like Krish, with opinion \(VOICE_ON_CAMERA\)/)
  })
})

describe('the big picture, never the small headline (BIG_PICTURE, 2026-10-09)', () => {
  test('the rule is live and reaches idea judging, draft judging, the writers and the final pass', () => {
    const r = HOUSE_RULES.find(x => x.id === 'BIG_PICTURE')
    assert.ok(r)
    assert.equal(r.status, 'live')
    for (const stage of ['judge_idea', 'judge_draft', 'write', 'final_pass'] as Stage[]) assert.ok(r.stages.includes(stage), stage)
    assert.match(r.said, /ALWAYS remember this/)
  })
})
