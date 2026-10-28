import React from 'react'
import { Scribble } from '../../kit/Scribble'
import type { DeviceProps } from '../types'
import { scribbleState } from './state'

export function Device({ object, events, tokens, frame }: DeviceProps) {
  const state = scribbleState(object, events, frame)
  return state.visible ? <Scribble d={state.d} colour={state.colour} tokens={tokens}
    sinceFrames={state.sinceFrames} exiting={state.exiting} /> : null
}
