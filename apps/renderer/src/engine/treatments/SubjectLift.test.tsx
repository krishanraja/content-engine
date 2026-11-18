import type { ReactElement, SVGProps } from 'react'
import { describe, expect, it } from 'vitest'
import { SubjectLift, subjectLiftParameters, type SubjectLiftProps } from './SubjectLift'

const props: SubjectLiftProps = {
  take: { src: 'take-frame.png', width: 1920, height: 1080, frame: 42 },
  matte: { src: 'matte-frame.png', width: 1920, height: 1080, frame: 42 },
  frame: 42, width: 1920, height: 1080, strength: 1, tokens: { mint: 'mint-token' }, id: 'lift',
}
describe('subject lift frame compositor', () => {
  it('scales every recipe parameter linearly', () => {
    const full = subjectLiftParameters(1), half = subjectLiftParameters(.5)
    for (const key of Object.keys(full) as (keyof typeof full)[]) expect(half[key]).toBe(full[key] / 2)
    expect(full.stops).toBe(-.6)
  })
  it('zero bypass contains only the unchanged source image', () => {
    const node = SubjectLift({ ...props, strength: 0 })
    const image = node.props.children as ReactElement<SVGProps<SVGImageElement>>
    expect(image.type).toBe('image')
    expect(image.props.href).toBe(props.take.src)
    expect(image.props.filter).toBeUndefined()
  })
  it('rejects mismatched dimensions and source frames', () => {
    expect(() => SubjectLift({ ...props, matte: { ...props.matte, frame: 41 } })).toThrow()
    expect(() => SubjectLift({ ...props, matte: { ...props.matte, height: 1 } })).toThrow()
    expect(() => SubjectLift({ ...props, strength: NaN })).toThrow()
  })
  it('is deterministic at the source frame', () => {
    expect(SubjectLift(props)).toEqual(SubjectLift(props))
  })
})
