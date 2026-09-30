import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import {
  bodyHash, combine, datedContext, gateStatus, inOrder, isConfidenceLine, leftoversOf, norm, numbersIn, primaryText, quoteHolds, quotesFail, readsAsForecast, resolveLeftovers, sectionOf, sentences, SOURCE_MARK,
  sourcesText, summarise, sweep,
  type CheckedClaim,
} from '../../apps/control-plane/api/_factGate.js'
import { sanitizeVoice } from '../../apps/control-plane/api/_content.js'
import { readPieceCall } from '../../packages/contracts/src/call.js'

// The fact gate (Krish, 2026-09-25). The cases below are the real ones: the
// engine's first draft of piece 2 turned Cisco's "$900 million annually" into
// "close to a million dollars a year", and gave Anthropic one model in 2024.
const SOURCES = [
  "Cisco's Jeetu Patel laid out the math. At roughly $200 of token usage per employee per week, that's about $10,000 a year per person. With 90,000 employees, a company is looking at $900 million annually.",
  'Glean CEO Arvind Jain has estimated that roughly 95% of enterprise AI usage is still running on the most expensive frontier models.',
].join('\n\n')

const checked = (verdict: CheckedClaim['verdict']): CheckedClaim => ({
  sentence: 's', claim: 'c', kind: 'number',
  on_file: { verdict: 'supported', quote: null, note: null },
  independent: { verdict: 'supported', evidence: null, url: null, checker: 'perplexity:sonar-pro', correct_value: null },
  verdict,
})

describe('the on-file check trusts text, never the checker', () => {
  test('a verbatim quote carrying every number in the claim holds', () => {
    assert.equal(quoteHolds('With 90,000 employees, a company is looking at $900 million annually.', SOURCES,
      'Cisco: 90,000 employees would cost $900 million a year'), true)
  })
  test('the rescaled number does not: "close to a million" is not in any quote about $900 million', () => {
    assert.equal(quoteHolds('With 90,000 employees, a company is looking at $900 million annually.', SOURCES,
      'one company spends close to a million dollars a year, about 1 million'), false)
  })
  test('a paraphrase the sources do not contain does not hold', () => {
    assert.equal(quoteHolds('Cisco spends $900 million a year on AI tokens.', SOURCES, 'Cisco spends $900 million a year'), false)
  })
  test('curly quotes and markdown emphasis do not break a real match', () => {
    assert.equal(quoteHolds('Glean CEO Arvind Jain has estimated that roughly **95%** of enterprise AI usage', SOURCES, '95% of enterprise AI usage'), true)
  })
})

describe('a fact split across a heading and its text', () => {
  const NOTES = '4. 18 March 2026. OpenAI release notes: paid users who hit their limit on GPT-5.4 Thinking fall back to the smaller GPT-5.4 mini.'
  test('two real passages that carry every number between them hold', () => {
    assert.equal(quotesFail(['18 March 2026. OpenAI release notes', 'paid users who hit their limit on GPT-5.4 Thinking fall back to the smaller GPT-5.4 mini'],
      NOTES, 'By March 2026 paid users who hit the GPT-5.4 Thinking limit fall back to GPT-5.4 mini'), null)
  })
  test('one passage without the date does not', () => {
    assert.match(String(quotesFail(['paid users who hit their limit on GPT-5.4 Thinking fall back to the smaller GPT-5.4 mini'],
      NOTES, 'By March 2026 paid users fall back to GPT-5.4 mini')), /do not carry 2026/)
  })
  test('a sliver of a heading is ignored, not fatal', () => {
    assert.equal(quotesFail(['## GPT', '18 March 2026. OpenAI release notes', 'paid users who hit their limit on GPT-5.4 Thinking fall back to the smaller GPT-5.4 mini'],
      NOTES, 'By March 2026 paid users who hit the GPT-5.4 Thinking limit fall back to GPT-5.4 mini'), null)
    assert.match(String(quotesFail(['## GPT'], NOTES, 'anything')), /no passage long enough/)
  })
  test('one invented passage sinks the set', () => {
    assert.match(String(quotesFail(['18 March 2026. OpenAI release notes', 'paid users are quietly moved to GPT-5.4 mini'],
      NOTES, 'By March 2026 paid users are quietly moved to GPT-5.4 mini')), /not found word for word/)
  })
})

