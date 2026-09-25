import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { displayText, receipts } from '../../apps/control-plane/api/_receipts.js'
import type { CheckedClaim, FactCheck } from '../../apps/control-plane/api/_factGate.js'

// Receipts put a source's own words on screen, so a Short or a carousel shows
// its proof instead of asserting it. The shapes below are piece 2's real
// fact-check records ("Who picks your AI?", passed 2026-09-25).

const CNBC = {
  id: 'm1', kind: 'paste' as const, verbatim: true,
  title: 'CNBC, 5 June 2026: Model routing is a fix for AI overspending (verbatim excerpts)',
  url: 'https://www.cnbc.com/2026/06/05/model-routing-on-ai-is-a-problem-for-openai-and-anthropic.html',
  content: 'Jeetu Patel, chief product officer at [Cisco](https://www.cnbc.com/quotes/CSCO/), laid out the math. At roughly $200 of token usage per employee per week, the cost is about $10,000 a year per worker.\n\nWith 90,000 employees, a company is looking at $900 million annually.',
}
function claim(over: Partial<CheckedClaim>): CheckedClaim {
  return {
    sentence: 'With 90,000 employees, a company is looking at $900 million a year.',
    claim: 'x', kind: 'number',
    on_file: { verdict: 'supported', quote: 'Jeetu Patel, chief product officer at [Cisco](https://www.cnbc.com/quotes/CSCO/), laid out the math. At roughly $200 of token usage per employee per week, the cost is about $10,000 a year per worker. | With 90,000 employees, a company is looking at $900 million annually.', note: null, primary: true },
    independent: { verdict: 'unclear', evidence: null, url: null, checker: 'perplexity:sonar-pro', correct_value: null },
    verdict: 'verified_on_file',
    ...over,
  }
}
function fc(claims: CheckedClaim[], passed = true): FactCheck {
  return { version: 1, ran_at: '2026-09-25T21:51:35Z', body_hash: 'h', independent_checker: 'perplexity:sonar-pro', claims, set_aside: [], passed, blocking: 0, single_source: 0 }
}

describe('receipts', () => {
  test('the passage that carries the sentence\'s numbers, with its source', () => {
    const [r] = receipts(fc([claim({})]), [CNBC])
    assert.equal(r!.quote, 'With 90,000 employees, a company is looking at $900 million annually.')
    assert.equal(r!.source.url, CNBC.url)
    assert.equal(r!.checked, 'on_file')
    assert.ok(r!.fits_screen && !r!.fragment)
    // The longer passage wins when it is the one that carries the numbers.
    const [p] = receipts(fc([claim({ sentence: 'Jeetu Patel did the sums: about $200 of tokens per worker per week comes to about $10,000 a year each.' })]), [CNBC])
    assert.match(p!.quote, /^Jeetu Patel/)
    assert.match(p!.display, /chief product officer at Cisco, laid out/)
  })
  test('the screen form drops markup and changes no word', () => {
    assert.equal(displayText('## **Updating GPT-5 (October 3, 2025)**\n\nAs we shared in a [recent blog](https://openai.com/x), we route.'), 'As we shared in a recent blog, we route.')
  })
  test('nothing from a check that did not pass, or from a claim the sources did not hold', () => {
    assert.deepEqual(receipts(fc([claim({})], false), [CNBC]), [])
    assert.deepEqual(receipts(fc([claim({ verdict: 'verified_web', on_file: { verdict: 'not_found', quote: null, note: null } })]), [CNBC]), [])
  })
  test('a passage from no known source is left out, never shown unattributed', () => {
    assert.deepEqual(receipts(fc([claim({})]), []), [])
    // ...unless the web check agreed and names the page.
    const [r] = receipts(fc([claim({ verdict: 'verified', independent: { verdict: 'supported', evidence: 'e', url: 'https://example.com/a', checker: 'p', correct_value: null } })]), [])
    assert.equal(r!.source.url, 'https://example.com/a'); assert.equal(r!.checked, 'twice')
  })
  test('a table cell is a fragment', () => {
    const cell = claim({ sentence: 'Luna costs $0.50 for a million tokens.', on_file: { verdict: 'supported', quote: 'Output\n$0.50', note: null, primary: true } })
    const [r] = receipts(fc([cell]), [{ ...CNBC, content: 'Pricing\nOutput\n$0.50 per million' }])
    assert.ok(r!.fragment)
  })
})
