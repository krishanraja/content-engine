import React from 'react'
import { staticFile } from 'remotion'
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
  // Wordmarks with no separate symbol: the whole painted word (getBBox in Chromium, 18 Nov 2026).
  'openai-logo.svg': { canvas: [0, 0, 288, 78], drawn: [0, 0.3984, 287.636, 77.35] },
  'oracle-logo.svg': { canvas: [0, 0, 461.6, 60], drawn: [0, 0, 461.6, 60] },
  'soluna-logo.svg': { canvas: [0, 0, 324.213, 61.136], drawn: [0, 0, 324.213, 61.136] },
  'apple-logo.svg': { canvas: [0, 0, 41.5, 51], drawn: [0, 0, 41.5, 51] },
  // Wed 18 build-or-buy (getBBox in Chromium, 18 Nov 2026): Slack's canvas pads the symbol on every side.
  'salesforce-logo.svg': { canvas: [0, 0, 273, 191], drawn: [0, 0.5, 272.164, 190.5] },
  'workday-logo.svg': { canvas: [0, 0, 4230, 2000], drawn: [0, 0.04, 4165.513, 2000] },
  'deel-logo.svg': { canvas: [0, 0, 78, 27], drawn: [0, 0, 77.998, 26.411] },
  'slack-symbol.svg': { canvas: [0, 0, 270, 270], drawn: [73.6, 73.6, 122.8, 122.8] },
  'klarna-logo.svg': { canvas: [0, 0, 91, 22], drawn: [0, 0, 90.68, 22] },
}

export function Mark({ id, size }: { id: string; size: number }) {
  const href = resolveLogo(id)
  const bounds = MARK_BOUNDS[href.split('/').at(-1)!]
  if (!bounds) throw new Error(`logo_orbit needs measured drawn bounds for ${id}`)
  const [x, y, width, height] = bounds.canvas
  return <svg data-mark={id} x={-size / 2} y={-size / 2} width={size} height={size}
    viewBox={bounds.drawn.join(' ')} preserveAspectRatio="xMidYMid meet" overflow="hidden">
    <image href={staticFile(href)} x={x} y={y} width={width} height={height} preserveAspectRatio="none" />
  </svg>
}