describe('the date lives in the heading, the fact under it', () => {
  const NOTES = [
    `${SOURCE_MARK}verbatim excerpt from https://help.openai.com/en/articles/6825453-chatgpt-release-notes`,
    '# August 12, 2025', '', '## GPT-5 Updates', '',
    '4o is back in the model picker for all paid users by default.', '',
    '# August 7, 2025', '', '## GPT-5', '',
    'It simplifies ChatGPT to a single auto-switching system that brings together the best of our previous models.',
    `${SOURCE_MARK}research`, '# Notes from 2019',
  ].join('\n')
  test('the nearest dated heading above a passage is its date', () => {
    assert.deepEqual(datedContext(NOTES, 'It simplifies ChatGPT to a single auto-switching system'), ['## GPT-5', '# August 7, 2025'])
    assert.equal(quotesFail(['It simplifies ChatGPT to a single auto-switching system'], NOTES, 'On 7 August 2025 GPT-5 became a single auto-switching system'), null)
  })
  test('a date further up, in an earlier entry, is not borrowed', () => {
    assert.match(String(quotesFail(['It simplifies ChatGPT to a single auto-switching system'], NOTES, 'On 12 August 2025 GPT-5 became a single auto-switching system')), /do not carry 12/)
  })
  test('nor one across the line where the next source starts', () => {
    assert.deepEqual(datedContext(NOTES, '4o is back in the model picker for all paid users by default.'), ['## GPT-5 Updates', '# August 12, 2025'])
    assert.equal(datedContext(`${SOURCE_MARK}a\n# 2019 notes\n${SOURCE_MARK}b\nThe fact itself, stated here.`, 'The fact itself, stated here.').length, 0)
  })
  test('numbers compare by value', () => {
    assert.deepEqual(numbersIn('$150.00, 08, 10,000 and 0.25'), ['150', '8', '10000', '0.25'])
    assert.equal(quotesFail(['| gpt-6-astra | $20.00 | $2.00 | $25.00 | $100.00 | $40.00 | $4.00 | $50.00 | $150.00 |'],
      '| gpt-6-astra | $20.00 | $2.00 | $25.00 | $100.00 | $40.00 | $4.00 | $50.00 | $150.00 |', 'Astra costs up to $150'), null)
  })
})

describe('a passage shortened with an ellipsis', () => {
  const SRC = 'we are working to increase those rates and enable chatgpt to automatically choose the right model for a given prompt.'
  test('holds when every piece is there, in order', () => {
    assert.equal(inOrder('we are working to ... enable chatgpt to automatically choose', SRC), true)
    assert.equal(inOrder('we are working to … enable chatgpt', SRC), true)
  })
  test('fails when the pieces are out of order or one is invented', () => {
    assert.equal(inOrder('enable chatgpt to automatically ... we are working to', SRC), false)
    assert.equal(inOrder('we are working to ... pick the cheapest model', SRC), false)
  })
  test('the quote check uses it', () => {
    assert.equal(quotesFail(['We are working to ... enable ChatGPT to automatically choose the right model'], SRC, 'OpenAI said it was working to have ChatGPT choose the model'), null)
  })
  test('a sliver between ellipses proves nothing', () => {
    assert.equal(inOrder('we are working to ... the ... right model', SRC), false)
  })
})

