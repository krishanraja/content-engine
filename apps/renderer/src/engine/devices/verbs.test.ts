import { describe, expect, it } from 'vitest'
import manifest from '../../../../../config/ve/devices.json'
import { EngineEventSchema } from '../props'
import { DEVICES } from './registry'

describe('device verb declarations', () => {
  it('flat_mechanism declares seven cues', () => { expect(manifest.devices.flat_mechanism.verbs).toEqual(['enter','add','move','fill','highlight','count_to','exit']) })
  it('morph_stage declares exactly four cues', () => { expect(manifest.devices.morph_stage.verbs).toEqual(['enter', 'move', 'highlight', 'exit']) })
  it('iso_world declares its seven cues', () => { expect(manifest.devices.iso_world.verbs).toEqual(['enter', 'add', 'fill', 'carry', 'move', 'highlight', 'exit']) })
  it('ink_wash declares exactly five cues', () => { expect(manifest.devices.ink_wash.verbs).toEqual(['enter', 'draw', 'fill', 'highlight', 'exit']) })
  it('film_frame declares its five cues', () => { expect(manifest.devices.film_frame.verbs).toEqual(['enter', 'move', 'mark', 'highlight', 'exit']) })
  it('cursor_path declares its six cues', () => { expect(manifest.devices.cursor_path.verbs).toEqual(['enter', 'move', 'pick', 'type', 'send', 'exit']) })
  it('character_layer exposes only layer entrance and exit', () => {
    expect(manifest.devices.character_layer.verbs).toEqual(['enter', 'exit'])
    expect(() => DEVICES.character_layer!({} as never)).toThrow('never a beat object')
  })
  it('answer_stream declares its five cues', () => { expect(manifest.devices.answer_stream.verbs).toEqual(['enter', 'type', 'mark', 'light', 'exit']) })
  it('code_card declares four cues', () => { expect(manifest.devices.code_card.verbs).toEqual(['enter', 'type', 'highlight', 'exit']) })
  it('checklist declares its work and fill cues', () => {
    expect(manifest.devices.checklist.verbs).toEqual(['enter', 'dim', 'fill', 'exit'])
  })
  it('living_screen declares its nine cues', () => {
    expect(manifest.devices.living_screen.verbs).toEqual(['enter','move','count_to','mark','draw','pick','highlight','add','exit'])
  })
  it('ladder_stage declares its nine cues', () => {
    expect(manifest.devices.ladder_stage.verbs).toEqual(['enter','count_to','add','draw','move','fill','highlight','carry','exit'])
  })
  it('quota_chart declares its seven cues', () => {
    expect(manifest.devices.quota_chart.verbs).toEqual(['enter', 'fill', 'draw', 'mark', 'move', 'count_to', 'exit'])
  })
  it('agent_swarm declares its six cues', () => {
    expect(manifest.devices.agent_swarm.verbs).toEqual(['enter', 'add', 'fill', 'move', 'mark', 'exit'])
  })
  it('wall_screen declares exactly its four cues', () => {
    expect(manifest.devices.wall_screen.verbs).toEqual(['enter', 'move', 'mark', 'exit'])
  })
  it('arrangement declares its ten cues', () => {
    expect(manifest.devices.arrangement.verbs).toEqual(['enter','add','type','stamp','mark','highlight','fill','chip','move','exit'])
  })
  it('slot_machine declares its eight cues', () => {
    expect(manifest.devices.slot_machine.verbs).toEqual(['enter', 'type', 'pick', 'send', 'fill', 'bounce', 'highlight', 'exit'])
  })
  it('upload_flood declares its seven cues', () => {
    expect(manifest.devices.upload_flood.verbs).toEqual(['enter', 'fill', 'count_to', 'draw', 'type', 'pick', 'exit'])
  })
  it('leaderboard declares its eight cues', () => {
    expect(manifest.devices.leaderboard.verbs).toEqual(['enter', 'add', 'fill', 'stamp', 'move', 'highlight', 'mark', 'exit'])
  })
  it('office_floor declares all eleven actions', () => {
    expect(manifest.devices.office_floor.verbs).toEqual(['enter', 'add', 'fill', 'move', 'send', 'stamp', 'carry', 'highlight', 'draw', 'mark', 'exit'])
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
