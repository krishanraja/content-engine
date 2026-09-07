import React from 'react'
import { AbsoluteFill, staticFile } from 'remotion'
import '@fontsource-variable/archivo'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/source-serif-4'
import '@fontsource/ibm-plex-mono/500.css'
import type { CarouselRenderProps } from './props'

type Wordmark = CarouselRenderProps['branding']['wordmarks']['mindmake']
type Colors = CarouselRenderProps['branding']['colors']
type Scene = CarouselRenderProps['slide']['scene']

const MATERIAL = { brass: '#a99d7d', brassDark: '#615c4c', walnut: '#332b21' } as const

function OfficialWordmark({ asset, width, lettersOnly = false }: { asset: Wordmark; width: number; lettersOnly?: boolean }) {
  const crop = lettersOnly ? asset.letterRegion : asset.alphaCrop
  const height = width * crop.height / crop.width
  return <svg width={width} height={height} viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`} preserveAspectRatio="xMinYMid meet" aria-hidden>
    <image href={asset.assetDataUrl || staticFile(asset.assetFile)} x="0" y="0" width={asset.pixelWidth} height={asset.pixelHeight} />
  </svg>
}

function MechanicalKey({ changed = false, width = 620 }: { changed?: boolean; width?: number }) {
  const height = width * 0.27
  const teeth = changed ? '182,112 260,112 260,142 314,142 314,106 372,106 372,142 438,142 438,112 512,112 512,80 554,80 554,142 610,142' : '182,112 260,112 260,142 314,142 314,112 372,112 372,142 438,142 438,112 512,112 512,80 554,80 554,142 610,142'
  return <svg viewBox="0 0 640 172" width={width} height={height} aria-hidden>
    <circle cx="82" cy="86" r="58" fill="none" stroke={MATERIAL.brass} strokeWidth="22" />
    <circle cx="82" cy="86" r="18" fill="none" stroke={MATERIAL.brassDark} strokeWidth="7" />
    <path d="M132 72H610V112H182L132 101Z" fill={MATERIAL.brass} />
    <polygon points={teeth} fill={MATERIAL.brass} />
    {changed && <rect x="314" y="106" width="58" height="7" fill="#e0a44a" />}
    <path d="M198 82H530" stroke="#d8cfb6" strokeWidth="4" opacity="0.72" />
  </svg>
}

function Tick({ color, size = 60 }: { color: string; size?: number }) {
  return <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden><path d="M11 33l13 13 29-31" fill="none" stroke={color} strokeWidth="8" strokeLinecap="square" /></svg>
}

function SignalRoom({ colors }: { colors: Colors }) {
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', right: -180, top: 220, width: 760, height: 760, border: `2px solid ${colors.line}`, borderRadius: '50%' }} />
    {[0, 1, 2, 3].map((index) => <div key={index} style={{ position: 'absolute', right: 80 + index * 130, top: 338 + index * 38, width: 2, height: 520, background: colors.line, transform: 'rotate(12deg)' }} />)}
    <div style={{ position: 'absolute', left: 78, right: 78, bottom: 100, height: 520, background: colors.raised, border: `2px solid ${colors.line}`, boxShadow: `18px 18px 0 ${MATERIAL.walnut}` }}>
      <div style={{ position: 'absolute', left: 34, top: 30, fontFamily: 'IBM Plex Mono', fontSize: 20, letterSpacing: 3, color: colors.mutedText }}>ROUTE KEY / VERSION A</div>
      <div style={{ position: 'absolute', left: 34, top: 92 }}><MechanicalKey width={650} /></div>
      <div style={{ position: 'absolute', right: 34, bottom: 30, display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'IBM Plex Mono', fontSize: 25, letterSpacing: 2, color: colors.mint }}><Tick color={colors.mint} size={48} /> APPROVED</div>
    </div>
  </div>
}

function InspectionTable({ colors, items }: { colors: Colors; items: string[] }) {
  return <div style={{ position: 'absolute', left: 78, right: 78, bottom: 100, height: 600, background: colors.ink, border: `2px solid ${colors.ink}`, boxShadow: `16px 16px 0 ${MATERIAL.walnut}` }}>
    <div style={{ position: 'absolute', inset: 30, border: `1px solid ${colors.line}`, padding: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {items.map((item, index) => <div key={item} style={{ border: `1px solid ${index === items.length - 1 ? colors.mint : colors.line}`, padding: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', color: colors.text, fontFamily: 'Archivo Variable', fontSize: 25, fontWeight: 650 }}>
        <span>{item}</span><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 16, color: index === items.length - 1 ? colors.mint : colors.mutedText }}>{String(index + 1).padStart(2, '0')}</span>
      </div>)}
    </div>
    <div style={{ position: 'absolute', right: -58, top: 110, transform: 'rotate(90deg)' }}><MechanicalKey width={440} /></div>
  </div>
}

function EngravingBench({ colors, items }: { colors: Colors; items: string[] }) {
  return <div style={{ position: 'absolute', left: 0, right: 0, bottom: 100, height: 660, background: colors.paper, borderTop: `2px solid ${colors.line}` }}>
    <div style={{ position: 'absolute', left: 78, top: 48, fontFamily: 'IBM Plex Mono', fontSize: 18, letterSpacing: 2, color: colors.ink }}>ONE LINE CHANGED</div>
    <div style={{ position: 'absolute', left: 62, top: 98, transform: 'rotate(-4deg)' }}><MechanicalKey width={510} /></div>
    <div style={{ position: 'absolute', right: 38, bottom: 30, transform: 'rotate(5deg)' }}><MechanicalKey changed width={510} /></div>
    <div style={{ position: 'absolute', left: 98, bottom: 30, fontFamily: 'IBM Plex Mono', color: colors.ink, fontSize: 20 }}>{items[0]}</div>
    <div style={{ position: 'absolute', right: 92, top: 42, fontFamily: 'IBM Plex Mono', color: colors.amber, fontSize: 20 }}>{items[1]}</div>
    <div style={{ position: 'absolute', left: 508, top: 230, width: 64, height: 2, background: colors.amber, transform: 'rotate(-30deg)' }} />
  </div>
}

function LeverCutaway({ colors, items }: { colors: Colors; items: string[] }) {
  return <div style={{ position: 'absolute', left: 56, right: 56, bottom: 100, height: 650, border: `2px solid ${colors.ink}`, background: colors.paper, overflow: 'hidden' }}>
    {Array.from({ length: 12 }, (_, index) => <div key={`h-${index}`} style={{ position: 'absolute', left: 0, right: 0, top: index * 42, height: 1, background: colors.line, opacity: 0.22 }} />)}
    {Array.from({ length: 23 }, (_, index) => <div key={`v-${index}`} style={{ position: 'absolute', top: 0, bottom: 0, left: index * 42, width: 1, background: colors.line, opacity: 0.22 }} />)}
    <div style={{ position: 'absolute', left: 52, top: 48, fontFamily: 'IBM Plex Mono', fontSize: 18, color: colors.ink }}>{items[0]}</div>
    <div style={{ position: 'absolute', left: 36, top: 86 }}><MechanicalKey width={540} /></div>
    <div style={{ position: 'absolute', right: 54, bottom: 40, width: 300, height: 260, border: `14px solid ${MATERIAL.brassDark}`, borderRadius: 12 }}>
      <div style={{ position: 'absolute', left: -14, top: 108, width: 200, height: 52, border: `8px solid ${colors.amber}`, borderLeft: 0 }} />
      <div style={{ position: 'absolute', right: 24, top: 28, fontFamily: 'IBM Plex Mono', fontSize: 17, color: colors.amber }}>{items[1]}</div>
      <div style={{ position: 'absolute', right: 32, bottom: 28, width: 84, height: 84, border: `3px solid ${colors.amber}`, display: 'grid', placeItems: 'center', fontFamily: 'Archivo Variable', fontSize: 44, color: colors.amber }}>×</div>
    </div>
  </div>
}

function XrayMismatch({ colors, items }: { colors: Colors; items: string[] }) {
  return <div style={{ position: 'absolute', left: 76, right: 76, bottom: 100, height: 600 }}>
    {items.map((item, index) => <div key={item} style={{ height: 142, marginBottom: 18, border: `2px solid ${colors.line}`, background: index === 1 ? colors.raised : colors.surface, display: 'grid', gridTemplateColumns: '270px 1fr 150px', alignItems: 'center', padding: '0 30px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono', color: colors.text, fontSize: 19, letterSpacing: 1.5 }}>{item}</div>
      <div style={{ height: 12, position: 'relative', background: colors.line }}><div style={{ position: 'absolute', left: 0, top: 0, width: `${56 + index * 14}%`, height: 12, background: MATERIAL.brass }} /></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Tick color={colors.mint} size={46} /></div>
    </div>)}
    <div style={{ position: 'absolute', right: 12, top: -36, fontFamily: 'IBM Plex Mono', fontSize: 15, color: colors.mutedText }}>BOUND TO CURRENT HASH</div>
  </div>
}

function ShutterCabinet({ colors, items }: { colors: Colors; items: string[] }) {
  return <div style={{ position: 'absolute', left: 56, right: 56, bottom: 100, height: 650, background: MATERIAL.walnut, border: `2px solid ${colors.line}`, padding: 26, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
    {items.map((item, index) => <div key={item} style={{ position: 'relative', background: colors.ink, border: `1px solid ${colors.line}`, overflow: 'hidden' }}>
      {[0, 1, 2, 3, 4].map((slat) => <div key={slat} style={{ height: 104, borderBottom: `1px solid ${colors.line}`, background: slat === index + 1 ? colors.surface : colors.raised }} />)}
      <div style={{ position: 'absolute', left: 18, right: 18, bottom: 20, fontFamily: 'IBM Plex Mono', fontSize: 18, letterSpacing: 2, color: colors.text }}>{item}</div>
      <div style={{ position: 'absolute', right: 16, top: 16, width: 20, height: 20, border: `2px solid ${colors.amber}` }} />
    </div>)}
    <div style={{ position: 'absolute', left: 48, right: 48, top: 318, height: 18, background: colors.amber, boxShadow: `0 0 0 5px ${colors.ink}` }} />
    <div style={{ position: 'absolute', right: 42, top: 290, width: 72, height: 72, borderRadius: '50%', background: colors.amber, border: `7px solid ${colors.ink}` }} />
  </div>
}

function OutputTray({ colors, items }: { colors: Colors; items: string[] }) {
  return <div style={{ position: 'absolute', left: 70, right: 70, bottom: 100, height: 650 }}>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 275, background: colors.raised, border: `2px solid ${colors.line}` }} />
    <div style={{ position: 'absolute', left: 125, right: 125, top: 0, height: 390, background: colors.paper, color: colors.ink, border: `2px solid ${colors.ink}`, padding: '52px 54px', boxShadow: `18px 18px 0 ${MATERIAL.walnut}` }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 18, letterSpacing: 2 }}>{items[0]}</div>
      <div style={{ marginTop: 52, display: 'flex', alignItems: 'center', gap: 24, fontFamily: 'Archivo Variable', fontSize: 42, fontWeight: 740 }}><Tick color={colors.mint} size={70} />{items[1]}</div>
      <div style={{ position: 'absolute', left: 54, right: 54, bottom: 42, borderTop: `2px solid ${colors.ink}`, paddingTop: 18, display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono', fontSize: 16 }}><span>VERSION B</span><span>07 / 07</span></div>
    </div>
  </div>
}

function SceneArtwork({ scene, colors, items }: { scene: Scene; colors: Colors; items: string[] }) {
  if (scene === 'signal_room') return <SignalRoom colors={colors} />
  if (scene === 'inspection_table') return <InspectionTable colors={colors} items={items} />
  if (scene === 'engraving_bench') return <EngravingBench colors={colors} items={items} />
  if (scene === 'lever_cutaway') return <LeverCutaway colors={colors} items={items} />
  if (scene === 'xray_mismatch') return <XrayMismatch colors={colors} items={items} />
  if (scene === 'shutter_cabinet') return <ShutterCabinet colors={colors} items={items} />
  return <OutputTray colors={colors} items={items} />
}

export function MindmakeCarouselSlide(props: CarouselRenderProps) {
  const { slide, branding } = props
  const { colors, typography, wordmarks } = branding
  const paperScene = slide.scene === 'inspection_table' || slide.scene === 'lever_cutaway' || slide.scene === 'shutter_cabinet'
  const background = paperScene ? colors.paper : colors.ink
  const foreground = paperScene ? colors.ink : colors.text
  const secondary = paperScene ? '#4f554f' : colors.secondaryText
  const isCover = slide.role === 'cover'
  const isVerdict = slide.layout === 'verdict'
  const accentColor = slide.accent === 'amber_changed' ? colors.amber : slide.accent === 'mint_answer' ? colors.mint : foreground
  return <AbsoluteFill style={{ background, color: foreground, boxSizing: 'border-box', overflow: 'hidden' }}>
    <SceneArtwork scene={slide.scene} colors={colors} items={slide.visualItems} />
    <div style={{ position: 'absolute', left: 76, right: 76, top: 64, height: 92, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div data-brand-slot="series-channel-signpost" style={{ width: 524, height: 78, background: '#050806', border: `1px solid ${colors.line}`, display: 'flex', alignItems: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
        <OfficialWordmark asset={wordmarks.series} width={470} lettersOnly />
      </div>
      <div style={{ width: 98, paddingTop: 13, borderTop: `2px solid ${paperScene ? colors.ink : colors.line}`, textAlign: 'right', fontFamily: typography.data, fontSize: 18, letterSpacing: 2, color: paperScene ? colors.ink : colors.mutedText }}>{String(slide.position).padStart(2, '0')} / {String(props.slideCount).padStart(2, '0')}</div>
    </div>
    <div style={{ position: 'absolute', left: 76, right: 76, top: isCover ? 250 : 202 }}>
      {slide.dataLabel && <div style={{ fontFamily: typography.data, fontSize: 18, letterSpacing: 2.4, color: paperScene ? colors.ink : colors.mutedText, marginBottom: 20 }}>{slide.dataLabel}</div>}
      <div style={{ maxWidth: isCover ? 830 : 900, fontFamily: isVerdict ? typography.claim : typography.structure, fontSize: isCover ? 74 : isVerdict ? 76 : 61, lineHeight: 0.99, letterSpacing: isVerdict ? -2.2 : -3, fontWeight: isVerdict ? 540 : 760, color: accentColor }}>{slide.headline}</div>
      {slide.body && <div style={{ fontFamily: typography.body, fontSize: isCover ? 31 : 30, lineHeight: 1.22, color: secondary, maxWidth: 800, marginTop: 20 }}>{slide.body}</div>}
    </div>
    <div data-brand-slot="mindmake-publisher-signature" style={{ position: 'absolute', right: 76, bottom: 24, width: 228, height: 58, background: '#050806', border: `1px solid ${colors.line}`, display: 'grid', placeItems: 'center' }}>
      <OfficialWordmark asset={wordmarks.mindmake} width={188} />
    </div>
    {props.reviewMode && <div style={{ position: 'absolute', right: 76, top: 118, background: background, border: `1px solid ${colors.amber}`, padding: '7px 10px', fontFamily: typography.data, fontSize: 12, color: colors.amber, letterSpacing: 1.8 }}>DESIGN CANDIDATE</div>}
  </AbsoluteFill>
}
