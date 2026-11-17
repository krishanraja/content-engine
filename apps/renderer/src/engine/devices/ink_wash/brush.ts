// The hand-drawn geometry is the shared move's geometry, used by SVG and canvas alike.
// @ts-ignore shared move library
import { handCircle, handUnderline } from '@mymu/moves/freeze-circle-magnify/move.mjs'

export type BrushShape = 'circle' | 'underline'
/** The shared move's hand-drawn circle or underline as an SVG path, for a box in pixels. */
export function brushPath(shape: BrushShape, box: readonly [number, number, number, number], seed: number): string {
  const commands: string[] = []
  const recorder = {
    save() {}, restore() {}, beginPath() {}, stroke() {},
    moveTo(x: number, y: number) { commands.push(`M ${x} ${y}`) },
    lineTo(x: number, y: number) { commands.push(`L ${x} ${y}`) },
    quadraticCurveTo(x: number, y: number, ex: number, ey: number) { commands.push(`Q ${x} ${y} ${ex} ${ey}`) },
  }
  if (shape === 'circle') handCircle(recorder, ...box, 1, '', 8, seed)
  else handUnderline(recorder, [box], 1, '', 8)
  return commands.join(' ')
}
