import React from 'react'
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import '@fontsource/inter/800.css'
import '@fontsource-variable/archivo'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/source-serif-4'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import type { ShortProps } from './props'
import { evidenceIntentLabel } from './evidence-label'

const FONT_STACK = 'Inter, sans-serif'
type BrandTheme = ShortProps['brandTheme']

function themeFonts(theme: BrandTheme) {
  return theme ? {
    structure: `"${theme.typography.structure}", Arial, sans-serif`,
    claim: `"${theme.typography.claim}", Georgia, serif`,
    body: `"${theme.typography.body}", Georgia, serif`,
    data: `"${theme.typography.data}", ui-monospace, monospace`,
  } : { structure: FONT_STACK, claim: FONT_STACK, body: FONT_STACK, data: FONT_STACK }
}

function Caption({ text, accent, emphasis, scale, personality, cueIndex, brandTheme }: { text: string; accent: string; emphasis: string[]; scale: number; personality: 'clean' | 'kinetic'; cueIndex: number; brandTheme?: BrandTheme }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const fonts = themeFonts(brandTheme)
  const signal = brandTheme?.colors.mint || accent
  const words = text.split(/\s+/)
  const entrance = personality === 'kinetic' ? spring({ frame, fps, config: { damping: 18, stiffness: 220, mass: 0.55 } }) : 1
  const rotation = brandTheme ? 0 : personality === 'kinetic' ? (cueIndex % 2 === 0 ? -0.65 : 0.65) : 0
  return (
    <div style={{
      position: 'relative', maxWidth: 930, padding: brandTheme ? '23px 31px 27px' : personality === 'kinetic' ? '24px 34px 27px' : '22px 30px', borderRadius: brandTheme ? 4 : personality === 'kinetic' ? 28 : 22,
      background: brandTheme ? brandTheme.colors.surface : personality === 'kinetic' ? 'linear-gradient(135deg, rgba(5,5,5,.94), rgba(18,18,18,.86))' : 'rgba(0,0,0,0.78)',
      border: brandTheme ? `1px solid ${brandTheme.colors.line}` : personality === 'kinetic' ? `2px solid ${accent}66` : undefined,
      borderLeft: brandTheme ? `6px solid ${signal}` : undefined,
      boxShadow: brandTheme ? '0 18px 56px rgba(0,0,0,.44)' : personality === 'kinetic' ? `0 18px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08), 0 8px 28px ${accent}22` : '0 10px 50px rgba(0,0,0,0.35)',
      textAlign: 'center', fontFamily: fonts.structure, fontSize: 68 * scale, fontWeight: 800, lineHeight: 1.04, letterSpacing: brandTheme ? '-0.03em' : undefined, color: brandTheme?.colors.text || '#fff',
      opacity: interpolate(entrance, [0, 1], [0, 1]), transform: `translateY(${interpolate(entrance, [0, 1], [34, 0])}px) scale(${interpolate(entrance, [0, 1], [.9, 1])}) rotate(${rotation}deg)`,
    }}>
      {personality === 'kinetic' ? <div style={{ position: 'absolute', left: brandTheme ? 30 : 32, right: brandTheme ? 30 : 32, bottom: brandTheme ? 11 : 12, height: brandTheme ? 2 : 5, borderRadius: brandTheme ? 0 : 10, background: `linear-gradient(90deg, ${signal}, ${brandTheme?.colors.line || `${accent}33`})` }} /> : null}
      {words.map((word, index) => {
        const clean = word.replace(/[^a-z0-9]/gi, '').toLowerCase()
        const active = emphasis.some((item) => item.toLowerCase() === clean)
        const wordEntrance = personality === 'kinetic' ? interpolate(frame - index * 1.25, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1
        return <React.Fragment key={`${word}-${index}`}><span style={{
          display: 'inline-block', opacity: wordEntrance, transform: `translateY(${(1 - wordEntrance) * 12}px)`,
          ...(active ? (personality === 'kinetic' ? { color: brandTheme?.colors.mint_ink || '#050505', background: signal, borderRadius: brandTheme ? 2 : 10, padding: '1px 9px 4px', margin: '0 2px', boxShadow: brandTheme ? 'none' : `0 4px 18px ${accent}55` } : { color: signal }) : {}),
        }}>{word}</span>{index < words.length - 1 ? ' ' : ''}</React.Fragment>
      })}
    </div>
  )
}

function EvidenceCard({ overlay, accent, brandTheme }: { overlay: ShortProps['evidenceOverlays'][number]; accent: string; brandTheme?: BrandTheme }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const fonts = themeFonts(brandTheme)
  const signal = brandTheme?.colors.mint || accent
  const entrance = spring({ frame, fps, config: { damping: 17, stiffness: 180, mass: 0.65 } })
  const imageScale = interpolate(frame, [0, fps * 4], [1.035, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const intentLabel = evidenceIntentLabel(overlay)
  if (overlay.presentation === 'evidence_cutaway') {
    return (
      <AbsoluteFill style={{ background: brandTheme?.colors.ink || '#070707', alignItems: 'center', fontFamily: fonts.structure, color: brandTheme?.colors.text || '#fff' }}>
        <div style={{ position: 'absolute', top: 84, left: 64, right: 64, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ padding: '12px 19px', borderRadius: brandTheme ? 2 : 999, background: signal, color: brandTheme?.colors.mint_ink || '#050505', fontFamily: fonts.data, fontSize: 23, fontWeight: 500, letterSpacing: 1.8 }}>{intentLabel}</div>
          <div style={{ maxWidth: 650, fontFamily: fonts.data, fontSize: 21, fontWeight: 500, letterSpacing: 1.1, color: brandTheme?.colors.muted_text || '#aaa', textTransform: 'uppercase', textAlign: 'right' }}>{overlay.source_label}</div>
        </div>
        <div style={{ position: 'absolute', top: 214, width: 980, height: 430, borderRadius: brandTheme ? 3 : 30, overflow: 'hidden', background: brandTheme?.colors.paper || '#f6f3ec', boxShadow: '0 28px 100px rgba(0,0,0,.72)', border: brandTheme ? `1px solid ${brandTheme.colors.line}` : '2px solid rgba(255,255,255,.28)', opacity: entrance, transform: `translateY(${interpolate(entrance, [0, 1], [52, 0])}px) scale(${interpolate(entrance, [0, 1], [.94, 1])})` }}>
          <Img src={staticFile(overlay.assetFile)} style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${imageScale})` }} />
          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }} />
        </div>
        <div style={{ position: 'absolute', top: 714, left: 76, right: 76, textAlign: 'center', opacity: entrance }}>
          <div style={{ fontSize: 58, lineHeight: 1.04, fontWeight: 800, textWrap: 'balance' }}>{overlay.title}</div>
          {overlay.published_at ? <div style={{ marginTop: 24, color: signal, fontFamily: fonts.data, fontSize: 23, fontWeight: 500, letterSpacing: 1.6, textTransform: 'uppercase' }}>Reported {overlay.published_at}</div> : null}
        </div>
      </AbsoluteFill>
    )
  }
  if (overlay.presentation === 'presenter_primary') {
    const right = overlay.anchor === 'top_right'
    return (
      <div style={{ position: 'absolute', top: 180, ...(right ? { right: 48 } : { left: 48 }), width: 410, borderRadius: brandTheme ? 3 : 25, overflow: 'hidden', background: brandTheme?.colors.paper || '#f6f3ec', color: brandTheme ? '#131c17' : '#111', fontFamily: fonts.structure, boxShadow: '0 22px 80px rgba(0,0,0,.62)', border: brandTheme ? `1px solid ${brandTheme.colors.line}` : `3px solid ${accent}`, borderLeft: brandTheme ? `5px solid ${signal}` : undefined, opacity: entrance, transform: `translateY(${interpolate(entrance, [0, 1], [38, 0])}px) scale(${interpolate(entrance, [0, 1], [.9, 1])})` }}>
        <div style={{ height: 405, overflow: 'hidden', background: '#e9e5db' }}><Img src={staticFile(overlay.assetFile)} style={{ width: '100%', height: '100%', objectFit: overlay.fit }} /></div>
        <div style={{ padding: '20px 22px 23px' }}>
          <div style={{ color: brandTheme ? '#4a554e' : '#68635b', fontFamily: fonts.data, fontSize: 17, fontWeight: 500, letterSpacing: 1.2 }}>{intentLabel} · {overlay.source_label.toUpperCase()}</div>
          <div style={{ marginTop: 10, fontSize: 27, lineHeight: 1.04, fontWeight: 800 }}>{overlay.title}</div>
        </div>
      </div>
    )
  }
  if (overlay.presentation === 'sidecar') {
    const right = overlay.anchor === 'right'
    return (
      <AbsoluteFill style={{ alignItems: right ? 'flex-end' : 'flex-start', justifyContent: 'center', padding: '180px 38px 360px', background: `linear-gradient(${right ? '90deg' : '270deg'}, transparent 25%, rgba(0,0,0,.82) 66%, rgba(0,0,0,.96) 100%)` }}>
        <div style={{ width: 490, borderRadius: brandTheme ? 3 : 28, overflow: 'hidden', background: brandTheme?.colors.paper || '#f6f3ec', color: brandTheme ? '#131c17' : '#111', fontFamily: fonts.structure, boxShadow: '0 24px 90px rgba(0,0,0,.7)', border: brandTheme ? `1px solid ${brandTheme.colors.line}` : `3px solid ${accent}`, borderLeft: brandTheme ? `5px solid ${signal}` : undefined, opacity: entrance, transform: `translateX(${interpolate(entrance, [0, 1], [right ? 60 : -60, 0])}px)` }}>
          <div style={{ height: 610, overflow: 'hidden', background: '#e9e5db' }}><Img src={staticFile(overlay.assetFile)} style={{ width: '100%', height: '100%', objectFit: overlay.fit }} /></div>
          <div style={{ padding: '22px 25px 27px' }}>
            <div style={{ color: brandTheme ? '#4a554e' : '#68635b', fontFamily: fonts.data, fontSize: 18, fontWeight: 500, letterSpacing: 1.2 }}>{intentLabel} · {overlay.source_label.toUpperCase()}</div>
            <div style={{ marginTop: 11, fontSize: 30, lineHeight: 1.04, fontWeight: 800 }}>{overlay.title}</div>
          </div>
        </div>
      </AbsoluteFill>
    )
  }
  if (overlay.presentation === 'evidence_ribbon') {
    return (
      <div style={{ position: 'absolute', top: 1260, left: 52, right: 52, padding: '14px 18px 16px', borderRadius: brandTheme ? 4 : 25, background: brandTheme?.colors.surface || 'rgba(7,7,7,.94)', border: brandTheme ? `1px solid ${brandTheme.colors.line}` : `3px solid ${accent}`, borderLeft: brandTheme ? `6px solid ${signal}` : undefined, boxShadow: '0 24px 90px rgba(0,0,0,.68)', fontFamily: fonts.structure, color: brandTheme?.colors.text || '#fff', opacity: entrance, transform: `translateY(${interpolate(entrance, [0, 1], [44, 0])}px) scale(${interpolate(entrance, [0, 1], [.94, 1])})` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, marginBottom: 10 }}>
          <div style={{ padding: '9px 14px', borderRadius: brandTheme ? 2 : 999, background: signal, color: brandTheme?.colors.mint_ink || '#050505', fontFamily: fonts.data, fontSize: 19, fontWeight: brandTheme ? 500 : 800, letterSpacing: 1.5 }}>{intentLabel}</div>
          <div style={{ maxWidth: 690, color: brandTheme?.colors.muted_text || '#bbb', fontFamily: fonts.data, fontSize: 18, fontWeight: brandTheme ? 500 : 800, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'right' }}>{overlay.source_label}</div>
        </div>
        <div style={{ height: 180, overflow: 'hidden', borderRadius: brandTheme ? 2 : 15, background: brandTheme?.colors.paper || '#f6f3ec' }}>
          <Img src={staticFile(overlay.assetFile)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${imageScale})` }} />
        </div>
      </div>
    )
  }
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
  const fonts = themeFonts(props.brandTheme)
  const signal = props.brandTheme?.colors.mint || props.accent
  const atMs = frame / fps * 1000
  const activeEvidence = props.evidenceOverlays.find((overlay) => overlay.start_ms <= atMs && overlay.end_ms > atMs)
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
    <AbsoluteFill style={{ backgroundColor: props.brandTheme?.colors.ink || '#050505' }}>
      <OffthreadVideo src={staticFile(props.sourceFile)} style={videoStyle} />
      <AbsoluteFill style={{ background: props.brandTheme ? 'linear-gradient(180deg, rgba(10,16,13,.24) 0%, rgba(10,16,13,0) 24%, rgba(10,16,13,.18) 55%, rgba(10,16,13,.72) 100%)' : 'linear-gradient(180deg, rgba(0,0,0,.2) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,.15) 55%, rgba(0,0,0,.62) 100%)' }} />
      {props.seriesName && props.brandTheme ? (
        <div style={{ position: 'absolute', top: 76, left: 58, right: 58, display: 'flex', alignItems: 'center', gap: 18, fontFamily: fonts.structure, color: props.brandTheme.colors.text }}>
          <span style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.035em' }}>mind<span style={{ color: signal }}>/</span>make</span>
          <span style={{ width: 1, height: 27, background: props.brandTheme.colors.line }} />
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em' }}>{props.seriesName}</span>
          <span style={{ marginLeft: 'auto', color: props.brandTheme.colors.muted_text, fontFamily: fonts.data, fontSize: 16, fontWeight: 500, letterSpacing: '.14em', textTransform: 'uppercase' }}>{props.treatmentStyle.proof_motif}</span>
        </div>
      ) : props.seriesName ? (
        <div style={{ position: 'absolute', top: 82, left: 64, display: 'flex', alignItems: 'center', gap: 16, fontFamily: FONT_STACK, fontSize: 31, fontWeight: 800, letterSpacing: 0.4, color: '#fff' }}>
          <span style={{ width: 14, height: 14, borderRadius: 999, background: props.accent, boxShadow: `0 0 24px ${props.accent}` }} />
          {props.seriesName}
          <span style={{ color: props.accent, fontSize: 22, letterSpacing: 1.4, textTransform: 'uppercase' }}>{props.treatmentStyle.proof_motif}</span>
        </div>
      ) : null}
      {props.evidenceOverlays.map((overlay) => {
        const from = Math.max(0, Math.floor(overlay.start_ms / 1000 * fps))
        const duration = Math.max(1, Math.ceil((overlay.end_ms - overlay.start_ms) / 1000 * fps))
        return <Sequence key={overlay.overlay_id} from={from} durationInFrames={duration}><EvidenceCard overlay={overlay} accent={props.accent} brandTheme={props.brandTheme} /></Sequence>
      })}
      {props.captions.map((cue, index) => {
        const from = Math.max(0, Math.floor(cue.start_ms / 1000 * fps))
        const duration = Math.max(1, Math.ceil((cue.end_ms - cue.start_ms) / 1000 * fps))
        return (
          <Sequence key={`${cue.start_ms}-${index}`} from={from} durationInFrames={duration}>
            <AbsoluteFill style={{ justifyContent: props.treatmentStyle.caption_position === 'middle' ? 'center' : 'flex-end', alignItems: 'center', paddingBottom: props.treatmentStyle.caption_position === 'middle' ? 0 : activeEvidence?.presentation === 'evidence_cutaway' ? 180 : activeEvidence?.presentation === 'evidence_ribbon' ? 120 : 300 }}>
              <Caption text={cue.text} accent={props.accent} emphasis={cue.emphasis} scale={props.treatmentStyle.caption_scale * (activeEvidence?.presentation === 'evidence_cutaway' ? .86 : activeEvidence?.presentation === 'evidence_ribbon' ? .92 : 1)} personality={props.treatmentStyle.caption_personality} cueIndex={index} brandTheme={props.brandTheme} />
            </AbsoluteFill>
          </Sequence>
        )
      })}
      {props.treatmentStyle.hook_card_ms > 0 ? (
        <Sequence from={0} durationInFrames={Math.max(1, Math.round(props.treatmentStyle.hook_card_ms / 1000 * fps))}>
          <AbsoluteFill style={{ background: props.brandTheme?.colors.ink || '#050505', justifyContent: 'center', padding: 80, fontFamily: fonts.structure, color: props.brandTheme?.colors.text || '#fff' }}>
            <div style={{ color: signal, fontFamily: fonts.data, fontSize: 28, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 28 }}>Evidence first</div>
            <div style={{ maxWidth: 900, color: props.brandTheme?.colors.mint || undefined, fontFamily: props.brandTheme ? fonts.claim : fonts.structure, fontSize: 76, fontWeight: props.brandTheme ? 400 : 800, lineHeight: 1.02 }}>{props.hook}</div>
          </AbsoluteFill>
        </Sequence>
      ) : null}
      {!props.brandTheme ? <div style={{ position: 'absolute', bottom: 106, left: 64, right: 64, height: 7, borderRadius: 8, background: 'rgba(255,255,255,.2)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, frame / Math.max(1, props.durationMs / 1000 * fps) * 100)}%`, height: '100%', background: props.accent }} />
      </div> : null}
    </AbsoluteFill>
  )
}
