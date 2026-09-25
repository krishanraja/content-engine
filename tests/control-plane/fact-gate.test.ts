import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import {
  bodyHash, combine, gateStatus, quoteHolds, sentences, summarise, sweep, type CheckedClaim,
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
    assert.equal(combine('supported', 'unclear'), 'verified_on_file')
    assert.equal(combine('not_found', 'supported'), 'verified_web')
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
  test('the PATCH that moves a piece asks the gate first', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas.ts', 'utf8')
    assert.match(src, /updates\.state === 'review' \|\| updates\.state === 'approved' \|\| updates\.state === 'published'\)\s*\n\s*&& \(LIVE_SUBCHANNELS/)
    assert.match(src, /const gate = gateStatus\(jsonRecord\(current\.meta\), effective\)/)
    assert.match(src, /reason: 'fact_gate'/)
  })
})
