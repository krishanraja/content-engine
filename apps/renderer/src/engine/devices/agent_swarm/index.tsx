import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { swarmState } from './state'

/** Two authored stages; all foreground geometry stays above the wide face window. */
export function swarmLayout(w: number, h: number, tall: boolean) {
  return { cx: w * (tall ? .46 : .42), cy: h * (tall ? .32 : .46),
    bw: w * .84, bh: h * (tall ? .15 : .25),
    windowWidth: w * (tall ? .15 : .095), windowHeight: h * (tall ? .055 : .095) }
}
export function Device(props: DeviceProps) {
  const s = swarmState(props)
  if (!s) return null
  const { box, tokens, aspect, object } = props
  const tall = aspect === '9:16', w = box.width, h = box.height
  const { cx, cy, bh, windowWidth: ww, windowHeight: wh } = swarmLayout(w, h, tall)
  // The card expands for the opening, then makes room for the work around it.
  const spread = s.agents.length ? s.agents[0]!.arrival : 0
  const bw = w * (.84 - spread * (tall ? .2 : .37))
  const coral = tokens.channel
  const id = `swarm-${object.obj.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const zoom = 1 + .06 * s.camera
  const mx = w * (tall ? .46 : .84), my = h * (tall ? .66 : .39)
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden' }} data-token-value={s.tokens.toLocaleString('en-US')}>
    <defs>
      <radialGradient id={`${id}-light`} cx="18%" cy="12%" r="95%"><stop stopColor={tokens.ink} /><stop offset="1" stopColor={tokens.inkDeep} /></radialGradient>
      <filter id={`${id}-shadow`} x="-60%" y="-80%" width="220%" height="300%"><feGaussianBlur stdDeviation="15" /></filter>
      <filter id={`${id}-grain`}><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" seed={s.grainSeed} /><feColorMatrix type="saturate" values="0" /></filter>
    </defs>
    <g opacity={s.enter * (1 - s.out)}>
      <g transform={`translate(${w / 2} ${h / 2}) scale(${1 + .03 * s.camera}) translate(${-w / 2} ${-h / 2})`}>
        <rect width={w} height={h} fill={`url(#${id}-light)`} />
        <rect width={w} height={h} filter={`url(#${id}-grain)`} opacity={.03} />
      </g>
      <g transform={`translate(${w / 2} ${h * .4}) scale(${zoom}) translate(${-w / 2} ${-h * .4})`}>
        <g data-greyed={s.marked} style={{ filter: s.marked ? 'grayscale(1)' : undefined }}>
          {s.agents.map(a => {
            // Five above and five below: shallow depth, without occupying the face rectangle.
            const row = a.i < 5 ? -1 : 1, col = a.i - (row === 1 ? 5 : 0)
            const phase = s.ambient * 25 + a.i * 1.7
            const targetX = w * (.09 + col * (tall ? .185 : .145))
            const targetY = cy + row * (bh / 2 + wh * .85) + Math.pow(col - 2, 2) * (tall ? 12 : 9)
            const x = cx + (targetX - cx) * a.arrival + Math.sin(a.arrival * Math.PI) * row * 90
            const y = cy + (targetY - cy) * a.arrival - Math.sin(a.arrival * Math.PI) * 160 + Math.sin(phase) * 3
            const dim = s.marked ? Math.min(1, Math.max(0, (s.markAge - a.i * 2) / 6)) : 0
            return <g key={a.i} data-agent={a.i} data-agent-size={Math.round(ww)} data-window-width={ww}>
              <path d={`M ${cx} ${cy} Q ${x} ${cy - wh} ${x} ${y}`} fill="none" stroke={coral} strokeWidth={2} opacity={.16 * a.arrival * (1 - dim)} />
              <path d={`M ${cx} ${cy} Q ${x + row * 90} ${y - 160} ${x} ${y}`} fill="none" stroke={tokens.mint} strokeWidth={8} opacity={(1 - a.arrival) * .2} />
              <ellipse cx={x + 8} cy={y + wh * .7} rx={ww * .58} ry={wh * .2} fill={tokens.inkDeep} opacity={.65} filter={`url(#${id}-shadow)`} />
              <g data-agent-window="true" transform={`translate(${x} ${y}) rotate(${row * (col - 2) * 2}) skewX(${row * 3})`}>
                <rect x={-ww / 2} y={-wh / 2} width={ww} height={wh} rx={10} fill={tokens.ink} stroke={tokens.inkSoft} strokeWidth={2} />
                <rect x={-ww / 2} y={-wh / 2} width={ww} height={wh} rx={10} fill={tokens.inkSoft} opacity={dim} />
                <circle cx={-ww * .37} cy={-wh * .28} r={5} fill={dim === 1 ? tokens.inkSoft : tokens.mint} opacity={.65 + .35 * Math.sin(phase)} />
                {[0, 1, 2].map(line => <rect key={line} x={-ww * .36 + Math.sin(phase + line) * 4} y={-wh * .05 + line * wh * .2 + Math.sin(phase * .7) * 3} width={ww * (.55 - line * .1)} height={5} rx={2.5} fill={tokens.cream} opacity={(1 - dim * .8) * (.7 - line * .12)} />)}
              </g>
            </g>
          })}
          <g transform={`translate(${cx} ${cy}) skewY(-6)`}>
            <rect x={-bw / 2 + 12} y={-bh / 2 + 16} width={bw} height={bh} rx={18} fill={tokens.inkDeep} />
            <rect x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx={18} fill={tokens.cream} />
            <foreignObject x={-bw / 2 + 32} y={-bh / 2 + 28} width={bw - 64} height={bh - 40}>
              <div style={{ fontFamily: HOUSE_FONTS.dek, fontWeight: 600, fontSize: 64, lineHeight: 1.15, color: tokens.ink }}>{s.text}</div>
            </foreignObject>
          </g>
          {s.countProgress > 0 && <g data-meter={!s.rankMode || undefined}>
            <text x={mx} y={my} textAnchor="middle" fill={tokens.cream} fontFamily={HOUSE_FONTS.display} fontSize={120}>AGENTS</text>
            <text x={mx} y={my + 170} textAnchor="middle" fill={tokens.cream} fontFamily={HOUSE_FONTS.display} fontSize={180}>{s.agentCount}</text>
            <path d={`M ${mx - 80} ${my + 190} h 160`} stroke={tokens.mint} strokeWidth={8} />
          </g>}
          {s.rankMode && <g data-rank="true">
            <text x={mx} y={my - 150} textAnchor="middle" fill={tokens.cream} fontFamily={HOUSE_FONTS.dek} fontWeight={600} fontSize={56}>{s.params.labels.rank} {s.rank}</text>
          </g>}
        </g>
        {s.marked && <g data-strike="true">
          <path d={`M ${cx - bw * .46} ${cy + bh * .2} Q ${cx - bw * .1} ${cy - bh * .05} ${cx + bw * .46} ${cy - bh * .3}`} fill="none" stroke={coral} strokeWidth={16} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - s.strike} />
          <text x={cx} y={cy + bh / 2 + (tall ? 210 : 200)} textAnchor="middle" fill={tokens.cream} fontFamily={HOUSE_FONTS.dek} fontStyle="italic" fontSize={48}>{s.params.annotation}</text>
        </g>}
      </g>
      <text x={w * .06} y={h * (tall ? .79 : .94)} fill={tokens.cream} fontFamily={HOUSE_FONTS.data} fontSize={30}>{object.dataset?.producerLabel}</text>
    </g>
  </svg>
}
