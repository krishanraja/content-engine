import React from 'react'
import { Img, OffthreadVideo, Sequence } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { fitBox, fitScale } from '../../fit'
import type { Box, DeviceProps } from '../types'
import { evidenceState } from './state'
import { ParamsSchema } from './schema'
import type { z } from 'zod'

type Params = z.infer<typeof ParamsSchema>

/** Coordinates expand the full source behind a viewport of exactly the cropped aspect. */
export function evidenceMediaStyle(crop: Params['crop']): React.CSSProperties {
  return crop ? { position: 'absolute', width: `${100 / crop.w}%`, height: `${100 / crop.h}%`,
    left: `${-100 * crop.x / crop.w}%`, top: `${-100 * crop.y / crop.h}%`, maxWidth: 'none' }
    : { width: '100%', height: '100%', objectFit: 'contain' }
}

// Character wrapping also handles unbroken URLs; measured with the house Archivo face.
function lineCount(text: string, width: number, size: number) {
  let lines = 1
  let current = ''
  for (const char of text) {
    if (char === '\n') { lines++; current = ''; continue }
    if (textWidth('archivo700', current + char, size) > width && current) { lines++; current = '' }
    current += char
  }
  // Browser word wrapping may leave a shorter preceding line. Reserve one word per line conservatively.
  const longestWord = Math.max(0, ...text.split(/\s+/).map((word) => textWidth('archivo700', word, size)))
  return Math.max(lines, Math.ceil(textWidth('archivo700', text, size) / Math.max(size, width - Math.min(width / 2, longestWord))))
}

export function evidenceLayout(box: Box, params: Params, text: string, media: boolean, aspect: DeviceProps['aspect']) {
  const tall = aspect === '9:16'
  const padding = tall ? 28 : 24
  const naturalWidth = Math.min(tall ? 768 : 1056, box.width)
  const innerWidth = naturalWidth - 2 * padding - 4
  const footerText = `${params.outlet} · ${params.date}`
  const footerSize = Math.min(tall ? 24 : 22, innerWidth / Math.max(1, [...footerText].length * 0.6))
  const footerHeight = footerSize * 1.3 + 16
  const mediaRatio = params.sourceAspectRatio * (params.crop ? params.crop.w / params.crop.h : 1)
  const mediaHeight = media ? innerWidth / mediaRatio : 0
  const minimum = tall ? 28 : 24
  let fontSize = tall ? 40 : 34
  let natural = { width: naturalWidth, height: 1 }
  let scale = 1
  while (true) {
    const textHeight = text ? lineCount(text, innerWidth, fontSize) * fontSize * 1.2 : 0
    natural = { width: naturalWidth, height: 2 * padding + 4 + footerHeight + mediaHeight + textHeight + (media && text ? 16 : 0) + 18 }
    scale = fitScale(natural, box)
    if (!text || fontSize * scale >= minimum) break
    // Reflow at the actual slot width when uniform fitting would make mark text too small.
    if (fontSize <= minimum) break
    fontSize = Math.max(minimum, fontSize - 2)
  }
  return { natural, rect: fitBox(natural, box), scale, padding, innerWidth, mediaHeight, fontSize, footerSize }
}

/** Media cropping is intentional; text and provenance are laid out before the card is fitted. */
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = evidenceState(object, events, frame)
  if (!state.visible) return null
  const { params } = state
  const l = evidenceLayout(box, params, state.fullText, state.media, aspect)
  const collapse = state.replacement ? 0 : state.collapse
  return <div data-device="evidence_card" style={{ position: 'absolute', left: l.rect.left, top: l.rect.top,
    width: l.natural.width, height: l.natural.height, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
    gap: 18, padding: l.padding, background: tokens.cream, color: tokens.ink,
    border: `2px ${state.struck ? 'dashed' : 'solid'} ${tokens.ink}`,
    boxShadow: `inset -2px -2px 0 ${tokens.inkDeep}`, opacity: state.enter,
    transformOrigin: 'top left', transform: `scale(${l.scale * (0.8 + 0.2 * state.enter)})` }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: 1 - collapse,
      transformOrigin: 'center top', transform: `scaleY(${1 - collapse})` }}>
      {state.media && params.src ? <div data-media="viewport" style={{ position: 'relative', width: l.innerWidth, height: l.mediaHeight, overflow: 'hidden' }}>
        {params.kind === 'recording' && state.playbackFrom !== null
          ? <Sequence key={state.playbackFrom} from={state.playbackFrom} layout="none"><OffthreadVideo muted src={params.src} trimBefore={params.trimBefore} style={evidenceMediaStyle(params.crop)} /></Sequence>
          : <Img src={params.src} style={evidenceMediaStyle(params.crop)} />}
      </div> : null}
      {state.fullText ? <div style={{ fontFamily: HOUSE_FONTS.structure, fontWeight: 700, fontSize: l.fontSize,
        lineHeight: 1.2, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap',
        textDecoration: state.struck && !state.replacement ? 'line-through' : 'none', textDecorationThickness: 3 }}>{state.text}</div> : null}
    </div>
    <div style={{ flexShrink: 0, fontFamily: HOUSE_FONTS.data, fontSize: l.footerSize, lineHeight: 1.3,
      whiteSpace: 'nowrap', borderTop: `1px solid ${tokens.inkSoft}`, paddingTop: 14 }}>{params.outlet} · {params.date}</div>
  </div>
}
