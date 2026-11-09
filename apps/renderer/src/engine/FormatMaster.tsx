import { Fragment } from 'react'
import { z } from 'zod'
import { AbsoluteFill, OffthreadVideo, Sequence } from 'remotion'
import { BrandFrame } from './BrandFrame'
import { onTwos, progress, setMotionProfile, useEngineFrame } from './clock'
import { stageBubbleBox } from './devices/typing_bubble'
import { headlineLayout } from './devices/headline'
import { lightStage } from './chrome/lightStage'
import { headlineState } from './devices/headline/state'
import { DEVICES } from './devices/registry'
import { FOCUS, PEN } from './devices/focus'
import type { Box } from './devices/types'
import { slotsFor, splitCameraBox, splitPlatePosition } from './layouts'
import { setActiveCanvas } from './kit/lock'
import { resolveMotion, type MotionProfile } from './kit/motionProfiles'
import { beatMotion, halftoneTexture, keepsOutgoing, stageGround, sweepStyle, transitionFrames, type CameraView } from './kit/beatMotion'
import { focusRoom, placed } from './kit/focus'
import { Brackets, PaperTexture, SketchFrame, TORN_DEVICES, TornFilter, TornSeam, cutoutPose, darkGround, scanLines, splitGroundColour, tokensFor } from './kit/overlays'
import { HeroType, heroArea, heroLayout, heroPhrase } from './kit/heroType'
import { EngineAudio } from './audio'
import type { EngineBeat, EngineObject, EngineRenderProps } from './props'

// Placement belongs to the composition, never to a strict device schema.
const PlaceSchema = z.object({
  left: z.number().finite(), top: z.number().finite(),
  width: z.number().finite().positive(), height: z.number().finite().positive(),
  scale: z.number().finite().positive(),
}).strict()

/** What the camera sees on a beat (kit/focus.ts): for zoomToFocus the first device that reports a focus line, mapped
 *  through its SPLIT placement, and the room it must stay in; for followPen the first scribble's pen tip. Only read
 *  under a motion style. */
function cameraView(profile: MotionProfile, beat: EngineBeat, slots: readonly Box[], objects: ReadonlyMap<string, EngineObject>,
  props: EngineRenderProps, at: number): CameraView & { focusIndex: number } {
  const placeOf = (object: EngineObject) => {
    const place = Object.hasOwn(object.params, 'place') ? PlaceSchema.safeParse(object.params.place) : undefined
    return place?.success ? place.data : undefined
  }
  const first = beat.uses.length ? objects.get(beat.uses[0]!) : undefined
  const firstPlace = first ? placeOf(first) : undefined
  const fallback = firstPlace ? { left: firstPlace.left, top: firstPlace.top,
    width: firstPlace.width * firstPlace.scale, height: firstPlace.height * firstPlace.scale } : slots[0]
  if (profile.camera.kind === 'zoomToFocus' || profile.overlays?.includes('brackets')) {
    for (const [index, id] of beat.uses.entries()) {
      const object = objects.get(id)
      const report = object && Object.hasOwn(FOCUS, object.device) ? FOCUS[object.device] : undefined
      if (!object || !report) continue
      const place = placeOf(object)
      const box = place ? { left: 0, top: 0, width: place.width, height: place.height } : slots[index]
      if (!box) continue
      const { place: _place, ...params } = object.params
      const focus = report({ object: place ? { ...object, params } : object, events: props.events, box, aspect: props.aspect, frame: at })
      if (!focus) continue
      const room = focusRoom(props.aspect, beat.layout, beat.plate?.source !== 'none', slots)
      return { focusIndex: index, room, fallback, focus: { ...focus, rect: placed(focus.rect, place),
        ...(focus.from ? { from: placed(focus.from, place) } : {}) } }
    }
  }
  if (profile.camera.kind === 'followPen') {
    for (const id of beat.uses) {
      const object = objects.get(id)
      const track = object && Object.hasOwn(PEN, object.device) ? PEN[object.device] : undefined
      if (!object || !track) continue
      const place = placeOf(object)
      const { place: _place, ...params } = object.params
      const tip = track(place ? { ...object, params } : object, props.events)
      return { focusIndex: 0, fallback, pen: (f) => {
        const p = tip(f)
        return p && place ? [place.left + p[0] * place.scale, place.top + p[1] * place.scale] : p
      } }
    }
  }
  return { focusIndex: 0, fallback }
}

