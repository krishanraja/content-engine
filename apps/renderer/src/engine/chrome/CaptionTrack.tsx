import { Grain, Swipe, SwipedText } from '../../house/components'
import { HOUSE, HOUSE_FONTS } from '../../house/geometry'
import { textWidth } from '../../house/metrics'
import { boxFor, WIDE, type Aspect } from '../geometry'
import type { EngineRenderProps } from '../props'
import { houseTokens } from './tokens'

export type CaptionPage = EngineRenderProps['captions'][number]

/** Half-open intervals: an adjacent page takes over on its first frame.
 * Overlapping input still renders only one page, in authored order. */
export function captionPageAt(pages: readonly CaptionPage[], frame: number): CaptionPage | null {
  return pages.find((page) => page.fromFrame <= frame && frame < page.toFrame) ?? null
}

/** Lay out the whole page once, preserving word indexes and space as words appear.
 * Oversized pages must be repaginated upstream, never silently clipped or shrunk. */
export function captionLines(page: CaptionPage, aspect: Aspect): number[][] {
  const c = aspect === '16:9' ? WIDE.caption : HOUSE.caption
  const available = boxFor('caption', aspect).width - c.paddingX * 2
  const space = textWidth('archivoHeavy', ' ', c.size, c.letterSpacingEm)
  const lines: number[][] = []
  let line: number[] = []
  let width = 0
  page.words.forEach((word, index) => {
    const wordWidth = textWidth('archivoHeavy', word.text, c.size, c.letterSpacingEm)
      + (index === page.swipeIndex ? HOUSE.swipe.paddingEm * 2 * c.size : 0)
    if (wordWidth > available) throw new Error('Caption word exceeds the house caption width; repaginate the caption')
    const next = width + (line.length ? space : 0) + wordWidth
    if (line.length && next > available) {
      lines.push(line)
      line = []
      width = 0
    }
    width += (line.length ? space : 0) + wordWidth
    line.push(index)
  })
  if (line.length) lines.push(line)
  if (lines.length > 2) throw new Error('Caption page exceeds two house lines; repaginate the caption')
  return lines
}

export function CaptionTrack({ props, frame }: { props: EngineRenderProps; frame: number }) {
  if ((props.ending && frame >= props.ending.fromFrame)
    || props.beats.some((beat) => beat.role === 'call' && frame >= beat.fromFrame && frame < beat.toFrame)) return null
  const page = captionPageAt(props.captions, frame)
  if (!page) return null
  const lines = captionLines(page, props.aspect)
  if (!page.words.some((word) => word.atFrame <= frame)) return null
  const c = props.aspect === '16:9' ? WIDE.caption : HOUSE.caption
  const box = boxFor('caption', props.aspect)
  const height = c.paddingTop + c.paddingBottom + lines.length * c.size * c.lineHeight
  const tokens = houseTokens(props.tokens)
  return <div style={{
    position: 'absolute', left: box.left, top: props.aspect === '16:9' ? WIDE.caption.bottom - height : box.top,
    width: box.width, height, boxSizing: 'border-box', background: props.tokens.ink,
    padding: `${c.paddingTop}px ${c.paddingX}px ${c.paddingBottom}px`,
    boxShadow: `12px 12px 0 ${props.tokens.channel}`, pointerEvents: 'none',
  }}>
    <div style={{
      fontFamily: HOUSE_FONTS.structure, fontWeight: 900, fontSize: c.size,
      fontStretch: '112%', fontVariationSettings: '"wght" 900, "wdth" 112',
      lineHeight: c.lineHeight, letterSpacing: `${c.letterSpacingEm}em`, color: props.tokens.cream,
    }}>
      {lines.map((line, lineIndex) => <div key={lineIndex} style={{ height: c.size * c.lineHeight, whiteSpace: 'nowrap' }}>
        {line.map((index, position) => {
          const word = page.words[index]!
          return <span key={index} style={{ visibility: word.atFrame <= frame ? 'visible' : 'hidden' }}>
            {position > 0 ? ' ' : null}
            {index === page.swipeIndex
              ? <Swipe tokens={tokens}>{word.text}</Swipe>
              : <SwipedText text={word.text} swipeIndex={-1} tokens={tokens} />}
          </span>
        })}
      </div>)}
    </div>
    <Grain />
  </div>
}
