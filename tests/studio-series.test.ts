import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import {
  BrandThemeV1Schema,
  ProductionBriefClaimRequestV1Schema,
  ProductionBriefV1Schema,
  RunnerClaimRequestV1Schema,
  SeriesSchema,
  editorialFormatBelongsToSeriesV1,
  normalizeSeries,
  sameSeriesLine,
  seriesEligible,
} from '@mindmake/contracts'
import { hashValue, officialSeriesMark, treatmentPresetMatchesScope } from '@mindmake/core'

// Krish, 2026-09-26: teach the video side the three subchannel names. The
// Studio's two retired series ids sit inside hashed and signed records that
// are re-parsed strictly, so the change adds the live names and never
// rewrites the old ones.

const studio = JSON.parse(readFileSync('config/studio.json', 'utf8'))
const briefFixture = JSON.parse(readFileSync('fixtures/contracts/production-brief-v1.json', 'utf8'))

describe('the Studio knows the three subchannels', () => {
  test('every series parses, and the retired pair still does', () => {
    for (const s of ['money_of_ai', 'built_with_ai', 'follow_the_money', 'mind_the_gap', 'under_the_hood']) expect(SeriesSchema.parse(s)).toBe(s)
    expect(() => SeriesSchema.parse('general')).toThrow()
    expect(normalizeSeries('follow.the.money')).toBe('follow_the_money')
    expect(normalizeSeries('Mind the gap')).toBe('mind_the_gap')
    expect(normalizeSeries('paid')).toBe('money_of_ai')
  })

  test('a brief made under a retired name parses to the same object and hash', () => {
    const parsed = ProductionBriefV1Schema.parse(briefFixture)
    expect(hashValue(parsed)).toBe(hashValue(briefFixture))
  })

  test('the pinned brand theme parses and hashes exactly as before', () => {
    for (const theme of studio.brand_themes) expect(hashValue(BrandThemeV1Schema.parse(theme))).toBe(hashValue(theme))
  })

  test('follow.the.money and under.the.hood inherit their predecessors\' formats; mind.the.gap has none', () => {
    expect(editorialFormatBelongsToSeriesV1('follow_the_money', 'money_trace')).toBe(true)
    expect(editorialFormatBelongsToSeriesV1('follow_the_money', 'third_why')).toBe(false)
    expect(editorialFormatBelongsToSeriesV1('under_the_hood', 'third_why')).toBe(true)
    expect(editorialFormatBelongsToSeriesV1('mind_the_gap', 'money_trace')).toBe(false)
    const mind = { ...briefFixture, series: 'mind_the_gap' }
    delete mind.editorial_format
    expect(ProductionBriefV1Schema.safeParse(mind).success).toBe(true)
    expect(ProductionBriefV1Schema.safeParse({ ...mind, editorial_format: 'money_trace' }).success).toBe(false)
  })

  test('approved rules, presets and devices follow the subchannel, and old matches are unchanged', () => {
    expect(sameSeriesLine('money_of_ai', 'follow_the_money')).toBe(true)
    expect(sameSeriesLine('money_of_ai', 'under_the_hood')).toBe(false)
    expect(sameSeriesLine('money_of_ai', 'built_with_ai')).toBe(false)
    // A list naming both retired ids meant every series.
    for (const s of ['money_of_ai', 'built_with_ai', 'follow_the_money', 'mind_the_gap', 'under_the_hood'] as const) expect(seriesEligible(['money_of_ai', 'built_with_ai'], s)).toBe(true)
    expect(seriesEligible(['built_with_ai'], 'under_the_hood')).toBe(true)
    expect(seriesEligible(['built_with_ai'], 'follow_the_money')).toBe(false)
    expect(seriesEligible(['built_with_ai'], 'money_of_ai')).toBe(false)
    const preset = studio.approved_treatments.find((p: { scope?: { series?: string[] } }) => p.scope?.series?.length === 1)
    const mode = preset.scope.modes[0]
    const own = preset.scope.series[0]
    expect(treatmentPresetMatchesScope(preset, own, mode)).toBe(true)
    expect(treatmentPresetMatchesScope(preset, own === 'built_with_ai' ? 'under_the_hood' : 'follow_the_money', mode)).toBe(true)
    expect(treatmentPresetMatchesScope(preset, 'mind_the_gap', mode)).toBe(false)
  })

  test('a live subchannel without an approved mark is refused in plain words, never drawn as text', () => {
    const theme = BrandThemeV1Schema.parse(studio.brand_themes[0])
    expect(officialSeriesMark(theme, 'money_of_ai').sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(() => officialSeriesMark(theme, 'mind_the_gap')).toThrow(/mind_the_gap has no approved official wordmark yet/)
  })

  test('each subchannel has a public name and its brand colour in the Studio config', () => {
    expect(studio.series.follow_the_money).toMatchObject({ public_name: 'follow.the.money', accent: '#FFD84D' })
    expect(studio.series.mind_the_gap).toMatchObject({ public_name: 'mind.the.gap', accent: '#FF6A4D' })
    expect(studio.series.under_the_hood).toMatchObject({ public_name: 'under.the.hood', accent: '#B7A6FF' })
  })

  test('a runner declares the series it can parse on its brief claim', () => {
    const base = { schema_version: 1, runner_id: 'runner-1', software_commit: 'a'.repeat(40), command_schema_versions: [1] }
    expect(ProductionBriefClaimRequestV1Schema.safeParse(base).success).toBe(true)
    expect(ProductionBriefClaimRequestV1Schema.safeParse({ ...base, series_supported: ['money_of_ai', 'mind_the_gap'] }).success).toBe(true)
    expect(ProductionBriefClaimRequestV1Schema.safeParse({ ...base, series_supported: ['general'] }).success).toBe(false)
    // The general command claim stays strict, which is why brief claims have their own parser.
    expect(RunnerClaimRequestV1Schema.safeParse({ ...base, series_supported: ['mind_the_gap'] }).success).toBe(false)
  })
})
