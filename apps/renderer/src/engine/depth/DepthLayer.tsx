import type { JSX } from 'react'
import { HOUSE_FONTS } from '../../house/geometry'
import { chapterPlace, inWorldLayout, slam, type ChapterArrangement, type Head } from '../kit/depth'
import type { EngineTokens } from '../props'

/** One item of props.depth (compile, velib/compile.py depth_items): an in-world number or a chapter mark. The title on
 *  an anchor cut is TitleMoment's `behind` mode, not an item here. */
export type DepthItem = {
  kind: 'number' | 'chapter'
  text: string
  label?: string | undefined
  arrangement?: ChapterArrangement | undefined
  accent?: 'mint' | 'channel' | undefined
  /** Drawn behind him through the subject matte (compile sets it whenever the take has a matte). */
  behind?: boolean | undefined
  fromFrame: number
  atFrame: number
  toFrame: number
  head: Head
}

/** Whether an item is drawn behind him (between his take and the matted subject) or in front of everything. */
export function behind(item: DepthItem): boolean {
  return item.kind === 'number' || item.arrangement === 'behind' || !!item.behind
}

/** The items live on this frame, behind him or in front of him. */
export function liveItems(items: readonly DepthItem[] | undefined, frame: number, back: boolean): DepthItem[] {
  return (items ?? []).filter(i => frame >= i.atFrame && frame < i.toFrame && behind(i) === back)
}

/** Ink type on his wall, with a hard offset in the accent: the house type and palette, readable on a light wall and on
 *  the ink panel alike (a cream glyph on his pale wall vanished in the r4 prototype). */
function glyphStyle(tokens: EngineTokens, accent: string, size: number) {
  const drop = Math.max(6, Math.round(size * 0.035))
  return { fontFamily: HOUSE_FONTS.display, fontWeight: 400, fontSize: size, lineHeight: 1, color: tokens.ink,
    textShadow: `${drop}px ${drop}px 0 ${accent}`, whiteSpace: 'pre' as const, textTransform: 'uppercase' as const }
}

export function DepthLayer({ items, frame, tokens, width, height, back }: { items: readonly DepthItem[]; frame: number;
  tokens: EngineTokens; width: number; height: number; back: boolean }): JSX.Element | null {
  const live = liveItems(items, frame, back)
  if (!live.length) return null
  return <div data-depth-layer={back ? 'behind' : 'front'} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {live.map((item, index) => {
      const accent = item.accent === 'channel' ? tokens.channel : tokens.mint
      const s = slam(frame, item.atFrame, item.toFrame)
      if (item.kind === 'number') {
        const at = inWorldLayout(item.text, width, height, item.head)
        return <div key={`n-${index}`} data-depth-number={item.text} style={{ position: 'absolute', left: at.centreX - at.width / 2,
          top: at.centreY - at.fontSize * 0.55, width: at.width, textAlign: 'center', opacity: s.opacity,
          transform: `scale(${s.scale.toFixed(4)})`, transformOrigin: '50% 50%', ...glyphStyle(tokens, accent, at.fontSize) }}>{item.text}</div>
      }
      const place = chapterPlace(item.arrangement ?? 'beside_right', width, height, item.head)
      const anchorX = place.align === 'right' ? '-100%' : place.align === 'left' ? '0%' : '-50%'
      // A rotated mark turns about its own centre after it is placed.
      return <div key={`c-${index}`} data-depth-chapter={item.arrangement} style={{ position: 'absolute', left: place.left, top: place.top,
        opacity: s.opacity, transform: `translate(${anchorX}, -50%) rotate(${place.rotate}deg) scale(${s.scale.toFixed(4)})`,
        transformOrigin: '50% 50%', display: 'flex', flexDirection: 'column', alignItems: place.align === 'right' ? 'flex-end' : place.align === 'left' ? 'flex-start' : 'center' }}>
        {item.label ? <span style={{ fontFamily: HOUSE_FONTS.data, fontWeight: 600, fontSize: Math.max(34, place.fontSize * 0.16),
          letterSpacing: '0.12em', color: tokens.ink, background: accent, padding: '4px 14px', textTransform: 'uppercase' }}>{item.label}</span> : null}
        <span style={glyphStyle(tokens, accent, place.fontSize)}>{item.text}</span>
      </div>
    })}
  </div>
}
