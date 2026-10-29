import { HouseLogo } from '../../house/components'
import { HOUSE_FONTS } from '../../house/geometry'
import type { EngineRenderProps } from '../props'
import { houseTokens } from './tokens'

/** The header of every STAGE beat (design lock zones.header): the horizontal logo level and untouched on ink,
 *  and the channel pill. It replaces the square mark tile and the floating pill, which collide with a
 *  full-screen headline. No ILLUSTRATION tag: Krish, 28 Oct 2026, "I hate all these stupid little abbreviations
 *  and marks", then on removing it, "Yes remove those." */
const LOGO = { left: 72, top: 86, width: 260 }
const PILL = { left: 690, top: 79, width: 270, height: 52 }

export function StageHeader({ props }: { props: EngineRenderProps }) {
  const tokens = houseTokens(props.tokens)
  return <>
    <div style={{ position: 'absolute', left: LOGO.left, top: LOGO.top, width: LOGO.width }}>
      <HouseLogo image={props.brand.logo} width={LOGO.width} />
    </div>
    <div style={{
      position: 'absolute', ...PILL, boxSizing: 'border-box', display: 'grid', placeItems: 'center',
      borderRadius: PILL.height / 2, background: tokens.section, color: tokens.ink,
      fontFamily: HOUSE_FONTS.data, fontWeight: 500, fontSize: 30, lineHeight: 1,
    }}>{props.series.label}</div>
  </>
}
