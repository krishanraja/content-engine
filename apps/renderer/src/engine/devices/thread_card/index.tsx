import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { MOTION, progress, stateAt } from '../../clock'
import { parted, pennant, twisted, weave } from '../../kit/threadPath'
import type { EngineEvent, EngineObject } from '../../props'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'

export function threadState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const { fired } = stateAt(events, object.obj, frame)
  const visibility = fired.findLast(e => e.verb === 'enter' || e.verb === 'exit')
  const enter = fired.findLast(e => e.verb === 'enter')
  const since = (event: EngineEvent) => stateAt([event], object.obj, frame).sinceFrames
  return { params, visible: frame >= object.fromFrame && frame < object.toFrame && !!enter &&
    (visibility?.verb !== 'exit' || since(visibility) < MOTION.exitFrames),
    opacity: visibility?.verb === 'exit' ? 1 - progress(since(visibility), MOTION.exitFrames) : 1,
    reveal: (index: number) => enter ? progress(since(enter) - index * MOTION.staggerFrames, MOTION.slideFrames) : 0,
    mark: (thread: string, station: string) => {
      const event = fired.findLast(e => e.verb === 'mark' && e.toState === `${thread}:${station}` && (!enter || e.atFrame >= enter.atFrame))
      return event ? progress(since(event), MOTION.dropFrames) : null
    },
    stamp: fired.findLast(e => e.verb === 'stamp')?.toState ?? null }
}

