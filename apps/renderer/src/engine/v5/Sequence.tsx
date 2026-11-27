import React from 'react'
import { AbsoluteFill } from 'remotion'
import { isV5Id, v5Params } from '../../../../../packages/contracts/src/why-ladder-v5'
import { EngineAudio } from '../audio'
import type { EngineRenderProps } from '../props'
import { Card, enter } from './Cards'
import { ThemedCaption } from '../chrome/ThemedCaption'

export function LadderSequence({
  props,
  frame,
  stem,
}: {
  props: EngineRenderProps
  frame: number
  stem: boolean
}) {
  const index = props.beats.findIndex((b) => frame >= b.fromFrame && frame < b.toFrame)
  function beatLayer(index: number, outgoing: boolean) {
    const beat = props.beats[index]
    if (!beat) return null
    const at = outgoing ? beat.toFrame - 1 : frame
    const wipe = index === 0 || outgoing ? 1 : enter(((at - beat.fromFrame) * 25) / props.fps, 9)
    return (
      <AbsoluteFill key={beat.id} style={{ clipPath: 'inset(0 ' + 100 * (1 - wipe) + '% 0 0)' }}>
        {beat.uses.map((id) => {
          const object = props.objects.find((o) => o.obj === id)
          if (!object || !isV5Id(object.device)) throw Error('Unknown why-ladder object ' + id)
          const start =
            props.events.find(
              (e) => e.obj === id && e.verb === 'enter' && e.atFrame >= beat.fromFrame && e.atFrame < beat.toFrame,
            )?.atFrame ?? object.fromFrame
          const exited = props.events.some(
            (e) => e.obj === id && e.verb === 'exit' && e.atFrame >= start && at >= e.atFrame,
          )
          if (at < start || exited || (outgoing && object.device === 'v5_callout')) return null
          const starts: number[] = []
          if (object.device === 'v5_title' && props.titleMoment) {
            let word = 0
            for (const line of v5Params.v5_title.parse(object.params).lines) {
              const cue = props.titleMoment.words[word]?.atFrame ?? start
              starts.push(Math.max(((cue - start) * 25) / props.fps, starts.length ? starts.at(-1)! + 4 : 0))
              word += line.split(/\s+/).length
            }
          }
          return (
            <Card
              key={id}
              id={object.device}
              params={object.params}
              format={props.aspect}
              frame={((at - start) * 25) / props.fps}
              lineStarts={starts}
              titleMark={props.titleCardMark !== false}
              captionSpace={
                object.device !== 'v5_title' &&
                object.device !== 'v5_close' &&
                (props.captionTheme ?? 'house-v5') === 'house-v5'
              }
            />
          )
        })}
      </AbsoluteFill>
    )
  }
  const title = props.titleMoment
  return (
    <AbsoluteFill>
      {index > 0 && ((frame - props.beats[index]!.fromFrame) * 25) / props.fps < 9 && beatLayer(index - 1, true)}
      {beatLayer(index, false)}
      {props.beats[index]?.uses.every((id) => props.objects.find((o) => o.obj === id)?.device !== 'v5_close') &&
        (!title || frame < title.fromFrame || frame >= title.toFrame) && (
          <ThemedCaption props={props} frame={frame} theme={props.captionTheme ?? 'house-v5'} />
        )}
      <EngineAudio audio={props.audio} stem={stem} />
    </AbsoluteFill>
  )
}
