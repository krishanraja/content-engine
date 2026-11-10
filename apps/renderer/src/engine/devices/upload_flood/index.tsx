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
    const row = dataset.rows.find(r => r.label === name || (name === 'aiShare' && r.label.includes('%')))
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

/** Column-major positions stay identical throughout the pour, dim and selection. */
export function gridGeometry(tiles: number, width: number, height: number, tall: boolean) {
  const x = 32, y = tall ? 300 : 160
  const w = width - (tall ? 64 : Math.max(320, width * .25))
  const h = tall ? height * .43 : height * .48
  const columns = Math.ceil(Math.sqrt(tiles * w / h)), rows = Math.ceil(tiles / columns)
  const cw = w / columns, ch = h / rows
  return { x, y, w, h, tile: (i: number) => ({ x: x + Math.floor(i / rows) * cw + 3, y: y + (i - Math.floor(i / rows) * rows) * ch + 3, w: cw - 6, h: ch - 6 }) }
}

export function Device(props: DeviceProps) {
  const s = floodState(props)
  if (!s) return null
  const { box, tokens: t, aspect } = props
  const tall = aspect === '9:16'
  const g = gridGeometry(s.params.tiles, box.width, box.height, tall)
  const id = `upload-${Array.from(props.object.obj).map(c => c.codePointAt(0)!.toString(16)).join('-')}`
  const drop = Math.min(36, MOTION.dropFrames)
  const tileProgress = (i: number) => progress(s.fillAge - i / (s.params.tiles - 1) * (36 - drop), drop)
  const selected = s.aiCount < s.params.tiles ? s.aiCount : 0
  const origin = g.tile(selected)
  const search = { x: box.width * .1, y: tall ? box.height * .42 : box.height * .38, w: box.width * .8 }
  const tx = tall ? 32 : g.x + g.w + 24, ty = tall ? 140 : 290
  const text = (x: number, y: number, value: string, size = 32, family: string = HOUSE_FONTS.data) =>
    <text x={x} y={y} fill={t.ink} fontFamily={family} fontSize={size}>{value}</text>
  return <svg data-device="upload_flood" width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}
    style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden', opacity: s.enter * (1 - s.out) }}>
    <defs>{hatch(id, t)}<clipPath id={`${id}-clip`}><rect width={box.width} height={box.height}/></clipPath></defs>
    <g clipPath={`url(#${id}-clip)`} transform={`translate(0 ${(1 - s.enter) * 48 + s.out * 48})`}>
      <rect width={box.width} height={box.height} fill={t.cream}/>
      {text(32, 58, s.dataset.producerLabel, 32)}
      {text(32, 104, 'Daily uploads · illustration', 28)}
      <g opacity={1 - .6 * s.typeProgress}>
        <rect x={g.x} y={g.y} width={g.w} height={g.h} fill="none" stroke={t.inkSoft} strokeWidth={2}/>
        {Array.from({ length: s.params.tiles }, (_, i) => {
          const p = tileProgress(i), tile = g.tile(i), ai = i < s.aiCount
          if (s.fillAge < 0 || p === 0 || (s.picking && i === selected)) return null
          const playStart = i / Math.max(1, s.aiCount - 1) * MOTION.slideFrames
          const flash = ai && s.drawAge >= playStart && s.drawAge < playStart + MOTION.slapFrames
          return <g key={i} data-tile={i} data-ai={ai} opacity={p} transform={`translate(0 ${-(1 - p) * (g.y + tile.h)})`}>
            <rect x={tile.x} y={tile.y} width={tile.w} height={tile.h} fill={ai ? `url(#${id})` : t.cream} stroke={t.ink} strokeWidth={1}/>
            {ai && <path data-play={flash ? 'on' : 'off'} d={`M${tile.x + tile.w * .35} ${tile.y + tile.h * .25}l${tile.w * .35} ${tile.h * .25}l${-tile.w * .35} ${tile.h * .25}Z`} fill={t.cream} opacity={flash ? 1 : 0}/>}
          </g>
        })}
        {text(tx, ty, `${Math.round(s.aiShare * 100 * s.count)}%${s.count === 1 && s.plus ? '+' : ''}`, tall ? 96 : 100, HOUSE_FONTS.display)}
        {text(tx, ty + 48, 'made with AI', 30, HOUSE_FONTS.structure)}
        {s.drawAge >= 0 && <g>
          {text(g.x, g.y + g.h + 54, 'Share of listens', 30)}
          <rect x={g.x} y={g.y + g.h + 76} width={g.w} height={28} fill={t.inkSoft}/>
          <rect data-meter-width={s.meter * g.w} x={g.x} y={g.y + g.h + 76} width={s.meter * g.w} height={28} fill={t.cream} stroke={t.ink}/>
        </g>}
      </g>
      {s.typing && <g transform={`translate(0 ${(1 - s.typeProgress) * 80}) translate(${box.width / 2} ${search.y + 50}) scale(${(2 + s.typeProgress) / 3}) translate(${-box.width / 2} ${-search.y - 50})`} opacity={s.typeProgress}>
        <rect x={search.x} y={search.y} width={search.w} height={100} rx={12} fill={t.cream} stroke={t.ink} strokeWidth={3}/>
        <text x={search.x + 24} y={search.y + 63} fill={t.ink} fontFamily={HOUSE_FONTS.structure} fontSize={38} textLength={s.query.length > 32 ? search.w - 48 : undefined} lengthAdjust="spacingAndGlyphs">{s.query}</text>
      </g>}
      {s.picking && <g data-result transform={`translate(${origin.x + (search.x - origin.x) * s.pick} ${origin.y + (search.y + 124 - origin.y) * s.pick})`}>
        <rect width={origin.w + (search.w - origin.w) * s.pick} height={origin.h + (160 - origin.h) * s.pick} rx={10} fill={t.mint} stroke={t.ink} strokeWidth={2}/>
        <g opacity={s.pick}>{text(24, 60, s.params.answer.title, 36, HOUSE_FONTS.structure)}{text(24, 112, s.params.answer.artist, 30)}</g>
      </g>}
    </g>
  </svg>
}
