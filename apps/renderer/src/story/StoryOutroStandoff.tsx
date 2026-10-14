import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { fitError, fitLine, fitText, YES_NO } from './fit'
import type { StoryStandoffProps } from './props'
import {
  abs, BrandImage, C, cubicIO, cubicOut, Field, Header, headerH, MASTHEAD_PX, measureWith, Pill, SAFE, SafeProbe, SERIES_COLOURS, settle, shade,
  textWidth, Txt, useStoryFonts, type Shape,
} from './standoff-kit'

/** The story outro: the stand-off's last round (docs/plans/2026-10-12-story-io).
 *  Your corner (the comment question, yes or no), where to read it and the
 *  next round, then one calm closing card: the brand's own masthead image on
 *  ink with the link beneath, settling in and then holding still for the
 *  last 2 s. The link is on screen from the first frame to the last.
 *
 *  Revised 2026-10-13: the brand's faces by role (Anton headlines, Archivo
 *  text, IBM Plex Mono labels), everything inside the safe area, and panels
 *  that arrive empty with their words building in place once they land.
 *  Every value is a pure function of the frame and the props. */
export const STORY_OUTRO_FRAMES = 180

const T = {
  pill: 2, line: (i: number) => 5 + 3 * i,
  split: 60, splitDur: 10, // the two panels slide in over the comment card; their words follow
  close: 104, closeDur: 14, // the closing card crossfades in, then holds still from frame 118
}

type SceneProps = StoryStandoffProps & { f: number; W: number; H: number; wide: boolean; shape: Shape; nextDay: string; nextSeries: string; nextColour: string }

/** makeyourmindup.ai, its ending in the series colour (Archivo, the link is interface text). */
function LinkText({ id, group, link, size, colour, tail, style }: { id: string; group: string; link: string; size: number; colour: string; tail: string; style: React.CSSProperties }) {
  const dot = link.lastIndexOf('.')
  const head = dot > 0 ? link.slice(0, dot) : link
  const end = dot > 0 ? link.slice(dot) : ''
  return (
    <Txt id={id} group={group} face="ui" size={size} color={colour} lineHeight={1.15} style={style}>
      {head}<span style={{ color: tail }}>{end}</span>
    </Txt>
  )
}

export function StoryOutroStandoff(props: StoryStandoffProps) {
  const ready = useStoryFonts()
  const f = useCurrentFrame()
  const { width: W, height: H } = useVideoConfig()
  if (!ready) return <AbsoluteFill style={{ background: C.ink }} />
  const shape = props.shape
  const wide = shape === '16x9'
  const [day, ...rest] = props.nextLabel.split(/\s+·\s+/)
  const nextSeries = rest.join(' · ')
  const nextColour = props.nextColour ?? SERIES_COLOURS[nextSeries.trim().toLowerCase()] ?? C.lilac
  const scene: SceneProps = { ...props, f, W, H, wide, shape, nextDay: day ?? props.nextLabel, nextSeries, nextColour }
  // Through ink: the next round fades out, then the closing card fades in.
  const fadeOut = 1 - cubicIO((f - T.close) / 6)
  const fadeIn = cubicIO((f - T.close - 4) / (T.closeDur - 4))
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      {f < T.split + T.splitDur && <Corner {...scene} />}
      {f >= T.split && fadeOut > 0.01 && <AbsoluteFill style={{ opacity: fadeOut }}><NextRound {...scene} /></AbsoluteFill>}
      {f >= T.close && <AbsoluteFill style={{ opacity: fadeIn }}><Close {...scene} /></AbsoluteFill>}
      <SafeProbe on={!!props.check} shape={shape} clip={`outro-${shape}`} />
    </AbsoluteFill>
  )
}

