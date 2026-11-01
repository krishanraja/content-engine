import { describe, expect, it } from 'vitest'
import manifest from '../../../../../config/ve/devices.json'
import { EngineEventSchema } from '../props'
import { DEVICES } from './registry'

describe('device verb declarations', () => {
  it('logo_card supports enter, highlight and exit', () => {
    expect(manifest.devices.logo_card.verbs).toEqual(['enter', 'highlight', 'exit'])
  })
  it('scribble enters by drawing and supports only drawing and exit', () => {
    expect(manifest.devices.scribble.verbs).toEqual(['draw', 'exit'])
  })
  it('declares exactly the registered devices', () => {
    expect(Object.keys(manifest.devices).sort()).toEqual(Object.keys(DEVICES).sort())
  })

  it('declares only engine verbs without duplicates', () => {
    for (const { verbs } of Object.values(manifest.devices)) {
      expect(new Set(verbs).size).toBe(verbs.length)
      for (const verb of verbs) expect(EngineEventSchema.shape.verb.safeParse(verb).success).toBe(true)
    }
  })
})
