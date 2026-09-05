import { z } from 'zod'

export const DRIVE_DISCOVERY_SCHEMA_VERSION_V1 = 1 as const
export const DriveDiscoverySha256V1Schema = z.string().regex(/^[a-f0-9]{64}$/)

const RelativeInboxPathV1Schema = z.string().trim().min(1).max(1024).superRefine((value, context) => {
  if (value.includes('\\') || value.startsWith('/') || /^[a-z]:/i.test(value)) {
    context.addIssue({ code: 'custom', message: 'inbox paths must be relative and use forward slashes' })
  }
  if (value.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    context.addIssue({ code: 'custom', message: 'inbox paths cannot contain empty, current, or parent segments' })
  }
})

export const DriveDiscoveryHealthStatusV1Schema = z.enum([
  'ready',
  'not_configured',
  'offline',
  'inbox_missing',
  'permission_denied',
  'scan_limited',
  'error',
])
export type DriveDiscoveryHealthStatusV1 = z.infer<typeof DriveDiscoveryHealthStatusV1Schema>

export const DriveDiscoveryFileStatusV1Schema = z.enum([
  'partial',
  'stable',
  'unsupported',
  'permission_denied',
  'duplicate',
])
export type DriveDiscoveryFileStatusV1 = z.infer<typeof DriveDiscoveryFileStatusV1Schema>

export const DriveDiscoveryFileV1Schema = z.object({
  schema_version: z.literal(DRIVE_DISCOVERY_SCHEMA_VERSION_V1),
  file_id: z.string().regex(/^file_[a-f0-9]{24}$/),
  path_key: DriveDiscoverySha256V1Schema,
  relative_path: RelativeInboxPathV1Schema,
  display_name: z.string().trim().min(1).max(260),
  extension: z.string().regex(/^\.[a-z0-9]{1,12}$/),
  kind: z.enum(['video', 'audio', 'caption_sidecar', 'edit_sidecar', 'unsupported']),
  byte_size: z.number().int().nonnegative(),
  modified_ms: z.number().int().nonnegative(),
  first_seen_at: z.string().datetime(),
  last_seen_at: z.string().datetime(),
  unchanged_since_at: z.string().datetime(),
  consecutive_unchanged_scans: z.number().int().min(1).max(1_000_000),
  status: DriveDiscoveryFileStatusV1Schema,
  safe_code: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
  filesystem_identity_hash: DriveDiscoverySha256V1Schema,
  content_hash: DriveDiscoverySha256V1Schema.optional(),
  content_verified_at: z.string().datetime().optional(),
  duplicate_of_file_id: z.string().regex(/^file_[a-f0-9]{24}$/).optional(),
}).strict().superRefine((value, context) => {
  if (['stable', 'duplicate'].includes(value.status) && (!value.content_hash || !value.content_verified_at)) {
    context.addIssue({ code: 'custom', path: ['content_hash'], message: 'stable and duplicate files require a verified content hash' })
  }
  if (value.status === 'duplicate' && !value.duplicate_of_file_id) {
    context.addIssue({ code: 'custom', path: ['duplicate_of_file_id'], message: 'duplicate files require their first-seen file identity' })
  }
  if (value.status !== 'duplicate' && value.duplicate_of_file_id) {
    context.addIssue({ code: 'custom', path: ['duplicate_of_file_id'], message: 'only duplicate files may name a first-seen identity' })
  }
  if (value.kind === 'unsupported' && value.status !== 'unsupported') {
    context.addIssue({ code: 'custom', path: ['status'], message: 'unsupported kinds must remain unsupported' })
  }
})
export type DriveDiscoveryFileV1 = z.infer<typeof DriveDiscoveryFileV1Schema>

export const DriveIntakeComponentV1Schema = z.object({
  file_id: z.string().regex(/^file_[a-f0-9]{24}$/),
  relative_path: RelativeInboxPathV1Schema,
  kind: z.enum(['video', 'audio', 'caption_sidecar', 'edit_sidecar']),
  role: z.enum(['primary_video', 'sequence_video', 'isolated_audio', 'caption_sidecar', 'edit_sidecar']),
  ordinal: z.number().int().nonnegative().max(31),
  content_hash: DriveDiscoverySha256V1Schema,
}).strict()
export type DriveIntakeComponentV1 = z.infer<typeof DriveIntakeComponentV1Schema>

