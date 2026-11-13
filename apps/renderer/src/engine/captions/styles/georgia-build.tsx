import React from 'react'
import type { Draw } from '../draw'
import { marked, root } from '../draw'
import { F, LIFT, band, clamp, clean, hero, livePage, mix, outBack, outCubic, outExpo, scale, since, type Page } from '../kit'

/** georgia-build: big mixed-case type at chest height, one to four words at a time, where the typeface carries the
 *  stress (Krish: "the georgia subtitles build"). Stop words are set in Fraunces, content words in Archivo ExtraBold,
 *  numbers and names a size up, and the page's hero (only a real one) in Fraunces italic over a series-colour rule that
 *  draws itself under it. Every word lands as an event: it rises about 16 px and settles from 1.2 to 1 over six frames,
 *  so the chunk visibly builds word by word; then it cuts hard to the next chunk with no crossfade. */

const STOPW = new Set(('a an the to of in on at for and but or so it is was be are that this with as if by from i we you ' +
  'they he she my your our its not no do').split(' '))
const isStopW = (t: string) => STOPW.has(clean(t).toLowerCase())

type Role = 'stop' | 'content' | 'proper' | 'key'

/** Chunks of about three words, never one a reader cannot read. A new chunk starts when the chunk is full or at the
 *  hero, but (1) a run of stop words just before the break moves into the next chunk with the word it leads ('They' /
 *  'didn't...' becomes 'They didn't...'), (2) a chunk of only stop words never breaks off on its own, and (3) no break
 *  happens until the chunk has been up for 8 frames; all up to a hard cap of 4 words and 22 characters. */
function chunks(page: Page, kw: number): number[][] {
  const out: number[][] = []
  let cur: number[] = []
  const chars = (ix: number[]) => ix.reduce((s, i, j) => s + clean(page.words[i]!.text).length + (j ? 1 : 0), 0)
  page.words.forEach((w, i) => {
    const len = clean(w.text).length
    const full = cur.length >= 3 || (cur.length > 0 && chars(cur) + 1 + len > 16)
    const hard = cur.length >= 4 || (cur.length > 0 && chars(cur) + 1 + len > 22)
    if (cur.length && (full || i === kw)) {
      // Carry the trailing stop words over to lead the next chunk, if something is left behind.
      let cut = cur.length
      while (cut > 0 && isStopW(page.words[cur[cut - 1]!]!.text)) cut--
      const keep = cut > 0 ? cur.slice(0, cut) : cur, carry = cut > 0 ? cur.slice(cut) : []
      const at = (j: number) => page.words[j]!.atFrame
      // A chunk of only lead words ('In') never stands alone: it waits for the word it leads, unless the cap is hit.
      if (hard || (cut > 0 && w.atFrame - at(cur[0]!) >= 8)) {
        if (carry.length && chars([...carry, i]) <= 22 && at(carry[0]!) - at(keep[0]!) >= 6) { out.push(keep); cur = carry }
        else { out.push(cur); cur = [] }
      }
    }
    cur.push(i)
  })
  if (cur.length) out.push(cur)
  return out
}

function role(page: Page, i: number, kw: number, prevLast: string): Role {
  if (i === kw) return 'key'
  const raw = clean(page.words[i]!.text)
  if (STOPW.has(raw.toLowerCase())) return 'stop'
  if (/\d/.test(raw)) return 'proper'
  // A capital mid-sentence is a name; the sentence may carry over from the page before.
  const prev = i > 0 ? page.words[i - 1]!.text : prevLast
  if (prev && /^[A-Z]/.test(raw) && !/[.!?]$/.test(prev)) return 'proper'
  if (raw.length > 1 && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) return 'proper'
  return 'content'
}

const FACE: Record<Role, { family: string; weight: number; size: number; spacing: string; italic?: boolean }> = {
  stop: { family: F.dek, weight: 400, size: 84, spacing: '-0.02em' },
  content: { family: F.structure, weight: 800, size: 80, spacing: '-0.025em' },
  proper: { family: F.structure, weight: 800, size: 92, spacing: '-0.025em' },
  key: { family: F.dek, weight: 600, size: 104, spacing: '-0.02em', italic: true },
}

export const georgiaBuild: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page, index } = live, k = scale(props.aspect), box = band(props), kw = marked(hero(page))
  const prevPage = props.captions[index - 1]
  const prevLast = prevPage && page.fromFrame - prevPage.toFrame <= 15 ? prevPage.words[prevPage.words.length - 1]!.text : ''
  const groups = chunks(page, kw)
  // The live chunk: the last whose first word has landed (one frame early, as every style); hard cut, no crossfade.
  let ci = -1
  groups.forEach((g, j) => { if (frame >= page.words[g[0]!]!.atFrame - 1) ci = j })
  if (ci < 0 || frame >= page.toFrame) return null
  const group = groups[ci]!
  const placement = props.captionPlacement ?? 'lower'
  // Over the middle of the picture the type is a touch larger, so it reads as a statement and not a stray subtitle.
  const boost = placement === 'centre' ? 1.1 : 1
  const width = Math.min((props.aspect === '16:9' ? 1100 : 800) * k, box.width)
  const pos: React.CSSProperties = placement === 'upper' ? { top: 10 * k }
    : placement === 'centre' ? { top: '50%', transform: 'translateY(-50%)' }
    : { bottom: box.height * 0.3 }
  return root('georgia-build', box, (
    <div style={{ position: 'absolute', left: (box.width - width) / 2, width, ...pos, display: 'flex', flexWrap: 'wrap',
      justifyContent: 'center', alignItems: 'baseline', columnGap: 20 * k, rowGap: 6 * k, lineHeight: 1.0 }}>
      {group.map((i) => {
        const w = page.words[i]!, r = role(page, i, kw, prevLast), f = FACE[r], at = w.atFrame - 1
        const shown = frame >= at, t = since(frame, at, props.fps)
        // The landing: up 16 px and down from 1.2 to 1 over about six frames, with a slight overshoot on the hero.
        const land = 0.2
        const rise = (1 - outExpo(t / land)) * 16 * k
        const sc = r === 'key' ? mix(1.18, 1, outBack(t / 0.26, 2.2)) : mix(1.2, 1, outCubic(t / land))
        const op = shown ? clamp((frame - at + 1) / 2) : 0
        const rule = r === 'key' ? outCubic((t - 0.06) / 0.22) : 0
        return <span key={i} style={{ display: 'inline-block', position: 'relative', fontFamily: f.family, fontWeight: f.weight,
          fontStyle: f.italic ? 'italic' : 'normal', fontSize: f.size * k * boost, letterSpacing: f.spacing, lineHeight: 1.0,
          color: props.tokens.cream, textShadow: LIFT, opacity: op, visibility: shown ? 'visible' : 'hidden',
          transform: `translateY(${rise.toFixed(2)}px) scale(${sc.toFixed(4)})`, transformOrigin: '50% 100%', whiteSpace: 'nowrap' }}>
          {clean(w.text)}
          {rule > 0 && <span style={{ position: 'absolute', left: '4%', right: '4%', bottom: -0.08 * f.size * k * boost,
            height: Math.max(5, 0.07 * f.size * k * boost), background: props.tokens.channel, borderRadius: 2,
            transform: `scaleX(${rule.toFixed(4)})`, transformOrigin: '0% 50%' }} />}
        </span>
      })}
    </div>))
}
