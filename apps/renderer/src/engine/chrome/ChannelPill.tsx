import { SectionPill } from '../../house/components'
import { boxFor } from '../geometry'
import type { EngineBeat, EngineRenderProps } from '../props'
import { houseTokens } from './tokens'

export function ChannelPill({ props, beat }: { props: EngineRenderProps; beat: EngineBeat }) {
  if (!beat.sectionBeat) return null
  const box = boxFor('pill', props.aspect)
  return <div style={{ position: 'absolute', left: box.left, top: box.top, display: 'flex', pointerEvents: 'none' }}>
    <SectionPill label={props.series.label.toLowerCase()} tokens={houseTokens(props.tokens)} onColour={false} />
  </div>
}
