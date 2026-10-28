import React from 'react'
import { z } from 'zod'
import { MOTION, progress } from '../../clock'
import { GW } from '../phoneGlass'
import type { GlassProps } from '../glassRegistry'
import { cardStyle, Frame, HOUSE_FONTS, scale, Text } from './shared'

export const CardsParams = z.object({
  cards: z.array(z.object({ name: Text, flags: z.array(z.object({ station: Text, planted: z.boolean() })).min(1),
    score: z.union([z.number().finite().nonnegative(), Text]).optional() })).min(1),
  scoreAt: Frame.default(22),
  layout: z.enum(['stacked', 'countries']).default('stacked'),
})
const flagPath = 'M15 10 Q38 2 60 13 L47 24 L60 36 Q38 44 15 36 Z'
/** Port of ref/H/build.py pennant, with a bounded SVG viewport. */
export function Pennant({ planted, elapsed, tokens, height = 72 }: { planted: boolean; elapsed: number; tokens: GlassProps['tokens']; height?: number }) {
  const drop = progress(elapsed, MOTION.dropFrames), slap = progress(elapsed, MOTION.slapFrames)
  return <svg data-pennant={planted ? 'planted' : 'bare'} width={height * 64 / 88} height={height} viewBox="0 0 64 88"
    style={{ overflow: 'hidden', flexShrink: 0, transformOrigin: '50% 90%',
      transform: planted ? `translateY(${-40 * (1 - drop)}px) rotate(${-12 * (1 - drop)}deg) scale(${1 + .4 * (1 - slap)})` : undefined }}>
    <line x1="12" y1="8" x2="12" y2="80" stroke={tokens.cream} strokeWidth="4" />
    {planted ? elapsed >= 0 && <path data-flag="planted" d={flagPath} fill={tokens.mint} stroke={tokens.ink} strokeWidth="3" strokeLinejoin="round" />
      : <path data-flag="ghost" d={flagPath} fill="none" stroke={tokens.cream} strokeWidth="3" strokeDasharray="5 6" strokeLinejoin="round" opacity=".55" />}
    <ellipse cx="12" cy="80" rx="10" ry="3" fill={tokens.cream} />
  </svg>
}
export function Cards({ params, tokens, sinceFrames, k }: GlassProps) {
  const p = CardsParams.parse(params), width = GW * scale(k) - 68
  const P = p.layout === 'countries' ? 30 : 34
  const top = 30 * k + (p.layout === 'countries' ? 20 : 18)
  if (p.layout === 'countries') {
    const card = p.cards[0]!, cw = (GW * k - 2 * P - 22) / 2, cv = top + 62
    return <div data-glass="cards" style={{position:'absolute',inset:0}}>
      <div style={{position:'absolute',left:P,top:top-4,color:tokens.cream,fontFamily:HOUSE_FONTS.structure,fontWeight:900,fontSize:44}}>{card.name}</div>
      {card.flags.map((flag,j)=>{
        const enter=progress(sinceFrames-8,12), elapsed=sinceFrames-p.scoreAt-j*MOTION.staggerFrames
        return <div key={j} style={{...cardStyle(tokens),position:'absolute',left:P+j*(cw+22),top:cv,width:cw,height:450,opacity:enter,transform:`translateY(${120*(1-enter)}px)`}}>
          <div style={{position:'absolute',right:20,top:20,fontFamily:HOUSE_FONTS.data,fontSize:30}}>{flag.station}</div>
          <div style={{position:'absolute',left:0,right:0,top:72,display:'flex',justifyContent:'center'}}><Pennant planted={flag.planted} elapsed={elapsed} tokens={tokens} height={206}/></div>
          {elapsed>=0 && <div style={{position:'absolute',left:0,right:0,top:288,textAlign:'center',fontFamily:HOUSE_FONTS.display,fontSize:150,lineHeight:1,color:flag.planted?tokens.mint:tokens.cream}}>{flag.planted?'1':'0'}</div>}
        </div>
      })}
    </div>
  }
  return <div data-glass="cards" style={{position:'absolute',inset:0}}>
    <div style={{position:'absolute',left:P,top,color:tokens.mint,fontFamily:HOUSE_FONTS.data,fontSize:30,letterSpacing:'.14em',textTransform:'uppercase'}}>Flagged it?</div>
    {p.cards.map((card,i)=>{
      const start=i===0?8:60+(i-1)*52, enter=progress(sinceFrames-start,12)
      const scoreElapsed=sinceFrames-(p.scoreAt+(i===0?0:52+(i-1)*52))
      return <div key={i} data-result-card="" style={{...cardStyle(tokens),position:'absolute',left:P,top:top+50+i*304,width,height:276,opacity:enter,transform:`translateY(${120*(1-enter)}px)`}}>
        <div style={{position:'absolute',left:30,top:22,fontFamily:HOUSE_FONTS.structure,fontSize:44,fontWeight:900,fontStretch:'112%',textTransform:'uppercase',lineHeight:1}}>{card.name}</div>
        {scoreElapsed>=0 && <div data-score="" style={{position:'absolute',right:30,top:12,color:tokens.mint,fontFamily:HOUSE_FONTS.display,fontSize:/^[01]$/.test(String(card.score))?150:136,lineHeight:1,transform:`scale(${1+.4*(1-progress(scoreElapsed,MOTION.slapFrames))})`}}>{card.score}</div>}
        {card.flags.map((flag,j)=><div key={j} style={{position:'absolute',left:30,top:104+j*82,display:'flex',alignItems:'flex-end',gap:14}}>
          <Pennant planted={flag.planted} elapsed={sinceFrames-(22+(i===0?0:52+(i-1)*52)+j*MOTION.staggerFrames)} tokens={tokens}/>
          <span style={{fontFamily:HOUSE_FONTS.data,fontSize:30,letterSpacing:'.06em',lineHeight:1.2}}>{flag.station}</span>
        </div>)}
      </div>
    })}
  </div>
}
