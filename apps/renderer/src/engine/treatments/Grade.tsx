import type { JSX } from 'react'

export type GradeProps = { src: string; focus: number; tokens: Record<string, string>; frame: number; width: number; height: number }

/** One photograph, racked into a quiet stage. Timing belongs to the caller. */
export function GradedBackdrop({ src, focus, tokens, frame, width, height }: GradeProps): JSX.Element {
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
  for (const c of JSON.stringify([src, focus, tokens, frame, width, height])) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619)
  const id = `grade-${hash >>> 0}`
  const rect = { width, height }
  return <svg {...rect} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'hidden', isolation: 'isolate' }} aria-hidden="true">
    <defs>
      <filter id={`${id}-photo`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values={String(0.94 - 0.3 * f)} />
        <feGaussianBlur stdDeviation={blur} />
      </filter>
      <linearGradient id={`${id}-tone`} x2="0" y2="1">
        <stop stopColor={tokens.cream} stopOpacity={0.06} />
        <stop offset="0.48" stopColor={tokens.mint} stopOpacity={0.025} />
        <stop offset="1" stopColor={tokens.ink} stopOpacity={0.18} />
      </linearGradient>
      <linearGradient id={`${id}-depth`} x2="0" y2="1">
        <stop stopColor={tokens.cream} stopOpacity={0.025 * f} />
        <stop offset="0.55" stopColor={tokens.inkSoft} stopOpacity={0.04 * f} />
        <stop offset="1" stopColor={tokens.inkDeep} stopOpacity={0.3 * f} />
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
    <image href={src} x={-pad} y={-pad} width={width + pad * 2} height={height + pad * 2} preserveAspectRatio="xMidYMid slice" filter={`url(#${id}-photo)`} />
    <rect {...rect} fill={`url(#${id}-tone)`} />
    {/* A 90% ink veil bounds even a white source, keeping cream drawings above 7:1 with house tokens. */}
    <rect {...rect} fill={tokens.ink} opacity={0.45 * f} />
    <rect {...rect} fill={`url(#${id}-depth)`} />
    <rect {...rect} filter={`url(#${id}-grain)`} opacity={0.02} />
    <rect {...rect} fill={`url(#${id}-vignette)`} />
  </svg>
}
