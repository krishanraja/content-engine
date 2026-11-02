import React from 'react'
import { resolveLogo } from './schema'

// Bounds in the approved SVG's own coordinate system, measured from painted
// pixels. Meta's crop selects the infinity symbol and excludes the wordmark.
// xAI's registered asset is the X symbol; its intrinsic 63x24 size is irrelevant.
export const MARK_BOUNDS: Record<string, { canvas: [number, number, number, number]; drawn: [number, number, number, number] }> = {
  'meta-logo.svg': { canvas: [0, 0, 6962.3646, 3000], drawn: [999.9949, 1000, 1504.8278, 1000] },
  'xai-logo.svg': { canvas: [0, 0, 759, 290.2], drawn: [0.232, 0.168, 758.458, 289.8] },
  'google-symbol.svg': { canvas: [0, 0, 268.1522, 273.8827], drawn: [0, 0, 268.1522, 273.8827] },
  'amazon-symbol.svg': { canvas: [2.167, 0.438, 251.038, 259.969], drawn: [8.694, 0.438, 239, 254.978] },
  'anthropic-symbol.svg': { canvas: [0, 0, 92.2, 65], drawn: [0, 0, 92.2, 65] },
}

export function Mark({ id, size }: { id: string; size: number }) {
  const href = resolveLogo(id)
  const bounds = MARK_BOUNDS[href.split('/').at(-1)!]
  if (!bounds) throw new Error(`logo_orbit needs measured drawn bounds for ${id}`)
  const [x, y, width, height] = bounds.canvas
  return <svg data-mark={id} x={-size / 2} y={-size / 2} width={size} height={size}
    viewBox={bounds.drawn.join(' ')} preserveAspectRatio="xMidYMid meet" overflow="hidden">
    <image href={href} x={x} y={y} width={width} height={height} preserveAspectRatio="none" />
  </svg>
}
