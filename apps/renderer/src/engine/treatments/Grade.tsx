import type { JSX } from 'react'

export type GradeProps = { src: string; focus: number; tokens: Record<string, string>; frame: number; width: number; height: number; zoom?: number }

/** One photograph, racked into a quiet stage. Timing belongs to the caller. */
export function GradedBackdrop({ src, focus, tokens, frame, width, height, zoom = 1 }: GradeProps): JSX.Element {
  if (![focus, frame, width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error('Invalid grade dimensions or clock')
  for (const key of ['ink', 'inkDeep', 'inkSoft', 'cream', 'mint']) {
    if (!tokens[key]) throw new Error(`Missing grade token: ${key}`)
  }
  const f = Math.max(0, Math.min(1, focus))
  const blur = 18 * (width / 1080) * f
  // Four blur radii of overscan on every edge, including portrait canvases.
  const pad = blur * 4 + width * 0.02
  // Content-derived IDs keep SSR repeatable and separate concurrently mounted grades.
  let hash = 2166136261
  for (const c of JSON.stringify([src, focus, tokens, frame, width, height, zoom])) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619)
  const id = `grade-${hash >>> 0}`
  const rect = { width, height }
  return <svg {...rect} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'hidden', isolation: 'isolate' }} aria-hidden="true">
    <defs>
      <filter id={`${id}-photo`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values={String(0.94 - 0.3 * f)} />
        <feGaussianBlur stdDeviation={blur} />
      </filter>
      {/* Focus falls off toward the bottom: behind the graphics the photo is racked soft, under them it reads again,
          so the bottom of a tall frame is ground, never a plain dark slab (Tue 17, 19 Nov 2026; config/ve/plain-frames.json). */}
      <filter id={`${id}-near`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values={String(0.94 - 0.2 * f)} />
        <feGaussianBlur stdDeviation={blur * 0.15} />
      </filter>
      <linearGradient id={`${id}-fall`} x2="0" y2="1">
        <stop offset="0.55" stopColor={tokens.cream} stopOpacity={1} />
        <stop offset="0.82" stopColor={tokens.cream} stopOpacity={0} />
      </linearGradient>
      <mask id={`${id}-soft`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
        <rect {...rect} fill={`url(#${id}-fall)`} />
      </mask>
      <linearGradient id={`${id}-tone`} x2="0" y2="1">
        <stop stopColor={tokens.cream} stopOpacity={0.06} />
        <stop offset="0.48" stopColor={tokens.mint} stopOpacity={0.025} />
        <stop offset="1" stopColor={tokens.ink} stopOpacity={0.18} />
      </linearGradient>
      <linearGradient id={`${id}-depth`} x2="0" y2="1">
        <stop stopColor={tokens.cream} stopOpacity={0.025 * f} />
        <stop offset="0.55" stopColor={tokens.inkSoft} stopOpacity={0.04 * f} />
        <stop offset="1" stopColor={tokens.inkDeep} stopOpacity={0.14 * f} />
      </linearGradient>
      <radialGradient id={`${id}-vignette`} r="0.72">
        <stop offset="0.25" stopColor={tokens.inkDeep} stopOpacity={0} />
        <stop offset="1" stopColor={tokens.inkDeep} stopOpacity={0.32} />
      </radialGradient>
      <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={0.8 / (width / 1080)} numOctaves={3} seed={17} stitchTiles="stitch" />
        <feOffset dx={(frame * 0.37) % 7} dy={(frame * 0.23) % 7} />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2126 0.7152 0.0722 0 0" result="noise" />
        <feFlood floodColor={tokens.cream} />
        <feComposite in2="noise" operator="in" />
      </filter>
    </defs>
    <rect {...rect} fill={tokens.ink} />
    {/* zoom (compile measures it, 1 to 1.6) scales the photo from its top edge, so a tall frame's bottom lands on lit
        ground instead of a photo's black foreground (Tue 17, 19 Nov 2026). */}
    <g transform={zoom > 1 ? `translate(${width / 2} 0) scale(${zoom}) translate(${-width / 2} 0)` : undefined}>
      <image href={src} x={-pad} y={-pad} width={width + pad * 2} height={height + pad * 2} preserveAspectRatio="xMidYMid slice" filter={`url(#${id}-near)`} />
      <g mask={`url(#${id}-soft)`}>
        <image href={src} x={-pad} y={-pad} width={width + pad * 2} height={height + pad * 2} preserveAspectRatio="xMidYMid slice" filter={`url(#${id}-photo)`} />
      </g>
    </g>
    <rect {...rect} fill={`url(#${id}-tone)`} />
    {/* A 90% ink veil bounds even a white source, keeping cream drawings above 7:1 with house tokens. */}
    <rect {...rect} fill={tokens.ink} opacity={0.45 * f} />
    <rect {...rect} fill={`url(#${id}-depth)`} />
    <rect {...rect} filter={`url(#${id}-grain)`} opacity={0.02} />
    <rect {...rect} fill={`url(#${id}-vignette)`} />
  </svg>
}
