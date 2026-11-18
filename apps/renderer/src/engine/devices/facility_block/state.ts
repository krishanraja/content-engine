import { MOTION, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'
export function facilityState({object, events, frame}: Pick<DeviceProps, 'object'|'events'|'frame'>) {
  const p = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  const entry = fired.reduce((last, e, i) => e.verb === 'enter' ? i : last, -1)
  const s = {visible: entry >= 0 && frame >= object.fromFrame && frame < object.toFrame,
    pin: 0, racks: 0, city: 0, ballot: 0, pylons: 0, ban: 0, walk: 0, target: -1, transfer: 0, copies: 0, grey: 0, size: 1, out: 0, kick: 0}
  for (const e of fired.slice(Math.max(0, entry))) {
    const k = progress(frame - e.atFrame, Math.min(18, MOTION.enterFrames))
    s.kick = 12 * k * (1-k)
    switch (e.verb) {
      case 'enter': if(e.toState !== 'pin') throw Error('enter requires pin'); s.pin = k; break
      case 'fill': if(e.toState !== 'racks') throw Error('fill requires racks'); s.racks = k; break
      case 'connect': if(e.toState !== 'city') throw Error('connect requires city'); s.city = k; break
      case 'add': if(!['ballot','pylons'].includes(e.toState)) throw Error('add requires ballot or pylons'); s[e.toState as 'ballot'|'pylons'] = k; break
      case 'stamp': if(e.toState !== 'ban') throw Error('stamp requires ban'); s.ban = k; break
      case 'carry': if(e.toState !== 'walk') throw Error('carry requires walk'); s.walk = k; break
      case 'move': {
        const i = Number(e.toState.split(':')[1]);
        if(!/^target:\d+$/.test(e.toState) || !p.targets[i]) throw Error('move requires existing target');
        s.target = i; s.transfer = k; break
      }
      case 'multiply': if(Number(e.toState) !== p.copies.count) throw Error('multiply count differs from copies'); s.copies = k; break
      case 'grey': if(Number(e.toState) !== p.copies.kept) throw Error('grey count differs from kept'); s.grey = k; break
      case 'grow': if(e.toState !== 'giant') throw Error('grow requires giant'); s.size = s.size + (1.45-s.size)*k; break
      case 'thin': if(e.toState !== 'small') throw Error('thin requires small'); s.size = s.size + (.36-s.size)*k; break
      case 'exit': s.out = progress(frame-e.atFrame, MOTION.exitFrames); break
      default: throw Error(`Unsupported facility verb ${e.verb}`)
    }
  }
  return {...s, visible: s.visible && s.out < 1, lights: p.skyline.lights - Math.floor(p.skyline.lights*s.city),
    unstamped: p.copies.count - Math.floor((p.copies.count-p.copies.kept)*s.grey)}
}
