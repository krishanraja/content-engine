import { ENTER, EXIT, MOTION, drift, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { resolveTestGrid, type TestGridParams } from './schema'

/** Selectors are row:column pairs, comma-separated; either side may be '*'. */
function select(toState: string, params: TestGridParams): Set<string> {
  const selected = new Set<string>()
  for (const selector of toState.split(',')) {
    const parts = selector.trim().split(':')
    const [rowId, colId] = parts
    if (parts.length !== 2 || !rowId || !colId
      || (rowId !== '*' && !params.rows.some((row) => row.id === rowId))
      || (colId !== '*' && !params.cols.some((col) => col.id === colId))) {
      throw new Error(`test_grid expects row:column selectors, received ${selector}`)
    }
    for (const row of params.rows) for (const col of params.cols) {
      if ((rowId === '*' || rowId === row.id) && (colId === '*' || colId === col.id)) selected.add(`${row.id}:${col.id}`)
    }
  }
  return selected
}

/** Pure, seekable state: all cells exist before entry and revealed values never reset. */
export function testGridStateAt(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const { params, dataset, cells } = resolveTestGrid(object)
  const timeline = stateAt(events, object.obj, frame)
  const stamps = new Map<string, EngineEvent>()
  let entered: EngineEvent | null = null
  let marked: EngineEvent | null = null
  let exited: EngineEvent | null = null
  let highlighted = new Set<string>()
  let carry: EngineEvent | null = null
  let carried = new Set<string>()
  for (const event of timeline.fired) {
    switch (event.verb) {
      case 'enter': entered = event; exited = null; break
      case 'mark': marked ??= event; break
      case 'stamp':
        for (const id of select(event.toState, params)) if (!stamps.has(id)) stamps.set(id, event)
        break
      case 'highlight': highlighted = select(event.toState, params); break
      case 'carry':
        if (!carry) {
          carry = event
          carried = new Set([...highlighted].filter((id) => !stamps.has(id)))
        }
        break
      case 'exit': exited = event; break
    }
  }
  const elapsed = (event: EngineEvent) => stateAt([event], object.obj, frame).sinceFrames
  const entry = entered ? progress(elapsed(entered), MOTION.dropFrames, ENTER) : 0
  const exit = exited ? progress(elapsed(exited), MOTION.exitFrames, EXIT) : 0
  return {
    params,
    unit: dataset.unit,
    denominator: dataset.denominator,
    producerLabel: dataset.producerLabel,
    opacity: entered && frame >= object.fromFrame && frame < object.toFrame ? 1 - exit : 0,
    dropY: -48 * (1 - entry),
    ambient: drift(frame, object.fromFrame, object.toFrame),
    cells: cells.map((cell, index) => {
      const stamp = stamps.get(cell.id)
      const stampProgress = stamp ? progress(elapsed(stamp), MOTION.slapFrames, ENTER) : 0
      const ghostAge = marked ? elapsed(marked) - index * MOTION.staggerFrames : -1
      const isHighlighted = highlighted.has(cell.id)
      const isCarried = carried.has(cell.id) && !stamp
      const carryProgress = isCarried && carry ? progress(elapsed(carry), MOTION.dropFrames, ENTER) : 0
      return {
        ...cell,
        stamped: Boolean(stamp),
        tick: Boolean(stamp) && cell.value > 0,
        stampProgress,
        carried: isCarried,
        carryProgress,
        carryFill: carryProgress,
        ghost: params.answerKey && Boolean(marked) && ghostAge >= 0 && !stamp && !isCarried,
        ghostProgress: params.answerKey && marked ? progress(ghostAge, MOTION.staggerFrames, ENTER) : 0,
        opacity: isCarried || highlighted.size === 0 || isHighlighted ? 1 : 0.35,
        scale: isCarried ? 1 : isHighlighted ? 1.08 : 1,
      }
    }),
  }
}
