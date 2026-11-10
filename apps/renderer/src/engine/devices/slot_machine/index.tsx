import React from 'react'
import { Img } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { material } from './hatch'
import { slotState } from './state'
import { slotLayout } from './layout'

export function Device(props: DeviceProps) {
  const s = slotState(props)
  if (!s) return null
  const { box, tokens: t } = props
  const l = slotLayout(props, s), { w, h } = l
  const shadow = `0 18px 40px color-mix(in srgb, ${t.ink} 25%, transparent)`
  const wave = (seed: number, moving = 0) => <svg viewBox="0 0 240 72" width="100%" height="100%" aria-hidden>
    {Array.from({ length: 32 }, (_, j) => {
      const height = 8 + 48 * Math.abs(Math.sin(j * 1.71 + seed + moving * 9))
      return <rect key={j} x={j * 7.5} y={(72 - height) / 2} width="4" height={height} rx="2" fill="currentColor" />
    })}
  </svg>
  return <div data-device="slot_machine" style={{ position: 'absolute', ...box, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', width: w, height: h, transformOrigin: 'top left', transform: `scale(${box.width / w})` }}>
      <div style={{ opacity: s.entrance * (1 - s.out), transform: `translateY(${(1 - s.entrance + s.out) * h}px)`, fontFamily: HOUSE_FONTS.structure, color: t.ink }}>
        <div style={{ position: 'absolute', left: 100, top: h * 0.1, width: 800, height: h * 0.8, borderRadius: 36,
          background: s.reelGrow ? t.ink : t.cream, border: `2px solid ${t.inkSoft}`, boxSizing: 'border-box', boxShadow: shadow }} />
        <header style={{ position: 'absolute', left: 132, top: h * 0.12, width: 736, color: s.reelGrow ? t.cream : t.ink }}>
          {s.params.logo ? <Img src={s.params.logo} style={{ width: 120, height: 42, objectFit: 'contain' }} /> : <div style={{ fontSize: 42, fontWeight: 900 }}>Suno</div>}
          <div data-source style={{ fontFamily: HOUSE_FONTS.data, fontSize: 19, lineHeight: 1.4 }}>{s.params.source}</div>
        </header>
        {l.inputs.map((input, i) => <section key={i} data-input={i ? 'style' : 'lyrics'} style={{ position: 'absolute',
          left: 100, top: input.top * (1 - s.inputCollapse) + h * 0.2 * s.inputCollapse, width: 800,
          height: h * (i ? 0.14 : 0.2) * (1 - s.inputCollapse), borderRadius: 16, background: t.cream,
          border: `2px solid ${t.inkSoft}`, opacity: (1 - s.inputCollapse) * (s.focus === (i ? 'style' : 'lyrics') ? 1 : 1 - 0.6 * s.focusAmount),
          transformOrigin: '50% 0', transform: `scale(${1 - 0.2 * s.inputCollapse})` }}>
          <div style={{ margin: '12px 32px', fontSize: 24, fontWeight: 700 }}>{i ? 'Style of music' : 'Lyrics'}</div>
          <div data-camera style={{ position: 'absolute', left: 32 + input.dx, top: 48, fontFamily: HOUSE_FONTS.data,
            fontSize: input.font, lineHeight: 1.4, whiteSpace: 'pre', transformOrigin: 'top left', transform: `scale(${input.zoom})` }}>
            {input.text}{s.caret && s.inputCollapse === 0 && s.focus === (i ? 'style' : 'lyrics') && <span data-caret>▎</span>}
          </div>
        </section>)}
        <div style={{ position: 'absolute', left: 132, top: h * 0.72, width: 736, height: h * 0.1, borderRadius: 16,
          display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 700, ...material('human', t),
          opacity: (1 - s.inputCollapse) * (1 - 0.6 * s.focusAmount), transform: `translateY(${s.pressed}px)` }}>Create</div>
        <div data-machine style={{ opacity: s.reelGrow, transform: `scaleY(${s.reelGrow})`, transformOrigin: `500px ${h * 0.25}px` }}>
          <div style={{ position: 'absolute', left: 132, top: h * 0.29, width: 690, height: h * 0.31,
            padding: 14, boxSizing: 'border-box', background: t.cream, borderRadius: 24, display: 'flex', gap: 16 }}>
            {s.reels.map((reel, i) => <div key={i} data-reel={i + 1} data-spinning={reel.spinning} style={{ position: 'relative', flex: 1,
              overflow: 'hidden', borderRadius: 18, background: t.inkSoft, perspective: 500 }}>
              <div style={{ position: 'absolute', inset: 0, transform: `translateY(${reel.offset}px)` }}>
                {Array.from({ length: 20 }, (_, tile) => <div key={tile} style={{ height: 120, padding: '12px 20px', boxSizing: 'border-box',
                  borderRadius: '50% / 18%', transform: `rotateX(${tile % 2 ? -12 : 12}deg)`, color: t.cream, ...material('ai', t) }}>{wave(tile + i)}</div>)}
              </div>
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${t.ink} 0%, transparent 35%, transparent 65%, ${t.ink} 100%)`, pointerEvents: 'none' }} />
            </div>)}
          </div>
          <div data-lever data-angle={s.lever} style={{ position: 'absolute', left: 850, top: h * 0.34, width: 18, height: h * 0.15,
            transformOrigin: '50% 100%', transform: `rotate(${s.lever}deg)`, borderRadius: 12, background: t.inkSoft }}>
            <div style={{ position: 'absolute', top: -18, left: -14, width: 46, height: 46, borderRadius: '50%', background: t.mint, border: `3px solid ${t.ink}` }} />
          </div>
          <div data-tray style={{ position: 'absolute', left: 150, top: h * 0.86, width: 700, height: h * 0.045,
            borderRadius: '12px 12px 24px 24px', background: t.inkDeep, borderTop: `8px solid ${t.inkSoft}`, boxShadow: `inset 0 -6px 0 ${t.cream}` }} />
        </div>
        {s.cards.map((card, i) => { const c = l.cards[i]!; return card.visible && <div key={i} data-song={i + 1} style={{ position: 'absolute',
          left: c.left, top: c.top, width: c.width, height: c.height, padding: 14, boxSizing: 'border-box', borderRadius: 16,
          background: t.mint, border: `2px solid ${t.ink}`, boxShadow: shadow, opacity: card.payout * card.dim * (1 - card.flip),
          transform: `rotate(${c.angle}deg) rotateX(${card.flip * 90}deg)` }}>
          <div style={{ fontWeight: 700, fontSize: Math.min(30, h * 0.03), lineHeight: 1.1 }}>{card.title}</div>
          <div style={{ fontFamily: HOUSE_FONTS.data, fontSize: 18, marginTop: 6 }}>▶ {card.length}</div>
          <div style={{ height: c.height * 0.18 }}>{wave(i, card.wave)}</div>
        </div> })}
      </div>
    </div>
  </div>
}
export { slotState } from './state'
