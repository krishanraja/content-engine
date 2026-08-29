import React from 'react'
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import '@fontsource/inter/800.css'
import type { ShortProps } from './props'

const FONT_STACK = 'Inter, sans-serif'

function Caption({ text, accent, emphasis, scale, personality, cueIndex }: { text: string; accent: string; emphasis: string[]; scale: number; personality: 'clean' | 'kinetic'; cueIndex: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(/\s+/)
  const entrance = personality === 'kinetic' ? spring({ frame, fps, config: { damping: 18, stiffness: 220, mass: 0.55 } }) : 1
  const rotation = personality === 'kinetic' ? (cueIndex % 2 === 0 ? -0.65 : 0.65) : 0
  return (
    <div style={{
      position: 'relative', maxWidth: 930, padding: personality === 'kinetic' ? '24px 34px 27px' : '22px 30px', borderRadius: personality === 'kinetic' ? 28 : 22,
      background: personality === 'kinetic' ? 'linear-gradient(135deg, rgba(5,5,5,.94), rgba(18,18,18,.86))' : 'rgba(0,0,0,0.78)',
      border: personality === 'kinetic' ? `2px solid ${accent}66` : undefined,
      boxShadow: personality === 'kinetic' ? `0 18px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08), 0 8px 28px ${accent}22` : '0 10px 50px rgba(0,0,0,0.35)',
      textAlign: 'center', fontFamily: FONT_STACK, fontSize: 68 * scale, fontWeight: 800, lineHeight: 1.04, color: '#fff',
      opacity: interpolate(entrance, [0, 1], [0, 1]), transform: `translateY(${interpolate(entrance, [0, 1], [34, 0])}px) scale(${interpolate(entrance, [0, 1], [.9, 1])}) rotate(${rotation}deg)`,
    }}>
      {personality === 'kinetic' ? <div style={{ position: 'absolute', left: 32, right: 32, bottom: 12, height: 5, borderRadius: 10, background: `linear-gradient(90deg, ${accent}, ${accent}33)` }} /> : null}
      {words.map((word, index) => {
        const clean = word.replace(/[^a-z0-9]/gi, '').toLowerCase()
        const active = emphasis.some((item) => item.toLowerCase() === clean)
        const wordEntrance = personality === 'kinetic' ? interpolate(frame - index * 1.25, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1
        return <React.Fragment key={`${word}-${index}`}><span style={{
          display: 'inline-block', opacity: wordEntrance, transform: `translateY(${(1 - wordEntrance) * 12}px)`,
          ...(active ? (personality === 'kinetic' ? { color: '#050505', background: accent, borderRadius: 10, padding: '1px 9px 4px', margin: '0 2px', boxShadow: `0 4px 18px ${accent}55` } : { color: accent }) : {}),
        }}>{word}</span>{index < words.length - 1 ? ' ' : ''}</React.Fragment>
      })}
    </div>
  )
}

function EvidenceCard({ overlay, accent }: { overlay: ShortProps['evidenceOverlays'][number]; accent: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const entrance = spring({ frame, fps, config: { damping: 17, stiffness: 180, mass: 0.65 } })
  const imageScale = interpolate(frame, [0, fps * 4], [1.035, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: overlay.placement === 'center' ? 'center' : 'flex-start', paddingTop: overlay.placement === 'upper' ? 185 : 0, background: 'rgba(0,0,0,.18)' }}>
      <div style={{ width: 920, borderRadius: 34, overflow: 'hidden', background: '#f6f3ec', color: '#111', fontFamily: FONT_STACK, boxShadow: '0 26px 90px rgba(0,0,0,.62)', border: '2px solid rgba(255,255,255,.45)', opacity: entrance, transform: `translateY(${interpolate(entrance, [0, 1], [70, 0])}px) scale(${interpolate(entrance, [0, 1], [.91, 1])})` }}>
        <div style={{ position: 'relative', height: 540, overflow: 'hidden', background: '#e9e5db' }}>
          <Img src={staticFile(overlay.assetFile)} style={{ width: '100%', height: '100%', objectFit: overlay.fit, transform: `scale(${imageScale})` }} />
          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 -120px 90px -90px rgba(0,0,0,.45)' }} />
          <div style={{ position: 'absolute', top: 24, left: 24, padding: '11px 17px', borderRadius: 999, background: '#050505', color: accent, fontSize: 22, fontWeight: 800, letterSpacing: 1.8 }}>SOURCE</div>
        </div>
        <div style={{ padding: '28px 34px 32px', borderTop: `8px solid ${accent}` }}>
          <div style={{ fontSize: 42, lineHeight: 1.02, fontWeight: 800 }}>{overlay.title}</div>
          {overlay.excerpt ? <div style={{ marginTop: 15, fontFamily: 'Inter, sans-serif', fontSize: 29, lineHeight: 1.18, fontWeight: 600, color: '#333' }}>{overlay.excerpt}</div> : null}
          <div style={{ marginTop: 20, fontSize: 21, fontWeight: 800, letterSpacing: 1.1, color: '#68635b', textTransform: 'uppercase' }}>{overlay.source_label}</div>
        </div>
      </div>
    </AbsoluteFill>
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
      {props.evidenceOverlays.map((overlay) => {
        const from = Math.max(0, Math.floor(overlay.start_ms / 1000 * fps))
        const duration = Math.max(1, Math.ceil((overlay.end_ms - overlay.start_ms) / 1000 * fps))
        return <Sequence key={overlay.overlay_id} from={from} durationInFrames={duration}><EvidenceCard overlay={overlay} accent={props.accent} /></Sequence>
      })}
      {props.captions.map((cue, index) => {
        const from = Math.max(0, Math.floor(cue.start_ms / 1000 * fps))
        const duration = Math.max(1, Math.ceil((cue.end_ms - cue.start_ms) / 1000 * fps))
        return (
          <Sequence key={`${cue.start_ms}-${index}`} from={from} durationInFrames={duration}>
            <AbsoluteFill style={{ justifyContent: props.treatmentStyle.caption_position === 'middle' ? 'center' : 'flex-end', alignItems: 'center', paddingBottom: props.treatmentStyle.caption_position === 'middle' ? 0 : 300 }}>
              <Caption text={cue.text} accent={props.accent} emphasis={cue.emphasis} scale={props.treatmentStyle.caption_scale} personality={props.treatmentStyle.caption_personality} cueIndex={index} />
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
