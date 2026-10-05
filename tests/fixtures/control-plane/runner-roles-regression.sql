\set ON_ERROR_STOP on

-- The runner-role fence (supabase/migrations/20260928120000_video_studio_runner_roles.sql),
-- replayed on a clean Postgres after projection-state-regression.sql has proved
-- that nothing changes while the roles are unseeded.
--
-- Runner hashes: A is the primary, B the cold standby, C a runner nobody has
-- assigned, R a retired runner from an earlier bearer. Every case names the
-- rule it pins in its failure message.

begin;

-- content_ideas belongs to Control Center's history and is not replayed here.
-- The production brief lease reads and writes only these columns of it.
create table if not exists public.content_ideas (
  id uuid primary key,
  meta jsonb not null default '{}'::jsonb,
  transformed_outputs jsonb,
  updated_at timestamptz not null default now()
);

create function pg_temp.video_studio_test_state(
  p_platform text,
  p_active_revision_hash text,
  p_active_artifact_hash text,
  p_active_candidate_hash text,
  p_parent_revision_hash text,
  p_parent_artifact_hash text,
  p_parent_candidate_hash text,
  p_semantic_target_map_hash text,
  p_editorial_state text,
  p_route_state text
) returns jsonb
language sql
as $$
  select pg_catalog.jsonb_build_object(
    'platform', p_platform,
    'active_revision_hash', p_active_revision_hash,
    'active_artifact_hash', p_active_artifact_hash,
    'active_candidate_hash', p_active_candidate_hash,
    'parent_revision_hash', p_parent_revision_hash,
    'parent_artifact_hash', p_parent_artifact_hash,
    'parent_candidate_hash', p_parent_candidate_hash,
    'semantic_target_map_hash', p_semantic_target_map_hash,
    'editorial_state', p_editorial_state,
    'route_state', p_route_state
  );
$$;

create function pg_temp.video_studio_test_projection(
  p_job_id text,
  p_target_platforms text[],
  p_expected_state jsonb,
  p_desired_state jsonb,
  p_review_id uuid,
  p_source_event_count bigint,
  p_source_event_chain_hash text,
  p_source_revision_hash text
) returns jsonb
language sql
as $$
  select pg_catalog.jsonb_build_object(
    'job', pg_catalog.jsonb_build_object(
      'job_id', p_job_id,
      'series', 'money_of_ai',
      'mode', 'solo',
      'target_platforms', pg_catalog.to_jsonb(p_target_platforms),
      'stage', 'treatment',
      'status', 'active',
      'safe_title', 'Projection state fixture',
      'safe_summary', 'Synthetic metadata-only projection for exact state regression.',
      'source_event_count', p_source_event_count,
      'source_event_chain_hash', p_source_event_chain_hash,
      'source_revision_hash', p_source_revision_hash
    ),
    'expected_platform_state', p_expected_state,
    'platform_state', p_desired_state,
    'review', pg_catalog.jsonb_build_object(
      'id', p_review_id,
      'gate', 'treatment',
      'safe_title', 'Review synthetic treatment',
      'safe_summary', 'The regression fixture carries no media or private content.',
      'parent_revision_hash', p_desired_state ->> 'active_revision_hash',
      'parent_artifact_hash', p_desired_state ->> 'active_artifact_hash',
      'revision_hash', repeat('e', 64),
      'artifact_hash', repeat('f', 64),
      'candidate_hash', null,
      'route_state', p_desired_state ->> 'route_state',
      'safe_payload', pg_catalog.jsonb_build_object(
        'semantic_target_map_hash', p_desired_state ->> 'semantic_target_map_hash',
        'blocking_gates', pg_catalog.jsonb_build_object(
          'truth', pg_catalog.jsonb_build_object('status', 'passed'),
          'rights', pg_catalog.jsonb_build_object('status', 'passed'),
          'confidentiality', pg_catalog.jsonb_build_object('status', 'passed'),
          'transcript_fidelity', pg_catalog.jsonb_build_object('status', 'passed'),
          'naming', pg_catalog.jsonb_build_object('status', 'passed')
        )
      ),
      'hard_gates', pg_catalog.jsonb_build_object(
        'truth', pg_catalog.jsonb_build_object('status', 'passed'),
        'rights', pg_catalog.jsonb_build_object('status', 'passed'),
        'confidentiality', pg_catalog.jsonb_build_object('status', 'passed'),
        'transcript_fidelity', pg_catalog.jsonb_build_object('status', 'passed'),
        'naming', pg_catalog.jsonb_build_object('status', 'passed')
      ),
      'created_at', '2026-09-05T10:00:00.000Z'
    )
  );
$$;

create function pg_temp.video_studio_test_projection_hash(
  p_idempotency_key uuid,
  p_salt text default ''
)
returns text
language sql
immutable
as $$
  select pg_catalog.md5('projection:' || p_idempotency_key::text || ':' || p_salt)
    || pg_catalog.md5('fixture:' || p_idempotency_key::text || ':' || p_salt);
$$;

