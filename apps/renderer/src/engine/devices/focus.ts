import type { EngineEvent, EngineObject } from '../props'
import type { Focus, Point } from '../kit/focus'
import type { DeviceProps } from './types'
import { bubbleFocus } from './typing_bubble'
import { chipFocus } from './query_chip'
import { scribblePen } from './scribble/state'

/** Which devices answer the camera (kit/focus.ts). A device not listed here gives living-ui no line to zoom to and
 *  single-line-drawing no pen to follow; config/ve/style-distinct.json names the same devices, so `ve styles` leaves
 *  out a style whose effects touch no device in the window (engine.test.ts holds the two lists equal). */
export const FOCUS: Readonly<Record<string, (p: Pick<DeviceProps, 'object' | 'events' | 'box' | 'aspect' | 'frame'>) => Focus | undefined>> = {
  typing_bubble: bubbleFocus,
  query_chip: chipFocus,
}

export const PEN: Readonly<Record<string, (object: EngineObject, events: readonly EngineEvent[]) => (frame: number) => Point | undefined>> = {
  scribble: scribblePen,
}

/** The devices whose text a typewriter or rolling style reveals (kit/reveal.ts: typedText and revealLines). */
export const TYPED: readonly string[] = ['typing_bubble', 'query_chip', 'headline']
