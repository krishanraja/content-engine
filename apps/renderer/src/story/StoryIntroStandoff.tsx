import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { fitError, fitText } from './fit'
import { normalisePlayer, storyTitle, type StoryPlayer, type StoryStandoffProps } from './props'
import {
  abs, Badge, badgeLayout, logoRowWidth, badgeMetrics, badgeNaturalWidth, C, clamp, cubicIO, Field, Header, headerH, measureWith, quadIO, SAFE, SafeProbe, settle, shade,
  Txt, useStoryFonts, type BadgeLayout, type BadgeMetrics, type Shape,
} from './standoff-kit'

/** The story intro: the stand-off (docs/plans/2026-10-12-story-io). The
 *  players square up in two flat corners, each on the same badge (its logos,
 *  its name, its tag); one may change sides or tag; the approved heading stays inside the same scene. There is no second title phase.
 *
 *  Revised 2026-10-13 on Krish's review of Wednesday: every element builds in
 *  place, in order, inside the safe area (nothing slides in from off the
 *  frame); one badge for both sides; the brand's faces by role; the title is
 *  the short video title, fitted to its area or the render fails. Every value
 *  is a pure function of the frame and the props. */
export const STORY_INTRO_FRAMES = 105

type Pt = [number, number]

interface Plan {
  wide: boolean
  shape: Shape
  left: StoryPlayer
  right: StoryPlayer[]
  m: BadgeMetrics
  hasTag: boolean
  layouts: Map<StoryPlayer, BadgeLayout>
  /** Each card's top-left before (a) and after (b) the twist. */
  pos: Map<StoryPlayer, { a: Pt; b: Pt }>
  vs: { cx: number; cy: number; d: number }
  /** Where the mint corner meets the series corner (x in 16:9, y in 9:16). */
  seam: number
  t: Timeline
}

interface Timeline {
  left: number
  vs: number
  right: (i: number) => number
  hop: [number, number] | null
  flip: number | null
}

function timeline(n: number, twist: boolean, hop: boolean): Timeline {
  const right = (i: number) => 16 + 4 * i
  const built = right(n - 1) + 10
  const hopW: [number, number] | null = hop ? [built + 6, built + 16] : null
  const flip = twist ? (hopW ? hopW[1] : built + 6) : null
  return { left: 3, vs: 12, right, hop: hopW, flip }
}