create function pg_temp.video_studio_test_receipt_hash(p_command_id uuid)
returns text
language sql
immutable
as $$
  select pg_catalog.md5('receipt:' || p_command_id::text)
    || pg_catalog.md5('fixture:' || p_command_id::text);
$$;


create function pg_temp.rr(p_name text) returns text
language sql immutable
as $$
  select case p_name
    when 'A' then repeat('a', 64)
    when 'B' then repeat('b', 64)
    when 'C' then repeat('c', 64)
    when 'R' then repeat('d', 64)
  end;
$$;

create function pg_temp.rr_job(p_job text) returns void
language sql
as $$
  insert into public.video_studio_jobs (
    job_id, target_platforms, series, mode, stage, status, safe_title, safe_summary,
    source_event_count, source_event_chain_hash, source_revision_hash
  ) values (
    p_job, array['youtube_shorts']::text[], 'money_of_ai', 'solo', 'treatment', 'active',
    'Runner role fixture', 'Synthetic job for the runner-role fence.',
    1, repeat('1', 64), repeat('0', 64)
  );
  insert into public.video_studio_job_platform_states (
    job_id, platform, editorial_state, runner_state, route_state,
    active_revision_hash, active_artifact_hash, semantic_target_map_hash
  ) values (
    p_job, 'youtube_shorts', 'needs_final_review', 'idle', 'standard',
    repeat('0', 64), repeat('1', 64), repeat('2', 64)
  );
$$;

create function pg_temp.rr_queue(p_id uuid, p_job text) returns void
language sql
as $$
  select pg_temp.rr_job(p_job);
  insert into public.video_studio_commands (
    id, job_id, platform, review_id, command_kind, status,
    expected_parent_revision_hash, expected_parent_artifact_hash,
    semantic_target_map_hash, candidate_hash, payload, payload_hash,
    command_hash, idempotency_key, requested_by
  ) values (
    p_id, p_job, 'youtube_shorts', null, 'magic_edit_return_to_parent', 'queued',
    repeat('0', 64), repeat('1', 64), null, null, '{}'::jsonb,
    repeat('3', 64), repeat('4', 64), p_id, 'operator'
  );
$$;

create function pg_temp.rr_heartbeat(
  p_hash text,
  p_age interval,
  p_status text default 'idle',
  p_pending integer default 0,
  p_active_command uuid default null
) returns void
language sql
as $$
  insert into public.video_studio_runner_heartbeats (
    runner_id_hash, runner_status, software_commit, command_schema_versions,
    drive_state, active_command_id, pending_receipts, occurred_at, received_at
  ) values (
    p_hash, p_status, repeat('6', 40), array[1]::integer[], 'ready', p_active_command,
    p_pending, pg_catalog.clock_timestamp() - p_age, pg_catalog.clock_timestamp() - p_age
  )
  on conflict (runner_id_hash) do update
  set runner_status = excluded.runner_status,
      software_commit = excluded.software_commit,
      drive_state = excluded.drive_state,
      active_command_id = excluded.active_command_id,
      pending_receipts = excluded.pending_receipts,
      occurred_at = excluded.occurred_at,
      received_at = excluded.received_at;
$$;

create function pg_temp.rr_claim(p_runner text, p_token text) returns uuid
language sql
as $$
  select claimed.command_id
  from public.video_studio_claim_command(p_runner, p_token, 30) as claimed;
$$;

create function pg_temp.rr_brief_row(p_id uuid, p_brief text) returns void
language sql
as $$
  insert into public.content_ideas (id, transformed_outputs)
  values (
    p_id,
    pg_catalog.jsonb_build_object('production_briefs', pg_catalog.jsonb_build_object(
      p_brief, pg_catalog.jsonb_build_object(
        'status', 'ready_for_studio',
        'requested_by', 'Krish',
        'brief', pg_catalog.jsonb_build_object('brief_id', p_brief, 'content_idea_id', p_id::text)
      )
    ))
  );
$$;

create function pg_temp.rr_lease_brief(p_runner text, p_id uuid, p_brief text) returns text
language sql
as $$
  select public.video_studio_lease_production_brief(
    p_runner,
    p_id,
    (select updated_at from public.content_ideas where id = p_id),
    p_brief,
    pg_catalog.jsonb_build_object(
      'status', 'leased',
      'requested_by', 'Krish',
      'brief', pg_catalog.jsonb_build_object('brief_id', p_brief, 'content_idea_id', p_id::text),
      'lease', pg_catalog.jsonb_build_object(
        'runner_id_hash', p_runner,
        'token_hash', repeat('9', 64),
        'software_commit', repeat('6', 40),
        'claimed_at', pg_catalog.now(),
        'expires_at', pg_catalog.now() + interval '2 minutes'
      )
    )
  );
$$;

create function pg_temp.rr_brief_status(p_id uuid, p_brief text) returns text
language sql
as $$
  select transformed_outputs -> 'production_briefs' -> p_brief ->> 'status'
  from public.content_ideas where id = p_id;
$$;

create function pg_temp.rr_expect_error(p_sql text, p_expected text, p_rule text) returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm <> p_expected then
      raise exception '%: expected %, got % (%)', p_rule, p_expected, sqlerrm, sqlstate;
    end if;
    return;
  end;
  raise exception '%: expected %, but the statement succeeded', p_rule, p_expected;
