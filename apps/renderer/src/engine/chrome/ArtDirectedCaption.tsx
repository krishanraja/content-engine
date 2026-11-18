import React from 'react'
import { HOUSE_FONTS } from '../../house/geometry'
import type { EngineRenderProps } from '../props'
import { clamp, clean, fit, livePage, outCubic, since, type Page } from '../captions/kit'
import { wrap } from '../captions/draw'

/** "Art-directed phrases" (Krish, 2026-11-11, of his inspiration card instagram_DfkCOCLt7KZ: "The captions are very
 *  unique and well-designed, like an art director would do them"; built first for the proactive-AI short,
 *  docs/plans/2026-11-09-week/proactive-voiceover/build_proof.py on PR #520). Anton capitals in cream with a soft
 *  shadow, no box, pill or underline, never coloured. Each caption page is one phrase: its words build as he says
 *  them; the phrase's key word (the page's swipe, else its longest word) sits alone on its own row at 168 px, the
 *  others at 92 px, and a huge faint echo of the key word (430 px at 7%) sits behind, cropped by the frame.
 *
 *  Rebuilt on 18 Nov 2026 to the three caption rules (Krish, 2026-11-18, of the Tue 17 data-centres short, where the
 *  pages are one word each: "They are really jolty, and each word moving from left to right is really hard to look at
 *  and stressful. We can't have each new word appear somewhere else on the screen, and we need the previous word to
 *  stick around for a tiny bit longer."; config/failures.json, F57):
 *   1. A new word never appears somewhere else. Every page is laid out whole before its first word is said and hangs
 *      from one fixed point, left aligned (x 70; y 1320 minus the tallest page of the cut on the tall frame, which for
 *      a cut of one-word pages is the foot of the region), so a page's first word lands where every page's does and a
 *      word never moves the words already there. No page alternates sides.
 *   2. The previous page stays a little longer: smaller, dimmed, on the line above the page being said, for
 *      HOLD_SECONDS after the new page begins, then it fades. (The Two-line scroll he preferred does the same.)
 *   3. Nothing jolts: a word enters by fading up the last 10 px over 0.1 s with no scale or overshoot, the ghost and the
 *      echo only ever fade, and the echo is drawn for an emphasised word or a phrase and never for every word of a
 *      one-word page, so it does not flicker behind each word. */
export const ART_REGION = {
  '9:16': { left: 70, top: 1095, width: 800, height: 225 }, // x 70 to 870, y 1095 to 1320: inside every platform's safe area
  '16:9': { left: 192, top: 700, width: 900, height: 300 },
} as const

/** The look's numbers, one place. Sizes are the ones Krish picked on 11 Nov; the rest are the 18 Nov calm. */
export const ART = {
  keySize: 168, supportSize: 92, ghostSize: 52, lineHeight: 0.96, gap: 22, rowGap: 4, ghostGap: 10,
  /** Rise and fade of a word as it is said. Short, eased out, no scale and no overshoot. */
  enterSeconds: 0.1, enterRisePx: 10, enterFrom: 0.7,
  /** The previous page stays this long after the new page begins (its last 0.2 s is the fade). */
  holdSeconds: 0.6, ghostFadeSeconds: 0.2, ghostOpacity: 0.5,
  echoOpacity: 0.07, echoFadeSeconds: 0.3,
} as const

export function keyIndex(page: Page): number {
  if (page.swipeIndex !== null && page.swipeIndex !== undefined) return page.swipeIndex
  let best = 0
  page.words.forEach((w, i) => { if (w.text.length > page.words[best]!.text.length) best = i })
  return best
}

/** The word a page's echo is drawn for, or null. An emphasised word always gets one; a phrase gets one for its key
 *  word; a one-word page with nothing emphasised gets none (the foreground word is the whole page). */
export function echoIndex(page: Page): number | null {
  if (page.swipeIndex !== null && page.swipeIndex !== undefined) return page.swipeIndex
  return page.words.length >= 2 ? keyIndex(page) : null
}

export type ArtRow = { words: number[]; size: number }

/** The whole page laid out once, before any word is said: support words above the key word, the key word alone on its
 *  own row (shrunk only when it would not fit the region's width), support words after it below. Every row is reserved
 *  now, so a page never moves as its words arrive (cutHeight says where the whole stack hangs from). */
export function artLayout(page: Page, aspect: EngineRenderProps['aspect']): { rows: ArtRow[]; key: number; height: number } {
  const key = keyIndex(page), width = ART_REGION[aspect].width
  const words = page.words.map((w) => clean(w.text))
  const side = (from: number, to: number): ArtRow[] =>
    wrap(words.slice(from, to), ART.supportSize, width, 'anton', true, ART.gap)
      .map((row) => ({ words: row.map((i) => i + from), size: ART.supportSize }))
  const rows = [...side(0, key),
    // fit() rounds to the nearest pixel; 8 px of margin keeps the rounding from running a word past the region.
    { words: [key], size: Math.min(ART.keySize, fit(words[key]!, width - 8, 'anton', true, ART.keySize, 72)) },
    ...side(key + 1, words.length)]
  return { rows, key, height: rows.reduce((h, r) => h + r.size * ART.lineHeight, 0) + ART.rowGap * (rows.length - 1) }
}

