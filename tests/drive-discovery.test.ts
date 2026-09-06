import { appendFile, copyFile, mkdtemp, mkdir, readFile, rename, rm, stat, unlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DriveDiscoveryHealthV1Schema, DriveDiscoveryStateV1Schema, driveDiscoveryEventHashInputV1 } from '@mindmake/contracts'
import {
  assertPortableDriveIntakeProof,
  assertDriveSourceBundleProvenance,
  attachSourceBundleV2,
  driveIntakeCandidateDetail,
  driveInboxRebindProposal,
  createDriveSourceBundleDraft,
  createJobV2,
  hashValue,
  initializeDriveInbox,
  loadDriveDiscoveryState,
  loadJobV2,
  reviewDriveIntakeCandidate,
  rebindDriveInbox,
  sanitizedDriveDiscoverySummary,
  scanDriveInbox,
} from '@mindmake/core'

interface Fixture {
  root: string
  inbox: string
  runtime: string
}

const created: string[] = []

async function fixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'mindmake-drive-discovery-'))
  const inbox = join(root, 'Inbox')
  const runtime = join(root, 'Runtime')
  await mkdir(inbox)
  created.push(root)
  return { root, inbox, runtime }
}

async function scanAt(item: Fixture, iso: string, overrides: Partial<Parameters<typeof scanDriveInbox>[0]> = {}) {
  return scanDriveInbox({
    inboxPath: item.inbox,
    driveRoot: item.root,
    archiveRoot: join(item.root, 'Archive'),
    runtimeRoot: item.runtime,
    stabilitySeconds: 10,
    now: () => new Date(iso),
    ...overrides,
  })
}

function scanOptions(item: Fixture, iso: string): Parameters<typeof scanDriveInbox>[0] {
  return {
    inboxPath: item.inbox,
    driveRoot: item.root,
    archiveRoot: join(item.root, 'Archive'),
    runtimeRoot: item.runtime,
    stabilitySeconds: 10,
    now: () => new Date(iso),
  }
}

afterEach(async () => {
  for (const path of created.splice(0)) await rm(path, { recursive: true, force: true })
})