end;
$$;

-- Every earlier fixture's queued or leased command is closed, so each case
-- below sees only its own work.
update public.video_studio_commands
set status = 'cancelled', completed_at = pg_catalog.now(),
    lease_owner_hash = null, lease_token_hash = null, lease_expires_at = null
where status in ('queued', 'leased');
delete from public.video_studio_runner_heartbeats;

do $unfenced_until_seeded$
declare
  v_claimed uuid;
begin
  if exists (select 1 from public.video_studio_runner_roles) then
    raise exception 'the roles table must start empty';
  end if;
  if public.video_studio_runner_lease_standing(pg_temp.rr('C')) <> 'unfenced' then
    raise exception 'unfenced: an unseeded table must leave every runner unfenced';
  end if;
  perform pg_temp.rr_queue('70000000-0000-4000-8000-000000000001', 'job-rr-unfenced');
  v_claimed := pg_temp.rr_claim(pg_temp.rr('C'), repeat('1', 64));
  if v_claimed is distinct from '70000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'unfenced: before the seed any runner still claims, exactly as before';
  end if;
  perform pg_temp.rr_brief_row('71000000-0000-4000-8000-000000000001', 'brief-rr-unfenced');
  if pg_temp.rr_lease_brief(pg_temp.rr('C'), '71000000-0000-4000-8000-000000000001', 'brief-rr-unfenced') <> 'leased' then
    raise exception 'unfenced: before the seed any runner still leases a brief';
  end if;
  update public.video_studio_commands
  set status = 'cancelled', completed_at = pg_catalog.now(),
      lease_owner_hash = null, lease_token_hash = null, lease_expires_at = null
  where id = '70000000-0000-4000-8000-000000000001';
  update public.content_ideas
  set transformed_outputs = pg_catalog.jsonb_set(transformed_outputs, '{production_briefs,brief-rr-unfenced,status}', '"imported"')
  where id = '71000000-0000-4000-8000-000000000001';
end;
$unfenced_until_seeded$;

-- The seed, in the shape the operator runs it: the primary active, a stale
-- runner retired, in one transaction.
insert into public.video_studio_runner_roles (runner_id_hash, role, set_by, reason) values
  (pg_temp.rr('A'), 'active', 'krish', 'Fixture seed: the primary is the active runner.'),
  (pg_temp.rr('R'), 'retired', 'krish', 'Fixture seed: a runner hash from a retired bearer.');

do $seeded$
begin
  if (select pg_catalog.count(*) from public.video_studio_runner_role_events) <> 2 then
    raise exception 'audit: the seed must write one event per role row';
  end if;
  if public.video_studio_runner_lease_standing(pg_temp.rr('A')) <> 'active'
    or public.video_studio_runner_lease_standing(pg_temp.rr('R')) <> 'retired'
    or public.video_studio_runner_lease_standing(pg_temp.rr('C')) <> 'unassigned' then
    raise exception 'standing: seeded roles must read back as active, retired and unassigned';
  end if;
end;
$seeded$;

do $two_active_impossible$
begin
  begin
    insert into public.video_studio_runner_roles (runner_id_hash, role, set_by, reason)
    values (pg_temp.rr('B'), 'active', 'krish', 'A second active runner must be refused.');
    raise exception 'two_active: a second active row was accepted';
  exception when unique_violation then
    null;
  end;
  begin
    update public.video_studio_runner_roles set role = 'standby' where runner_id_hash = pg_temp.rr('A');
    set constraints video_studio_runner_roles_one_active immediate;
    raise exception 'no_active: a seeded table was left with no active runner';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'runner_roles_need_one_active' then raise; end if;
  end;
  set constraints video_studio_runner_roles_one_active deferred;
  if public.video_studio_runner_lease_standing(pg_temp.rr('A')) <> 'active' then
    raise exception 'no_active: the refused demotion must leave A active';
  end if;
end;
$two_active_impossible$;

select pg_temp.rr_expect_error(
  format('delete from public.video_studio_runner_roles where runner_id_hash = %L', pg_temp.rr('R')),
  'runner_role_permanent', 'permanent: a role row can never be deleted');
-- Flush the seed's deferred checks first: Postgres refuses TRUNCATE on a
-- table with pending trigger events, which would hide the guard under test.
set constraints video_studio_runner_roles_one_active immediate;
select pg_temp.rr_expect_error(
  'truncate public.video_studio_runner_roles',
  'runner_role_permanent', 'permanent: the roles table can never be emptied');
set constraints video_studio_runner_roles_one_active deferred;
select pg_temp.rr_expect_error(
  format('update public.video_studio_runner_roles set role = %L where runner_id_hash = %L', 'standby', pg_temp.rr('R')),
  'runner_retired', 'retired_terminal: a retired runner stays retired');
select pg_temp.rr_expect_error(
  'update public.video_studio_runner_role_events set reason = ''rewritten history'' where id = (select min(id) from public.video_studio_runner_role_events)',
  'append_only_violation', 'audit: role events are append-only');

