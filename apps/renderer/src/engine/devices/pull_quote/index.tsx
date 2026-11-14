import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth, wrapWords } from '../../../house/metrics'
import { drift } from '../../clock'
import { fitBox, fitScale } from '../../fit'
import { isRegion } from '../../kit/layout'
import { bestNatural, RegionFit } from '../../kit/regionFit'
import type { DeviceProps } from '../types'
import { pullQuoteState } from './state'

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = pullQuoteState(object, events, frame)
  if (!s.visible) return null
  // Reference quote: 64px Archivo, 78px lines. Wide has room for a larger 72px quote.
  // Provenance meets the design lock's 30px mono floor; the 24px gap separates it from evidence.
  const size = aspect === '9:16' ? 64 : 72
  const lineHeight = size * 78 / 64
  const source = `${s.attribution} · ${s.date}`
  const credits = s.producerLabel ? [source, s.producerLabel] : [source]
  const heightAt = (width: number) => wrapWords('archivo600', s.quote, size, width).length * lineHeight
    + 24 + credits.reduce((sum, text) => sum + wrapWords('mono', text, 30, width).length * 39, 0)
  const width = Math.min(box.width, aspect === '9:16' ? 800 : 1200)
  const natural = isRegion(box) ? bestNatural(box, aspect === '9:16' ? [480, 640, 800] : [720, 960, 1200], heightAt)
    : { width, height: heightAt(width) }
  const quoteLines = wrapWords('archivo600', s.quote, size, natural.width)
  let wordIndex = 0
  const content = <div data-device="pull_quote" style={{ position: 'relative', width: natural.width,
    height: natural.height, background: tokens.ink, opacity: s.opacity,
    // Grow inward as the panel pushes, keeping its edges inside the layout region.
    transform: `scale(${(1 + s.push) / (1 + drift(object.toFrame, object.fromFrame, object.toFrame))})`, transformOrigin: 'center' }}>
    <div style={{ fontFamily: HOUSE_FONTS.structure, fontSize: size, fontWeight: 600, lineHeight: `${lineHeight}px` }}>
      {quoteLines.map((line, row) => <div key={row}>{line.map((text, column) => {
        const index = wordIndex++
        const word = s.words[index]!
        return <React.Fragment key={index}>{column > 0 && ' '}<span data-word={index}
          style={{ position: 'relative', display: 'inline-block', color: tokens.inkSoft }}>
          {text}
          <span aria-hidden="true" data-reveal={word.reveal} style={{ position: 'absolute', inset: 0,
            color: tokens.cream, opacity: word.reveal }}>{text}</span>
          <span aria-hidden="true" data-highlight={word.highlight} style={{ position: 'absolute', inset: 0,
            background: tokens.mint, color: tokens.ink, clipPath: `inset(0 ${(1 - word.highlight) * 100}% 0 0)` }}>{text}</span>
        </span></React.Fragment>
      })}</div>)}
    </div>
    <div data-attribution="" style={{ marginTop: 24, fontFamily: HOUSE_FONTS.data, fontSize: 30,
      lineHeight: '39px', color: tokens.cream, clipPath: `inset(0 ${(1 - s.attributionProgress) * 100}% 0 0)` }}>
      {credits.map((credit, i) => <div key={i}>{wrapWords('mono', credit, 30, natural.width).map((line, row) =>
        <div key={row} style={{ width: textWidth('mono', line.join(' '), 30) }}>{line.join(' ')}</div>)}</div>)}
    </div>
  </div>
  if (isRegion(box)) return <RegionFit natural={natural} box={box}>{content}</RegionFit>
  const at = fitBox(natural, box)
  return <div style={{ position: 'absolute', left: at.left, top: at.top, width: natural.width, height: natural.height,
    transformOrigin: '0 0', transform: `scale(${fitScale(natural, box)})` }}>{content}</div>
}
