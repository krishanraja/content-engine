import React from 'react'
import { Composition, Img, staticFile } from 'remotion'
import fixture from '../../../../../fixtures/ve/why-ladder-v5/spec.json'
import engineFixture from '../../../../../fixtures/ve/engine-core/props.json'
import { v5Params, isV5Id, type V5Id } from '../../../../../packages/contracts/src/why-ladder-v5'
import { Card } from './Cards'
import { houseCaptions } from './HouseCaptions'
import { EngineRenderPropsSchema } from '../props'
import { useEngineFrame } from '../clock'

const names: Record<V5Id, string> = {
  v5_title: 'TitleMoment',
  v5_why: 'WhyStep',
  v5_evidence: 'EvidencePlate',
  v5_challenger: 'Challenger',
  v5_recap: 'RecapStack',
  v5_landing: 'LandingCard',
  v5_close: 'ClosingCard',
  v5_rail: 'LadderRail',
  v5_callout: 'Callout',
  v5_source: 'SourceLowerThird',
}
function Preview({ id, format, params }: { id: V5Id; format: '9:16' | '16:9'; params: Record<string, unknown> }) {
  const frame = useEngineFrame()
  const overlay = ['v5_callout', 'v5_rail', 'v5_source'].includes(id)
  return (
    <>
      {overlay && <PreviewPhoto />}
      <Card id={id} format={format} frame={frame} params={params} />
    </>
  )
}
function PreviewPhoto() {
  return (
    <Img src={staticFile('still-timer.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  )
}
function CaptionPreview({ format }: { format: '9:16' | '16:9' }) {
  const frame = useEngineFrame()
  return (
    <>
      <PreviewPhoto />
      {houseCaptions(
        {
          ...EngineRenderPropsSchema.parse(engineFixture),
          aspect: format,
          captions: [
            {
              fromFrame: 0,
              toFrame: 75,
              swipeIndex: null,
              words: ['At', '30', 'seconds'].map((text, i) => ({ text, atFrame: i * 12 })),
            },
          ],
        },
        frame,
      )}
    </>
  )
}
export function V5Previews() {
  return (
    <>
      {(['9:16', '16:9'] as const).map((format) => {
        const tall = format === '9:16',
          suffix = tall ? 'Tall' : 'Wide'
        const size = { width: tall ? 1080 : 1920, height: tall ? 1920 : 1080, fps: 25, durationInFrames: 75 }
        return (
          <React.Fragment key={format}>
            {Object.keys(v5Params)
              .filter(isV5Id)
              .map((id) => {
                const sample = fixture.objects.find((o) => o.device === id)
                if (!sample) throw new Error('Missing v5 preview for ' + id)
                const params = JSON.parse(JSON.stringify(sample.params), (key, value) =>
                  key === 'src' ? staticFile(value) : value,
                )
                return (
                  <Composition
                    key={id}
                    id={'V5' + names[id] + suffix}
                    component={Preview}
                    {...size}
                    defaultProps={{ id, format, params }}
                  />
                )
              })}
            <Composition
              id={'V5HouseCaptions' + suffix}
              component={CaptionPreview}
              {...size}
              defaultProps={{ format }}
            />
          </React.Fragment>
        )
      })}
    </>
  )
}
