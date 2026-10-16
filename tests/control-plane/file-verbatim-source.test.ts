import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { cloudProxyProblem, excerpt, htmlToText, isStampLine } from '../../apps/control-plane/scripts/file-verbatim-source.js'

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
  test('a sentence that starts with "Updated" is not a date stamp, so it never lands under another date', () => {
    // 2026-10-16: OpenAI's release notes. The plugin line is from 21 Aug 2026;
    // kept as a stamp, it was filed under the 29 Sep 2026 heading.
    const page = [
      'Title: ChatGPT release notes | OpenAI Help Center', '', 'Updated: 17 hours ago', '',
      '# September 29, 2026', '', '## GPT-6.1 Sol in ChatGPT Work and Codex', '',
      'GPT-6.1 Sol improves on GPT-6 Sol in agentic coding, computer use, and professional work.', '',
      '# August 21, 2026', '', '## Improved plugin discovery on web and mobile', '',
      'Updated plugin recommendations make it easier to find tools people continue to use.',
    ].join('\n')
    const { content } = excerpt(page, [/GPT-6\.1 Sol improves/])
    assert.match(content, /^Title: ChatGPT release notes \| OpenAI Help Center\n\nUpdated: 17 hours ago\n\n# September 29, 2026/)
    assert.doesNotMatch(content, /plugin/)
    for (const stamp of ['Updated: 6 days ago', 'Updated 3 May 2026', 'Updated yesterday', 'Published Time: 2025-08-10T17:59:04.000Z', 'Published: Sep 22, 2026']) {
      assert.ok(isStampLine(stamp), stamp)
    }
    for (const body of ['Updated plugin recommendations make it easier to find tools people continue to use.', 'Published research shows 40% gains.', 'Updated pricing', 'Titles change often']) {
      assert.ok(!isStampLine(body), body)
    }
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

describe('htmlToText, for a page the reader refuses', () => {
  test('keeps the title, the headings and the words, and drops scripts and styles', () => {
    const html = '<html><head><title>Sora 2 Model &amp; API</title><style>p{color:red}</style><script>var x = "September 24, 2026"</script></head>'
      + '<body><h2>Specialized models</h2><p>The Sora 2 models were shut down on <b>September 24, 2026</b>.</p><p>No&nbsp;replacement&#8217;s listed.</p></body></html>'
    const text = htmlToText(html)
    assert.deepEqual(text.split('\n'), [
      'Title: Sora 2 Model & API',
      '## Specialized models',
      'The Sora 2 models were shut down on September 24, 2026.',
      'No replacement’s listed.',
    ])
    assert.ok(!text.includes('var x'))
    assert.ok(!text.includes('color:red'))
  })
})

describe('file-verbatim-source files through the cloud session proxy', () => {
  test('a cloud session with a proxy and no NODE_USE_ENV_PROXY is refused, saying what to run', () => {
    const msg = cloudProxyProblem({ CLAUDE_CODE_REMOTE: 'true', HTTPS_PROXY: 'http://proxy:8080' })
    assert.match(String(msg), /NODE_USE_ENV_PROXY=1/)
  })
  test('with NODE_USE_ENV_PROXY=1, or outside a cloud session, nothing is in the way', () => {
    assert.equal(cloudProxyProblem({ CLAUDE_CODE_REMOTE: 'true', HTTPS_PROXY: 'http://proxy:8080', NODE_USE_ENV_PROXY: '1' }), null)
    assert.equal(cloudProxyProblem({ HTTPS_PROXY: 'http://proxy:8080' }), null)
    assert.equal(cloudProxyProblem({ CLAUDE_CODE_REMOTE: 'true' }), null)
  })
})
