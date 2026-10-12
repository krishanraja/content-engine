import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import type { StoryRightPlayer, StoryStandoffProps } from './props'
import {
  abs, BrandStrip, breakLines, C, clamp, DISPLAY, Field, fitSize, jolt, Logo, Pill, quadIO, shade, cubicIO, settle, slam, slideIn, Stamp, stampBox, textWidth, useStoryFonts,
} from './standoff-kit'

/** The story intro: the stand-off (docs/plans/2026-10-12-story-io,
 *  standoff-spec.md, with the judges' grafts in its README). The players
 *  square up in two flat corners, one changes state (the flip is the
 *  biggest thing on screen, on its own beat), then the question lands.
 *  Every value is a pure function of the frame and the props. */
export const STORY_INTRO_FRAMES = 90

// The clock, in frames at 30 fps (the same for both shapes).
const T = {
  card: (i: number) => 4 + 4 * i,
  vs: 18,
  hop: [21, 29] as const,
  flip: 30, // the big stamp: held until the question card covers it
  qIn: 46, // the question card slides in over the fight, eased, 10 frames
  qDur: 10,
  word: (i: number) => 54 + 4 * i,
}

interface Sizes { cw: number; ch: number; lw: number; lh: number; pad: number; nf: number; sf: number; so: number; gap: number }

function FighterCard({ p, S, x, y, rot, scale, shadow, z, stamp }: {
  p: StoryRightPlayer; S: Sizes; x: number; y: number; rot: number; scale: number; shadow: string; z: number
  stamp: { text: string; bg: string; rot: number; scale: number; opacity: number } | null
}) {
  const nameX = S.pad * 2 + S.lw
  const nameMax = S.cw - nameX - S.pad
  const nf = Math.min(S.nf, Math.floor(nameMax / (textWidth(p.name, 100) / 100)))
  return (
    <div style={abs({ left: x, top: y, width: S.cw, height: S.ch, background: C.ink, borderRadius: 18, zIndex: z,
      transform: `rotate(${rot}deg) scale(${scale})`, boxShadow: `12px 12px 0 ${shadow}` })}>
      <Logo src={p.logo} alt={`${p.name} logo`} style={{ left: S.pad, top: (S.ch - S.lh) / 2, width: S.lw, height: S.lh }} />
      <div style={abs({ left: nameX, top: S.ch / 2 - nf * 0.52, fontFamily: DISPLAY, fontSize: nf, lineHeight: 1, color: C.cream, whiteSpace: 'nowrap' })}>
        {p.name}
      </div>
      {stamp && (
        <Stamp text={stamp.text} size={S.sf} bg={stamp.bg}
          style={{ right: -S.so, top: -S.so * 1.6, transform: `rotate(${stamp.rot}deg) scale(${stamp.scale})`, transformOrigin: '50% 50%', opacity: stamp.opacity }} />
      )}
    </div>
  )
}

export function StoryIntroStandoff(props: StoryStandoffProps) {
  const ready = useStoryFonts()
  const f = useCurrentFrame()
  const { width: W, height: H } = useVideoConfig()
  if (!ready) return <AbsoluteFill style={{ background: C.ink }} />
  const wide = props.shape === '16x9'
  // No hard cut: the question card slides over the fight, and the brand
  // strip stays put above both.
  const slide = cubicIO((f - T.qIn) / T.qDur)
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      {f < T.qIn + T.qDur && <Fight {...props} f={f} W={W} H={H} wide={wide} />}
      {f >= T.qIn && (
        <AbsoluteFill style={{ transform: `translateX(${(1 - slide) * (W + 40)}px)`, boxShadow: `-16px 0 0 ${C.ink}` }}>
          <Question {...props} f={f} W={W} H={H} wide={wide} />
        </AbsoluteFill>
      )}
      <BrandStrip top={wide ? 0 : 250} width={W} height={wide ? 104 : 100} seriesName={props.seriesName} seriesColour={props.seriesColour}
        pad={wide ? 70 : 60} wordmark={props.brand.wordmark} />
    </AbsoluteFill>
  )
}

type SceneProps = StoryStandoffProps & { f: number; W: number; H: number; wide: boolean }

