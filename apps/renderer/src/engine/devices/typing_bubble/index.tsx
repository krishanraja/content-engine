import { MAX_GROW, isRegion } from '../../kit/layout'
import React from 'react'
import { textWidth, wrapWords } from '../../../house/metrics'
import { font } from '../../kit/typeRole'
import { cardsInvert } from '../../kit/overlays'
import { EXIT, MOTION, drift, progress, stateAt, typingProgress } from '../../clock'
import type { Focus } from '../../kit/focus'
import { typedText } from '../../kit/reveal'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'

export function bubbleState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>) {
  const params = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.filter(e => e.verb === 'enter').at(-1)
  if (!enter) return null
  const active = fired.filter(e => e.atFrame >= enter.atFrame)
  const exit = active.filter(e => e.verb === 'exit').at(-1)
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out >= 1) return null
  const pick = active.filter(e => e.verb === 'pick').at(-1)
  const index = (value: string, count: number) => {
    if (!/^\d+$/.test(value) || Number(value) >= count) throw new Error('typing_bubble event needs a valid zero-based index')
    return Number(value)
  }
  for (const e of active.filter(e => e.verb === 'type')) index(e.toState, params.rows.length)
  const picked = pick ? index(pick.toState, params.kind === 'choice' ? params.options!.length : 0) : null
  const send = active.filter(e => e.verb === 'send').at(-1)
  return { params, out, enter: progress(frame - enter.atFrame, MOTION.slapFrames), picked,
    pickProgress: pick ? progress(frame - pick.atFrame, MOTION.slapFrames) : 0,
    sent: !!send, sendProgress: send ? progress(frame - send.atFrame, MOTION.slapFrames) : 0,
    rows: params.rows.map((row, i) => {
      const cue = active.filter(e => e.verb === 'type' && Number(e.toState) === i).at(-1)
      if (!cue) return { ...row, text: '', caret: false, cueFrame: -1, visible: false, dots: false }
      // The next cue bounds the span; unrelated objects cannot alter typing speed.
      const end = Math.min(object.toFrame, ...events.filter(e => e.obj === object.obj && e.atFrame > cue.atFrame).map(e => e.atFrame))
      const span = Math.max(1, end - cue.atFrame)
      const lead = params.kind === 'chat' ? Math.min(MOTION.staggerFrames, span / 4) : 0
      const p = typingProgress(frame, cue, Math.max(1, span - lead), lead)
      // The house spreads the text over its span; a typing style types it at its own rate (kit/reveal.ts).
      const opening = cue.atFrame === 0 && frame >= 0
      const typed = typedText(row.text, opening ? Number.POSITIVE_INFINITY : frame - cue.atFrame - lead, Math.max(1, span - lead), p)
      return { ...row, text: typed.text, caret: typed.caret, cueFrame: cue.atFrame,
        visible: true, dots: !typed.done && frame < cue.atFrame + lead }
    }),
  }
}

const LINE = 57.2 // 44 px at a 1.3 line height

/** The card's frame box and the geometry its rows are laid out on, as Device draws it. */
function cardGeometry(params: ReturnType<typeof ParamsSchema.parse>, objectParams: unknown, box: DeviceProps['box'], aspect: DeviceProps['aspect']) {
  const tall = aspect === '9:16'
  const layout = tall ? { width: 0.9, top: 0.12, padding: 40 } : { width: 0.64, top: 0.08, padding: 36 }
  const stage = box.left === 0 && box.top === 0 && box.height === (tall ? 1920 : 1080)
  const stageBox = stage ? stageBubbleBox(objectParams, box.width, box.height) : undefined
  const width = stageBox?.width ?? Math.max(920, box.width * layout.width)
  const left = box.left + (box.width - width) / 2
  const top = stageBox?.top ?? box.top + box.height * layout.top
  const header = params.kind === 'chat' ? 150 : params.kind === 'order' ? 120 : params.kind === 'email' ? 203 : 0
  return { left, top, width, padding: layout.padding + 1, inner: width - 2 * layout.padding - 2, header }
}

