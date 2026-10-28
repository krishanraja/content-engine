import { HouseLogo } from '../../house/components'
import { HOUSE_FONTS } from '../../house/geometry'
import type { EngineRenderProps } from '../props'
import { houseTokens } from './tokens'

/** The header of every STAGE beat (design lock zones.header): the horizontal logo level and untouched on ink,
 *  the ILLUSTRATION tag while a generated plate is on screen, the channel pill. It replaces the square mark
 *  tile, the floating pill and the 24 px label, which collide with a full-screen headline. */
// Krish, 28 Oct 2026: "I hate all these stupid little abbreviations and marks": the tag is not drawn on video.
const SHOW_ILLUSTRATION_TAG = false
const LOGO = { left: 72, top: 86, width: 260 }
const TAG = { left: 366, top: 82, width: 284, height: 52 }
const PILL = { left: 690, top: 79, width: 270, height: 52 }
// Wide (1920x1080): the same parts on 96 px margins and a 60 px top, logo left, pill right.
const WIDE_LOGO = { left: 96, top: 62, width: 300 }
const WIDE_PILL = { left: 1554, top: 56, width: 270, height: 52 }

export function StageHeader({ props, frame }: { props: EngineRenderProps; frame: number }) {
  const tokens = houseTokens(props.tokens)
  const wide = props.aspect === '16:9'
  const LOGO_AT = wide ? WIDE_LOGO : LOGO, PILL_AT = wide ? WIDE_PILL : PILL
  const plate = props.illustrationLabels.some((label) => label.fromFrame <= frame && frame < label.toFrame)
  return <>
    <div style={{ position: 'absolute', left: LOGO_AT.left, top: LOGO_AT.top, width: LOGO_AT.width }}>
      <HouseLogo image={props.brand.logo} width={LOGO_AT.width} />
    </div>
    {SHOW_ILLUSTRATION_TAG && plate ? <div style={{
      position: 'absolute', ...TAG, boxSizing: 'border-box', display: 'grid', placeItems: 'center',
      border: `2px dashed ${props.tokens.cream}`, color: props.tokens.cream, background: props.tokens.ink,
      fontFamily: HOUSE_FONTS.data, fontWeight: 500, fontSize: 28, letterSpacing: '0.14em', lineHeight: 1,
    }}>ILLUSTRATION</div> : null}
    <div style={{
      position: 'absolute', ...PILL_AT, boxSizing: 'border-box', display: 'grid', placeItems: 'center',
      borderRadius: PILL_AT.height / 2, background: tokens.section, color: tokens.ink,
      fontFamily: HOUSE_FONTS.data, fontWeight: 500, fontSize: 30, lineHeight: 1,
    }}>{props.series.label}</div>
  </>
}
