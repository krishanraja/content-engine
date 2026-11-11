import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { drift, HERO, onTwos, progress } from '../../clock'
import type { DeviceProps } from '../types'
import { leaderboardState } from './state'

/** Full-width stage; the wide board stays above the presenter's window. */
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = leaderboardState(object, events, frame)
  if (!s.visible) return null
  const tall = aspect === '9:16'
  const width = box.width
  const height = tall ? box.height / 2 : Math.min(box.height, 660)
  const life = drift(frame, object.fromFrame, object.toFrame, 100)
  const push = 1 + 0.06 * progress(life, 1, HERO)
  const pad = tall ? 38 : 64
  const headerHeight = 148
  const footerHeight = (s.note ? 64 : 0) + (object.dataset?.producerLabel ? 42 : 0) + 16
  const rowHeight = (height - headerHeight - footerHeight - 32) / s.rows.length
  const paint = s.grey ? tokens.cream : tokens.channel
  const grain = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="${onTwos(frame, object.fromFrame)}"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`)
  return <div data-device="leaderboard" style={{ position: 'absolute', left: box.left, top: box.top, width, height, overflow: 'hidden', boxSizing: 'border-box', color: tokens.cream, background: tokens.inkDeep, opacity: s.opacity }}>
    <div data-stage="light" style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(ellipse at 18% 0%, ${tokens.inkSoft}, ${tokens.ink} 48%, ${tokens.inkDeep} 90%)`, transform: `scale(${1 + (push - 1) * 0.5})` }} />
    <div data-floor="shadow" style={{ position: 'absolute', inset: '65% 0 0', opacity: 0.8, backgroundImage: `radial-gradient(ellipse at 50% 65%, ${tokens.inkDeep} 18%, transparent 68%)` }} />
    <div data-grain="film" style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: `url("data:image/svg+xml,${grain}")` }} />
    <div style={{ position: 'absolute', inset: '10px 36px 18px', borderRadius: 30, backgroundImage: `radial-gradient(ellipse at 50% 100%, ${tokens.inkSoft}, ${tokens.inkDeep} 72%)`, transform: `translateY(${(1 - s.enter) * height + s.exit * height}px) perspective(1800px) rotateX(${8 * (1 - progress(life, 1, HERO))}deg) scale(${push})`, transformOrigin: '50% 20%', border: `1px solid ${tokens.inkSoft}`, boxSizing: 'border-box', padding: `0 ${pad - 36}px` }}>
      <div style={{ height: headerHeight, fontFamily: HOUSE_FONTS.display, fontSize: 120, lineHeight: 1.12, textTransform: 'uppercase' }}>{s.header}</div>
      <div style={{ position: 'relative', height: rowHeight * s.rows.length }}>
        {s.rows.filter(row => row.reveal > 0).map(row => {
          const leader = row.rank === 1 ? row.bar : 0
          const lift = Math.max(leader, row.lift)
          return <div key={row.label} data-row={row.label} data-position={row.position} style={{ position: 'absolute', left: 0, right: 0, height: rowHeight - 8, top: row.position * rowHeight, opacity: row.reveal * (1 - s.grey * 0.5), transform: `translate(${(1 - row.reveal) * 96}px, ${-lift * 8}px)`, borderRadius: 24, background: tokens.inkDeep }}>
            <div data-leader-glow={leader} style={{ position: 'absolute', inset: 0, borderRadius: 24, opacity: lift * 0.3, backgroundImage: `radial-gradient(ellipse at 50% 100%, ${paint}, ${tokens.inkDeep} 78%)` }} />
            <span style={{ position: 'absolute', left: 12, top: 0, fontFamily: HOUSE_FONTS.display, fontSize: 120, lineHeight: 1 }}>{row.rank}</span>
            <span style={{ position: 'absolute', left: 100, top: 12, width: 68, height: 68, borderRadius: '50%', background: tokens.cream, color: tokens.ink, fontFamily: HOUSE_FONTS.dek, fontWeight: 600, fontSize: 56, lineHeight: '68px', textAlign: 'center' }}>{row.label.slice(0, 1)}</span>
            <span style={{ position: 'absolute', left: 190, top: 2, fontFamily: HOUSE_FONTS.dek, fontSize: 56, fontWeight: 600, whiteSpace: 'nowrap', maxWidth: '60%', overflow: 'hidden' }}>{row.label}</span>
            <div style={{ position: 'absolute', left: 190, right: 24, bottom: 10, height: Math.max(12, Math.min(36, rowHeight - 90)), borderRadius: 30, background: tokens.inkSoft, overflow: 'hidden' }}>
              <div data-bar={row.label} style={{ width: `${row.bar * 100}%`, height: '100%', borderRadius: 30, background: paint, backgroundImage: `linear-gradient(90deg, ${tokens.inkSoft}, ${paint} 45%, ${s.alternate && row.rank === 1 ? tokens.mint : paint})`, overflow: 'hidden' }}>
                <div data-sweep={row.label} style={{ width: '100%', height: '100%', opacity: 0.45, backgroundImage: `linear-gradient(105deg, transparent 35%, ${tokens.cream} 50%, transparent 65%)`, transform: `translateX(${-90 + life * 180}%)` }} />
              </div>
            </div>
            {row.badge && <span data-badge={row.label} style={{ position: 'absolute', right: 24, top: 0, fontFamily: HOUSE_FONTS.dek, fontWeight: 600, fontSize: 56, lineHeight: 1.1, background: paint, color: tokens.ink, padding: '4px 16px', transformOrigin: 'center', transform: `scale(${1.04 - row.stamp * 0.04}, ${0.7 + row.stamp * 0.3})`, opacity: row.stamp }}>{row.badge}</span>}
          </div>
        })}
        <div data-strike={s.strike} style={{ position: 'absolute', left: 0, top: '50%', width: `${s.strike * 100}%`, height: 4, background: tokens.cream }} />
      </div>
      {(s.note || object.dataset?.producerLabel) && <footer style={{ position: 'relative', paddingTop: 8 }}>
        {s.note && <div data-note="annotation" style={{ fontFamily: HOUSE_FONTS.dek, fontSize: 56, fontWeight: 600, lineHeight: 1 }}>{s.note}</div>}
        {object.dataset?.producerLabel && <div data-producer="source" style={{ fontFamily: HOUSE_FONTS.data, fontSize: 30, lineHeight: 1.3 }}>{object.dataset.producerLabel}</div>}
      </footer>}
    </div>
  </div>
}
