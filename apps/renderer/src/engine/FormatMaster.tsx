import { CharacterLayer } from './character'
import { Fragment, type ReactElement } from 'react'
import { z } from 'zod'
import { AbsoluteFill, Img, OffthreadVideo, Sequence } from 'remotion'
import { BrandFrame } from './BrandFrame'
import { onTwos, progress, setMotionProfile, useEngineFrame } from './clock'
import { stageBubbleBox } from './devices/typing_bubble'
import { headlineLayout } from './devices/headline'
import { lightStage } from './chrome/lightStage'
import { headlineState } from './devices/headline/state'
import { DEVICES } from './devices/registry'
import { FOCUS, PEN } from './devices/focus'
import type { Box } from './devices/types'
import { slotsFor, splitCameraBox, splitPlatePosition, windowCameraState } from './layouts'
import { setActiveCanvas } from './kit/lock'
import { resolveMotion, type MotionProfile } from './kit/motionProfiles'
import { beatMotion, focusMotion, groundTexture, halftoneTexture, keepsOutgoing, stageGround, sweepStyle, transitionFrames, type CameraView } from './kit/beatMotion'
import { focusRoom, placed } from './kit/focus'
import { Brackets, PaperTexture, SketchFrame, TORN_DEVICES, TornFilter, TornSeam, cutoutPose, darkGround, scanLines, splitGroundColour, tokensFor } from './kit/overlays'
import { HeroType, heroArea, heroLayout, heroPhrase } from './kit/heroType'
import { FOCUS_SCALE, LEAD_AFTER, TRANSITION_FRAMES, cameraAt, cameraStyle, flashAt, hitFrames, leadMoveAt, leadStyle, leads } from './kit/ingredients'
import { regionSlots } from './kit/layout'
import { boxStyle, isStaging, staged, stagingGeometry, trayRise } from './kit/staging'
import { layoutSlots } from './kit/layout'
import { EngineAudio } from './audio'
import { GradedBackdrop } from './treatments/Grade'
import { band } from './captions/kit'
import { TitleMoment } from './title/TitleMoment'
import type { EngineBeat, EngineObject, EngineRenderProps } from './props'

// Placement belongs to the composition, never to a strict device schema.
const PlaceSchema = z.object({
  left: z.number().finite(), top: z.number().finite(),
  width: z.number().finite().positive(), height: z.number().finite().positive(),
  scale: z.number().finite().positive(),
}).strict()

/** What the camera sees on a beat (kit/focus.ts): for zoomToFocus (or focus on the event, `wantFocus`) the first device
 *  that reports a focus line, mapped through its SPLIT placement, and the room it must stay in; for followPen the first
 *  scribble's pen tip. Read under a motion style, or for focus on the event alone. */
function cameraView(profile: MotionProfile | undefined, beat: EngineBeat, slots: readonly Box[], objects: ReadonlyMap<string, EngineObject>,
  props: EngineRenderProps, at: number, wantFocus = false): CameraView & { focusIndex: number } {
  const placeOf = (object: EngineObject) => {
    const place = Object.hasOwn(object.params, 'place') ? PlaceSchema.safeParse(object.params.place) : undefined
    return place?.success ? place.data : undefined
  }
  const first = beat.uses.length ? objects.get(beat.uses[0]!) : undefined
  const firstPlace = first ? placeOf(first) : undefined
  const fallback = firstPlace ? { left: firstPlace.left, top: firstPlace.top,
    width: firstPlace.width * firstPlace.scale, height: firstPlace.height * firstPlace.scale } : slots[0]
  const focusable = wantFocus && beat.uses.some((id) => { const object = objects.get(id); return !!object && Object.hasOwn(FOCUS, object.device) })
  if (profile?.camera.kind === 'zoomToFocus' || profile?.overlays?.includes('brackets') || focusable) {
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
      return { focusIndex: index, room, fallback, focusable, focus: { ...focus, rect: placed(focus.rect, place),
        ...(focus.from ? { from: placed(focus.from, place) } : {}) } }
    }
  }
  if (profile?.camera.kind === 'followPen') {
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
  return { focusIndex: 0, fallback, ...(focusable ? { focusable } : {}) }
}

