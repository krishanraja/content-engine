import React from 'react'
import { AbsoluteFill, Img, staticFile } from 'remotion'
import '@fontsource-variable/archivo'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/source-serif-4'
import '@fontsource/ibm-plex-mono/500.css'
import type { CarouselRenderProps } from './props'

type Wordmark = CarouselRenderProps['branding']['wordmarks']['mindmake']

function OfficialWordmark({ asset, width }: { asset: Wordmark; width: number }) {
  const scale = width / asset.alphaCrop.width
  return <div style={{ position: 'relative', width, height: asset.alphaCrop.height * scale, overflow: 'hidden' }}>
    <Img src={staticFile(asset.assetFile)} style={{ position: 'absolute', width: asset.pixelWidth * scale, height: asset.pixelHeight * scale, left: -asset.alphaCrop.x * scale, top: -asset.alphaCrop.y * scale, maxWidth: 'none' }} />
  </div>
}

function Visual({ props }: { props: CarouselRenderProps }) {
  const { slide, branding } = props
  const { colors, typography } = branding
  const items = slide.visualItems
  const asset = branding.assets.find((candidate) => slide.assetIds.includes(candidate.assetId))
  if (asset) return <div style={{ marginTop: 42, height: 430, position: 'relative', overflow: 'hidden', border: `2px solid ${colors.line}`, background: colors.surface }}>
    <Img src={staticFile(asset.assetFile)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    {(asset.attribution || asset.illustrationLabel) && <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, fontFamily: typography.data, fontSize: 14, letterSpacing: 1.4, color: colors.text, background: 'rgba(10,16,13,0.9)', padding: '10px 12px' }}>{asset.illustrationLabel || asset.attribution}</div>}
  </div>
  if (!items.length) return null
  if (slide.layout === 'split_gate') return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 54 }}>
    {items.slice(0, 2).map((item, index) => <div key={item} style={{ minHeight: 230, padding: 30, border: `2px solid ${index === 0 ? colors.amber : colors.mint}`, background: colors.surface, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ fontFamily: typography.data, fontSize: 20, letterSpacing: 3, color: index === 0 ? colors.amber : colors.mint }}>{index === 0 ? 'HARD GATE' : 'GROWTH GATE'}</div>
      <div style={{ fontFamily: typography.structure, fontWeight: 720, fontSize: 45, lineHeight: 1.02, color: colors.text }}>{item}</div>
    </div>)}
  </div>
  if (slide.layout === 'flow') return <div style={{ display: 'flex', alignItems: 'center', marginTop: 56 }}>
    {items.map((item, index) => <React.Fragment key={item}>
      <div style={{ flex: 1, minHeight: 154, border: `2px solid ${index === items.length - 1 ? colors.mint : colors.line}`, background: index === items.length - 1 ? colors.mint : colors.surface, color: index === items.length - 1 ? colors.mintInk : colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: typography.structure, fontSize: 26, lineHeight: 1.05, fontWeight: 700, textAlign: 'center' }}>{item}</div>
      {index < items.length - 1 && <div style={{ width: 34, height: 2, background: colors.line }} />}
    </React.Fragment>)}
  </div>
  return <div style={{ marginTop: 48, borderTop: `2px solid ${colors.line}` }}>
    {items.map((item, index) => <div key={item} style={{ minHeight: 88, display: 'grid', gridTemplateColumns: '60px 1fr', alignItems: 'center', borderBottom: `2px solid ${colors.line}` }}>
      <span style={{ fontFamily: typography.data, color: index === items.length - 1 ? colors.mint : colors.mutedText, fontSize: 19 }}>{String(index + 1).padStart(2, '0')}</span>
      <span style={{ fontFamily: typography.structure, color: colors.text, fontWeight: 650, fontSize: 31 }}>{item}</span>
    </div>)}
  </div>
}

export function MindmakeCarouselSlide(props: CarouselRenderProps) {
  const { slide, branding } = props
  const { colors, typography, wordmarks } = branding
  const isCover = slide.role === 'cover'
  const isVerdict = slide.layout === 'verdict'
  const headlineColor = slide.accent === 'amber_changed' ? colors.amber : slide.accent === 'mint_answer' || isVerdict ? colors.mint : colors.text
  return <AbsoluteFill style={{ background: colors.ink, color: colors.text, padding: '72px 78px 64px', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: isCover ? 310 : 100 }}>
      {isCover ? <div style={{ width: 710, minHeight: 300, background: '#050806', display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center', padding: '34px 38px', boxSizing: 'border-box' }}>
        <OfficialWordmark asset={wordmarks.mindmake} width={230} />
        <OfficialWordmark asset={wordmarks.series} width={630} />
      </div> : <div style={{ background: '#050806', width: 280, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><OfficialWordmark asset={wordmarks.mindmake} width={220} /></div>}
      <div style={{ fontFamily: typography.data, fontSize: 18, letterSpacing: 2, color: colors.mutedText, paddingTop: 10 }}>{String(slide.position).padStart(2, '0')} / {String(props.slideCount).padStart(2, '0')}</div>
    </div>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: isCover || isVerdict ? 'center' : 'flex-start', paddingTop: isCover ? 26 : 74 }}>
      {slide.dataLabel && <div style={{ fontFamily: typography.data, fontSize: 18, letterSpacing: 3, color: colors.mutedText, marginBottom: 30 }}>{slide.dataLabel.toUpperCase()}</div>}
      <div style={{ fontFamily: isVerdict ? typography.claim : typography.structure, fontSize: isCover ? 80 : isVerdict ? 82 : 66, lineHeight: isCover ? 0.98 : 1.02, letterSpacing: isVerdict ? -2 : -3.5, fontWeight: isVerdict ? 540 : 760, maxWidth: 900, color: headlineColor }}>{slide.headline}</div>
      {slide.body && <div style={{ fontFamily: typography.body, fontSize: 34, lineHeight: 1.24, color: colors.secondaryText, maxWidth: 870, marginTop: 34 }}>{slide.body}</div>}
      <Visual props={props} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: colors.mutedText, fontFamily: typography.data, fontSize: 17, letterSpacing: 2 }}>
      <span style={{ width: 34, height: 2, background: colors.mint }} />
      {props.seriesName.toUpperCase()}
    </div>
    {props.reviewMode && <div style={{ position: 'absolute', right: 28, bottom: 28, border: `1px solid ${colors.amber}`, padding: '8px 12px', fontFamily: typography.data, fontSize: 14, color: colors.amber, letterSpacing: 2 }}>DESIGN CANDIDATE</div>}
  </AbsoluteFill>
}
