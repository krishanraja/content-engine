import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('remotion', async original => ({ ...await original<typeof import('remotion')>(),
  Img: (p: object) => React.createElement('img', p),
  Sequence: ({ from, children }: { from: number; children: React.ReactNode }) => React.createElement('div', { 'data-from': from }, children),
  OffthreadVideo: ({ src, muted, trimBefore }: { src: string; muted: boolean; trimBefore: number }) => React.createElement('video', { src, muted, 'data-trim': trimBefore }),
}))
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import { setMotionProfile } from '../../clock'
import { resolveMotion } from '../../kit/motionProfiles'
import { Device, coverRect } from './index'
import { sceneState, cameraPose } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'green', channel: 'coral' }
const state = (f: number, ev = events) => sceneState(object, ev, f)
const draw = (frame: number, aspect: '9:16' | '16:9' = '9:16', obj = object, ev = events) => renderToStaticMarkup(React.createElement(Device, { object: obj, events: ev, frame, aspect, tokens, box: { left: 60, top: 90, width: 800, height: 600 } }))
afterEach(() => setMotionProfile(undefined))
it('validates strict params and bounds', () => {
  expect(ParamsSchema.parse(object.params).camera).toBe('push')
  for (const bad of [{ shots: [] }, { ...object.params, text: 'no' }, { shots: [{ src: 'x', width: 0, height: 10 }] }]) expect(ParamsSchema.safeParse(bad).success).toBe(false)
})
it('cover contains both boxes with exact aspect for wide, tall and square at all focus corners', () => {
  const pictures: [number, number][] = [[1920,1080],[1080,1920],[800,800]], boxes: [number, number][] = [[1920,1080],[1080,1920]]
  for (const [width, height] of pictures) for (const [w,h] of boxes) for (const x of [0,.5,1]) for (const y of [0,.5,1]) {
    const r = coverRect({ width, height, focus: { x,y } }, w,h)
    expect(r.width / r.height).toBeCloseTo(width / height)
    expect(r.x).toBeLessThanOrEqual(0); expect(r.y).toBeLessThanOrEqual(0)
    expect(r.x+r.width).toBeGreaterThanOrEqual(w-1e-8); expect(r.y+r.height).toBeGreaterThanOrEqual(h-1e-8)
  }
})
it('enters, cuts, wipes for four frames, changes shots, exits and rejects invalid indexes', () => {
  expect(draw(9)).toBe(''); expect(draw(10)).toContain('width:1080px;height:1920px')
  for (const f of [10,11,12,13]) expect(draw(f)).toContain('data-wipe')
  expect(draw(14)).not.toContain('data-wipe')
  expect(draw(80)).toContain('assets/scene-two.jpg'); expect(state(80).cameraProgress).toBe(0)
  expect(draw(140)).toBe('')
  expect(draw(10,'9:16',object,[{ ...events[0]!, toState: 'cut' }])).not.toContain('data-wipe')
  for (const toState of ['-1','2','bad','0.5']) expect(() => state(10,[{ ...events[0]!, toState }])).toThrow('bad shot index')
  const zero = [{ ...events[0]!, atFrame: 0 }]
  expect(state(0,zero).start).toBe(0); expect(state(0,zero).cameraProgress).toBe(0)
})
it('camera changes on consecutive supplied frames under a twos profile and ends at 1.08', () => {
  setMotionProfile(resolveMotion({ style: 'paper-cutout' }))
  expect(draw(30)).not.toBe(draw(31))
  expect(cameraPose('push',state(79).cameraProgress,79,1080,1920,{x:.5,y:.5}).scale).toBeCloseTo(1.08,3)
  expect(cameraPose('still',.7,1,1080,1920,{x:.5,y:.5}).scale).toBe(1)
  for (let frame=0;frame<150;frame++) {
    const pose=cameraPose('handheld',.5,frame,1080,1920,{x:.5,y:.5})
    expect(Math.abs(pose.x)).toBeLessThanOrEqual(6); expect(Math.abs(pose.y)).toBeLessThanOrEqual(6); expect(Math.abs(pose.rotation)).toBeLessThanOrEqual(.4)
  }
})
it('video stays muted, starts at each shot cue and preserves its in-point', () => {
  const params=ParamsSchema.parse(object.params)
  const obj={...object, params:{...params,shots:params.shots.map(s=>({...s,kind:'video',from_s:2.5}))}}
  for (const frame of [10,40,80,120]) {
    const html=draw(frame,'16:9',obj)
    expect(html).toContain('muted=""'); expect(html).toContain('data-trim="75"')
    expect(html).toContain(`data-from="${frame<80?10:80}"`)
  }
})
it.each(['9:16','16:9'] as const)('renders fixture stills with no text in either grade, %s', aspect => {
  for (const grade of ['none','hud']) for (const frame of fixture.stills) {
    const html=draw(frame,aspect,{...object,params:{...object.params,grade}})
    expect(html).not.toMatch(/<text|<span|source=|watermark|logo/)
    expect(html.replace(/<[^>]*>/g,'')).toBe('')
  }
  expect(draw(40,aspect,{...object,params:{...object.params,full:false}})).toContain('left:60px;top:90px;width:800px;height:600px')
})
