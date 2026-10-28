import { AbsoluteFill, OffthreadVideo, Sequence } from 'remotion'
import { BrandFrame } from './BrandFrame'
import { useEngineFrame } from './clock'
import { DEVICES } from './devices/registry'
import { slotsFor } from './layouts'
import { EngineAudio } from './audio'
import type { EngineRenderProps } from './props'

/** The composition owns the clock; every device and chrome layer receives global frames. */
export function FormatMaster(props: EngineRenderProps) {
  const frame = useEngineFrame()
  const objects = new Map(props.objects.map((object) => [object.obj, object]))
  const width = props.aspect === '9:16' ? 1080 : 1920
  const height = props.aspect === '9:16' ? 1920 : 1080

  return (
    <AbsoluteFill style={{ backgroundColor: props.tokens.ink, overflow: 'hidden' }}>
      {props.segments.map((segment, index) => (
        <Sequence key={`segment-${index}`} from={segment.fromFrame} durationInFrames={segment.durationFrames}>
          <AbsoluteFill style={{ overflow: 'hidden' }}>
            <OffthreadVideo
              src={segment.src}
              trimBefore={segment.trimBeforeFrames}
              muted
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                ...(segment.crop ? {
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
          <AbsoluteFill key={`devices-${beat.id}`}>
            {beat.uses.map((id, index) => {
              const object = objects.get(id)
              if (!object) throw new Error(`ve: no object ${id}`)
              const Device = Object.hasOwn(DEVICES, object.device) ? DEVICES[object.device] : undefined
              if (!Device) throw new Error(`ve: no device ${object.device}`)
              const box = slots[index]
              if (!box) throw new Error(`ve: no slot ${index} in ${beat.layout}`)
              // Clip in frame coordinates so the device receives the original slot box.
              // STAGE shares the whole canvas; other layouts retain their slot clips.
              const clipPath = `inset(${box.top}px ${width - box.left - box.width}px ${height - box.top - box.height}px ${box.left}px${beat.layout === 'P6' && index === 1 ? ' round 40px' : ''})`
              return (
                <AbsoluteFill key={id} style={{ clipPath }}>
                  <Device object={object} events={props.events} box={box} tokens={props.tokens} aspect={props.aspect} frame={frame} />
                </AbsoluteFill>
              )
            })}
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