do $standby_and_others_get_nothing$
declare
  v_claimed uuid;
begin
  perform pg_temp.rr_heartbeat(pg_temp.rr('B'), interval '1 second');
  perform pg_temp.rr_queue('70000000-0000-4000-8000-000000000002', 'job-rr-fence');
  perform pg_temp.rr_brief_row('71000000-0000-4000-8000-000000000002', 'brief-rr-fence');
  insert into public.video_studio_runner_roles (runner_id_hash, role, set_by, reason)
  values (pg_temp.rr('B'), 'standby', 'krish', 'Fixture: B is the cold standby.');

  foreach v_claimed in array array[
    pg_temp.rr_claim(pg_temp.rr('B'), repeat('1', 64)),
    pg_temp.rr_claim(pg_temp.rr('C'), repeat('1', 64)),
    pg_temp.rr_claim(pg_temp.rr('R'), repeat('1', 64))
  ]::uuid[] loop
    if v_claimed is not null then
      raise exception 'standby_commands: a runner that is not active was leased a command';
    end if;
  end loop;
  if (select status from public.video_studio_commands where id = '70000000-0000-4000-8000-000000000002') <> 'queued'
    or (select attempt_count from public.video_studio_commands where id = '70000000-0000-4000-8000-000000000002') <> 0 then
    raise exception 'standby_commands: a fenced claim must leave the command untouched';
  end if;

  if pg_temp.rr_lease_brief(pg_temp.rr('B'), '71000000-0000-4000-8000-000000000002', 'brief-rr-fence') <> 'fenced'
    or pg_temp.rr_lease_brief(pg_temp.rr('C'), '71000000-0000-4000-8000-000000000002', 'brief-rr-fence') <> 'fenced'
    or pg_temp.rr_lease_brief(pg_temp.rr('R'), '71000000-0000-4000-8000-000000000002', 'brief-rr-fence') <> 'fenced' then
    raise exception 'standby_briefs: a runner that is not active was leased a brief';
  end if;
  if pg_temp.rr_brief_status('71000000-0000-4000-8000-000000000002', 'brief-rr-fence') <> 'ready_for_studio' then
    raise exception 'standby_briefs: a fenced lease must leave the brief untouched';
  end if;

  v_claimed := pg_temp.rr_claim(pg_temp.rr('A'), repeat('a', 64));
  if v_claimed is distinct from '70000000-0000-4000-8000-000000000002'::uuid then
    raise exception 'active_claims: the active runner must be leased the queued command';
  end if;
  if pg_temp.rr_lease_brief(pg_temp.rr('A'), '71000000-0000-4000-8000-000000000002', 'brief-rr-fence') <> 'leased'
    or pg_temp.rr_brief_status('71000000-0000-4000-8000-000000000002', 'brief-rr-fence') <> 'leased' then
    raise exception 'active_claims: the active runner must be leased the ready brief';
  end if;
end;
$standby_and_others_get_nothing$;

do $switch_refusals$
declare
  v_reason text := 'Fixture: fail over from the primary to the standby.';
  v_operator text := 'operator:' || repeat('e', 64);
