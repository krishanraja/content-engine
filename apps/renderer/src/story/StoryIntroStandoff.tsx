import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { fitError, fitLine, fitText } from './fit'
import { normalisePlayer, storyTitle, type StoryPlayer, type StoryStandoffProps } from './props'
import {
  abs, Badge, badgeLayout, Logo, logoRowWidth, badgeMetrics, badgeNaturalWidth, C, clamp, cubicIO, Field, Header, headerH, measureWith, quadIO, SAFE, SafeProbe, settle, shade,
  Txt, useStoryFonts, type BadgeLayout, type BadgeMetrics, type Shape,
} from './standoff-kit'

/** The story intro: the stand-off (docs/plans/2026-10-12-story-io). The
 *  players square up in two flat corners, each on the same badge (its logos,
 *  its name, its tag); one may change sides or tag; then the series colour
 *  takes the screen and the title builds line by line.
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
  wipe: [number, number]
  line: (i: number) => number
}

function timeline(n: number, twist: boolean, hop: boolean): Timeline {
  const right = (i: number) => 16 + 4 * i
  const built = right(n - 1) + 10
  const hopW: [number, number] | null = hop ? [built + 6, built + 16] : null
  const flip = twist ? (hopW ? hopW[1] : built + 6) : null
  const fightEnd = flip !== null ? flip + 16 : built + 22
  return { left: 3, vs: 12, right, hop: hopW, flip, wipe: [fightEnd, fightEnd + 8], line: (i) => fightEnd + 10 + 3 * i }
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
  const m = badgeMetrics(mode, shape)
  const all = [left, ...right]
  const hasTag = all.some((p) => p.tag || p.tagAfter)
  const gap = mode === 'stack' ? 0 : wide ? 26 : 18
  const top = S.y0 + headerH(shape) + 36
  const vsD = wide ? 150 : mode === 'stack' ? 132 : 112

  // Every badge the same width: the widest one's, within its region.
  const regionW = wide ? (S.x1 - S.x0 - vsD - 2 * 40) / 2 : S.x1 - S.x0
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
  const title = titleBlock(props, P.shape)
  const [w0, w1] = P.t.wipe
  const wipe = cubicIO((f - w0) / (w1 - w0))
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      {f < w1 && <Fight P={P} f={f} W={W} H={H} seriesColour={props.seriesColour} />}
      {/* The series corner takes the screen: a flat field, no type moving. */}
      {f >= w0 && (P.wide
        ? <Field left={P.seam - wipe * (P.seam + 80)} top={-80} width={W + 160} height={H + 160} bg={props.seriesColour} z={20} />
        : <Field left={-80} top={P.seam - wipe * (P.seam + 80)} width={W + 160} height={H + 160} bg={props.seriesColour} z={20} />)}
      {f >= w1 && <TitleCard f={f} P={P} title={title} seriesColour={props.seriesColour} />}
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

interface Tile { name: string; src: string; aspect: number; x: number; y: number; s: number; label: number }
interface TitleBlock { lines: string[]; size: number; emphasis: string | null; x: number; y: number; lineH: number; q: { x: number; y: number; d: number } | null; tiles: Tile[] }

const TITLE = {
  '16x9': { maxSize: 196, minSize: 96, maxLines: 3, lineHeight: 0.98, q: 210 },
  '9x16': { maxSize: 168, minSize: 84, maxLines: 5, lineHeight: 0.98, q: 200 },
} as const

/** The title, set as large as fits (Anton, upper case), shrinking to a floor;
 *  below the floor the render stops (STORY_FIT), so nothing ever runs off. */
function titleBlock(props: StoryStandoffProps, shape: Shape): TitleBlock {
  const S = SAFE[shape]
  const spec = TITLE[shape]
  const { text, emphasis } = storyTitle(props)
  if (!text) throw new Error('STORY_FIT: the stand-off has no title (cover-facts.json video_title)')
  const upper = text.toUpperCase()
  const em = emphasis ? emphasis.toUpperCase() : null
  const isQ = /\?\s*$/.test(text)
  const d = isQ ? spec.q : 0
  const top = S.y0 + headerH(shape) + 50
  // The line-up: one ink tile per name, its real logo, its name beneath.
  const cast = (props.cast ?? []).slice(0, 6)
  const gap = shape === '16x9' ? 34 : 30
  const s = Math.min(shape === '16x9' ? 156 : 200, Math.floor((S.x1 - S.x0 - (cast.length - 1) * gap) / Math.max(1, cast.length)))
  const labelGap = 14, label = shape === '16x9' ? 28 : 34
  const rowH = cast.length ? s + labelGap + label * 1.2 : 0
  const rowY = S.y1 - rowH - 8
  const tiles: Tile[] = cast.map((c, i) => {
    const ref = typeof c.logo === 'string' ? { src: c.logo, aspect: 1 } : c.logo
    const size = fitLine(c.name, measureWith('mono'), s + gap - 6, label, 16)
    if (size === null) throw fitError('line-up name', c.name, shape, { maxWidth: s + gap - 6 }, 16, 'Shorten the name in thumbs.strip.')
    return { name: c.name, src: ref.src, aspect: ref.aspect, x: S.x0 + i * (s + gap), y: rowY, s, label: size }
  })
  if (cast.length && cast.length * s + (cast.length - 1) * gap > S.x1 - S.x0 - (isQ && shape === '16x9' ? d + 40 : 0)) {
    throw fitError('line-up', cast.map((c) => c.name).join(', '), shape, { maxWidth: S.x1 - S.x0 }, s, 'Use fewer names in the line-up.')
  }
  const tallQ = isQ && shape === '9x16'
  const bottom = (cast.length ? rowY - 60 : S.y1) - (tallQ || (isQ && !cast.length) ? d + 40 : 0)
  // A title with an ink slab gets more room between lines, so the slab never
  // touches the line above or below.
  const pitch = em ? spec.lineHeight + 0.14 : spec.lineHeight
  const box = { maxWidth: S.x1 - S.x0, maxHeight: bottom - top, lineHeight: pitch, maxSize: spec.maxSize, minSize: spec.minSize, maxLines: spec.maxLines, keepPadEm: 0.3 }
  const fit = fitText(upper, measureWith('display'), box, em)
  if (!fit) throw fitError('video title', text, shape, box, spec.minSize, 'Shorten video_title in the plan\'s cover-facts.json.')
  const lineH = fit.size * pitch
  const blockH = fit.lines.length * lineH
  const y = top + (bottom - top - blockH) / 2
  // The "?" disc (only for a question) sits in the bottom right of the safe area.
  const k = (Math.cos((4 * Math.PI) / 180) + Math.sin((4 * Math.PI) / 180)) * 1.03
  const mq = (d * (k - 1)) / 2 + 2
  const qy = cast.length ? (tallQ ? rowY - 40 - d - mq : S.y1 - d - mq) : S.y1 - d - mq
  return { lines: fit.lines, size: fit.size, emphasis: em, x: S.x0, y, lineH, q: isQ ? { x: S.x1 - d - mq, y: qy, d } : null, tiles }
}

