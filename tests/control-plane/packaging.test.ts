import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import {
  characters, DESCRIPTION_MAX, failures, HOOK_MAX, lintAnswer, lintPackage, MAX_HASHTAGS, PACKAGING_RULES,
  packagingCorrection, packagingRequest, packagingRulesBlock, predictionDate, READ_LINE, readAnswer, ruleText,
  TITLE_AIM, TITLE_MAX, watchLabel, WORKED_EXAMPLE as EX,
} from '../../apps/control-plane/api/_packaging.js'
import { HOUSE_RULES, houseRulesBlock, rulesFor } from '../../apps/control-plane/api/_houseRules.js'
import { VOICE_GUARDRAILS } from '../../apps/control-plane/api/_content.js'
import { notXYConstructions } from '../../apps/control-plane/api/_judges/deterministic.js'
import { emDashes } from '../../apps/control-plane/api/_publishChecks.js'

// The YouTube title and description (walk log F59).
//
// Krish, 2026-10-05, about the video for piece 1: "whats a viral video title
// for this". His own draft was 112 characters; the pick was 59, "Amazon
// blocked Meta's AI shopping agent. Shopify let it in." Then he asked for it
// to become "a part of the durable engine". These tests hold the check to
// that day's reasoning, on piece 1's own text.

const PIECE_1 = readFileSync('tests/fixtures/control-plane/piece1-v13-scoped-fixes.md', 'utf8')
// The description in the house shape: Krish's own opening paragraph from
// YouTube Studio, the piece's call as the piece states it, and the line.
const DESCRIPTION = [
  EX.opening,
  'Our prediction: by 30 June 2027, Amazon opens an authorised route for shopping agents, and that route still shows them sponsored listings. How sure we are: 70%.',
  READ_LINE,
].join('\n\n')
const lint = (over: { title?: string; description?: string; thumbnailText?: string | null } = {}) =>
  lintPackage({ title: EX.pick, description: DESCRIPTION, thumbnailText: EX.thumbnail, source: PIECE_1, ...over })
const rulesBroken = (l: ReturnType<typeof lint>, level: 'fail' | 'warn' = 'fail') =>
  l.problems.filter(p => p.level === level).map(p => p.rule)

