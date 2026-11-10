import React from 'react'
import { Easing } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import { stateAt, progress, MOTION, EXIT } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'
import { hatch } from './hatch'

export function floodState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>) {
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.filter(e => e.verb === 'enter').at(-1)
  if (!enter) return null
  const active = fired.filter(e => e.atFrame >= enter.atFrame)
  const cue = (verb: string) => active.filter(e => e.verb === verb).at(-1)
  const age = (verb: string) => cue(verb) ? frame - cue(verb)!.atFrame : -1
  const out = cue('exit') ? progress(age('exit'), MOTION.exitFrames, EXIT) : 0
  if (out === 1) return null
  const params = ParamsSchema.parse(object.params)
  const dataset = object.dataset
  if (!dataset) throw new Error('upload_flood requires dataset shares and provenance')
  const share = (name: 'aiShare' | 'listensShare') => {
    const row = dataset.rows.find(r => r.label === name || (name === 'listensShare' && r.label.includes('of listens')) || (name === 'aiShare' && r.label.includes('%')))
    if (!row || row.value < 0 || row.value > 1) throw new Error(`upload_flood requires dataset ${name} in 0..1`)
    if (params[name] !== undefined && params[name] !== row.value) throw new Error(`upload_flood ${name} disagrees with dataset`)
    return row.value
  }
  const aiShare = share('aiShare'), listensShare = share('listensShare')
  const aiCount = Math.round(params.tiles * aiShare)
  return { params, dataset, aiCount, aiShare, listensShare, out,
    enter: progress(frame - enter.atFrame, MOTION.slideFrames),
    fillAge: age('fill'), drawAge: age('draw'), typing: !!cue('type'),
    count: cue('count_to') ? progress(age('count_to'), MOTION.slideFrames) : 0,
    meter: cue('draw') ? listensShare * progress(age('draw'), MOTION.slideFrames) : 0,
    typeProgress: cue('type') ? progress(age('type'), MOTION.slideFrames, Easing.bezier(.2, 0, 0, 1)) : 0,
    query: cue('type') ? Array.from(params.query).slice(0, Math.max(0, age('type')) * 2).join('') : '',
    pick: cue('pick') ? progress(age('pick'), MOTION.slideFrames) : 0,
    picking: !!cue('pick'),
    plus: aiShare >= .5 && dataset.rows.some(r => r.label.includes('+')),
  }
}

