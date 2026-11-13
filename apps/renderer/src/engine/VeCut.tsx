import { AbsoluteFill, Audio, OffthreadVideo, Sequence } from 'remotion'
import { FormatMaster } from './FormatMaster'
import type { EngineRenderProps } from './props'

/** One ve cut as the render draws it. With no props.sting it is FormatMaster, exactly as before.
 *
 *  With one (the 16:9 long cut of a weekly series piece), the sting plays straight after the hook (sting.atFrame, the
 *  hook's last frame + 1; config/brand-palette.json long_cut sting after_hook, SOCIAL-BEST-PRACTICES-2026 section 4.3:
 *  a brand sting follows the hook, never precedes it). The render's frames [0, atFrame) are the cut's hook; the next
 *  sting.frames are the sting clip as it is, muted and full frame; then the cut goes on from its own frame atFrame. Every
 *  frame in the props stays on the cut's own clock. The one stem plays once from the render's frame 0 (ve premix lays
 *  his voice with the sting's frames of silence at atFrame, and the bed lifted under it); the sfx stay inside
 *  FormatMaster, on the cut's clock. atFrame absent or 0 is the retired sting in front of the cut, drawn as it was. */
export function VeCut(props: EngineRenderProps) {
  const { sting, ...cut } = props
  if (!sting) return <FormatMaster {...props} />
  const at = sting.atFrame ?? 0
  // Each part plays only its own sfx: one before the sting stops with the hook, and none is heard twice.
  const part = (keep: (atFrame: number) => boolean) => ({ ...cut, audio: { ...cut.audio, sfx: cut.audio.sfx.filter((sfx) => keep(sfx.atFrame)) } })
  return (
    <AbsoluteFill style={{ backgroundColor: props.tokens.ink }}>
      {at > 0 ? (
        <Sequence name="hook" durationInFrames={at}>
          <FormatMaster {...part((frame) => frame < at)} stem={false} />
        </Sequence>
      ) : null}
      <Sequence name="sting" from={at} durationInFrames={sting.frames}>
        <OffthreadVideo src={sting.src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Sequence>
      <Sequence name="cut" from={at + sting.frames} durationInFrames={props.durationFrames - at}>
        <Sequence name="cut-clock" from={-at}>
          <FormatMaster {...part((frame) => frame >= at)} stem={false} />
        </Sequence>
      </Sequence>
      <Audio src={props.audio.stem.src} trimBefore={props.audio.stem.trimBeforeFrames} />
    </AbsoluteFill>
  )
}
