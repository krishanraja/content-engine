import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'vitest'
import { ProductionBriefV1Schema } from '../../packages/contracts/src/index.js'
import {
  buildProductionBrief,
  createProductionApproval,
  productionSeries,
} from '../../apps/control-plane/api/_productionBrief.ts'
import { readProductionBriefEnvelope } from '../../apps/control-plane/api/video-studio/_productionBriefQueue.ts'
import { parseProductionBriefClaimRequest, runnerTakesFormat, runnerTakesSeries } from '../../apps/control-plane/api/video-studio/_runnerContracts.ts'

// Krish, 2026-09-26: teach the video side the three subchannel names. Until
// then a piece on follow.the.money, mind.the.gap or under.the.hood could not
// get a production brief at all (walk log F21).

const approvedAt = '2026-09-26T12:00:00.000Z'
const piece = (lane_slot: string) => ({
  id: '22222222-2222-4222-8222-222222222222',
  idea: 'Who picks your AI?',
  thesis: 'More and more, software picks which AI answers you, and the price list is why.',
  body: 'On 7 August 2025, OpenAI made GPT-5 the new default in ChatGPT and called it a single auto-switching system. The app decides which model answers each question.',
  lane: 'publication',
  lane_slot,
  source_url: 'https://help.openai.com/en/articles/6825453-chatgpt-release-notes',
  meta: {},
})
const brief = (lane_slot: string, editorialFormat: string | null) => {
  const row = piece(lane_slot)
  return buildProductionBrief({ row, approval: createProductionApproval(row, approvedAt), productionKinds: ['video'], sourceMode: 'solo', editorialFormat: editorialFormat as never })
}

test('a piece on each live subchannel gets a brief in its own name, valid under the contract', () => {
  for (const [slot, format] of [['follow_the_money', 'money_trace'], ['under_the_hood', 'third_why'], ['mind_the_gap', 'the_fork']] as const) {
    assert.equal(productionSeries(piece(slot)), slot)
    const b = brief(slot, format)
    assert.equal(b.series, slot)
    assert.ok(ProductionBriefV1Schema.safeParse(b).success, slot)
    assert.ok(readProductionBriefEnvelope({ brief: b, status: 'ready_for_studio', requested_by: 'Krish', created_at: approvedAt }), slot)
  }
})

test('every live subchannel brief names one of its own formats: mind.the.gap\'s is The Fork', () => {
  assert.equal(brief('mind_the_gap', 'the_fork').editorial_format, 'the_fork')
  assert.throws(() => brief('mind_the_gap', null), /canonical_editorial_format_required/)
  assert.throws(() => brief('mind_the_gap', 'money_trace'), /canonical_editorial_format_required/)
  assert.throws(() => brief('follow_the_money', 'the_fork'), /canonical_editorial_format_required/)
  assert.throws(() => brief('follow_the_money', null), /canonical_editorial_format_required/)
  assert.throws(() => brief('follow_the_money', 'third_why'), /canonical_editorial_format_required/)
})

test('a piece on a retired slot keeps its retired series, never crossed to the live name', () => {
  assert.equal(productionSeries(piece('money_of_ai')), 'money_of_ai')
  assert.equal(brief('money_of_ai', 'money_trace').series, 'money_of_ai')
  // A venture_formats slug that is not a Studio series.
  assert.equal(productionSeries(piece('general')), null)
})

test('a runner that declares nothing is only handed the retired series', () => {
  const old = parseProductionBriefClaimRequest({ schema_version: 1, runner_id: 'runner-1', software_commit: 'a'.repeat(40), command_schema_versions: [1] })
  assert.ok(old)
  assert.equal(old.series_supported, null)
  assert.equal(runnerTakesSeries(old.series_supported, 'money_of_ai'), true)
  assert.equal(runnerTakesSeries(old.series_supported, 'mind_the_gap'), false)
  const current = parseProductionBriefClaimRequest({ schema_version: 1, runner_id: 'runner-1', software_commit: 'a'.repeat(40), command_schema_versions: [1], series_supported: ['money_of_ai', 'built_with_ai', 'follow_the_money', 'mind_the_gap', 'under_the_hood'] })
  assert.ok(current)
  assert.equal(runnerTakesSeries(current.series_supported, 'mind_the_gap'), true)
})

test('a runner that declares no formats is never handed The Fork', () => {
  const old = parseProductionBriefClaimRequest({ schema_version: 1, runner_id: 'runner-1', software_commit: 'a'.repeat(40), command_schema_versions: [1], series_supported: ['mind_the_gap'] })
  assert.ok(old)
  assert.equal(old.editorial_formats_supported, null)
  assert.equal(runnerTakesFormat(old.editorial_formats_supported, 'the_fork'), false)
  assert.equal(runnerTakesFormat(old.editorial_formats_supported, 'money_trace'), true)
  assert.equal(runnerTakesFormat(old.editorial_formats_supported, undefined), true)
  const current = parseProductionBriefClaimRequest({ schema_version: 1, runner_id: 'runner-1', software_commit: 'a'.repeat(40), command_schema_versions: [1], series_supported: ['mind_the_gap'], editorial_formats_supported: ['money_trace', 'the_fork'] })
  assert.ok(current)
  assert.equal(runnerTakesFormat(current.editorial_formats_supported, 'the_fork'), true)
})

test('the claim route asks before it leases', () => {
  const src = readFileSync('apps/control-plane/api/video-studio/runner/production-brief-claim.ts', 'utf8')
  assert.match(src, /parseProductionBriefClaimRequest\(req\.body\)/)
  const guard = src.indexOf('runnerTakesSeries(body.series_supported, envelope.brief.series)')
  assert.ok(guard > 0 && guard < src.indexOf('randomBytes(32)'), 'the series check must come before a lease is written')
  const formatGuard = src.indexOf('runnerTakesFormat(body.editorial_formats_supported, envelope.brief.editorial_format)')
  assert.ok(formatGuard > 0 && formatGuard < src.indexOf('randomBytes(32)'), 'the format check must come before a lease is written')
})