describe('the second look at what the sweep caught', () => {
  const left = (sentence: string) => ({ sentence, claim: sentence, kind: 'unclassified' as const })
  const ice = left('Now it\'s like walking into an ice cream shop with forty flavours, a "thinking" scoop that costs extra.')
  const aug = left('You\'ll just notice the answer feels a bit dumber, the way people did in August 2025.')
  const cnbc = left('In June 2026, CNBC asked the people paying the bills.')
  test('an analogy with a scare quote is set aside, with its reason', () => {
    const out = resolveLeftovers([ice], [{ i: 0, claims: [], reason: 'analogy' }])
    assert.equal(out.claims.length, 0)
    assert.match(out.setAside[0].reason, /second look: analogy/)
  })
  test('facts found inside a sentence are checked one by one', () => {
    const out = resolveLeftovers([aug], [{ i: 0, claims: [{ claim: 'In August 2025 users said GPT-5 seemed dumber', kind: 'event' }], reason: '' }])
    assert.equal(out.claims.length, 1)
    assert.equal(out.claims[0].claim, 'In August 2025 users said GPT-5 seemed dumber')
  })
  test('a number is never waved through on a model\'s word', () => {
    const out = resolveLeftovers([cnbc], [{ i: 0, claims: [], reason: 'framing' }])
    assert.equal(out.claims.length, 1)
    assert.equal(out.setAside.length, 0)
  })
  test('a sentence the second look did not answer stays a claim', () => {
    const out = resolveLeftovers([ice, cnbc], [])
    assert.equal(out.claims.length, 2)
  })
  test('each sentence travels with the heading it sits under', () => {
    const body = '## WHAT IT IS NOW\n\nGPT-5 became the default.\n\n## THE FORKS\n\nFirst sign: the model picker disappears from the app.'
    assert.equal(sectionOf(body, 'First sign: the model picker disappears from the app.'), 'THE FORKS')
    assert.equal(sectionOf(body, 'GPT-5 became the default.'), 'WHAT IT IS NOW')
  })
  test('"you\'ll" reads as the future', () => {
    assert.equal(readsAsForecast('You\'ll just notice the answer feels a bit dumber.'), true)
    assert.equal(readsAsForecast('Anthropic sold three models in 2024.'), false)
    // House rule R1 labels a guess as a guess (piece 1, 2026-09-30).
    assert.equal(readsAsForecast("Here's our guess, in full: Amazon's real worry is the $68.6 billion."), true)
    assert.equal(readsAsForecast('Amazon filed an amended complaint on 21 September.'), false)
  })
})

describe('nothing with a number or a quotation goes unchecked', () => {
  const body = [
    '## WHAT IT IS NOW',
    "Cisco's product chief did the sums: $900 million a year. Anthropic sold one model in 2024.",
    '',
    'By 30 September 2027, at least two labs make routing the default.',
  ].join('\n')

  test('headings are not sentences', () => {
    assert.equal(sentences(body).some(s => s.includes('WHAT IT IS NOW')), false)
  })
  test('a checkable sentence the lister missed becomes a claim of its own', () => {
    const out = sweep(body, [{ sentence: "Cisco's product chief did the sums: $900 million a year.", claim: 'x', kind: 'number' }], [])
    assert.ok(out.claims.some(c => c.kind === 'unclassified' && c.sentence.includes('Anthropic sold one model in 2024')))
  })
  test('a forecast may be set aside', () => {
    const out = sweep(body, [], [{ sentence: 'By 30 September 2027, at least two labs make routing the default.', reason: 'prediction' }])
    assert.equal(out.claims.some(c => c.sentence.includes('2027')), false)
    assert.equal(out.setAside.length, 1)
  })
  test('a fact with no number and no quotation is caught too', () => {
    const out = sweep('Over at Anthropic it worked the same way: a small one, a middle one and a big one, and you picked.', [], [])
    assert.equal(out.claims.length, 1)
    assert.equal(out.claims[0].kind, 'unclassified')
  })
  test('a fact dressed as an opinion may not', () => {
    const out = sweep(body, [], [{ sentence: 'Anthropic sold one model in 2024.', reason: 'opinion' }])
    assert.ok(out.claims.some(c => c.sentence.includes('Anthropic sold one model in 2024')))
    assert.equal(out.setAside.length, 0)
  })
})

describe('verdicts', () => {
  test('either checker contradicting wins', () => {
    assert.equal(combine('supported', 'contradicted'), 'contradicted')
    assert.equal(combine('contradicted', 'supported'), 'contradicted')
  })
  test('agreement verifies; one source is said as one source', () => {
    assert.equal(combine('supported', 'supported'), 'verified')
    assert.equal(combine('supported', 'unclear', true), 'verified_on_file')
    assert.equal(combine('not_found', 'supported'), 'verified_web')
  })
  test('a summary alone is not enough: the engine filed Luna\'s Batch price as its standard price', () => {
    assert.equal(combine('supported', 'unclear', false), 'unverified')
    assert.equal(combine('supported', 'unavailable'), 'unverified')
    assert.equal(combine('supported', 'supported', false), 'verified')
  })
  test('nobody finding it is unverified', () => {
    assert.equal(combine('not_found', 'unclear'), 'unverified')
    assert.equal(combine('not_found', 'unavailable'), 'unverified')
  })
})

