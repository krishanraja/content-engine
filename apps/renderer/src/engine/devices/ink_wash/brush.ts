// The hand-drawn geometry is the shared move's geometry, used by SVG and canvas alike.
import { handCircle, handUnderline } from '../../../../../../packages/moves/freeze-circle-magnify/move.mjs'

export type BrushShape = 'circle' | 'underline'
export function brushPath(shape: BrushShape, box: readonly number[], seed: number): string {
  const commands: string[] = []
  const recorder = {
    save() {}, restore() {}, beginPath() {}, stroke() {},
    moveTo(x: number, y: number) { commands.push(`M ${x} ${y}`) },
    lineTo(x: number, y: number) { commands.push(`L ${x} ${y}`) },
    quadraticCurveTo(x: number, y: number, ex: number, ey: number) { commands.push(`Q ${x} ${y} ${ex} ${ey}`) },
  }
  // Shared move coordinates are pixels; convert its house brush dimensions to unit-space.
  const pixels = box.map(v => v * 1000)
  if (shape === 'circle') handCircle(recorder, ...pixels, 1, '', 8, seed)
  else handUnderline(recorder, [pixels], 1, '', 8)
  return commands.join(' ')
}
