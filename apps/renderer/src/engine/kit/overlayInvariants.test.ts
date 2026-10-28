import { it, expect } from 'vitest'
import { assertOverlayMarkup } from './overlayInvariants'
import { ZONES, CANVAS } from './lock'
import lock from '../../../../../config/ve/design-lock.json'

it('keeps overlay geometry identical to the frozen lock', () => {
  expect(ZONES).toEqual(lock.zones)
  expect(CANVAS).toEqual(lock.canvas)
})

it('rejects illegible, blurred, wrongly coloured, rotated or off-canvas markup', () => {
  for (const style of ['font-size:29px', 'filter:blur(2px)', 'box-shadow:5px 5px 3px black',
    'color:#ffffff', 'color:rgb(0,0,0)', 'font-family:Arial', 'transform:rotate(2deg)',
    'position:absolute;left:1000px;top:0px;width:100px;height:40px']) {
    expect(() => assertOverlayMarkup(`<div style="${style}">TEXT</div>`, 'headline')).toThrow()
  }
  expect(() => assertOverlayMarkup('<div style="border:2px solid ivory">STAMP</div>', 'stamp')).toThrow()
  expect(() => assertOverlayMarkup('<div style="transform:rotate(7deg)">STAMP</div>', 'stamp')).toThrow()
})