describe('mounted Google Drive discovery', () => {
  it('requires two unchanged scans and the stability interval before hashing media', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'recording.mp4'), 'owned-video')

    const first = await scanAt(item, '2026-09-04T10:00:00.000Z')
    expect(first.scan?.files).toMatchObject([{ display_name: 'recording.mp4', status: 'partial', safe_code: 'awaiting_stability', consecutive_unchanged_scans: 1 }])
    expect(first.scan?.settings.maximum_hash_bytes_per_scan).toBe(68_719_476_736)
    expect(first.scan?.candidates).toHaveLength(0)

    const tooSoon = await scanAt(item, '2026-09-04T10:00:05.000Z')
    expect(tooSoon.scan?.files[0]).toMatchObject({ status: 'partial', consecutive_unchanged_scans: 2 })

    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    expect(stable.scan?.files[0]).toMatchObject({ status: 'stable', safe_code: 'stable', consecutive_unchanged_scans: 3 })
    expect(stable.scan?.files[0]?.content_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(stable.scan?.candidates).toMatchObject([{ classification: 'ready_for_review', sequence_kind: 'standalone', availability: 'available' }])
  })

  it('resets stability when size or modification time changes', async () => {
    const item = await fixture()
    const source = join(item.inbox, 'changing.mov')
    await writeFile(source, 'first')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    await writeFile(source, 'second-version')
    const changed = await scanAt(item, '2026-09-04T10:00:20.000Z')
    expect(changed.scan?.files[0]).toMatchObject({ status: 'partial', safe_code: 'awaiting_stability', consecutive_unchanged_scans: 1 })
    expect(changed.scan?.candidates).toHaveLength(0)
  })

  it('attaches exact-stem audio, caption, and edit sidecars without guessing', async () => {
    const item = await fixture()
    await Promise.all([
      writeFile(join(item.inbox, 'story.mp4'), 'video'),
      writeFile(join(item.inbox, 'story.wav'), 'audio'),
      writeFile(join(item.inbox, 'story.srt'), '1\n00:00:00,000 --> 00:00:01,000\nHello'),
      writeFile(join(item.inbox, 'story.fcpxml'), '<fcpxml/>'),
      writeFile(join(item.inbox, 'other.vtt'), 'WEBVTT'),
    ])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const state = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const candidate = state.scan?.candidates.find((value) => value.classification === 'ready_for_review')
    expect(candidate).toMatchObject({ media_file_ids: expect.any(Array), sidecar_file_ids: expect.any(Array) })
    expect(candidate?.media_file_ids).toHaveLength(2)
    expect(candidate?.sidecar_file_ids).toHaveLength(2)
    expect(state.scan?.health.safe_codes).toContain('orphan_sidecar_requires_manual_match')
  })

  it('holds DJI telemetry SRT instead of treating camera metadata as speech captions', async () => {
    const item = await fixture()
    await Promise.all([
      writeFile(join(item.inbox, 'DJI_20260904_120000.mp4'), 'video'),
      writeFile(join(item.inbox, 'DJI_20260904_120000.srt'), '1\n00:00:00,000 --> 00:00:01,000\nFrameCnt: 1, DiffTime: 33ms, shutter: 1/120, fnum: 2.8, iso: 100, latitude: 51.5, longitude: -0.1'),
    ])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const state = await scanAt(item, '2026-09-04T10:00:11.000Z')
    expect(state.scan?.files.find((file) => file.extension === '.srt')).toMatchObject({ status: 'stable', safe_code: 'dji_telemetry_srt_requires_manual_review' })
    expect(state.scan?.candidates[0]).toMatchObject({ classification: 'attention', safe_codes: expect.arrayContaining(['dji_telemetry_srt_requires_manual_review']) })
    expect(state.scan?.health.ready_candidates).toBe(0)
  })

  it('bounds hashing across scans and prevents oversized sidecars from reaching parsers', async () => {
    const item = await fixture()
    await Promise.all([writeFile(join(item.inbox, 'a.mp4'), 'aaaa'), writeFile(join(item.inbox, 'b.mp4'), 'bbbb')])
    await scanAt(item, '2026-09-04T10:00:00.000Z', { maxHashBytesPerScan: 5 })
    const bounded = await scanAt(item, '2026-09-04T10:00:11.000Z', { maxHashBytesPerScan: 5 })
    expect(bounded.scan?.files.find((file) => file.display_name === 'a.mp4')?.status).toBe('stable')
    expect(bounded.scan?.files.find((file) => file.display_name === 'b.mp4')).toMatchObject({ status: 'partial', safe_code: 'hash_byte_budget_deferred' })
    expect(bounded.scan?.health).toMatchObject({ status: 'ready', safe_codes: expect.arrayContaining(['hash_byte_budget_deferred']) })
    const resumed = await scanAt(item, '2026-09-04T10:00:12.000Z', { maxHashBytesPerScan: 5 })
    expect(resumed.scan?.files.filter((file) => file.status === 'stable')).toHaveLength(2)

    const oversized = await fixture()
    await writeFile(join(oversized.inbox, 'large.mp4'), '123456')
    await scanAt(oversized, '2026-09-04T10:00:00.000Z', { maxHashBytesPerScan: 5 })
    const explicitlyBlocked = await scanAt(oversized, '2026-09-04T10:00:11.000Z', { maxHashBytesPerScan: 5 })
    expect(explicitlyBlocked.scan?.files[0]).toMatchObject({ status: 'partial', safe_code: 'file_exceeds_hash_budget' })
    expect(explicitlyBlocked.scan?.health.safe_codes).toContain('file_exceeds_hash_budget')

    const sidecar = await fixture()
    await Promise.all([writeFile(join(sidecar.inbox, 'clip.mp4'), 'video'), writeFile(join(sidecar.inbox, 'clip.srt'), 'x'.repeat(40))])
    await scanAt(sidecar, '2026-09-04T10:00:00.000Z', { maxSidecarBytes: 16 })
    const capped = await scanAt(sidecar, '2026-09-04T10:00:11.000Z', { maxSidecarBytes: 16 })
    expect(capped.scan?.files.find((file) => file.extension === '.srt')).toMatchObject({ status: 'partial', safe_code: 'sidecar_size_limit_exceeded' })
    expect(capped.scan?.candidates[0]).toMatchObject({ classification: 'attention', safe_codes: expect.arrayContaining(['matching_association_not_stable']) })
  })

  it('groups only explicit, contiguous DJI split markers and caps unsafe guesses', async () => {
    const item = await fixture()
    await Promise.all([
      writeFile(join(item.inbox, 'DJI_interview_part001.mp4'), 'part-one'),
      writeFile(join(item.inbox, 'DJI_interview_part002.mp4'), 'part-two'),
      writeFile(join(item.inbox, 'DJI_20260904_0001_D.mp4'), 'generic-one'),
      writeFile(join(item.inbox, 'DJI_20260904_0002_D.mp4'), 'generic-two'),
    ])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const state = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const split = state.scan?.candidates.find((candidate) => candidate.sequence_kind === 'dji_explicit_split')
    expect(split).toMatchObject({ display_name: 'DJI_interview', classification: 'ready_for_review' })
    expect(split?.media_file_ids).toHaveLength(2)
    const generic = state.scan?.candidates.filter((candidate) => candidate.sequence_kind === 'standalone' && candidate.display_name.includes('20260904')) ?? []
    expect(generic).toHaveLength(2)
    expect(generic.every((candidate) => candidate.classification === 'ready_for_review')).toBe(true)
  })

  it('holds gapped and oversized explicit DJI sequences for attention', async () => {
    const item = await fixture()
    await Promise.all([
      writeFile(join(item.inbox, 'DJI_gap_part001.mp4'), 'one'),
      writeFile(join(item.inbox, 'DJI_gap_part003.mp4'), 'three'),
      ...Array.from({ length: 33 }, (_, index) => writeFile(join(item.inbox, `DJI_long_part${String(index + 1).padStart(3, '0')}.mp4`), `part-${index + 1}`)),
    ])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const state = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const gap = state.scan?.candidates.find((candidate) => candidate.display_name === 'DJI_gap')
    expect(gap).toMatchObject({ classification: 'attention', safe_codes: expect.arrayContaining(['dji_split_sequence_has_gaps']) })
    const long = state.scan?.candidates.find((candidate) => candidate.display_name === 'DJI_long')
    expect(long).toMatchObject({ classification: 'attention', omitted_component_count: 1, media_file_ids: expect.any(Array), safe_codes: expect.arrayContaining(['candidate_component_limit_exceeded', 'dji_split_sequence_too_large']) })
    expect(long?.media_file_ids).toHaveLength(32)
  })

  it('never accepts a DJI sequence while another matching split part is still copying', async () => {
    const item = await fixture()
    await Promise.all([
      writeFile(join(item.inbox, 'DJI_session_part001.mp4'), 'one'),
      writeFile(join(item.inbox, 'DJI_session_part002.mp4'), 'two'),
    ])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    await scanAt(item, '2026-09-04T10:00:11.000Z')
    await writeFile(join(item.inbox, 'DJI_session_part003.mp4'), 'three-copying')
    const copying = await scanAt(item, '2026-09-04T10:00:12.000Z')
    const candidate = copying.scan!.candidates.find((itemCandidate) => itemCandidate.availability === 'available')!
    expect(candidate).toMatchObject({ classification: 'attention', safe_codes: expect.arrayContaining(['dji_split_part_not_stable']) })
    await expect(reviewDriveIntakeCandidate({
      candidate_id: candidate.candidate_id,
      candidate_hash: candidate.candidate_hash,
      decision: 'accepted',
      note: 'Do not accept this partial group.',
      confirmation_ref: `codex-user-confirmation:intake:${candidate.candidate_hash}:attempt partial group acceptance`,
    }, scanOptions(item, '2026-09-04T10:00:13.000Z'))).rejects.toThrow(/attention or duplicate/)
  })

  it('deduplicates identical content across paths and remembers it across restarts', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'a.mp4'), 'same-content')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    await scanAt(item, '2026-09-04T10:00:11.000Z')
    await writeFile(join(item.inbox, 'copy.mp4'), 'same-content')
    await scanAt(item, '2026-09-04T10:00:20.000Z')
    const afterRestart = await scanAt(item, '2026-09-04T10:00:31.000Z')
    expect(afterRestart.scan?.files.find((file) => file.display_name === 'copy.mp4')).toMatchObject({ status: 'duplicate', safe_code: 'duplicate_content' })
    expect(afterRestart.scan?.health.duplicate_files).toBe(1)
    expect(afterRestart.scan?.candidates.filter((candidate) => candidate.availability === 'available')).toHaveLength(1)
    expect((await loadDriveDiscoveryState(item.runtime)).state_hash).toBe(afterRestart.state_hash)
  })

  it('lets a partial association on a duplicate path dominate a colliding ready candidate ID', async () => {
    const item = await fixture()
    await Promise.all([writeFile(join(item.inbox, 'a.mp4'), 'same-content'), writeFile(join(item.inbox, 'b.mp4'), 'same-content')])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    await scanAt(item, '2026-09-04T10:00:11.000Z')
    await writeFile(join(item.inbox, 'b.srt'), 'copying-caption')
    const state = await scanAt(item, '2026-09-04T10:00:12.000Z')
    expect(state.scan?.candidates).toHaveLength(1)
    expect(state.scan?.candidates[0]).toMatchObject({ classification: 'attention', safe_codes: expect.arrayContaining(['matching_association_not_stable']) })
    expect(state.scan?.health.ready_candidates).toBe(0)
  })

  it('makes unsupported and ambiguous inputs explicit', async () => {
    const item = await fixture()
    await Promise.all([
      writeFile(join(item.inbox, 'same.mp4'), 'mp4'),
      writeFile(join(item.inbox, 'same.mov'), 'mov'),
      writeFile(join(item.inbox, 'notes.docx'), 'not-media'),
    ])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const state = await scanAt(item, '2026-09-04T10:00:11.000Z')
    expect(state.scan?.files.find((file) => file.display_name === 'notes.docx')).toMatchObject({ status: 'unsupported', safe_code: 'unsupported_file_type' })
    expect(state.scan?.candidates).toMatchObject([{ classification: 'attention', safe_codes: ['ambiguous_primary_media'] }])
  })

  it('preserves a disappeared candidate as missing instead of silently forgetting it', async () => {
    const item = await fixture()
    const source = join(item.inbox, 'gone.mp4')
    await writeFile(source, 'video')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const candidateId = stable.scan?.candidates[0]?.candidate_id
    await unlink(source)
    const missing = await scanAt(item, '2026-09-04T10:00:22.000Z')
    expect(missing.scan?.candidates.find((candidate) => candidate.candidate_id === candidateId)).toMatchObject({
      availability: 'missing',
      classification: 'attention',
      safe_codes: ['source_missing_or_changed'],
    })
    const forgotten = await scanAt(item, '2026-09-04T10:00:33.000Z')
    expect(forgotten.scan?.candidates.find((candidate) => candidate.candidate_id === candidateId)).toBeUndefined()
  })

  it('distinguishes an offline mount from a missing Inbox and never leaks paths in health', async () => {
    const item = await fixture()
    const missingInbox = join(item.root, 'NotCreated')
    const missingState = await scanDriveInbox({ inboxPath: missingInbox, driveRoot: item.root, runtimeRoot: item.runtime, now: () => new Date('2026-09-04T10:00:00.000Z') })
    expect(missingState.scan?.health).toMatchObject({ status: 'inbox_missing', drive_state: 'unavailable', safe_codes: ['inbox_folder_missing'] })

    const offlineRoot = join(item.root, 'Offline')
    const offlineState = await scanDriveInbox({ inboxPath: join(offlineRoot, 'Inbox'), driveRoot: offlineRoot, runtimeRoot: item.runtime, now: () => new Date('2026-09-04T10:01:00.000Z') })
    expect(offlineState.scan?.health).toMatchObject({ status: 'offline', drive_state: 'unavailable', safe_codes: ['drive_mount_offline'] })
    const serialized = JSON.stringify(sanitizedDriveDiscoverySummary(offlineState))
    expect(serialized).not.toContain(item.root)
    expect(serialized).not.toContain('NotCreated')
    expect(serialized).not.toContain('Offline')
  })

  it('preserves trusted history across a transient missing Inbox and resumes only for the same resolved folder', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'source.mp4'), 'video')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const candidate = stable.scan!.candidates[0]!
    const parked = join(item.root, 'Inbox-parked')
    await rename(item.inbox, parked)
    const missing = await scanAt(item, '2026-09-04T10:00:12.000Z')
    expect(missing.scan?.inbox_fingerprint).toBe(stable.scan?.inbox_fingerprint)
    expect(missing.scan?.known_content).toEqual(stable.scan?.known_content)
    expect(missing.scan?.candidates[0]).toMatchObject({ classification: 'attention', availability: 'missing' })
    await rename(parked, item.inbox)
    const recovered = await scanAt(item, '2026-09-04T10:00:22.000Z')
    expect(recovered.scan?.health.status).toBe('ready')
    expect(recovered.scan?.candidates.find((itemCandidate) => itemCandidate.availability === 'available')?.candidate_hash).toBe(candidate.candidate_hash)
  })

  it('fails closed when a different folder appears at the configured path after an outage', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'source.mp4'), 'video')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const parked = join(item.root, 'Original-Inbox')
    await rename(item.inbox, parked)
    await scanAt(item, '2026-09-04T10:00:12.000Z')
    await mkdir(item.inbox)
    await writeFile(join(item.inbox, 'source.mp4'), 'video')
    const replaced = await scanAt(item, '2026-09-04T10:00:22.000Z')
    expect(replaced.scan?.inbox_fingerprint).toBe(stable.scan?.inbox_fingerprint)
    expect(replaced.scan?.health).toMatchObject({ status: 'error', safe_codes: ['inbox_identity_changed_requires_rebind'] })
    expect(replaced.scan?.candidates.every((candidate) => candidate.classification === 'attention' && candidate.availability === 'missing')).toBe(true)
  })

  it('uses the synced identity marker across a same-path virtual-drive remount without discovering the marker as media', async () => {
    const item = await fixture()
    const initialized = await initializeDriveInbox({ inboxPath: item.inbox, driveRoot: item.root, archiveRoot: join(item.root, 'Archive') })
    await writeFile(join(item.inbox, 'source.mp4'), 'video')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    expect(stable.scan?.inbox_fingerprint).toBe(initialized.inbox_fingerprint)
    expect(stable.scan?.health.files_seen).toBe(1)

    const parked = join(item.root, 'Virtual-Drive-Offline')
    await rename(item.inbox, parked)
    await scanAt(item, '2026-09-04T10:00:12.000Z')
    await mkdir(item.inbox)
    await Promise.all([
      copyFile(join(parked, '.mindmake-inbox-id-v1.json'), join(item.inbox, '.mindmake-inbox-id-v1.json')),
      copyFile(join(parked, 'source.mp4'), join(item.inbox, 'source.mp4')),
    ])
    const remounted = await scanAt(item, '2026-09-04T10:00:22.000Z')
    expect(remounted.scan?.inbox_fingerprint).toBe(initialized.inbox_fingerprint)
    expect(remounted.scan?.health.status).toBe('ready')
    expect(remounted.scan?.health.safe_codes).not.toContain('inbox_identity_changed_requires_rebind')
    expect(remounted.scan?.health.files_seen).toBe(1)
  })

  it('refuses to scan a configured folder outside the dedicated Drive root', async () => {
    const item = await fixture()
    const outside = await mkdtemp(join(tmpdir(), 'mindmake-outside-inbox-'))
    created.push(outside)
    await writeFile(join(outside, 'never-scan.mp4'), 'private-unrelated-file')
    const state = await scanDriveInbox({ inboxPath: outside, driveRoot: item.root, runtimeRoot: item.runtime, now: () => new Date('2026-09-04T10:00:00.000Z') })
    expect(state.scan?.health).toMatchObject({ status: 'error', drive_state: 'unavailable', safe_codes: ['inbox_configuration_invalid'], files_seen: 0 })
    expect(state.scan?.files).toHaveLength(0)
  })

  it('fails closed on bounded scan limits and records schema-valid permission health', async () => {
    const item = await fixture()
    await Promise.all([writeFile(join(item.inbox, 'one.mp4'), 'one'), writeFile(join(item.inbox, 'two.mp4'), 'two')])
    const limited = await scanAt(item, '2026-09-04T10:00:00.000Z', { maxFiles: 1 })
    expect(limited.scan?.health).toMatchObject({ status: 'scan_limited', drive_state: 'unavailable', safe_codes: expect.arrayContaining(['scan_file_limit_reached']) })
    expect(() => DriveDiscoveryHealthV1Schema.parse({
      schema_version: 1,
      status: 'permission_denied',
      drive_state: 'unavailable',
      safe_codes: ['inbox_permission_denied'],
      files_seen: 0,
      partial_files: 0,
      stable_files: 0,
      unsupported_files: 0,
      duplicate_files: 0,
      ready_candidates: 0,
      attention_candidates: 0,
      reviewed_candidates: 0,
    })).not.toThrow()
  })

  it('records exact-hash human review without creating a production job', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'approved.mp4'), 'video')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const candidate = stable.scan!.candidates[0]!
    const confirmation = `codex-user-confirmation:intake:${candidate.candidate_hash}:Krish approved this intake recording`
    const reviewed = await reviewDriveIntakeCandidate({ candidate_id: candidate.candidate_id, candidate_hash: candidate.candidate_hash, decision: 'accepted', note: 'Use this recording for editorial review.', confirmation_ref: confirmation }, scanOptions(item, '2026-09-04T10:00:12.000Z'))
    expect(reviewed.reviews[candidate.candidate_id]).toMatchObject({ decision: 'accepted', reviewed_by: 'Krish', candidate_hash: candidate.candidate_hash })
    expect(sanitizedDriveDiscoverySummary(reviewed).counts.reviewed_candidates).toBe(1)
    const replay = await reviewDriveIntakeCandidate({ candidate_id: candidate.candidate_id, candidate_hash: candidate.candidate_hash, decision: 'accepted', note: 'Use this recording for editorial review.', confirmation_ref: confirmation }, scanOptions(item, '2026-09-04T10:00:13.000Z'))
    expect(replay.reviews[candidate.candidate_id]?.review_id).toBe(reviewed.reviews[candidate.candidate_id]?.review_id)
    const reviewEvents = (await readFile(join(item.runtime, 'discovery', 'events.jsonl'), 'utf8')).split('\n').filter((line) => line.includes('"type":"review_recorded"'))
    expect(reviewEvents).toHaveLength(1)
    expect((await driveIntakeCandidateDetail(candidate.candidate_id, item.runtime)).review?.decision).toBe('accepted')
    await expect(readFile(join(item.runtime, 'jobs', candidate.candidate_id, 'job.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('persists a fresh scan before a changed review so held media can later carry a portable acceptance proof', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'decision.mp4'), 'video')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const candidate = stable.scan!.candidates[0]!
    await reviewDriveIntakeCandidate({
      candidate_id: candidate.candidate_id,
      candidate_hash: candidate.candidate_hash,
      decision: 'held',
      note: 'Hold while checking the recording.',
      confirmation_ref: `codex-user-confirmation:intake:${candidate.candidate_hash}:hold this source`,
    }, scanOptions(item, '2026-09-04T10:00:12.000Z'))
    await reviewDriveIntakeCandidate({
      candidate_id: candidate.candidate_id,
      candidate_hash: candidate.candidate_hash,
      decision: 'accepted',
      note: 'The recording is now approved for editorial intake.',
      confirmation_ref: `codex-user-confirmation:intake:${candidate.candidate_hash}:accept after review`,
    }, scanOptions(item, '2026-09-04T10:00:13.000Z'))
    const bundle = await createDriveSourceBundleDraft({ candidate_id: candidate.candidate_id, candidate_hash: candidate.candidate_hash, rights: 'owned' }, scanOptions(item, '2026-09-04T10:00:14.000Z'))
    await expect(assertDriveSourceBundleProvenance(bundle, item.runtime)).resolves.toMatchObject({ candidate: { candidate_id: candidate.candidate_id }, review_event: { review: { decision: 'accepted' } } })
    const types = (await readFile(join(item.runtime, 'discovery', 'events.jsonl'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line).type)
    expect(types.slice(-2)).toEqual(['scan_completed', 'review_recorded'])
  })

  it('blocks stale acceptance after content changes even when byte size and mtime are restored', async () => {
    const item = await fixture()
    const source = join(item.inbox, 'replace.mp4')
    await writeFile(source, 'AAAA')
    const original = await stat(source)
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const candidate = stable.scan!.candidates[0]!
    await writeFile(source, 'BBBB')
    await utimes(source, original.atime, original.mtime)
    await expect(reviewDriveIntakeCandidate({
      candidate_id: candidate.candidate_id,
      candidate_hash: candidate.candidate_hash,
      decision: 'accepted',
      note: 'This must not accept stale content.',
      confirmation_ref: `codex-user-confirmation:intake:${candidate.candidate_hash}:attempt stale acceptance`,
    }, scanOptions(item, '2026-09-04T10:00:12.000Z'))).rejects.toThrow(/stale|does not exist|missing|changed/)
    const refreshed = await loadDriveDiscoveryState(item.runtime)
    const replacement = refreshed.scan?.candidates.find((itemCandidate) => itemCandidate.availability === 'available')
    expect(replacement?.candidate_hash).not.toBe(candidate.candidate_hash)
    expect(replacement?.components[0]?.content_hash).not.toBe(candidate.components[0]?.content_hash)
  })

  it('blocks acceptance when the latest fresh scan says the mount or Inbox is unavailable', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'candidate.mp4'), 'video')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const candidate = stable.scan!.candidates[0]!
    const missingRoot = join(item.root, 'offline-root')
    await expect(reviewDriveIntakeCandidate({
      candidate_id: candidate.candidate_id,
      candidate_hash: candidate.candidate_hash,
      decision: 'accepted',
      note: 'This must wait for a healthy mount.',
      confirmation_ref: `codex-user-confirmation:intake:${candidate.candidate_hash}:attempt while offline`,
    }, {
      ...scanOptions(item, '2026-09-04T10:00:12.000Z'),
      driveRoot: missingRoot,
      inboxPath: join(missingRoot, 'Inbox'),
    })).rejects.toThrow(/unavailable or incomplete/)
  })

  it('resets prior observations and review lineage when the configured Inbox identity changes', async () => {
    const first = await fixture()
    await writeFile(join(first.inbox, 'same.mp4'), 'same-video')
    await scanAt(first, '2026-09-04T10:00:00.000Z')
    const original = await scanAt(first, '2026-09-04T10:00:11.000Z')
    const secondRoot = await mkdtemp(join(tmpdir(), 'mindmake-drive-discovery-relocated-'))
    created.push(secondRoot)
    const secondInbox = join(secondRoot, 'Inbox')
    await mkdir(secondInbox)
    await writeFile(join(secondInbox, 'same.mp4'), 'same-video')
    const relocatedOptions = { ...scanOptions(first, '2026-09-04T10:00:12.000Z'), inboxPath: secondInbox, driveRoot: secondRoot, archiveRoot: join(secondRoot, 'Archive') }
    const firstRelocatedScan = await scanDriveInbox(relocatedOptions)
    expect(firstRelocatedScan.scan?.health).toMatchObject({ status: 'error', safe_codes: ['inbox_identity_changed_requires_rebind'] })
    expect(firstRelocatedScan.scan?.candidates).toMatchObject([{ classification: 'attention', availability: 'missing', safe_codes: ['inbox_identity_changed_requires_rebind'] }])
    const stillBlocked = await scanDriveInbox({ ...relocatedOptions, now: () => new Date('2026-09-04T10:00:23.000Z') })
    expect(stillBlocked.scan?.health.status).toBe('error')
    const proposal = await driveInboxRebindProposal(relocatedOptions)
    expect(proposal.previous_inbox_fingerprint).toBe(original.scan?.inbox_fingerprint)
    const rebound = await rebindDriveInbox({ confirmation_ref: `${proposal.confirmation_prefix}Krish confirmed the replacement mounted folder` }, { ...relocatedOptions, now: () => new Date('2026-09-04T10:00:24.000Z') })
    expect(rebound.state.scan?.files[0]?.status).toBe('partial')
    const relocated = await scanDriveInbox({ ...relocatedOptions, now: () => new Date('2026-09-04T10:00:35.000Z') })
    expect(relocated.scan?.inbox_fingerprint).not.toBe(original.scan?.inbox_fingerprint)
    expect(relocated.scan?.candidates[0]?.candidate_id).toBe(original.scan?.candidates[0]?.candidate_id)
    expect(relocated.scan?.candidates[0]?.candidate_hash).not.toBe(original.scan?.candidates[0]?.candidate_hash)
  })

  it('holds exact-stem candidates for ambiguous or still-changing associations', async () => {
    const item = await fixture()
    await Promise.all([
      writeFile(join(item.inbox, 'story.mp4'), 'video'),
      writeFile(join(item.inbox, 'story.srt'), 'caption-one'),
      writeFile(join(item.inbox, 'story.vtt'), 'caption-two'),
    ])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const ambiguous = await scanAt(item, '2026-09-04T10:00:11.000Z')
    expect(ambiguous.scan?.candidates[0]).toMatchObject({ classification: 'attention', safe_codes: expect.arrayContaining(['multiple_caption_sidecar_matches']) })

    await Promise.all([unlink(join(item.inbox, 'story.vtt')), writeFile(join(item.inbox, 'story.wav'), 'new-audio')])
    const pending = await scanAt(item, '2026-09-04T10:00:12.000Z')
    expect(pending.scan?.candidates.find((candidate) => candidate.availability === 'available')).toMatchObject({
      classification: 'attention',
      safe_codes: expect.arrayContaining(['matching_association_not_stable']),
    })
  })

  it('holds a sidecar that ambiguously associates with a DJI group and a standalone recording', async () => {
    const item = await fixture()
    await Promise.all([
      writeFile(join(item.inbox, 'DJI_story_part001.mp4'), 'part-one'),
      writeFile(join(item.inbox, 'DJI_story_part002.mp4'), 'part-two'),
      writeFile(join(item.inbox, 'DJI_story.mp4'), 'standalone'),
      writeFile(join(item.inbox, 'DJI_story.srt'), 'caption'),
    ])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const state = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const affected = state.scan?.candidates.filter((candidate) => candidate.safe_codes.includes('association_matches_multiple_candidates')) ?? []
    expect(affected).toHaveLength(2)
    expect(affected.every((candidate) => candidate.classification === 'attention')).toBe(true)
  })

  it('rebases dedupe identity when the only current copy moves to a new Inbox path', async () => {
    const item = await fixture()
    const originalPath = join(item.inbox, 'old.mp4')
    const newPath = join(item.inbox, 'new.mp4')
    await writeFile(originalPath, 'same-content')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    await rename(originalPath, newPath)
    await scanAt(item, '2026-09-04T10:00:12.000Z')
    const moved = await scanAt(item, '2026-09-04T10:00:23.000Z')
    expect(moved.scan?.files.find((file) => file.display_name === 'new.mp4')).toMatchObject({ status: 'stable' })
    expect(moved.scan?.health.safe_codes).toContain('content_location_rebased')
    expect(moved.scan?.candidates.find((candidate) => candidate.availability === 'available')?.candidate_id).toBe(stable.scan?.candidates[0]?.candidate_id)
  })

  it('rejects overlapping Inbox and Archive configuration without scanning media', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'untouched.mp4'), 'video')
    const state = await scanAt(item, '2026-09-04T10:00:00.000Z', { archiveRoot: item.inbox })
    expect(state.scan?.health).toMatchObject({ status: 'error', safe_codes: ['inbox_archive_overlap'], files_seen: 0 })
  })

  it('recovers only an incomplete final event line and ignores stale materialized cache', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'source.mp4'), 'video')
    const first = await scanAt(item, '2026-09-04T10:00:00.000Z')
    const eventPath = join(item.runtime, 'discovery', 'events.jsonl')
    await appendFile(eventPath, '{"schema_version":1')
    const recovered = await scanAt(item, '2026-09-04T10:00:11.000Z')
    expect(recovered.scan?.scan_sequence).toBe(2)
    await writeFile(join(item.runtime, 'discovery', 'state.json'), '{"not":"authoritative"}\n')
    expect((await loadDriveDiscoveryState(item.runtime)).latest_event_hash).toBe(recovered.latest_event_hash)
    expect(first.latest_event_hash).not.toBe(recovered.latest_event_hash)
  })

  it('preserves a valid final event missing only its newline before appending another scan', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'source.mp4'), 'video')
    const first = await scanAt(item, '2026-09-04T10:00:00.000Z')
    const eventPath = join(item.runtime, 'discovery', 'events.jsonl')
    const completeBody = await readFile(eventPath, 'utf8')
    expect(completeBody.endsWith('\n')).toBe(true)
    await writeFile(eventPath, completeBody.slice(0, -1), 'utf8')

    const second = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const recoveredLines = (await readFile(eventPath, 'utf8')).trim().split(/\r?\n/)
    expect(recoveredLines).toHaveLength(2)
    expect(JSON.parse(recoveredLines[0]!).previous_event_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.parse(recoveredLines[1]!).previous_event_hash).toBe(first.latest_event_hash)
    expect(second.scan?.scan_sequence).toBe(2)
  })

  it('reclaims a discovery lock owned by a process instance that no longer exists', async () => {
    const item = await fixture()
    const discoveryRoot = join(item.runtime, 'discovery')
    await mkdir(discoveryRoot, { recursive: true })
    const lockPath = join(discoveryRoot, 'discovery.lock')
    await writeFile(lockPath, `${JSON.stringify({ schema_version: 1, pid: 2_000_000_000, process_instance_id: 'missing:instance', token: 'stale', acquired_at: '2026-09-04T09:00:00.000Z' })}\n`)
    const old = new Date(Date.now() - 10_000)
    await utimes(lockPath, old, old)
    const state = await scanAt(item, '2026-09-04T10:00:00.000Z')
    expect(state.scan?.health.status).toBe('ready')
    await expect(stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('coalesces unchanged production scans and bounds directory entries', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'source.mp4'), 'video')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    await scanAt(item, '2026-09-04T10:00:11.000Z')
    const eventPath = join(item.runtime, 'discovery', 'events.jsonl')
    const before = (await readFile(eventPath, 'utf8')).trim().split('\n').length
    await scanAt(item, '2026-09-04T10:00:22.000Z', { recordUnchanged: false })
    const after = (await readFile(eventPath, 'utf8')).trim().split('\n').length
    expect(after).toBe(before)

    const bounded = await fixture()
    await Promise.all([mkdir(join(bounded.inbox, 'one')), mkdir(join(bounded.inbox, 'two'))])
    const limited = await scanAt(bounded, '2026-09-04T10:00:00.000Z', { maxEntries: 1 })
    expect(limited.scan?.health).toMatchObject({ status: 'scan_limited', safe_codes: expect.arrayContaining(['scan_entry_limit_reached']) })
  })

  it('normalizes unusual extensions without letting a file name abort discovery', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'notes.extension-is-far-too-long'), 'unsupported')
    const state = await scanAt(item, '2026-09-04T10:00:00.000Z')
    expect(state.scan?.files[0]).toMatchObject({ extension: '.other', kind: 'unsupported', status: 'unsupported' })
  })

  it('ignores only the exact case-insensitive Windows desktop marker while surfacing other unsupported files', async () => {
    const item = await fixture()
    await Promise.all([
      writeFile(join(item.inbox, 'DeSkToP.InI'), '[.ShellClassInfo]'),
      writeFile(join(item.inbox, 'desktop.ini.backup'), 'unsupported'),
    ])
    const state = await scanAt(item, '2026-09-04T10:00:00.000Z')
    expect(state.scan?.files.map((file) => file.display_name)).toEqual(['desktop.ini.backup'])
    expect(state.scan?.health).toMatchObject({
      files_seen: 1,
      unsupported_files: 1,
      safe_codes: expect.arrayContaining(['unsupported_files_present']),
    })
  })

  it('drafts a provenance-bound SourceBundle only after current exact-hash acceptance', async () => {
    const item = await fixture()
    await Promise.all([
      writeFile(join(item.inbox, 'approved.mp4'), 'video'),
      writeFile(join(item.inbox, 'approved.wav'), 'audio'),
      writeFile(join(item.inbox, 'unrelated-private.mp4'), 'another-video'),
    ])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const candidate = stable.scan!.candidates.find((itemCandidate) => itemCandidate.display_name === 'approved.mp4')!
    await expect(createDriveSourceBundleDraft({ candidate_id: candidate.candidate_id, candidate_hash: candidate.candidate_hash, rights: 'owned' }, scanOptions(item, '2026-09-04T10:00:12.000Z'))).rejects.toThrow(/acceptance/)
    const confirmation = `codex-user-confirmation:intake:${candidate.candidate_hash}:Krish approved this exact source`
    const reviewed = await reviewDriveIntakeCandidate({ candidate_id: candidate.candidate_id, candidate_hash: candidate.candidate_hash, decision: 'accepted', note: 'Use these owned sources.', confirmation_ref: confirmation }, scanOptions(item, '2026-09-04T10:00:12.000Z'))
    const bundle = await createDriveSourceBundleDraft({ candidate_id: candidate.candidate_id, candidate_hash: candidate.candidate_hash, rights: 'owned' }, scanOptions(item, '2026-09-04T10:00:13.000Z'))
    const proof = await assertDriveSourceBundleProvenance(bundle, item.runtime)
    expect(proof).toMatchObject({ schema_version: 1, candidate: { candidate_id: candidate.candidate_id }, scan_attestation: { health_status: 'ready' }, review_event: { type: 'review_recorded' } })
    const tamperedProof = structuredClone(proof!)
    if (tamperedProof.review_event.type !== 'review_recorded') throw new Error('expected a review event fixture')
    tamperedProof.review_event.previous_event_hash = '0'.repeat(64)
    const { event_hash: _eventHash, ...tamperedReviewBody } = tamperedProof.review_event
    tamperedProof.review_event.event_hash = hashValue(driveDiscoveryEventHashInputV1(tamperedReviewBody))
    expect(() => assertPortableDriveIntakeProof(bundle, tamperedProof)).toThrow(/immediately follow its exact attested scan/)
    expect(JSON.stringify(proof)).not.toContain('unrelated-private.mp4')
    await expect(assertDriveSourceBundleProvenance({ ...bundle, intake_provenance: { ...bundle.intake_provenance!, review_hash: 'f'.repeat(64) } }, item.runtime)).rejects.toThrow(/authoritative discovery ledger/)
    const priorRuntime = process.env.MINDMAKE_RUNTIME_ROOT
    const configPath = join(item.root, 'studio.json')
    const skillPath = join(item.root, 'mindmake-video', 'SKILL.md')
    await mkdir(join(item.root, 'mindmake-video'))
    await Promise.all([writeFile(configPath, '{"schema_version":1}\n'), writeFile(skillPath, 'portable intake proof fixture')])
    process.env.MINDMAKE_RUNTIME_ROOT = item.runtime
    const job = await createJobV2({ series: 'built_with_ai', mode: 'solo', sourceBundle: bundle, configPath, skillPaths: [skillPath] })
    const persistedProofPath = join(item.runtime, 'jobs', job.job_id, 'intake-proofs', `${hashValue(proof)}.json`)
    expect(await readFile(persistedProofPath, 'utf8')).not.toContain('unrelated-private.mp4')
    const legacyProofPath = join(item.runtime, 'jobs', job.job_id, 'intake-proof.json')
    await rename(persistedProofPath, legacyProofPath)
    await expect(loadJobV2(job.job_id)).resolves.toMatchObject({ source_bundle: { bundle_id: bundle.bundle_id } })
    await reviewDriveIntakeCandidate({
      candidate_id: candidate.candidate_id,
      candidate_hash: candidate.candidate_hash,
      decision: 'rejected',
      note: 'Krish revoked this intake selection before job creation.',
      confirmation_ref: `codex-user-confirmation:intake:${candidate.candidate_hash}:reject the previously accepted source`,
    }, scanOptions(item, '2026-09-04T10:00:14.000Z'))
    await expect(assertDriveSourceBundleProvenance(bundle, item.runtime)).rejects.toThrow(/latest accepted review/)
    try {
      await expect(createJobV2({ series: 'built_with_ai', mode: 'solo', sourceBundle: bundle, configPath, skillPaths: [skillPath] })).rejects.toThrow(/latest accepted review/)
      await rm(join(item.runtime, 'discovery'), { recursive: true, force: true })
      await expect(loadJobV2(job.job_id)).resolves.toMatchObject({ job_id: job.job_id, source_bundle: { bundle_id: bundle.bundle_id } })
    } finally {
      if (priorRuntime === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = priorRuntime
    }
    expect(bundle).toMatchObject({
      primary_source_id: 'camera-main',
      sources: [{ content_hash: expect.any(String) }, { content_hash: expect.any(String) }],
      intake_provenance: {
        candidate_hash: candidate.candidate_hash,
        review_id: reviewed.reviews[candidate.candidate_id]?.review_id,
        media_hashes: expect.arrayContaining(candidate.components.filter((component) => ['video', 'audio'].includes(component.kind)).map((component) => component.content_hash)),
      },
    })
  })

  it('keeps re-recording proofs immutable and makes the latest source event the explicit current pointer', async () => {
    const item = await fixture()
    await Promise.all([
      writeFile(join(item.inbox, 'first.mp4'), 'first-video'),
      writeFile(join(item.inbox, 'second.mp4'), 'second-video'),
    ])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const firstCandidate = stable.scan!.candidates.find((candidate) => candidate.display_name === 'first.mp4')!
    const secondCandidate = stable.scan!.candidates.find((candidate) => candidate.display_name === 'second.mp4')!
    await reviewDriveIntakeCandidate({
      candidate_id: firstCandidate.candidate_id,
      candidate_hash: firstCandidate.candidate_hash,
      decision: 'accepted',
      note: 'Use the first recording.',
      confirmation_ref: `codex-user-confirmation:intake:${firstCandidate.candidate_hash}:accept the first recording`,
    }, scanOptions(item, '2026-09-04T10:00:12.000Z'))
    const firstBundle = await createDriveSourceBundleDraft({ candidate_id: firstCandidate.candidate_id, candidate_hash: firstCandidate.candidate_hash, rights: 'owned' }, scanOptions(item, '2026-09-04T10:00:13.000Z'))
    const firstProof = await assertDriveSourceBundleProvenance(firstBundle, item.runtime)
    await reviewDriveIntakeCandidate({
      candidate_id: secondCandidate.candidate_id,
      candidate_hash: secondCandidate.candidate_hash,
      decision: 'accepted',
      note: 'Use the second recording.',
      confirmation_ref: `codex-user-confirmation:intake:${secondCandidate.candidate_hash}:accept the second recording`,
    }, scanOptions(item, '2026-09-04T10:00:14.000Z'))
    const secondBundle = await createDriveSourceBundleDraft({ candidate_id: secondCandidate.candidate_id, candidate_hash: secondCandidate.candidate_hash, rights: 'owned' }, scanOptions(item, '2026-09-04T10:00:15.000Z'))
    const secondProof = await assertDriveSourceBundleProvenance(secondBundle, item.runtime)
    const configPath = join(item.root, 'studio.json')
    const skillPath = join(item.root, 'mindmake-video', 'SKILL.md')
    await mkdir(join(item.root, 'mindmake-video'))
    await Promise.all([writeFile(configPath, '{"schema_version":1}\n'), writeFile(skillPath, 'immutable proof fixture')])
    const priorRuntime = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = item.runtime
    try {
      const job = await createJobV2({ series: 'built_with_ai', mode: 'short_native', sourceBundle: firstBundle, discoveryRuntimeRoot: item.runtime, configPath, skillPaths: [skillPath] })
      const proofRoot = join(item.runtime, 'jobs', job.job_id, 'intake-proofs')
      const firstProofPath = join(proofRoot, `${hashValue(firstProof)}.json`)
      const legacyProofPath = join(item.runtime, 'jobs', job.job_id, 'intake-proof.json')
      await rename(firstProofPath, legacyProofPath)
      await attachSourceBundleV2(job.job_id, secondBundle, item.runtime)
      await expect(readFile(legacyProofPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(readFile(firstProofPath, 'utf8')).resolves.toContain(firstCandidate.candidate_id)
      await expect(readFile(join(proofRoot, `${hashValue(secondProof)}.json`), 'utf8')).resolves.toContain(secondCandidate.candidate_id)
      const afterSecond = (await readFile(join(item.runtime, 'jobs', job.job_id, 'events.jsonl'), 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line))
      expect(afterSecond.at(-1)?.payload.intake_proof_hash).toBe(hashValue(secondProof))
      await expect(loadJobV2(job.job_id)).resolves.toMatchObject({ source_bundle: { bundle_id: secondBundle.bundle_id } })

      const localBundle = {
        schema_version: 1 as const,
        bundle_id: 'manual-rerecording',
        primary_source_id: 'camera-main',
        sources: [{ source_id: 'camera-main', kind: 'video' as const, role: 'primary_camera' as const, ref: 'manual-rerecording.mp4', rights: 'owned' as const, sync: { strategy: 'already_mixed' as const, offset_ms: 0 }, include_in_edit: true }],
      }
      await attachSourceBundleV2(job.job_id, localBundle, item.runtime)
      const afterManual = (await readFile(join(item.runtime, 'jobs', job.job_id, 'events.jsonl'), 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line))
      expect(afterManual.at(-1)?.payload.intake_proof_hash).toBeNull()
      await expect(loadJobV2(job.job_id)).resolves.toMatchObject({ source_bundle: { bundle_id: localBundle.bundle_id } })
      await expect(readFile(legacyProofPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(readFile(firstProofPath, 'utf8')).resolves.toContain(firstCandidate.candidate_id)
      await expect(readFile(join(proofRoot, `${hashValue(secondProof)}.json`), 'utf8')).resolves.toContain(secondCandidate.candidate_id)
    } finally {
      if (priorRuntime === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = priorRuntime
    }
  })

  it('preserves accepted sidecars as typed, hash-bound SourceBundle inputs', async () => {
    const item = await fixture()
    await Promise.all([writeFile(join(item.inbox, 'captioned.mp4'), 'video'), writeFile(join(item.inbox, 'captioned.srt'), 'caption')])
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const stable = await scanAt(item, '2026-09-04T10:00:11.000Z')
    const candidate = stable.scan!.candidates[0]!
    await reviewDriveIntakeCandidate({
      candidate_id: candidate.candidate_id,
      candidate_hash: candidate.candidate_hash,
      decision: 'accepted',
      note: 'Use the owned recording and supplied captions.',
      confirmation_ref: `codex-user-confirmation:intake:${candidate.candidate_hash}:accept the captioned source`,
    }, scanOptions(item, '2026-09-04T10:00:12.000Z'))
    const bundle = await createDriveSourceBundleDraft({ candidate_id: candidate.candidate_id, candidate_hash: candidate.candidate_hash, rights: 'owned' }, scanOptions(item, '2026-09-04T10:00:13.000Z'))
    expect(bundle.sidecars).toMatchObject([{
      source_id: 'camera-main',
      kind: 'captions',
      format: 'srt',
      content_hash: candidate.components.find((component) => component.kind === 'caption_sidecar')?.content_hash,
    }])
    expect(bundle.intake_provenance?.sidecar_hashes).toEqual(bundle.sidecars?.map((sidecar) => sidecar.content_hash))
  })

  it('detects event-ledger tampering instead of trusting materialized state', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'source.mp4'), 'video')
    await scanAt(item, '2026-09-04T10:00:00.000Z')
    const eventPath = join(item.runtime, 'discovery', 'events.jsonl')
    const body = await readFile(eventPath, 'utf8')
    await writeFile(eventPath, body.replace('awaiting_stability', 'stable_but_tampered'))
    await expect(loadDriveDiscoveryState(item.runtime)).rejects.toThrow(/event hash|invalid JSON or schema/)
  })

  it('keeps the materialized state contract strict and content-addressed', async () => {
    const item = await fixture()
    await writeFile(join(item.inbox, 'source.mp4'), 'video')
    const state = await scanAt(item, '2026-09-04T10:00:00.000Z')
    expect(() => DriveDiscoveryStateV1Schema.parse(state)).not.toThrow()
    const disk = JSON.parse(await readFile(join(item.runtime, 'discovery', 'state.json'), 'utf8'))
    expect(disk.state_hash).toBe(state.state_hash)
  })
})
