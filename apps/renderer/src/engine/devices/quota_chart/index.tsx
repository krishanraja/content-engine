import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { HERO, MOTION, onTwos, progress } from '../../clock'
import type { DeviceProps } from '../types'
import { quotaState } from './state'

/** Wide proof stays above the face window; portrait gets its own vertical stage. */
export function chartLayout(w: number, h: number, tall: boolean) {
  return { x: w * .07, y: h * (tall ? .23 : .24), width: w * .86,
    height: h * (tall ? .31 : .33), salesY: h * (tall ? .64 : .6), salesH: h * .22 }
}
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = quotaState(object, events, frame)
  if (!s.visible) return null
  const tall = aspect === '9:16', w = box.width, h = box.height
  const { x, y, width: cw, height: ch } = chartLayout(w, h, tall)
  const base = y + ch
  const countCue = s.fired.findLast(e => e.verb === 'count_to' && e.atFrame >= (s.entrance?.atFrame ?? 0))
  const compare = countCue ? progress(frame - countCue.atFrame, MOTION.countFrames) : 0
  const life = progress(frame - (s.entrance?.atFrame ?? object.fromFrame),
    object.toFrame - (s.entrance?.atFrame ?? object.fromFrame), HERO)
  const camera = 1 + .06 * life
  const backgroundCamera = 1 + .03 * life
  const id = `quota-${object.obj}`
  const bw = cw / s.bins.length * .5
  const targetY = base - ch * s.target
  const junkVisible = s.mark > 0 && s.bars.some(b => b.junk > 0)
  const headline = junkVisible && s.move === 0 ? `${Math.round(s.junkShare * 100)}% JUNK`
    : `${Math.round(s.targetValue + (s.halfTargetValue - s.targetValue) * s.move)} A MONTH`
  return <svg data-device="quota_chart" width={w} height={h} style={{position:'absolute',left:box.left,top:box.top,overflow:'hidden',opacity:s.opacity}}>
    <defs>
      <radialGradient id={`${id}-light`} cx="18%" cy="12%" r="95%"><stop stopColor={tokens.ink}/><stop offset="1" stopColor={tokens.inkDeep}/></radialGradient>
      <filter id={`${id}-grain`}><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves={3} seed={Math.floor(onTwos(frame, s.entrance?.atFrame ?? 0) / 2) + 1}/><feColorMatrix type="saturate" values="0"/></filter>
      <filter id={`${id}-shadow`} x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation={12}/></filter>
      <clipPath id={`${id}-safe`}><path d={tall ? `M0 0H${w}V${h}H0Z` : `M0 0H${w}V676H1452V1016H${w}V${h}H0Z`}/></clipPath>
    </defs>
    <g clipPath={`url(#${id}-safe)`}>
      <g transform={`translate(${w/2} ${h/2}) scale(${backgroundCamera}) translate(${-w/2} ${-h/2})`}>
        <rect width={w} height={h} fill={`url(#${id}-light)`}/>
        <rect width={w} height={h} filter={`url(#${id}-grain)`} opacity={.03}/>
      </g>
      <g transform={`translate(${w/2} ${h*.35}) scale(${camera}) translate(${-w/2} ${-h*.35})`} fill={tokens.cream}>
        <g data-chart-bounds={`${x},${y},${cw},${ch}`} transform={`translate(${-compare*cw*.03} ${compare*ch*.6}) scale(${1-compare*.12} ${1-compare*.88})`}>
          <ellipse cx={w/2} cy={base+15} rx={cw*.5} ry={18} fill={tokens.inkDeep} opacity={.7} filter={`url(#${id}-shadow)`}/>
          {s.bars.map((b,i) => {
            // Enter builds the object; fill retains its existing state semantics.
            const rise = progress(s.age - i*2, Math.min(7, MOTION.enterFrames))
            const surge = s.draw * (1-s.mark) * (1-s.move)
            const nearest = Math.abs(i / (s.bins.length-1) - .7) < .19
            const value = b.solid || s.bins[i]! * rise
            const solidH = (value + (nearest ? Math.max(0,s.target-value)*surge : 0))*ch
            const junkH = b.junk*ch
            const bx = x + b.x*cw - bw/2
            const fall = s.move * (36 + i*3)
            return <g key={i} data-bin={i}>
              <rect x={bx} y={base-solidH} width={bw} height={solidH} rx={2}/>
              {junkH>0 && <g data-junk={b.junk} fill={tokens.inkSoft} transform={`translate(0 ${fall})`} opacity={1-s.move}>
                {[0,1,2].map(part => <path key={part} d={`M${bx+part*bw/3+2} ${base-solidH-junkH-6*s.mark} h${bw/3-3} v${junkH*.72} l${-bw/6} ${junkH*.28} h${-bw/6+3}Z`}/>)}
              </g>}
            </g>
          })}
          {s.draw>0 && <path data-target={s.target} d={`M${x} ${targetY}H${x+cw*s.draw}`} fill="none" stroke={tokens.channel} strokeWidth={6} opacity={1-compare}/>} 
        </g>
        {s.draw>0 && compare<1 && <text x={x} y={y-48} fontFamily={HOUSE_FONTS.display} fontSize={120} opacity={s.draw*(1-compare)}>{headline}</text>}
        {compare>0 && <g opacity={compare}>
          <text x={x + cw*.43} y={(tall ? h*.87 : h*.85) - s.sales[1]! / (1+s.salesLift) * h*(tall ? .12 : .13) - 40} fontFamily={HOUSE_FONTS.display} fontSize={220} fill={tokens.mint}>+{Number((s.salesLift*s.lift*100).toFixed(2))}%</text>
          {[0,1].map(i => {
            const bx = x + cw*(i ? .43 : 0), bottom = tall ? h*.87 : h*.85
            const bh = s.sales[i]! / (1+s.salesLift) * h*(tall ? .12 : .13)
            return <g key={i}>
              <rect data-sales={i} x={bx} y={bottom-bh} width={cw*.32} height={bh} fill={i ? tokens.mint : tokens.cream}/>
              <text x={bx} y={bottom+64} fontFamily={HOUSE_FONTS.dek} fontWeight={600} fontSize={56}>{i ? 'Half target' : 'Old target'}</text>
            </g>
          })}
        </g>}
      </g>
      {s.showSource && <text x={x} y={tall ? h-64 : h-30} fill={tokens.cream} fontFamily={HOUSE_FONTS.data} fontSize={30}>{s.source}</text>}
    </g>
  </svg>
}