/** The composition owns the clock; every device and chrome layer receives global frames. `stem={false}` leaves the
 *  stem to the wrapper that plays it from the render's frame 0, under the sting (VeCut); with no flag the tree is the
 *  one it always was (houseGolden.test.ts). */
/** One real picture under a beat's graphics, fitted by cover (never stretched: F53), with an ink scrim at its foot so
 *  the graphics and captions over it stay readable (Krish, 2026-11-18: "making actual use of the full screen"). */
/** One world (Krish, 2026-11-18: "create visual consistency between the two styles interchanging in a world class art
 *  directed way"): a beat with a drawn device stands on its photograph thrown out of focus and graded down (focus 1), a
 *  beat with none shows the photograph sharp (focus 0), both in one grade (treatments/Grade.tsx), and the focus racks
 *  across RACK_FRAMES after a cut between the two kinds, so the picture never says the same thing twice. */
const RACK_FRAMES = 12
const FIGURE_DEVICES = new Set(['kinetic_stat', 'stat_strip'])
export function backdropFocus(beats: readonly EngineBeat[], beat: EngineBeat, frame: number): number {
  const kind = (b: EngineBeat) => (b.uses.length > 0 ? 1 : 0)
  const index = beats.indexOf(beat), before = index > 0 ? beats[index - 1]! : undefined
  const from = before?.backdrop ? kind(before) : kind(beat), to = kind(beat)
  const t = Math.min(1, Math.max(0, (frame - beat.fromFrame) / RACK_FRAMES)), eased = t * t * (3 - 2 * t)
  return from + (to - from) * eased
}

/** The title frame carries the wordmark (config/brand-palette.json logo_rule: the logo only on the title frame and the
 *  close; Krish, 2026-11-18: "ONLY THE WORDMARK DURING THE TITLE FRAME AND THE CLOSING FRAME"): it fades in under the
 *  finished title and leaves with it. */
function titleWordmark(props: EngineRenderProps, frame: number, stage: { left: number; top: number; width: number; height: number }) {
  const moment = props.titleMoment
  if (!moment) return null
  const landed = Math.max(...moment.words.map((w) => w.atFrame)) + 6
  const fadeIn = Math.min(1, Math.max(0, (frame - landed) / 8)), fadeOut = Math.min(1, Math.max(0, (moment.toFrame - frame) / 10))
  const opacity = Math.min(fadeIn, fadeOut)
  if (opacity <= 0) return null
  const logo = props.brand.logo
  // Tall: centred under the title. Wide: on the panel's right, clear of the caption that returns on its left.
  const wide = props.aspect === '16:9'
  const w = Math.min(stage.width * (wide ? 0.5 : 0.56), 640), h = w * logo.pixelHeight / logo.pixelWidth
  const left = wide ? stage.left + stage.width * 0.95 - w : stage.left + (stage.width - w) / 2
  return <Img data-title-wordmark src={logo.src} style={{ position: 'absolute', left,
    top: stage.top + stage.height - h - stage.height * 0.07, width: w, height: h, opacity }} />
}

/** A slow push holds every picture (the motion style's own rule: "a slow push holds every panel; nothing holds still"):
 *  the backdrop eases from 100% to 106% across its beat, so a photo beat is never a still frame (qc motion.longest_still). */
export function backdropPush(beat: EngineBeat, frame: number): number {
  const t = Math.min(1, Math.max(0, (frame - beat.fromFrame) / Math.max(1, beat.toFrame - beat.fromFrame)))
  return 1 + 0.06 * t
}

