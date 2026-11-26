import React from 'react'
import brand from '../../../../../config/ve/brand-tokens.json'
import { HOUSE_FONTS } from '../../house/geometry'
import { band } from '../captions/kit'
import { root, type Draw } from '../captions/draw'
import type { EngineRenderProps } from '../props'

type Pages = EngineRenderProps['captions']
const cache = new WeakMap<Pages, Pages>()
export function captionPages(input: Pages): Pages {
  const saved = cache.get(input)
  if (saved) return saved
  if (input.every((p) => p.words.length >= 2 && p.words.length <= 5)) return input
  const words = input.flatMap((page) => page.words.map((word) => ({ ...word, end: page.toFrame })))
  const result: Pages = []
  for (let i = 0; i < words.length;) {
    const remaining = words.length - i
    const count = remaining === 6 ? 3 : Math.min(5, remaining)
    const group = words.slice(i, i + count)
    const next = words[i + count]
    result.push({
      ...input[0]!,
      fromFrame: group[0]!.atFrame,
      toFrame: Math.min(group.at(-1)!.end, next?.atFrame ?? Infinity),
      words: group,
    })
    i += count
  }
  cache.set(input, result)
  return result
}
export function ladderCaptionBand(format: EngineRenderProps['aspect']) {
  return format === '9:16'
    ? { left: 90, top: 269, width: 756, height: 168 }
    : { left: 144, top: 81, width: 1632, height: 144 }
}

export const houseCaptions: Draw = (props, frame) => {
  const page = captionPages(props.captions).find((p) => p.fromFrame <= frame && frame < p.toFrame)
  if (!page) return null
  const active = page.words.findLastIndex((w) => w.atFrame <= frame)
  const { cream, mint, ink } = brand.colours
  return root(
    'house-v5',
    props.format === 'why-ladder-v5' ? ladderCaptionBand(props.aspect) : band(props),
    <span>
      {page.words.map((word, i) => (
        <React.Fragment key={i}>
          {i ? ' ' : ''}
          <span
            style={{
              color: i === active ? mint : cream,
              visibility: word.atFrame <= frame ? 'visible' : 'hidden',
            }}
          >
            {word.text}
          </span>
        </React.Fragment>
      ))}
    </span>,
    {
      display: 'grid',
      placeItems: 'center',
      textAlign: 'center',
      fontFamily: HOUSE_FONTS.dek,
      fontWeight: 500,
      fontSize: 62,
      lineHeight: 1.1,
      background: `linear-gradient(transparent,${ink}ed 38%,${ink}ed 66%,transparent)`,
    },
  )
}