describe('the title and description, checked the way the chat reasoned', () => {
  test('the 59-character pick passes, with nothing to warn about', () => {
    assert.equal(characters(EX.pick), 59)
    const l = lint()
    assert.equal(l.passed, true, JSON.stringify(l.problems))
    assert.deepEqual(l.problems, [])
  })

  test('Krish\'s 112-character draft fails on length, and on its capitals', () => {
    assert.equal(characters(EX.draft), 112)
    const l = lint({ title: EX.draft })
    assert.equal(l.passed, false)
    const length = l.problems.find(p => p.rule === 'TITLE_LENGTH')!
    assert.equal(length.level, 'fail')
    assert.equal(length.detail, `The title is 112 characters. YouTube allows ${TITLE_MAX} at most, and a phone shows about ${TITLE_AIM}.`)
    assert.ok(rulesBroken(l).includes('NO_SHOUTING'))
  })

  test('over 60 characters warns; over 100 fails', () => {
    const long = "Amazon blocked Meta's AI shopping agent, Muse. Shopify let it in at the till."
    assert.ok(characters(long) > TITLE_AIM && characters(long) <= TITLE_MAX)
    const l = lint({ title: long })
    assert.equal(l.passed, true)
    assert.deepEqual(rulesBroken(l, 'warn'), ['TITLE_LENGTH'])
  })

  test('a title with an em dash fails', () => {
    const l = lint({ title: "Amazon blocked Meta's AI shopping agent — Shopify let it in" })
    assert.equal(l.passed, false)
    assert.deepEqual(rulesBroken(l), ['NO_EM_DASH'])
  })

  test('"SHOCKING" fails, as shouting and as hype', () => {
    const l = lint({ title: "SHOCKING: Amazon blocked Meta's AI shopping agent" })
    assert.equal(l.passed, false)
    assert.deepEqual(rulesBroken(l).sort(), ['NO_CLICKBAIT', 'NO_SHOUTING'])
    assert.deepEqual(rulesBroken(lint({ title: "Shocking: Amazon blocked Meta's AI shopping agent" })), ['NO_CLICKBAIT'])
  })

  test('a title that is the thumbnail text fails, and is the backup kept for when the thumbnail changes', () => {
    const l = lint({ title: EX.thumbnail })
    assert.equal(l.passed, false)
    assert.deepEqual(rulesBroken(l), ['THUMBNAIL'])
    // With a different thumbnail, the same words pass, and the only note is
    // that they name nobody.
    const other = lint({ title: EX.thumbnail, thumbnailText: 'Amazon said no. Shopify said yes.' })
    assert.equal(other.passed, true)
    assert.deepEqual(rulesBroken(other, 'warn'), ['NAMES'])
    // No thumbnail text given: nothing to repeat.
    assert.equal(lint({ thumbnailText: null }).passed, true)
  })

  test('a number the piece does not state fails; the piece\'s own numbers pass', () => {
    const l = lint({ title: 'Amazon lost $500 million when it blocked Meta' })
    assert.equal(l.passed, false)
    assert.deepEqual(rulesBroken(l), ['NUMBERS'])
    assert.match(l.problems[0]!.detail, /does not state: 500\./)
    assert.equal(lint({ title: "Amazon's $68.6 billion is why it blocked Meta's AI agent" }).passed, true)
    const desc = lint({ description: DESCRIPTION.replace('How sure we are: 70%.', 'How sure we are: 85%.') })
    assert.deepEqual(rulesBroken(desc), ['NUMBERS'])
    assert.equal(desc.problems[0]!.field, 'description')
  })

  test('a description without the makeyourmindup.ai line fails', () => {
    const l = lint({ description: DESCRIPTION.replace(READ_LINE, '') })
    assert.equal(l.passed, false)
    assert.deepEqual(rulesBroken(l), ['READ_LINE'])
    // Krish's opening paragraph on its own: the line and the call are missing.
    const bare = lint({ description: EX.opening })
    assert.deepEqual(rulesBroken(bare), ['READ_LINE'])
    assert.deepEqual(rulesBroken(bare, 'warn'), ['PREDICTION'])
    assert.match(bare.problems.find(p => p.rule === 'PREDICTION')!.detail, /by 30 June 2027/)
  })

  test('the house\'s own constructions fail: "Not X, Y", a robot, a banned phrase, an exclamation mark, American spelling', () => {
    assert.deepEqual(rulesBroken(lint({ title: "It's not a price war, it's a shelf war" })), ['R2'])
    assert.deepEqual(rulesBroken(lint({ title: "Amazon blocked Meta's shopping robot" })), ['AI_AGENT'])
    assert.deepEqual(rulesBroken(lint({ title: 'Amazon blocked a shopping bot from Meta' })), ['AI_AGENT'])
    assert.deepEqual(rulesBroken(lint({ title: "Meta's AI agent is a game-changer for Shopify" })), ['BANNED_PHRASE'])
    assert.deepEqual(rulesBroken(lint({ title: "Amazon blocked Meta's AI shopping agent!" })), ['NO_EXCLAMATION'])
    assert.deepEqual(rulesBroken(lint({ title: "Amazon's ad shelf has a new color" })), ['BRITISH_SPELLING'])
    // Each is checked in the description too.
    assert.deepEqual(rulesBroken(lint({ description: DESCRIPTION.replace('AI shopping agent', 'robot shopper') })), ['AI_AGENT'])
  })

  test('"just" fails as urgency and passes as "only"; "breaking" fails as a news flash only', () => {
    assert.deepEqual(rulesBroken(lint({ title: 'Shopify just let Meta\'s AI shopping agent in' })), ['NO_CLICKBAIT'])
    assert.deepEqual(rulesBroken(lint({ title: 'Amazon just blocked Meta\'s AI shopping agent' })), ['NO_CLICKBAIT'])
    assert.equal(lint({ title: 'Why Shopify just needs Meta\'s AI agent at the till' }).passed, true)
    assert.deepEqual(rulesBroken(lint({ title: 'Breaking: Amazon blocked Meta\'s AI agent' })), ['NO_CLICKBAIT'])
    assert.equal(lint({ title: 'Is Amazon breaking its own rules on Meta\'s AI agent?' }).passed, true)
    assert.deepEqual(rulesBroken(lint({ title: 'You won\'t believe why Amazon blocked Meta' })), ['NO_CLICKBAIT'])
  })

  test('a short acronym, a name the piece writes in capitals, and a heading word are judged fairly', () => {
    assert.equal(lint({ title: "Amazon blocked Meta's AI agent at the CNET-reported door" }).passed, true)
    assert.equal(lint({ title: 'NVIDIA has nothing to do with this' }).passed, true)
    // "OUR PREDICTION" is a heading in the piece; a heading is never licence to shout.
    assert.deepEqual(rulesBroken(lint({ title: 'OUR PREDICTION for Amazon and Meta' })), ['NO_SHOUTING'])
  })

  test('at most three hashtags, on the last line', () => {
    assert.equal(MAX_HASHTAGS, 3)
    assert.equal(lint({ description: `${DESCRIPTION}\n\n#Amazon #Shopify #AIagents` }).passed, true)
    assert.deepEqual(rulesBroken(lint({ description: `${DESCRIPTION}\n\n#Amazon #Shopify #AIagents #Meta` })), ['HASHTAGS'])
    const early = lint({ description: `#Amazon ${DESCRIPTION}` })
    assert.equal(early.passed, true)
    assert.deepEqual(rulesBroken(early, 'warn'), ['HASHTAGS'])
  })

  test('the hook is the opening sentence: Krish\'s 177-character paragraph passes, a hook past 150 warns', () => {
    assert.ok(characters(EX.opening.split('\n')[0]!) > HOOK_MAX)
    assert.equal(lint().problems.length, 0)
    const rambling = 'Amazon blocked ' + 'a very long and winding opening sentence that never seems to get to the point '.repeat(2) + 'of the story.'
    assert.ok(characters(rambling) > HOOK_MAX)
    assert.deepEqual(rulesBroken(lint({ description: `${rambling}\n\n${DESCRIPTION}` }), 'warn'), ['HOOK'])
  })

  test('YouTube\'s own limits fail: angle brackets, an empty field, an over-long description', () => {
    assert.deepEqual(rulesBroken(lint({ title: 'Amazon <3 ads, Meta does not' })), ['YOUTUBE_LIMITS'])
    assert.deepEqual(rulesBroken(lint({ title: '' })), ['YOUTUBE_LIMITS'])
    assert.deepEqual(rulesBroken(lint({ description: '   ' })), ['YOUTUBE_LIMITS'])
    const long = lint({ description: `${DESCRIPTION}\n\n${'Amazon sells shelf space. '.repeat(Math.ceil(DESCRIPTION_MAX / 25))}` })
    assert.ok(rulesBroken(long).includes('YOUTUBE_LIMITS'))
  })

  test('the same words always get the same answer', () => {
    assert.deepEqual(lint({ title: EX.draft }), lint({ title: EX.draft }))
  })

  test('every problem names a rule with an instruction a writer can read', () => {
    const titles = [EX.draft, EX.thumbnail, 'SHOCKING robot game-changer — color! 999 <b>', '']
    const descriptions = ['', EX.opening, `#a #b #c #d ${'x'.repeat(DESCRIPTION_MAX)}`]
    for (const title of titles) for (const description of descriptions) {
      for (const p of lint({ title, description }).problems) assert.ok(ruleText(p.rule), p.rule)
    }
  })
})

