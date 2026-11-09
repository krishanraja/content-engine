import { AbsoluteFill, Audio, OffthreadVideo, Sequence } from 'remotion'
import { FormatMaster } from './FormatMaster'
import type { EngineRenderProps } from './props'

/** One ve cut as the render draws it. With no props.sting it is FormatMaster, exactly as before. With one (the 16:9
 *  long cut of a weekly series piece; Krish, 2026-11-05: "I think it should go at the start of the longer wide videos
 *  100%,") the render's frames [0, sting.frames) are the sting clip as it is, muted and full frame, and FormatMaster
 *  runs inside a Sequence from sting.frames, so every frame in the props stays on the cut's own clock: beat 0, his
 *  face and the hook land on the very next frame after the sting's last. The one stem plays once from the render's
 *  frame 0, so the music bed runs unbroken under the sting into his voice; the sfx stay inside FormatMaster, on the
 *  cut's clock. */
export function VeCut(props: EngineRenderProps) {
  const { sting, ...cut } = props
  if (!sting) return <FormatMaster {...props} />
  return (
    <AbsoluteFill style={{ backgroundColor: props.tokens.ink }}>
      <Sequence name="sting" durationInFrames={sting.frames}>
        <OffthreadVideo src={sting.src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Sequence>
      <Sequence name="cut" from={sting.frames} durationInFrames={props.durationFrames}>
        <FormatMaster {...cut} stem={false} />
      </Sequence>
      <Audio src={props.audio.stem.src} trimBefore={props.audio.stem.trimBeforeFrames} />
    </AbsoluteFill>
  )
}