begin
  -- A still heartbeating: the procedure stops its task first.
  perform pg_temp.rr_heartbeat(pg_temp.rr('A'), interval '5 seconds', 'working', 0, '70000000-0000-4000-8000-000000000002');
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_switch_active_runner(%L, %L, %L, %L)', pg_temp.rr('B'), pg_temp.rr('A'), v_operator, v_reason),
    'active_runner_still_running', 'switch_refused: the outgoing runner is still running');

  -- A stopped with a command and a brief still leased to it.
  perform pg_temp.rr_heartbeat(pg_temp.rr('A'), interval '5 minutes');
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_switch_active_runner(%L, %L, %L, %L)', pg_temp.rr('B'), pg_temp.rr('A'), v_operator, v_reason),
    'active_runner_holds_work', 'switch_refused: a command and a brief are leased to the outgoing runner');

  -- The leased command alone is enough to refuse, even once its lease has
  -- expired: only A may reclaim it.
  update public.content_ideas
  set transformed_outputs = pg_catalog.jsonb_set(transformed_outputs, '{production_briefs,brief-rr-fence,status}', '"imported"')
  where id = '71000000-0000-4000-8000-000000000002';
  update public.video_studio_commands set lease_expires_at = pg_catalog.now() - interval '1 second'
  where id = '70000000-0000-4000-8000-000000000002';
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_switch_active_runner(%L, %L, %L, %L)', pg_temp.rr('B'), pg_temp.rr('A'), v_operator, v_reason),
    'active_runner_holds_work', 'switch_refused: a command leased to the outgoing runner');

  -- And the leased brief alone.
  update public.video_studio_commands
  set status = 'cancelled', completed_at = pg_catalog.now(),
      lease_owner_hash = null, lease_token_hash = null, lease_expires_at = null
  where id = '70000000-0000-4000-8000-000000000002';
  update public.content_ideas
  set transformed_outputs = pg_catalog.jsonb_set(transformed_outputs, '{production_briefs,brief-rr-fence,status}', '"leased"')
  where id = '71000000-0000-4000-8000-000000000002';
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_switch_active_runner(%L, %L, %L, %L)', pg_temp.rr('B'), pg_temp.rr('A'), v_operator, v_reason),
    'active_runner_holds_work', 'switch_refused: a brief leased to the outgoing runner');
  update public.content_ideas
  set transformed_outputs = pg_catalog.jsonb_set(transformed_outputs, '{production_briefs,brief-rr-fence,status}', '"imported"')
  where id = '71000000-0000-4000-8000-000000000002';

  -- Its last heartbeat reported a receipt it has not delivered.
  perform pg_temp.rr_heartbeat(pg_temp.rr('A'), interval '5 minutes', 'degraded', 1);
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_switch_active_runner(%L, %L, %L, %L)', pg_temp.rr('B'), pg_temp.rr('A'), v_operator, v_reason),
    'active_runner_has_pending_receipts', 'switch_refused: the outgoing runner has a pending receipt');
  perform pg_temp.rr_heartbeat(pg_temp.rr('A'), interval '5 minutes');

  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_switch_active_runner(%L, %L, %L, %L)', pg_temp.rr('B'), pg_temp.rr('C'), v_operator, v_reason),
    'active_runner_changed', 'switch_refused: the caller named the wrong active runner');
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_switch_active_runner(%L, %L, %L, %L)', pg_temp.rr('R'), pg_temp.rr('A'), v_operator, v_reason),
    'runner_retired', 'switch_refused: a retired runner can never become active');
  perform pg_temp.rr_heartbeat(pg_temp.rr('C'), interval '10 minutes');
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_switch_active_runner(%L, %L, %L, %L)', pg_temp.rr('C'), pg_temp.rr('A'), v_operator, v_reason),
    'target_runner_not_ready', 'switch_refused: the incoming runner is not heartbeating');
  perform pg_temp.rr_heartbeat(pg_temp.rr('B'), interval '1 second', 'degraded');
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_switch_active_runner(%L, %L, %L, %L)', pg_temp.rr('B'), pg_temp.rr('A'), v_operator, v_reason),
    'target_runner_not_ready', 'switch_refused: the incoming runner is degraded');
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_switch_active_runner(%L, %L, %L, %L)', pg_temp.rr('B'), pg_temp.rr('A'), 'somebody', 'short'),
    'invalid_runner_role_request', 'switch_refused: a reason of eight characters or more is required');

  if public.video_studio_runner_lease_standing(pg_temp.rr('A')) <> 'active'
    or public.video_studio_runner_lease_standing(pg_temp.rr('B')) <> 'standby' then
    raise exception 'switch_refused: every refusal must leave the roles exactly as they were';
  end if;
end;
$switch_refusals$;

do $in_flight_lease_completes_after_a_role_change$
declare
  v_gates jsonb := pg_catalog.jsonb_build_object(
    'truth', pg_catalog.jsonb_build_object('status', 'passed'),
    'rights', pg_catalog.jsonb_build_object('status', 'passed'),
    'confidentiality', pg_catalog.jsonb_build_object('status', 'passed'),
    'transcript_fidelity', pg_catalog.jsonb_build_object('status', 'passed'),
    'naming', pg_catalog.jsonb_build_object('status', 'passed')
  );
  v_claimed uuid;
  v_status text;
  v_accepted boolean;
