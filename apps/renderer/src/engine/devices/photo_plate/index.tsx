import { Img, OffthreadVideo, Sequence } from 'remotion'
import brand from '../../../../../../config/ve/brand-tokens.json'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { photoPlateCrop, photoPlateState } from './state'

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = photoPlateState(object, events, frame)
  if (!state.visible) return null

  const { params, region, reveal, playbackFrom } = state
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
    {region && state.drawn > 0 && <svg aria-hidden="true" width={width} height={height}
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
