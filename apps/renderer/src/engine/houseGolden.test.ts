import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { isValidElement, createElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as remotion from 'remotion'
import { describe, expect, it, vi } from 'vitest'
import { FormatMaster } from './FormatMaster'
import { DEVICES } from './devices/registry'
import { EngineEventSchema, EngineObjectSchema, EngineRenderPropsSchema, type EngineRenderProps } from './props'

/** The house motion never moves. With no motion style every device and the whole composition must draw exactly what
 *  they drew before motion styles were strengthened (Krish's frozen locks and approved key frames stay valid). The
 *  digests in houseGolden.json were recorded from a86c3f0 (the renderer before the strong styles); a change that
 *  alters a no-style frame fails here. Numbers are rounded to 0.001 before hashing: V8's sin and cos differ in the last
 *  bit between Node 22 and Node 24, which no pixel shows but a raw digest does. Regenerate only for a deliberate house change Krish approved:
 *  VE_WRITE_HOUSE_GOLDEN=1 npx vitest run apps/renderer/src/engine/houseGolden.test.ts */

const clockFrame = vi.hoisted(() => ({ value: 0 }))
vi.mock('./clock', async (importOriginal) => ({ ...await importOriginal<typeof import('./clock')>(), useEngineFrame: () => clockFrame.value }))

const GOLDEN = 'apps/renderer/src/engine/houseGolden.json'
const WRITE = process.env.VE_WRITE_HOUSE_GOLDEN === '1'
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const REMOTION = new Set<unknown>(Object.values(remotion))

/** One element tree as text: function components are called (none uses a hook), Remotion's own are kept by name. */
function flatten(node: ReactNode): string {
  if (Array.isArray(node)) return `[${node.map(flatten).join(',')}]`
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (!isValidElement<Record<string, unknown>>(node)) return JSON.stringify(node)
  const element = node as ReactElement<Record<string, unknown>>
  if (typeof element.type === 'function' && !REMOTION.has(element.type)) {
    if (Object.values(DEVICES).includes(element.type as never)) return `<device ${renderToStaticMarkup(element)}>`
    return flatten((element.type as (p: unknown) => ReactNode)(element.props))
  }
  const name = typeof element.type === 'string' ? element.type
    : (element.type as { displayName?: string; name?: string })?.displayName ?? (element.type as { name?: string })?.name ?? String(element.type)
  const { children, ...rest } = element.props
  return `<${name} ${JSON.stringify(rest, (_k, v) => typeof v === 'function' ? `fn:${v.name}` : v)}>${flatten(children as ReactNode)}</>`
}

const normalise = (text: string) => text.replace(/-?\d+\.\d+(?:e-?\d+)?/g, n => {
  const r = Math.round(Number(n) * 1000) / 1000
  return String(Object.is(r, -0) ? 0 : r)
})
const digest = (parts: string[]) => createHash('sha256').update(parts.map(normalise).join('\n')).digest('hex')

function deviceDigests(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of readdirSync('apps/renderer/src/engine/devices').sort()) {
    const file = `apps/renderer/src/engine/devices/${name}/fixture.json`
    if (!existsSync(file)) continue
    const fixture = JSON.parse(readFileSync(file, 'utf8'))
    const objects = (fixture.objects ?? (fixture.object ? [fixture.object] : [])).flatMap((o: unknown) => {
      const parsed = EngineObjectSchema.safeParse(o)
      return parsed.success ? [parsed.data] : []
    })
    const events = (fixture.events ?? []).flatMap((e: unknown) => {
      const parsed = EngineEventSchema.safeParse(e)
      return parsed.success ? [parsed.data] : []
    })
    const last = Math.max(0, ...objects.map((o: { toFrame: number }) => o.toFrame), ...events.map((e: { atFrame: number }) => e.atFrame)) + 12
    for (const aspect of (fixture.aspects ?? ['9:16']) as Array<'9:16' | '16:9'>) {
      const box = { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 }
      const parts: string[] = []
      for (const object of objects) {
        const Device = DEVICES[object.device]
        if (!Device) continue
        for (let frame = 0; frame <= Math.min(last, 400); frame++) {
          try { parts.push(renderToStaticMarkup(createElement(Device, { object, events, box, tokens, aspect, frame }))) }
          catch (error) { parts.push(`throw ${(error as Error).message}`) }
        }
      }
      out[`${name} ${aspect}`] = digest(parts)
    }
  }
  return out
}

function propsFiles(): string[] {
  const files = ['fixtures/ve/engine-core/props.json']
  for (const day of readdirSync('docs/plans').sort()) {
    const dir = `docs/plans/${day}/ve`
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).sort()) if (/^props\..*\.json$/.test(f)) files.push(`${dir}/${f}`)
  }
  return files
}

function compositionDigests(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const file of propsFiles()) {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    delete raw.motion // the house motion: no style
    const parsed = EngineRenderPropsSchema.safeParse(raw)
    if (!parsed.success) continue
    const props: EngineRenderProps = parsed.data
    const step = props.durationFrames > 3000 ? 9 : 1
    const parts: string[] = []
    for (let frame = 0; frame < props.durationFrames; frame += step) {
      clockFrame.value = frame
      try { parts.push(flatten(FormatMaster(props))) } catch (error) { parts.push(`throw ${(error as Error).message}`) }
    }
    out[file] = digest(parts)
  }
  return out
}

describe('the house motion is frozen', () => {
  it('draws every device fixture and every recorded cut with no style exactly as before', () => {
    const now = { devices: deviceDigests(), compositions: compositionDigests() }
    if (WRITE) writeFileSync(GOLDEN, JSON.stringify(now, null, 1) + '\n')
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'))
    expect(Object.keys(now.devices).length).toBeGreaterThan(15)
    expect(Object.keys(now.compositions).length).toBeGreaterThanOrEqual(2)
    expect(now).toEqual(golden)
  }, 600_000)
})