begin
  -- A takes two commands while it is active.
  perform pg_temp.rr_queue('70000000-0000-4000-8000-000000000003', 'job-rr-in-flight');
  perform pg_temp.rr_queue('70000000-0000-4000-8000-000000000004', 'job-rr-reclaim');
  if pg_temp.rr_claim(pg_temp.rr('A'), repeat('3', 64)) is distinct from '70000000-0000-4000-8000-000000000003'::uuid
    or pg_temp.rr_claim(pg_temp.rr('A'), repeat('4', 64)) is distinct from '70000000-0000-4000-8000-000000000004'::uuid then
    raise exception 'in_flight: setup could not lease both commands to A';
  end if;

  -- The roles change underneath them. The switch function refuses this state
  -- (above), so this is the database owner's hand, the worst case: A is no
  -- longer active while it still holds two leases.
  update public.video_studio_runner_roles set role = 'standby', set_by = 'krish', reason = 'Fixture: demote A with work in flight.'
  where runner_id_hash = pg_temp.rr('A');
  update public.video_studio_runner_roles set role = 'active', set_by = 'krish', reason = 'Fixture: promote B with work in flight.'
  where runner_id_hash = pg_temp.rr('B');
  set constraints video_studio_runner_roles_one_active immediate;
  set constraints video_studio_runner_roles_one_active deferred;

  -- A's heartbeat still renews its lease.
  select accepted into v_accepted
  from public.video_studio_record_heartbeat(
    pg_temp.rr('A'), 'working', repeat('6', 40), array[1]::integer[], 'ready',
    '70000000-0000-4000-8000-000000000003', 0, pg_catalog.now(), repeat('3', 64), 120
  );
  if v_accepted is not true then
    raise exception 'in_flight: the lease holder''s heartbeat must still renew its lease';
  end if;

  -- A still completes it with a signed receipt.
  select command_status into v_status
  from public.video_studio_complete_command(
    '70000000-0000-4000-8000-000000000003', 'job-rr-in-flight', pg_temp.rr('A'), repeat('3', 64),
    repeat('4', 64), pg_temp.video_studio_test_receipt_hash('70000000-0000-4000-8000-000000000003'),
    repeat('5', 64), 'failed', null, null, '{}'::jsonb, v_gates, false, 'render_failed',
    pg_catalog.now() - interval '1 minute', pg_catalog.now()
  );
  if v_status is distinct from 'failed' then
    raise exception 'in_flight: the lease holder must still complete its command after a role change, got %', v_status;
  end if;

  -- A's other lease expires; only A may reclaim it, and it still can.
  update public.video_studio_commands set lease_expires_at = pg_catalog.now() - interval '1 second'
  where id = '70000000-0000-4000-8000-000000000004';
  if pg_temp.rr_claim(pg_temp.rr('B'), repeat('b', 64)) is not null then
    raise exception 'same_runner_reclaim: the new active runner must never take another runner''s leased command';
  end if;
  v_claimed := pg_temp.rr_claim(pg_temp.rr('A'), repeat('7', 64));
  if v_claimed is distinct from '70000000-0000-4000-8000-000000000004'::uuid then
    raise exception 'same_runner_reclaim: a standby must still reclaim the command it leased';
  end if;
  update public.video_studio_commands
  set status = 'cancelled', completed_at = pg_catalog.now(),
      lease_owner_hash = null, lease_token_hash = null, lease_expires_at = null
  where id = '70000000-0000-4000-8000-000000000004';

  -- A standby is still never leased new work.
  perform pg_temp.rr_queue('70000000-0000-4000-8000-000000000005', 'job-rr-new-work');
  if pg_temp.rr_claim(pg_temp.rr('A'), repeat('8', 64)) is not null then
    raise exception 'standby_commands: the demoted runner must not be leased new work';
  end if;
  if pg_temp.rr_claim(pg_temp.rr('B'), repeat('9', 64)) is distinct from '70000000-0000-4000-8000-000000000005'::uuid then
    raise exception 'active_claims: the promoted runner must be leased new work';
  end if;
  update public.video_studio_commands
  set status = 'cancelled', completed_at = pg_catalog.now(),
      lease_owner_hash = null, lease_token_hash = null, lease_expires_at = null
  where id = '70000000-0000-4000-8000-000000000005';
end;
$in_flight_lease_completes_after_a_role_change$;

do $switch_succeeds_and_is_audited$
declare
  v_result record;
  v_events integer;
begin
  -- Back to A through the real switch: B stopped and holding nothing, A up.
  perform pg_temp.rr_heartbeat(pg_temp.rr('B'), interval '5 minutes');
  perform pg_temp.rr_heartbeat(pg_temp.rr('A'), interval '2 seconds');
  select count(*) into v_events from public.video_studio_runner_role_events;
  select * into v_result
  from public.video_studio_switch_active_runner(
    pg_temp.rr('A'), pg_temp.rr('B'), 'operator:' || repeat('e', 64), 'Fixture: fail back to the primary.'
  );
  if v_result.from_runner_id_hash <> pg_temp.rr('B') or v_result.to_runner_id_hash <> pg_temp.rr('A') then
    raise exception 'switch: the result must name both runners';
  end if;
  if public.video_studio_runner_lease_standing(pg_temp.rr('A')) <> 'active'
    or public.video_studio_runner_lease_standing(pg_temp.rr('B')) <> 'standby' then
    raise exception 'switch: A must be active and B standby';
  end if;
  if (select count(*) from public.video_studio_runner_role_events) <> v_events + 2
    or not exists (
      select 1 from public.video_studio_runner_role_events
      where runner_id_hash = pg_temp.rr('A') and from_role = 'standby' and to_role = 'active'
        and set_by = 'operator:' || repeat('e', 64) and reason = 'Fixture: fail back to the primary.'
    )
    or not exists (
      select 1 from public.video_studio_runner_role_events
      where runner_id_hash = pg_temp.rr('B') and from_role = 'active' and to_role = 'standby'
    ) then
    raise exception 'switch: both changes must be audited with who and why';
  end if;
end;
$switch_succeeds_and_is_audited$;