function plan(props: StoryStandoffProps): Plan {
  const shape = props.shape
  const wide = shape === '16x9'
  const S = SAFE[shape]
  const left = normalisePlayer(props.left)
  const right = props.right.map(normalisePlayer)
  const hoppers = right.filter((p) => p.switchesSides)
  const stayers = right.filter((p) => !p.switchesSides)
  const twist = right.some((p) => p.tagAfter)
  const leftCount = 1 + hoppers.length
  const mode = Math.max(leftCount, right.length) === 1 ? 'stack' : 'row'
  const m = { ...badgeMetrics(mode, shape), ...(!wide && mode === 'stack'
    ? { pad: 32, logoH: 120, gap1: 22, gap2: 16, nameMax: 76, tagH: 52, tagSize: 28 }
    : {}) }
  const all = [left, ...right]
  const hasTag = all.some((p) => p.tag || p.tagAfter)
  const gap = mode === 'stack' ? 0 : wide ? 26 : 18
  const top = S.y0 + headerH(shape) + (wide ? 180 : 150)
  const vsD = wide ? 150 : mode === 'stack' ? 132 : 112

  // Every badge the same width: the widest one's, within its region.
  const regionW = wide ? (S.x1 - S.x0 - vsD - 2 * 40) / 2 : S.x1 - S.x0
  // One artwork height for the whole matchup, constrained by its widest
  // wordmark. Shrink both marks together rather than just the wider one.
  const logoSpace = regionW * (mode === 'stack' ? 1 : 0.42) - 2 * m.pad
  m.logoH = Math.min(m.logoH, ...all.map((p) =>
    Math.max(16, (logoSpace - Math.max(0,p.logos.length-1)*m.logoGap) /
      (0.86*p.logos.reduce((sum,l)=>sum+l.aspect,0)))))
  const logoCol = mode === 'row' ? Math.max(...all.map((p) => logoRowWidth(p, m))) : 0
  const w = Math.max(...all.map((p) => badgeNaturalWidth(p, m, regionW, shape, logoCol)), regionW * (mode === 'stack' ? (wide ? 0.78 : 0.94) : 0.86))
  const layouts = new Map(all.map((p) => [p, badgeLayout(p, m, Math.min(w, regionW), hasTag, shape, logoCol)] as const))
  const h = Math.max(...[...layouts.values()].map((l) => l.h))
  for (const l of layouts.values()) l.h = h
  const bw = Math.min(w, regionW)
  const stack = (k: number) => k * h + Math.max(0, k - 1) * gap
  const column = (list: StoryPlayer[], x: number, cy: number) => list.map((_, i): Pt => [x, cy - stack(list.length) / 2 + i * (h + gap)])

  const pos = new Map<StoryPlayer, { a: Pt; b: Pt }>()
  let vs: Plan['vs'], seam: number
  if (wide) {
    const cy = (top + S.y1) / 2
    const need = stack(Math.max(leftCount, right.length))
    if (need > S.y1 - top) throw fitError('stand-off', all.map((p) => p.name).join(', '), shape, { maxWidth: regionW, maxHeight: S.y1 - top }, m.nameMin, 'Use fewer players.')
    const lx = 960 - vsD / 2 - 40 - bw - (regionW - bw) / 2
    const rx = 960 + vsD / 2 + 40 + (regionW - bw) / 2
    const la = column([left], lx, cy), lb = column([left, ...hoppers], lx, cy)
    const ra = column(right, rx, cy), rb = column(stayers, rx, cy)
    pos.set(left, { a: la[0]!, b: lb[0]! })
    right.forEach((p, i) => pos.set(p, { a: ra[i]!, b: p.switchesSides ? lb[1 + hoppers.indexOf(p)]! : rb[stayers.indexOf(p)]! }))
    vs = { cx: 960, cy, d: vsD }
    seam = 960
  } else {
    const band = vsD + 2 * (mode === 'stack' ? 34 : 22)
    const capL = stack(leftCount), capR = stack(right.length)
    const total = capL + band + capR
    const avail = S.y1 - top
    if (total > avail) throw fitError('stand-off', all.map((p) => p.name).join(', '), shape, { maxWidth: regionW, maxHeight: avail }, m.nameMin, 'Use fewer players.')
    const t0 = top + (avail - total) / 2
    const x = 540 - bw / 2
    const upper = t0 + capL / 2, lower = t0 + capL + band + capR / 2
    const la = column([left], x, upper), lb = column([left, ...hoppers], x, upper)
    const ra = column(right, x, lower), rb = column(stayers, x, lower)
    pos.set(left, { a: la[0]!, b: lb[0]! })
    right.forEach((p, i) => pos.set(p, { a: ra[i]!, b: p.switchesSides ? lb[1 + hoppers.indexOf(p)]! : rb[stayers.indexOf(p)]! }))
    seam = t0 + capL + band / 2
    vs = { cx: 540, cy: seam, d: vsD }
  }
  return { wide, shape, left, right, m, hasTag, layouts, pos, vs, seam, t: timeline(right.length, twist, hoppers.length > 0) }
}

export function StoryIntroStandoff(props: StoryStandoffProps) {
  const ready = useStoryFonts()
  const f = useCurrentFrame()
  const { width: W, height: H } = useVideoConfig()
  if (!ready) return <AbsoluteFill style={{ background: C.ink }} />
  const P = plan(props)
  // One opening scene. The former fight -> wipe -> title sequence read as
  // two intros (Krish, 21 Oct). The approved title now belongs to the fight.
  const S = SAFE[P.shape]
  const heading = storyTitle(props).text.split(/:\s*|\s+·\s+/).at(-1)!.toUpperCase()
  const headingFit = fitText(heading, measureWith('display'), {maxWidth:S.x1-S.x0,maxHeight:120,
    maxSize:P.wide?96:82,minSize:48,maxLines:2,lineHeight:1})
  if (headingFit === null) throw fitError('opening heading', heading, P.shape, { maxWidth: S.x1-S.x0 },48,'Shorten the opening heading.')
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      <Fight P={P} f={f} W={W} H={H} seriesColour={props.seriesColour} />
      <Txt id="opening-heading" group="opening-heading" face="display" size={headingFit.size} color={C.ink}
        style={{ left:S.x0,top:S.y0+headerH(P.shape)+32,width:S.x1-S.x0,textAlign:'center',
          opacity:settle(f,3,1,1,5)?.opacity ?? 0,zIndex:35 }}>{headingFit.lines.join('\n')}</Txt>
      <div style={abs({ left: 0, top: 0, width: W, height: H, zIndex: 40 })}>
        <Header shape={P.shape} seriesName={props.seriesName} seriesColour={props.seriesColour} wordmark={props.brand.wordmark}
          opacity={settle(f, 0, 1, 1, 4)?.opacity ?? 0} />
      </div>
      <SafeProbe on={!!props.check} shape={P.shape} clip={`intro-${P.shape}`} />
    </AbsoluteFill>
  )
}