describe('the gate', () => {
  const body = 'x'.repeat(300)
  test('no check, no move', () => {
    assert.equal(gateStatus({}, body).ok, false)
  })
  test('a check of a different body does not count', () => {
    const fc = summarise([checked('verified')], [], 'an older body', 'perplexity:sonar-pro')
    assert.equal(gateStatus({ fact_check: fc }, body).ok, false)
  })
  test('one failing claim blocks', () => {
    const fc = summarise([checked('verified'), checked('unverified')], [], body, 'perplexity:sonar-pro')
    assert.equal(fc.passed, false)
    assert.equal(gateStatus({ fact_check: fc }, body).ok, false)
  })
  test('without an independent checker nothing passes', () => {
    const fc = summarise([checked('verified_on_file')], [], body, null)
    assert.equal(gateStatus({ fact_check: fc }, body).ok, false)
  })
  test('a clean check of this exact body passes', () => {
    const fc = summarise([checked('verified'), checked('verified_on_file')], [], body, 'perplexity:sonar-pro')
    assert.equal(fc.body_hash, bodyHash(body))
    assert.equal(fc.single_source, 1)
    assert.equal(gateStatus({ fact_check: fc }, body).ok, true)
  })
  test('a check survives save-draft cleaning the dashes, and not a changed number', () => {
    const raw = 'Cisco did the sums \u2014 $900 million a year across 2025\u20132026.'
    const saved = 'Cisco did the sums, $900 million a year across 2025-2026.'
    const fc = summarise([checked('verified')], [], raw, 'perplexity:sonar-pro')
    assert.equal(gateStatus({ fact_check: fc }, saved).ok, true)
    assert.equal(gateStatus({ fact_check: fc }, saved.replace('900', '9')).ok, false)
  })
  test('save-draft, the other road to review, asks the gate before it sends anything', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas/[id]/save-draft.ts', 'utf8')
    const gate = src.indexOf('const gate = gateStatus(meta, draft)')
    assert.ok(gate > 0)
    assert.ok(gate < src.indexOf('fetch(webhook'), 'the gate must run before the factory webhook fires')
    assert.match(src, /reason: 'fact_gate'/)
  })
  test('only a pasted excerpt with the page it came from can be filed as verbatim, and only those count as primary', () => {
    const route = readFileSync('apps/control-plane/api/content-ideas/[id]/materials.ts', 'utf8')
    assert.match(route, /const verbatim = b\.verbatim === true && kind === 'paste' && \/\^https\?:/)
    const check = readFileSync('apps/control-plane/api/content-ideas/[id]/fact-check.ts', 'utf8')
    // primaryText moved to api/_factGate.ts (2026-09-28), where it is tested without a database.
    assert.match(readFileSync('apps/control-plane/api/_factGate.ts', 'utf8'), /filter\(m => m\.verbatim === true && m\.content\)/)
    assert.match(check, /const primary = primaryText\(meta\)/)
    assert.match(check, /combine\(f\.verdict, ind\.verdict, f\.primary === true\)/)
  })
  test('a set-aside takes two readings: the lister\'s set-asides go to the second look too', () => {
    const check = readFileSync('apps/control-plane/api/content-ideas/[id]/fact-check.ts', 'utf8')
    assert.match(check, /const leftovers = leftoversOf\(swept\)/)
    const wu = { sentence: 'Each one, no matter how expensive, will tell you it was Thomas Jefferson.', reason: 'labelled_inference' }
    assert.deepEqual(leftoversOf({ claims: [], setAside: [wu] }), [{ sentence: wu.sentence, claim: wu.sentence, kind: 'unclassified' }])
    assert.match(check, /summarise\(checked, looked\.setAside, body, checker\)/)
  })
  test('the second look numbers each batch from 0 and asks again for what it missed', () => {
    const check = readFileSync('apps/control-plane/api/content-ideas/[id]/fact-check.ts', 'utf8')
    assert.match(check, /ids\.map\(\(id, i\) => \(\{ i, section:/)
    assert.match(check, /a\.i >= 0 && a\.i < ids\.length/)
    assert.match(check, /const retried = \(await pool\(missing, 6, id => ask\(\[id\]\)\)\)\.flat\(\)/)
    assert.match(check, /result\.second_look = \{ sentences: leftovers\.length, unanswered: second\.unanswered \}/)
  })
  test('the PATCH that moves a piece asks the gate first', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas.ts', 'utf8')
    assert.match(src, /updates\.state === 'review' \|\| updates\.state === 'approved' \|\| updates\.state === 'published'\)\s*\n\s*&& \(LIVE_SUBCHANNELS/)
    assert.match(src, /const gate = gateStatus\(jsonRecord\(current\.meta\), effective\)/)
    assert.match(src, /reason: 'fact_gate'/)
  })
})

describe('the confidence line is never a claim', () => {
  // Piece 2, run 13 (2026-09-26): the extractor listed "How sure we are: 75%."
  // as a claim and it failed against the sources; on run 11 the same line
  // happened to pass. It is Krish's judgement, so it is never checked.
  test('the line, bare or with the placeholder, is recognised; other sentences are not', () => {
    assert.equal(isConfidenceLine('How sure we are: 75%.'), true)
    assert.equal(isConfidenceLine('  How sure we are: 60%'), true)
    assert.equal(isConfidenceLine('How sure we are: [Krish to set]'), true)
    assert.equal(isConfidenceLine('How sure we are: 75%, because Cisco said so.'), false)
    assert.equal(isConfidenceLine('Glean estimated that 95% of usage runs on the priciest models.'), false)
  })

  test('the sweep never turns it into a leftover, whether the extractor listed it or not', () => {
    // Piece 2, run 15: the extractor left the line out, and the sweep sent it
    // to the second look as an unclassified sentence with a number in it.
    const body = 'On 7 August 2025, OpenAI made GPT-5 the default in ChatGPT.\n\n## OUR PREDICTION\n\nBy 30 September 2027, two of three labs will route by default.\n\nHow sure we are: 75%.'
    const claim = { sentence: 'On 7 August 2025, OpenAI made GPT-5 the default in ChatGPT.', claim: 'GPT-5 became the default on 7 August 2025', kind: 'date' as const }
    const forecast = { sentence: 'By 30 September 2027, two of three labs will route by default.', reason: 'prediction' }
    const unlisted = sweep(body, [claim], [forecast])
    assert.ok(!unlisted.claims.some(c => /How sure we are/.test(c.sentence)), 'an unlisted confidence line is not a leftover')
    const listed = sweep(body, [claim], [forecast, { sentence: 'How sure we are: 75%.', reason: 'prediction' }])
    assert.ok(!listed.claims.some(c => /How sure we are/.test(c.sentence)), 'a listed confidence line is not a leftover either')
    // Runs 16 and 17: the route re-reads every set-aside at the second look,
    // which turns a sentence with a number into a claim. It must never get there.
    for (const swept of [unlisted, listed]) assert.ok(!leftoversOf(swept).some(l => /How sure we are/.test(l.sentence)), 'never re-read')
    assert.ok(leftoversOf(listed).some(l => l.sentence === forecast.sentence), 'real set-asides are still re-read')
    // Whatever reaches it, the line is never handed to the second look.
    const slipped = { claims: [{ sentence: 'How sure we are: 75%.', claim: 'How sure we are: 75%.', kind: 'unclassified' as const }], setAside: [{ sentence: 'How sure we are: 75%.', reason: 'prediction' }] }
    assert.deepEqual(leftoversOf(slipped), [])
  })

  test('the route drops it from the claims and sets it aside before any check runs', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas/[id]/fact-check.ts', 'utf8')
    assert.match(src, /const claims = listed\.filter\(c => !isConfidenceLine\(c\.sentence\)\)/)
    assert.match(src, /const leftovers = leftoversOf\(swept\)/)
    assert.ok(src.indexOf('isConfidenceLine(c.sentence)') < src.indexOf('async function onFile'), 'the filter runs inside extract, before the checks')
  })
})

