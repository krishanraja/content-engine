import React from 'react'
import { HOUSE_FONTS } from '../../house/geometry'
import { textWidth } from '../../house/metrics'
import { FWP_SPLIT_SEAM_Y } from '../mocks/face-with-proof'
import { WORD_CAPTION } from './WordCaption'
import { SAFE_TALL, SAFE_WIDE } from '../kit/focus'
import type { EngineBeat, EngineRenderProps } from '../props'

/** Lead captions (vertical-captions: "Bold word-by-word captions for 9:16 viewers watching without sound"; house
 *  captions, Archivo 900, 2 to 4 words a card, the spoken word in mint and never more than one, cards changing on his
 *  words). Large centred captions on an ink card are the main graphic; they replace the house captions for that style
 *  only (BrandFrame), and nothing here draws without it.
 *
 *  Where a card may sit, off his face and inside the channel safe area (config/channel-safe-zones.json):
 *  - SPLIT: on the seam, as the house word caption sits there, and never further below it than that word reaches
 *    (his face is below the seam: the captions.off_face rule).
 *  - his take full frame, or a graphics-only beat: in the off-face caption zone face-with-proof keeps for face beats,
 *    from y 1180, and never past the safe bottom (y 1320) nor right of the action rail (x 860). */

type Page = EngineRenderProps['captions'][number]
export interface LeadWord { text: string; at: number }
export interface LeadCard { words: LeadWord[]; from: number; to: number }
export interface LeadBox { left: number; top: number; width: number; height: number; size: number }

export const LEAD = { maxSize: 112, minSize: 64, padX: 34, padY: 18, lineHeight: 1.05, tallFaceTop: 1180 } as const

/** His words cut into cards of up to `perCard` words, breaking after punctuation, at a beat boundary, or where he
 *  pauses (over 20 frames between words). A card holds until the next card starts. */
export function leadCards(pages: readonly Page[], beats: readonly EngineBeat[], perCard: number): LeadCard[] {
  const words = pages.flatMap(page => page.words.map(w => ({ text: w.text, at: w.atFrame, end: page.toFrame })))
    .sort((a, b) => a.at - b.at)
  const beatOf = (f: number) => beats.findIndex(b => b.fromFrame <= f && f < b.toFrame)
  const cards: { words: (LeadWord & { end: number })[] }[] = []
  for (const w of words) {
    const card = cards.at(-1)
    const last = card?.words.at(-1)
    const breaks = !card || !last || card.words.length >= perCard || /[.,;:!?]$/.test(last.text)
      || w.at - last.end > 20 || beatOf(w.at) !== beatOf(last.at)
    if (breaks) cards.push({ words: [w] }); else card.words.push(w)
  }
  return cards.map((card, i) => {
    const last = card.words.at(-1)!
    const next = cards[i + 1]?.words[0]
    return { words: card.words.map(({ text, at }) => ({ text, at })), from: card.words[0]!.at,
      to: Math.max(last.at + 1, next ? Math.min(next.at, last.end) : last.end) }
  })
}

/** The card's box for this beat, the largest size up to 112 px at which its words fit on one line. */
export function leadBox(card: LeadCard, beat: EngineBeat | undefined, aspect: '9:16' | '16:9'): LeadBox {
  const text = card.words.map(w => w.text).join(' ')
  const tall = aspect === '9:16'
  const split = beat?.layout === 'SPLIT'
  // Below y 520 the right edge is the action rail's left: every lead card sits there, so x 60 to 860 on a tall cut.
  const left = tall ? SAFE_TALL.left : SAFE_WIDE.left + 64
  const right = tall ? SAFE_TALL.rail.right : SAFE_WIDE.right - 64
  const room = right - left
  // In the face beats' zone the card must fit between y 1180 and the safe bottom, so its type is held to that height.
  const tallest = split || !tall ? LEAD.maxSize : Math.floor((SAFE_TALL.bottom - LEAD.tallFaceTop - 2 * LEAD.padY) / LEAD.lineHeight)
  let size: number = Math.min(LEAD.maxSize, tallest)
  while (size > LEAD.minSize && textWidth('archivo700', text, size) * 1.06 + 2 * LEAD.padX > room) size -= 2
  const width = Math.min(room, textWidth('archivo700', text, size) * 1.06 + 2 * LEAD.padX)
  const height = size * LEAD.lineHeight + 2 * LEAD.padY
  // On a SPLIT beat the card sits on the seam as the house word does (MOTION_STANDARD: "the word sits on the seam
  // there"), never reaching further below it than the house word caption does, so it stays off his face.
  const bottom = split ? FWP_SPLIT_SEAM_Y + (tall ? WORD_CAPTION.tall.size : WORD_CAPTION.wide.size) * 0.6
    : tall ? Math.min(SAFE_TALL.bottom, LEAD.tallFaceTop + height + 8) : SAFE_WIDE.bottom - 40
  return { left: left + (room - width) / 2, top: bottom - height, width, height, size }
}

export function LeadCaption({ props, frame, perCard }: { props: EngineRenderProps; frame: number; perCard: number }) {
  if ((props.ending && frame >= props.ending.fromFrame)
    || props.beats.some((beat) => beat.role === 'call' && frame >= beat.fromFrame && frame < beat.toFrame)) return null
  const card = leadCards(props.captions, props.beats, perCard).find(c => c.from <= frame && frame < c.to)
  if (!card) return null
  const beat = props.beats.find(b => b.fromFrame <= frame && frame < b.toFrame)
  const box = leadBox(card, beat, props.aspect)
  const spoken = card.words.filter(w => w.at <= frame)
  const current = spoken.length - 1
  // The card lands with the slap token's 5% (never past 105%), once, on his first word.
  const pop = Math.min(1, (frame - card.from) / 4)
  return <div data-lead-caption style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height,
    boxSizing: 'border-box', padding: `${LEAD.padY}px ${LEAD.padX}px`, borderRadius: 28, background: props.tokens.inkDeep,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: `0 ${(box.size * 0.26).toFixed(1)}px`,
    transform: `scale(${(1.05 - 0.05 * pop).toFixed(4)})`, transformOrigin: '50% 100%', pointerEvents: 'none',
    boxShadow: `0 18px 40px color-mix(in srgb, ${props.tokens.inkDeep} 35%, transparent)` }}>
    {card.words.map((w, i) => <span key={i} data-lead-word data-current={i === current || undefined} style={{
      fontFamily: HOUSE_FONTS.structure, fontWeight: 900, fontSize: box.size, lineHeight: LEAD.lineHeight, whiteSpace: 'nowrap',
      letterSpacing: '-0.01em', color: i === current ? props.tokens.mint : props.tokens.cream, opacity: i <= current ? 1 : 0.38,
    }}>{w.text}</span>)}
  </div>
}
