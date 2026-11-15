import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { Focus } from '../../kit/focus'
import type { DeviceProps } from '../types'
import { codeState } from './state'

// Independent aspect layouts, in slot pixels; code is never wrapped or shrunk.
export function codeGeometry(box: DeviceProps['box'], aspect: DeviceProps['aspect']) {
  return aspect === '9:16'
    ? { left: box.left + 24, top: box.top + 240, width: 1032, pad: 20, header: 160, line: 64 }
    : { left: box.left + 72, top: box.top + 100, width: 1776, pad: 32, header: 130, line: 64 }
}
export function codeFocus(p: Pick<DeviceProps, 'object' | 'events' | 'box' | 'aspect' | 'frame'>): Focus | undefined {
  const target = (frame: number) => {
    const s = codeState({ ...p, frame })
    if (!s || s.out > 0) return undefined
    const row = s.rows.find(r => r.caret) ?? s.rows.find(r => r.id === s.highlighted)
    return row ? row.id : undefined
  }
  const id = target(p.frame)
  if (!id) return undefined
  const s = codeState(p)!
  const g = codeGeometry(p.box, p.aspect)
  const rect = (key: string) => ({ left: g.left + g.pad + 70, top: g.top + g.header + s.rows.findIndex(r => r.id === key) * g.line,
    width: Math.max(28, Array.from(s.params.lines.find(r => r.id === key)!.text).length * 26.4 + 16), height: g.line })
  for (let since = 0; since < 60; since++) {
    const before = target(p.frame - since - 1)
    if (before !== id) return { rect: rect(id), since, ...(before ? { from: rect(before) } : {}) }
  }
  return { rect: rect(id), since: 60 }
}

export function Device(p: DeviceProps) {
  const s = codeState(p)
  if (!s) return null
  const g = codeGeometry(p.box, p.aspect), t = p.tokens
  const syntax = (text: string) => text.split(/((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\/\/.*|#.*)/g).filter(Boolean).map((part, i) =>
    <span key={i} style={{ color: /^(\/\/|#)/.test(part) ? t.inkSoft : /^["']/.test(part) ? t.mint : t.cream }}>{part}</span>)
  return <div data-code-card="" style={{ position: 'absolute', left: g.left, top: g.top, width: g.width,
    background: t.inkDeep, color: t.cream, fontFamily: HOUSE_FONTS.data, padding: g.pad, boxSizing: 'border-box',
    opacity: s.enter * (1 - s.out), transform: `translateY(${(1 - s.enter) * 48 + s.out * 48}px)` }}>
    <header style={{ height: g.header - g.pad, fontSize: 24, overflowWrap: 'anywhere' }}>
      {s.params.file.label}<br />{s.params.file.path}<br />{s.params.file.revision} · {s.params.file.date}
    </header>
    {s.rows.map((r, i) => <div key={r.id} data-line={r.id} style={{ height: g.line, display: 'flex', alignItems: 'center',
      opacity: r.opacity, background: r.id === s.highlighted ? `color-mix(in srgb, ${t.mint} 18%, transparent)` : 'transparent',
      fontSize: 44, lineHeight: `${g.line}px`, whiteSpace: 'pre' }}>
      <span style={{ color: t.inkSoft, width: 70, flexShrink: 0 }}>{i + 1}</span>
      <span>{syntax(r.text)}{r.caret && <span data-caret="" style={{ display: 'inline-block', width: 4, height: 44, background: t.cream, verticalAlign: 'middle' }} />}</span>
    </div>)}
  </div>
}