/** The tallest page of the cut: the stack hangs from this far above the foot of the region on every page, so every page
 *  starts at the same point and none runs past the foot into the platforms' bottom band. A cut of one-word pages gives
 *  one row, which is the foot of the region. Memoised per caption list; a pure function of the props. */
const tallest = new WeakMap<object, Record<string, number>>()
export function cutHeight(captions: readonly Page[], aspect: EngineRenderProps['aspect']): number {
  const known = tallest.get(captions) ?? {}
  if (known[aspect] === undefined) {
    known[aspect] = Math.max(0, ...captions.map((p) => artLayout(p, aspect).height))
    tallest.set(captions, known)
  }
  return known[aspect]!
}

const SHADOW = '0 6px 24px rgba(0,0,0,.45)'

export function ArtDirectedCaption({ props, frame }: { props: EngineRenderProps; frame: number }): React.ReactElement | null {
  const live = livePage(props, frame)
  if (!live) return null
  const { page, index } = live
  const fps = props.fps, box = ART_REGION[props.aspect], cream = props.tokens.cream
  const layout = artLayout(page, props.aspect), hang = cutHeight(props.captions, props.aspect)
  const text = (i: number, pg: Page = page) => clean(pg.words[i]!.text).toUpperCase()
  const prev = index > 0 ? props.captions[index - 1]! : null
  const age = since(frame, page.fromFrame, fps)

  const word = (i: number, size: number) => {
    const w = page.words[i]!, said = frame >= w.atFrame - 1
    // 0 on the frame before he says it, 1 after enterSeconds: an eased fade and rise, nothing else.
    const e = outCubic((frame - (w.atFrame - 1)) / (ART.enterSeconds * fps))
    return <span key={i} data-art-word={i} style={{
      fontFamily: HOUSE_FONTS.display, fontSize: size, lineHeight: ART.lineHeight, letterSpacing: '0.5px', textTransform: 'uppercase',
      color: cream, textShadow: SHADOW, display: 'inline-block', visibility: said ? 'visible' : 'hidden',
      transform: `translateY(${(1 - e) * ART.enterRisePx}px)`, opacity: ART.enterFrom + (1 - ART.enterFrom) * e,
    }}>{text(i)}</span>
  }

  // The previous page, on the line above this one, for holdSeconds from the moment this page begins.
  const ghostAlpha = prev ? clamp((age + 2 / fps) / 0.08) * clamp((ART.holdSeconds - age) / ART.ghostFadeSeconds) : 0

  // The echo: this page's, fading in as its word is said, and the last page's fading out under it. Opacity only.
  const echo = (pg: Page, alpha: number) => {
    const at = echoIndex(pg)
    if (at === null || alpha <= 0.001) return null
    return <div key={pg.fromFrame} data-caption-echo style={{ position: 'absolute', left: -60, right: -60, top: props.aspect === '9:16' ? 700 : 300,
      textAlign: 'center', fontFamily: HOUSE_FONTS.display, fontSize: 430, lineHeight: 1, color: cream, whiteSpace: 'nowrap', textTransform: 'uppercase',
      opacity: ART.echoOpacity * alpha, pointerEvents: 'none', overflow: 'hidden' }}>{text(at, pg)}</div>
  }
  const echoAt = echoIndex(page)
  const echoIn = echoAt === null ? 0 : clamp(since(frame, page.words[echoAt]!.atFrame - 1, fps) / ART.echoFadeSeconds)
  const echoOut = prev ? 1 - clamp(age / ART.echoFadeSeconds) : 0

  return <>
    {prev && echo(prev, echoOut)}
    {echo(page, echoIn)}
    <div data-caption-theme="art-directed" style={{ position: 'absolute', ...box, pointerEvents: 'none', zIndex: 40 }}>
      {prev && ghostAlpha > 0.001 && <div data-caption-ghost style={{ position: 'absolute', left: 0, bottom: hang + ART.ghostGap, width: box.width,
        display: 'flex', flexWrap: 'wrap', columnGap: 14, opacity: ART.ghostOpacity * ghostAlpha }}>
        {prev.words.map((_, i) => <span key={i} style={{ fontFamily: HOUSE_FONTS.display, fontSize: ART.ghostSize, lineHeight: ART.lineHeight,
          letterSpacing: '0.5px', textTransform: 'uppercase', color: cream, textShadow: SHADOW }}>{text(i, prev)}</span>)}
      </div>}
      <div data-art-stack style={{ position: 'absolute', left: 0, top: box.height - hang, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', rowGap: ART.rowGap }}>
        {layout.rows.map((row, r) => <div key={r} style={{ display: 'flex', columnGap: ART.gap, alignItems: 'baseline', height: row.size * ART.lineHeight }}>
          {row.words.map((i) => word(i, row.size))}
        </div>)}
      </div>
    </div>
  </>
}
