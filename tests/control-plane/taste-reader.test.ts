import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TASTE_VENTURE, proposalVenture, renderTasteBlock, ventureLabel, withVenture } from '../../apps/control-plane/api/_taste.js'
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

// The ledger is keyed by venture (Krish, 2026-10-28: "The ledger is keyed by venture not repository. Makeyourmindup as
// a separate venture to mindmake"). This repository reads Make Your Mind Up's, 'publication', and never another's;
// the board shows every venture's proposals, each labelled.
describe('the taste ledger, read for Make Your Mind Up only', () => {
  it('filters every ledger read here by publication', () => {
    expect(TASTE_VENTURE).toBe('publication')
    const reader = readFileSync('apps/control-plane/api/_taste.ts', 'utf8')
    expect(reader).toMatch(/from\('taste_profile_form'\)[\s\S]{0,120}\.eq\('venture', TASTE_VENTURE\)/)
    const week = readFileSync('apps/control-plane/api/week/options.ts', 'utf8')
    for (const table of ['feedback_cues', 'taste_claims', 'taste_evidence']) {
      const reads = week.split(`from('${table}')`).slice(1)
      expect(reads.length, table).toBeGreaterThan(0)
      for (const read of reads) expect(read.split('\n')[0], table).toMatch(/\.eq\('venture', TASTE_VENTURE\)/)
    }
  })

  it('labels each proposal with its venture, none meaning Make Your Mind Up', () => {
    expect(withVenture({ id: 'a', scope: { key: 'taste:voice' } })).toMatchObject({ venture: 'publication', venture_label: 'Make Your Mind Up' })
    expect(withVenture({ id: 'b', scope: { key: 'taste:voice', venture: 'heartside' } })).toMatchObject({ venture: 'heartside', venture_label: 'Heartside' })
    expect(withVenture({ id: 'c', scope: null })).toMatchObject({ venture: 'publication' })
    expect(ventureLabel('mindmake')).toBe('Mindmake')
    expect(ventureLabel('constructor')).toBe('constructor')
    expect(proposalVenture({ venture: 'investor' })).toBe('investor')
    const route = readFileSync('apps/control-plane/api/video-studio/learning-proposals.ts', 'utf8')
    expect(route).toContain('proposals: (data || []).map(withVenture)')
    expect(route).not.toMatch(/\.eq\('scope->>venture'|\.eq\('venture'/)
  })
})
