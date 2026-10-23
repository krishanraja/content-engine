import { describe, it, expect } from 'vitest'
import { knownPillar } from '../../apps/control-plane/api/_creatorMoves.js'

// The creator scout failed its whole run on 2026-10-20 because the model
// returned a pillar id that is not in content_pillars, and the insert's foreign
// key refused it. Only an active pillar's exact id may reach the insert.
const PILLARS = [{ id: 'pillar:agentic_ops' }, { id: 'pillar:builder_economy' }]

describe('knownPillar', () => {
  it('keeps an active pillar id', () => {
    expect(knownPillar('pillar:agentic_ops', PILLARS)).toBe('pillar:agentic_ops')
  })
  it('drops an invented, unprefixed or display-name id to null', () => {
    for (const id of ['pillar:made_up', 'agentic_ops', 'Agentic Operations']) expect(knownPillar(id, PILLARS)).toBeNull()
  })
  it('leaves no pillar as no pillar', () => {
    expect(knownPillar(null, PILLARS)).toBeNull()
    expect(knownPillar('pillar:agentic_ops', [])).toBeNull()
  })
})