function Fight({ f, W, H, wide, left, right, seriesColour, seriesName }: SceneProps) {
  const n = right.length
  const S: Sizes = wide
    ? { cw: 740, ch: n <= 3 ? 200 : 160, lw: 190, lh: 124, pad: 34, nf: 66, sf: 34, so: 18, gap: 28 }
    : { cw: 820, ch: n <= 3 ? 150 : 110, lw: 160, lh: 96, pad: 28, nf: 58, sf: 28, so: 14, gap: 18 }
  const hoppers = right.filter((p) => p.switchesSides)
  const stayers = right.filter((p) => !p.switchesSides)
  const flipper = right.find((p) => p.stampAfter)

  // Positions before (a) and after (b) the twist: [left, top].
  const pos = new Map<StoryRightPlayer, { a: [number, number]; b: [number, number] }>()
  const stack = (list: StoryRightPlayer[], x: number, top: number) => list.map((_, i): [number, number] => [x, top + i * (S.ch + S.gap)])
  const span = (k: number) => k * S.ch + (k - 1) * S.gap
  let heroA: [number, number], heroB: [number, number], vsC: [number, number]
  const heroBox: [number, number] = wide ? [640, 170] : [700, 180]
  if (wide) {
    const x = 1480 - S.cw / 2, cy = 630
    const a = stack(right, x, cy - span(n) / 2)
    const b = stack(stayers, x, cy - span(stayers.length) / 2)
    const h = stack(hoppers, 70, 430)
    right.forEach((p, i) => pos.set(p, { a: a[i]!, b: p.switchesSides ? h[hoppers.indexOf(p)]! : b[stayers.indexOf(p)]! }))
    heroA = [480, 630]; heroB = [480, hoppers.length ? 300 : 630]; vsC = [960, 630]
  } else {
    const x = 540 - S.cw / 2, top0 = 970, region = 486
    const a = stack(right, x, top0 + (region - span(n)) / 2)
    // After the twist the stayers sit low, leaving the seam for the flip.
    const b = stack(stayers, x, top0 + region - span(stayers.length))
    const h = stack(hoppers, x, 630)
    right.forEach((p, i) => pos.set(p, { a: a[i]!, b: p.switchesSides ? h[hoppers.indexOf(p)]! : b[stayers.indexOf(p)]! }))
    heroA = [540, 600]; heroB = [540, hoppers.length ? 530 : 600]; vsC = [540, 900]
  }

  const hop = clamp((f - T.hop[0]) / (T.hop[1] - T.hop[0]))
  const e = quadIO(hop)
  const hits = [...right.map((_, i) => T.card(i)), T.vs, ...(hoppers.length ? [T.hop[1]] : []), T.flip]
  const y0 = jolt(f, hits)
  const heroScale = settle(f, 0, 1.15, 6)?.scale ?? 1
  const hx = heroA[0] + (heroB[0] - heroA[0]) * e, hy = heroA[1] + (heroB[1] - heroA[1]) * e
  const vsD = wide ? 190 : 170
  const vsS = settle(f, T.vs, 1.3, 5)
  const seamCorner = (x: number, y: number) => (wide ? (x + S.cw / 2 < 960 ? C.mint : seriesColour) : (y + S.ch / 2 < 900 ? C.mint : seriesColour))

  // The flip: one giant stamp over the card that changed, on its own beat.
  let big: React.ReactNode = null
  if (flipper && flipper.stampAfter && f >= T.flip) {
    const p = pos.get(flipper)!
    const [bx, by] = flipper.switchesSides ? p.b : p.a
    let size = wide ? 200 : 190
    size = Math.min(size, Math.floor(size * (W * 0.7) / stampBox(flipper.stampAfter, size)[0]))
    const [w, h] = stampBox(flipper.stampAfter, size)
    // Just under the card that changed, overlapping its edge like a stamp hit.
    const cx = bx + S.cw / 2 + (wide ? 30 : 0)
    const cy = Math.min(by + S.ch + h / 2 - (wide ? 60 : 30), wide ? H - h / 2 - 80 : 1440 - h / 2)
    const st = settle(f, T.flip, 1.6, 6, 3)!
    big = (
      <Stamp text={flipper.stampAfter} size={size} bg={C.mint}
        style={{ left: clamp(cx - w / 2, 30, W - w - 30), top: cy - h / 2, zIndex: 10, transform: `rotate(-8deg) scale(${st.scale})`, opacity: st.opacity,
          boxShadow: `16px 16px 0 ${shade(C.mint, 0.45)}` }} />
    )
  }

  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      <div style={abs({ left: 0, top: 0, width: W, height: H, transform: `translateY(${y0}px)` })}>
        {wide ? (
          <>
            <Field left={-60} top={-80} width={1020} height={H + 160} bg={C.mint} />
            <Field left={960} top={-80} width={1020} height={H + 160} bg={seriesColour} />
          </>
        ) : (
          <>
            <Field left={-60} top={-80} width={W + 120} height={980} bg={C.mint} />
            <Field left={-60} top={900} width={W + 120} height={1100} bg={seriesColour} />
          </>
        )}
        <Pill size={wide ? 38 : 34} height={wide ? 68 : 62} bg={C.ink} fg={C.cream} style={wide ? { left: 70, top: 136 } : { left: 90, top: 372 }}>
          {left.role}
        </Pill>
        <Logo src={left.logo} alt={`${left.name} logo`} ink={left.inkLogo ?? true}
          style={{ left: hx - heroBox[0] / 2, top: hy - heroBox[1] / 2, width: heroBox[0], height: heroBox[1], transform: `scale(${heroScale})` }} />
        {right.map((p, i) => {
          const s = slideIn(f, T.card(i))
          if (s === null) return null
          const ps = pos.get(p)!
          let x = ps.a[0] + (1 - s) * (W - ps.a[0] + 40), y = ps.a[1], rot = 0, z = 2
          const isHop = !!p.switchesSides
          if (hoppers.length || stayers.length !== n) {
            x += (ps.b[0] - ps.a[0]) * e
            y += (ps.b[1] - ps.a[1]) * e
          }
          if (isHop && hop > 0 && hop < 1) {
            y -= Math.sin(Math.PI * hop) * (wide ? 90 : 120)
            rot = -7 * Math.sin(Math.PI * hop)
            z = 6
          }
          const landed = isHop && hop >= 1 ? (settle(f, T.hop[1], 1.1, 5)?.scale ?? 1) : 1
          const flipped = !!p.stampAfter && f >= T.flip
          const fl = settle(f, T.flip, 1.3, 5)
          const stamp = !flipped
            ? { text: p.stampBefore, bg: C.coral, rot: 6, scale: 1, opacity: 1 }
            : p === flipper
              ? (f < T.flip + 3 ? { text: p.stampBefore, bg: C.coral, rot: 6, scale: 1, opacity: 1 - (f - T.flip + 1) / 3 } : null)
              : { text: p.stampAfter!, bg: C.mint, rot: -7, scale: fl?.scale ?? 1, opacity: fl?.opacity ?? 1 }
          return (
            <FighterCard key={`${p.name}-${i}`} p={p} S={S} x={x} y={y} rot={rot} scale={landed} z={z}
              shadow={shade(isHop && hop >= 1 ? C.mint : seamCorner(x, y))} stamp={stamp} />
          )
        })}
        {vsS !== null && (
          <div style={abs({ left: vsC[0] - vsD / 2, top: vsC[1] - vsD / 2, width: vsD, height: vsD, borderRadius: '50%', background: C.ink, color: C.cream,
            border: `8px solid ${C.cream}`, boxSizing: 'border-box', fontFamily: DISPLAY, fontSize: vsD * 0.4, lineHeight: `${vsD - 16}px`, textAlign: 'center',
            zIndex: 4, opacity: vsS.opacity, transform: `scale(${vsS.scale}) rotate(-8deg)` })}>vs</div>
        )}
        {big}
      </div>
    </AbsoluteFill>
  )
}

