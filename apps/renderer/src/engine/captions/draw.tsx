import React from 'react'
import type { EngineRenderProps } from '../props'
import { clean, textWidth, type Box } from './kit'

/** The pieces every caption style is drawn with, shared by ./themes.tsx and each style in ./styles/. A style is a pure
 *  function of (props, frame): a still and a render agree frame for frame. */
export type Draw = (props: EngineRenderProps, frame: number) => React.ReactElement | null

/** The style's root: absolutely placed in its band, above the picture, never catching the pointer. */
export const root = (name: string, box: Box, children: React.ReactNode, extra: React.CSSProperties = {}) => (
  <div data-caption-theme={name} style={{ position: 'absolute', ...box, pointerEvents: 'none', zIndex: 40, ...extra }}>{children}</div>
)

export const upper = (t: string) => clean(t).toUpperCase()

/** Rows of words, greedily wrapped to a width by the width estimate (no word is split; a page keeps its order). */
export function wrap(words: string[], size: number, width: number, face: Parameters<typeof textWidth>[2], caps: boolean, gap: number): number[][] {
  const rows: number[][] = []
  let row: number[] = [], used = 0
  words.forEach((w, i) => {
    const wd = textWidth(w, size, face, caps)
    if (row.length && used + gap + wd > width) { rows.push(row); row = []; used = 0 }
    used += (row.length ? gap : 0) + wd; row.push(i)
  })
  if (row.length) rows.push(row)
  return rows
}

/** Stop words (lowercase, as said) that several styles set small or quiet. */
export const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from',
  'is', 'it', 'its', "it's", 'was', 'are', 'be', 'so', 'as', 'that', 'this', 'what', 'who', 'how', 'you', 'your', 'we',
  'i', 'my', 'me', 'he', 'she', 'they', 'them', 'their', 'our', 'if', 'then', 'than', 'up', 'out', 'no', 'not', 'do'])
export const isStop = (text: string) => STOP.has(clean(text).toLowerCase())

/** When a page's exit may start: its usual `frames` before the page ends, but never before its last word has been
 *  on screen, sharp, for `holdSeconds`. Returns undefined when there is no room for an exit at all (the page then cuts).
 *  Reviewers on 13 Nov saw every style that started its exit at toFrame - n eat a word said in the page's last frames. */
export function exitStart(page: { toFrame: number; words: readonly { atFrame: number }[] }, frames: number, fps: number,
  holdSeconds = 0.17): number | undefined {
  const last = page.words[page.words.length - 1]!.atFrame
  const start = Math.max(page.toFrame - frames, last + Math.round(holdSeconds * fps))
  return start < page.toFrame ? start : undefined
}

/** The one word a style may mark on a page: the hero when the page has one, else none. key() falls back to the longest
 *  word, which marks filler ("ended" in "have ended the"); a marked word should be one that carries the point. */
export function marked(hero: number): number { return hero >= 0 ? hero : -1 }
