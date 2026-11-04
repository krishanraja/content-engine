import { HOUSE_FONTS } from '../../house/geometry'
import { motionProfile } from '../clock'

/** The face a device sets a font role in. With no motion style, or a style that keeps the house type, it is exactly
 *  HOUSE_FONTS[role], so the house render is unchanged (houseGolden.test.ts). A style whose profile says `type.font:
 *  'data'` (hud-terminal) sets every role in the mono data face, IBM Plex Mono ("IBM Plex Mono only, on ink"). */
export type FontRole = keyof typeof HOUSE_FONTS

export function font(role: FontRole): string {
  return motionProfile()?.type?.font === 'data' ? HOUSE_FONTS.data : HOUSE_FONTS[role]
}
