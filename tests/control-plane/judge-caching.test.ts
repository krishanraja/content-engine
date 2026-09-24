import { describe, expect, it } from 'vitest'
import { buildSystemBlocks } from '../../apps/control-plane/api/_content.js'

// NOTE, 2026-09-24 evening: THE JUDGE PANEL NO LONGER USES THIS SHAPE. It was
// switched to it that afternoon and reverted the same evening, measured rather
// than argued: cache_read_tokens came back 0 across 153 calls because the block
// landed at ~1,735 tokens, under Haiku's 2,048-token minimum, AND about four in
// five judges stopped returning JSON, which produced a live sweep of 4 unjudged
// ideas out of 5. See _judges/panel.ts for the record.
//
// These tests stay and still earn their place: buildSystemBlocks is exported,
// correct, and is what any future attempt will be built on. They describe the
// FUNCTION, not the panel — and the bar for pointing the panel at it again is a
// live call SEEN to return a non-zero cache read, not an argument from the
// documented floor, which is what produced this note.
//
// The judge fan-out sends one brief and one artifact to nine judges. Until
// 2026-09-24 the VARYING part (the rubric) sat in the cacheable slot and the
// SHARED part sat in `user`, and cacheableSystem only fires above 6000
// characters while a rubric is about 1650 — so nothing was cached at all and
// the brief went out nine times per idea at full rate.
//
// A cache that silently does not cache is the failure mode here: no error, no
// entry, just a bill. These assert the block ORDER and the breakpoints,
// because that is what makes a prefix match, and none of it is visible in a
// response body.
const BRIEF = 'B'.repeat(7000)
const ART = 'A'.repeat(2000)
const RUBRIC = 'R'.repeat(1600)

describe('the judge fan-out caches what it actually repeats', () => {
  it('puts the stable brief first, then the artifact, then the rubric', () => {
    const blocks = buildSystemBlocks({ systemStable: BRIEF, system: ART, systemTail: RUBRIC, cache: true, cacheTtl: '1h' }) as any[]
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks.map(b => b.text[0])).toEqual(['B', 'A', 'R'])
  })

  it('breaks the cache after the brief and after the artifact, never after the rubric', () => {
    const blocks = buildSystemBlocks({ systemStable: BRIEF, system: ART, systemTail: RUBRIC, cache: true, cacheTtl: '1h' }) as any[]
    // Two entries: [brief] and [brief+artifact]. The first is read by every
    // judge of every idea in a sweep; the second by the other eight judges of
    // this one.
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    // The rubric varies per judge. A breakpoint after it would write nine
    // entries per idea and read none of them.
    expect(blocks[2].cache_control).toBeUndefined()
  })

  it('keeps the rubric in the system role rather than demoting it to user', () => {
    // Moving it to `user` would also have made the prefix cacheable, and would
    // have bought the saving with a behaviour change. A judge's rubric is its
    // instruction.
    const blocks = buildSystemBlocks({ systemStable: BRIEF, system: ART, systemTail: RUBRIC, cache: true }) as any[]
    expect(blocks).toHaveLength(3)
    expect(blocks[2].text).toBe(RUBRIC)
  })

  it('sends one plain string when caching is off, losing nothing', () => {
    const out = buildSystemBlocks({ systemStable: BRIEF, system: ART, systemTail: RUBRIC, cache: false })
    expect(typeof out).toBe('string')
    for (const part of [BRIEF, ART, RUBRIC]) expect(out as string).toContain(part)
  })

  it('does not ask for a cache below the model minimum, where it would silently not cache', () => {
    // A prefix under the floor is not cached and nothing says so, so asking is
    // a 25% write surcharge on an entry that never exists.
    const out = buildSystemBlocks({ systemStable: 'short', system: 'short', systemTail: 'short', cache: true })
    expect(typeof out).toBe('string')
  })
})
