import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import type { StoryStandoffProps } from './props'
import {
  abs, BrandImage, breakLines, C, clamp, cubicIO, cubicOut, DISPLAY, Field, fitSize, jolt, LABEL, MASTHEAD_PX, Pill, SERIES_COLOURS, settle, shade, textWidth, useStoryFonts,
} from './standoff-kit'

/** The story outro: the stand-off's last round (docs/plans/2026-10-12-story-io).
 *  Your corner (the comment question, yes or no), where to read it and the
 *  next round, then one calm closing card: the brand's own masthead image on
 *  ink with the link beneath, settling in and then holding still for the
 *  last 2 s. Every change between beats is an eased move or a crossfade.
 *  The link is on screen from the first frame to the last. Every value is a
 *  pure function of the frame and the props. */
export const STORY_OUTRO_FRAMES = 180

const T = {
  yes: 12, no: 17,
  split: 60, splitDur: 10, // the two panels slide in over the comment card
  close: 104, closeDur: 14, // the closing card crossfades in, then holds still from frame 118
}

type SceneProps = StoryStandoffProps & { f: number; W: number; H: number; wide: boolean; nextDay: string; nextSeries: string; nextColour: string }

/** makeyourmindup.ai with its ending in the series colour. */
function LinkText({ link, size, colour, tail, style }: { link: string; size: number; colour: string; tail: string; style: React.CSSProperties }) {
  const dot = link.lastIndexOf('.')
  const head = dot > 0 ? link.slice(0, dot) : link
  const end = dot > 0 ? link.slice(dot) : ''
  return (
    <div style={abs({ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, whiteSpace: 'nowrap', letterSpacing: '-0.01em', color: colour, ...style })}>
      {head}<span style={{ color: tail }}>{end}</span>
    </div>
  )
}

export function StoryOutroStandoff(props: StoryStandoffProps) {
  const ready = useStoryFonts()
  const f = useCurrentFrame()
  const { width: W, height: H } = useVideoConfig()
  if (!ready) return <AbsoluteFill style={{ background: C.ink }} />
  const wide = props.shape === '16x9'
  const [day, ...rest] = props.nextLabel.split(/\s+·\s+/)
  const nextSeries = rest.join(' · ')
  const nextColour = props.nextColour ?? SERIES_COLOURS[nextSeries.trim().toLowerCase()] ?? C.lilac
  const scene: SceneProps = { ...props, f, W, H, wide, nextDay: day ?? props.nextLabel, nextSeries, nextColour }
  const y0 = f < T.split ? jolt(f, [T.yes, T.no]) : 0
  const fadeIn = cubicIO((f - T.close) / T.closeDur)
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      {f < T.split + T.splitDur && (
        <div style={abs({ left: 0, top: 0, width: W, height: H, transform: `translateY(${y0}px)` })}><Corner {...scene} /></div>
      )}
      {f >= T.split && f < T.close + T.closeDur && <NextRound {...scene} />}
      {f >= T.close && <AbsoluteFill style={{ opacity: fadeIn }}><Close {...scene} /></AbsoluteFill>}
    </AbsoluteFill>
  )
}

function Corner({ f, W, H, wide, commentQuestion, seriesColour, seriesName, link }: SceneProps) {
  const lines = breakLines(commentQuestion, wide ? 16 : 12)
  const qX = wide ? 120 : 90
  const size = fitSize(lines, wide ? 104 : 96, wide ? 1180 : 900)
  const s = settle(f, 0, 1.05, 6)?.scale ?? 1
  // The link bar: on the comment card from the first frame, with a mint highlight.
  const barTop = wide ? H - 124 : 1268
  const barH = wide ? 124 : 200
  const ls = wide ? 60 : fitSize([link], 84, 900)
  const linkW = textWidth(link, ls)
  const sweep = clamp((f - 6) / 8)
  const linkX = wide ? 120 + textWidth('The full story is free', 34, 'label') + 34 : 90
  const linkY = wide ? barTop + (barH - ls) / 2 - 6 : barTop + 82
  return (
    <>
      <Field left={-60} top={-80} width={W + 120} height={H + 160} bg={seriesColour} />
      <Pill size={wide ? 38 : 34} height={wide ? 72 : 66} bg={C.ink} fg={seriesColour}
        style={{ left: qX, top: wide ? 120 : 282, transform: `scale(${s})`, transformOrigin: '0 0' }}>Tell me in the comments</Pill>
      <div style={abs({ left: qX, top: wide ? 240 : 384, fontFamily: DISPLAY, fontSize: size, lineHeight: 1.04, color: C.ink, whiteSpace: 'pre',
        letterSpacing: '-0.015em', transform: `scale(${s})`, transformOrigin: '0 0' })}>
        {lines.join('\n')}
      </div>
      {(['Yes', 'No'] as const).map((w, i) => {
        const k = settle(f, i ? T.no : T.yes, 1.3, 5)
        if (k === null) return null
        const box = wide ? { left: 1430, top: 240 + i * 290, width: 380, height: 220 } : { left: 90 + i * 470, top: 1028, width: 430, height: 190 }
        return (
          <div key={w} style={abs({ ...box, background: i ? C.coral : C.mint, border: `8px solid ${C.ink}`, boxSizing: 'border-box', borderRadius: 18,
            boxShadow: `12px 12px 0 ${shade(seriesColour)}`, opacity: k.opacity, transform: `rotate(${i ? 4 : -4}deg) scale(${k.scale})`,
            fontFamily: DISPLAY, fontSize: wide ? 130 : 120, lineHeight: `${box.height - 16}px`, textAlign: 'center', color: C.ink })}>{w}</div>
        )
      })}
      <div style={abs({ left: -60, top: barTop, width: W + 120, height: barH + (wide ? 80 : 0), background: C.ink })} />
      <div style={abs(wide
        ? { left: 120, top: barTop + (barH - 34) / 2 - 2, fontFamily: LABEL, fontWeight: 800, fontSize: 34, lineHeight: 1, color: C.cream, whiteSpace: 'nowrap' }
        : { left: 90, top: barTop + 26, fontFamily: LABEL, fontWeight: 800, fontSize: 34, lineHeight: 1, color: C.cream, whiteSpace: 'nowrap' })}>
        The full story is free
      </div>
      <div style={abs({ left: linkX, top: linkY + ls * 0.98, width: linkW * sweep, height: wide ? 12 : 14, background: C.mint })} />
      <LinkText link={link} size={ls} colour={C.cream} tail={seriesColour} style={{ left: linkX, top: linkY }} />
      {wide && (
        <Pill size={28} height={54} bg={seriesColour} fg={C.ink} style={{ right: 70, top: barTop + (barH - 54) / 2 }}>{seriesName}</Pill>
      )}
    </>
  )
}

