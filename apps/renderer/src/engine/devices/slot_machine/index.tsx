import React from 'react'
import { Img } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { material } from './hatch'
import { slotState } from './state'

export function Device(props: DeviceProps) {
  const s = slotState(props)
  if (!s) return null
  const { box, tokens: t, aspect, object } = props
  const tall = aspect === '9:16'
  const w = tall ? 920 : 1160, h = tall ? 1350 : 900
  const scale = Math.min(box.width / w, box.height / h)
  const panelH = tall ? 1000 : 660
  const left = 55, inner = w - 190
  const lyricsY = 150, lyricsH = tall ? 300 : 170
  const styleY = lyricsY + lyricsH + 40, styleH = tall ? 190 : 130
  const targetY = s.focus === 'style' ? styleY + styleH / 2 : lyricsY + lyricsH / 2
  const m = s.morph
  const wave = (seed: number, moving = 0) => <svg viewBox="0 0 240 72" width="100%" height="100%" aria-hidden>
    {Array.from({ length: 32 }, (_, j) => {
      const height = 8 + 48 * Math.abs(Math.sin(j * 1.71 + seed + moving * 9))
      return <rect key={j} x={j * 7.5} y={(72 - height) / 2} width="4" height={height} rx="2" fill="currentColor" />
    })}
  </svg>
  return <div data-device="slot_machine" style={{ position: 'absolute', ...box, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: (box.width - w * scale) / 2, top: (box.height - h * scale) / 2,
      width: w, height: h, transformOrigin: 'top left', transform: `scale(${scale})` }}>
      <div style={{ width: w, height: h, opacity: s.entrance * (1 - s.out),
        transform: `translateY(${(1 - s.entrance) * h + s.out * h}px)`,
        fontFamily: HOUSE_FONTS.structure, color: t.ink }}>
        <div data-camera style={{ width: w, height: h, transformOrigin: `${w / 2}px ${targetY}px`,
          transform: `scale(${s.zoom})` }}>
          <div style={{ position: 'absolute', left: 24, top: 24, width: w - 100, height: panelH,
            border: `3px solid ${t.ink}`, borderRadius: 30 + 30 * m, background: t.cream,
            boxShadow: `10px 12px 0 ${t.inkSoft}` }} />
          <header style={{ position: 'absolute', left, top: 55, width: inner, display: 'flex', alignItems: 'center', gap: 28,
            opacity: 1 - 0.6 * s.focusAmount }}>
            {s.params.logo && <Img src={s.params.logo} style={{ width: 130, height: 50, objectFit: 'contain' }} />}
            <span style={{ fontSize: 36, fontWeight: 700 }}>Create</span>
            <span style={{ marginLeft: 'auto', fontFamily: HOUSE_FONTS.data, fontSize: 24 }}>Custom</span>
          </header>
          {(['lyrics', 'style'] as const).map((key, i) => {
            const y = i ? styleY : lyricsY, height = i ? styleH : lyricsH
            return <section key={key} data-input={key} style={{ position: 'absolute', left,
              top: y * (1 - m) + (135 + i * 52) * m, width: inner,
              height: height * (1 - m) + 42 * m, overflow: 'hidden', boxSizing: 'border-box',
              border: `2px solid ${t.inkSoft}`, borderRadius: 12, padding: 18 * (1 - m) + 4 * m,
              background: t.cream, opacity: s.focus === key ? 1 : 1 - 0.6 * s.focusAmount }}>
              <div style={{ fontFamily: HOUSE_FONTS.structure, fontSize: 26, fontWeight: 700, opacity: 1 - m }}>{i ? 'Style of music' : 'Lyrics'}</div>
              <div style={{ fontFamily: HOUSE_FONTS.data, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                fontSize: 30 - m * 10, lineHeight: 1.35 }}>{s.texts[i]}{s.caret && m === 0 && <span data-caret>▎</span>}</div>
            </section>
          })}
          <div style={{ position: 'absolute', left, top: styleY + styleH + 28, width: inner, height: 66,
            borderRadius: 16, display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 700,
            ...material('human', t), opacity: (1 - m) * (1 - 0.6 * s.focusAmount),
            transform: `translateY(${s.pressed}px)`, boxShadow: `0 8px 0 ${t.ink}` }}>Create</div>
          <div data-machine style={{ opacity: m, transform: `scaleY(${m})`, transformOrigin: '50% 220px' }}>
            <div style={{ position: 'absolute', left, top: 260, width: inner, height: tall ? 390 : 225,
              padding: 16, boxSizing: 'border-box', borderRadius: 24, display: 'flex', gap: 18, ...material('ai', t) }}>
              {s.reels.map((reel, i) => <div key={i} data-reel={i + 1} data-spinning={reel.spinning} style={{
                position: 'relative', flex: 1, background: t.cream, borderRadius: 12, overflow: 'hidden' }}>
                {(reel.spinning ? [0, 1, 2] : [0]).map(copy => <div key={copy} style={{ position: 'absolute', inset: 0,
                  opacity: [1, 0.3, 0.12][copy], transform: `translateY(${reel.offset + copy * 10}px)` }}>
                  {Array.from({ length: 20 }, (_, tile) => <div key={tile} style={{ height: 120, padding: '12px 20px',
                    boxSizing: 'border-box', color: t.cream, ...material('ai', t) }}>{wave(tile + i)}</div>)}
                </div>)}
              </div>)}
            </div>
            <div data-lever style={{ position: 'absolute', left: w - 78, top: 265, width: 30, height: 180,
              transformOrigin: '50% 100%', transform: `rotate(${s.lever}deg)`, borderRadius: 15, ...material('sample', t) }}>
              <div style={{ position: 'absolute', top: -20, left: -12, width: 54, height: 54, borderRadius: '50%',
                border: `3px solid ${t.ink}`, ...material('human', t) }} />
            </div>
            <div data-tray style={{ position: 'absolute', left, top: panelH - 145, width: inner, height: 85,
              background: t.ink, border: `12px solid ${t.inkSoft}`, borderRadius: '12px 12px 30px 30px', boxSizing: 'border-box' }} />
          </div>
          <footer style={{ position: 'absolute', left, top: panelH + 45, width: inner, fontSize: 24,
            fontFamily: HOUSE_FONTS.data, overflowWrap: 'anywhere', opacity: 1 - 0.6 * s.focusAmount }}>{s.params.source}</footer>
          {s.cards.map((card, i) => card.visible && <div key={i} data-song={i + 1} style={{
            position: 'absolute', left: 90 + i * (inner / 2 - 40), top: panelH - 110 + card.payout * 90 - card.lift * 24,
            width: inner / 2, height: tall ? 215 : 180, boxSizing: 'border-box', padding: 22,
            border: `3px solid ${t.ink}`, borderRadius: 16, ...material('human', t),
            boxShadow: `6px 8px 0 ${t.inkSoft}`, opacity: card.payout * card.dim * (1 - card.flip),
            transform: `rotate(${(i ? 7 : -7) * card.payout}deg) rotateX(${card.flip * 90}deg)` }}>
            <div style={{ fontFamily: HOUSE_FONTS.display, fontSize: 36, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{card.title}</div>
            <div style={{ fontFamily: HOUSE_FONTS.data, fontSize: 24, marginTop: 8 }}>▶ {card.length}</div>
            <div style={{ height: 48 }}>{wave(i, card.wave)}</div>
          </div>)}
          {s.cards.some(c => c.visible && c.payout < 1) && [0, 1, 2].map(i => <div key={i} data-wave-coin style={{
            position: 'absolute', left: w / 2 + (i - 1) * 100, top: panelH - 140 + s.cards[0]!.payout * 100,
            width: 65, height: 55, color: t.mint }}>{wave(i)}</div>)}
        </div>
      </div>
    </div>
  </div>
}
export { slotState } from './state'
