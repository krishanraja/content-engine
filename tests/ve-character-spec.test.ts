import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ProductionSpecV2Schema } from '../packages/contracts/src/production-spec'

// spec.character is optional and absent from every spec today; its gate is ve lint (scripts/velib/character.py,
// tests/ve_character_test.py). Here: the schema takes the field's one shape and nothing looser.
const ROOT = join(__dirname, '..')
const fixture = () => JSON.parse(readFileSync(join(ROOT, 'fixtures/ve/my-test-19s/spec.json'), 'utf8'))
const withCharacter = (character: unknown) => ({ ...fixture(), character })

describe('ve spec: character', () => {
  it('a spec without a character parses as before, and gains no field', () => {
    const parsed = ProductionSpecV2Schema.safeParse(fixture())
    expect(parsed.success).toBe(true)
    if (parsed.success) expect('character' in parsed.data).toBe(false)
  })

  it('takes a character by id, the cuts it plays in and a pose per cue word', () => {
    const cut = Object.keys(fixture().cuts)[0]
    const ok = ProductionSpecV2Schema.safeParse(withCharacter({ id: 'krish', cuts: [cut], cues: [{ at_w: 4, pose: 'point-up-left', spot: 'centre', sink_px: 120 }] }))
    expect(ok.success).toBe(true)
  })

  it('refuses a loose shape', () => {
    const cut = Object.keys(fixture().cuts)[0]
    const bad = [
      { id: 'krish', cuts: [], cues: [{ at_w: 4, pose: 'neutral' }] },
      { id: 'krish', cuts: [cut], cues: [] },
      { id: 'krish', cuts: [cut], cues: [{ at_w: 4, pose: 'neutral', sink_px: 400 }] },
      { id: 'krish', cuts: [cut], cues: [{ at_w: 4, pose: 'neutral', spot: 'top' }] },
      { id: 'krish', cuts: [cut], cues: [{ at_w: 4, pose: 'neutral' }], prompt: 'draw me' },
      { id: 'Krish Raja', cuts: [cut], cues: [{ at_w: 4, pose: 'neutral' }] },
    ]
    for (const character of bad) expect(ProductionSpecV2Schema.safeParse(withCharacter(character)).success).toBe(false)
  })
})
