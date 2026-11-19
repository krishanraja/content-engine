import { describe, expect, it } from 'vitest'
import { beatMotion } from './beatMotion'
import { resolveMotion } from './motionProfiles'
import type { EngineBeat } from '../props'
import props from '../../../../../docs/plans/b019dbf8-8051-4cab-9b5e-2ad77b3f5118/ve/props.short.json'

describe('a beat arriving across the face/picture line (Tue 17, 19 Nov 2026)', () => {
  const profile = resolveMotion(props.motion as never)!
  const beats = props.beats as unknown as EngineBeat[]
  const index = beats.findIndex((b) => b.id === 'power')
  const start = beats[index]!.fromFrame
  const view = { focusable: false } as never

  it('crossfades in under the style when nothing asks otherwise', () => {
    expect(beatMotion(profile, beats, index, start + 1, view, 1080, 1920).fade).toBeLessThan(1)
  })

  it('cuts in whole when the beat before shows his face, so his take never ghosts through it', () => {
    expect(beatMotion(profile, beats, index, start + 1, view, 1080, 1920, undefined, undefined, true).fade).toBe(1)
  })
})
