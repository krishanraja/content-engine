import React from 'react'

/** Shared with through_line: row-major stable slots. Removed marks leave holes; copies append. */
export function dotGridPosition(index: number, columns: number, pitch = 64) {
  return { x: (index - Math.floor(index / columns) * columns) * pitch, y: Math.floor(index / columns) * pitch }
}

/** A fractional dot is a sector, so its ink area keeps the exact unit fraction. */
export function UnitMark({ kind, weight, colour, soft }: {
  kind: 'dot' | 'block'; weight: number; colour: string; soft: string
}) {
  if (kind === 'block') return <g transform={`scale(${weight} 1)`}>
    <path d="M0 -20L24 -8L0 4L-24 -8Z" fill={colour}/>
    <path d="M-24 -8L0 4V30L-24 18Z" fill={soft}/>
    <path d="M0 4L24 -8V18L0 30Z" fill={colour}/>
  </g>
  if (weight >= 1) return <circle r={19} fill={colour}/>
  const angle = weight * Math.PI * 2 - Math.PI / 2
  return <path d={`M0 0L0 -19A19 19 0 ${weight > .5 ? 1 : 0} 1 ${19 * Math.cos(angle)} ${19 * Math.sin(angle)}Z`} fill={colour}/>
}
