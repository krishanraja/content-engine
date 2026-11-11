import React from 'react'
import type { EngineRenderProps } from '../props'

/** "Art-directed phrases" (Krish, 2026-11-11, of his inspiration card instagram_DfkCOCLt7KZ: "The captions are very
 *  unique and well-designed, like an art director would do them"; built first for the proactive-AI short,
 *  docs/plans/2026-11-09-week/proactive-voiceover/build_proof.py on PR #520). Anton capitals in cream with a soft
 *  shadow, no box, pill or underline, never coloured. Each caption page is one phrase: its words build as he says
 *  them, each popping in over 0.12 s; the phrase's key word (the page's swipe, else its longest word) sits alone on its
 *  own row at 168 px, the others at 92 px. Phrases alternate left and right inside the safe area, and a huge faint echo
 *  of the key word (430 px at 7%) sits behind, cropped by the frame. */
export const ART_REGION = {
  '9:16': { left: 70, top: 1095, width: 800, height: 225 }, // x 70 to 870, y 1095 to 1320: inside every platform's safe area
  '16:9': { left: 192, top: 700, width: 900, height: 300 },
} as const

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const outBack = (x: number) => { const c = 1.70158, k = clamp(x) - 1; return 1 + (c + 1) * k * k * k + c * k * k }

export function keyIndex(page: EngineRenderProps['captions'][number]): number {
  if (page.swipeIndex !== null && page.swipeIndex !== undefined) return page.swipeIndex
  let best = 0
  page.words.forEach((w, i) => { if (w.text.length > page.words[best]!.text.length) best = i })
  return best
}

export function ArtDirectedCaption({ props, frame }: { props: EngineRenderProps; frame: number }): React.ReactElement | null {
  const index = props.captions.findIndex((p) => frame >= p.fromFrame - 1 && frame < p.toFrame)
  const page = props.captions[index]
  if (!page) return null
  const fps = props.fps, t = frame / fps, key = keyIndex(page), side = index % 2 === 0 ? 'left' : 'right'
  const word = (text: string, at: number, big: boolean, i: number) => {
    const p = outBack((t - at / fps) / 0.12)
    return <span key={i} style={{
      fontFamily: 'Anton', fontSize: big ? 168 : 92, lineHeight: 0.96, letterSpacing: '0.5px', textTransform: 'uppercase',
      color: props.tokens.cream, textShadow: '0 6px 24px rgba(0,0,0,.45)', display: 'inline-block',
      transform: `translateY(${(1 - p) * 30}px) scale(${0.85 + 0.15 * p})`, opacity: clamp(p * 2),
    }}>{text.replace(/[,.]$/, '')}</span>
  }
  const rows: React.ReactElement[][] = []
  let row: React.ReactElement[] = []
  page.words.forEach((w, i) => {
    if (frame < w.atFrame - 1) return
    const el = word(w.text, w.atFrame, i === key, i)
    if (i === key) { if (row.length) rows.push(row); rows.push([el]); row = [] } else row.push(el)
  })
  if (row.length) rows.push(row)
  const k = page.words[key]!, kp = clamp((t - k.atFrame / fps) / 0.15)
  const box = ART_REGION[props.aspect]
  return <>
    <div data-caption-echo style={{ position: 'absolute', left: -60, right: -60, top: props.aspect === '9:16' ? 700 : 300, textAlign: 'center',
      fontFamily: 'Anton', fontSize: 430, lineHeight: 1, color: props.tokens.cream, whiteSpace: 'nowrap', textTransform: 'uppercase',
      opacity: frame >= k.atFrame - 1 ? 0.07 * kp : 0, transform: `scale(${1.06 - 0.06 * kp})`, pointerEvents: 'none', overflow: 'hidden' }}>
      {k.text.replace(/[,.]$/, '')}
    </div>
    <div data-caption-theme="art-directed" style={{ position: 'absolute', ...box, pointerEvents: 'none', zIndex: 40 }}>
      <div style={{ position: 'absolute', top: 0, [side]: 0, display: 'flex', flexDirection: 'column',
        alignItems: side === 'left' ? 'flex-start' : 'flex-end' }}>
        {rows.map((r, i) => <div key={i} style={{ display: 'flex', gap: 22, alignItems: 'baseline' }}>{r}</div>)}
      </div>
    </div>
  </>
}
