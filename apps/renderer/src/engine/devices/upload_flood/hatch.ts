import React from 'react'
import type { EngineTokens } from '../../props'
/** Six-pixel perpendicular spacing, rotated 45 degrees; one pattern for all AI tiles. */
export function hatch(id: string, tokens: EngineTokens) {
  return React.createElement('pattern', { id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    React.createElement('rect', { width: 6, height: 6, fill: tokens.ink }),
    React.createElement('path', { d: 'M0 0V6', stroke: tokens.inkSoft, strokeWidth: 2 }))
}
