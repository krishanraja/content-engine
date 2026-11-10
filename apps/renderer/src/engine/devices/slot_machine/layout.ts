import type { DeviceProps } from '../types'
import type { slotState } from './state'

/** Shared draw geometry, in slot-local pixels (before the outer slot scale). */
export function slotLayout(props: DeviceProps, s: NonNullable<ReturnType<typeof slotState>>) {
  const w = 1000, h = props.box.height / props.box.width * w
  const left = 100, width = 800, pad = 32
  const font = Math.min(30, (width - pad * 2) / (1.6 * 0.61 * Math.max(...s.params.lyrics.split('\n').map(l => l.length), s.params.style.length, 1)))
  const inputs = s.texts.map((text, i) => {
    const top = h * (i ? 0.49 : 0.25)
    const zoom = s.focus === (i ? 'style' : 'lyrics') ? s.zoom : 1
    const lines = text.split('\n')
    const fullWidth = Math.max(...lines.map(l => l.length)) * font * 0.61
    const caret = lines.at(-1)!.length * font * 0.61
    const x = left + pad
    // Follow the caret, constrained by both ends of the complete typed line.
    const dx = Math.max(60 - x, Math.min(w - 60 - x - fullWidth * zoom - font, w / 2 - x - caret * zoom))
    return { top, zoom, dx, font, x, text, charXs: lines.flatMap(line => Array.from(line, (_, j) => x + dx + j * font * 0.61 * zoom)) }
  })
  const cardW = 330, cardH = Math.min(210, h * 0.22)
  const cards = s.cards.map((card, i) => {
    const angle = (i ? 6 : -6) * card.payout
    const left = 155 + i * 355, top = h * 0.60 + (1 - card.payout) * h * 0.08 - card.lift * 16
    const rad = Math.abs(angle) * Math.PI / 180
    const bw = cardW * Math.cos(rad) + cardH * Math.sin(rad)
    const bh = cardH * Math.cos(rad) + cardW * Math.sin(rad)
    return { left, top, width: cardW, height: cardH, angle, bounds: { left: left + (cardW - bw) / 2, top: top + (cardH - bh) / 2, width: bw, height: bh } }
  })
  return { w, h, left, width, inputs, cards }
}
