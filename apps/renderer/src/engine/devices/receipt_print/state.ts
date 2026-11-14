import { EXIT, MOTION, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

/** Character.ai study/card: 250 px rise, -3 to -1.5 degrees, 1 degree settle;
 *  three-frame 2 px print jolt, four-frame line fade, eight-frame state dissolve. */
export const PRINT = { risePx: 250, startDeg: -3, restDeg: -1.5, settleFrames: 8,
  joltPx: 2, joltFrames: 3, lineFrames: 4, dissolveFrames: 8 } as const
const linear = (t: number) => t
const easeOut = (t: number) => 1 - (1 - t) ** 3

export function receiptState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const dataset = object.dataset
  if (!dataset?.rows.length || dataset.rows.some(row => !Number.isFinite(row.value)) ||
    (dataset.denominator !== null && !Number.isFinite(dataset.denominator))) {
    throw new Error('receipt_print requires a finite, nonempty dataset with a producer')
  }
  if (new Set(dataset.rows.map(row => row.label)).size !== dataset.rows.length) {
    throw new Error('receipt_print dataset row labels must be unique')
  }
  const { fired } = stateAt(events, object.obj, frame)
  const entrance = fired.findLast(event => event.verb === 'enter')
  const visibility = fired.findLast(event => event.verb === 'enter' || event.verb === 'exit')
  const since = (cue: EngineEvent) => stateAt([cue], object.obj, frame).sinceFrames
  const exit = visibility?.verb === 'exit' ? progress(since(visibility), MOTION.exitFrames, EXIT) : 0
  const format = (value: number) => `${value}${dataset.denominator === null ? '' : `/${dataset.denominator}`}${dataset.unit ? ` ${dataset.unit}` : ''}`
  // Read the active motion timing at draw time, capped at the signed entrance floor.
  const enterFrames = Math.min(10, MOTION.enterFrames)
  const age = entrance ? since(entrance) : 0
  const rise = entrance ? progress(age, enterFrames, easeOut) : 0
  const settle = progress(age - enterFrames, PRINT.settleFrames, linear)
  // A single finite wobble, reaching +1 degree, then -0.5, then rest. Never loops.
  const wobble = settle < 0.25 ? settle * 4 : settle < 0.625
    ? 1 - (settle - 0.25) * 4 : -0.5 + (settle - 0.625) * 4 / 3
  const lines = params.lines.map(line => {
    const row = dataset.rows.find(row => row.label === line.row)
    if (!row) throw new Error(`receipt_print missing dataset row: ${line.row}`)
    // Repeated adds are idempotent: one physical printed line, one jolt.
    const cue = fired.find(event => (event.verb === 'add' || event.verb === 'fill') && event.toState === line.key)
    return { key: line.key, label: row.label, value: row.value,
      figure: format(row.value),
      cue, printed: !!cue, opacity: cue ? progress(since(cue) + 1, PRINT.lineFrames, linear) : 0 }
  })
  const lastPrint = lines.flatMap(line => line.cue ? [line.cue] : []).sort((a, b) => a.atFrame - b.atFrame).at(-1)
  const printAge = lastPrint ? since(lastPrint) : Infinity
  const ghost = printAge >= 0 && printAge < PRINT.joltFrames
  const highlights = fired.filter(event => event.verb === 'highlight' && lines.some(line =>
    line.key === event.toState && line.cue && line.cue.atFrame <= event.atFrame))
  const highlight = highlights.at(-1)
  // Replay counts to keep an interrupted roll continuous and random-access seeking pure.
  let count: EngineEvent | undefined, from = 0, target = 0
  const sample = (at: number) => {
    if (!count) return 0
    const amount = progress(stateAt([count], object.obj, at).sinceFrames, MOTION.countFrames, linear)
    const places = Number.isInteger(target) ? 0 : Math.min(2, (String(target).split('.')[1] ?? '').length)
    return amount === 1 ? target : Math.round((from + (target - from) * amount) * 10 ** places) / 10 ** places
  }
  for (const event of fired.filter(event => event.verb === 'count_to')) {
    const line = params.lines.find(line => line.key === event.toState)
    const row = dataset.rows.find(row => row.label === (line?.row ?? event.toState)) ??
      dataset.rows.find(row => row.value === Number(event.toState))
    if (!row) throw new Error('receipt_print count_to must select a dataset value')
    from = sample(event.atFrame)
    target = row.value
    count = event
  }
  const stamp = fired.findLast(event => event.verb === 'stamp')
  return {
    visible: frame >= object.fromFrame && frame < object.toFrame && !!entrance && exit < 1,
    title: params.title, lines, producerLabel: dataset.producerLabel,
    unit: dataset.unit, denominator: dataset.denominator,
    opacity: (0.4 + 0.6 * rise) * (1 - exit), y: PRINT.risePx * (1 - rise) + PRINT.risePx * exit,
    tilt: PRINT.startDeg + (PRINT.restDeg - PRINT.startDeg) * rise + (rise === 1 ? wobble : 0),
    jolt: ghost ? (printAge === 1 ? -PRINT.joltPx : PRINT.joltPx) : 0,
    ghost, highlighted: highlight?.toState, previousHighlight: highlights.at(-2)?.toState,
    dissolve: highlight ? progress(since(highlight), PRINT.dissolveFrames, linear) : 1,
    total: count ? { value: sample(frame), target, figure: format(sample(frame)) } : undefined,
    // Reserve for every sourced target, including interrupted counts, so paper never resizes.
    totalFigures: [format(0), ...dataset.rows.map(row => format(row.value))],
    stampText: params.stampText, stamped: !!stamp,
    stampProgress: stamp ? progress(since(stamp), MOTION.slapFrames, linear) : 0,
  }
}
