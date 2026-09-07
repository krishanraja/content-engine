import { describe, expect, it } from 'vitest'
import {
  FeedbackConfirmationV2Schema,
  LearningProposalV1Schema,
  StudioInteractionEventV1Schema,
  StudioSessionV1Schema,
} from '@mindmake/contracts'

const sha = 'a'.repeat(64)
const sessionId = '11111111-1111-4111-8111-111111111111'
const eventId = '22222222-2222-4222-8222-222222222222'

describe('portable studio session contracts', () => {
  it('represents a tracked client without recording a chat transcript', () => {
    const session = StudioSessionV1Schema.parse({
      schema_version: 1,
      session_id: sessionId,
      client: 'claude_ai',
      actor: { actor_id: 'krish', display_name: 'Krish' },
      capabilities: ['session_read', 'review_read', 'feedback_write'],
      repository: { name: 'krishanraja/mindmake-video-studio', revision: 'b'.repeat(40) },
      linked_job_ids: ['job-one'],
      privacy_mode: 'structured_events_only',
      tracking_state: 'tracked',
      opened_at: '2026-09-07T09:00:00.000Z',
      last_seen_at: '2026-09-07T09:01:00.000Z',
      closed_at: null,
    })
    expect(session.privacy_mode).toBe('structured_events_only')
    expect(() => StudioSessionV1Schema.parse({ ...session, transcript: 'private conversation' })).toThrow()
  })

  it('prevents untracked sessions from claiming mutation capabilities', () => {
    const input = {
      schema_version: 1,
      session_id: sessionId,
      client: 'chatgpt',
      actor: { actor_id: 'krish', display_name: 'Krish' },
      capabilities: ['feedback_write'],
      repository: { name: 'krishanraja/mindmake-video-studio', revision: 'b'.repeat(40) },
      linked_job_ids: [],
      privacy_mode: 'structured_events_only',
      tracking_state: 'read_only_untracked',
      opened_at: '2026-09-07T09:00:00.000Z',
      last_seen_at: '2026-09-07T09:00:00.000Z',
      closed_at: null,
    }
    expect(() => StudioSessionV1Schema.parse(input)).toThrow('untracked sessions')
  })

  it('stores only explicit feedback excerpts and bounded structured differences', () => {
    const event = StudioInteractionEventV1Schema.parse({
      schema_version: 1,
      event_id: eventId,
      idempotency_key: '33333333-3333-4333-8333-333333333333',
      session_id: sessionId,
      client: 'control_center',
      action: 'feedback_corrected',
      job_id: 'job-one',
      artifact: { artifact_id: 'carousel-slide-7', before_hash: sha, after_hash: 'b'.repeat(64) },
      explicit_feedback_excerpt: 'Put the Mindmake wordmark in the bottom left.',
      detected_differences: [{ feature: 'brand.footer.anchor', summary: 'Moved from bottom right to bottom left.' }],
      inference: { rationale: 'Use the bottom-left Mindmake footer for this treatment.', confidence: 1, scope: { level: 'treatment', key: 'carousel_infographic' } },
      confirmation_state: 'corrected',
      provenance: { tool_name: 'studio.feedback.confirm', request_hash: sha },
      occurred_at: '2026-09-07T09:02:00.000Z',
    })
    expect(event.explicit_feedback_excerpt).toContain('bottom left')
    expect(() => StudioInteractionEventV1Schema.parse({ ...event, raw_transcript: 'all messages' })).toThrow()
  })

  it('accepts portable confirmations and preserves legacy Codex receipts', () => {
    const base = {
      schema_version: 2,
      confirmation_id: '44444444-4444-4444-8444-444444444444',
      feedback_id: '55555555-5555-4555-8555-555555555555',
      job_id: 'job-one',
      event_hash: sha,
      confirmation: 'confirmed',
      confirmed_rationale: 'Keep this treatment.',
      confirmed_at: '2026-09-07T09:03:00.000Z',
    }
    expect(FeedbackConfirmationV2Schema.parse({ ...base, confirmation_ref: `studio-user-confirmation:claude_ai:feedback:${sha}:Krish confirmed.` }).confirmation_ref).toContain('claude_ai')
    expect(FeedbackConfirmationV2Schema.parse({ ...base, confirmation_ref: `codex-user-confirmation:feedback:${sha}:Krish confirmed.` }).confirmation_ref).toContain('codex-user')
    expect(() => FeedbackConfirmationV2Schema.parse({ ...base, confirmation_ref: `studio-user-confirmation:chatgpt:feedback:${'f'.repeat(64)}:Krish confirmed.` })).toThrow()
  })

  it('does not promote performance evidence from fewer than three comparable tests', () => {
    const input = {
      schema_version: 1,
      proposal_id: '66666666-6666-4666-8666-666666666666',
      weekly_batch_id: 'week-2026-36',
      proposal_class: 'performance',
      assertion: 'Move proof into the first beat.',
      scope: { level: 'series', key: 'built_with_ai' },
      evidence_event_ids: [eventId],
      independent_session_count: 1,
      independent_job_count: 1,
      counterexamples: [],
      regression_cases: ['Preserve meaning when proof cannot appear early.'],
      proposed_change: { kind: 'preference_rule', summary: 'Prefer earlier proof where supported.' },
      status: 'proposed',
      created_at: '2026-09-07T09:04:00.000Z',
    }
    expect(() => LearningProposalV1Schema.parse(input)).toThrow('three comparable tests')
  })
})
