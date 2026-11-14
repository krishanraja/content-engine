import type { Draw } from '../draw'
import { georgiaBuild } from './georgia-build'
import { stairFlash } from './stair-flash'
import { tuckStack } from './tuck-stack'
import { anchorQuote } from './anchor-quote'
import { rackFocus } from './rack-focus'
import { flipHinge } from './flip-hinge'
import { slice } from './slice'
import { slotRoll } from './slot-roll'
import { receiptChip } from './receipt-chip'
import { inkBlock } from './ink-block'
import { mintWord } from './mint-word'

/** The caption styles added on 13 Nov 2026, one file each (Krish, 2026-11-13: "I want an array of animated motion
 *  caption styles available in the engine, decoupled from the visual treatment"). Eight are new builds from his
 *  references (docs/ve/INGREDIENTS.md); receipt-chip, ink-block and mint-word come from the caption builds of his
 *  Character.ai (26 Oct), eating-its-own-jobs (2 Nov) and AI music (11 Nov) cuts. */
export const STYLES = {
  'georgia-build': georgiaBuild,
  'stair-flash': stairFlash,
  'tuck-stack': tuckStack,
  'anchor-quote': anchorQuote,
  'rack-focus': rackFocus,
  'flip-hinge': flipHinge,
  'slice': slice,
  'slot-roll': slotRoll,
  'receipt-chip': receiptChip,
  'ink-block': inkBlock,
  'mint-word': mintWord,
} as const satisfies Record<string, Draw>
export type StyleName = keyof typeof STYLES
