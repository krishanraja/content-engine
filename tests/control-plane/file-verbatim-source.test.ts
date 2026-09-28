import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { excerpt } from '../../apps/control-plane/scripts/file-verbatim-source.js'

const PAGE = [
  'Title: Model Release Notes', '', 'URL Source: https://help.openai.com/x', '',
  '## GPT-5.4 mini in ChatGPT (March 18, 2026)', '',
  'For Plus, Pro, and other paid users, GPT-5.4 mini will be used as a fallback for GPT-5.4 Thinking.', '',
  '## Updating GPT-5 (October 3, 2025)', '', '### A sub-heading', '',
  "we've been using our real-time router to direct sensitive parts of conversations to reasoning models.",
].join('\n')

describe('file-verbatim-source keeps the words and their date', () => {
  test('a match comes with its heading and the first dated heading above it', () => {
    const { content, unmatched } = excerpt(PAGE, [/real-time router/i])
    assert.deepEqual(unmatched, [])
    assert.match(content, /^Title: Model Release Notes/)
    assert.match(content, /## Updating GPT-5 \(October 3, 2025\)\n\n### A sub-heading\n\nwe've been using/)
    assert.doesNotMatch(content, /March 18, 2026/)
  })
  test('undated headings in between are left out', () => {
    const page = ['Title: T', '## News (May 1, 2026)', '## Pricing', '## Use cases', 'It costs 40% less to run.'].join('\n')
    assert.equal(excerpt(page, [/40% less/]).content, 'Title: T\n\n## News (May 1, 2026)\n\n## Use cases\n\nIt costs 40% less to run.')
  })
  test('a pattern that matches nothing is reported, so nothing is filed', () => {
    assert.deepEqual(excerpt(PAGE, [/router/i, /never on this page/i]).unmatched, ['/never on this page/i'])
  })
  test('link text is filed without the link syntax, and patterns match the words a reader sees', () => {
    // Walk log F34: piece 1's excerpts kept "[2025 filing](https://...)" and
    // ",[those Conditions have included](https://...)dedicated".
    const page = [
      'Title: amzn-20251231', '',
      '## [Results](https://www.sec.gov/results) for 2025', '',
      'Amazon said in its [2025 filing](https://www.sec.gov/Archives/edgar/data/1018724/x.htm) that advertising grew.', '',
      '![Image 3: a chart of ad revenue](https://example.test/chart.png)',
    ].join('\n')
    const { content, unmatched } = excerpt(page, [/its 2025 filing that/, /chart of ad revenue/])
    assert.deepEqual(unmatched, [])
    assert.equal(content, 'Title: amzn-20251231\n\n## Results for 2025\n\nAmazon said in its 2025 filing that advertising grew.\n\nImage 3: a chart of ad revenue')
    assert.doesNotMatch(content, /\]\(|https?:/)
  })
})
