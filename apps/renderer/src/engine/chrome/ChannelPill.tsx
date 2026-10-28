import { SectionPill } from '../../house/components'
import { HOUSE } from '../../house/geometry'
import { textWidth } from '../../house/metrics'
import { boxFor } from '../geometry'
import { fitScale } from '../fit'
import type { EngineBeat, EngineRenderProps } from '../props'
import { houseTokens } from './tokens'

export function ChannelPill({ props, beat }: { props: EngineRenderProps; beat: EngineBeat }) {
  if (!beat.sectionBeat) return null
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
