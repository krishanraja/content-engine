import { ENTER, EXIT, FPS, MOTION, overshootEase, progress, stateAt } from '../../clock'
import { drawPath } from '../../kit/verbs'
import type { EngineObject, EngineEvent } from '../../props'
import { ParamsSchema } from './schema'
const linear = (t: number) => t
// FNV chunks are reproducible across renders and seeks. Gaps on twos keep the
// average at 30 cps, rather than treating a 2..6 character burst as every tick.
export function revealSteps(lines: readonly { chars: number }[]) {
  let total = 0
  return lines.map((line, index) => {
    const steps: { chars: number; at: number }[] = []
    let chars = 0, step = 0
    while (chars < line.chars) {
      let hash = 2166136261
      for (const c of `${index}:${step++}`) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619)
      const count = Math.min(line.chars - chars, 2 + (hash >>> 0) % 5)
      chars += count; total += count
      steps.push({ chars, at: 2 * Math.ceil(total * FPS / 30 / 2) })
    }
    return steps
  })
}
export function answerState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const { fired } = stateAt(events, object.obj, frame)
  const first = (verb: string) => fired.find(e => e.verb === verb)
  const entrance = first('enter'), typing = first('type'), mark = first('mark'), light = first('light'), exit = first('exit')
  const age = (event: EngineEvent) => stateAt([event], object.obj, frame).sinceFrames
  const steps = revealSteps(params.lines)
  const duration = steps.at(-1)!.at(-1)!.at
  const timeline = stateAt(events, object.obj, Infinity).fired
  const next = typing ? timeline.find(e => e.atFrame > typing.atFrame) : undefined
  const available = typing ? Math.max(0, (next?.atFrame ?? object.toFrame) - typing.atFrame) : duration
  const elapsed = typing ? progress(age(typing), Math.max(1, Math.min(duration, available)), linear) * duration : -1
  return { params, visible: !!entrance && frame >= object.fromFrame && frame < object.toFrame,
    enter: entrance ? progress(age(entrance), MOTION.enterFrames, ENTER) : 0,
    exit: exit ? progress(age(exit), MOTION.exitFrames, EXIT) : 0,
    revealed: steps.map(row => row.findLast(s => s.at <= elapsed)?.chars ?? 0),
    pop: mark ? 1 + 0.2 * progress(age(mark), 8, overshootEase(25)) * (1 - progress(age(mark), 8, linear)) : 1,
    marked: !!mark, ring: mark ? 1 - drawPath(frame, mark.atFrame, 1, { frames: 8 }) : 0,
    light: light ? progress(age(light), MOTION.slideFrames) : 0,
    hairline: light ? 1 - drawPath(frame, light.atFrame, 1, { frames: MOTION.slideFrames }) : 0,
  }
}