export const DriveIntakeCandidateV1Schema = z.object({
  schema_version: z.literal(DRIVE_DISCOVERY_SCHEMA_VERSION_V1),
  candidate_id: z.string().regex(/^intake_[a-f0-9]{24}$/),
  candidate_fingerprint: DriveDiscoverySha256V1Schema,
  candidate_hash: DriveDiscoverySha256V1Schema,
  inbox_fingerprint: DriveDiscoverySha256V1Schema,
  display_name: z.string().trim().min(1).max(260),
  classification: z.enum(['ready_for_review', 'attention', 'duplicate']),
  availability: z.enum(['available', 'missing']),
  sequence_kind: z.enum(['standalone', 'dji_explicit_split']),
  total_media_files: z.number().int().positive(),
  total_sidecar_files: z.number().int().nonnegative(),
  omitted_component_count: z.number().int().nonnegative(),
  media_file_ids: z.array(z.string().regex(/^file_[a-f0-9]{24}$/)).min(1).max(32),
  sidecar_file_ids: z.array(z.string().regex(/^file_[a-f0-9]{24}$/)).max(32),
  components: z.array(DriveIntakeComponentV1Schema).min(1).max(64),
  safe_codes: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,79}$/)).max(32),
}).strict().superRefine((value, context) => {
  const allIds = [...value.media_file_ids, ...value.sidecar_file_ids]
  if (new Set(allIds).size !== allIds.length) {
    context.addIssue({ code: 'custom', path: ['media_file_ids'], message: 'candidate files must be unique' })
  }
  const componentIds = value.components.map((component) => component.file_id)
  if (new Set(componentIds).size !== componentIds.length || new Set(componentIds).size !== allIds.length || allIds.some((id) => !componentIds.includes(id))) {
    context.addIssue({ code: 'custom', path: ['components'], message: 'candidate components must exactly resolve every declared file ID once' })
  }
  if (value.total_media_files + value.total_sidecar_files - allIds.length !== value.omitted_component_count) {
    context.addIssue({ code: 'custom', path: ['omitted_component_count'], message: 'candidate omitted component count does not match its bounded manifest' })
  }
  if (value.classification === 'ready_for_review' && (value.availability !== 'available' || value.safe_codes.length || value.omitted_component_count !== 0)) {
    context.addIssue({ code: 'custom', path: ['classification'], message: 'ready candidates must be available and free of attention codes' })
  }
  if (value.classification !== 'ready_for_review' && !value.safe_codes.length) {
    context.addIssue({ code: 'custom', path: ['safe_codes'], message: 'non-ready candidates require at least one safe code' })
  }
})
export type DriveIntakeCandidateV1 = z.infer<typeof DriveIntakeCandidateV1Schema>

export const DriveIntakeReviewV1Schema = z.object({
  schema_version: z.literal(DRIVE_DISCOVERY_SCHEMA_VERSION_V1),
  review_id: z.string().uuid(),
  candidate_id: z.string().regex(/^intake_[a-f0-9]{24}$/),
  candidate_hash: DriveDiscoverySha256V1Schema,
  inbox_fingerprint: DriveDiscoverySha256V1Schema,
  scan_sequence: z.number().int().positive(),
  discovery_event_hash: DriveDiscoverySha256V1Schema,
  verification_hash: DriveDiscoverySha256V1Schema,
  decision: z.enum(['accepted', 'rejected', 'held']),
  note: z.string().trim().min(1).max(1600),
  reviewed_by: z.literal('Krish'),
  confirmation_ref: z.string().trim().min(20).max(1000),
  reviewed_at: z.string().datetime(),
}).strict().superRefine((value, context) => {
  const prefixes = [
    `codex-user-confirmation:intake:${value.candidate_hash}:`,
    `control-center-confirmation:intake:${value.candidate_hash}:`,
  ]
  if (!prefixes.some((prefix) => value.confirmation_ref.startsWith(prefix) && value.confirmation_ref.slice(prefix.length).trim())) {
    context.addIssue({ code: 'custom', path: ['confirmation_ref'], message: 'intake review must bind the exact current candidate hash' })
  }
})
export type DriveIntakeReviewV1 = z.infer<typeof DriveIntakeReviewV1Schema>

export const DriveDiscoveryHealthV1Schema = z.object({
  schema_version: z.literal(DRIVE_DISCOVERY_SCHEMA_VERSION_V1),
  status: DriveDiscoveryHealthStatusV1Schema,
  drive_state: z.enum(['ready', 'unavailable', 'not_configured']),
  safe_codes: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,79}$/)).max(32),
  files_seen: z.number().int().nonnegative(),
  partial_files: z.number().int().nonnegative(),
  stable_files: z.number().int().nonnegative(),
  unsupported_files: z.number().int().nonnegative(),
  duplicate_files: z.number().int().nonnegative(),
  ready_candidates: z.number().int().nonnegative(),
  attention_candidates: z.number().int().nonnegative(),
  reviewed_candidates: z.number().int().nonnegative(),
}).strict().superRefine((value, context) => {
  if ((value.status === 'ready') !== (value.drive_state === 'ready')) {
    context.addIssue({ code: 'custom', path: ['drive_state'], message: 'only a ready scan may report the Drive as ready' })
  }
  if (value.status === 'not_configured' && value.drive_state !== 'not_configured') {
    context.addIssue({ code: 'custom', path: ['drive_state'], message: 'unconfigured discovery must report an unconfigured Drive' })
  }
  if (value.status !== 'ready' && value.status !== 'not_configured' && value.drive_state !== 'unavailable') {
    context.addIssue({ code: 'custom', path: ['drive_state'], message: 'degraded discovery must report the Drive as unavailable' })
  }
})
export type DriveDiscoveryHealthV1 = z.infer<typeof DriveDiscoveryHealthV1Schema>

