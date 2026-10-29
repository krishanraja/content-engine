import { describe, expect, it } from 'vitest'
import { containsCommittedSecret } from '../scripts/secret-patterns.js'

describe('committed secret patterns', () => {
  const synthetic = ['synthetic', 'value', 'that', 'is', 'long', 'enough', 'to', 'be', 'a', 'secret'].join('_')

  it.each([
    `VIDEO_STUDIO_RUNNER_TOKEN=${synthetic}`,
    `# paste: ${synthetic}`,
    `vst_mcp_${'a'.repeat(96)}`,
    `rt_${'d'.repeat(48)}`,
    `sk_${'e'.repeat(48)}`,
    `ex_${'f'.repeat(48)}`,
    `ghp_${'b'.repeat(40)}`,
    `ttp_${'g'.repeat(40)}`,
    `TELEPROMPTER_API_KEY=${synthetic}`,
    `Authorization: "Bearer ${'c'.repeat(40)}"`,
    ['-----BEGIN', ' PRIVATE KEY-----'].join(''),
  ])('rejects a synthetic credential family without storing a real credential', (candidate) => {
    expect(containsCommittedSecret(candidate)).toBe(true)
  })

  it.each([
    'VIDEO_STUDIO_MCP_TOKEN=',
    'VIDEO_STUDIO_MCP_TOKEN=${VIDEO_STUDIO_MCP_TOKEN}',
    '# paste: <replace-me>',
    '# paste: [stored securely]',
    'MindmakeVideoStudio/studio-mcp-token-v2',
    'Authorization: Bearer ${VIDEO_STUDIO_MCP_TOKEN}',
    'TELEPROMPTER_API_KEY=',
    'his personal key (ttp_...)',
  ])('permits a non-secret placeholder or credential name', (candidate) => {
    expect(containsCommittedSecret(candidate)).toBe(false)
  })
})