function Corner({ f, W, H, wide, shape, commentQuestion, seriesColour, seriesName, link, brand }: SceneProps) {
  const S = SAFE[shape]
  const pillH = wide ? 52 : 58, pillS = wide ? 22 : 25
  const pillY = S.y0 + headerH(shape) + 40
  const qTop = pillY + pillH + 34
  // The link bar along the bottom, on screen from the first frame.
  const barTop = wide ? 902 : 1300
  const kickerS = wide ? 36 : 38
  const linkMax = wide ? 58 : 74
  const ls = fitLine(link, measureWith('ui'), wide ? S.x1 - S.x0 - textWidth('The full story is free', kickerS, 'ui', 700) - 40 : S.x1 - S.x0, linkMax, 36) ?? 36
  const kickerY = wide ? barTop + (S.y1 - barTop - ls * 1.15) / 2 + (ls * 1.15 - kickerS) / 2 + 4 : barTop + 40
  const linkX = wide ? S.x0 + textWidth('The full story is free', kickerS, 'ui', 700) + 40 : S.x0
  const linkY = wide ? barTop + (S.y1 - barTop - ls * 1.15) / 2 : barTop + 36 + kickerS + 20
  const linkW = textWidth(link, ls, 'ui')
  const sweep = cubicOut((f - 6) / 10)
  // Yes and No: a column on the right in 16:9, a row under the question in 9:16, only for a
  // question that is answered yes or no (Krish, 2026-10-14: "Which kind of AI do you actually
  // use?" showed YES and NO). Any other question takes the whole width.
  const yesNo = YES_NO.test(commentQuestion.trim())
  const yn = !yesNo ? { w: 0, h: 0, gap: 0 } : wide ? { w: 320, h: 180, gap: 34 } : { w: 360, h: 160, gap: 56 }
  const ynTop0 = wide ? qTop : barTop - 70 - yn.h
  const box = wide
    ? { maxWidth: S.x1 - S.x0 - (yesNo ? yn.w + 120 : 0), maxHeight: barTop - 50 - qTop }
    : { maxWidth: S.x1 - S.x0, maxHeight: (yesNo ? ynTop0 : barTop) - 50 - qTop }
  const spec = { ...box, lineHeight: 1.0, maxSize: wide ? 150 : 132, minSize: wide ? 60 : 56, maxLines: 4 }
  const fit = fitText(commentQuestion.toUpperCase(), measureWith('display'), spec)
  if (!fit) throw fitError('comment question', commentQuestion, shape, spec, spec.minSize, 'Shorten the "Tell me in the comments" question in the script.')
  // The question and the vote, centred as one group between the kicker and the bar.
  const qH = fit.lines.length * fit.size
  const ynH = 2 * yn.h + yn.gap
  const qY = wide || !yesNo ? qTop + Math.max(0, (barTop - 50 - qTop - qH) / 2) : qTop + Math.max(0, (ynTop0 - 50 - qTop - qH) / 2)
  const ynTop = wide ? qTop + Math.max(0, (barTop - 50 - qTop - ynH) / 2) : ynTop0
  const ynAt = T.line(fit.lines.length - 1) + 5
  const pill = settle(f, T.pill, 0.94, 5)
  return (
    <>
      <Field left={-80} top={-80} width={W + 160} height={H + 160} bg={seriesColour} />
      <Header shape={shape} seriesName={seriesName} seriesColour={seriesColour} wordmark={brand.wordmark} />
      {pill && (
        <Pill id="comment-kicker" group="comment-kicker" text="TELL ME IN THE COMMENTS" size={pillS} height={pillH} bg={C.ink} fg={seriesColour}
          style={{ left: S.x0, top: pillY, opacity: pill.opacity, transform: `scale(${pill.scale})`, transformOrigin: '0 50%' }} />
      )}
      {fit.lines.map((line, i) => {
        const s = settle(f, T.line(i), 0.95, 6)
        return s && (
          <Txt key={i} id={`comment-${i}`} group="comment" face="display" size={fit.size} color={C.ink}
            style={{ left: S.x0, top: qY + i * fit.size, opacity: s.opacity, transform: `scale(${s.scale})`, transformOrigin: '0 60%' }}>{line}</Txt>
        )
      })}
      {yesNo && (['YES', 'NO'] as const).map((w, i) => {
        const k = settle(f, ynAt + i * 4, 0.88, 6)
        if (k === null) return null
        const b = wide
          ? { left: S.x1 - yn.w - 30, top: ynTop + i * (yn.h + yn.gap), width: yn.w, height: yn.h }
          : { left: 540 - yn.w - yn.gap / 2 + i * (yn.w + yn.gap), top: ynTop, width: yn.w, height: yn.h }
        return (
          <div key={w} data-safe="box" data-id={`vote-${w}`} data-group={`vote-${w}`}
            style={abs({ ...b, background: i ? C.coral : C.mint, border: `7px solid ${C.ink}`, boxSizing: 'border-box', borderRadius: 18,
              boxShadow: `10px 10px 0 ${shade(seriesColour)}`, opacity: k.opacity, transform: `rotate(${i ? 2.5 : -2.5}deg) scale(${k.scale})` })}>
            <Txt id={`vote-${w}-text`} group={`vote-${w}`} face="display" size={b.height * 0.56} color={C.ink}
              style={{ left: 0, top: 0, width: b.width - 14, height: b.height - 14, lineHeight: `${b.height - 14}px`, textAlign: 'center' }}>{w}</Txt>
          </div>
        )
      })}
      <div style={abs({ left: -80, top: barTop, width: W + 160, height: H - barTop + 80, background: C.ink })} />
      <Txt id="bar-kicker" group="bar" face="ui" weight={700} size={kickerS} color={C.cream} style={{ left: S.x0, top: kickerY }}>The full story is free</Txt>
      <div style={abs({ left: linkX, top: linkY + ls * 1.12, width: linkW * sweep, height: wide ? 8 : 10, background: C.mint })} />
      <LinkText id="bar-link" group="bar" link={link} size={ls} colour={C.cream} tail={seriesColour} style={{ left: linkX, top: linkY }} />
    </>
  )
}

