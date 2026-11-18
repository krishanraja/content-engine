import React from 'react'
import { Img, staticFile } from 'remotion'
import { z } from 'zod'
import { HOUSE, HOUSE_FONTS as F, HOUSE_GRAIN_IMAGE } from '../../../house/geometry'
import { PALETTES } from '../palettes'
import palette from '../../../../../../config/brand-palette.json'

export const SplitKeyFrameSchema = z.object({
  variant: z.enum(['slam', 'receipt']), beat: z.enum(['hook', 'face', 'proof', 'close']),
  plateSrc: z.string().min(1), plateY: z.number().min(0).max(100).optional(), series: z.enum(['under.the.hood', 'follow.the.money', 'mind.the.gap']), caption: z.string().max(32).optional(),
})
export type SplitKeyFrameProps = z.infer<typeof SplitKeyFrameSchema>
export const REFERENCES = {
  slam: { hook: 'ai-music 12.43 s waveform title card', face: 'ai-music 57.27 s verdict card slam', proof: 'ai-music 4.70 s Official Charts screenshot and peak ring', close: 'ai-music 77.23 s brand end card' },
  receipt: { hook: 'character-ai 0.90 s cold-open split poster', face: 'character-ai 13.0 s bankruptcy slam', proof: 'character-ai 19.6 s printed Google receipt', close: 'character-ai 81.67 s question end card' },
} as const
const p = PALETTES['ink-0']!
// Resolve the approved channel tokens from the palette's canonical colour rule.
const channelToken = (name: string) => {
  const value = palette.colour.series.match(new RegExp(name.replaceAll('.', '\\.') + ' (#[0-9A-Fa-f]{6})'))?.[1]
  if (!value) throw new Error(`Missing approved channel token: ${name}`)
  return value
}
const seriesColour = { 'under.the.hood': channelToken('under.the.hood'), 'follow.the.money': channelToken('follow.the.money'), 'mind.the.gap': channelToken('mind.the.gap') }
const forbidden = /proactive ai is coming|it doesn't spend my money|amazon for your groceries|ibiza|no spending|no sending/i
const defaults = { slam: { face: 'Human voice.', proof: 'It reached number two.' }, receipt: { face: 'The company went bust.', proof: 'The founders walked away.' } }
/** Assets are supplied in Remotion's public directory by the rendering operator.
 * No remote fetch, fabricated screenshot, or committed camera frame is used here.
 */