const labelGapPx = 14

function TitleCard({ f, P, title, seriesColour }: { f: number; P: Plan; title: TitleBlock; seriesColour: string }) {
  const { lines, size, emphasis: em, x, y, lineH, q, tiles } = title
  const tileAt = (i: number) => P.t.line(lines.length - 1) + 5 + 3 * i
  const qAt = tiles.length ? tileAt(tiles.length - 1) + 4 : P.t.line(lines.length - 1) + 6
  const qs = q ? settle(f, qAt, 0.85, 6) : null
  const wob = qs === null ? 0 : 4 * Math.sin(((f - qAt) * 2 * Math.PI) / 16)
  const pulse = qs === null ? 1 : 1 + 0.02 * Math.sin(((f - qAt) * 2 * Math.PI) / 8 + 1)
  return (
    <AbsoluteFill style={{ zIndex: 30 }}>
      <Field left={-80} top={-80} width={4000} height={4000} bg={seriesColour} />
      {lines.map((line, i) => {
        const s = settle(f, P.t.line(i), 0.95, 6, 4)
        if (s === null) return null
        const has = em && line.includes(em)
        const parts = has ? line.split(em!) : [line]
        return (
          <Txt key={i} id={`title-${i}`} group={`title-${i}`} face="display" size={size} color={C.ink} lineHeight={1}
            style={{ left: x, top: y + i * lineH, opacity: s.opacity, transform: `scale(${s.scale})`, transformOrigin: '0 60%' }}>
            {has ? (
              <>
                {parts[0]}
                <span style={{ display: 'inline-block', lineHeight: 0.86, background: C.ink, color: seriesColour, padding: '0.06em 0.15em 0.02em', borderRadius: '0.06em' }}>{em}</span>
                {parts.slice(1).join(em!)}
              </>
            ) : line}
          </Txt>
        )
      })}
      {tiles.map((tl, i) => {
        const k = settle(f, tileAt(i), 0.9, 6, 4)
        if (!k) return null
        // A wide wordmark (Google, Meta) gets most of the tile's width; a square mark sits a little smaller.
        const lw = tl.s * (tl.aspect >= 2 ? 0.84 : 0.62)
        const [bw, bh] = tl.aspect >= 1 ? [lw, lw / tl.aspect] : [lw * tl.aspect, lw]
        return (
          <div key={i} style={abs({ left: tl.x, top: tl.y, width: tl.s, height: tl.s + 60, opacity: k.opacity, transform: `scale(${k.scale})`, transformOrigin: '50% 40%' })}>
            <div data-safe="box" data-id={`cast-${i}`} data-group={`cast-${i}`}
              style={abs({ left: 0, top: 0, width: tl.s, height: tl.s, background: C.ink, borderRadius: 18, boxShadow: `8px 8px 0 ${shade(seriesColour)}` })}>
              <Logo id={`cast-${i}-logo`} group={`cast-${i}`} src={tl.src} alt={`${tl.name} logo`}
                style={{ left: (tl.s - bw) / 2, top: (tl.s - bh) / 2, width: bw, height: bh }} />
            </div>
            <Txt id={`cast-${i}-name`} group={`cast-${i}`} face="mono" size={tl.label} color={C.ink}
              style={{ left: 0, top: tl.s + labelGapPx, width: tl.s, textAlign: 'center' }}>{tl.name}</Txt>
          </div>
        )
      })}
      {q && qs !== null && (
        <div data-safe="box" data-id="title-q" data-group="title-q"
          style={abs({ left: q.x, top: q.y, width: q.d, height: q.d, borderRadius: '50%', background: C.mint, border: `10px solid ${C.ink}`, boxSizing: 'border-box',
            color: C.ink, opacity: qs.opacity, transform: `rotate(${wob}deg) scale(${qs.scale * pulse})` })}>
          <Txt id="title-q-mark" group="title-q" face="display" size={q.d * 0.62} color={C.ink}
            style={{ left: 0, top: 0, width: q.d - 20, height: q.d - 20, lineHeight: `${q.d - 20}px`, textAlign: 'center' }}>?</Txt>
        </div>
      )}
    </AbsoluteFill>
  )
}
