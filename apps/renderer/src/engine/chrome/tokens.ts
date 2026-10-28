import type { HouseTokens } from '../../house/components'
import type { EngineTokens } from '../props'

/** The existing house kit calls the channel identity colour `section`. */
export function houseTokens(tokens: EngineTokens): HouseTokens {
  return { ...tokens, section: tokens.channel }
}
