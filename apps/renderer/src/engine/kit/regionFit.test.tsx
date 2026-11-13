import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../props'
import { Device as Quote } from '../devices/quote_card'
import { Device as Strip } from '../devices/stat_strip'
import { Device as Record } from '../devices/record_card'
import type { DeviceProps } from '../devices/types'
import quote from '../devices/quote_card/fixture.json'
import strip from '../devices/stat_strip/fixture.json'
import record from '../devices/record_card/fixture.json'
import { layoutSlots } from './layout'
import { overlayTestProps } from './overlayInvariants'

/** Devices that sat at fixed zones now fill a layout region (docs/ve/INGREDIENTS.md "What is still open"). */
const [region] = layoutSlots({ mode: 'fill' }, '9:16', 'lower', true, 1)!
const house = { left: 0, top: 0, width: 800, height: 740 }       // the same size, but not a region
const cases = [['quote_card', Quote, quote], ['stat_strip', Strip, strip], ['record_card', Record, record]] as const

function draw(Device: (p: DeviceProps) => React.ReactElement | null, f: typeof quote | typeof strip | typeof record, box: DeviceProps['box']) {
  const object = EngineObjectSchema.parse(f.objects[0]), events = f.events.map(e => EngineEventSchema.parse(e))
  return renderToStaticMarkup(<Device {...overlayTestProps} object={object} events={events} box={box} frame={60} />)
}

describe('fixed-zone devices in a fill region', () => {
  for (const [name, Device, fixture] of cases) {
    it(`${name} grows past its natural size and stays inside the region`, () => {
      const markup = draw(Device as never, fixture as never, region!)
      const m = markup.match(/data-region-fit="" style="([^"]*)"/)
      expect(m, 'drawn through the region path').not.toBeNull()
      const css = m![1]!
      const num = (key: string) => parseFloat(css.match(new RegExp(`(?:^|;)${key}:(-?[\\d.]+)`))![1]!)
      const scale = parseFloat(css.match(/scale\(([\d.]+)\)/)![1]!)
      expect(scale).toBeGreaterThan(1)
      expect(scale).toBeLessThanOrEqual(3)
      expect(num('left')).toBeGreaterThanOrEqual(region!.left - 0.5)
      expect(num('top')).toBeGreaterThanOrEqual(region!.top - 0.5)
      expect(num('left') + num('width') * scale).toBeLessThanOrEqual(region!.left + region!.width + 0.5)
      expect(num('top') + num('height') * scale).toBeLessThanOrEqual(region!.top + region!.height + 0.5)
    })
    it(`${name} draws unchanged outside a region`, () => {
      expect(draw(Device as never, fixture as never, house)).not.toContain('data-region-fit')
    })
  }
})