do $retired_never_claims$
begin
  -- A command R leased before it was retired: sticky to R, and R is fenced
  -- even from its own work, so nobody takes it and it runs out as attention.
  perform pg_temp.rr_job('job-rr-retired');
  insert into public.video_studio_commands (
    id, job_id, platform, review_id, command_kind, status,
    expected_parent_revision_hash, expected_parent_artifact_hash,
    semantic_target_map_hash, candidate_hash, payload, payload_hash,
    command_hash, idempotency_key, requested_by,
    lease_owner_hash, lease_token_hash, lease_expires_at, attempt_count
  ) values (
    '70000000-0000-4000-8000-000000000006', 'job-rr-retired', 'youtube_shorts', null,
    'magic_edit_return_to_parent', 'leased', repeat('0', 64), repeat('1', 64), null, null,
    '{}'::jsonb, repeat('3', 64), repeat('4', 64), '70000000-0000-4000-8000-000000000006',
    'operator', pg_temp.rr('R'), repeat('5', 64), pg_catalog.now() - interval '1 second', 1
  );
  perform pg_temp.rr_heartbeat(pg_temp.rr('R'), interval '1 second');
  if pg_temp.rr_claim(pg_temp.rr('R'), repeat('6', 64)) is not null then
    raise exception 'retired: a retired runner must never be leased anything, even its own command';
  end if;
  if public.video_studio_lease_production_brief(
    pg_temp.rr('R'), '71000000-0000-4000-8000-000000000002',
    (select updated_at from public.content_ideas where id = '71000000-0000-4000-8000-000000000002'),
    'brief-rr-fence',
    pg_catalog.jsonb_build_object(
      'status', 'leased',
      'brief', pg_catalog.jsonb_build_object('brief_id', 'brief-rr-fence', 'content_idea_id', '71000000-0000-4000-8000-000000000002'),
      'lease', pg_catalog.jsonb_build_object('runner_id_hash', pg_temp.rr('R'))
    )
  ) <> 'fenced' then
    raise exception 'retired: a retired runner must never be leased a brief';
  end if;
  if pg_temp.rr_claim(pg_temp.rr('A'), repeat('7', 64)) is not null then
    raise exception 'retired: another runner must not take the retired runner''s command either';
  end if;
  update public.video_studio_commands
  set status = 'cancelled', completed_at = pg_catalog.now(),
      lease_owner_hash = null, lease_token_hash = null, lease_expires_at = null
  where id = '70000000-0000-4000-8000-000000000006';
end;
$retired_never_claims$;

do $set_runner_role$
declare
  v_operator text := 'operator:' || repeat('e', 64);
  v_result record;
begin
  perform pg_temp.rr_heartbeat(pg_temp.rr('C'), interval '1 second');
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_set_runner_role(%L, %L, %L, %L)', pg_temp.rr('A'), 'standby', v_operator, 'Fixture: demote the active runner.'),
    'runner_is_active', 'set_role: the active runner changes only through the switch');
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_set_runner_role(%L, %L, %L, %L)', pg_temp.rr('C'), 'retired', v_operator, 'Fixture: retire a running runner.'),
    'runner_still_running', 'set_role: a runner that is heartbeating is not retired');
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_set_runner_role(%L, %L, %L, %L)', pg_temp.rr('R'), 'standby', v_operator, 'Fixture: revive a retired runner.'),
    'runner_retired', 'set_role: retired is terminal');
  perform pg_temp.rr_expect_error(
    format('select * from public.video_studio_set_runner_role(%L, %L, %L, %L)', pg_temp.rr('C'), 'active', v_operator, 'Fixture: make C active by the side door.'),
    'invalid_runner_role_request', 'set_role: active is only reachable through the switch');
  select * into v_result from public.video_studio_set_runner_role(pg_temp.rr('C'), 'standby', v_operator, 'Fixture: C is a second standby.');
  if v_result.new_role <> 'standby' or public.video_studio_runner_lease_standing(pg_temp.rr('C')) <> 'standby' then
    raise exception 'set_role: C must become standby';
  end if;
  perform pg_temp.rr_heartbeat(pg_temp.rr('C'), interval '10 minutes');
  select * into v_result from public.video_studio_set_runner_role(pg_temp.rr('C'), 'retired', v_operator, 'Fixture: C is gone for good.');
  if public.video_studio_runner_lease_standing(pg_temp.rr('C')) <> 'retired' then
    raise exception 'set_role: C must become retired';
  end if;
end;
$set_runner_role$;

do $recovery_counts_only_the_active_runner$
declare
  v_root jsonb;
  v_payload jsonb;
  v_submitted_at timestamptz := pg_catalog.clock_timestamp();
  v_duplicate boolean;