/** The composition owns the clock; every device and chrome layer receives global frames. `stem={false}` leaves the
 *  stem to the wrapper that plays it from the render's frame 0, under the sting (VeCut); with no flag the tree is the
 *  one it always was (houseGolden.test.ts). */
export function FormatMaster({ stem = true, ...props }: EngineRenderProps & { stem?: boolean }) {
  const frame = useEngineFrame()
  const objects = new Map(props.objects.map((object) => [object.obj, object]))
  const width = props.aspect === '9:16' ? 1080 : 1920
  const height = props.aspect === '9:16' ? 1920 : 1080
  const activeBeat = props.beats.find((beat) => frame >= beat.fromFrame && frame < beat.toFrame)
  const split = activeBeat?.layout === 'SPLIT'
  const camera = split ? splitCameraBox(props.aspect) : undefined
  setActiveCanvas(width, height)
  // The motion style he picked (props.motion), or the house motion when there is none: every device reads it.
  const profile = resolveMotion(props.motion)
  setMotionProfile(profile)

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
            {profile?.ground.texture === 'halftone' && <AbsoluteFill style={halftoneTexture(props.tokens)} />}
          </AbsoluteFill>
        </Sequence>
      ))}
      {props.beats.map((beat, beatIndex) => {
        // Beats mount by frame range with no time offset, so media nested inside a device (a recording's own
        // Sequence) runs on the same global clock as everything else (INV-ONE-CLOCK).
        const next = props.beats[beatIndex + 1]
        // A crossfade (or a carry) keeps the outgoing beat mounted, held on its last frame, fading out under the
        // incoming one for the transition's frames. With no style every beat still cuts.
        const overlap = profile && keepsOutgoing(profile, beat, next) ? transitionFrames(profile) : 0
        const outgoing = frame >= beat.toFrame && frame < beat.toFrame + overlap
        if ((frame < beat.fromFrame || frame >= beat.toFrame) && !outgoing) return null
        const now = outgoing ? beat.toFrame - 1 : frame
        const slots = slotsFor(beat.layout, props.aspect, beat.uses.length)
        // A style on twos steps its graphics; the take and captions stay on every frame.
        const at = profile?.onTwos ? onTwos(now, beat.fromFrame) : now
        const layerHeight = beat.layout === 'SPLIT' ? splitCameraBox(props.aspect).top : height
        const view = profile ? cameraView(profile, beat, slots, objects, props, at) : undefined
        const motion = profile ? beatMotion(profile, props.beats, beatIndex, now, view!, width, layerHeight) : undefined
        const fade = (motion?.fade ?? 1) * (outgoing ? 1 - progress(frame - beat.toFrame, overlap, (t) => t) : 1)
        const sweep = profile && (beat.layout === 'STAGE' || beat.layout === 'SPLIT') ? sweepStyle(profile, props.tokens, beat, now) : null
        const ground = beat.layout === 'SPLIT' ? { height: splitCameraBox(props.aspect).top, backgroundColor: profile ? splitGroundColour(profile, props.tokens) : props.tokens.cream, overflow: 'hidden' as const }
          // A STAGE beat with no plate is voice over graphics: the take is hidden under the house ink ground,
          // the ground StageHeader's logo is drawn for.
          // face-with-proof (lightStage) sits on the light wash of its SPLIT stage.
          : beat.layout === 'STAGE' && beat.plate?.source === 'none' ? (lightStage(props)
            ? { background: `radial-gradient(ellipse at 50% 40%, ${props.tokens.cream} 0%, color-mix(in srgb, ${props.tokens.cream} 86%, ${props.tokens.mint}) 100%)` }
            : stageGround(profile, props.tokens)) : {}
        // What the style lays on a graphic ground (kit/overlays.tsx): only a SPLIT stage or a graphics-only STAGE beat
        // has one; over his take full frame nothing is laid.
        const grounded = beat.layout === 'SPLIT' || (beat.layout === 'STAGE' && beat.plate?.source === 'none')
        const overlays = profile?.overlays ?? []
        const sinceBeat = at - beat.fromFrame
        const hero = profile?.type?.hero && grounded ? heroPhrase(beat, objects, props.events, props.captions, at) : undefined
        const heroDraw = hero ? heroLayout(hero, heroArea(props.aspect, layerHeight, beat.uses.some(id => !hero.replaces.includes(id)))) : undefined
        const torn = overlays.includes('torn')
        const layer = (
          <AbsoluteFill key={`devices-${beat.id}`} style={fade < 1 ? { ...ground, opacity: fade } : ground}>
            {/* With no style this slot holds nothing, exactly as before (houseGolden.test.ts). */}
            {profile ? <>
              {sweep && <AbsoluteFill style={sweep} />}
              {grounded && profile.ground.texture === 'paper' && <PaperTexture id={beat.id} width={width} height={layerHeight} tokens={props.tokens} />}
              {grounded && overlays.includes('scanLines') && <AbsoluteFill data-scan-lines style={scanLines(props.tokens)} />}
              {grounded && overlays.includes('sketchFrame') && profile.boil && <SketchFrame id={beat.id} width={width} height={layerHeight}
                tokens={props.tokens} sinceFrames={sinceBeat} boil={profile.boil} />}
              {torn && <TornFilter id={beat.id} tokens={props.tokens} />}
            </> : sweep && <AbsoluteFill style={sweep} />}
            <AbsoluteFill style={motion?.layer}>
            {[heroDraw ? <HeroType key="hero-type" layout={heroDraw} frame={at} tokens={props.tokens} width={width} height={layerHeight} onDark={darkGround(profile)} /> : null,
              ...beat.uses.map((id, index) => {
              const object = objects.get(id)
              if (!object) throw new Error(`ve: no object ${id}`)
              // Type as hero stands in for the text devices whose words it sets.
              if (hero?.replaces.includes(id)) return null
              const Device = Object.hasOwn(DEVICES, object.device) ? DEVICES[object.device] : undefined
              if (!Device) throw new Error(`ve: no device ${object.device}`)
              const { place, ...params } = object.params
              if (Object.hasOwn(object.params, 'place') && beat.layout !== 'SPLIT')
                throw new Error(`ve: place on non-SPLIT object ${id}`)
              const placement = Object.hasOwn(object.params, 'place')
                ? PlaceSchema.parse(place) : undefined
              const deviceObject = placement ? { ...object, params } : object
              let box = placement ? { left: 0, top: 0, width: placement.width, height: placement.height } : slots[index]
              if (!box) throw new Error(`ve: no slot ${index} in ${beat.layout}`)
              if (beat.layout === 'STAGE' && object.device === 'cursor_buddy') {
                let bottom = 0
                for (const peerId of beat.uses) {
                  const peer = objects.get(peerId)
                  if (peer?.device === 'typing_bubble') {
                    const card = stageBubbleBox(peer.params, width, height)
                    bottom = Math.max(bottom, card.top + card.height)
                  } else if (peer?.device === 'headline') {
                    const h = headlineState(peer, props.events, at)
                    const area = h.at ?? { x: 60, y: height === 1920 ? 220 : 180, w: width - 120, h: height === 1920 ? 987 : 720 }
                    const text = headlineLayout(h.lines, area.w, h.swipe?.line, 'h' in area ? area.h : undefined)
                    const top = h.at ? area.y : area.y + ((height === 1920 ? 987 : 720) - text.height - (h.dek ? 134 : 0)) / 2
                    bottom = Math.max(bottom, top + text.height + (h.dek ? 134 : 0))
                  }
                }
                if (bottom) {
                  const top = bottom + 24
                  const room = (height === 1920 ? 1207 : 900) - top
                  // No text-free space means the supporting character cannot be shown safely.
                  if (room < 60) return null
                  box = { left: 60, top, width: width - 120, height: room }
                }
              }
              // Clip in frame coordinates so the device receives the original slot box.
              // STAGE shares the whole canvas; other layouts retain their slot clips.
              const clipPath = `inset(${box.top}px ${width - box.left - box.width}px ${height - box.top - box.height}px ${box.left}px${beat.layout === 'P6' && index === 1 ? ' round 40px' : ''})`
              const cutout = torn && TORN_DEVICES.includes(object.device)
              const device = <Device object={deviceObject} events={props.events} box={box} tokens={tokensFor(object.device, props.tokens, profile)} aspect={props.aspect} frame={at} />
              // paper-cutout: the piece leans a little on its own centre and is nudged by hand each step (on twos);
              // the torn edge and shadow are drawn round it afterwards, so the shadow falls straight down.
              // Logo tiles lean one by one inside the device (tileLean), so the device itself does not.
              const pose = cutout ? cutoutPose(id, object.device, Math.floor(sinceBeat / 2), !(object.device === 'logo_card' && object.params.tiles === true)) : undefined
              return (
                <AbsoluteFill key={id} style={{ ...(placement ? { left: placement.left, top: placement.top, width: placement.width, height: placement.height, transform: `scale(${placement.scale})`, transformOrigin: 'top left' } : beat.layout === 'SPLIT' ? {} : { clipPath }),
                  // Everything outside the proof dims (living-ui), once the camera is on it.
                  ...(motion && index !== (view?.focusIndex ?? 0) && motion.dim < 1 ? { opacity: motion.dim } : {}),
                  // paper-cutout: a card or logo tile is cut out with a torn edge and a hard shadow.
                  ...(cutout ? { filter: `url(#torn-${beat.id})` } : {}) }}>
                  {pose ? <div data-cutout={id} style={{ position: 'absolute', inset: 0,
                    transform: `translate(${pose.dx}px, ${pose.dy}px) rotate(${pose.tiltDeg}deg)`,
                    transformOrigin: `${box.left + box.width / 2}px ${box.top + box.height / 2}px` }}>{device}</div> : device}
                </AbsoluteFill>
              )
            }),
              overlays.includes('brackets') && view?.focus ? <Brackets key="brackets" focus={view.focus} width={width} height={layerHeight} tokens={props.tokens} /> : null,
            ].filter((node, i, all) => profile ? true : i > 0 && i < all.length - 1)}
            </AbsoluteFill>
          </AbsoluteFill>
        )
        // paper-cutout: the stock is torn where it meets his take, under the captions and the mark tile.
        return torn && beat.layout === 'SPLIT' ? <Fragment key={`devices-${beat.id}`}>{layer}
          <AbsoluteFill style={fade < 1 ? { opacity: fade } : undefined}>
            <TornSeam id={beat.id} width={width} seam={layerHeight} tokens={props.tokens} />
          </AbsoluteFill></Fragment> : layer
      })}
      {props.beats.map((beat) => (frame < beat.fromFrame || frame >= beat.toFrame ? null : (
        <AbsoluteFill key={`brand-${beat.id}`}>
          <BrandFrame props={props} beat={beat} frame={frame} />
        </AbsoluteFill>
      )))}
      <EngineAudio audio={props.audio} stem={stem} />
    </AbsoluteFill>
  )
}
