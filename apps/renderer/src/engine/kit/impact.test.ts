import { readFileSync } from 'node:fs'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import * as remotion from 'remotion'
import { describe, expect, it, vi } from 'vitest'
import { EngineImpactSchema, IMPACT_EASES, impactAt, impactStyle, type EngineImpact } from './impact'
import { EngineRenderPropsSchema } from '../props'
import { FormatMaster } from '../FormatMaster'

/** Impact zoom (Krish, 2026-11-26: "Zoom for impact ... classy and subtle rather than too aggressive"). */

const clockFrame = vi.hoisted(() => ({ value: 0 }))
vi.mock('../clock', async (importOriginal) => ({ ...await importOriginal<typeof import('../clock')>(), useEngineFrame: () => clockFrame.value }))

const config = JSON.parse(readFileSync('config/ve/impact-zoom.json', 'utf8'))
const hit = { w: 3, word: 'never', fromFrame: 30, peakFrame: 41, holdTo: 70, toFrame: 91, scale: 1.06, strength: 'normal' as const,
  release: 'ease' as const, originX: 540, originY: 700, eyeLine: 0.365 }
const impact: EngineImpact = { pushEase: 'easeOutCubic', releaseEase: 'easeInOutCubic', joins: [], hits: [hit] }

describe('impact zoom curve', () => {
  it('rests at 1 outside the push, eases out to its peak on the word, holds, and eases back', () => {
    expect(impactAt(impact, 29).scale).toBe(1)
    expect(impactAt(impact, 30).scale).toBe(1)
    expect(impactAt(impact, 41).scale).toBeCloseTo(1.06)
    expect(impactAt(impact, 69).scale).toBeCloseTo(1.06)
    expect(impactAt(impact, 91).scale).toBe(1)
    const curve = Array.from({ length: 62 }, (_, i) => impactAt(impact, 30 + i).scale)
    const push = curve.slice(0, 12), release = curve.slice(40)
    expect(push.every((s, i) => i === 0 || s >= push[i - 1]!)).toBe(true)
    expect(release.every((s, i) => i === 0 || s <= release[i - 1]!)).toBe(true)
    // ease out: most of the push lands in its first half, so it reads on the word
    expect(impactAt(impact, 35).scale - 1).toBeGreaterThan(0.06 * 0.6)
  })
  it('never moves faster than the config rate, and resets only on a cut release', () => {
    const rate = Math.max(...Array.from({ length: 61 }, (_, i) => Math.abs(impactAt(impact, 31 + i).scale - impactAt(impact, 30 + i).scale) * 30))
    expect(rate).toBeLessThanOrEqual(config.timing.max_rate_per_s)
    const cut = { ...impact, hits: [{ ...hit, holdTo: 80, toFrame: 80, release: 'cut' as const }] }
    expect(impactAt(cut, 79).scale).toBeCloseTo(1.06)
    expect(impactAt(cut, 80).scale).toBe(1)
  })
  it('holds the schema to the config: the hard cap and the curves the planner names', () => {
    expect(EngineImpactSchema.safeParse({ ...impact, hits: [{ ...hit, scale: config.scale.hard_cap + 0.01 }] }).success).toBe(false)
    expect(EngineImpactSchema.safeParse({ ...impact, hits: [{ ...hit, scale: config.scale.hard_cap }] }).success).toBe(true)
    expect(EngineImpactSchema.safeParse({ ...impact, hits: [{ ...hit, peakFrame: 20 }] }).success).toBe(false)
    expect(IMPACT_EASES).toContain(config.timing.push_ease)
    expect(IMPACT_EASES).toContain(config.timing.release_ease)
    expect(config.scale.hard_cap).toBeLessThan(config.scale.library_cap)
  })
  it('is a scale about his eyes, and nothing outside a push', () => {
    expect(impactStyle(impact, 50)).toEqual({ transform: 'scale(1.06000)', transformOrigin: '540px 700px' })
    expect(impactStyle(impact, 10)).toBeUndefined()
    expect(impactStyle(undefined, 50)).toBeUndefined()
  })
})

const REMOTION = new Set<unknown>(Object.values(remotion))
function flatten(node: ReactNode): string {
  if (Array.isArray(node)) return `[${node.map(flatten).join(',')}]`
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (!isValidElement<Record<string, unknown>>(node)) return JSON.stringify(node)
  const element = node as ReactElement<Record<string, unknown>>
  if (typeof element.type === 'function' && !REMOTION.has(element.type)) {
    // A chrome layer that needs the browser's fonts (CaptionTrack) is named, not drawn: only the take layer is read here.
    try { return flatten((element.type as (p: unknown) => ReactNode)(element.props)) }
    catch { return `<${(element.type as { name?: string }).name ?? 'fn'} unrendered>` }
  }
  const name = typeof element.type === 'string' ? element.type : (element.type as { displayName?: string; name?: string })?.displayName ?? (element.type as { name?: string })?.name ?? 'x'
  const { children, ...rest } = element.props
  return `<${name} ${JSON.stringify(rest, (_k, v) => typeof v === 'function' ? `fn:${v.name}` : v)}>${flatten(children as ReactNode)}</${name}>`
}

describe('impact zoom on the take layer only', () => {
  const raw = JSON.parse(readFileSync('fixtures/ve/engine-core/props.json', 'utf8'))
  const segment = { src: 'take.mp4', trimBeforeFrames: 0, fromFrame: 0, durationFrames: raw.durationFrames }
  const props = EngineRenderPropsSchema.parse({ ...raw, segments: [segment], impact })
  it('pushes his take and leaves the captions and the frame still', () => {
    clockFrame.value = 50
    const tree = flatten(FormatMaster(props))
    expect(tree.match(/data-impact/g)?.length).toBe(1)
    expect(tree).toContain('"data-impact":"push"')
    expect(tree).toContain('scale(1.06000)')
    // the push wraps only the video, outside its own face lift (composed, never replaced), and closes straight after it
    const at = tree.indexOf('"data-impact":"push"')
    const video = tree.indexOf('</OffthreadVideo>', at)
    const inside = tree.slice(at, video)
    expect(inside).toContain('<OffthreadVideo')
    expect(inside).toContain('"transform":"scale(1.1)"')
    expect(inside).not.toMatch(/caption|BrandFrame/i)
    expect(tree.slice(video + '</OffthreadVideo>'.length).startsWith('</withInteractivitySchema(AbsoluteFillInner)>')).toBe(true)
    expect(tree.indexOf('CaptionTrack')).toBeGreaterThan(video)
    expect(tree.match(/scale\(1\.06000\)/g)?.length).toBe(1)
  })
  it('rests between pushes, and a cut without props.impact draws no wrapper at all', () => {
    clockFrame.value = 100
    expect(flatten(FormatMaster(props))).toContain('"data-impact":"rest"')
    const plain = EngineRenderPropsSchema.parse({ ...raw, segments: [segment] })
    clockFrame.value = 50
    expect(flatten(FormatMaster(plain))).not.toContain('data-impact')
  })
})
