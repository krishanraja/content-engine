import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MOTION } from '../../clock'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { textWidth } from '../../../house/metrics'
import { Device, threadState } from './index'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'green', channel: 'coral' }
const props = { object, events, tokens, aspect: '9:16' as const, box: { left: 0, top: 0, width: 1080, height: 1920 } }
const at = (frame: number) => threadState(object, events, frame)
const render = (frame: number) => renderToStaticMarkup(Device({ ...props, frame }))
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}
const nodes = (frame: number) => elements(Device({ ...props, frame }))

describe('thread_card', () => {
  it('draws nothing before enter, reveals over slideFrames, staggering each thread', () => {
    expect(render(9)).toBe('')
    expect(at(10).reveal(0)).toBe(0)
    expect(at(10 + MOTION.slideFrames).reveal(0)).toBe(1)
    for (let i = 0; i < 3; i++) {
      const start = 10 + i * MOTION.staggerFrames
      for (const [frame, offset] of [[start, 1], [start + MOTION.slideFrames, 0]]) {
        const path = nodes(frame!).find(n => n.props['data-reveal'] === fixture.objects[0]!.params.threads[i]!.id)!
        expect(path.props.pathLength).toBe(1)
        expect(path.props.strokeDashoffset).toBe(offset)
      }
    }
    expect(at(150).opacity).toBe(1)
    expect(render(156)).toBe('')
  })

  it('plants only on its mark, drops and rotates for eight frames, and holds', () => {
    expect(nodes(29).filter(n => n.props['data-pennant'] === 'planted')).toHaveLength(0)
    const planted = (frame: number) => nodes(frame).find(n => n.props['data-pennant'] === 'planted')!
    expect(planted(30).props.transform).toBe('translate(400 308) rotate(-12)')
    expect(planted(38).props.transform).toBe('translate(400 336) rotate(0)')
    expect(at(120).mark('claude', 'first')).toBe(1)
    expect(at(29).mark('claude', 'first')).toBeNull()
    expect(nodes(49).some(n => n.props['data-ring'])).toBe(false)
    expect(nodes(50).some(n => n.props['data-ring'] === 'deepseek')).toBe(true)
    const path = nodes(60).find(n => n.props['data-reveal'] === 'deepseek')!
    expect(path.props.d).toContain('L 640 536')
    expect(path.props.d).toContain('M 740 536')
    expect(path.props.d).toMatch(/902 436$/)
  })

  it('records stamp without drawing and seeks deterministically', () => {
    expect(at(70).stamp).toBe('deepseek:ANSWER DELETED')
    expect(render(69)).toBe(render(70))
    render(120)
    expect(threadState(object, [...events].reverse(), 38)).toEqual(expect.objectContaining({ visible: true, stamp: null }))
    expect(render(29)).not.toContain('data-pennant="planted"')
    const reenter = [...events, EngineEventSchema.parse({ id: 'reenter', obj: 'threads', verb: 'enter', toState: 'visible', atFrame: 160 })]
    expect(threadState(object, reenter, 172).mark('claude', 'first')).toBeNull()
  })

  it.each(['9:16', '16:9'] as const)('keeps type and geometry within the %s canvas without box styling', aspect => {
    const tree = Device({ ...props, aspect, frame: 100 })
    const markup = renderToStaticMarkup(tree)
    expect(markup).not.toMatch(/<table|#[0-9a-f]{3,8}\b|overflow:\s*visible|<rect/i)
    for (const node of elements(tree).filter(n => n.type === 'text')) {
      const size = Number(node.props.fontSize)
      expect(size).toBeGreaterThanOrEqual(30)
      const x = Number(node.props.x), y = Number(node.props.y)
      const face = size === 34 ? 'archivoHeavy' : size === 46 ? 'anton' : 'mono'
      const lines = elements(node.props.children as ReactNode)
      for (const line of lines) {
        const width = textWidth(face, String(line.props.children), size, face === 'mono' ? 0.14 : 0) * (size === 34 ? 1.12 : 1)
        expect(x).toBeGreaterThanOrEqual(72)
        expect(x + width).toBeLessThanOrEqual(960.001)
      }
      expect(y - size).toBeGreaterThanOrEqual(150)
      expect(y + (lines.length - 1) * size * 1.25).toBeLessThanOrEqual(aspect === '9:16' ? 1170 : 1008)
    }
    expect(markup).toContain('stroke-dasharray="26 15"')
    expect(markup).toContain('REVIEW 30 NOV 2026')
    expect(elements(tree).filter(n => n.type === 'circle')).toHaveLength(3)
  })

  it('uses channel only for thread tone and rejects ambiguous mark references', () => {
    const channel = { ...object, params: { ...object.params, tone: 'channel' } }
    const markup = renderToStaticMarkup(Device({ ...props, object: channel, frame: 100 }))
    expect(markup).toContain('stroke="coral" stroke-width="5"')
    expect(markup).toContain('fill="green"')
    expect(ParamsSchema.safeParse({ ...object.params, end: undefined, knot: undefined }).success).toBe(true)
    expect(ParamsSchema.safeParse({ ...object.params, knot: undefined }).success).toBe(false)
    const params = ParamsSchema.parse(object.params)
    params.threads[0]!.marks[0]!.station = 'missing'
    expect(ParamsSchema.safeParse(params).success).toBe(false)
  })

  it('can join unmarked solid and dashed threads to a knot and call without stations', () => {
    const params = ParamsSchema.parse(object.params)
    params.stations = []
    params.threads = params.threads.slice(0, 2).map(t => ({ ...t, marks: [] }))
    const tree = Device({ ...props, object: { ...object, params }, frame: 100 })
    const paths = elements(tree).filter(n => n.props['data-reveal'])
    expect(paths).toHaveLength(2)
    for (const path of paths) expect(path.props.d).toMatch(/902 436$/)
    expect(renderToStaticMarkup(tree)).toContain('REVIEW 30 NOV 2026')
  })
})