/** The line being typed (or the last line typed), in the device's own box pixels, and which row and line it is. */
function typedLine(s: NonNullable<ReturnType<typeof bubbleState>>, objectParams: unknown, box: DeviceProps['box'], aspect: DeviceProps['aspect']) {
  const g = cardGeometry(s.params, objectParams, box, aspect)
  const chat = s.params.kind === 'chat'
  const active = s.rows.reduce<number>((best, row, i) => row.visible && (best < 0 || (row.cueFrame ?? -1) >= (s.rows[best]!.cueFrame ?? -1)) ? i : best, -1)
  if (active < 0) return undefined
  let top = g.top + g.padding + g.header
  for (let i = 0; i < active; i++) {
    const row = s.rows[i]!
    if (!row.visible) continue
    top += 28 + 2 + (chat ? 48 : 40) + wrapWords('archivo600', row.text || ' ', 44, chat ? g.inner * 0.86 - 58 : g.inner - 50).length * LINE +
      (row.who && !chat && s.params.kind !== 'email' ? 69.2 : 0)
  }
  const row = s.rows[active]!
  const full = s.params.rows[active]!.text
  const lines = wrapWords('archivo600', full, 44, chat ? g.inner * 0.86 - 58 : g.inner - 50)
  // The line holding the last typed character.
  let typed = Array.from(row.text).length, line = 0
  for (; line < lines.length - 1; line++) {
    const length = Array.from(lines[line]!.join(' ')).length + 1
    if (typed <= length) break
    typed -= length
  }
  const width = textWidth('archivo600', lines[line]!.join(' '), 44)
  const textTop = top + 1 + (chat ? 24 : 20) + (row.who && !chat && s.params.kind !== 'email' ? 69.2 : 0) + line * LINE
  const pad = chat ? 28 : 24
  const right = chat && row.side === 'right'
  const left = right ? g.left + g.padding + g.inner - 1 - pad - width : g.left + g.padding + 1 + pad
  return { key: `${active}:${line}`, rect: { left, top: textTop, width, height: LINE } }
}

/** living-ui's camera target (kit/focus.ts): the line being typed, in the device's own box pixels. It moves from
 *  line to line as typing goes on, and reports how long it has been on this line. */
export function bubbleFocus({ object, events, box, aspect, frame }: Pick<DeviceProps, 'object' | 'events' | 'box' | 'aspect' | 'frame'>): Focus | undefined {
  const at = (f: number) => {
    const s = bubbleState({ object, events, frame: f })
    return s && s.out === 0 ? typedLine(s, object.params, box, aspect) : undefined
  }
  const now = at(frame)
  if (!now) return undefined
  let since = 0
  for (; since < 60; since++) {
    const before = at(frame - since - 1)
    if (before?.key !== now.key) return { rect: now.rect, since, ...(before ? { from: before.rect } : {}) }
  }
  return { rect: now.rect, since }
}

/** Completed card bounds anchor the top while event-revealed rows grow downward. */
export function stageBubbleBox(params: unknown, canvasWidth = 1080, canvasHeight = 1920) {
  const p = ParamsSchema.parse(params)
  // Tall: 900 px from x 60, clear of Instagram's like rail at x 960 (config/channel-safe-zones.json).
  const width = canvasWidth === 1080 ? 900 : 1280
  const inner = width - 82
  const lines = (text: string, room: number, font: 'archivo600' = 'archivo600') =>
    Math.max(1, wrapWords(font, text, 44, room).length)
  const rows = p.rows.reduce((height, row) => height + 28 + 2 +
    (p.kind === 'chat' ? 48 : 40) + lines(row.text, p.kind === 'chat' ? inner * 0.86 - 58 : inner - 50) * 57.2 +
    (row.who && p.kind !== 'chat' && p.kind !== 'email' ? 69.2 : 0), 0)
  const header = p.kind === 'chat' ? 150 : p.kind === 'order' ? 120 : p.kind === 'email' ? 203 : 0
  const footer = (p.kind === 'chat' ? 79 : 0) + (p.status ? 79 : 0)
  const options = (p.options ?? []).reduce((h, text) => h + 24 + 55 + 12 + 50 + lines(text, inner - 120) * 57.2, 0)
  const height = 82 + header + rows + footer + options
  const bandTop = canvasHeight === 1920 ? 220 : 180
  const bandBottom = canvasHeight === 1920 ? 1207 : 900
  return { left: canvasWidth === 1080 ? 60 : (canvasWidth - width) / 2, top: Math.max(bandTop, (bandTop + bandBottom - height) / 2), width, height }
}

