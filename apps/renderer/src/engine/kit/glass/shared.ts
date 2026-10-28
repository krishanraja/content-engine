import { z } from 'zod'
import type React from 'react'
import type { EngineTokens } from '../../props'
import { HOUSE_FONTS } from '../../../house/geometry'

export { HOUSE_FONTS }
export const Text = z.string().min(1)
export const Frame = z.number().int().nonnegative()
export function scale(k: number) {
  if (!Number.isFinite(k) || k <= 0) throw new Error('ve: glass k must be positive')
  return k
}
// Glass pixels already map to canvas pixels. Keep the locked size at the reference
// camera, scale with the current camera, and never shrink below the reading floor.
export const typeSize = (px: number, k: number, reference: number) => Math.max(30, px * scale(k) / reference)
export const cardStyle = (tokens: EngineTokens): React.CSSProperties => ({
  position: 'relative', boxSizing: 'border-box', background: tokens.inkSoft,
  color: tokens.cream, border: `2px solid ${tokens.cream}`,
  boxShadow: `10px 10px 0 ${tokens.inkDeep}`, borderRadius: 0,
})