export const DriveDiscoveryKnownContentV1Schema = z.object({
  first_file_id: z.string().regex(/^file_[a-f0-9]{24}$/),
  first_path_key: DriveDiscoverySha256V1Schema,
  first_seen_at: z.string().datetime(),
  last_seen_at: z.string().datetime(),
}).strict()
export type DriveDiscoveryKnownContentV1 = z.infer<typeof DriveDiscoveryKnownContentV1Schema>

export const DriveDiscoveryScanSnapshotV1Schema = z.object({
  schema_version: z.literal(DRIVE_DISCOVERY_SCHEMA_VERSION_V1),
  scan_sequence: z.number().int().positive(),
  scanned_at: z.string().datetime(),
  inbox_fingerprint: DriveDiscoverySha256V1Schema,
  settings: z.object({
    stability_seconds: z.number().int().min(0).max(86_400),
    maximum_files: z.number().int().min(1).max(5_000),
    maximum_entries: z.number().int().min(1).max(20_000),
    maximum_depth: z.number().int().min(0).max(12),
    maximum_hash_bytes_per_scan: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    maximum_sidecar_bytes: z.number().int().positive().max(1_073_741_824),
    history_retention_days: z.number().int().min(1).max(3_650),
    content_reverification_seconds: z.number().int().min(60).max(604_800),
    algorithm_version: z.literal('drive-discovery-v1.2.0'),
    software_commit: z.string().regex(/^(?:[a-f0-9]{40}|unknown)$/),
    configuration_hash: DriveDiscoverySha256V1Schema,
  }).strict(),
  health: DriveDiscoveryHealthV1Schema,
  files: z.array(DriveDiscoveryFileV1Schema).max(5_000),
  candidates: z.array(DriveIntakeCandidateV1Schema).max(5_000),
  known_content: z.record(DriveDiscoverySha256V1Schema, DriveDiscoveryKnownContentV1Schema),
}).strict().superRefine((value, context) => {
  const fileIds = value.files.map((file) => file.file_id)
  const pathKeys = value.files.map((file) => file.path_key)
  const candidateIds = value.candidates.map((candidate) => candidate.candidate_id)
  if (new Set(fileIds).size !== fileIds.length) context.addIssue({ code: 'custom', path: ['files'], message: 'scan file IDs must be unique' })
  if (new Set(pathKeys).size !== pathKeys.length) context.addIssue({ code: 'custom', path: ['files'], message: 'scan path keys must be unique' })
  if (new Set(candidateIds).size !== candidateIds.length) context.addIssue({ code: 'custom', path: ['candidates'], message: 'scan candidate IDs must be unique' })
  for (const [index, candidate] of value.candidates.entries()) {
    if (candidate.inbox_fingerprint !== value.inbox_fingerprint) context.addIssue({ code: 'custom', path: ['candidates', index, 'inbox_fingerprint'], message: 'candidate belongs to a different Inbox' })
    if (candidate.availability === 'available') {
      for (const id of [...candidate.media_file_ids, ...candidate.sidecar_file_ids]) {
        if (!fileIds.includes(id)) context.addIssue({ code: 'custom', path: ['candidates', index], message: 'available candidate references a missing scan file' })
      }
    }
  }
})
export type DriveDiscoveryScanSnapshotV1 = z.infer<typeof DriveDiscoveryScanSnapshotV1Schema>

export const DriveInboxRebindV1Schema = z.object({
  schema_version: z.literal(DRIVE_DISCOVERY_SCHEMA_VERSION_V1),
  previous_inbox_fingerprint: DriveDiscoverySha256V1Schema,
  next_inbox_fingerprint: DriveDiscoverySha256V1Schema,
  confirmed_by: z.literal('Krish'),
  confirmation_ref: z.string().trim().min(20).max(1000),
  rebound_at: z.string().datetime(),
}).strict().superRefine((value, context) => {
  if (value.previous_inbox_fingerprint === value.next_inbox_fingerprint) {
    context.addIssue({ code: 'custom', path: ['next_inbox_fingerprint'], message: 'Inbox rebind requires a different resolved identity' })
  }
  const prefix = `codex-user-confirmation:inbox-rebind:${value.previous_inbox_fingerprint}:${value.next_inbox_fingerprint}:`
  if (!value.confirmation_ref.startsWith(prefix) || !value.confirmation_ref.slice(prefix.length).trim()) {
    context.addIssue({ code: 'custom', path: ['confirmation_ref'], message: 'Inbox rebind confirmation must bind both resolved identities' })
  }
})
export type DriveInboxRebindV1 = z.infer<typeof DriveInboxRebindV1Schema>

