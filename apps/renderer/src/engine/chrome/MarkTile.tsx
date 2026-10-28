import { MarkTile as HouseMarkTile } from '../../house/components'
import { HOUSE } from '../../house/geometry'
import { boxFor, WIDE } from '../geometry'
import type { EngineRenderProps } from '../props'
import { houseTokens } from './tokens'

export function MarkTile({ props }: { props: EngineRenderProps }) {
  const box = boxFor('mark', props.aspect)
  return <HouseMarkTile
    image={props.brand.mark}
    size={box.width}
    imageWidth={props.aspect === '16:9' ? WIDE.mark.image : HOUSE.mark.image}
    tokens={houseTokens(props.tokens)}
    style={{ position: 'absolute', left: box.left, top: box.top, boxShadow: `10px 10px 0 ${props.tokens.channel}` }}
  />
}
