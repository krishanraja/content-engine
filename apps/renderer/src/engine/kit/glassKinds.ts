import { Prompt } from './glass/prompt'
import { Cards } from './glass/cards'
import { Footage } from './glass/footage'
import { Bubble } from './glass/bubble'
import type { GlassKind } from './glassRegistry'

export const H_GLASS_KINDS: Record<string, GlassKind> = {
  prompt: Prompt,
  cards: Cards,
  footage: Footage,
  bubble: Bubble,
}
