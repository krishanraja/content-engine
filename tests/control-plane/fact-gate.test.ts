import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import {
  bodyHash, combine, gateStatus, quoteHolds, quotesFail, readsAsForecast, resolveLeftovers, sectionOf, sentences, summarise, sweep,
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
  test('one invented passage sinks the set', () => {
    assert.match(String(quotesFail(['18 March 2026. OpenAI release notes', 'paid users are quietly moved to GPT-5.4 mini'],
      NOTES, 'By March 2026 paid users are quietly moved to GPT-5.4 mini')), /not found word for word/)
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
  test('the PATCH that moves a piece asks the gate first', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas.ts', 'utf8')
    assert.match(src, /updates\.state === 'review' \|\| updates\.state === 'approved' \|\| updates\.state === 'published'\)\s*\n\s*&& \(LIVE_SUBCHANNELS/)
    assert.match(src, /const gate = gateStatus\(jsonRecord\(current\.meta\), effective\)/)
    assert.match(src, /reason: 'fact_gate'/)
  })
})