// Walk log F41 (2026-09-28). Only "How sure we are:" on a line of its own was
// exempt, and piece 1 writes its call as one paragraph that ends "Confidence:
// 70%.". Re-setting that number would have thrown a passed check away, and
// the sentence itself was a claim on every run, one that can only fail.
// Krish, 2026-09-26: a confidence no longer forces a fact re-check. The
// exemption now reads both labels with the Studio's call reader, and takes out
// the number alone.
describe('Krish\'s confidence under either label', () => {
  const PIECE_1 = [
    'Amazon blocked Muse on Sunday 20 September 2026.',
    '## Who gets paid',
    'Amazon made $68.6 billion from advertising, and Consumer confidence: 62% in August, per the survey.',
    '**The Call.** By 30 June 2027, Amazon opens an authorised route for shopping agents, and that route still shows them sponsored listings. Confidence: 70%.',
  ].join('\n\n')
  const at = (n: string) => PIECE_1.replace('Confidence: 70%', `Confidence: ${n}`)
  const verified = (): CheckedClaim => checked('verified')

  test('changing or setting the number on the call\'s "Confidence:" keeps a passed check', () => {
    assert.deepEqual(readPieceCall(PIECE_1), { ok: true, call: { statement: 'By 30 June 2027, Amazon opens an authorised route for shopping agents, and that route still shows them sponsored listings.', due: '2027-06-30', confidence_percent: 70 } })
    assert.equal(bodyHash(at('65%')), bodyHash(PIECE_1))
    assert.equal(bodyHash(at('[Krish to set]')), bodyHash(PIECE_1))
    const fc = summarise([verified()], [], PIECE_1, 'perplexity:sonar-pro')
    assert.equal(gateStatus({ fact_check: fc }, at('65%')).ok, true)
  })

  test('"How sure we are:" inside the call\'s paragraph is exempt the same way', () => {
    const call = 'It shipped late in 2026, and the price held.\n\n**Our prediction.** By 1 March 2028, the price halves. How sure we are: 80%'
    assert.equal(readPieceCall(call).ok, true)
    assert.equal(bodyHash(call.replace('80%', '85%')), bodyHash(call))
  })

  test('only the number: every other change to the text still breaks the check', () => {
    const base = bodyHash(PIECE_1)
    assert.notEqual(bodyHash(PIECE_1.replace('30 June 2027', '30 June 2028')), base, 'the call\'s date')
    assert.notEqual(bodyHash(PIECE_1.replace('still shows them', 'shows them')), base, 'the call\'s words')
    assert.notEqual(bodyHash(PIECE_1.replace('Confidence: 70%.', 'Confidence: 70%, because Amazon said so.')), base, 'words after the number')
    assert.notEqual(bodyHash(PIECE_1.replace('Confidence: 70%.', 'Certainty: 70%.')), base, 'the label')
    assert.notEqual(bodyHash(PIECE_1.replace('$68.6 billion', '$68.7 billion')), base, 'a fact elsewhere')
    // A labelled number outside the call is a fact like any other.
    assert.notEqual(bodyHash(PIECE_1.replace('Consumer confidence: 62%', 'Consumer confidence: 65%')), base, 'a labelled number outside the call')
    const fc = summarise([verified()], [], PIECE_1, 'perplexity:sonar-pro')
    assert.equal(gateStatus({ fact_check: fc }, PIECE_1.replace('30 June 2027', '30 June 2028')).ok, false)
  })

  test('every check stored before this change still matches its text', () => {
    // The hash as it was taken until 2026-09-28, for texts it already read.
    const legacy = (body: string) => createHash('sha256').update(
      sanitizeVoice(body).replace(/^([ \t]*How sure we are:)[ \t]*(?:\d{1,3}%\.?|\[Krish to set\])[ \t]*$/gim, '$1 [Krish to set]').trim(),
    ).digest('hex')
    const edition = readFileSync('editions/2026-09-who-picks-your-ai/body.md', 'utf8')
    for (const body of [edition, edition.replace('75%.', '[Krish to set]'), 'Cisco did the sums, $900 million a year.', PIECE_1.replace('Confidence: 70%.', '')]) {
      assert.equal(bodyHash(body), legacy(body))
    }
  })

  test('the sentence "Confidence: 70%." is never a claim, and a sentence with more in it still is', () => {
    assert.equal(isConfidenceLine('Confidence: 70%.'), true)
    assert.equal(isConfidenceLine('Confidence: [Krish to set].'), true)
    assert.equal(isConfidenceLine('Confidence: 70%, because Amazon said so.'), false)
    assert.equal(isConfidenceLine('Consumer confidence: 62% in August, per the survey.'), false)
    assert.equal(isConfidenceLine('Consumer confidence: 62%.'), false)
    const call = '**The Call.** By 30 June 2027, Amazon opens an authorised route for shopping agents, and that route still shows them sponsored listings.'
    const swept = sweep(PIECE_1, [], [{ sentence: call, reason: 'prediction' }])
    assert.ok(!swept.claims.some(c => /^Confidence:/.test(c.sentence)), 'not a leftover')
    assert.ok(!leftoversOf(swept).some(l => /^Confidence:/.test(l.sentence)), 'never re-read')
    assert.ok(swept.claims.some(c => /Consumer confidence/.test(c.sentence)), 'the survey sentence is still checked')
  })
})

