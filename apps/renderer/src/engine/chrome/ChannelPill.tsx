import { isOffDayLabel } from './offDay'
import { SectionPill } from '../../house/components'
import { HOUSE } from '../../house/geometry'
import { textWidth } from '../../house/metrics'
import { boxFor } from '../geometry'
import { fitScale } from '../fit'
import type { EngineBeat, EngineRenderProps } from '../props'
import { houseTokens } from './tokens'

export function ChannelPill({ props, beat }: { props: EngineRenderProps; beat: EngineBeat }) {
  if (!beat.sectionBeat) return null
  // From 27 Nov no beat carries the series name: S3h on the outro is the one wordmark (Ruling, Krish, 2026-11-27:
  // "agree"; props.seriesPill false; config/brand-palette.json marks_rule).
  if (props.seriesPill === false) return null
  // An off day wears no tag at all (Ruling, Krish, 2026-11-18: "off.day is NEVER to be used ever as a tag").
  if (isOffDayLabel(props.series.label)) return null
  const box = boxFor('pill', props.aspect)
  const label = props.series.label.toLowerCase()
  const natural = {
    width: textWidth('mono', label, HOUSE.pill.size, HOUSE.pill.letterSpacingEm) + 2 * HOUSE.pill.paddingX,
    height: HOUSE.pill.size + 2 * HOUSE.pill.paddingY,
  }
  const scale = fitScale(natural, box)
  return <div style={{ position: 'absolute', left: box.left, top: box.top, width: natural.width,
    height: natural.height, display: 'flex', whiteSpace: 'nowrap',
    transformOrigin: 'top left', transform: `scale(${scale})`, pointerEvents: 'none' }}>
    <SectionPill label={label} tokens={houseTokens(props.tokens)} onColour={false} />
  </div>
}
