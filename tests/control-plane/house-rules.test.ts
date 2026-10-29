import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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
const UNSET = PASSED.replace('How sure we are: 75%.', 'How sure we are: [to set]')
const factsOk = { ok: true, reason: null }
// Krish, 2026-10-19: a call must fall within 92 days. PASSED is due 30 September 2027 and
// the Call in the other fixtures 30 June 2027, so a fixed `now` keeps each inside the window.
const NOW_SEP = new Date('2027-07-15T12:00:00Z')
const NOW_JUN = new Date('2027-04-15T12:00:00Z')

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
    assert.deepEqual(relatable.stages, ['judge_draft', 'write', 'final_pass'])
    assert.match(relatable.text, /keep the underlying fact exact/)
    assert.ok(houseRulesBlock('write').includes(relatable.text))
    // Krish, 2026-10-16: "I don't think the visuals should have analogies in them": no analogy reaches the picture stage.
    assert.ok(!houseRulesBlock('visual').includes(relatable.text))
  })
  test('analogies live in the spoken scripts; the article and the pictures show the real product (Krish, 2026-10-16)', () => {
    const r = HOUSE_RULES.find(x => x.id === 'ANALOGY_IN_SCRIPTS_ONLY')
    assert.ok(r)
    assert.match(r.said, /The visuals should look like genuine reviews of the actual product, with statistics/)
    assert.match(r.said, /The article should remain slightly more professional/)
    for (const stage of ['write', 'judge_draft', 'final_pass', 'visual'] as const) assert.ok(houseRulesBlock(stage).includes(r.text), stage)
    assert.match(HOUSE_RULES.find(x => x.id === 'VISUAL_EXPLAINS')!.text, /genuine review/)
    // The visual gate refuses a picture that does not say what real thing it shows.
    assert.match(readFileSync(join(__dirname, '../../scripts/post-pack/visual_gate.py'), 'utf8'), /def real_thing_problems/)
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
    const stages: Stage[] = ['judge_idea', 'judge_draft', 'write', 'final_pass', 'publish_check', 'visual', 'production']
    for (const r of HOUSE_RULES) for (const s of r.stages) assert.ok(stages.includes(s), `${r.id}: ${s}`)
  })
  test('a production rule is enforced by the tools its source names, and those tools exist', () => {
    // No prompt reads the production stage, so a rule there is enforced
    // somewhere only when a tool holds it: its source must name that tool.
    const production = rulesFor('production')
    assert.ok(production.length > 0)
    for (const r of production) {
      const tools = r.source.match(/\b(?:scripts|config|apps)\/[\w./\-\[\]]+\.(?:py|ts|json)\b/g) || []
      assert.ok(tools.length > 0, `${r.id} names no tool that enforces it`)
      for (const tool of tools) assert.ok(existsSync(tool), `${r.id}: ${tool} does not exist`)
    }
  })
})