const DriveDiscoveryEventBodyV1Schema = z.object({
  schema_version: z.literal(DRIVE_DISCOVERY_SCHEMA_VERSION_V1),
  event_id: z.string().uuid(),
  occurred_at: z.string().datetime(),
  previous_event_hash: DriveDiscoverySha256V1Schema,
}).strict()

export const DriveDiscoveryEventV1Schema = z.discriminatedUnion('type', [
  DriveDiscoveryEventBodyV1Schema.extend({ type: z.literal('scan_completed'), scan: DriveDiscoveryScanSnapshotV1Schema, event_hash: DriveDiscoverySha256V1Schema }).strict(),
  DriveDiscoveryEventBodyV1Schema.extend({ type: z.literal('review_recorded'), review: DriveIntakeReviewV1Schema, event_hash: DriveDiscoverySha256V1Schema }).strict(),
  DriveDiscoveryEventBodyV1Schema.extend({ type: z.literal('inbox_rebound'), rebind: DriveInboxRebindV1Schema, event_hash: DriveDiscoverySha256V1Schema }).strict(),
])
export type DriveDiscoveryEventV1 = z.infer<typeof DriveDiscoveryEventV1Schema>

export const DriveIntakeProofV1Schema = z.object({
  schema_version: z.literal(DRIVE_DISCOVERY_SCHEMA_VERSION_V1),
  candidate: DriveIntakeCandidateV1Schema,
  component_files: z.array(DriveDiscoveryFileV1Schema).min(1).max(64),
  scan_attestation: z.object({
    discovery_event_hash: DriveDiscoverySha256V1Schema,
    scan_sequence: z.number().int().positive(),
    scanned_at: z.string().datetime(),
    inbox_fingerprint: DriveDiscoverySha256V1Schema,
    health_status: z.literal('ready'),
    health_hash: DriveDiscoverySha256V1Schema,
    configuration_hash: DriveDiscoverySha256V1Schema,
    software_commit: z.string().regex(/^(?:[a-f0-9]{40}|unknown)$/),
  }).strict(),
  review_event: DriveDiscoveryEventV1Schema,
  captured_at: z.string().datetime(),
}).strict().superRefine((value, context) => {
  if (value.review_event.type !== 'review_recorded') context.addIssue({ code: 'custom', path: ['review_event'], message: 'intake proof review event must be a recorded review' })
  if (value.review_event.previous_event_hash !== value.scan_attestation.discovery_event_hash) context.addIssue({ code: 'custom', path: ['review_event', 'previous_event_hash'], message: 'intake proof review must immediately follow its exact attested scan' })
  const componentIds = value.candidate.components.map((component) => component.file_id).sort()
  const fileIds = value.component_files.map((file) => file.file_id).sort()
  if (new Set(fileIds).size !== fileIds.length || JSON.stringify(componentIds) !== JSON.stringify(fileIds)) {
    context.addIssue({ code: 'custom', path: ['component_files'], message: 'intake proof files must resolve exactly the accepted candidate components' })
  }
})
export type DriveIntakeProofV1 = z.infer<typeof DriveIntakeProofV1Schema>

export const DriveDiscoveryStateV1Schema = z.object({
  schema_version: z.literal(DRIVE_DISCOVERY_SCHEMA_VERSION_V1),
  latest_event_hash: DriveDiscoverySha256V1Schema,
  state_hash: DriveDiscoverySha256V1Schema,
  scan: DriveDiscoveryScanSnapshotV1Schema.nullable(),
  reviews: z.record(z.string().regex(/^intake_[a-f0-9]{24}$/), DriveIntakeReviewV1Schema),
}).strict()
export type DriveDiscoveryStateV1 = z.infer<typeof DriveDiscoveryStateV1Schema>

export function driveIntakeCandidateHashInputV1(value: Omit<DriveIntakeCandidateV1, 'candidate_hash'>): Omit<DriveIntakeCandidateV1, 'candidate_hash'> {
  return value
}

export function driveDiscoveryEventHashInputV1(value: Omit<DriveDiscoveryEventV1, 'event_hash'>): Omit<DriveDiscoveryEventV1, 'event_hash'> {
  return value
}

export function driveDiscoveryStateHashInputV1(value: Omit<DriveDiscoveryStateV1, 'state_hash'>): Omit<DriveDiscoveryStateV1, 'state_hash'> {
  return value
}