describe('spacing is not wording', () => {
  const SRC = "Multiple people in the AMA complained GPT-5 wasn't working as well for them as 4o did.\n\nAltman said the reason GPT-5 seemed \u201cdumber\u201d was the router wasn't working properly.\n\n| Model | Output |\n|---|---|\n| GPT-6 Astra | $50.00 |"
  test('a passage glued across two paragraphs still holds (piece 2, run 15)', () => {
    assert.equal(quotesFail(["complained GPT-5 wasn't working as well for them as 4o did.Altman said the reason GPT-5 seemed \u201cdumber\u201d"], SRC, 'People said GPT-5 seemed dumber'), null)
  })
  test('a respaced table row still holds (piece 2, run 14)', () => {
    assert.equal(quotesFail(['| GPT-6 Astra |  $50.00 |'], SRC, 'GPT-6 Astra costs $50'), null)
  })
  test('a passage with the quote marks dropped still holds (piece 2, run 16)', () => {
    const src = 'OpenAI introduced a \u201creal-time router\u201d that decides which model to use for a particular prompt.'
    assert.equal(quotesFail(['a real-time router that decides which model to use for a particular prompt'], src, 'x'), null)
  })

  test('different words still fail', () => {
    assert.match(quotesFail(["complained GPT-5 wasn't working as well for them as 5 did. Altman said"], SRC, 'x') || '', /not found word for word/)
    assert.match(quotesFail(['| GPT-6 Astra | $5.00 |'], SRC, 'GPT-6 Astra costs $5') || '', /not found word for word|do not carry/)
  })
})