function Backdrop({ src, tokens, focus, frame, width, height, push = 1 }: { src: string; tokens: EngineRenderProps['tokens']; focus: number; frame: number; width: number; height: number; push?: number }) {
  return <AbsoluteFill data-backdrop data-backdrop-focus={focus.toFixed(3)}>
    <AbsoluteFill style={{ transform: `scale(${push.toFixed(5)})`, transformOrigin: '50% 45%' }}>
      <GradedBackdrop src={src} focus={focus} tokens={tokens as unknown as Record<string, string>} frame={frame} width={width} height={height} />
    </AbsoluteFill>
    <AbsoluteFill style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${tokens.ink} 38%, transparent) 0%, transparent 42%, color-mix(in srgb, ${tokens.ink} 72%, transparent) 100%)` }} />
  </AbsoluteFill>
}

export function FormatMaster({ stem = true, ...props }: EngineRenderProps & { stem?: boolean }) {
  const frame = useEngineFrame()
  const objects = new Map(props.objects.map((object) => [object.obj, object]))
  const width = props.aspect === '9:16' ? 1080 : 1920
  const height = props.aspect === '9:16' ? 1920 : 1080
  const activeBeat = props.beats.find((beat) => frame >= beat.fromFrame && frame < beat.toFrame)
  const split = activeBeat?.layout === 'SPLIT'
  const camera = split ? splitCameraBox(props.aspect) : undefined
  const hasWindow = props.beats.some(beat => beat.layout === 'WINDOW')
  const faceState = hasWindow ? windowCameraState(props.beats, props.aspect, frame) : undefined
  setActiveCanvas(width, height)
  // The motion style he picked (props.motion), or the house motion when there is none: every device reads it.
  const ingredients = props.ingredients
  // A crossfade handover (style.transitions crossfade) dissolves beat into beat on the style's own clock, its length
  // set by the energy and kept within the 6 to 10 frames a crossfade may take.
  const chosen = resolveMotion(props.motion)
  // A leading handover (style.transitions.lead, kit/ingredients.ts) is the handover: the style's own crossfade or
  // curve entrance would fade or move the incoming beat a second time, so under a lead the style's beats cut.
  const leading = leads(ingredients)
  const profile = chosen && ingredients?.transition === 'crossfade'
    ? { ...chosen, transition: 'crossfade' as const, transitionFrames: Math.min(10, Math.max(6, TRANSITION_FRAMES[ingredients.energy])) }
    : chosen && leading ? { ...chosen, transition: 'cut' as const } : chosen
  setMotionProfile(profile)
  // Focus on the event (style.camera.focus): the graphics layer pushes onto the line a device reports, for a style that
  // does not already zoom to it. Never a zoom of the camera, so his take is never cropped by it.
  const focusOn = !!ingredients?.focus && profile?.camera.kind !== 'zoomToFocus'
  // A staging (kit/staging.ts) places his take and a graphics panel on every beat that shows him; a piece with a
  // WINDOW beat keeps the window's own moves.
  const staging = !hasWindow && isStaging(props.layout?.mode)
    ? stagingGeometry(props.layout!.mode as 'band', props.aspect, props.captionPlacement, !!props.captionTheme) : undefined
  const stagedNow = staging && activeBeat && staged(activeBeat) ? staging : undefined
  const stagedTake = stagedNow ? { ...boxStyle(stagedNow.take), borderRadius: stagedNow.take.radius,
    ...(stagedNow.take.border ? { border: `6px solid ${props.tokens.cream}`, boxSizing: 'border-box' as const, boxShadow: `14px 14px 0 ${props.tokens.inkDeep}` } : {}) } : undefined

  const take = props.segments.map((segment, index) => (
        <Sequence key={`segment-${index}`} from={segment.fromFrame} durationInFrames={segment.durationFrames}>
          <AbsoluteFill style={{ overflow: 'hidden', ...(faceState?.box ?? camera ?? stagedTake ?? {}), ...(faceState ? { borderRadius: 210 * faceState.windowed, border: `${6 * faceState.windowed}px solid ${props.tokens.cream}`, boxSizing: 'border-box' as const, boxShadow: `${10 * faceState.windowed}px ${10 * faceState.windowed}px 0 ${props.tokens.inkDeep}`, transform: `scale(${faceState.scale})`, transformOrigin: 'center center' } : {}) }}>
            <OffthreadVideo
              src={segment.src}
              trimBefore={segment.trimBeforeFrames}
              muted
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                ...(split ? { objectPosition: splitPlatePosition(activeBeat?.plate?.crop) } : segment.crop && (!faceState || faceState.windowed === 0) ? {
                  transformOrigin: 'center center',
                  transform: `translate(${segment.crop.x}px, ${segment.crop.y}px) scale(${segment.crop.scale})`,
                } : {}),
              }}
            />
            {profile?.ground.texture === 'halftone' && <AbsoluteFill style={halftoneTexture(props.tokens)} />}
          </AbsoluteFill>
        </Sequence>
      ))

  const beatLayers = props.beats.map((beat, beatIndex) => {
        // Beats mount by frame range with no time offset, so media nested inside a device (a recording's own
        // Sequence) runs on the same global clock as everything else (INV-ONE-CLOCK).
        const next = props.beats[beatIndex + 1]
        const prev = beatIndex > 0 ? props.beats[beatIndex - 1] : undefined
        // A crossfade (or a carry) keeps the outgoing beat mounted, held on its last frame, fading out under the
        // incoming one for the transition's frames. With no style every beat still cuts. A leading handover keeps it
        // LEAD_AFTER frames more, its clock still running so its exit carries on while the next beat arrives over it.
        // A full-screen picture and a beat that shows his face never dissolve into each other: half of each is his face
        // as a ghost through the picture (Krish, 2026-11-18, yes to cutting them clean). They cut; same kinds still dissolve.
        // A stage beat over a graded backdrop shows no face either, take underneath or not (19 Nov: the take under
        // the block beat dissolved his face through it).
        const fullScreen = (b: EngineBeat) => b.layout === 'STAGE' && (b.plate?.source === 'none' || !!b.backdrop)
        const kindChange = !!next && !!props.layout && fullScreen(beat) !== fullScreen(next)
        // A leading handover never crosses that line either: kept on for LEAD_AFTER frames, his face showed through the
        // block as it arrived (Tue 17, 19 Nov 2026, the power beat's proof).
        const leadOut = leading && !kindChange && beat.transitionOut !== 'carry' && keepsOutgoing(profile, beat, next, true)
        const overlap = leadOut ? LEAD_AFTER : profile && !kindChange && keepsOutgoing(profile, beat, next) ? transitionFrames(profile) : 0
        const outgoing = frame >= beat.toFrame && frame < beat.toFrame + overlap
        if ((frame < beat.fromFrame || frame >= beat.toFrame) && !outgoing) return null
        const now = outgoing && !leadOut ? beat.toFrame - 1 : frame
        // The layout ingredient (kit/layout.ts): a graphics-only beat's devices fill the region the captions leave.
        const graphicsOnly = beat.layout === 'STAGE' && beat.plate?.source === 'none'
        const stagedBeat = staging && staged(beat) ? staging : undefined
        const slots = (stagedBeat ? regionSlots(stagedBeat.region, beat.uses.length) : undefined)
          ?? (graphicsOnly ? layoutSlots(props.layout, props.aspect, props.captionPlacement, !!props.captionTheme, beat.uses.length) : undefined)
          ?? slotsFor(beat.layout, props.aspect, beat.uses.length)
        if (beat.layout === 'WINDOW' && slots.length)
          slots[0] = { left: 0, top: 0, width, height }
        // A style on twos steps its graphics; the take and captions stay on every frame.
        const at = profile?.onTwos ? onTwos(now, beat.fromFrame) : now
        // What a leaving beat shows never runs past its own end: its objects hold their last frame (one that lives on
        // into the next beat keeps running), so nothing on it blinks out while it is still on screen.
        const shown = outgoing ? Math.min(at, beat.toFrame - 1) : at
        const layerHeight = beat.layout === 'SPLIT' ? splitCameraBox(props.aspect).top : height
        const view = profile || focusOn ? cameraView(profile, beat, slots, objects, props, shown, focusOn) : undefined
        const motion = profile ? beatMotion(profile, props.beats, beatIndex, now, view!, width, layerHeight, stagedBeat?.region, focusOn ? FOCUS_SCALE : undefined)
          : view?.focusable ? focusMotion(view, now, beat, FOCUS_SCALE, width, layerHeight) : undefined
        // Between two full-screen pictures the outgoing one stays solid under the incoming one's fade, so nothing under
        // both (his take) shows through the dissolve.
        const underFullScreen = outgoing && !!next && fullScreen(beat) && fullScreen(next)
        const fade = (motion?.fade ?? 1) * (outgoing && !leadOut && !underFullScreen ? 1 - progress(frame - beat.toFrame, overlap, (t) => t) : 1)
        // The beat's own move in a leading handover: arriving over the one before, and leaving, dimming to dark.
        const lead = leading ? leadMoveAt(ingredients!, beat, !!prev && prev.transitionOut !== 'carry', leadOut, frame, width, height) : undefined
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
        const hero = profile?.type?.hero && grounded ? heroPhrase(beat, objects, props.events, props.captions, shown) : undefined
        const heroDraw = hero ? heroLayout(hero, heroArea(props.aspect, layerHeight, beat.uses.some(id => !hero.replaces.includes(id)))) : undefined
        const torn = overlays.includes('torn')
        const styleGround = (profile ? <>
              {sweep && <AbsoluteFill style={sweep} />}
              {grounded && groundTexture(profile.ground.texture, props.tokens, frame) && <AbsoluteFill data-ground-texture style={groundTexture(profile.ground.texture, props.tokens, frame)!} />}
              {grounded && profile.ground.texture === 'paper' && <PaperTexture id={beat.id} width={width} height={layerHeight} tokens={props.tokens} />}
              {grounded && overlays.includes('scanLines') && <AbsoluteFill data-scan-lines style={scanLines(props.tokens)} />}
              {grounded && overlays.includes('sketchFrame') && profile.boil && <SketchFrame id={beat.id} width={width} height={layerHeight}
                tokens={props.tokens} sinceFrames={sinceBeat} boil={profile.boil} />}
              {torn && <TornFilter id={beat.id} tokens={props.tokens} />}
            </> : sweep && <AbsoluteFill style={sweep} />)
        const backdropEl = graphicsOnly && beat.backdrop ? <Backdrop src={beat.backdrop.src} tokens={props.tokens} focus={backdropFocus(props.beats, beat, at)} frame={at} width={width} height={layerHeight} push={backdropPush(beat, at)} /> : undefined
        const layer = (
          <AbsoluteFill key={`devices-${beat.id}`} style={fade < 1 ? { ...ground, opacity: fade } : ground}>
            {/* With no style this slot holds nothing, exactly as before (houseGolden.test.ts); a backdrop joins it only
                when the beat has one, so every cut without one draws the same tree. */}
            {backdropEl ? <>{styleGround}{backdropEl}</> : styleGround}
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
              // A full scene plate on a graphics-only beat is the frame itself (18 Nov 2026: clipped to its slot it drew a
              // small square on bare ink and cut the crocodile out of the Wed 18 hook).
              if (object.device === 'scene_plate' && beat.layout === 'STAGE' && object.params.full !== false)
                box = { left: 0, top: 0, width, height }
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
              // On a photo backdrop there is no light tray under the device, so it keeps the house colours: the style's
              // dark-ground inversion drew Tue 17's ban share and recall figure in ink on a dark photo.
              const device = <Device object={deviceObject} events={props.events} box={box} tokens={beat.backdrop ? props.tokens : tokensFor(object.device, props.tokens, profile)} aspect={props.aspect}
                frame={leadOut && outgoing ? Math.min(at, Math.max(object.toFrame, beat.toFrame) - 1) : at} />
              // paper-cutout: the piece leans a little on its own centre and is nudged by hand each step (on twos);
              // the torn edge and shadow are drawn round it afterwards, so the shadow falls straight down.
              // Logo tiles lean one by one inside the device (tileLean), so the device itself does not.
              const pose = cutout ? cutoutPose(id, object.device, Math.floor(sinceBeat / 2), !(object.device === 'logo_card' && object.params.tiles === true)) : undefined
              return (
                <AbsoluteFill key={id} style={{ ...(placement ? { left: placement.left, top: placement.top, width: placement.width, height: placement.height, transform: `scale(${placement.scale})`, transformOrigin: 'top left' } : beat.layout === 'SPLIT' ? {} : { clipPath }),
                  // Everything outside the proof dims (living-ui), once the camera is on it.
                  // A figure is never dimmed: a number on screen is read, not set dressing (Tue 17, 18 Nov 2026: the
                  // ban share and the 41 votes went dark behind the block).
                  ...(motion && index !== (view?.focusIndex ?? 0) && motion.dim < 1 && !FIGURE_DEVICES.has(object.device) ? { opacity: motion.dim } : {}),
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
        // A leading handover moves the whole beat, its tray and torn seam included, and dims it as it leaves.
        const moved = (drawn: ReactElement) => lead
          ? <AbsoluteFill key={`lead-${beat.id}`} data-lead={beat.id} style={leadStyle(lead)}>{drawn}</AbsoluteFill> : drawn
        // tray: the graphics sit in a cream tray that rises from bottom left over his chest, with a hard ink drop.
        if (stagedBeat?.rises) {
          const rise = trayRise(frame, beat.fromFrame)
          return moved(<Fragment key={`devices-${beat.id}`}>
            <div data-staging-tray style={{ ...boxStyle(stagedBeat.panel), borderRadius: stagedBeat.panel.radius, backgroundColor: props.tokens.cream,
              boxShadow: `16px 16px 0 ${props.tokens.inkDeep}`, opacity: rise.opacity * fade,
              transform: `translateY(${rise.ty}px) scale(${rise.scale})`, transformOrigin: 'bottom left' }} />
            <AbsoluteFill style={{ opacity: rise.opacity, transform: `translateY(${rise.ty}px) scale(${rise.scale})`,
              transformOrigin: `${stagedBeat.panel.left}px ${stagedBeat.panel.top + stagedBeat.panel.height}px` }}>{layer}</AbsoluteFill>
          </Fragment>)
        }
        // paper-cutout: the stock is torn where it meets his take, under the captions and the mark tile.
        return moved(torn && beat.layout === 'SPLIT' ? <Fragment key={`devices-${beat.id}`}>{layer}
          <AbsoluteFill style={fade < 1 ? { opacity: fade } : undefined}>
            <TornSeam id={beat.id} width={width} seam={layerHeight} tokens={props.tokens} />
          </AbsoluteFill></Fragment> : layer)
      }).concat(hasWindow ? take : [])
  const brandLayers = props.beats.map((beat) => (frame < beat.fromFrame || frame >= beat.toFrame ? null : (
        <AbsoluteFill key={`brand-${beat.id}`}>
          <BrandFrame props={props} beat={beat} frame={frame} />
        </AbsoluteFill>
      )))
  // The episode title moment (props.titleMoment): the line he says becomes the title over the captions, which leave its
  // words out. It lands in the panel above his face on a staged beat, else across the frame.
  const titleLayer = props.titleMoment && frame >= props.titleMoment.fromFrame && frame < props.titleMoment.toFrame ? (
    <AbsoluteFill key="title-moment" data-title-moment>
      <TitleMoment {...(props.titleMoment.card ? { card: true } : {})} words={props.titleMoment.words} fromFrame={props.titleMoment.fromFrame} toFrame={props.titleMoment.toFrame} {...(props.titleMoment.release ? { release: props.titleMoment.release } : {})}
        frame={frame} aspect={props.aspect} width={width} height={height}
        stage={stagedNow ? stagedNow.panel : props.titleMoment.card ? titleSafe(props.aspect, width, height) : { left: 0, top: 0, width, height }}
        captionBox={band(props)} tokens={props.tokens as unknown as Record<string, string>} />
      {titleWordmark(props, frame, stagedNow ? stagedNow.panel : { left: 0, top: 0, width, height })}
    </AbsoluteFill>) : null
  // The staging's ground: stage's cream band, the ink panel and band's series-colour hairline, all under his take.
  const stagingGround = stagedNow && !stagedNow.rises ? (
    <AbsoluteFill key="staging-ground" data-staging={props.layout!.mode} style={{ backgroundColor: stagedNow.under === 'cream' ? props.tokens.cream : props.tokens.ink }}>
      <div style={{ ...boxStyle(stagedNow.panel), borderRadius: stagedNow.panel.radius, background: `radial-gradient(ellipse at 30% 30%, ${props.tokens.inkSoft} 0%, ${props.tokens.ink} 70%)` }} />
      {groundTexture(profile?.ground.texture, props.tokens, frame) ? <div data-ground-texture style={{ ...boxStyle(stagedNow.panel), borderRadius: stagedNow.panel.radius, ...groundTexture(profile?.ground.texture, props.tokens, frame)! }} /> : null}
      {stagedNow.hairline ? <div style={{ ...boxStyle(stagedNow.hairline), backgroundColor: props.tokens.channel }} /> : null}
    </AbsoluteFill>) : undefined
  // A backdrop fills the panel above his face, over the ink panel and under the take and the graphics; with none the
  // staging ground is exactly as before.
  const panelBackdrop = stagingGround && activeBeat?.backdrop ? (
    <AbsoluteFill key="staging-backdrop" data-backdrop-panel>
      <div style={{ ...boxStyle(stagedNow!.panel), borderRadius: stagedNow!.panel.radius, overflow: 'hidden' }}>
        <Backdrop src={activeBeat.backdrop.src} tokens={props.tokens} focus={backdropFocus(props.beats, activeBeat, frame)} frame={frame} width={stagedNow!.panel.width} height={stagedNow!.panel.height} push={backdropPush(activeBeat, frame)} /></div>
    </AbsoluteFill>) : undefined
  const picture = stagingGround ? [stagingGround, ...(panelBackdrop ? [panelBackdrop] : []), ...(!hasWindow ? take : [])] : (!hasWindow ? take : false)
  // A graphics-only STAGE beat with no staging draws its backdrop across the whole frame, under its graphics, so a proof sits
  // on its own page and the frame is never bare ink (Krish, 2026-11-18: "making actual use of the full screen when it isn't
  // my face"; Wed 18's full-frame proof beats filled 11 to 32% of the frame). With no backdrop the tree is unchanged.
  const fullBackdrop = !stagedNow && !isStaging(props.layout?.mode) && activeBeat?.backdrop && activeBeat.layout === 'STAGE' && activeBeat.plate?.source === 'none' ? (
    <AbsoluteFill key="full-backdrop" data-backdrop-full>
      <Backdrop src={activeBeat.backdrop.src} tokens={props.tokens} focus={backdropFocus(props.beats, activeBeat, frame)} frame={frame} width={width} height={height} />
    </AbsoluteFill>) : null
  // With no ingredients the tree is exactly what it was before them (houseGolden.test.ts flattens it).
  if (!ingredients) return (
    <AbsoluteFill style={{ backgroundColor: props.tokens.ink, overflow: 'hidden' }}>
      {stagingGround ? picture : !hasWindow && take}
      {fullBackdrop ? [fullBackdrop, ...beatLayers] : beatLayers}
      {[...(props.character ? [<CharacterLayer key="character" track={props.character} frame={frame} />] : []), ...brandLayers, ...(titleLayer ? [titleLayer] : [])]}
      <EngineAudio audio={props.audio} stem={stem} />
    </AbsoluteFill>
  )
  // The camera and the handover (kit/ingredients.ts) move the whole picture, his take and the graphics together; the
  // captions and the frame stay still over it, and a flash of cream lands over the picture under the captions. A
  // leading handover moves the two beats instead (above), so the camera makes no handover move of its own.
  const hits = ingredients.hits ? hitFrames(props.events) : []
  const flash = flashAt(ingredients, props.beats, hits, frame)
  return (
    <AbsoluteFill style={{ backgroundColor: props.tokens.ink, overflow: 'hidden' }}>
      <AbsoluteFill data-ingredient-camera style={cameraStyle(cameraAt(ingredients, props.beats, hits, frame, width, height), width, height)}>
        {stagingGround ? picture : !hasWindow && take}
        {fullBackdrop ? [fullBackdrop, ...beatLayers] : beatLayers}
      </AbsoluteFill>
      {flash > 0 ? <AbsoluteFill data-flash style={{ backgroundColor: props.tokens.cream, opacity: flash }} /> : null}
      {[...(props.character ? [<CharacterLayer key="character" track={props.character} frame={frame} />] : []), ...brandLayers, ...(titleLayer ? [titleLayer] : [])]}
      <EngineAudio audio={props.audio} stem={stem} />
    </AbsoluteFill>
  )
}

/** Where the title card lands on an unstaged beat: the top of the safe column, under every channel's top bar and over
 *  his hair, so his eyes and mouth stay clear (Krish, 18 Nov 2026: "having naked captions over my face looks stupid";
 *  in the lower band the card covered his mouth). */
export function titleSafe(aspect: string, width: number, height: number) {
  return aspect === '9:16' ? { left: 60, top: 220, width: 800, height: 330 }
    : { left: Math.round(width * 0.1), top: Math.round(height * 0.06), width: Math.round(width * 0.8), height: Math.round(height * 0.3) }
}
