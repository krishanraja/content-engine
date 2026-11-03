import { z } from 'zod'
import { AbsoluteFill, OffthreadVideo, Sequence } from 'remotion'
import { BrandFrame } from './BrandFrame'
import { useEngineFrame } from './clock'
import { DEVICES } from './devices/registry'
import { slotsFor, splitCameraBox, splitPlatePosition } from './layouts'
import { setActiveCanvas } from './kit/lock'
import { EngineAudio } from './audio'
import type { EngineRenderProps } from './props'

// Placement belongs to the composition, never to a strict device schema.
const PlaceSchema = z.object({
  left: z.number().finite(), top: z.number().finite(),
  width: z.number().finite().positive(), height: z.number().finite().positive(),
  scale: z.number().finite().positive(),
}).strict()

/** The composition owns the clock; every device and chrome layer receives global frames. */
export function FormatMaster(props: EngineRenderProps) {
  const frame = useEngineFrame()
  const objects = new Map(props.objects.map((object) => [object.obj, object]))
  const width = props.aspect === '9:16' ? 1080 : 1920
  const height = props.aspect === '9:16' ? 1920 : 1080
  const activeBeat = props.beats.find((beat) => frame >= beat.fromFrame && frame < beat.toFrame)
  const split = activeBeat?.layout === 'SPLIT'
  const camera = split ? splitCameraBox(props.aspect) : undefined
  setActiveCanvas(width, height)

  return (
    <AbsoluteFill style={{ backgroundColor: props.tokens.ink, overflow: 'hidden' }}>
      {props.segments.map((segment, index) => (
        <Sequence key={`segment-${index}`} from={segment.fromFrame} durationInFrames={segment.durationFrames}>
          <AbsoluteFill style={{ overflow: 'hidden', ...(camera ?? {}) }}>
            <OffthreadVideo
              src={segment.src}
              trimBefore={segment.trimBeforeFrames}
              muted
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                ...(split ? { objectPosition: splitPlatePosition(activeBeat?.plate?.crop) } : segment.crop ? {
                  transformOrigin: 'center center',
                  transform: `translate(${segment.crop.x}px, ${segment.crop.y}px) scale(${segment.crop.scale})`,
                } : {}),
              }}
            />
          </AbsoluteFill>
        </Sequence>
      ))}
      {props.beats.map((beat) => {
        // Beats mount by frame range with no time offset, so media nested inside a device (a recording's own
        // Sequence) runs on the same global clock as everything else (INV-ONE-CLOCK).
        if (frame < beat.fromFrame || frame >= beat.toFrame) return null
        const slots = slotsFor(beat.layout, props.aspect, beat.uses.length)
        return (
          <AbsoluteFill key={`devices-${beat.id}`} style={beat.layout === 'SPLIT' ? { height: splitCameraBox(props.aspect).top, backgroundColor: props.tokens.cream, overflow: 'hidden' }
            // A STAGE beat with no plate is voice over graphics: the take is hidden under the house ink ground,
            // the ground StageHeader's logo is drawn for.
            : beat.plate?.source === 'none' ? { backgroundColor: props.tokens.ink } : {}}>
            <AbsoluteFill>
            {beat.uses.map((id, index) => {
              const object = objects.get(id)
              if (!object) throw new Error(`ve: no object ${id}`)
              const Device = Object.hasOwn(DEVICES, object.device) ? DEVICES[object.device] : undefined
              if (!Device) throw new Error(`ve: no device ${object.device}`)
              const { place, ...params } = object.params
              if (Object.hasOwn(object.params, 'place') && beat.layout !== 'SPLIT')
                throw new Error(`ve: place on non-SPLIT object ${id}`)
              const placement = Object.hasOwn(object.params, 'place')
                ? PlaceSchema.parse(place) : undefined
              const deviceObject = placement ? { ...object, params } : object
              const box = placement ? { left: 0, top: 0, width: placement.width, height: placement.height } : slots[index]
              if (!box) throw new Error(`ve: no slot ${index} in ${beat.layout}`)
              // Clip in frame coordinates so the device receives the original slot box.
              // STAGE shares the whole canvas; other layouts retain their slot clips.
              const clipPath = `inset(${box.top}px ${width - box.left - box.width}px ${height - box.top - box.height}px ${box.left}px${beat.layout === 'P6' && index === 1 ? ' round 40px' : ''})`
              return (
                <AbsoluteFill key={id} style={placement ? { left: placement.left, top: placement.top, width: placement.width, height: placement.height, transform: `scale(${placement.scale})`, transformOrigin: 'top left' } : beat.layout === 'SPLIT' ? {} : { clipPath }}>
                  <Device object={deviceObject} events={props.events} box={box} tokens={props.tokens} aspect={props.aspect} frame={frame} />
                </AbsoluteFill>
              )
            })}
            </AbsoluteFill>
          </AbsoluteFill>
        )
      })}
      {props.beats.map((beat) => (frame < beat.fromFrame || frame >= beat.toFrame ? null : (
        <AbsoluteFill key={`brand-${beat.id}`}>
          <BrandFrame props={props} beat={beat} frame={frame} />
        </AbsoluteFill>
      )))}
      <EngineAudio audio={props.audio} />
    </AbsoluteFill>
  )
}
