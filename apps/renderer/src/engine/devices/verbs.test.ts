import { describe, expect, it } from 'vitest'
import manifest from '../../../../../config/ve/devices.json'
import { EngineEventSchema } from '../props'
import { DEVICES } from './registry'

describe('device verb declarations', () => {
  it('leaderboard declares its eight cues', () => {
    expect(manifest.devices.leaderboard.verbs).toEqual(['enter', 'add', 'fill', 'stamp', 'move', 'highlight', 'mark', 'exit'])
  })
  it('logo_orbit declares its five cues', () => {
    expect(manifest.devices.logo_orbit.verbs).toEqual(['enter', 'add', 'chip', 'highlight', 'exit'])
  })
  it('typing_bubble declares its five verbs', () => {
    expect(manifest.devices.typing_bubble.verbs).toEqual(['enter', 'type', 'send', 'pick', 'exit'])
  })
  it('cursor_buddy declares its six character actions', () => {
    expect(manifest.devices.cursor_buddy.verbs).toEqual(['enter', 'bounce', 'sulk', 'wave', 'move', 'exit'])
  })
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
