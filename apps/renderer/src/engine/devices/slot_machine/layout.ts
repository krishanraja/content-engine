import type { DeviceProps } from '../types'
import type { slotState } from './state'

/** Shared draw geometry, in slot-local pixels (before the outer slot scale). */
export function slotLayout(props: DeviceProps, s: NonNullable<ReturnType<typeof slotState>>) {
  const w = 1000, h = props.box.height / props.box.width * w
  const left = 100, width = 800, pad = 32
  const margin = width * 0.06, available = width - margin * 2
  const inputs = s.texts.map((text, i) => {
    const top = h * (i ? 0.49 : 0.25)
    const zoom = s.focus === (i ? 'style' : 'lyrics') ? s.zoom : 1
    const maxLines = i ? 2 : 4
    const wrap = (value: string, columns: number) => value.split('\n').flatMap(line =>
      line.length ? Array.from({ length: Math.ceil(line.length / columns) }, (_, n) => line.slice(n * columns, (n + 1) * columns)) : [''])
    // Reserve a caret cell; Plex Mono advances are 0.6em, rounded up here.
    // Fit the full value at maximum zoom so typing never changes the type size.
    let font = 30
    const full = i ? s.params.style : s.params.lyrics
    const textHeight = h * (i ? 0.14 : 0.2) - 60
    while (font > 1) {
      const columns = Math.max(1, Math.floor(available / (font * 0.61 * 1.6)) - 1)
      const lines = wrap(full, columns)
      if (lines.length <= maxLines && lines.length * font * 1.6 * 1.4 <= textHeight) break
      font -= 0.25
    }
    const advance = font * 0.61 * zoom
    const columns = Math.max(1, Math.floor(available / advance) - 1)
    const lines = wrap(text, columns)
    const lineWidth = Math.max(...lines.map(line => line.length), 0) * advance
    const caret = lines.at(-1)!.length * advance
    const x = left + pad
    const cameraLeft = lineWidth + advance <= available
      ? margin + (available - lineWidth - advance) / 2
      : Math.max(margin, Math.min(width - margin - lineWidth - advance, width / 2 - caret))
    const dx = cameraLeft - pad
    return { top, zoom, dx, font, x, text: lines.join('\n'), lines, advance,
      charXs: lines.flatMap(line => Array.from(line, (_, j) => x + dx + j * advance)) }
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
  const lever = { left: 850, top: h * 0.34, width: 18, height: Math.min(h * 0.15, 100) }
  const rad = s.lever * Math.PI / 180
  const ball = { x: lever.left + 9 + (lever.height - 5) * Math.sin(rad),
    y: lever.top + lever.height - (lever.height - 5) * Math.cos(rad), radius: 26 }
  return { w, h, left, width, inputs, cards, lever, ball }
}