begin
  -- The ambiguity the original rule refused (two healthy runners) is settled
  -- by the role: only the active runner's heartbeat counts.
  v_root := pg_temp.video_studio_test_state(
    'youtube_shorts', repeat('0', 64), repeat('1', 64), null,
    null, null, null, repeat('2', 64), 'needs_visual_review', 'standard'
  );
  perform * from public.video_studio_project_review(
    repeat('a', 64), 'unknown',
    '72000000-0000-4000-8000-000000000001'::uuid,
    pg_temp.video_studio_test_projection_hash('72000000-0000-4000-8000-000000000001'::uuid),
    pg_temp.video_studio_test_projection(
      'job-rr-recovery', array['youtube_shorts']::text[], null, v_root,
      '73000000-0000-4000-8000-000000000001'::uuid,
      1, repeat('1', 64), repeat('0', 64)
    )
  );
  insert into public.video_studio_commands (
    id, job_id, platform, review_id, command_kind, status,
    expected_parent_revision_hash, expected_parent_artifact_hash,
    semantic_target_map_hash, candidate_hash, payload, payload_hash,
    command_hash, idempotency_key, requested_by, safe_code, completed_at
  ) values (
    '74000000-0000-4000-8000-000000000001'::uuid,
    'job-rr-recovery', 'youtube_shorts',
    '73000000-0000-4000-8000-000000000001'::uuid,
    'review_decision_record', 'attention', repeat('0', 64), repeat('1', 64),
    repeat('2', 64), null, '{}'::jsonb, repeat('3', 64), repeat('4', 64),
    '74000000-0000-4000-8000-000000000001'::uuid, 'review_decision',
    'command_expired', pg_catalog.clock_timestamp() - interval '1 minute'
  );
  v_payload := pg_catalog.jsonb_build_object(
    'schema_version', 1,
    'recovery_id', '75000000-0000-4000-8000-000000000001'::uuid,
    'job_id', 'job-rr-recovery',
    'platform', 'youtube_shorts',
    'source_review_id', '73000000-0000-4000-8000-000000000001'::uuid,
    'recovery_review_id', '75000000-0000-4000-8000-000000000001'::uuid,
    'source_command_id', '74000000-0000-4000-8000-000000000001'::uuid,
    'source_command_hash', repeat('4', 64),
    'source_terminal_reason', 'command_expired',
    'recovery_root_command_id', '74000000-0000-4000-8000-000000000001'::uuid,
    'recovery_generation', 1,
    'gate', 'treatment',
    'expected_parent_revision_hash', repeat('0', 64),
    'expected_parent_artifact_hash', repeat('1', 64),
    'review_revision_hash', repeat('e', 64),
    'review_artifact_hash', repeat('f', 64),
    'candidate_hash', null,
    'semantic_target_map_hash', repeat('2', 64),
    'recovered_by', 'Krish',
    'occurred_at', v_submitted_at
  );

  -- Only the standby is healthy: refused, because the active runner will be
  -- the one to claim the binding command.
  perform pg_temp.rr_heartbeat(pg_temp.rr('A'), interval '10 minutes');
  perform pg_temp.rr_heartbeat(pg_temp.rr('B'), interval '1 second');
  perform pg_temp.rr_expect_error(
    format(
      'select * from public.video_studio_recover_failed_review(%L::uuid, %L, %L, %L, %L, %L::uuid, %L::timestamptz, %L, %L::uuid, %L::jsonb, %L, %L)',
      '74000000-0000-4000-8000-000000000001', 'job-rr-recovery', 'youtube_shorts', repeat('0', 64), repeat('1', 64),
      '75000000-0000-4000-8000-000000000001', v_submitted_at, repeat('5', 64),
      '75000000-0000-4000-8000-000000000001', v_payload, repeat('6', 64), repeat('7', 64)
    ),
    'recovery_not_available', 'recovery: a healthy standby alone must not admit a recovery');

  -- Both healthy: the original rule refused this as ambiguous; the role settles it.
  perform pg_temp.rr_heartbeat(pg_temp.rr('A'), interval '1 second');
  select duplicate into v_duplicate
  from public.video_studio_recover_failed_review(
    '74000000-0000-4000-8000-000000000001'::uuid,
    'job-rr-recovery', 'youtube_shorts', repeat('0', 64), repeat('1', 64),
    '75000000-0000-4000-8000-000000000001'::uuid, v_submitted_at, repeat('5', 64),
    '75000000-0000-4000-8000-000000000001'::uuid,
    v_payload, repeat('6', 64), repeat('7', 64)
  );
  if v_duplicate is distinct from false then
    raise exception 'recovery: the active runner''s heartbeat alone must admit the recovery';
  end if;
end;
$recovery_counts_only_the_active_runner$;

do $service_role_reads_only$
begin
  if has_table_privilege('service_role', 'public.video_studio_runner_roles', 'INSERT')
    or has_table_privilege('service_role', 'public.video_studio_runner_roles', 'UPDATE')
    or has_table_privilege('service_role', 'public.video_studio_runner_roles', 'DELETE')
    or not has_table_privilege('service_role', 'public.video_studio_runner_roles', 'SELECT')
    or has_table_privilege('anon', 'public.video_studio_runner_roles', 'SELECT')
    or has_table_privilege('authenticated', 'public.video_studio_runner_roles', 'SELECT')
    or has_table_privilege('service_role', 'public.video_studio_runner_role_events', 'INSERT')
    or not has_table_privilege('service_role', 'public.video_studio_runner_role_events', 'SELECT') then
    raise exception 'privilege: service_role reads the roles and their audit and writes neither directly';
  end if;
  if has_function_privilege('service_role', 'public.video_studio_runner_lease_standing(text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.video_studio_switch_active_runner(text, text, text, text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.video_studio_lease_production_brief(text, uuid, timestamptz, text, jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.video_studio_switch_active_runner(text, text, text, text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.video_studio_set_runner_role(text, text, text, text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.video_studio_lease_production_brief(text, uuid, timestamptz, text, jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.video_studio_claim_command(text, text, integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.video_studio_claim_command(text, text, integer)', 'EXECUTE') then
    raise exception 'privilege: only service_role may call the role functions, and never the fence helper';
  end if;
end;
$service_role_reads_only$;

rollback;
