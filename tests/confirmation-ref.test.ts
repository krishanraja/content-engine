import { describe, expect, it } from 'vitest'
import {
  CarouselApprovalV1Schema,
  DriveInboxRebindV1Schema,
  DriveIntakeReviewV1Schema,
  confirmationRefMatches,
  confirmationRefPrefixes,
  portableConfirmationRefPrefix,
} from '@mindmake/contracts'

const hash = 'a'.repeat(64)
const otherHash = 'b'.repeat(64)

describe('confirmationRefMatches', () => {
  it('accepts the portable prefix from any well-formed client token', () => {
    // Underscore clients match the StudioClientV1 session enum (claude_code, control_center).
    for (const client of ['claude-code', 'claude_code', 'control_center', 'codex-cli', 'chatgpt', 'x9', 'a-'.repeat(20)]) {
      expect(confirmationRefMatches(`studio-user-confirmation:${client}:angle:${hash}:Krish approved`, 'angle', hash)).toBe(true)
    }
  })

  it('keeps legacy Codex and Control Center receipts valid', () => {
    expect(confirmationRefMatches(`codex-user-confirmation:angle:${hash}:Krish approved`, 'angle', hash)).toBe(true)
    expect(confirmationRefMatches(`control-center-confirmation:angle:${hash}:review:r1:decision:d1`, 'angle', hash)).toBe(true)
  })

  it('rejects a malformed client segment, a missing receipt, or a reference bound elsewhere', () => {
    for (const reference of [
      `studio-user-confirmation:Claude-Code:angle:${hash}:receipt`,
      `studio-user-confirmation:1claude:angle:${hash}:receipt`,
      `studio-user-confirmation:c:angle:${hash}:receipt`,
      `studio-user-confirmation:${'c'.repeat(41)}:angle:${hash}:receipt`,
      `studio-user-confirmation::angle:${hash}:receipt`,
      `studio-user-confirmation:angle:${hash}:receipt`,
      `studio-user-confirmation:claude-code:angle:${hash}:`,
      `studio-user-confirmation:claude-code:angle:${hash}:  `,
      `studio-user-confirmation:claude-code:final:${hash}:receipt`,
      `studio-user-confirmation:claude-code:angle:${otherHash}:receipt`,
      `codex-user-confirmation:angle:${otherHash}:receipt`,
      `codex-user-confirmation:angle:${hash}:`,
      `someone-else-confirmation:angle:${hash}:receipt`,
      '',
    ]) {
      expect(confirmationRefMatches(reference, 'angle', hash)).toBe(false)
    }
    expect(confirmationRefMatches(undefined, 'angle', hash)).toBe(false)
    expect(confirmationRefMatches(null, 'angle', hash)).toBe(false)
  })

  it('binds multi-part hashes such as the inbox rebind identity pair', () => {
    const pair = `${hash}:${otherHash}`
    expect(confirmationRefMatches(`studio-user-confirmation:claude-code:inbox-rebind:${pair}:Krish confirmed`, 'inbox-rebind', pair)).toBe(true)
    expect(confirmationRefMatches(`studio-user-confirmation:claude-code:inbox-rebind:${hash}:Krish confirmed`, 'inbox-rebind', pair)).toBe(false)
  })

  it('renders the portable prefix first in hints with a placeholder client token', () => {
    expect(portableConfirmationRefPrefix('angle', hash)).toBe(`studio-user-confirmation:<client>:angle:${hash}:`)
    expect(confirmationRefPrefixes('angle', hash)).toEqual([
      `studio-user-confirmation:<client>:angle:${hash}:`,
      `codex-user-confirmation:angle:${hash}:`,
      `control-center-confirmation:angle:${hash}:`,
    ])
  })
})

describe('schema gates that use the shared helper', () => {
  it('accepts the portable prefix at the Drive intake gate and rejects a malformed client', () => {
    const base = {
      schema_version: 1,
      review_id: '11111111-1111-4111-8111-111111111111',
      candidate_id: `intake_${'0'.repeat(24)}`,
      candidate_hash: hash,
      inbox_fingerprint: 'c'.repeat(64),
      scan_sequence: 1,
      discovery_event_hash: 'd'.repeat(64),
      verification_hash: 'e'.repeat(64),
      decision: 'accepted',
      note: 'Use this exact recording.',
      reviewed_by: 'Krish',
      reviewed_at: '2026-09-07T09:00:00.000Z',
    }
    const parse = (confirmation_ref: string) => DriveIntakeReviewV1Schema.safeParse({ ...base, confirmation_ref })
    expect(parse(`studio-user-confirmation:claude-code:intake:${hash}:Krish approved this intake recording`).success).toBe(true)
    expect(parse(`codex-user-confirmation:intake:${hash}:Krish approved this intake recording`).success).toBe(true)
    expect(parse(`studio-user-confirmation:claude-code:intake:${otherHash}:Krish approved this intake recording`).success).toBe(false)
  })

  it('accepts the portable prefix at the Inbox rebind gate and keeps both identities bound', () => {
    const base = {
      schema_version: 1,
      previous_inbox_fingerprint: hash,
      next_inbox_fingerprint: otherHash,
      confirmed_by: 'Krish',
      rebound_at: '2026-09-07T09:00:00.000Z',
    }
    const parse = (confirmation_ref: string) => DriveInboxRebindV1Schema.safeParse({ ...base, confirmation_ref })
    expect(parse(`studio-user-confirmation:claude-code:inbox-rebind:${hash}:${otherHash}:Krish confirmed the replacement folder`).success).toBe(true)
    expect(parse(`codex-user-confirmation:inbox-rebind:${hash}:${otherHash}:Krish confirmed the replacement folder`).success).toBe(true)
    expect(parse(`studio-user-confirmation:claude-code:inbox-rebind:${otherHash}:${hash}:Krish confirmed the replacement folder`).success).toBe(false)
    expect(parse(`studio-user-confirmation:Claude:inbox-rebind:${hash}:${otherHash}:Krish confirmed the replacement folder`).success).toBe(false)
  })

  it('requires a carousel approval to carry a confirmation bound to its own gate and artifact hash', () => {
    const base = { gate: 'story', decision: 'approved', approved_by: 'Krish', approved_at: '2026-09-07T09:00:00.000Z', artifact_hash: hash }
    expect(CarouselApprovalV1Schema.safeParse(base).success).toBe(false)
    expect(CarouselApprovalV1Schema.safeParse({ ...base, confirmation_ref: `studio-user-confirmation:claude-code:story:${hash}:Krish approved the story` }).success).toBe(true)
    expect(CarouselApprovalV1Schema.safeParse({ ...base, confirmation_ref: `codex-user-confirmation:story:${hash}:Krish approved the story` }).success).toBe(true)
    expect(CarouselApprovalV1Schema.safeParse({ ...base, confirmation_ref: `studio-user-confirmation:claude-code:visual_direction:${hash}:Krish approved the story` }).success).toBe(false)
    expect(CarouselApprovalV1Schema.safeParse({ ...base, confirmation_ref: `studio-user-confirmation:claude-code:story:${otherHash}:Krish approved the story` }).success).toBe(false)
  })
})
