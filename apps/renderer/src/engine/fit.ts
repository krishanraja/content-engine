import type { Box } from './devices/types'

/** Natural typography is authored first; the whole object then fits uniformly, never enlarged. */
export function fitScale(natural: { width: number; height: number }, box: Box): number {
  return Math.min(1, box.width / natural.width, box.height / natural.height)
}

export function fitBox(natural: { width: number; height: number }, box: Box): Box {
  const scale = fitScale(natural, box)
  return { left: box.left + (box.width - natural.width * scale) / 2, top: box.top,
    width: natural.width * scale, height: natural.height * scale }
}
