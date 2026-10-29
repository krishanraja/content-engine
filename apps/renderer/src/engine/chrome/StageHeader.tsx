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
// Wide (1920x1080): the same parts on 96 px margins and a 60 px top, logo left, pill right.
const WIDE_LOGO = { left: 96, top: 62, width: 300 }
const WIDE_PILL = { left: 1554, top: 56, width: 270, height: 52 }

export function StageHeader({ props }: { props: EngineRenderProps }) {
  const tokens = houseTokens(props.tokens)
  const wide = props.aspect === '16:9'
  const LOGO_AT = wide ? WIDE_LOGO : LOGO, PILL_AT = wide ? WIDE_PILL : PILL
  return <>
    <div style={{ position: 'absolute', left: LOGO_AT.left, top: LOGO_AT.top, width: LOGO_AT.width }}>
      <HouseLogo image={props.brand.logo} width={LOGO_AT.width} />
    </div>
    <div style={{
      position: 'absolute', ...PILL_AT, boxSizing: 'border-box', display: 'grid', placeItems: 'center',
      borderRadius: PILL_AT.height / 2, background: tokens.section, color: tokens.ink,
      fontFamily: HOUSE_FONTS.data, fontWeight: 500, fontSize: 30, lineHeight: 1,
    }}>{props.series.label}</div>
  </>
}
