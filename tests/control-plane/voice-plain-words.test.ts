import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import { VOICE_GUARDRAILS } from '../../apps/control-plane/api/_content.js'
import { VOICE_ABSOLUTES } from '../../apps/control-plane/api/_finalPass.js'

// Krish, 2026-09-25, looking at piece 2's page: "We do say no jargon everywhere
// and I don't just mean technical jargon. I mean words that someone needs to
// interpret." And earlier the same day: "an average reading age of 12 and a
// huge sense of humour and fun and personality."
describe('plain words and a reading age of 12 are house rules', () => {
  test('every writer reads them', () => {
    assert.match(VOICE_GUARDRAILS, /Plain words only: no word the reader has to interpret/)
    assert.match(VOICE_GUARDRAILS, /our own coined labels, nicknames and shorthand/)
    assert.match(VOICE_GUARDRAILS, /Write for a reading age of 12/)
  })
  test('the final pass checks them before anything ships', () => {
    assert.ok(VOICE_ABSOLUTES.some(r => /Plain words only/.test(r) && /coined labels/.test(r)))
    assert.ok(VOICE_ABSOLUTES.some(r => /Reading age 12/.test(r)))
  })
  test('every route that writes copy carries the house rules, channel cuts included', () => {
    for (const p of [
      'apps/control-plane/api/content-ideas/[id]/draft.ts',
      'apps/control-plane/api/_revisePrompt.ts',
      'apps/control-plane/api/content-ideas/[id]/chat.ts',
      'apps/control-plane/api/content-ideas/[id]/channel-cut.ts',
      'apps/control-plane/api/content-ideas/synthesize.ts',
    ]) assert.match(readFileSync(p, 'utf8'), /VOICE_GUARDRAILS/, p)
  })
})