export const SPLIT_ASSETS = {
  logo: 'split/wordmark.png', chart: 'split/officialcharts_song_page.png',
  google: 'split/google-symbol.svg', disney: 'split/disney-wordmark.svg',
}
export function SplitKeyFrame(input: SplitKeyFrameProps) {
  const {variant, beat, plateSrc, plateY, series, caption} = SplitKeyFrameSchema.parse(input)
  if (caption && forbidden.test(caption)) throw new Error('Caption violates the card contract')
  const full = beat === 'hook' || beat === 'close'
  const seam = variant === 'slam' ? 1236 : 1000
  const c = seriesColour[series]
  const cap = full ? undefined : caption ?? defaults[variant][beat as 'face' | 'proof']
  const stageWords = variant === 'slam' ? 'SINGING STILL IN GRAMMYS REPORTEDLY No. 2 Official Charts November 2026' : 'NOW IT’S BANKRUPT GOOGLE 2024 2.7B REPORTED WIRED'
  if (cap && cap.split(/\s+/).filter(w=>w.length>3).some(w=>stageWords.toLowerCase().includes(w.toLowerCase().replace(/[.!?]/g,'')))) throw new Error('Caption repeats stage words')
  const text = (words: string, x: number, y: number, size: number, colour=p.paper, font: string=F.display) => <text x={x} y={y} fontSize={size} fontFamily={font} fill={colour}>{words}</text>
  return <div data-reference={REFERENCES[variant][beat]} data-variant={variant} data-beat={beat} style={{position:'relative',width:1080,height:1920,overflow:'hidden',background:p.ink,color:p.paper}}>
    <div data-stage-height={full ? 1920 : seam} style={{position:'absolute',inset:0,height:full?1920:seam,overflow:'hidden',background:p.ink}}>
      <svg width={1080} height={full?1920:seam} style={{position:'absolute',inset:0}}>
        <defs>
          <radialGradient id="seriesGlow"><stop stopColor={c} stopOpacity={.22}/><stop offset="1" stopColor={c} stopOpacity={0}/></radialGradient>
          <radialGradient id="mintGlow"><stop stopColor={p.signal} stopOpacity={.18}/><stop offset="1" stopColor={p.signal} stopOpacity={0}/></radialGradient>
          <pattern id="grid" width={54} height={54} patternUnits="userSpaceOnUse"><path d="M54 0H0V54" stroke={p.paper} opacity={.04} fill="none"/></pattern>
          <pattern id="hatch" width={22} height={22} patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width={22} height={22} fill={p.ink}/><rect width={7} height={22} fill={p.paper} opacity={.08}/></pattern>
        </defs>
        {!full && <><ellipse cx={80} cy={80} rx={850} ry={700} fill={variant==='receipt'?'url(#seriesGlow)':'url(#mintGlow)'}/><ellipse cx={950} cy={900} rx={850} ry={650} fill="url(#mintGlow)"/><rect width={1080} height={seam} fill="url(#grid)"/></>}
        {variant==='receipt' && <rect width={1080} height={10} fill={c}/>}
        {variant==='slam' && beat==='hook' && <>
          {Array.from({length:44},(_,i)=><rect key={i} x={72+i*18} y={760-Math.abs(Math.sin(i*1.7))*330} width={9} height={60+Math.abs(Math.sin(i*1.7))*660} fill={p.signal} opacity={.35}/>)}
          {text('IS IT',100,400,140)}<rect x={80} y={480} width={780} height={180} fill="url(#hatch)"/>{text('AI MUSIC',110,625,150)}
          {text('OR',110,830,130)}<rect x={80} y={910} width={780} height={180} fill={p.signal}/>{text('HUMAN MUSIC?',105,1035,112,p.ink)}
        </>}
        {variant==='slam' && beat==='face' && <g transform="rotate(3 470 680)"><rect x={85} y={280} width={760} height={720} fill={p.signal}/>{text('SINGING',120,520,170,p.ink)}{text('STILL IN',120,720,170,p.ink)}{text('Grammys · reportedly',120,910,34,p.ink,F.data)}</g>}
        {variant==='slam' && beat==='proof' && <>{text('No. 2',100,400,150)}{text('Official Charts · Nov 2026',100,465,32,p.paper,F.data)}</>}
        {variant==='receipt' && beat==='hook' && <>
          <rect y={200} width={1080} height={786} fill={p.signal}/><rect y={986} width={1080} height={934} fill={c}/>
          {[360,1030].map(y=><rect key={y} x={120} y={y} width={730} height={290} fill={p.ink}/>)}
          {text('GOOGLE · 2024',155,445,48)}{text('$2.7B',155,590,140)}{text('DISNEY · 2026',155,1120,48)}{text('~$60M A YEAR',155,1250,86)}
          <circle cx={485} cy={986} r={64} fill={p.ink}/>{text('VS',448,1006,48)}
        </>}
        {variant==='receipt' && beat==='face' && <>
          {text('NOW IT’S',100,440,132)}{text('BANKRUPT.',100,600,132)}
          <g transform="rotate(-4 470 750)"><rect x={80} y={700} width={780} height={100} fill={c}/>{text('CHAPTER 11 · 12 OCT 2026',100,765,38,p.ink,F.data)}</g>
          {text('COURT FILING',100,900,36,p.paper,F.data)}
        </>}
        {variant==='receipt' && beat==='proof' && <g transform="rotate(-1.5 470 560)">
          <path d="M80 300H850V825l-35 -12 -35 12 -35 -12 -35 12 -35 -12 -35 12 -35 -12 -35 12 -35 -12 -35 12 -35 -12 -35 12 -35 -12 -35 12 -35 -12 -35 12 -35 -12 -35 12 -35 -12 -35 12 -35 -12 -35 12Z" fill={p.paper}/>
          {text('GOOGLE · 2024',115,390,55,p.ink,F.data)}<path d="M115 425H810M115 710H810" stroke={p.ink} strokeWidth={3} strokeDasharray="8 8"/>
          {text('LICENSING DEAL',115,495,38,p.ink,F.data)}<rect x={110} y={530} width={700} height={135} fill={p.signal}/>{text('$2.7B (REPORTED)',130,620,65,p.ink,F.display)}
          {text('WIRED · REBUILT RECEIPT',115,775,32,p.ink,F.data)}
        </g>}
        {beat==='close' && <><rect y={1300} width={1080} height={620} fill={c}/>{variant==='slam'?<>{text('AI MUSIC',120,480,160)}{text('OR HUMAN',120,670,150)}{text('MUSIC?',120,860,160)}</>:<>{text('WHY IS DISNEY',120,430,105)}{text('EATING THE',120,570,110)}{text('SCRAPS?',120,730,150)}{text('Character.AI · 26 Oct 2026',120,870,34,p.paper,F.data)}</>}{text('makeyourmindup.ai',120,1160,52,p.paper,F.data)}</>}
      </svg>
      {!full && <div aria-hidden style={{position:'absolute',inset:0,backgroundImage:HOUSE_GRAIN_IMAGE,opacity:.07,pointerEvents:'none'}}/>}
      {variant==='slam' && beat==='proof' && <Img data-proof-object="official-charts" src={staticFile(SPLIT_ASSETS.chart)} style={{position:'absolute',left:80,top:510,width:780,height:530,objectFit:'contain',transform:'rotate(3deg)'}}/>}
    </div>
    {!full && <div data-band="hard-edge" style={{position:'absolute',left:0,top:seam,width:1080,height:1920-seam,overflow:'hidden',border:0,borderRadius:0}}>
      <Img src={plateSrc} style={{width:1080,height:'100%',objectFit:'cover',objectPosition:plateY === undefined ? 'center top' : `50% ${plateY}%`}}/>
    </div>}
    <header data-header style={{position:'absolute',left:72,top:79,width:888,height:56,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <Img data-logo src={staticFile(SPLIT_ASSETS.logo)} style={{width:260,height:56,objectFit:'contain'}}/>
      <span data-series style={{background:c,color:p.ink,fontFamily:F.data,fontSize:30,padding:'8px 14px'}}>{series}</span>
    </header>
    {cap && <div data-caption data-caption-left={60} data-caption-right={860} style={{position:'absolute',left:HOUSE.caption.left,top:variant==='slam'?1090:920,width:800,boxSizing:'border-box',padding:`${HOUSE.caption.paddingTop}px ${HOUSE.caption.paddingX}px ${HOUSE.caption.paddingBottom}px`,background:p.ink,color:p.paper,fontFamily:F.structure,fontWeight:HOUSE.caption.weight,fontSize:HOUSE.caption.size,lineHeight:HOUSE.caption.lineHeight,boxShadow:`12px 12px 0 ${c}`}}>{cap}</div>}
  </div>
}