describe('the checks before approval, on real text', () => {
  test('piece 2 as it passed the fact gate clears everything but the confidence Krish sets (CALL, CALL_HORIZON and CLEAR_STANCE block)', () => {
    const checks = publishChecks(UNSET, factsOk, NOW_SEP)
    const failing = publishStatus(checks).failing.map(c => c.id)
    assert.deepEqual(failing, ['CALL', 'CALL_HORIZON', 'CLEAR_STANCE'])
    assert.match(checks.find(c => c.id === 'CALL')!.detail, /no confidence yet/)
    assert.ok(readingGrade(PASSED) <= 8)
  })
  test('with a clear 85% set and the call within 92 days, it is ready, and the fact check still holds', () => {
    // Krish, 2026-09-26: 75%. The confidence is his judgement, not a fact, so
    // setting it leaves the passed check in force (api/_factGate.ts bodyHash).
    const set = PASSED
    assert.ok(set.includes('How sure we are: 75%.') && UNSET !== set)
    const clear = set.replace('75%.', '85%.')
    assert.equal(publishStatus(publishChecks(clear, factsOk, NOW_SEP)).ok, true)
    // Krish, 2026-10-19: 75% is now a fence-sit and blocks; a year-out call is held by CALL_HORIZON.
    assert.deepEqual(publishStatus(publishChecks(set, factsOk, NOW_SEP)).failing.map(c => c.id), ['CLEAR_STANCE'])
    assert.deepEqual(publishStatus(publishChecks(clear, factsOk, new Date('2026-10-19T12:00:00Z'))).failing.map(c => c.id), ['CALL_HORIZON'])
    assert.equal(bodyHash(UNSET), bodyHash(set))
    const edition = JSON.parse(readFileSync('editions/2026-09-who-picks-your-ai/edition.json', 'utf8'))
    assert.equal(bodyHash(set.trim()), edition.fact_check.body_hash)
    assert.equal(bodyHash(set.replace('75%.', '60%')), bodyHash(set))
  })
  test('a piece that names Krish is held, in any spelling, with no override (house rule NO_NAME)', () => {
    // Krish, 2026-10-28: "Remember, no content refers to Krish, ever."
    const clear = PASSED.replace('75%.', '85%.')
    const failing = (t: string) => publishStatus(publishChecks(t, factsOk, NOW_SEP)).failing.map(c => c.id)
    assert.deepEqual(failing(clear), [])
    for (const named of [`By Krish Raja\n\n${clear}`, clear.replace('## OUR PREDICTION', "Krish's test showed it.\n\n## OUR PREDICTION"), `${clear}\n\nMore at krishraja.com`]) {
      assert.deepEqual(failing(named), ['NO_NAME'], named.slice(0, 40))
    }
    const check = publishChecks(`By Krish Raja. ${clear}`, factsOk, NOW_SEP).find(c => c.id === 'NO_NAME')!
    assert.equal(check.blocking, true)
    assert.match(check.detail, /"Krish Raja"/)
    // The old placeholder named him; the one drafts carry now does not.
    assert.ok(failing(PASSED.replace('How sure we are: 75%.', 'How sure we are: [Krish to set]')).includes('NO_NAME'))
    assert.ok(!failing(UNSET).includes('NO_NAME'))
  })
  test('only the number is exempt: words added to the confidence line are checked like any other', () => {
    const set = PASSED
    assert.notEqual(bodyHash(set.replace('75%.', '75%, because OpenAI said so.')), bodyHash(set))
    assert.notEqual(bodyHash(set.replace('By 30 September 2027', 'By 30 September 2028')), bodyHash(set))
  })
  test('a fence-sitting confidence now blocks, and only 80% or more is a clear stance', () => {
    const at = (n: number) => publishChecks(PASSED.replace('75%.', `${n}%.`), factsOk, NOW_SEP).find(c => c.id === 'CLEAR_STANCE')!
    assert.equal(at(60).ok, false); assert.equal(at(60).blocking, true); assert.match(at(60).detail, /sitting on the fence/)
    assert.equal(at(75).ok, false)
    assert.equal(at(79).ok, false)
    assert.equal(at(80).ok, true)
    assert.equal(at(85).ok, true)
    assert.equal(publishStatus(publishChecks(PASSED.replace('75%.', '60%.'), factsOk, NOW_SEP)).ok, false)
  })
  test('the call must fall after today and within 92 days (CALL_HORIZON blocks)', () => {
    const body = PASSED.replace('75%.', '85%.')
    const horizon = (now: Date) => publishChecks(body, factsOk, now).find(c => c.id === 'CALL_HORIZON')!
    assert.equal(horizon(NOW_SEP).ok, true)
    assert.equal(horizon(NOW_SEP).blocking, true)
    const far = horizon(new Date('2026-10-19T12:00:00Z'))
    assert.equal(far.ok, false)
    assert.match(far.detail, /days away/)
    assert.equal(horizon(new Date('2027-10-01T12:00:00Z')).ok, false)
  })
  test('piece 1\'s "Confidence: 85%" is read, so the stance is judged on its number', () => {
    // Walk log F35: v10 ends "**The Call.** ... Confidence: 70%." and the
    // check read only "How sure we are:", so CLEAR_STANCE showed green over
    // "No confidence set yet". The label is still read; the bar is now 80%.
    const call = (line: string) => `Amazon's move is about ads.\n\n**The Call.** By 30 June 2027, Amazon opens an authorised route for shopping agents. ${line}`
    assert.equal(confidenceOf(call('Confidence: 70%.')), 70)
    assert.equal(confidenceOf('How sure we are: 75%.'), 75)
    const stance = (line: string) => publishChecks(call(line), factsOk, NOW_JUN).find(c => c.id === 'CLEAR_STANCE')!
    assert.equal(stance('Confidence: 85%.').ok, true)
    assert.equal(stance('Confidence: 85%.').detail, '85% is a clear stance.')
    assert.equal(stance('Confidence: 70%.').ok, false)
    assert.match(stance('Confidence: 70%.').detail, /sitting on the fence/)
  })
  test('a confidence without its label blocks the call and is never green', () => {
    // The Studio cannot tell which number is the confidence, so the call card
    // could not be drawn: CALL now refuses what the Studio refuses (H32).
    const text = 'Amazon\'s move is about ads.\n\n**The Call.** By 30 June 2027, Amazon opens an authorised route. We are 70% sure.'
    const checks = publishChecks(text, factsOk, NOW_JUN)
    const call = checks.find(c => c.id === 'CALL')!
    assert.equal(call.ok, false)
    assert.equal(call.blocking, true)
    assert.match(call.detail, /without "How sure we are:"/)
    const stance = checks.find(c => c.id === 'CLEAR_STANCE')!
    assert.equal(stance.ok, false)
    assert.equal(stance.blocking, true)
    const unset = publishChecks(UNSET, factsOk, NOW_SEP).find(c => c.id === 'CLEAR_STANCE')!
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
    assert.match(src, /if \(updates\.state === 'approved' \|\| updates\.state === 'published'\) \{\s*\n\s*const checks = publishChecks\(effective, gate, new Date\(\), id\)/)
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

describe('no line saying it was made with AI (NO_AI_DISCLOSURE_LINE, 2026-10-12)', () => {
  test('the rule is live, carries his words and reaches the writers, the draft judges and the final pass', () => {
    const r = HOUSE_RULES.find(x => x.id === 'NO_AI_DISCLOSURE_LINE')
    assert.ok(r)
    assert.equal(r.status, 'live')
    for (const stage of ['write', 'judge_draft', 'final_pass'] as Stage[]) assert.ok(r.stages.includes(stage), stage)
    assert.match(r.said, /Eliminate the "I made this with AI" entirely - no need, it's like verbal diahorrea/)
    assert.match(r.said, /correct, make that a rule/)
  })
  test('no stage asks for the line any more: VOICE_ON_CAMERA no longer says "it is made with Claude, say so"', () => {
    const stages: Stage[] = ['judge_idea', 'judge_draft', 'write', 'final_pass', 'publish_check', 'visual', 'production']
    for (const stage of stages) {
      const block = houseRulesBlock(stage)
      assert.doesNotMatch(block, /made with Claude, say so|\(it is made with Claude/i, stage)
    }
    const voice = HOUSE_RULES.find(x => x.id === 'VOICE_ON_CAMERA')!
    assert.match(voice.text, /never that it is made with AI or with Claude/)
    assert.match(voice.said, /2026-10-12/)
    for (const stage of ['write', 'judge_draft', 'final_pass'] as Stage[]) assert.match(houseRulesBlock(stage), /never says that it, the video or the publication was made with AI/, stage)
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

describe('a script is only the words, opening on a provocation and closing on the article (SCRIPT_ONLY, HOOK_AND_CTA, 2026-10-09)', () => {
  test('both rules are live and reach the writers and the final pass', () => {
    for (const id of ['SCRIPT_ONLY', 'HOOK_AND_CTA']) {
      const r = HOUSE_RULES.find(x => x.id === id)
      assert.ok(r, id)
      assert.equal(r.status, 'live')
      for (const stage of ['write', 'final_pass'] as Stage[]) assert.ok(r.stages.includes(stage), `${id} ${stage}`)
    }
    assert.match(HOUSE_RULES.find(x => x.id === 'SCRIPT_ONLY')!.said, /literally just scripts/)
    assert.match(HOUSE_RULES.find(x => x.id === 'HOOK_AND_CTA')!.text, /makeyourmindup\.ai/)
  })
  test('the script writer keeps "say" to spoken words and its close sends people to the deep dive', async () => {
    const video = await import('../../apps/control-plane/api/_video.js')
    assert.match(video.STORY_OUTRO, /full deep dive/)
    assert.match(video.SCRIPT_STORY, /HOOK_AND_CTA/)
    assert.doesNotMatch(video.SCRIPT_STORY, /Offer two options for each joke, marked/)
  })
})

describe('two cuts, each from its own script, inside the lengths story_check holds (TWO_CUTS, Krish, 2026-10-11)', () => {
  test('the rule is live, says each cut has its own script, and reaches the writers', () => {
    const r = HOUSE_RULES.find(x => x.id === 'TWO_CUTS')
    assert.ok(r)
    assert.equal(r.status, 'live')
    assert.match(r.text, /each recorded from its own script with its own hook and its own outro/)
    assert.doesNotMatch(r.text, /one recording/)
    for (const stage of ['write', 'final_pass'] as Stage[]) assert.ok(r.stages.includes(stage), stage)
  })
  test('the writer aims the 3min and 90s formats inside the cut lengths, and asks again above the ceiling it states', async () => {
    const video = await import('../../apps/control-plane/api/_video.js')
    const client = await import('../../apps/control-plane/lib/contentEngine.js')
    const check = readFileSync('scripts/post-pack/story_check.py', 'utf8')
    const bounds = (cut: string) => {
      const m = new RegExp(`'${cut}':\\s*\\((\\d+),\\s*(\\d+)`).exec(check)
      assert.ok(m, cut)
      return [Number(m[1]), Number(m[2])]
    }
    for (const [id, cut, ceiling] of [['5min', 'long', 825], ['90s', 'short', 195]] as const) {
      const f = video.VIDEO_FORMATS.find(x => x.id === id)!
      const [lo, hi] = bounds(cut)
      assert.ok(f.words >= lo && f.words <= hi, `${id} target ${f.words} inside ${lo}-${hi}`)
      assert.equal(video.wordCeiling(f), ceiling, id)
      assert.ok(video.wordCeiling(f) <= hi, `${id} ceiling inside ${hi}`)
      assert.equal(client.VIDEO_FORMATS.find(x => x.id === id)?.words, f.words, `${id} picker matches the server`)
    }
  })
})

describe('TikTok is a standing channel (Krish, 2026-10-11)', () => {
  test('it can be ticked, every live subchannel pre-ticks the standing set, and a caption can be cut for it', async () => {
    const client = await import('../../apps/control-plane/lib/contentEngine.js')
    assert.deepEqual(client.MEDIA_CHANNELS.find(c => c.value === 'tiktok'), { value: 'tiktok', label: 'TikTok', shortForm: true })
    for (const slot of ['follow_the_money', 'mind_the_gap', 'under_the_hood']) {
      assert.deepEqual(client.DEFAULT_CHANNELS[`publication:${slot}`], ['substack', 'youtube', 'instagram', 'tiktok'], slot)
    }
    const cut = readFileSync(join(__dirname, '../../apps/control-plane/api/content-ideas/[id]/channel-cut.ts'), 'utf8')
    assert.match(cut, /VALID_CHANNELS = new Set\(\[[^\]]*'tiktok'/)
    assert.match(cut, /tiktok: 'Write the TikTok caption for the 90-second short cut/)
    const capture = readFileSync(join(__dirname, '../../apps/control-plane/api/content-ideas.ts'), 'utf8')
    assert.match(capture, /CAPTURE_CHANNELS = \[[^\]]*'tiktok'/)
  })
})

describe('real logos, real pages, and a cover with personality (VISUAL_EVIDENCE, 2026-10-10)', () => {
  test('the rule is live and reaches the visual stage, the writers and the draft judges', () => {
    const r = HOUSE_RULES.find(x => x.id === 'VISUAL_EVIDENCE')
    assert.ok(r)
    assert.equal(r.status, 'live')
    for (const stage of ['visual', 'write', 'judge_draft'] as Stage[]) assert.ok(r.stages.includes(stage), stage)
    assert.match(r.said, /literal gate/)
    assert.match(r.text, /Brandfetch/)
    assert.match(r.source, /visual_gate\.py/)
  })
})

describe('the sting, the music bed and a thumbnail for every size (Krish, 2026-10-12)', () => {
  const rule = (id: string) => {
    const r = HOUSE_RULES.find(x => x.id === id)
    assert.ok(r, id)
    return r
  }
  const VIDEO_RULES = ['INTRO_STING', 'MUSIC_BED', 'THUMBNAIL_EVERY_SIZE']
  test('all three are live, dated, in his words, and on the production stage only', () => {
    for (const id of VIDEO_RULES) {
      const r = rule(id)
      assert.equal(r.status, 'live', id)
      assert.equal(r.on, '2026-10-12', id)
      assert.deepEqual(r.stages, ['production'], id)
      assert.ok(rulesFor('production').includes(r), id)
    }
    assert.ok(rule('INTRO_STING').said.includes('1-2 sec animated make your mind up intro visual before my face comes in'))
    assert.ok(rule('MUSIC_BED').said.includes('(high volume during the intro, low whilst I am talking, higher during the outro)'))
    assert.ok(rule('THUMBNAIL_EVERY_SIZE').said.includes('I always want a video thumbnail for all video sizes produced as an asset every time'))
  })
  test('no writer, judge, final pass or shot planner reads them: the script writer and the channel cuts never carry LUFS or a sting', () => {
    // The safety review of 2026-10-12: on the visual stage they reached the
    // script writer's shots (_video.ts) and the channel cuts' visual
    // suggestions (channel-cut.ts), which state the sting as present.
    const stages: Stage[] = ['judge_idea', 'judge_draft', 'write', 'final_pass', 'publish_check', 'visual']
    for (const id of VIDEO_RULES) {
      const r = rule(id)
      for (const stage of stages) {
        for (const sub of [null, 'follow_the_money', 'mind_the_gap', 'under_the_hood']) {
          assert.ok(!houseRulesBlock(stage, sub).includes(r.text), `${id} in ${stage} ${sub}`)
        }
      }
      assert.ok(!VOICE_GUARDRAILS.includes(r.text), id)
      assert.ok(!VOICE_ABSOLUTES.some(a => a.includes(r.text)), id)
    }
    assert.doesNotMatch(houseRulesBlock('visual'), /LUFS|intro-sting|thumbnail_override/)
    assert.doesNotMatch(houseRulesBlock('write'), /LUFS|intro-sting|thumbnail_override/)
  })
  test('the sting rule says what is true today: used only once approved, and none approved while Krish\'s last word was a rejection', () => {
    const sting = JSON.parse(readFileSync('config/intro-sting.json', 'utf8'))
    const r = rule('INTRO_STING')
    assert.ok(r.text.includes(`(${sting.seconds} by default)`))
    assert.ok(['candidate', 'approved'].includes(sting.status))
    assert.match(r.text, /status "approved"/)
    assert.match(r.text, /intro_override/)
    if (sting.status === 'approved') {
      assert.doesNotMatch(r.text, /No design is approved yet/, 'the rule still says no design is approved')
    } else {
      assert.match(r.text, /No design is approved yet/)
      assert.equal(sting.source_sha256, null)
    }
    if (sting.last_decision?.decision === 'rejected') {
      assert.equal(sting.last_decision.by, 'Krish')
      assert.ok(r.text.includes(`on ${sting.last_decision.on} he rejected`), 'the date of his rejection')
      assert.ok(r.text.includes(`("${sting.last_decision.words}")`), 'his words, exactly as the config holds them')
    }
  })
  test('the music rule states the ledger\'s folder and levels, so the two cannot drift', () => {
    const ledger = JSON.parse(readFileSync('config/music-library.json', 'utf8'))
    const r = rule('MUSIC_BED')
    const folder = ledger.root_default_windows.split('\\makeyourmindup\\')[1].split('\\').join(' > ')
    assert.ok(r.text.includes(`makeyourmindup > ${folder} (${ledger.root_env})`), folder)
    const lv = ledger.levels
    assert.ok(r.text.includes(`about ${lv.intro_lufs} LUFS over the intro, about ${lv.bed_lufs} under his voice (about ${lv.final_integrated_lufs - lv.bed_lufs} LU below it) and about ${lv.outro_lufs} over the end card`))
    assert.ok(r.text.includes(`up over ${lv.ramp_up_s} seconds after his last word`) && lv.ramp_down_s === 0.5 && r.text.includes('over half a second'))
    assert.ok(r.text.includes(`finishes at ${lv.final_integrated_lufs} LUFS integrated with true peak at most ${lv.max_true_peak_dbtp} dBTP`))
    assert.match(r.text, /stay proposed until he approves them by ear/)
  })
  test('the thumbnail sizes are the ones the drawer writes', () => {
    const build = readFileSync('scripts/pages/build.py', 'utf8')
    const r = rule('THUMBNAIL_EVERY_SIZE')
    for (const [file, size] of [['thumb-wide-1280x720.jpg', '1280 x 720'], ['thumb-tall-1080x1920.jpg', '1080 x 1920']]) {
      assert.ok(build.includes(file), file)
      assert.ok(r.text.includes(size), size)
    }
    assert.match(r.text, /thumbnail_override/)
  })
})

describe('every script opens straight on the hook: the series line is retired (SERIES_OPENER, Krish, 2026-10-21)', () => {
  test('the rule is live, carries his words, and reaches the writers, the draft judges and the final pass', async () => {
    const { SERIES_OPENERS, seriesOpener, retiredSeriesOpener } = await import('../../apps/control-plane/api/_houseRules.js')
    const r = HOUSE_RULES.find(x => x.id === 'SERIES_OPENER')
    assert.ok(r)
    assert.equal(r.status, 'live')
    assert.equal(r.on, '2026-10-21')
    assert.ok(r.said.startsWith('we need to cut that opening line from every content piece moving forward and just launch straight in to "I put GrokBot and Muse head to head" etc.'))
    assert.match(r.said, /Drop it at the end/)
    assert.match(r.text, /opens straight on the hook/)
    assert.match(r.text, /no "I'm Krish" anywhere/)
    for (const o of Object.values(SERIES_OPENERS)) assert.ok(!r.text.includes(o.line), o.series)
    for (const stage of ['write', 'judge_draft', 'final_pass'] as Stage[]) assert.ok(r.stages.includes(stage), stage)
    // The writers stop using the lines; the lines themselves stay, unchanged, for the records made under them.
    for (const series of ['follow_the_money', 'under_the_hood', 'mind_the_gap', 'money_of_ai', null]) assert.equal(seriesOpener(series), null)
    assert.equal(retiredSeriesOpener('mind_the_gap'), SERIES_OPENERS.mind_the_gap!.line)
    assert.deepEqual(Object.fromEntries(Object.entries(SERIES_OPENERS).map(([k, v]) => [k, v.line])), {
      follow_the_money: "I've been following how money is changing because of AI. I'm Krish.",
      under_the_hood: "I've been looking at what's really inside the AI everyone's selling us. I'm Krish.",
      mind_the_gap: "I've been keeping a beady eye on what's coming with AI, before everyone notices. I'm Krish.",
    })
  })
  test('HOOK_AND_CTA opens straight on the hook and closes as SCRIPT_CLOSE says', () => {
    const r = HOUSE_RULES.find(x => x.id === 'HOOK_AND_CTA')!
    assert.match(r.text, /opens straight on the hook \(SERIES_OPENER\)/)
    assert.match(r.text, /It never opens on a series line, a greeting/)
    assert.match(r.text, /closes as SCRIPT_CLOSE says/)
    assert.match(r.text, /The full deep dive is at makeyourmindup\.ai\./)
    assert.match(r.text, /No question for the comments and no sign-off/)
    assert.match(r.said, /launch straight in to "I put GrokBot and Muse head to head"/)
  })
  test('the script writer opens on the hook with no series line, whatever the series', async () => {
    const video = await import('../../apps/control-plane/api/_video.js')
    assert.match(video.SCRIPT_OPENING, /starts straight on the hook/)
    assert.match(video.SCRIPT_OPENING, /I put X and Y head to head/)
    assert.match(video.SCRIPT_OPENING, /No series line, no greeting, no "I'm Krish"/)
    assert.match(video.SCRIPT_STORY, /Open straight on the hook, with no series line, greeting or "I'm Krish" \(SERIES_OPENER\)/)
    const src = readFileSync('apps/control-plane/api/_video.ts', 'utf8')
    assert.doesNotMatch(src, /seriesOpener/)
    assert.match(src, /^\s+SCRIPT_OPENING,$/m)
    const route = readFileSync('apps/control-plane/api/content-ideas/[id]/video-script.ts', 'utf8')
    assert.match(route, /series: \(idea as any\)\.lane_slot/)
  })
  test('one source: story_check.py still reads the retired lines and the reading gate from the house rules, and takes --series without checking it', async () => {
    const { SERIES_OPENERS } = await import('../../apps/control-plane/api/_houseRules.js')
    const ts = readFileSync('apps/control-plane/api/_houseRules.ts', 'utf8')
    const block = ts.split('// SERIES_OPENERS:BEGIN')[1]!.split('// SERIES_OPENERS:END')[0]!
    assert.deepEqual(JSON.parse(block.slice(block.indexOf('{'), block.lastIndexOf('}') + 1)), SERIES_OPENERS)
    const check = readFileSync('scripts/post-pack/story_check.py', 'utf8')
    assert.match(check, /house_block\('SERIES_OPENERS'\)/)
    const { spawnSync } = await import('node:child_process')
    const py = process.platform === 'win32' ? 'python' : 'python3'
    const read = spawnSync(py, ['-c', 'import json, story_check; print(json.dumps([story_check.series_openers(), story_check.reading_rules(), story_check.series_problems(["x"], "nothing_at_all")]))'],
      { cwd: join(__dirname, '../../scripts/post-pack'), encoding: 'utf8' })
    assert.equal(read.status, 0, read.stderr)
    const [lines, reading, series] = JSON.parse(read.stdout)
    assert.deepEqual(lines, Object.fromEntries(Object.entries(SERIES_OPENERS).map(([k, v]) => [k, v.line])))
    assert.deepEqual(series, [])
    const { SCRIPT_READING } = await import('../../apps/control-plane/api/_houseRules.js')
    assert.deepEqual(reading, SCRIPT_READING)
    const making = readFileSync('scripts/post-pack/making.py', 'utf8')
    assert.match(making, /command \+= \['--series', series\]/)
  })
})

describe('every script closes on what he would do, then the deep dive line (SCRIPT_CLOSE, Krish, 2026-10-21)', () => {
  test('the rule is live, carries his words, and reaches the writers, the draft judges and the final pass', () => {
    const r = HOUSE_RULES.find(x => x.id === 'SCRIPT_CLOSE')
    assert.ok(r)
    assert.equal(r.status, 'live')
    assert.equal(r.on, '2026-10-21')
    assert.equal(r.said, 'Also trim the closing to "the full deep dive is at makeyourmindup.ai." right after a "Here\'s what I\'d do with this info if I were you" closing line. That needs to be the format moving forward for all scripts.')
    assert.match(r.text, /starts exactly "Here's what I'd do with this info if I were you"/)
    assert.match(r.text, /final sentence is exactly "The full deep dive is at makeyourmindup\.ai\." with nothing after it/)
    assert.match(r.text, /no sign-off, no "I'm Krish", no question for the comments/)
    for (const stage of ['write', 'judge_draft', 'final_pass'] as Stage[]) assert.ok(r.stages.includes(stage), stage)
    assert.ok(existsSync('scripts/post-pack/story_check.py') && r.source.includes('scripts/post-pack/story_check.py'))
  })
  test('the writer prompt closes on it, and story_check.py refuses a script that does not', async () => {
    const video = await import('../../apps/control-plane/api/_video.js')
    assert.match(video.STORY_OUTRO, /starts exactly "Here's what I'd do with this info if I were you"/)
    assert.match(video.STORY_OUTRO, /exactly "The full deep dive is at makeyourmindup\.ai\." with nothing after it/)
    for (const f of video.VIDEO_FORMATS.filter(x => x.seconds >= 60)) assert.match(f.shape, /STORY_OUTRO/, f.id)
    const { spawnSync } = await import('node:child_process')
    const py = process.platform === 'win32' ? 'python' : 'python3'
    const ask = (code: string) => {
      const out = spawnSync(py, ['-c', `import json, story_check as s\n${code}`], { cwd: join(__dirname, '../../scripts/post-pack'), encoding: 'utf8' })
      assert.equal(out.status, 0, out.stderr)
      return JSON.parse(out.stdout)
    }
    const found = ask([
      'body = " ".join(["More words that fill the middle of the script."] * 20)',
      'good = "I put two AI helpers head to head. So which one would you trust?\\n\\n" + body + "\\n\\nSo here is my call.\\n\\nHere\'s what I\'d do with this info if I were you. Check what you pay for.\\n\\nThe full deep dive is at makeyourmindup.ai."',
      'old = good.replace("The full deep dive is at makeyourmindup.ai.", "The full teardown is free at makeyourmindup.ai. What do you think? I\'m Krish.")',
      'skipped = good.replace("Here\'s what I\'d do with this info if I were you. ", "")',
      'print(json.dumps([[p for p in s.problems(t) if "SCRIPT_CLOSE" in p] for t in (good, old, skipped)]))',
    ].join('\n'))
    assert.deepEqual(found[0], [])
    assert.equal(found[1].length, 1)
    assert.match(found[1][0], /last sentence must be exactly "The full deep dive is at makeyourmindup\.ai\."/)
    assert.equal(found[2].length, 1)
    assert.match(found[2][0], /Here's what I'd do with this info if I were you/)
  })
})

describe('every article ends with "3 things you can do tomorrow" (THREE_THINGS_TOMORROW, Krish, 2026-10-21)', () => {
  test('the rule is live, carries his words, reaches the writers, judges, final pass and the publish check', () => {
    const r = HOUSE_RULES.find(x => x.id === 'THREE_THINGS_TOMORROW')
    assert.ok(r)
    assert.equal(r.status, 'live')
    assert.equal(r.said, 'The articles all need to have a really clear "3 things you can do tomorrow" at the end of every piece too.')
    assert.match(r.text, /clearly headed section, "3 things you can do tomorrow"/)
    assert.match(r.text, /exactly three concrete actions/)
    for (const stage of ['write', 'judge_draft', 'final_pass', 'publish_check'] as Stage[]) assert.ok(r.stages.includes(stage), stage)
    assert.ok(VOICE_GUARDRAILS.includes(r.text))
    assert.match(HOUSE_RULES.find(x => x.id === 'ONE_SPINE')!.text, /"3 things you can do tomorrow" section \(THREE_THINGS_TOMORROW\), which is not an outline section/)
  })
  test('the publish check reads the heading and the three items, and does not block yet', () => {
    const three = (body: string) => publishChecks(body, factsOk, NOW_SEP).find(c => c.id === 'THREE_THINGS_TOMORROW')!
    const ok = `${PASSED}\n\n## 3 things you can do tomorrow\n\n- Check what your plan costs.\n- Ask which model your app uses.\n- Write down the one task you hand over first.\n`
    assert.equal(three(ok).ok, true)
    assert.equal(three(ok).blocking, false)
    assert.equal(three(ok.replace('## 3 things', '## Three things')).ok, false)
    assert.equal(three(PASSED).ok, false)
    assert.match(three(PASSED).detail, /No section headed "3 things you can do tomorrow"/)
    assert.match(three(ok.replace(/- Write down.*\n/, '')).detail, /has 2 list items; it needs exactly three/)
    assert.match(three(ok + '- A fourth one.\n').detail, /has 4 list items/)
    assert.match(three(ok.replace('\n\n## 3 things', '\n\n## 3 THINGS YOU CAN DO TOMORROW')).detail, /Ends with/)
    assert.match(three(ok + '\n## Sources\n\n- one\n').detail, /not the last section/)
    assert.match(three(ok.replace(/^- /gm, '1. ')).detail, /Ends with/)
    // Not blocking: the pieces already written and fact-checked are not stopped by it.
    assert.deepEqual(publishStatus(publishChecks(PASSED.replace('75%.', '85%.'), factsOk, NOW_SEP)).failing.map(c => c.id), [])
  })
})

describe('Krish\'s tone is observational, witty and positive (TONE_OBSERVANT_WITTY, Krish, 2026-10-21)', () => {
  test('the rule is live and reaches the writers and the draft judges, with the dry Hannah Fry edge and the limits on it', () => {
    const r = HOUSE_RULES.find(x => x.id === 'TONE_OBSERVANT_WITTY')
    assert.ok(r)
    assert.equal(r.status, 'live')
    assert.match(r.said, /Generally yes - observational and witty and positive are my general go tos/)
    assert.match(r.text, /observational/)
    assert.match(r.text, /witty and positive/)
    assert.match(r.text, /Hannah Fry/)
    assert.match(r.text, /never an invented one/)
    assert.match(r.text, /never at a real person/)
    for (const stage of ['write', 'judge_draft'] as Stage[]) assert.ok(r.stages.includes(stage), stage)
    assert.ok(VOICE_GUARDRAILS.includes(r.text))
    assert.ok(houseRulesBlock('judge_draft').includes(r.text))
  })
})

describe('reading age 12 is a hard gate on every script (R7, Krish, 2026-10-12)', () => {
  test('R7 keeps its id, carries his words, and states the gate it holds', async () => {
    const { SCRIPT_READING } = await import('../../apps/control-plane/api/_houseRules.js')
    const r = HOUSE_RULES.find(x => x.id === 'R7')!
    assert.equal(r.status, 'live')
    assert.match(r.said, /Every single script should be understandable by a 12-year-old\. I can't even understand what I'm reading off the teleprompter\. I thought we had hard gates for this\?/)
    assert.deepEqual([SCRIPT_READING.max_sentence_words, SCRIPT_READING.max_average_words, SCRIPT_READING.max_grade, SCRIPT_READING.max_quote_words], [20, 12, 6, 4])
    assert.ok(r.text.includes('no spoken sentence over 20 words'))
    assert.ok(r.text.includes('a reading grade of 6 or less'))
    for (const word of ['licensing', 'settlement', 'revenue', 'royalties', 'model', 'copyright', 'fair use', 'valuation', 'scalable']) {
      assert.ok(SCRIPT_READING.jargon.includes(word), word)
      assert.ok(r.text.includes(word), word)
    }
    assert.match(r.text, /two fresh readers, each an ordinary 12-year-old hearing it once/)
    for (const stage of ['write', 'final_pass'] as Stage[]) assert.ok(r.stages.includes(stage), stage)
  })
  test('one source: story_check.py reads the gate from the house rules', async () => {
    const { SCRIPT_READING } = await import('../../apps/control-plane/api/_houseRules.js')
    const ts = readFileSync('apps/control-plane/api/_houseRules.ts', 'utf8')
    const block = ts.split('// SCRIPT_READING:BEGIN')[1]!.split('// SCRIPT_READING:END')[0]!
    assert.deepEqual(JSON.parse(block.slice(block.indexOf('{'), block.lastIndexOf('}') + 1)), SCRIPT_READING)
    assert.match(readFileSync('scripts/post-pack/story_check.py', 'utf8'), /house_block\('SCRIPT_READING'\)/)
  })
  test('the read-back: the engine\'s two readers are the ones make-piece gives a session, word for word', async () => {
    const { READ_BACK_READERS } = await import('../../apps/control-plane/api/_video.js')
    assert.equal(READ_BACK_READERS.length, 3)
    const skill = readFileSync('.agents/skills/make-piece/SKILL.md', 'utf8').replace(/\s+/g, ' ')
    for (const prompt of READ_BACK_READERS) assert.ok(skill.includes(prompt), prompt.slice(0, 60))
    for (const prompt of READ_BACK_READERS) assert.doesNotMatch(prompt, /music/)
    assert.match(skill, /making\.py <uuid> read-back/)
  })
  test('the read-back passes only when all three readers answered and nothing lost any (C, the narrator, since 2026-10-19)', async () => {
    const { readBack } = await import('../../apps/control-plane/api/_video.js')
    const answers = ['{"lost": ["nothing"], "retell": "One. Two. Three."}', '{"lost": [], "retell": "A. B. C."}', '{"lost": [], "retell": "X. Y. Z."}']
    const ok = await readBack('Script.', async () => answers.shift()!)
    assert.equal(ok.passed, true)
    assert.deepEqual(ok.readers.map(r => [r.reader, r.lost]), [['A', []], ['B', []], ['C', []]])
    const unsaid = await readBack('Script.', async ({ system }) => (system.startsWith('You are the presenter') ? '{"lost": ["Google spots that repeat, and charges 95% less for it."], "retell": "x"}' : '{"lost": [], "retell": "y"}'))
    assert.equal(unsaid.passed, false)
    assert.deepEqual(unsaid.readers.find(r => r.reader === 'C')!.lost, ['Google spots that repeat, and charges 95% less for it.'])
    const lost = await readBack('Script.', async ({ system }) => (system.startsWith('Pretend') ? '{"lost": ["fair use"], "retell": "x"}' : '{"lost": [], "retell": "y"}'))
    assert.equal(lost.passed, false)
    assert.deepEqual(lost.readers.find(r => r.reader === 'B')!.lost, ['fair use'])
    const down = await readBack('Script.', async () => { throw new Error('timeout') })
    assert.equal(down.passed, false)
    assert.ok(down.readers.every(r => r.error === 'timeout'))
  })
})

describe('a story intro, its audio treatment and an outro card, in every format (STORY_INTRO_OUTRO, Krish, 2026-10-12)', () => {
  test('the rule is live, in his words, on the production stage, and the stand-off is approved in his words', () => {
    const r = HOUSE_RULES.find(x => x.id === 'STORY_INTRO_OUTRO')!
    assert.equal(r.status, 'live')
    assert.equal(r.on, '2026-10-12')
    assert.deepEqual(r.stages, ['production'])
    assert.equal(r.said, 'when the videos come back bear in mind that I want a proper animated branded intro to this specific story visually, the audio treatment, and then a proper animated outro card. Across all formats, and this should be part of the system moving forward.')
    const cfg = JSON.parse(readFileSync('config/story-intro-outro.json', 'utf8'))
    assert.equal(cfg.status, 'approved')
    assert.equal(cfg.approved.by, 'Krish')
    assert.ok(cfg.approved.words.includes('todays video goes out with the new intro and outro animations'))
    assert.equal(cfg.said.words, r.said)
    assert.equal(cfg.until_approved, 'story intro and outro not designed yet')
    assert.ok(r.text.includes(cfg.until_approved))
  })
  test('produce-video stops before the final render until the designs are approved', () => {
    const skill = readFileSync('.agents/skills/produce-video/SKILL.md', 'utf8').replace(/\s+/g, ' ')
    assert.ok(skill.includes('house rule `STORY_INTRO_OUTRO`'))
    assert.ok(skill.includes('config/story-intro-outro.json'))
    assert.ok(skill.includes('say "story intro and outro not designed yet"'))
    assert.ok(skill.includes('stop before the final render'))
    assert.ok(skill.indexOf('STORY_INTRO_OUTRO') < skill.indexOf('python scripts/quick-edit/make.py WORK/kit/long.json --out WORK/long --only 16x9 --share-mib 29'))
  })
})

// Monday's and Wednesday's were recorded and keep their words. Friday's v5 is
// the last version the gate passed before the 2026-10-21 ruling: both cuts
// opened on the mind.the.gap line and passed at their lengths (deep 1,200 to
// 1,700 words, short 160 to 195). What he records is v6, his own edit of both
// at 21:32 UTC on 16 October, put through on his words, so it is not held to
// the gate here. Since 2026-10-21 the series line is retired and every script
// closes as SCRIPT_CLOSE says, and since 2026-10-28 no script says his name
// (house rule NO_NAME), which the mind.the.gap line does ("I'm Krish."). So
// v5 keeps every old gate (length, reading age, the story) and fails on
// nothing but that close and that name.
describe('this week\'s unrecorded scripts keep every gate but the new close and the name (R7, SCRIPT_CLOSE, NO_NAME)', () => {
  test('Friday\'s v5 deep cut and 90-second cut fit their lengths and a 12-year-old can follow them; only the close of 2026-10-21 and the name of 2026-10-28 fail', async () => {
    const { spawnSync } = await import('node:child_process')
    for (const [file, cut, series] of [
      ['docs/plans/2026-10-09-script-deep-v5.md', 'deep', 'mind_the_gap'],
      ['docs/plans/2026-10-09-script-90s-v5.md', 'short', 'mind_the_gap'],
    ] as const) {
      const out = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['scripts/post-pack/story_check.py', '--cut', cut, '--series', series, file], { encoding: 'utf8' })
      const found = out.stdout.split('\n').filter(l => l.startsWith('  - '))
      assert.ok(found.some(l => /SCRIPT_CLOSE/.test(l)), `${file}: v5 predates the new close and should be told so`)
      assert.ok(found.some(l => /NO_NAME/.test(l)), `${file}: v5 opens on a series line that says his name`)
      for (const line of found) assert.match(line, /SCRIPT_CLOSE|NO_NAME/, `${file}: ${line}`)
    }
  })
})

// Krish, 2026-10-28: "Remember, no content refers to Krish, ever. I still see
// that popping up from time to time. Even articles written are not authored by
// Krish. My face only, for assets and the video format." Then his four answers
// of 2026-10-29, and, of comparisons: "I think my point was that pictures never
// add zero value above and beyond the words. They have to be additive in
// meaning. I'm all up for visually clear ideas."
describe('no public word names Krish, and every picture adds meaning (NO_NAME, ANALOGY_IN_SCRIPTS_ONLY)', () => {
  test('NO_NAME is live, in his words, with his four answers, and reaches every stage that writes or checks a public word', () => {
    const r = HOUSE_RULES.find(x => x.id === 'NO_NAME')
    assert.ok(r)
    assert.equal(r.status, 'live')
    assert.ok(r.said.startsWith('"Remember, no content refers to Krish, ever. I still see that popping up from time to time. Even articles written are not authored by Krish. My face only, for assets and the video format."'))
    for (const picked of ['"We"', '"No, personal stays personal"', '"Drop it"', '"Yes, block it"']) assert.ok(r.said.includes(picked), picked)
    assert.deepEqual([...r.stages].sort(), ['final_pass', 'judge_draft', 'publish_check', 'visual', 'write'])
    for (const stage of ['write', 'judge_draft', 'final_pass', 'visual'] as const) assert.ok(houseRulesBlock(stage).includes(r.text), stage)
    assert.match(r.text, /OUR TEST · <date>" by default/)
    assert.match(r.text, /makeyourmindup · <date> · <n> minute read/)
    // A video label he presents reading OUR TEST or MY TEST is his to pick: a default, never a refusal.
    assert.doesNotMatch(r.text, /MY TEST|OUR CALL|By Krish/)
  })
  test('articles speak as "we", the scripts he speaks keep "I", and no writer example names him', () => {
    const voice = HOUSE_RULES.find(x => x.id === 'SOUNDS_LIKE_KRISH')!
    assert.match(voice.text, /In an article and its title, subtitle and description, "we" and "our" carry the publication's view/)
    assert.match(voice.text, /in a video script he speaks, "I" and "my" carry his/)
    assert.doesNotMatch(voice.text, /"I" and "my" carry his view: a moment from his own work/)
    assert.doesNotMatch(HOUSE_RULES.find(x => x.id === 'HOOK_AND_CTA')!.text, /what Krish did/)
    for (const [file, framing] of [
      ['apps/control-plane/api/content-ideas/[id]/draft.ts', /You are drafting one piece for makeyourmindup/],
      ['apps/control-plane/api/_revisePrompt.ts', /rewriting a draft for makeyourmindup/],
      ['apps/control-plane/api/briefs/assemble.ts', /You write in the publication\\?'s voice and never name its maker/],
      ['apps/control-plane/api/_humor.ts', /rewriting a passage of a makeyourmindup draft/],
      ['apps/control-plane/api/content-ideas/[id]/chat.ts', /content partner on makeyourmindup/],
    ] as const) {
      const source = readFileSync(file, 'utf8')
      assert.match(source, framing, file)
      assert.doesNotMatch(source, /in Krish Raja's voice|Krish Raja's publication|You write as Krish|passage of Krish Raja's draft|Krish Raja's content partner/, file)
    }
    // The weekly brief is an article: its position section speaks as "we", under a public heading that says so.
    const brief = readFileSync('apps/control-plane/api/briefs/assemble.ts', 'utf8')
    assert.match(brief, /7\. OUR POSITION, 80 to 140 words, in the publication\\'s "we"/)
    assert.match(brief, /'## Our position'/)
    assert.doesNotMatch(brief, /MY POSITION|## My position|first person/)
  })
  test('a picture must add meaning beyond the words; a visually clear idea with the real facts is welcome; one that stands in for them is out', () => {
    const r = HOUSE_RULES.find(x => x.id === 'ANALOGY_IN_SCRIPTS_ONLY')!
    assert.ok(r.said.includes('Then, 2026-10-29, asked whether a picture may show the everyday thing a script compares something to: "I think my point was that pictures never add zero value above and beyond the words. They have to be additive in meaning. I\'m all up for visually clear ideas."'))
    assert.match(r.text, /adds meaning beyond the words said over it/)
    assert.match(r.text, /A visually clear idea is welcome, a comparison included, when the real facts are on it/)
    assert.match(r.text, /stands in for the facts \(the 16 October race between two cars/)
    // Names alone can carry a comparison (the passports): figures only where there are any.
    assert.match(r.text, /on a comparison the real names, and the real figures where there are any/)
    assert.doesNotMatch(r.text, /names and numbers on any comparison/)
    assert.doesNotMatch(r.text, /never act out an analogy/)
    // The article and script sentences are kept.
    assert.match(r.text, /Analogies, comic comparisons and exaggeration belong in the video scripts/)
    assert.match(r.text, /The article stays more professional/)
    const relatable = HOUSE_RULES.find(x => x.id === 'RELATABLE_EXPLANATION')!
    assert.match(relatable.text, /a picture of one must add meaning beyond the words, with the real facts on it, never stand in for them/)
    assert.doesNotMatch(relatable.text, /a picture never acts one out/)
    const gate = readFileSync(join(__dirname, '../../scripts/post-pack/visual_gate.py'), 'utf8')
    assert.match(gate, /pictures never add zero value above and beyond '\s+'the words\. They have to be additive in meaning\./)
  })
})
