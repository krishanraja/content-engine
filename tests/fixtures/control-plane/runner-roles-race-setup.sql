\set ON_ERROR_STOP on

-- Committed state for the claim-versus-switch race. Runs last in the
-- control-plane-sql job: it seeds the runner roles, which fences every later
-- claim in this database.

begin;

create table if not exists public.content_ideas (
  id uuid primary key,
  meta jsonb not null default '{}'::jsonb,
  transformed_outputs jsonb,
  updated_at timestamptz not null default now()
);

update public.video_studio_commands
set status = 'cancelled', completed_at = pg_catalog.now(),
    lease_owner_hash = null, lease_token_hash = null, lease_expires_at = null
where status in ('queued', 'leased');

insert into public.video_studio_jobs (
  job_id, target_platforms, series, mode, stage, status, safe_title, safe_summary,
  source_event_count, source_event_chain_hash, source_revision_hash
) values (
  'job-rr-race', array['youtube_shorts']::text[], 'money_of_ai', 'solo', 'treatment', 'active',
  'Runner role race', 'Synthetic job for the claim and switch race.',
  1, repeat('1', 64), repeat('0', 64)
);
insert into public.video_studio_job_platform_states (
  job_id, platform, editorial_state, runner_state, route_state,
  active_revision_hash, active_artifact_hash, semantic_target_map_hash
) values (
  'job-rr-race', 'youtube_shorts', 'needs_final_review', 'idle', 'standard',
  repeat('0', 64), repeat('1', 64), repeat('2', 64)
);
insert into public.video_studio_commands (
  id, job_id, platform, review_id, command_kind, status,
  expected_parent_revision_hash, expected_parent_artifact_hash,
  semantic_target_map_hash, candidate_hash, payload, payload_hash,
  command_hash, idempotency_key, requested_by
) values (
  '76000000-0000-4000-8000-000000000001', 'job-rr-race', 'youtube_shorts', null,
  'magic_edit_return_to_parent', 'queued', repeat('0', 64), repeat('1', 64), null, null,
  '{}'::jsonb, repeat('3', 64), repeat('4', 64), '76000000-0000-4000-8000-000000000001', 'operator'
);

-- A (the primary) has been silent for five minutes, which a switch accepts;
-- B (the standby) is up, idle and ready.
insert into public.video_studio_runner_heartbeats (
  runner_id_hash, runner_status, software_commit, command_schema_versions,
  drive_state, active_command_id, pending_receipts, occurred_at, received_at
) values
  (repeat('a', 64), 'idle', repeat('6', 40), array[1]::integer[], 'ready', null, 0,
   pg_catalog.now() - interval '5 minutes', pg_catalog.now() - interval '5 minutes'),
  (repeat('b', 64), 'idle', repeat('6', 40), array[1]::integer[], 'ready', null, 0,
   pg_catalog.now(), pg_catalog.now())
on conflict (runner_id_hash) do update
set runner_status = excluded.runner_status,
    software_commit = excluded.software_commit,
    drive_state = excluded.drive_state,
    active_command_id = excluded.active_command_id,
    pending_receipts = excluded.pending_receipts,
    occurred_at = excluded.occurred_at,
    received_at = excluded.received_at;

insert into public.video_studio_runner_roles (runner_id_hash, role, set_by, reason) values
  (repeat('a', 64), 'active', 'krish', 'Race fixture: the primary is active.'),
  (repeat('b', 64), 'standby', 'krish', 'Race fixture: the standby waits.');

commit;
