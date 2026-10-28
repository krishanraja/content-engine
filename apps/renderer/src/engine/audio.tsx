import { Audio, Sequence } from 'remotion'
import type { EngineRenderProps } from './props'

export function EngineAudio({ audio }: { audio: EngineRenderProps['audio'] }) {
  return (
    <>
      <Audio src={audio.stem.src} trimBefore={audio.stem.trimBeforeFrames} />
      {audio.sfx.map((sfx, index) => (
        <Sequence key={`${sfx.atFrame}-${index}`} from={sfx.atFrame}>
          <Audio src={sfx.src} volume={10 ** (sfx.gainDb / 20)} />
        </Sequence>
      ))}
    </>
  )
}
