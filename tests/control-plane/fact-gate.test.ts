import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import {
  bodyHash, combine, datedContext, gateStatus, inOrder, isConfidenceLine, numbersIn, quoteHolds, quotesFail, readsAsForecast, resolveLeftovers, sectionOf, sentences, SOURCE_MARK,
  summarise, sweep,
  type CheckedClaim,
} from '../../apps/control-plane/api/_factGate.js'

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
    assert.match(check, /filter\(m => m\.verbatim === true && m\.content\)/)
    assert.match(check, /combine\(f\.verdict, ind\.verdict, f\.primary === true\)/)
  })
  test('a set-aside takes two readings: the lister\'s set-asides go to the second look too', () => {
    const check = readFileSync('apps/control-plane/api/content-ideas/[id]/fact-check.ts', 'utf8')
    assert.match(check, /\.\.\.swept\.setAside\.map\(a => \(\{ sentence: a\.sentence, claim: a\.sentence, kind: 'unclassified'/)
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

  test('the route drops it from the claims and sets it aside before any check runs', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas/[id]/fact-check.ts', 'utf8')
    assert.match(src, /const claims = listed\.filter\(c => !isConfidenceLine\(c\.sentence\)\)/)
    assert.ok(src.indexOf('isConfidenceLine(c.sentence)') < src.indexOf('async function onFile'), 'the filter runs inside extract, before the checks')
  })
})