function Fight({ P, f, W, H, seriesColour }: { P: Plan; f: number; W: number; H: number; seriesColour: string }) {
  const { t } = P
  const hop = t.hop ? clamp((f - t.hop[0]) / (t.hop[1] - t.hop[0])) : 0
  const e = quadIO(hop)
  const corner = (x: number, y: number, L: BadgeLayout) => (P.wide ? (x + L.w / 2 < P.seam ? C.mint : seriesColour) : (y + L.h / 2 < P.seam ? C.mint : seriesColour))
  const players: { p: StoryPlayer; start: number; id: string }[] = [
    { p: P.left, start: t.left, id: 'left' },
    ...P.right.map((p, i) => ({ p, start: t.right(i), id: `right-${i}` })),
  ]
  // The VS disc steps aside while a card crosses the seam.
  const vsIn = settle(f, t.vs, 0.88, 6, 4)
  const vsAway = t.hop ? 1 - clamp((f - t.hop[0] + 4) / 4) + clamp((f - t.hop[1]) / 4) : 1
  const vsOp = (vsIn?.opacity ?? 0) * clamp(vsAway)
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {P.wide ? (
        <>
          <Field left={-80} top={-80} width={P.seam + 80} height={H + 160} bg={C.mint} />
          <Field left={P.seam} top={-80} width={W - P.seam + 80} height={H + 160} bg={seriesColour} />
        </>
      ) : (
        <>
          <Field left={-80} top={-80} width={W + 160} height={P.seam + 80} bg={C.mint} />
          <Field left={-80} top={P.seam} width={W + 160} height={H - P.seam + 80} bg={seriesColour} />
        </>
      )}
      {players.map(({ p, start, id }) => {
        const L = P.layouts.get(p)!
        const ps = P.pos.get(p)!
        let x = ps.a[0] + (ps.b[0] - ps.a[0]) * e
        let y = ps.a[1] + (ps.b[1] - ps.a[1]) * e
        let op = 1
        if (p.switchesSides) {
          // It changes sides by fading out of its corner while the others
          // make room, then fading in at its new place: it never flies
          // across the other cards.
          x = hop < 0.5 ? ps.a[0] : ps.b[0]
          y = hop < 0.5 ? ps.a[1] : ps.b[1]
          op = hop <= 0 || hop >= 1 ? 1 : hop < 0.5 ? 1 - cubicIO(hop * 2) : cubicIO(hop * 2 - 1)
        }
        const z = 2
        const flipped = t.flip !== null && p.tagAfter && f >= t.flip
        const pop = flipped ? 1 + 0.5 * (1 - clamp((f - t.flip!) / 7)) : 1
        return (
          <Badge key={id} id={id} p={p} m={P.m} L={L} x={x} y={y} t={f - start} z={z} opacity={op} shadow={shade(corner(x, y, L))}
            tag={flipped ? p.tagAfter : p.tag} tagTone={flipped ? p.tagAfterTone : p.tagTone} tagPop={pop} />
        )
      })}
      {vsOp > 0.001 && (
        <div data-safe="box" data-id="vs" data-group="vs"
          style={abs({ left: P.vs.cx - P.vs.d / 2, top: P.vs.cy - P.vs.d / 2, width: P.vs.d, height: P.vs.d, borderRadius: '50%', background: C.ink,
            border: `7px solid ${C.cream}`, boxSizing: 'border-box', zIndex: 4, opacity: vsOp, transform: `scale(${vsIn?.scale ?? 1})` })}>
          <Txt id="vs-text" group="vs" face="display" size={P.vs.d * 0.42} color={C.cream}
            style={{ left: 0, top: 0, width: P.vs.d - 14, height: P.vs.d - 14, lineHeight: `${P.vs.d - 14}px`, textAlign: 'center' }}>VS</Txt>
        </div>
      )}
    </AbsoluteFill>
  )
}