function NextRound({ f, W, H, wide, link, seriesColour, nextDay, nextSeries, nextColour }: SceneProps) {
  const a = cubicOut((f - T.split) / T.splitDur)
  const ls = fitSize([link], 96, wide ? 880 : 920)
  const linkW = textWidth(link, ls)
  const ds = fitSize([nextDay], wide ? 130 : 150, wide ? 740 : 920)
  const leftT = wide ? `translateX(${-(1 - a) * 1100}px)` : `translateY(${-(1 - a) * 1000}px)`
  const rightT = wide ? `translateX(${(1 - a) * 900}px)` : `translateY(${(1 - a) * 1000}px)`
  return (
    <>
      <div style={abs(wide ? { left: -60, top: -80, width: 1100, height: H + 160, background: C.ink, transform: leftT }
        : { left: -60, top: -80, width: W + 120, height: 1040, background: C.ink, transform: leftT })}>
        <div style={abs({ left: wide ? 160 : 140, top: wide ? 480 : 510, fontFamily: LABEL, fontWeight: 800, fontSize: wide ? 58 : 52, lineHeight: 1, color: C.cream, whiteSpace: 'nowrap' })}>
          The full story is free
        </div>
        <LinkText link={link} size={ls} colour={C.cream} tail={seriesColour} style={{ left: wide ? 160 : 140, top: wide ? 570 : 590 }} />
        <div style={abs({ left: wide ? 160 : 140, top: (wide ? 570 : 590) + ls + 18, width: linkW, height: 16, background: C.mint })} />
      </div>
      <div style={abs(wide ? { left: 1040, top: -80, width: 1000, height: H + 160, background: nextColour, transform: rightT }
        : { left: -60, top: 960, width: W + 120, height: 1040, background: nextColour, transform: rightT })}>
        <Pill size={wide ? 38 : 36} height={wide ? 72 : 70} bg={C.ink} fg={nextColour} style={{ left: wide ? 80 : 140, top: wide ? 460 : 50 }}>Next round</Pill>
        <div style={abs({ left: wide ? 80 : 140, top: wide ? 570 : 160, fontFamily: DISPLAY, fontSize: ds, lineHeight: 1, color: C.ink, whiteSpace: 'nowrap' })}>{nextDay}</div>
        <div style={abs({ left: wide ? 84 : 144, top: (wide ? 570 : 160) + ds + 24, fontFamily: LABEL, fontWeight: 800, fontSize: 58, lineHeight: 1, color: C.ink, whiteSpace: 'nowrap' })}>{nextSeries}</div>
      </div>
    </>
  )
}

function Close({ f, W, H, wide, link, brand, seriesColour }: SceneProps) {
  // One calm card: the masthead image, centred and large, the link beneath.
  // It eases in (scale 0.96 to 1 under the crossfade) and is then still.
  const k = cubicIO((f - T.close) / T.closeDur)
  const scale = 0.96 + 0.04 * k
  const mw = wide ? 1150 : 900
  const mh = (mw * MASTHEAD_PX[1]) / MASTHEAD_PX[0]
  const ls = wide ? 64 : 60
  const gap = wide ? 64 : 70
  const block = mh + gap + ls
  const top = (wide ? H / 2 : 865) - block / 2
  const lw = textWidth(link, ls)
  return (
    <>
      <Field left={-60} top={-80} width={W + 120} height={H + 160} bg={C.ink} />
      <div style={abs({ left: 0, top: 0, width: W, height: H, transform: `scale(${scale})`, transformOrigin: `50% ${top + block / 2}px` })}>
        <BrandImage src={brand.masthead} px={MASTHEAD_PX} height={mh} alt="Make your mind up" style={{ left: (W - mw) / 2, top }} />
        <LinkText link={link} size={ls} colour={C.cream} tail={seriesColour} style={{ left: (W - lw) / 2, top: top + mh + gap }} />
      </div>
    </>
  )
}