describe('the writer\'s answer, and its one correction', () => {
  const answer = {
    title: EX.pick,
    description: DESCRIPTION,
    why: EX.why,
    alternates: EX.alternates.map(a => ({ title: a.title, why: a.why })),
  }
  const ctx = { thumbnailText: EX.thumbnail, source: PIECE_1 }

  test('the backup for when the thumbnail changes is never failed for being today\'s thumbnail', () => {
    const l = lintAnswer(answer, ctx)
    assert.equal(failures(l), 0, JSON.stringify(l))
    assert.equal(l.alternates.length, 2)
    assert.deepEqual(l.alternates[1]!.problems.map(p => p.rule), ['NAMES'])
  })

  test('the correction lists each failure with its rule, for the title, the description and each backup, and nothing that only warns', () => {
    const bad = { ...answer, title: EX.draft, description: EX.opening, alternates: [{ title: 'Amazon just blocked Meta', why: null }, answer.alternates[1]!] }
    const l = lintAnswer(bad, ctx)
    assert.equal(failures(l), 4)
    const c = packagingCorrection(bad, l)
    assert.match(c, /- The title: The title is 112 characters\. .* The rule: Aim for 60 characters or fewer/)
    assert.match(c, /- The title: The title shouts in capitals: AGENTS\./)
    assert.match(c, /- The description: The description has no "Read the full piece free at makeyourmindup\.ai" line\./)
    assert.match(c, /- Backup title 1 \("Amazon just blocked Meta"\): The title uses hype: "just" as urgency\./)
    assert.doesNotMatch(c, /PREDICTION|predicts what will happen|names nobody/)
    assert.match(c, /Return the same JSON object as before\.$/)
  })

  test('the answer is cleaned like any other write: dashes swapped, wrapping quotes off, two backups at most', () => {
    const a = readAnswer({
      title: '"Amazon blocked Meta — Shopify let it in"',
      description: 'Amazon said no — Shopify said yes.',
      why: 'Names.',
      alternates: [{ title: 'One', why: 'a' }, { title: 'Two' }, { title: 'Three' }, { why: 'no title' }],
    })!
    assert.equal(a.title, 'Amazon blocked Meta, Shopify let it in')
    assert.equal(emDashes(a.description).length, 0)
    assert.deepEqual(a.alternates, [{ title: 'One', why: 'a' }, { title: 'Two', why: null }])
    assert.equal(readAnswer({ title: 'Only a title' }), null)
    assert.equal(readAnswer('not json'), null)
    assert.equal(readAnswer(null), null)
  })

  test('the video\'s length reads as Krish wrote it', () => {
    assert.equal(watchLabel(120), '2 minute watch')
    assert.equal(watchLabel(152), '3 minute watch')
    assert.equal(watchLabel(45), '45 second watch')
    assert.equal(watchLabel(null), null)
    assert.equal(watchLabel(0), null)
  })

  test('the request carries the piece, the thumbnail, the length and the steer', () => {
    const r = packagingRequest({ idea: 'Same agent, opposite answers', thesis: null, source: PIECE_1, thumbnailText: EX.thumbnail, watch: '2 minute watch', hint: 'lead with Shopify' })
    assert.match(r, /THUMBNAIL TEXT, read together with the title: "When an AI agent does your shopping, who gets paid\?"/)
    assert.match(r, /end the description's first paragraph with " \| 2 minute watch"/)
    assert.match(r, /A STEER FROM THE PERSON ASKING: lead with Shopify/)
    assert.ok(r.includes('By 30 June 2027, Amazon opens an authorised route'))
    assert.match(packagingRequest({ idea: null, thesis: null, source: PIECE_1, thumbnailText: null, watch: null, hint: null }), /No thumbnail text was given/)
  })

  test('the piece\'s prediction date is read by the shared call reader', () => {
    assert.equal(predictionDate(PIECE_1), '30 June 2027')
    assert.equal(predictionDate('No call here.'), null)
  })
})

describe('the rules are written down once, and every writer reads the ruling', () => {
  const rule = HOUSE_RULES.find(r => r.id === 'YOUTUBE_PACKAGE')!

  test('the ruling carries his words, the date and where it is recorded', () => {
    assert.ok(rule)
    assert.equal(rule.status, 'live')
    assert.equal(rule.on, '2026-10-05')
    assert.ok(rule.said.includes('whats a viral video title for this'))
    assert.ok(rule.said.includes('lets close this session out by ensuring everything I have asked for in terms of the content engine (like a viral youtube title and description) becomes a part of the durable engine.'))
    assert.match(rule.source, /walk log F59/)
    assert.match(rule.source, /docs\/walks\/2026-09-three-piece-walk\.md/)
    assert.ok(rule.stages.includes('write'))
    assert.ok(rulesFor('write').includes(rule))
    assert.ok(VOICE_GUARDRAILS.includes(rule.text))
    assert.ok(houseRulesBlock('write').includes(rule.text))
  })

  test('the ruling\'s numbers and line are the ones the check uses', () => {
    assert.ok(rule.text.includes(`fits in ${TITLE_AIM} characters`))
    assert.ok(rule.text.includes(`YouTube stops at ${TITLE_MAX}`))
    assert.ok(rule.text.includes(`about ${HOOK_MAX} characters`))
    assert.ok(rule.text.includes(`"${READ_LINE}"`))
    assert.ok(rule.text.includes('at most three hashtags') && MAX_HASHTAGS === 3)
  })

  test('the route reads the house rules, the rules block and the subchannel, and stores beside the channel cuts', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas/[id]/package.ts', 'utf8')
    assert.match(src, /if \(guardEngine\(req, res\)\) return/)
    assert.match(src, /VOICE_GUARDRAILS/)
    assert.match(src, /packagingRulesBlock\(\)/)
    assert.match(src, /loadSubchannel\(idea\.lane_slot\)/)
    assert.match(src, /youtube_package: youtubePackage/)
    assert.match(src, /\.eq\('updated_at', idea\.updated_at\)/)
  })

  test('the rules break none of the rules they teach', () => {
    const texts = [
      rule.text, rule.name, packagingRulesBlock().replace(EX.draft, ''),
      ...PACKAGING_RULES.map(r => r.text), EX.why, ...EX.alternates.map(a => a.why),
    ]
    for (const t of texts) {
      assert.deepEqual(notXYConstructions(t), [], t)
      assert.deepEqual(emDashes(t), [], t)
    }
  })

  test('each rule says whether code checks it, and the ones code checks are reported by that id', () => {
    const ids = new Set(PACKAGING_RULES.map(r => r.id))
    assert.equal(ids.size, PACKAGING_RULES.length)
    for (const r of PACKAGING_RULES) assert.ok(r.checked === 'code' || r.checked === 'writer', r.id)
    const writerOnly = PACKAGING_RULES.filter(r => r.checked === 'writer').map(r => r.id).sort()
    assert.deepEqual(writerOnly, ['BODY', 'CONFLICT', 'OPEN_QUESTION', 'TRUE_TO_SOURCE'])
  })
})