function Question({ f, W, H, wide, question, questionEmphasis, seriesColour, seriesName }: SceneProps) {
  const lines = breakLines(question, wide ? 14 : 9, questionEmphasis)
  const qX = wide ? 120 : 90
  const top = wide ? 190 : 400
  const size = fitSize(lines, wide ? 210 : 165, W - 2 * qX, 'display', 0.3)
  const lineH = size * (wide ? 1.1 : 1.06)
  const lastW = textWidth(lines[lines.length - 1] ?? '', size) + size * 0.3
  const qAt = T.word(lines.length - 1) + 6

  // The "?" stamp: it slams in after the last word group and keeps wobbling.
  let D = wide ? 330 : 300
  let sx: number, sy: number
  if (wide) {
    sx = qX + lastW + 60
    sy = top + (lines.length - 1) * lineH + size * 0.55 - D / 2
    if (sx + D > W - 90) { sx = W - 110 - D; sy = H - 70 - D }
  } else {
    sy = top + lines.length * lineH + 40
    D = Math.min(D, 1440 - sy)
    sx = W - 90 - D
  }
  const qs = settle(f, qAt, 1.3, 6)
  const wob = qs === null ? 0 : 9 * Math.sin(((f - qAt) * 2 * Math.PI) / 14)
  const pulse = qs === null ? 1 : 1 + 0.035 * Math.sin(((f - qAt) * 2 * Math.PI) / 7 + 1)

  return (
    <AbsoluteFill style={{ background: seriesColour, overflow: 'hidden' }}>
      <div style={abs({ left: 0, top: 0, width: W, height: H })}>
        <Field left={-60} top={-80} width={W + 120} height={H + 160} bg={seriesColour} />
        {lines.map((line, i) => {
          const s = settle(f, T.word(i), 1.12, 5)
          if (s === null) return null
          const em = questionEmphasis && line.includes(questionEmphasis) ? questionEmphasis : null
          const parts = em ? line.split(em) : [line]
          return (
            <div key={i} style={abs({ left: qX, top: top + i * lineH, fontFamily: DISPLAY, fontSize: size, lineHeight: 0.98, whiteSpace: 'pre',
              letterSpacing: '-0.015em', color: C.ink, opacity: s.opacity, transform: `scale(${s.scale})`, transformOrigin: '0 80%' })}>
              {em ? (
                <>
                  {parts[0]}
                  <span style={{ background: C.ink, color: seriesColour, padding: '0 0.14em', borderRadius: '0.08em' }}>{em}</span>
                  {parts.slice(1).join(em)}
                </>
              ) : line}
            </div>
          )
        })}
        {qs !== null && (
          <div style={abs({ left: sx, top: sy, width: D, height: D, borderRadius: '50%', background: C.mint, border: `12px solid ${C.ink}`, boxSizing: 'border-box',
            boxShadow: `14px 14px 0 ${shade(seriesColour)}`, color: C.ink, fontFamily: DISPLAY, fontSize: D * 0.66, lineHeight: `${D - 24}px`, textAlign: 'center',
            opacity: qs.opacity, transform: `rotate(${wob}deg) scale(${qs.scale * pulse})` })}>?</div>
        )}
      </div>
    </AbsoluteFill>
  )
}
