import { Audio, Sequence } from 'remotion'
import type { EngineRenderProps } from './props'

/** The stem at frame 0 and each sfx on its own frame. `stem={false}` leaves the stem to a wrapper that plays it from
 *  an earlier frame (VeCut, under the sting); the sfx stay here, on the cut's own clock. */
export function EngineAudio({ audio, stem = true }: { audio: EngineRenderProps['audio']; stem?: boolean }) {
  return (
    <>
      {stem ? <Audio src={audio.stem.src} trimBefore={audio.stem.trimBeforeFrames} /> : null}
      {audio.sfx.map((sfx, index) => (
        <Sequence key={`${sfx.atFrame}-${index}`} from={sfx.atFrame}>
          <Audio src={sfx.src} volume={10 ** (sfx.gainDb / 20)} />
        </Sequence>
      ))}
    </>
  )
}
