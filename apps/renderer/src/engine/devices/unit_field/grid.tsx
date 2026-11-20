import React from 'react'

/** Shared with through_line: row-major stable slots. Removed marks leave holes; copies append. */
export function dotGridPosition(index: number, columns: number, pitch = 64) {
  return { x: (index - Math.floor(index / columns) * columns) * pitch, y: Math.floor(index / columns) * pitch }
}

/** The ID badge (the Mon 2 Nov jobs piece, kept as it is: Krish, 2026-11-20): 62 x 84, a 12 px gap, its clip slot. */
export const BADGE = { w: 62, h: 84, gap: 12, radius: 7, slot: { x: 22, y: 7, w: 18, h: 5 }, stripe: { y: 56, h: 11 } } as const
export const BADGE_PITCH = { x: BADGE.w + BADGE.gap, y: BADGE.h + BADGE.gap } as const

export function badgeGridPosition(index: number, columns: number) {
  return { x: (index % columns) * BADGE_PITCH.x, y: Math.floor(index / columns) * BADGE_PITCH.y }
}

/** A fractional dot is a sector, so its ink area keeps the exact unit fraction. A badge is drawn from its top-left
 *  corner: its body, its clip slot and, for a unit of the striped subset, the stripe in the series colour. */
export function UnitMark({ kind, weight, colour, soft, stripe = 0, stripeColour, shadow }: {
  kind: 'dot' | 'block' | 'badge'; weight: number; colour: string; soft: string
  stripe?: number; stripeColour?: string; shadow?: string
}) {
  if (kind === 'badge') {
    const b = BADGE
    return <g transform={`scale(${weight} 1)`}>
      {shadow && <rect x={0} y={4} width={b.w} height={b.h} rx={b.radius} fill={shadow} opacity={0.35}/>}
      <rect x={0} y={0} width={b.w} height={b.h} rx={b.radius} fill={colour}/>
      <rect x={b.slot.x} y={b.slot.y} width={b.slot.w} height={b.slot.h} rx={3} fill={soft} opacity={0.25}/>
      {stripe > 0 && stripeColour && <rect x={0} y={b.stripe.y} width={b.w * stripe} height={b.stripe.h} fill={stripeColour}/>}
    </g>
  }
  if (kind === 'block') return <g transform={`scale(${weight} 1)`}>
    <path d="M0 -20L24 -8L0 4L-24 -8Z" fill={colour}/>
    <path d="M-24 -8L0 4V30L-24 18Z" fill={soft}/>
    <path d="M0 4L24 -8V18L0 30Z" fill={colour}/>
  </g>
  if (weight >= 1) return <circle r={19} fill={colour}/>
  const angle = weight * Math.PI * 2 - Math.PI / 2
  return <path d={`M0 0L0 -19A19 19 0 ${weight > .5 ? 1 : 0} 1 ${19 * Math.cos(angle)} ${19 * Math.sin(angle)}Z`} fill={colour}/>
}