// Walk log F33 (2026-09-28, piece 1). The filer keeps the page's markdown
// links, so a verbatim excerpt reads "[2025 filing](https://...)", and a
// checker quoting the visible words failed "word for word" on three of
// fifteen passages. The comparison now reads link text as a reader does.
describe('a link reads as its words', () => {
  const FILED = [
    'Title: amzn-20251231',
    'Amazon told investors in its [2025 filing](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm) that advertising services revenue was $68.6 billion.',
    'Amazon\u2019s Conditions of Use,[those Conditions have included](https://www.thefashionlaw.com/amazon-perplexity-case/)dedicated Agent Terms since May 2025.',
  ].join('\n\n')

  test('a quote of the visible words holds against a filed excerpt that keeps the link', () => {
    assert.equal(quotesFail(['Amazon told investors in its 2025 filing that advertising services revenue was $68.6 billion.'], FILED, 'Amazon reported $68.6 billion of advertising revenue in its 2025 filing'), null)
    assert.equal(quotesFail(['those Conditions have included dedicated Agent Terms since May 2025'], FILED, 'Agent Terms since May 2025'), null)
    assert.equal(norm('[2025 filing](https://www.sec.gov/x.htm)'), '2025 filing')
  })

  test('a quote that keeps the link syntax still holds', () => {
    assert.equal(quotesFail(['in its [2025 filing](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm) that advertising services revenue was $68.6 billion'], FILED, '$68.6 billion in 2025'), null)
  })

  test('a number only in a link\'s address carries nothing', () => {
    const src = 'The [annual report](https://example.test/reports/2025/68635.htm) shows advertising grew.'
    assert.match(quotesFail(['The [annual report](https://example.test/reports/2025/68635.htm) shows advertising grew.'], src, 'advertising was 68635 in 2025') || '', /do not carry 68635, 2025/)
  })

  test('different words still fail with the links stripped', () => {
    assert.match(quotesFail(['Amazon told investors in its 2025 filing that advertising revenue was $69.6 billion.'], FILED, '$69.6 billion') || '', /not found word for word/)
  })
})

