import { describe, it, expect } from 'vitest'
import { renderTasteBlock } from '../../apps/control-plane/api/_taste.js'
import { buildReviseSystem } from '../../apps/control-plane/api/_revisePrompt.js'

// The taste ledger's claims reach the writers and nobody else. With nothing
// approved, the prompt must be exactly what it was before the ledger existed.

const ctx = { voice: 'VOICE', channelCorpus: 'CORPUS', materialsBlock: '' }

describe('what Krish approved, in the writers\' prompt', () => {
  it('changes nothing when he has approved nothing', () => {
    expect(renderTasteBlock([])).toBe('')
    expect(buildReviseSystem({ ...ctx, taste: '' }, { value: 'punchier' })).toBe(buildReviseSystem(ctx, { value: 'punchier' }))
  })

  it('carries an approved claim, framed as craft and never topic', () => {
    const block = renderTasteBlock([{ statement: 'Titles say what happens.', means: 'Name the event.', layer: 'packaging' }])
    expect(block).toContain('[packaging] Titles say what happens. So: Name the event.')
    expect(block).toMatch(/never to what you write about/)
    expect(buildReviseSystem({ ...ctx, taste: block }, { value: 'punchier' })).toContain('HOW KRISH LIKES IT (approved by him, form only):')
  })

  it('skips empty rows and caps the list', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ statement: i % 2 ? `Claim ${i}.` : '  ' }))
    expect(renderTasteBlock(rows).split('\n').filter(l => l.startsWith('- '))).toHaveLength(10)
  })
})
