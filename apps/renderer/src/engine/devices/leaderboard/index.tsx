import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { leaderboardState } from './state'

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = leaderboardState(object, events, frame)
  if (!s.visible) return null
  const tall = aspect === '9:16'
  const width = tall ? box.width : box.width * 2 / 3
  const height = tall ? box.height / 2 : box.height
  const pad = 24, headerHeight = tall ? 76 : 96, footerHeight = object.dataset ? 84 : 48
  const rowHeight = (height - pad * 2 - headerHeight - footerHeight) / s.rows.length
  if (rowHeight < 62 || width < 480) throw new Error('Leaderboard slot too small for legible rows')
  const paint = s.grey ? tokens.cream : s.alternate ? tokens.mint : tokens.channel
  return <div data-device="leaderboard" style={{ position: 'absolute', left: box.left, top: box.top, width, height, overflow: 'hidden', boxSizing: 'border-box' }}>
    <div style={{ position: 'absolute', inset: 0, background: tokens.ink, color: tokens.cream, border: `2px solid ${tokens.inkSoft}`, borderRadius: 18,
      boxSizing: 'border-box', padding: pad, opacity: s.opacity, transform: `translateY(${(1 - s.enter) * height + s.exit * height}px)` }}>
      <div style={{ height: headerHeight, fontFamily: HOUSE_FONTS.structure, fontSize: tall ? 34 : 44, fontWeight: 900, overflow: 'hidden' }}>{s.header}</div>
      <div style={{ position: 'relative', height: rowHeight * s.rows.length }}>
        {s.rows.filter(row => row.reveal > 0).map(row => <div key={row.label} data-row={row.label} data-position={row.position} style={{ position: 'absolute', left: 0, right: 0, height: rowHeight - 6,
          top: row.position * rowHeight, opacity: row.reveal * (1 - s.grey * 0.5), transform: `translateY(${(1 - row.reveal) * 16 - row.lift * 4}px)`,
          background: row.lift ? tokens.inkSoft : tokens.inkDeep, borderRadius: 8, overflow: 'hidden' }}>
          <span style={{ position: 'absolute', left: 12, top: 4, fontFamily: HOUSE_FONTS.display, fontSize: 40 }}>{row.rank}</span>
          <span style={{ position: 'absolute', left: 58, top: 5, maxWidth: '45%', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: HOUSE_FONTS.structure, fontSize: 30 }}>{row.label}</span>
          {row.badge && <span data-badge={row.label} style={{ position: 'absolute', right: 8, top: 4, fontFamily: HOUSE_FONTS.data, fontSize: 30, background: s.grey ? tokens.cream : tokens.channel, color: tokens.ink,
            borderRadius: 24, padding: '0 10px', transform: `scale(${1.2 - row.stamp * 0.2})`, opacity: row.stamp }}>{row.badge}</span>}
          <div style={{ position: 'absolute', left: 58, right: 12, bottom: 8, height: 8, background: tokens.inkSoft }}>
            <div data-bar={row.label} style={{ width: `${row.bar * 100}%`, height: '100%', background: row.lift ? tokens.mint : paint }} />
          </div>
        </div>)}
        <div data-strike={s.strike} style={{ position: 'absolute', left: 0, top: '50%', width: `${s.strike * 100}%`, height: 4, background: tokens.cream }} />
      </div>
      <footer style={{ fontFamily: HOUSE_FONTS.data, fontSize: 30, paddingTop: 8, overflow: 'hidden', height: footerHeight }}>
        {s.note && <div>{s.note}</div>}{object.dataset && <div>{object.dataset.producerLabel}</div>}
      </footer>
    </div>
  </div>
}
