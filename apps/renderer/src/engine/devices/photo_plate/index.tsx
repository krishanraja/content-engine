import { Img, OffthreadVideo, Sequence } from 'remotion'
import brand from '../../../../../../config/ve/brand-tokens.json'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { scribblePath } from '../../kit/scribblePath'
import { LOOP, photoPlateCrop, photoPlateState } from './state'

/** The source line under a framed recording: Plex Mono at the 40 px words floor (config/ve/shot-grammar.json). */
export const FRAMED_SOURCE = { px: 40, gap: 18 } as const

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = photoPlateState(object, events, frame)
  if (!state.visible) return null

  const { params, region, reveal, playbackFrom } = state
  if (params.frame) {
    // A recording in a device frame (the platform walkthrough, PD-2): the panel's full width less its margins, at the
    // recording's own shape, the source line in mono under it (never a chip on the picture), the group centred in the box
    // so no dead area sits above it. The picture, its push, moves and loops are the plate's own, drawn in the card.
    const picture = 'video' in params ? params.video : params.image
    const margin = aspect === '9:16' ? 60 : 96
    const cardW = box.width - 2 * margin
    const cardH = Math.min(cardW * picture.pixelHeight / picture.pixelWidth, box.height * 0.8)
    const sourceH = params.source ? FRAMED_SOURCE.gap + 2 * FRAMED_SOURCE.px * 1.2 : 0
    // Centred, but never lower than 22% down the box, so a tall panel keeps the picture high, as PD-2 has it.
    const card = { left: box.left + margin, top: box.top + Math.max(0, Math.min((box.height - cardH - sourceH) / 2, box.height * 0.22)), width: cardW, height: cardH }
    const inner = { ...object, params: { ...object.params, frame: false, source: undefined } }
    return <>
      <div data-device="photo_plate" data-framed="" style={{ position: 'absolute', ...card, overflow: 'hidden', borderRadius: 22 }}>
        <Device object={inner} events={events} box={{ left: 0, top: 0, width: cardW, height: cardH }} tokens={tokens} aspect={aspect} frame={frame} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 22, boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${tokens.cream} 16%, transparent)` }} />
      </div>
      {params.source && <div data-provenance="" style={{ position: 'absolute', left: card.left, top: card.top + cardH + FRAMED_SOURCE.gap, width: cardW,
        color: tokens.cream, fontFamily: HOUSE_FONTS.data, fontSize: FRAMED_SOURCE.px, lineHeight: 1.2, letterSpacing: '0.06em',
        textTransform: 'uppercase', opacity: 0.75 * reveal }}>{params.source}</div>}
    </>
  }
  // ve compile resolves nested src fields and ve-render stages them, just as it does for evidence_card.
  const crop = photoPlateCrop(box, state)
  const mediaStyle = { position: 'absolute' as const, ...crop, objectFit: 'contain' as const }
  const { width, height } = box

  const tall = aspect === '9:16'
  const [safeLeft, safeTop, safeRight, safeBottom] = tall
    ? [brand.geometry.tall_safe_key_text.below_840_x[0]!, brand.geometry.tall_safe_key_text.y[0]!,
      brand.geometry.tall_safe_key_text.below_840_x[1]!, brand.geometry.caption_block_bottom_max_y]
    : brand.geometry.wide_title_safe as [number, number, number, number]
  const chipHeight = 46
  const chipLeft = Math.max(0, safeLeft - box.left)
  const chipWidth = Math.min(width, safeRight - box.left) - chipLeft
  const chipBottom = Math.min(height, safeBottom - box.top)
  const chipFits = chipWidth > 24 && chipBottom - chipHeight >= Math.max(0, safeTop - box.top)

  return <div data-device="photo_plate" style={{
    position: 'absolute', ...box, overflow: 'hidden',
    clipPath: reveal < 1 ? `inset(${(1 - reveal) * 100}% 0 0 0)` : undefined,
  }}>
    {'video' in params
      ? <Sequence from={playbackFrom} layout="none">
        <OffthreadVideo src={params.video.src} trimBefore={params.video.trimBeforeFrames} muted style={mediaStyle} />
      </Sequence>
      : <Img src={params.image.src} alt={object.meaning} style={mediaStyle} />}
    {params.scrim > 0 && <div data-scrim="" style={{
      position: 'absolute', inset: 0, backgroundColor: tokens.ink, opacity: params.scrim,
    }} />}
    {state.loops.length > 0 && <svg aria-hidden="true" width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      {state.loops.map(loop => {
        const cx = crop.left + (loop.region.x + loop.region.w / 2) * crop.width
        const cy = crop.top + (loop.region.y + loop.region.h / 2) * crop.height
        const d = scribblePath({ shape: 'loop', cx, cy, u: [loop.region.w * crop.width * 0.62, 0], v: [0, loop.region.h * crop.height * 0.66],
          turns: 1.08 }, `${object.obj}:${loop.name}`)
        const colour = tokens[params.markColour]
        return <g key={loop.name} data-loop={loop.name}>
          {loop.drawn > 0 && <path d={d} fill="none" stroke={colour} strokeWidth={LOOP.stroke} strokeLinecap="round" strokeLinejoin="round"
            pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - loop.drawn} />}
          {loop.echo > 0 && <path d={d} fill="none" stroke={colour} strokeWidth={LOOP.echo} strokeLinecap="round" strokeLinejoin="round"
            pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - loop.echo}
            transform={`rotate(${LOOP.echoTurnDegrees} ${cx} ${cy})`} />}
        </g>
      })}
    </svg>}
    {params.markStyle === 'ring' && region && state.drawn > 0 && <svg aria-hidden="true" width={width} height={height}
      style={{ position: 'absolute', inset: 0 }}>
      <rect data-mark="" x={crop.left + region.x * crop.width} y={crop.top + region.y * crop.height}
        width={region.w * crop.width} height={region.h * crop.height} rx={8}
        fill="none" stroke={tokens.mint} strokeWidth={5} strokeLinecap="round"
        pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - state.drawn} />
    </svg>}
    {params.source && chipFits && <div data-provenance="" style={{
      position: 'absolute', left: chipLeft, bottom: height - chipBottom, maxWidth: chipWidth,
      boxSizing: 'border-box', padding: '6px 12px', backgroundColor: tokens.ink, color: tokens.cream,
      fontFamily: HOUSE_FONTS.data, fontSize: 28, lineHeight: '34px', whiteSpace: 'nowrap',
      overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{params.source}</div>}
  </div>
}