function NextRound({ f, W, H, wide, shape, link, seriesColour, nextDay, nextSeries, nextColour }: SceneProps) {
  const S = SAFE[shape]
  const a = cubicOut((f - T.split) / T.splitDur)
  const words = (k: number) => settle(f, T.split + T.splitDur + k, 0.95, 6)
  const split = wide ? 1000 : 960
  // The ink panel: where to read it.
  const kS = wide ? 46 : 46
  const lMaxW = wide ? split - 70 - S.x0 : S.x1 - S.x0
  const ls = fitLine(link, measureWith('ui'), lMaxW / 1.06, wide ? 92 : 100, 40) ?? 40
  const lw = textWidth(link, ls, 'ui')
  const inkBlock = kS + 26 + ls * 1.15 + 30
  const inkTop = wide ? (S.y0 + S.y1) / 2 - inkBlock / 2 : (S.y0 + split - 50) / 2 - inkBlock / 2
  // The next round: the day in Anton, the series as its label.
  const nx = wide ? split + 70 : S.x0
  const nMaxW = wide ? S.x1 - nx : S.x1 - S.x0
  const day = nextDay.toUpperCase()
  const ds = fitLine(day, measureWith('display'), nMaxW, wide ? 220 : 240, 80)
  if (ds === null) throw fitError('next day', nextDay, shape, { maxWidth: nMaxW }, 80, 'Shorten nextLabel.')
  const ss = fitLine(nextSeries, measureWith('mono'), nMaxW, wide ? 46 : 50, 24) ?? 24
  const nBlock = 52 + 34 + ds + 26 + ss
  const nTop = wide ? (S.y0 + S.y1) / 2 - nBlock / 2 : (split + 50 + S.y1) / 2 - nBlock / 2
  const k = [words(0), words(3), words(6), words(9), words(12)]
  return (
    <>
      <div style={abs(wide ? { left: -80, top: -80, width: split + 80, height: H + 160, background: C.ink, transform: `translateX(${-(1 - a) * (split + 80)}px)` }
        : { left: -80, top: -80, width: W + 160, height: split + 80, background: C.ink, transform: `translateY(${-(1 - a) * (split + 80)}px)` })} />
      <div style={abs(wide ? { left: split, top: -80, width: W - split + 80, height: H + 160, background: nextColour, transform: `translateX(${(1 - a) * (W - split + 80)}px)` }
        : { left: -80, top: split, width: W + 160, height: H - split + 80, background: nextColour, transform: `translateY(${(1 - a) * (H - split + 80)}px)` })} />
      {k[0] && <Txt id="next-kicker" group="next-ink" face="ui" weight={700} size={kS} color={C.cream} style={{ left: S.x0, top: inkTop, opacity: k[0].opacity }}>The full story is free</Txt>}
      {k[1] && (
        <>
          <LinkText id="next-link" group="next-ink" link={link} size={ls} colour={C.cream} tail={seriesColour}
            style={{ left: S.x0, top: inkTop + kS + 26, opacity: k[1].opacity, transform: `scale(${k[1].scale})`, transformOrigin: '0 50%' }} />
          <div style={abs({ left: S.x0, top: inkTop + kS + 26 + ls * 1.15 + 6, width: lw, height: 12, background: C.mint, opacity: k[1].opacity })} />
        </>
      )}
      {k[2] && <Pill id="next-pill" group="next-pill" text="NEXT ROUND" size={22} height={52} bg={C.ink} fg={nextColour} style={{ left: nx, top: nTop, opacity: k[2].opacity }} />}
      {k[3] && (
        <Txt id="next-day" group="next-day" face="display" size={ds} color={C.ink}
          style={{ left: nx, top: nTop + 52 + 34, opacity: k[3].opacity, transform: `scale(${k[3].scale})`, transformOrigin: '0 60%' }}>{day}</Txt>
      )}
      {k[4] && (
        <Txt id="next-series" group="next-series" face="mono" size={ss} color={C.ink} style={{ left: nx + 4, top: nTop + 52 + 34 + ds + 26, opacity: k[4].opacity }}>{nextSeries}</Txt>
      )}
    </>
  )
}