// Zero tolerance survives the change (Krish, 2026-09-28: "fact check as much
// as possible until is no longer needed"). Reading links as words can only
// let a real passage be found; it never lets a contradiction through.
describe('a contradicted claim still blocks', () => {
  test('either checker contradicting wins, even over a verbatim source that supports it', () => {
    assert.equal(combine('supported', 'contradicted', true), 'contradicted')
    assert.equal(combine('contradicted', 'supported', true), 'contradicted')
  })
  test('one contradicted claim fails the whole check and the gate refuses the move', () => {
    const body = 'Amazon reported $68.6 billion of advertising revenue in 2025. It blocked the agent on 17 September.'
    const contradicted: CheckedClaim = { ...checked('contradicted'), sentence: 'It blocked the agent on 17 September.' }
    const fc = summarise([checked('verified'), contradicted], [], body, 'perplexity:sonar-pro')
    assert.equal(fc.passed, false)
    assert.equal(fc.blocking, 1)
    const gate = gateStatus({ fact_check: fc }, body)
    assert.equal(gate.ok, false)
    assert.match(gate.reason || '', /1 claim failed the fact check/)
  })
  test('the contradiction check compares link text too, so a filed contradiction is found', () => {
    const src = 'Amazon said it began blocking the agent on [18 September](https://example.test/a).'
    assert.ok(norm(src).includes(norm('began blocking the agent on 18 September')))
  })
})

// Walk log F33 again: the gate read research dives as `question` and
// `sources`, but dive-deeper and research-topic store `query` and
// `citations`, and dive-deeper also files the findings as a material. So a
// dive's question and URLs never reached the checkers, and its findings came
// in twice. Shapes below are the live ones (meta.deep_dives and
// meta.materials on piece 3, read 2026-09-28).
describe('the sources the checkers read', () => {
  const AT = '2026-09-28T19:03:10.579Z'
  const FINDINGS = 'Salesforce and NVIDIA announced Koa on 15 September 2026 at Dreamforce, built by post-training an open model.'
  const dive = { query: 'What exactly did Salesforce announce about Koa?', findings: FINDINGS, citations: ['https://www.salesforce.com/news/koa', 'https://blogs.nvidia.com/koa'], at: AT }
  const filed = { id: 'm1', kind: 'research' as const, title: dive.query, content: `${FINDINGS}\n\nSources:\n${dive.citations.join('\n')}`, url: null, at: AT }
  const verbatim = { id: 'm2', kind: 'paste' as const, by: 'claude_code', verbatim: true, url: 'https://arxiv.org/pdf/2609.15066v1', title: 'Paper (verbatim)', content: 'Koa 0.86, remaining below the strongest frontier models.' }

  test('a dive filed as a material is read once, with its question and its links', () => {
    const text = sourcesText({ deep_dives: [dive], materials: [filed, verbatim] })
    assert.equal(text.split(FINDINGS).length - 1, 1, 'the findings appear once')
    assert.match(text, /What exactly did Salesforce announce about Koa\?/)
    assert.match(text, /https:\/\/blogs\.nvidia\.com\/koa/)
    assert.match(text, /verbatim excerpt from https:\/\/arxiv\.org\/pdf\/2609\.15066v1/)
  })

  test('a dive with no material of its own is read under its stored names', () => {
    const text = sourcesText({ deep_dives: [dive], materials: [] })
    assert.match(text, new RegExp(`${SOURCE_MARK}deep dive: What exactly did Salesforce announce about Koa\\?`))
    assert.match(text, /Sources:\nhttps:\/\/www\.salesforce\.com\/news\/koa\nhttps:\/\/blogs\.nvidia\.com\/koa/)
    assert.equal(text.split(FINDINGS).length - 1, 1)
  })

  test('a row written with the older names is still read', () => {
    const text = sourcesText({ deep_dives: [{ question: 'Old question?', answer: 'Old answer about 12 things.', sources: ['https://old.test/a'] }] })
    assert.match(text, /deep dive: Old question\?\nOld answer about 12 things\.\n\nSources:\nhttps:\/\/old\.test\/a/)
  })

  test('only the verbatim excerpts are primary', () => {
    const primary = primaryText({ deep_dives: [dive], materials: [filed, verbatim] })
    assert.match(primary, /remaining below the strongest frontier models/)
    assert.doesNotMatch(primary, /Dreamforce/)
  })
})
