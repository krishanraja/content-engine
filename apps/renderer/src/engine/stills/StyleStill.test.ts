import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CAPTION_THEMES } from '../captions/names'
import { stillIds, StyleStill } from './StyleStill'

describe('StyleStill lineup', () => {
  it('advertises every caption renderer and no duplicate covers', () => {
    const ids = stillIds()
    expect(ids.filter(x => x.layer === 'captions').map(x => x.id)).toEqual([...CAPTION_THEMES])
    expect(new Set(ids.map(x => `${x.layer}/${x.id}`)).size).toBe(ids.length)
  })
  it('draws every advertised cover deterministically without media', () => {
    for (const props of stillIds()) {
      const draw = () => renderToStaticMarkup(React.createElement(StyleStill, props))
      const html = draw()
      expect(html, JSON.stringify(props)).toContain('data-style-still')
      expect(html).toBe(draw())
      expect(html).not.toMatch(/<(img|video|audio)\b/)
      expect(html).not.toMatch(/fixture|placeholder|NaN|Infinity/)
    }
  })
  it('returns null for unknown ids, wrong layers and unsupported pipelines', () => {
    expect(StyleStill({ layer: 'motion', id: 'watercolour-ink' })).toBeNull()
    expect(StyleStill({ layer: 'captions', id: 'unknown' })).toBeNull()
    expect(StyleStill({ layer: 'treatment', id: 'pop' })).toBeNull()
  })
})
