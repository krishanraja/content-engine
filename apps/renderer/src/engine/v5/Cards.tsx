import React, { type CSSProperties } from 'react'
import { Easing, Img } from 'remotion'
import brand from '../../../../../config/ve/brand-tokens.json'
import { v5Params, type V5Id, type SourceImage } from '../../../../../packages/contracts/src/why-ladder-v5'
import { HOUSE_FONTS as fonts } from '../../house/geometry'
import { ladderCaptionBand } from './HouseCaptions'
import type { DeviceComponent } from '../devices/types'

const { ink, cream, mint, climb } = brand.colours
const ease = Easing.bezier(0.22, 1, 0.36, 1)
export const enter = (frame: number, duration: number) => ease(Math.min(1, Math.max(0, frame / duration)))
const mark4 = new URL('../../../../../assets/brand/makeyourmindup/v5/v4.svg', import.meta.url).href
const mark10 = new URL('../../../../../assets/brand/makeyourmindup/v5/v10.svg', import.meta.url).href
const fill: CSSProperties = { position: 'absolute', inset: 0 }
const mono: CSSProperties = { fontFamily: fonts.data, fontSize: 32 }
const grain =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23fff' filter='url(%23n)' d='M0 0h160v160H0z'/%3E%3C/svg%3E\")"
function Photo({
  src,
  crop,
  contain = false,
  keyLine,
  color,
}: SourceImage & { contain?: boolean; keyLine?: number; color?: string }) {
  if (crop)
    return (
      <svg
        width="100%"
        height="100%"
        viewBox={[crop.left, crop.top, crop.width, crop.height].join(' ')}
        preserveAspectRatio="xMinYMid meet"
        style={{ display: 'block' }}
      >
        <svg
          x={crop.left}
          y={crop.top}
          width={crop.width}
          height={crop.height}
          viewBox={[crop.left, crop.top, crop.width, crop.height].join(' ')}
          overflow="hidden"
        >
          <foreignObject width={crop.sourceWidth} height={crop.sourceHeight}>
            <Img src={src} style={{ width: '100%', height: '100%' }} />
          </foreignObject>
          {keyLine !== undefined && (
            <line
              x1={crop.left + 4}
              x2={crop.left + 4}
              y1={crop.top + crop.height * keyLine}
              y2={crop.top + crop.height * Math.min(1, keyLine + 0.14)}
              stroke={color}
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </svg>
    )
  return <Img src={src} style={{ width: '100%', height: '100%', objectFit: contain ? 'contain' : 'cover' }} />
}
function Strength({ value }: { value: string }) {
  return (
    <span
      style={{
        ...mono,
        position: 'relative',
        padding: '5px 15px',
        display: 'inline-block',
        opacity: value === 'inferred' ? 0.7 : 1,
      }}
    >
      <svg width="100%" height="100%" style={fill}>
        <rect
          x="1"
          y="1"
          style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }}
          fill="none"
          stroke={ink}
          strokeWidth="2"
          strokeDasharray={value === 'open' ? '8 6' : undefined}
        />
      </svg>
      {value.toUpperCase()}
    </span>
  )
}
export type CardProps = {
  id: V5Id
  params: Record<string, unknown>
  format: '9:16' | '16:9'
  frame: number
  captionSpace?: boolean
  lineStarts?: number[]
}
export function Card({ id, params, format, frame, lineStarts, captionSpace }: CardProps) {
  const tall = format === '9:16'
  const [w, h, x, safeTop, b, safeHeight] = tall
    ? ([1080, 1920, 90, 269, 756, 1210] as const)
    : ([1920, 1080, 144, 81, 1632, 918] as const)
  const reserved = captionSpace ? ladderCaptionBand(format).height + 12 : 0
  const y = safeTop + reserved
  const c = safeHeight - reserved
  const area = (top: number): CSSProperties => ({ position: 'absolute', left: x, width: b, top })
  const ground = (color: string, children: React.ReactNode) => (
    <div
      style={{
        ...fill,
        background: color,
        color: color === ink ? cream : ink,
        fontFamily: fonts.dek,
        fontVariationSettings: '"SOFT" 50, "WONK" 0',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
  const lines = (words: string[], title: boolean) =>
    words.map((s, i) => (
      <div
        key={i}
        style={{
          whiteSpace: 'nowrap',
          fontFamily: fonts.display,
          lineHeight: 1.12,
          fontSize: Math.min(tall ? 114 : 130, b / (s.length * 0.59)),
          ...(title
            ? {
                opacity: enter(frame - (lineStarts?.[i] ?? i * 4), 8),
                transform: 'translateY(' + 60 * (1 - enter(frame - (lineStarts?.[i] ?? i * 4), 8)) + 'px)',
              }
            : {}),
        }}
      >
        {s}
      </div>
    ))
  switch (id) {
    case 'v5_title': {
      const p = v5Params[id].parse(params)
      return ground(
        ink,
        <>
          <Photo src={p.image.src} />
          <div style={{ ...fill, background: 'linear-gradient(transparent 15%, ' + ink + ' 87%)' }} />
          <div style={{ ...area(0), top: undefined, bottom: h - y - c }}>
            {lines(p.lines, true)}
            <Img
              src={mark4}
              style={{
                width: b * 0.32,
                marginTop: 18,
                opacity: enter(frame - (lineStarts?.at(-1) ?? 4 * (p.lines.length - 1)), 8),
              }}
            />
          </div>
        </>,
      )
    }
    case 'v5_why': {
      const p = v5Params[id].parse(params),
        split = h * 0.54
      return ground(
        ink,
        <>
          <div style={{ ...fill, height: split }}>
            <Photo {...p.image} />
          </div>
          <div
            style={{
              ...fill,
              top: split,
              background: climb[p.rung - 1],
              color: ink,
              clipPath: 'inset(' + 100 * (1 - enter(frame, 8)) + '% 0 0)',
            }}
          >
            <div style={{ ...fill, backgroundImage: grain, opacity: 0.07 }} />
            <div style={area(32)}>
              <span style={mono}>WHY {p.rung}</span>
              {lines(p.lines, false)}
            </div>
          </div>
        </>,
      )
    }
    case 'v5_evidence':
    case 'v5_challenger': {
      const p = v5Params[id].parse(params)
      const rival = id === 'v5_challenger' ? v5Params.v5_challenger.parse(params) : null
      return ground(
        cream,
        <div style={{ ...fill, transform: 'translateX(' + 120 * (1 - enter(frame, 10)) + 'px)' }}>
          <div data-evidence-kind={p.kind} style={{ ...area(y), height: c * 0.46, background: 'white' }}>
            {p.extract ? (
              <div style={{ padding: 18 }}>
                <div style={{ height: c * 0.06 }}>
                  <Photo src={p.image.src} crop={p.extract.logo} />
                </div>
                <div style={{ borderLeft: '4px solid ' + climb[p.rung - 1], marginTop: 16, paddingLeft: 12 }}>
                  {p.extract.lines.map((row, i) => {
                    const scale = Math.min(
                      (b - 52) / Math.max(...p.extract!.lines.map((line) => line.width)),
                      (c * 0.36 - 36) / p.extract!.lines.reduce((sum, line) => sum + line.height, 0),
                    )
                    return (
                      <div key={i} style={{ width: row.width * scale, height: row.height * scale }}>
                        <Photo src={p.image.src} crop={row} />
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <Photo {...p.image} contain keyLine={p.keyLine} color={climb[p.rung - 1]!} />
            )}
            {!p.extract && !p.image.crop && (
              <i
                style={{
                  position: 'absolute',
                  left: 0,
                  top: p.keyLine * 90 + '%',
                  height: '10%',
                  width: 4,
                  background: climb[p.rung - 1],
                }}
              />
            )}
          </div>
          <div style={area(y + c * 0.48)}>
            <div style={{ fontFamily: fonts.display, fontSize: tall ? 68 : 80 }}>{p.note}</div>
            <p style={mono}>{p.source}</p>
            <Strength value={p.strength} />
            {rival && (
              <div
                style={{
                  marginTop: 24,
                  borderTop: '3px ' + (rival.ending === 'parked' ? 'dashed' : 'solid'),
                  fontSize: 44,
                  opacity: enter(frame - 10, 8),
                }}
              >
                {rival.ending === 'forked' && (
                  <svg width="72" height="48" viewBox="0 0 72 48">
                    <path d="M2 24 H30 L66 4 M30 24 L66 44" fill="none" stroke={ink} strokeWidth="2" />
                  </svg>
                )}
                {rival.question}
              </div>
            )}
          </div>
        </div>,
      )
    }
    case 'v5_callout': {
      const p = v5Params[id].parse(params),
        tx = x + b * 0.15,
        ty = y + c * 0.65
      return (
        <>
          <svg width={w} height={h} style={fill}>
            <path
              d={`M${p.x * w} ${p.y * h} L${tx + b * 0.2} ${ty} H${tx}`}
              fill="none"
              stroke={cream}
              strokeWidth="2"
              pathLength="1"
              strokeDasharray="1"
              strokeDashoffset={1 - enter(frame, 6)}
            />
          </svg>
          <span
            style={{
              ...mono,
              position: 'absolute',
              left: tx,
              top: ty,
              color: cream,
              background: ink,
              border: '2px solid',
              padding: 12,
              opacity: enter(frame - 6, 4),
            }}
          >
            {p.label}
          </span>
        </>
      )
    }
    case 'v5_recap': {
      const p = v5Params[id].parse(params)
      return ground(
        cream,
        <div style={area(y)}>
          <div
            style={{
              height: c * 0.44,
              display: 'grid',
              gridTemplate: 'repeat(2,minmax(0,1fr)) / repeat(2,minmax(0,1fr))',
              gap: 6,
            }}
          >
            {p.images.map((img, i) => (
              <Photo key={i} {...img} contain />
            ))}
          </div>
          {p.rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '18px 0',
                borderTop: '2px solid',
                fontSize: 46,
                opacity: enter(frame - i * 3, 8),
              }}
            >
              <b style={{ padding: '8px 18px', background: climb[i] }}>{i + 1}</b>
              <span style={{ flex: 1 }}>{row.label}</span>
              <Strength value={row.strength} />
            </div>
          ))}
        </div>,
      )
    }
    case 'v5_landing': {
      const p = v5Params[id].parse(params)
      return ground(
        mint,
        <div style={area(y + c * 0.22)}>
          <span style={mono}>what this shows</span>
          <p style={{ fontSize: 62 }}>{p.insight}</p>
          <div
            style={{
              borderTop: '2px solid',
              paddingTop: 30,
              fontSize: 50,
              fontStyle: 'italic',
              opacity: enter(frame - 12, 8),
            }}
          >
            {p.question}
          </div>
        </div>,
      )
    }
    case 'v5_close': {
      const p = v5Params[id].parse(params)
      return ground(
        mint,
        <>
          <div style={{ ...area(y + c * 0.1), fontSize: 80 }}>{p.takeaway}</div>
          <div
            style={{
              ...fill,
              top: y + c * 0.46,
              background: ink,
              color: cream,
              clipPath: 'inset(' + 100 * (1 - enter(frame - 8, 8)) + '% 0 0)',
              padding: '40px ' + x + 'px',
              fontSize: 64,
            }}
          >
            Follow for more
            <br />
            <Img src={mark10} style={{ width: Math.min(b * 0.39, 310), marginTop: 30 }} />
          </div>
        </>,
      )
    }
    case 'v5_rail': {
      const p = v5Params[id].parse(params)
      return (
        <div
          style={{
            position: 'absolute',
            left: tall ? 18 : x,
            top: tall ? y : 20,
            display: 'flex',
            flexDirection: tall ? 'column' : 'row',
            opacity: enter(frame, 8),
          }}
        >
          {p.rows.map((row, i) => {
            const finished = i + 1 < p.current
            const border =
              (row.strength === 'inferred' ? 1 : 2) +
              'px ' +
              (row.strength === 'open' ? 'dashed' : 'solid') +
              ' ' +
              ink
            return (
              <div key={i} style={{ position: 'relative', width: tall ? 28 : b / 3, height: tall ? c / 7 : 24 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 8,
                    top: 8,
                    ...(tall ? { height: '100%', borderLeft: border } : { width: '100%', borderTop: border }),
                  }}
                />
                <i
                  style={{
                    position: 'absolute',
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: '2px solid ' + ink,
                    background: i + 1 === p.current ? climb[i] : finished ? cream : 'transparent',
                  }}
                />
                {finished && (
                  <span
                    style={{
                      ...mono,
                      position: 'absolute',
                      left: 24,
                      top: 12,
                      whiteSpace: 'nowrap',
                      fontSize: 22,
                      background: ink,
                      color: cream,
                      padding: '2px 8px',
                    }}
                  >
                    {row.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    case 'v5_source':
      return (
        <div
          style={{
            ...area(y + c * 0.82),
            ...mono,
            background: ink,
            color: cream,
            padding: 14,
            opacity: enter(frame, 8),
          }}
        >
          {v5Params[id].parse(params).source}
        </div>
      )
  }
}
export const cardDevice: DeviceComponent = ({ object, box, aspect, frame }) => {
  const width = aspect === '9:16' ? 1080 : 1920,
    height = aspect === '9:16' ? 1920 : 1080
  return (
    <div
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width,
        height,
        transformOrigin: '0 0',
        transform: `scale(${box.width / width},${box.height / height})`,
      }}
    >
      <Card
        id={object.device as V5Id}
        params={object.params}
        format={aspect}
        frame={((frame - object.fromFrame) * 25) / 30}
      />
    </div>
  )
}