/** Fixed integer avalanche: classification is independent of aspect and animation. */
export function tileHash(i: number) {
  let x = Math.imul(i + 1, 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

/** Square song covers fill the safe area, in column-major rain groups. */
export function gridGeometry(tiles: number, width: number, height: number, tall: boolean) {
  const x = width * .06, y = height * .18, w = width * .88, h = height * .64
  const columns = Math.ceil(Math.sqrt(tiles * w / h)), rows = Math.ceil(tiles / columns)
  const cw = w / columns, ch = h / rows, size = Math.min(cw, ch) - 6
  return { x, y, w, h, rows, columns, tile: (i: number) => ({
    x: x + Math.floor(i / rows) * cw + (cw - size) / 2,
    y: y + (i % rows) * ch + (ch - size) / 2, w: size, h: size,
  }) }
}

export function Device(props: DeviceProps) {
  const s = floodState(props)
  if (!s) return null
  const { box, tokens: t, aspect } = props
  const tall = aspect === '9:16', tiles = tall ? 360 : s.params.tiles
  const g = gridGeometry(tiles, box.width, box.height, tall)
  const id = `upload-${Array.from(props.object.obj).map(c => c.codePointAt(0)!.toString(16)).join('-')}`
  const tileProgress = (i: number) => progress(s.fillAge - Math.floor(Math.floor(i / g.rows) / 4) / Math.max(1, Math.ceil(g.columns / 4) - 1) * MOTION.slideFrames * 2,
    MOTION.dropFrames)
  const selected = Array.from({ length: tiles }, (_, i) => i).find(i => tileHash(i) >= s.aiShare) ?? 0
  const origin = g.tile(selected)
  const search = { x: box.width * .2, y: box.height * .40, w: box.width * .6 }
  const tx = g.x + g.w - 300, ty = g.y + 24
  const text = (x: number, y: number, value: string, size = 32, family: string = HOUSE_FONTS.data) =>
    <text x={x} y={y} fill={t.ink} fontFamily={family} fontSize={size}>{value}</text>
  return <svg data-device="upload_flood" width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}
    style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden', opacity: s.enter * (1 - s.out) }}>
    <defs>{hatch(id, t)}
      <filter id={`${id}-shadow`} x="-30%" y="-60%" width="160%" height="240%">
        <feDropShadow dx={0} dy={18} stdDeviation={20} floodColor={t.ink} floodOpacity={.25}/>
      </filter>
      <clipPath id={`${id}-clip`}><rect width={box.width} height={box.height}/></clipPath>
    </defs>
    <g clipPath={`url(#${id}-clip)`} transform={`translate(0 ${(1 - s.enter) * 48 + s.out * 48})`}>
      <rect width={box.width} height={box.height} fill={t.cream}/>
      <g opacity={1 - .6 * s.typeProgress}>
        {text(g.x, box.height * .08 + 30, s.dataset.producerLabel, 32)}
        {text(g.x, box.height * .08 + 76, 'Daily uploads · illustration', 30)}
        <g data-grid-width={g.w}>
        {Array.from({ length: tiles }, (_, i) => {
          const p = tileProgress(i), tile = g.tile(i), ai = tileHash(i) < s.aiShare
          if (s.fillAge < 0 || p === 0 || (s.picking && i === selected)) return null
          const playStart = i / Math.max(1, tiles - 1) * MOTION.slideFrames
          const flash = ai && s.drawAge >= playStart && s.drawAge < playStart + MOTION.slapFrames
          return <g key={i} data-tile={i} data-ai={ai} opacity={p}
            transform={`translate(0 ${-(1 - p) * (tile.y + tile.h)}) rotate(${(tileHash(i + tiles) - .5) * 18 * (1 - p)} ${tile.x + tile.w / 2} ${tile.y + tile.h / 2})`}>
            <rect x={tile.x} y={tile.y} width={tile.w} height={tile.h} rx={4} fill={ai ? `url(#${id})` : t.cream} stroke={t.ink} strokeWidth={1}/>
            <path data-play={flash ? 'on' : 'off'} d={`M${tile.x + tile.w * .4} ${tile.y + tile.h * .3}l${tile.w * .3} ${tile.h * .2}l${-tile.w * .3} ${tile.h * .2}Z`} fill={ai ? t.cream : t.ink} opacity={flash ? 1 : .65}/>
            {!ai && <circle cx={tile.x + tile.w * .8} cy={tile.y + tile.h * .8} r={tile.w * .07} fill={t.mint}/>}
          </g>
        })}
        </g>
        <g filter={`url(#${id}-shadow)`}>
          <rect x={tx} y={ty} width={276} height={190} rx={16} fill={t.cream}/>
          {text(tx + 24, ty + 112, `${Math.round(s.aiShare * 100 * s.count)}%${s.count === 1 && s.plus ? '+' : ''}`, 100, HOUSE_FONTS.display)}
          {text(tx + 24, ty + 158, 'made with AI', 30, HOUSE_FONTS.structure)}
        </g>
        {s.drawAge >= 0 && <g>
          <rect data-meter-track="true" x={g.x} y={box.height * .87} width={g.w} height={32} rx={16} fill={t.cream} stroke={t.ink} strokeWidth={2}/>
          <rect data-meter-width={s.meter * g.w} x={g.x} y={box.height * .87} width={s.meter * g.w} height={32} rx={Math.min(16, s.meter * g.w / 2)} fill={t.mint}/>
          {text(g.x + s.meter * g.w, box.height * .87 + 76,
            s.dataset.rows.find(r => r.label.includes('of listens'))?.label ?? `${s.listensShare * 100}% of listens`, 32)}
        </g>}
      </g>
      {s.typing && <g transform={`translate(${box.width / 2} ${search.y + 50}) scale(${(1 + .5 * s.typeProgress) / 1.5}) translate(${-box.width / 2} ${-search.y - 50})`} opacity={s.typeProgress}>
        <rect x={search.x} y={search.y} width={search.w} height={112} rx={16} fill={t.cream} stroke={t.ink} strokeWidth={2} filter={`url(#${id}-shadow)`}/>
        <circle cx={search.x + 42} cy={search.y + 48} r={16} fill={t.mint} stroke={t.ink} strokeWidth={3}/>
        <path d={`M${search.x + 54} ${search.y + 61}l14 14`} stroke={t.mint} strokeWidth={8}/>
        <text x={search.x + 88} y={search.y + 72} fill={t.ink} fontFamily={HOUSE_FONTS.structure} fontSize={44}>{s.query}</text>
      </g>}
      {s.picking && <g data-result transform={`translate(${origin.x + (search.x - origin.x) * s.pick} ${origin.y + (search.y + 144 - origin.y) * s.pick})`}>
        <rect width={origin.w + (search.w - origin.w) * s.pick} height={origin.h + (180 - origin.h) * s.pick} rx={16} fill={t.mint} stroke={t.ink} strokeWidth={2} filter={`url(#${id}-shadow)`}/>
        <g opacity={s.pick}>
          <rect data-cover-slot="true" x={24} y={24} width={96} height={96} rx={4} fill={t.cream} stroke={t.ink}/>
          <path d="M58 68l32 22-32 22Z" fill={t.ink}/>
          <text x={144} y={74} fill={t.ink} fontFamily={HOUSE_FONTS.structure} fontSize={tall ? 32 : 44}>{s.params.answer.title}</text>
          {text(144, 126, s.params.answer.artist, 30)}
        </g>
      </g>}
    </g>
  </svg>
}