/** STAGE uses absolute canvas coordinates; it has no surrounding surface. */
export function Device({ object, events, tokens, aspect, frame }: DeviceProps) {
  const state = threadState(object, events, frame)
  if (!state.visible) return null
  const p = state.params, width = aspect === '9:16' ? 1080 : 1920, height = aspect === '9:16' ? 1920 : 1080
  const colour = p.tone === 'channel' ? tokens.channel : tokens.cream
  const bottom = Math.min(1170, height - 72)
  // Labels stay inside the right margin of their canvas: x 960 on the tall canvas (the platform strip), 96 px in from the edge when wide.
  const right = aspect === '9:16' ? 960 : width - 96, widest = aspect === '9:16' ? 888 : 560
  // Wrap at measured glyph widths, never shrink below the locked type scale.
  const label = (text: string, x: number, y: number, role: 'label' | 'name' | 'tally' = 'label') => {
    const size = role === 'name' ? 34 : role === 'tally' ? 46 : 30
    const face = role === 'name' ? 'archivoHeavy' : role === 'tally' ? 'anton' : 'mono'
    const tracking = role === 'label' ? 0.14 : 0
    const content = role === 'label' ? text.toUpperCase() : text
    const stretch = role === 'name' ? 1.12 : 1
    const measured = (value: string) => textWidth(face, value, size, tracking) * stretch
    const available = Math.min(widest, Math.max(420, right - x))
    const left = Math.max(72, Math.min(x, right - Math.min(available, measured(content))))
    const lines: string[] = ['']
    for (const char of content) {
      if (char === '\n' || measured(lines.at(-1)! + char) > available) lines.push(char === '\n' ? '' : char)
      else lines[lines.length - 1] += char
    }
    const top = Math.max(150 + size, Math.min(y, bottom - (lines.length - 1) * size * 1.25 - 8))
    return <text x={left} y={top} fill={tokens.cream} fontFamily={role === 'name' ? HOUSE_FONTS.structure : role === 'tally' ? HOUSE_FONTS.display : HOUSE_FONTS.data}
      fontSize={size} fontWeight={role === 'name' ? 900 : 400} fontStretch={role === 'name' ? '112%' : undefined} letterSpacing={`${tracking}em`}>
      {lines.map((line, i) => <tspan key={i} x={left} dy={i ? size * 1.25 : 0}>{line}</tspan>)}
    </text>
  }
  const dot = (x: number, y: number, radius = 15) => <circle cx={x} cy={y} r={radius} fill={tokens.ink} stroke={tokens.cream} strokeWidth={4} />
  return <svg data-device="thread_card" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'hidden', opacity: state.opacity }}>
    <g opacity={state.reveal(0)}>
      <path data-axis="true" d={`M ${p.axis.x0} ${p.axis.y} L ${p.axis.x1} ${p.axis.y}`} fill="none" stroke={colour} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - state.reveal(0)} />
      {p.stations.map(s => <g key={s.id}><path d={`M ${s.x} ${p.axis.y - 12} L ${s.x} ${p.axis.y + 12}`} stroke={colour} strokeWidth={3} />{label(s.label, s.x - textWidth('mono', s.label, 30, 0.14) / 2, p.axis.y - 32)}</g>)}
    </g>
    {p.threads.map((t, i) => {
      const stations = [...p.stations].sort((a, b) => a.x - b.x)
      const points = [{ x: p.axis.x0, y: t.y }, ...stations.map(s => ({ x: s.x, y: t.y })), p.knot ?? { x: p.axis.x1, y: t.y }]
      const paths: string[] = []
      // Split only at stations whose mark has fired; unmarked threads remain whole.
      let start = points[0]!
      for (let j = 1; j < points.length; j++) {
        const station = stations[j - 1], next = points[j]!
        const broken = station && t.marks.some(m => m.station === station.id && m.state === 'parted') && state.mark(t.id, station.id) !== null
        if (broken) {
          const end = points[j + 1]!
          const split = parted(start, { x: end.x, y: t.y }, { center: next, radius: 16, clearance: 34 })
          paths.push(split.paths[0]!)
          start = split.right
          continue
        }
        paths.push(weave(start, next, { seed: i * 101 + j }))
        start = next
      }
      const d = paths.join(' '), reveal = state.reveal(i)
      const mask = `thread-${Array.from(object.obj + ':' + t.id).map(c => c.codePointAt(0)!.toString(16)).join('-')}`
      return <g key={t.id} data-thread={t.id}>
        <defs><mask id={mask} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height} style={{ maskType: 'alpha' }}>
          <path data-reveal={t.id} d={d} fill="none" stroke={tokens.cream} strokeWidth={16} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - reveal} />
        </mask></defs>
        <g mask={`url(#${mask})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={d} stroke={tokens.ink} strokeWidth={12} />
          <path d={d} stroke={colour} strokeWidth={5} strokeDasharray={t.style === 'dashed' ? '26 15' : undefined} />
        </g>
        <g opacity={reveal}>{label(t.name, 72, t.y - 18, 'name')}
          {t.tally ? label(t.tally, 92 + textWidth('archivoHeavy', t.name, 34) * 1.12, t.y - 18, 'tally') : null}
        </g>
        {t.marks.map(m => {
          const s = stations.find(s => s.id === m.station)!, amount = state.mark(t.id, s.id)
          if (m.state === 'parted') return amount === null ? null : <g key={s.id} data-ring={t.id} opacity={reveal}>{dot(s.x, t.y, 16)}</g>
          const planted = m.state === 'planted' && amount !== null
          const flag = pennant(planted)
          return <g key={s.id} data-pennant={planted ? 'planted' : 'bare'} opacity={reveal}
            transform={`translate(${s.x} ${t.y - (planted ? 28 * (1 - amount!) : 0)}) rotate(${planted ? -12 * (1 - amount!) : 0})`}>
            <path d={flag.pole} stroke={colour} strokeWidth={4} />
            <path d={flag.flag} fill={planted ? tokens.mint : 'none'} stroke={planted ? tokens.ink : colour} strokeWidth={3} strokeDasharray={flag.dash} opacity={flag.opacity} />
          </g>
        })}
      </g>
    })}
    {p.knot ? <g opacity={state.reveal(p.threads.length - 1)}>
      {p.end ? (() => {
        const dx = p.end.x - p.knot.x, dy = p.end.y - p.knot.y, length = Math.hypot(dx, dy)
        const angle = Math.atan2(dy, dx) * 180 / Math.PI - 90
        return <g><g transform={`translate(${p.knot.x} ${p.knot.y}) rotate(${angle})`}>
          {twisted(0, 0, length).map((d, i) => <path key={i} d={d} fill="none" stroke={i ? tokens.cream : colour} strokeWidth={5} />)}
        </g>{dot(p.end.x, p.end.y)}{p.end.label ? label(p.end.label, p.end.x + 28, p.end.y + 60) : null}</g>
      })() : null}
      {dot(p.knot.x, p.knot.y)}{p.knot.label ? label(p.knot.label, p.knot.x + 28, p.knot.y - 24) : null}
    </g> : null}
    {object.dataset ? label(object.dataset.producerLabel, 72, bottom - 8) : null}
  </svg>
}