function Close({ f, W, H, wide, shape, link, brand, seriesColour }: SceneProps) {
  // One calm card: the masthead image, centred and large, the link beneath.
  // It eases in (scale 0.97 to 1 under the crossfade) and is then still.
  const S = SAFE[shape]
  const k = cubicIO((f - T.close) / T.closeDur)
  const scale = 0.97 + 0.03 * k
  const mw = wide ? 1100 : S.x1 - S.x0 - 20
  const mh = (mw * MASTHEAD_PX[1]) / MASTHEAD_PX[0]
  const ls = wide ? 60 : 58
  const gap = wide ? 60 : 64
  const block = mh + gap + ls * 1.15
  const cy = (S.y0 + S.y1) / 2
  const top = cy - block / 2
  const lw = textWidth(link, ls, 'ui')
  void H
  return (
    <>
      <Field left={-80} top={-80} width={W + 160} height={4000} bg={C.ink} />
      <div style={abs({ left: 0, top: 0, width: W, height: '100%', transform: `scale(${scale})`, transformOrigin: `50% ${cy}px` })}>
        <BrandImage id="close-masthead" group="close-masthead" src={brand.masthead} px={MASTHEAD_PX} height={mh} alt="Make your mind up" style={{ left: (W - mw) / 2, top }} />
        <LinkText id="close-link" group="close-link" link={link} size={ls} colour={C.cream} tail={seriesColour} style={{ left: (W - lw) / 2, top: top + mh + gap }} />
      </div>
    </>
  )
}

