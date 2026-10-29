import { describe, expect, it } from 'vitest'
import { fromAsciiProps, lagSamples, toAsciiProps } from './transport'

describe('ASCII props transport', () => {
  const strings = [
    'SAME WORK PROMPT · ONLY THE COUNTRY CHANGES',
    "OUR TEST · 23 OCT",
    'Sorry, that’s beyond',
    'An emoji: 😀',
    'A literal backslash: \\',
    String.raw`Already escaped: \u00b7`,
    String.raw`\u005c\u005cu00b7`,
    'Plain ASCII',
    '\u007f\ud800\u0000',
  ]
  it.each(strings)('round trips %s using only ASCII values', (value) => {
    const encoded = toAsciiProps(value)
    expect(encoded).toMatch(/^[\x00-\x7e]*$/)
    expect(fromAsciiProps(encoded)).toBe(value)
  })
  it('uses lowercase six-character code-unit escapes, including surrogate pairs', () => {
    expect(toAsciiProps('·😀\\')).toBe(String.raw`\u00b7\ud83d\ude00\u005c`)
  })
  it('deep copies nested objects and arrays while preserving keys and primitives', () => {
    const original = { 'clé·': [{ text: strings, number: 42.6, nil: null, flag: true }], empty: [] }
    const encoded = toAsciiProps(original)
    expect(encoded).not.toBe(original)
    expect(encoded['clé·']).not.toBe(original['clé·'])
    expect(encoded['clé·'][0]).not.toBe(original['clé·'][0])
    expect(Object.keys(encoded)).toEqual(Object.keys(original))
    expect(encoded['clé·'][0]?.number).toBe(42.6)
    expect(fromAsciiProps(encoded)).toEqual(original)
    expect(fromAsciiProps('plain props without escapes ·')).toBe('plain props without escapes ·')
  })
})

function signal(length: number): Float32Array {
  let seed = 12345
  return Float32Array.from({ length }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x80000000 - 1
  })
}

describe('lagSamples', () => {
  const stem = signal(24000)
  it('finds a 2048-sample AAC delay', () => {
    const rendered = new Float32Array(stem.length)
    rendered.set(stem.subarray(0, stem.length - 2048), 2048)
    expect(lagSamples(rendered, stem, 9600)).toBe(2048)
  })
  it('finds early audio and zero lag, regardless of amplitude', () => {
    const rendered = new Float32Array(stem.length)
    rendered.set(stem.subarray(2048).map((sample) => sample * 0.4))
    expect(lagSamples(rendered, stem, 9600)).toBe(-2048)
    expect(lagSamples(stem, stem, 9600)).toBe(0)
    expect(lagSamples(stem, stem, 0)).toBe(0)
  })
  it('includes both search boundaries and supports unequal lengths', () => {
    const rendered = new Float32Array(stem.length + 48)
    rendered.set(stem, 48)
    expect(lagSamples(rendered, stem, 48)).toBe(48)
    expect(lagSamples(stem, rendered, 48)).toBe(-48)
  })
  it('rejects invalid probes rather than reporting a false sync pass', () => {
    expect(() => lagSamples(new Float32Array(24000), stem, 9600)).toThrow(/silent/)
    expect(() => lagSamples(stem, stem, -1)).toThrow()
    expect(() => lagSamples(stem, stem, 24000)).toThrow()
    expect(() => lagSamples(new Float32Array(), stem, 0)).toThrow()
    expect(() => lagSamples(Float32Array.of(NaN, 1), Float32Array.of(1, 2), 1)).toThrow(/nonfinite/)
  })
})