// Existing copy slots: who supplies chat names, order product names and email
// subject/recipient; text remains the event-revealed message or product detail.
export function Device(props: DeviceProps) {
  const { object, events, box, tokens, aspect, frame } = props
  // In a layout region (kit/layout.ts, kit/staging.ts) the card lays out at its house width and is scaled to the
  // region's width, so it never overhangs the region's edge (it is at least 920 wide, wider than an 800 region).
  if (isRegion(box)) {
    const natural = 920, g = Math.min(MAX_GROW, box.width / natural)
    return <div data-region-fit="" style={{ position: 'absolute', left: box.left, top: box.top, width: natural,
      height: box.height / g, transformOrigin: '0 0', transform: `scale(${g})` }}>
      <Device {...props} box={{ left: 0, top: -box.height / g * 0.1, width: natural, height: box.height / g }} />
    </div>
  }
  const s = bubbleState({ object, events, frame })
  if (!s) return null
  const tall = aspect === '9:16'
  const layout = tall ? { width: 0.9, top: 0.12, padding: 40, gap: 28 }
    : { width: 0.64, top: 0.08, padding: 36, gap: 22 }
  const stage = box.left === 0 && box.top === 0 && box.height === (tall ? 1920 : 1080)
  const stageBox = stage ? stageBubbleBox(object.params, box.width, box.height) : undefined
  const width = stageBox?.width ?? Math.max(920, box.width * layout.width)
  const { kind } = s.params
  const name = s.rows.find(row => row.visible && row.who)?.who
  const initials = name?.split(/\s+/).map(word => Array.from(word)[0]).slice(0, 2).join('')
  const edge = `color-mix(in srgb, ${tokens.inkSoft} 20%, ${tokens.cream})`
  const ground = tokens.cream
  // On an inverted card (a dark-ground style) type on a mint fill stays dark so it reads; the house sets no colour here.
  const onMint: React.CSSProperties = cardsInvert() ? { color: tokens.inkDeep } : {}
  const label: React.CSSProperties = { fontFamily: font('data'), fontSize: 44, lineHeight: 1.25 }
  const heading: React.CSSProperties = { fontFamily: font('structure'), fontSize: 56, fontWeight: 700, lineHeight: 1.15 }
  return <div data-kind={kind} style={{ position: 'absolute', left: stageBox?.left ?? box.left + (box.width - width) / 2,
    top: stageBox?.top ?? box.top + box.height * layout.top, width, boxSizing: 'border-box', padding: layout.padding,
    borderRadius: 36, background: ground, color: tokens.ink, border: `1px solid ${edge}`,
    boxShadow: `0 28px 64px color-mix(in srgb, ${tokens.inkDeep} 14%, transparent), 0 4px 12px color-mix(in srgb, ${tokens.inkDeep} 6%, transparent), 0 0 50px color-mix(in srgb, ${tokens.mint} 30%, transparent)`,
    fontFamily: font('structure'), fontSize: 44, lineHeight: 1.3,
    opacity: s.enter * (1 - s.out), transformOrigin: '50% 30%',
    transform: `translateY(${(1 - s.enter) * 50 + s.out * 80}px) scale(${0.92 + 0.08 * s.enter})` }}>
    {kind === 'chat' && <header data-chat-header style={{ display: 'flex', alignItems: 'center', gap: 24,
      paddingBottom: 28, marginBottom: 28, borderBottom: `2px solid ${edge}` }}>
      <div data-avatar style={{ width: 92, height: 92, borderRadius: '50%', background: tokens.mint,
        display: 'grid', placeItems: 'center', fontWeight: 700, ...onMint }}>{initials}</div>
      <div style={{ flex: 1 }}><div style={heading}>{name}</div>
        <div style={{ ...label, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: tokens.mint, border: `1px solid ${tokens.ink}` }} />online
        </div>
      </div>
      <span aria-hidden style={{ fontSize: 52 }}>‹</span>
    </header>}
    {kind === 'order' && <header data-order-header style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
      <span style={{ width: 88, height: 88, borderRadius: '50%', display: 'grid', placeItems: 'center', background: tokens.mint, ...onMint }}>✓</span>
      <div style={heading}>Order placed</div>
    </header>}
    {kind === 'email' && <header data-email-header style={{ paddingBottom: 28, marginBottom: 28, borderBottom: `2px solid ${edge}` }}>
      <div data-subject style={{ ...heading, marginBottom: 20 }}>{name}</div>
      <div data-to-chip style={{ ...label, display: 'inline-flex', padding: '12px 20px', borderRadius: 24,
        border: `1px solid ${edge}`, background: tokens.cream }}>To: {s.rows.filter(row => row.visible && row.who)[1]?.who}</div>
    </header>}
    {s.rows.map((row, i) => row.visible && <div key={i} data-row={i} data-product-row={kind === 'order' || undefined}
      style={{ display: 'flex', justifyContent: kind === 'chat' && row.side === 'right' ? 'flex-end' : 'flex-start', marginBottom: layout.gap }}>
      <div data-bubble-side={kind === 'chat' ? row.side ?? 'left' : undefined} style={{
        maxWidth: kind === 'chat' ? '86%' : '100%', width: kind === 'chat' ? undefined : '100%',
        padding: kind === 'chat' ? '24px 28px' : '20px 24px', borderRadius: 24,
        background: kind === 'chat' && row.side === 'right' ? tokens.mint : tokens.cream,
        ...(kind === 'chat' && row.side === 'right' ? onMint : {}),
        border: `1px solid ${edge}`, overflowWrap: 'anywhere' }}>
        {row.who && kind !== 'chat' && kind !== 'email' && <div style={{ fontWeight: 700, marginBottom: 12 }}>{row.who}</div>}
        {row.dots ? <span data-typing-dots="true" style={{ display: 'flex', gap: 12, padding: '16px 4px' }}>
          {[0, 1, 2].map(dot => {
            const push = drift(frame, object.fromFrame, object.toFrame, MOTION.driftPct * (dot + 1))
            return <span key={dot} data-dot style={{ width: 16, height: 16, borderRadius: '50%', background: tokens.inkSoft,
              transform: `translateY(${-push * 280}px) scale(${0.8 + push * 8})` }} />
          })}
        </span> : <span data-body style={{ whiteSpace: 'pre-wrap' }}>{row.text}{row.caret && <span data-caret style={{ display: 'inline-block',
          width: 0, height: '1.05em', verticalAlign: '-0.18em', boxShadow: `0 0 0 2px ${tokens.ink}` }} />}</span>}
      </div>
    </div>)}
    {kind === 'choice' && s.params.options!.map((option, i) => <section key={i} data-section style={{ marginTop: 24 }}>
      <div style={{ ...label, marginBottom: 12 }}>{String.fromCharCode(65 + i)}</div>
      <div data-picked={s.picked === i} style={{ display: 'flex', alignItems: 'center', gap: 24,
        padding: '24px', background: tokens.cream, border: `1px solid ${edge}`, borderRadius: 24 }}>
        <span data-radio style={{ position: 'relative', width: 44, height: 44, flexShrink: 0,
          border: `3px solid ${tokens.ink}`, borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
          {s.picked === i && <>
            <span data-radio-ring style={{ position: 'absolute', inset: -8, borderRadius: '50%',
              border: `3px solid ${tokens.mint}`, opacity: 1 - s.pickProgress,
              transform: `scale(${1 + s.pickProgress * 0.6})` }} />
            <span data-radio-dot="true" style={{ width: 28, height: 28, borderRadius: '50%', background: tokens.mint,
              transform: `scale(${s.pickProgress})` }} />
          </>}
        </span><span style={{ overflowWrap: 'anywhere' }}>{option}</span>
      </div>
    </section>)}
    {kind === 'chat' && s.rows.some(row => row.visible) && <div data-timestamp style={{ ...label, marginTop: 24 }}>
      {s.params.status}
    </div>}
    {s.sent && <div data-status style={{ ...label, textAlign: 'right', marginTop: 24,
      opacity: s.sendProgress, transform: `translateX(${(1 - s.sendProgress) * 18}px)` }}>
      {kind === 'chat' ? <><span data-delivered-ticks>✓✓</span> Delivered</> : s.params.status}
    </div>}
  </div>
}
