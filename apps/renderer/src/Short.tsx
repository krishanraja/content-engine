import React from 'react'
import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import '@fontsource/inter/800.css'
import type { ShortProps } from './props'

const FONT_STACK = 'Inter, sans-serif'

function Caption({ text, accent, emphasis, scale }: { text: string; accent: string; emphasis: string[]; scale: number }) {
  const words = text.split(/\s+/)
  return (
    <div style={{ maxWidth: 930, padding: '22px 30px', borderRadius: 22, background: 'rgba(0,0,0,0.78)', boxShadow: '0 10px 50px rgba(0,0,0,0.35)', textAlign: 'center', fontFamily: FONT_STACK, fontSize: 68 * scale, fontWeight: 800, lineHeight: 1.04, color: '#fff' }}>
      {words.map((word, index) => {
        const clean = word.replace(/[^a-z0-9]/gi, '').toLowerCase()
        const active = emphasis.some((item) => item.toLowerCase() === clean)
        return <React.Fragment key={`${word}-${index}`}><span style={active ? { color: accent } : undefined}>{word}</span>{index < words.length - 1 ? ' ' : ''}</React.Fragment>
      })}
    </div>
  )
}

export function MindmakeShort(props: ShortProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const atMs = frame / fps * 1000
  const before = [...props.cropKeyframes].reverse().find((item) => item.at_ms <= atMs)
  const after = props.cropKeyframes.find((item) => item.at_ms > atMs)
  const dynamicCrop = before && after ? {
    x: interpolate(atMs, [before.at_ms, after.at_ms], [before.x, after.x], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    y: interpolate(atMs, [before.at_ms, after.at_ms], [before.y, after.y], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    width: interpolate(atMs, [before.at_ms, after.at_ms], [before.width, after.width], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    height: interpolate(atMs, [before.at_ms, after.at_ms], [before.height, after.height], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  } : before || after || props.crop
  const scale = 1080 / dynamicCrop.width
  const videoStyle = {
    position: 'absolute' as const,
    width: props.sourceWidth * scale,
    height: props.sourceHeight * scale,
    left: -dynamicCrop.x * scale,
    top: -dynamicCrop.y * scale,
  }
  return (
    <AbsoluteFill style={{ backgroundColor: '#050505' }}>
      <OffthreadVideo src={staticFile(props.sourceFile)} style={videoStyle} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.2) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,.15) 55%, rgba(0,0,0,.62) 100%)' }} />
      {props.seriesName ? (
        <div style={{ position: 'absolute', top: 82, left: 64, display: 'flex', alignItems: 'center', gap: 16, fontFamily: FONT_STACK, fontSize: 31, fontWeight: 800, letterSpacing: 0.4, color: '#fff' }}>
          <span style={{ width: 14, height: 14, borderRadius: 999, background: props.accent, boxShadow: `0 0 24px ${props.accent}` }} />
          {props.seriesName}
          <span style={{ color: props.accent, fontSize: 22, letterSpacing: 1.4, textTransform: 'uppercase' }}>{props.treatmentStyle.proof_motif}</span>
        </div>
      ) : null}
      {props.captions.map((cue, index) => {
        const from = Math.max(0, Math.floor(cue.start_ms / 1000 * fps))
        const duration = Math.max(1, Math.ceil((cue.end_ms - cue.start_ms) / 1000 * fps))
        return (
          <Sequence key={`${cue.start_ms}-${index}`} from={from} durationInFrames={duration}>
            <AbsoluteFill style={{ justifyContent: props.treatmentStyle.caption_position === 'middle' ? 'center' : 'flex-end', alignItems: 'center', paddingBottom: props.treatmentStyle.caption_position === 'middle' ? 0 : 300 }}>
              <Caption text={cue.text} accent={props.accent} emphasis={cue.emphasis} scale={props.treatmentStyle.caption_scale} />
            </AbsoluteFill>
          </Sequence>
        )
      })}
      {props.treatmentStyle.hook_card_ms > 0 ? (
        <Sequence from={0} durationInFrames={Math.max(1, Math.round(props.treatmentStyle.hook_card_ms / 1000 * fps))}>
          <AbsoluteFill style={{ background: '#050505', justifyContent: 'center', padding: 80, fontFamily: FONT_STACK, color: '#fff' }}>
            <div style={{ color: props.accent, fontSize: 28, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 28 }}>Evidence first</div>
            <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02 }}>{props.hook}</div>
          </AbsoluteFill>
        </Sequence>
      ) : null}
      <div style={{ position: 'absolute', bottom: 106, left: 64, right: 64, height: 7, borderRadius: 8, background: 'rgba(255,255,255,.2)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, frame / Math.max(1, props.durationMs / 1000 * fps) * 100)}%`, height: '100%', background: props.accent }} />
      </div>
    </AbsoluteFill>
  )
}
