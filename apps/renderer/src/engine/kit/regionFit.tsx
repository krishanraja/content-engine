import React from 'react'
import { fitBox, fitScale } from '../fit'
import type { Box } from '../devices/types'

/** Devices that place themselves at fixed zones (quote_card, stat_strip, record_card) draw as before everywhere except
 *  in a layout region (kit/layout.ts, spec style.layout fill or stack; docs/ve/INGREDIENTS.md "What is still open").
 *  There they lay out at a natural size of their own choosing, then grow to fill the region (fit.ts, up to MAX_GROW)
 *  and centre in it. This module only computes and wraps; the callers gate on `isRegion(box)`. */

/** The natural width, from the candidates, that grows the most in the box (ties go to the wider), with its height. */
export function bestNatural(box: Box, candidates: readonly number[], heightAt: (width: number) => number): { width: number; height: number } {
  let best: { width: number; height: number; scale: number } | undefined
  for (const width of [...new Set([...candidates, Math.floor(box.width)])].filter(w => w <= box.width).sort((a, b) => a - b)) {
    const natural = { width, height: heightAt(width) }
    const scale = fitScale(natural, box)
    if (!best || scale >= best.scale - 1e-9) best = { ...natural, scale }
  }
  return best ?? { width: box.width, height: heightAt(box.width) }
}

/** Draws `children` (laid out in a natural-size box at 0,0) scaled and centred in the region. */
export function RegionFit({ natural, box, children }: { natural: { width: number; height: number }; box: Box; children: React.ReactNode }) {
  const at = fitBox(natural, box)
  return <div data-region-fit="" style={{ position: 'absolute', left: at.left, top: at.top, width: natural.width, height: natural.height,
    transformOrigin: '0 0', transform: `scale(${fitScale(natural, box)})` }}>{children}</div>
}
