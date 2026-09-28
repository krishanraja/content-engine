-- Durable Windows runner roles, fenced in the database.
--
-- Ruling (Krish, 2026-09-28): a second Windows machine is a cold standby with
-- its task disabled. Both claim paths leased work to any runner that presented
-- the bearer, so the standby's disabled task was the only thing keeping two
-- machines from taking work, and nothing recorded which runner was meant to be
-- working.
--
-- This migration adds:
--   * video_studio_runner_roles: one row per runner_id_hash, role 'active',
--     'standby' or 'retired', with who set it, when and why. At most one row
--     is active (a partial unique index); once any row exists exactly one is
--     active (a deferred constraint trigger); rows are never deleted; a retired
--     runner stays retired.
--   * video_studio_runner_role_events: the append-only audit of every change.
--   * The fence, in both claim paths. video_studio_claim_command and the new
--     video_studio_lease_production_brief lease new work only to the active
--     runner. Any other runner gets no row back, which the routes already turn
--     into {"command": null} and {"item": null}, the answers a runner at
--     6bf7862 treats as "nothing to claim", so the installed runners need no
--     change.
--   * video_studio_switch_active_runner: the audited operator switch. It
--     refuses while the active runner is still heartbeating, holds a queued or
--     leased command or a leased brief, or reported pending receipts, and it
--     promotes only a runner that is heartbeating, idle, Drive ready and
--     holding nothing.
--   * video_studio_set_runner_role: marks a runner that is not active as
--     standby or retired.
--   * video_studio_recover_failed_review counts only the active runner's
--     heartbeat, so a recovery's binding command is created only when the
--     runner holding the signed evidence is the one that will claim it.
--
-- What the fence never touches: heartbeats (every runner may report), lease
-- renewal, preview upload, completion and late completion, receipt
-- acknowledgement, and same-runner reclaim of a command a runner already
-- leased. A runner finishes work it holds whatever its role, so a switch can
-- never strand a signed receipt.
--
-- Activation. Until the first role row exists the claim functions behave
-- exactly as before ('unfenced'). The seed, run after this migration with
-- Krish's approval, inserts the primary as 'active' and the stale runners as
-- 'retired', and the fence engages in that one transaction. From then on the
-- table can never be empty again, so the fence can never fall back open.

begin;

create table public.video_studio_runner_roles (
  runner_id_hash text primary key check (runner_id_hash ~ '^[a-f0-9]{64}$'),
  role           text not null check (role in ('active', 'standby', 'retired')),
  set_by         text not null check (set_by ~ '^[a-z][a-z0-9_:-]{0,79}$'),
  set_at         timestamptz not null default now(),
  reason         text not null check (char_length(btrim(reason)) between 8 and 500)
);

create unique index video_studio_runner_roles_one_active_idx
  on public.video_studio_runner_roles (role)
  where role = 'active';

create table public.video_studio_runner_role_events (
  id             bigint generated always as identity primary key,
  runner_id_hash text not null check (runner_id_hash ~ '^[a-f0-9]{64}$'),
  from_role      text check (from_role is null or from_role in ('active', 'standby', 'retired')),
  to_role        text not null check (to_role in ('active', 'standby', 'retired')),
  set_by         text not null,
  reason         text not null,
  occurred_at    timestamptz not null default now()
);

create index video_studio_runner_role_events_occurred_idx
  on public.video_studio_runner_role_events (occurred_at desc);

-- A role row is permanent and a retired runner stays retired. A bearer
-- rotation gives every runner a new hash, so a retired hash can never come
-- back as a working runner anyway.
create or replace function public.video_studio_runner_roles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'runner_role_permanent' using errcode = 'P0001';
  end if;
  if new.runner_id_hash <> old.runner_id_hash then
    raise exception 'runner_role_permanent' using errcode = 'P0001';
  end if;
  if old.role = 'retired' and new.role <> 'retired' then
    raise exception 'runner_retired' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger video_studio_runner_roles_guard
before update or delete on public.video_studio_runner_roles
for each row execute function public.video_studio_runner_roles_guard();

create trigger video_studio_runner_roles_no_truncate
before truncate on public.video_studio_runner_roles
for each statement execute function public.video_studio_runner_roles_guard();

-- Once the roles are seeded there is exactly one active runner at every
-- commit. Checked at commit so a switch can demote and promote in one
-- transaction.
create or replace function public.video_studio_runner_roles_require_one_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.video_studio_runner_roles)
    and (
      select pg_catalog.count(*)
      from public.video_studio_runner_roles
      where role = 'active'
    ) <> 1 then
    raise exception 'runner_roles_need_one_active' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create constraint trigger video_studio_runner_roles_one_active
after insert or update on public.video_studio_runner_roles
deferrable initially deferred
for each row execute function public.video_studio_runner_roles_require_one_active();

create or replace function public.video_studio_runner_roles_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.video_studio_runner_role_events (
    runner_id_hash, from_role, to_role, set_by, reason, occurred_at
  ) values (
    new.runner_id_hash,
    case when tg_op = 'UPDATE' then old.role else null end,
    new.role,
    new.set_by,
    new.reason,
    new.set_at
  );
  return null;
end;
$$;

create trigger video_studio_runner_roles_audit
after insert or update on public.video_studio_runner_roles
for each row execute function public.video_studio_runner_roles_audit();

create trigger video_studio_runner_role_events_append_only
before update or delete on public.video_studio_runner_role_events
for each row execute function public.video_studio_reject_append_only_mutation();

-- The fence. 'unfenced' until the roles are seeded; afterwards the runner's
-- role, or 'unassigned' for a hash with no row. The row is locked FOR SHARE
-- for the rest of the caller's transaction, so a switch, which takes the
-- active row FOR UPDATE, waits for an in-flight lease to commit and then sees
-- it.
create or replace function public.video_studio_runner_lease_standing(
  p_runner_id_hash text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if not exists (select 1 from public.video_studio_runner_roles) then
    return 'unfenced';
  end if;
  select roles.role into v_role
  from public.video_studio_runner_roles as roles
  where roles.runner_id_hash = p_runner_id_hash
  for share;
  if not found then return 'unassigned'; end if;
  return v_role;
end;
$$;

-- video_studio_claim_command as defined in
-- 20260905110000_video_studio_expected_platform_state.sql, with the fence
-- added after the expiry and exhaustion sweeps: new work only for the active
-- runner (or anyone while unfenced), a runner's own previously leased command
-- for that runner unless it is retired.
create or replace function public.video_studio_claim_command(
  p_runner_id_hash text,
  p_lease_token_hash text,
  p_lease_seconds integer
) returns table (
  command_id uuid,
  schema_version integer,
  command_kind text,
  job_id text,
  platform text,
  candidate_hash text,
  expected_parent_revision_hash text,
  expected_parent_artifact_hash text,
  semantic_target_map_hash text,
  payload_hash text,
  command_hash text,
  payload jsonb,
  idempotency_key uuid,
  issued_at timestamptz,
  expires_at timestamptz,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_command public.video_studio_commands%rowtype;
  v_standing text;
begin
  if p_runner_id_hash !~ '^[a-f0-9]{64}$'
    or p_lease_token_hash !~ '^[a-f0-9]{64}$'
    or p_lease_seconds not between 30 and 300 then
    raise exception 'invalid_lease' using errcode = 'P0001';
  end if;

  with expired as (
    update public.video_studio_commands as c
    set status = 'attention',
        safe_code = 'command_expired',
        completed_at = pg_catalog.now(),
        lease_owner_hash = null,
        lease_token_hash = null,
        lease_expires_at = null
    where (
        c.status = 'queued'
        or (c.status = 'leased' and c.lease_expires_at < pg_catalog.now())
      )
      and c.expires_at <= pg_catalog.now()
    returning c.id, c.job_id, c.platform, c.review_id, c.command_kind
  ), failed_bindings as (
    update public.video_studio_review_requests as r
    set binding_state = 'failed'
    where r.id in (
      select expired.review_id from expired
      where expired.command_kind = 'review_recovery_record'
    )
      and r.binding_state = 'queued'
    returning r.id
  )
  update public.video_studio_job_platform_states as s
  set runner_state = 'attention'
  where (s.job_id, s.platform) in (select expired.job_id, expired.platform from expired);

  with exhausted as (
    update public.video_studio_commands as c
    set status = 'attention',
        safe_code = 'attempts_exhausted',
        completed_at = pg_catalog.now(),
        lease_owner_hash = null,
        lease_token_hash = null,
        lease_expires_at = null
    where (
        c.status = 'queued'
        or (c.status = 'leased' and c.lease_expires_at < pg_catalog.now())
      )
      and c.attempt_count >= 5
    returning c.id, c.job_id, c.platform, c.review_id, c.command_kind
  ), failed_bindings as (
    update public.video_studio_review_requests as r
    set binding_state = 'failed'
    where r.id in (
      select exhausted.review_id from exhausted
      where exhausted.command_kind = 'review_recovery_record'
    )
      and r.binding_state = 'queued'
    returning r.id
  )
  update public.video_studio_job_platform_states as s
  set runner_state = 'attention'
  where (s.job_id, s.platform) in (select exhausted.job_id, exhausted.platform from exhausted);

  v_standing := public.video_studio_runner_lease_standing(p_runner_id_hash);
  if v_standing = 'retired' then return; end if;

  select * into v_command
  from public.video_studio_commands c
  where (
      c.status = 'queued'
      or (c.status = 'leased' and c.lease_expires_at < pg_catalog.now())
    )
    and c.not_before <= pg_catalog.now()
    and c.expires_at > pg_catalog.now()
    and c.attempt_count < 5
    and (
      (c.last_lease_owner_hash is null and v_standing in ('active', 'unfenced'))
      or c.last_lease_owner_hash = p_runner_id_hash
    )
  order by c.created_at
  for update skip locked
  limit 1;

  if not found then return; end if;

  update public.video_studio_commands
  set status = 'leased',
      lease_owner_hash = p_runner_id_hash,
      lease_token_hash = p_lease_token_hash,
      lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
      attempt_count = attempt_count + 1
  where id = v_command.id
  returning * into v_command;

  update public.video_studio_job_platform_states
  set runner_state = 'working', runner_last_seen_at = pg_catalog.now()
  where video_studio_job_platform_states.job_id = v_command.job_id
    and video_studio_job_platform_states.platform = v_command.platform;

  return query select
    v_command.id, v_command.schema_version, v_command.command_kind, v_command.job_id,
    v_command.platform, v_command.candidate_hash,
    v_command.expected_parent_revision_hash, v_command.expected_parent_artifact_hash,
    v_command.semantic_target_map_hash, v_command.payload_hash, v_command.command_hash,
    v_command.payload, v_command.idempotency_key, v_command.issued_at, v_command.expires_at,
    v_command.lease_expires_at;
end;
$$;

-- The production brief lease, moved from a direct table update in
-- api/video-studio/runner/production-brief-claim.ts into the database so the
-- fence and the write share one transaction. The route still chooses the
-- brief, checks it, builds the envelope and compares updated_at; this writes
-- that one brief's envelope only if the row is unchanged and the runner may
-- start new work. 'fenced' means the runner is not active and nothing was
-- written; 'changed' means the row moved on and the route tries the next.
create or replace function public.video_studio_lease_production_brief(
  p_runner_id_hash text,
  p_content_idea_id uuid,
  p_expected_updated_at timestamptz,
  p_brief_id text,
  p_envelope jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_standing text;
begin
  if p_runner_id_hash !~ '^[a-f0-9]{64}$'
    or p_content_idea_id is null
    or p_expected_updated_at is null
    or p_brief_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$'
    or p_envelope is null
    or pg_catalog.jsonb_typeof(p_envelope) <> 'object'
    or (p_envelope ->> 'status') is distinct from 'leased'
    or (p_envelope -> 'lease' ->> 'runner_id_hash') is distinct from p_runner_id_hash
    or (p_envelope -> 'brief' ->> 'brief_id') is distinct from p_brief_id
    or pg_catalog.lower(p_envelope -> 'brief' ->> 'content_idea_id') is distinct from p_content_idea_id::text then
    raise exception 'invalid_production_brief_lease' using errcode = 'P0001';
  end if;

  v_standing := public.video_studio_runner_lease_standing(p_runner_id_hash);
  if v_standing not in ('active', 'unfenced') then
    return 'fenced';
  end if;

  update public.content_ideas as idea
  set transformed_outputs = pg_catalog.jsonb_set(
        idea.transformed_outputs,
        array['production_briefs', p_brief_id],
        p_envelope,
        false
      ),
      updated_at = pg_catalog.now()
  where idea.id = p_content_idea_id
    and idea.updated_at = p_expected_updated_at
    and pg_catalog.jsonb_typeof(idea.transformed_outputs -> 'production_briefs') = 'object'
    and (idea.transformed_outputs -> 'production_briefs' -> p_brief_id ->> 'status')
      in ('ready_for_studio', 'leased');
  if not found then return 'changed'; end if;
  return 'leased';
end;
$$;

-- The audited operator switch. Refuses, and changes nothing, unless:
--   * the roles are seeded and the caller names the current active runner
--     (a compare-and-swap, so two operators cannot race);
--   * the outgoing runner has been silent for a minute (an idle runner
--     heartbeats about every five seconds; the failover procedure stops its
--     task first) and its latest heartbeat reported no active command and no
--     pending receipts;
--   * no queued or leased command is, or was last, leased to it, and no
--     production brief is leased to it;
--   * the incoming runner is not retired, heartbeated in the last two minutes,
--     reports idle with Drive ready, a real commit, no active command and no
--     pending receipts, and speaks command schema 1.
create or replace function public.video_studio_switch_active_runner(
  p_to_runner_id_hash text,
  p_expected_active_runner_id_hash text,
  p_set_by text,
  p_reason text
) returns table (
  from_runner_id_hash text,
  to_runner_id_hash text,
  switched_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active public.video_studio_runner_roles%rowtype;
  v_target_role text;
  v_outgoing public.video_studio_runner_heartbeats%rowtype;
  v_incoming public.video_studio_runner_heartbeats%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_reason text := btrim(p_reason);
begin
  if p_to_runner_id_hash is null or p_to_runner_id_hash !~ '^[a-f0-9]{64}$'
    or p_expected_active_runner_id_hash is null or p_expected_active_runner_id_hash !~ '^[a-f0-9]{64}$'
    or p_set_by is null or p_set_by !~ '^[a-z][a-z0-9_:-]{0,79}$'
    or v_reason is null or char_length(v_reason) not between 8 and 500 then
    raise exception 'invalid_runner_role_request' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('video-studio-runner-roles', 0)
  );

  select * into v_active
  from public.video_studio_runner_roles
  where role = 'active'
  for update;
  if not found then raise exception 'runner_roles_not_seeded' using errcode = 'P0001'; end if;
  if v_active.runner_id_hash <> p_expected_active_runner_id_hash then
    raise exception 'active_runner_changed' using errcode = 'P0001';
  end if;
  if p_to_runner_id_hash = v_active.runner_id_hash then
    raise exception 'runner_already_active' using errcode = 'P0001';
  end if;

  select roles.role into v_target_role
  from public.video_studio_runner_roles as roles
  where roles.runner_id_hash = p_to_runner_id_hash
  for update;
  if v_target_role = 'retired' then
    raise exception 'runner_retired' using errcode = 'P0001';
  end if;

  select * into v_outgoing
  from public.video_studio_runner_heartbeats
  where runner_id_hash = v_active.runner_id_hash;
  if found then
    if v_outgoing.received_at > v_now - interval '60 seconds' then
      raise exception 'active_runner_still_running' using errcode = 'P0001';
    end if;
    if v_outgoing.pending_receipts <> 0 or v_outgoing.active_command_id is not null then
      raise exception 'active_runner_has_pending_receipts' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1
    from public.video_studio_commands as c
    where c.status in ('queued', 'leased')
      and (
        c.lease_owner_hash = v_active.runner_id_hash
        or c.last_lease_owner_hash = v_active.runner_id_hash
      )
  ) then
    raise exception 'active_runner_holds_work' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.content_ideas as idea
    cross join lateral pg_catalog.jsonb_each(
      case
        when pg_catalog.jsonb_typeof(idea.transformed_outputs -> 'production_briefs') = 'object'
          then idea.transformed_outputs -> 'production_briefs'
        else '{}'::jsonb
      end
    ) as brief(brief_id, envelope)
    where idea.transformed_outputs ? 'production_briefs'
      and brief.envelope ->> 'status' = 'leased'
      and brief.envelope -> 'lease' ->> 'runner_id_hash' = v_active.runner_id_hash
  ) then
    raise exception 'active_runner_holds_work' using errcode = 'P0001';
  end if;

  select * into v_incoming
  from public.video_studio_runner_heartbeats
  where runner_id_hash = p_to_runner_id_hash;
  if not found
    or v_incoming.received_at <= v_now - interval '2 minutes'
    or v_incoming.runner_status <> 'idle'
    or v_incoming.drive_state <> 'ready'
    or v_incoming.software_commit !~ '^[a-f0-9]{40}$'
    or v_incoming.pending_receipts <> 0
    or v_incoming.active_command_id is not null
    or not (1 = any(v_incoming.command_schema_versions)) then
    raise exception 'target_runner_not_ready' using errcode = 'P0001';
  end if;

  update public.video_studio_runner_roles
  set role = 'standby', set_by = p_set_by, set_at = v_now, reason = v_reason
  where runner_id_hash = v_active.runner_id_hash;

  insert into public.video_studio_runner_roles (runner_id_hash, role, set_by, set_at, reason)
  values (p_to_runner_id_hash, 'active', p_set_by, v_now, v_reason)
  on conflict (runner_id_hash) do update
  set role = 'active', set_by = excluded.set_by, set_at = excluded.set_at, reason = excluded.reason;

  return query select v_active.runner_id_hash, p_to_runner_id_hash, v_now;
end;
$$;

-- Marks a runner that is not active as standby or retired. The active runner
-- changes only through the switch. Retiring refuses while the runner is
-- heartbeating or holds a queued or leased command or a leased brief.
create or replace function public.video_studio_set_runner_role(
  p_runner_id_hash text,
  p_role text,
  p_set_by text,
  p_reason text
) returns table (
  changed_runner_id_hash text,
  new_role text,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
  v_heartbeat public.video_studio_runner_heartbeats%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_reason text := btrim(p_reason);
begin
  if p_runner_id_hash is null or p_runner_id_hash !~ '^[a-f0-9]{64}$'
    or p_role is null or p_role not in ('standby', 'retired')
    or p_set_by is null or p_set_by !~ '^[a-z][a-z0-9_:-]{0,79}$'
    or v_reason is null or char_length(v_reason) not between 8 and 500 then
    raise exception 'invalid_runner_role_request' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('video-studio-runner-roles', 0)
  );

  if not exists (select 1 from public.video_studio_runner_roles as roles where roles.role = 'active') then
    raise exception 'runner_roles_not_seeded' using errcode = 'P0001';
  end if;

  select roles.role into v_current
  from public.video_studio_runner_roles as roles
  where roles.runner_id_hash = p_runner_id_hash
  for update;
  if v_current = 'active' then
    raise exception 'runner_is_active' using errcode = 'P0001';
  end if;
  if v_current = 'retired' then
    raise exception 'runner_retired' using errcode = 'P0001';
  end if;
  if v_current is not distinct from p_role then
    raise exception 'runner_role_unchanged' using errcode = 'P0001';
  end if;

  if p_role = 'retired' then
    select * into v_heartbeat
    from public.video_studio_runner_heartbeats as heartbeat
    where heartbeat.runner_id_hash = p_runner_id_hash;
    if found and v_heartbeat.received_at > v_now - interval '60 seconds' then
      raise exception 'runner_still_running' using errcode = 'P0001';
    end if;
    if exists (
      select 1
      from public.video_studio_commands as c
      where c.status in ('queued', 'leased')
        and (c.lease_owner_hash = p_runner_id_hash or c.last_lease_owner_hash = p_runner_id_hash)
    ) or exists (
      select 1
      from public.content_ideas as idea
      cross join lateral pg_catalog.jsonb_each(
        case
          when pg_catalog.jsonb_typeof(idea.transformed_outputs -> 'production_briefs') = 'object'
            then idea.transformed_outputs -> 'production_briefs'
          else '{}'::jsonb
        end
      ) as brief(brief_id, envelope)
      where idea.transformed_outputs ? 'production_briefs'
        and brief.envelope ->> 'status' = 'leased'
        and brief.envelope -> 'lease' ->> 'runner_id_hash' = p_runner_id_hash
    ) then
      raise exception 'runner_holds_work' using errcode = 'P0001';
    end if;
  end if;

  insert into public.video_studio_runner_roles as roles (runner_id_hash, role, set_by, set_at, reason)
  values (p_runner_id_hash, p_role, p_set_by, v_now, v_reason)
  on conflict on constraint video_studio_runner_roles_pkey do update
  set role = excluded.role, set_by = excluded.set_by, set_at = excluded.set_at, reason = excluded.reason;

  return query select p_runner_id_hash, p_role, v_now;
end;
$$;

-- video_studio_recover_failed_review as defined in
-- 20260905110000_video_studio_expected_platform_state.sql, with one change:
-- once the roles are seeded, the healthy heartbeat it counts must be the
-- active runner's. The recovery's binding command is new work, so only the
-- active runner can claim it, and only the runner that holds the signed
-- failure receipt or claim journal can complete it. Requiring both to be the
-- same runner stops a recovery from being handed to a machine that cannot
-- prove it, which would spend one of its three generations for nothing.
create or replace function public.video_studio_recover_failed_review(
  p_command_id uuid,
  p_job_id text,
  p_platform text,
  p_expected_parent_revision_hash text,
  p_expected_parent_artifact_hash text,
  p_idempotency_key uuid,
  p_submitted_at timestamptz,
  p_recovery_hash text,
  p_recovery_review_id uuid,
  p_runner_payload jsonb,
  p_runner_payload_hash text,
  p_runner_command_hash text
) returns table (
  duplicate boolean,
  recovery_review_id uuid,
  recovery_generation integer,
  job_id text,
  platform text,
  review_status text,
  parent_revision_hash text,
  parent_artifact_hash text,
  created_at timestamptz,
  binding_command_id uuid,
  binding_command_status text,
  binding_command_created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_command public.video_studio_commands%rowtype;
  v_healthy_runner_count integer;
  v_active_runner_hash text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('video-studio-job:' || p_job_id, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('video-studio-recovery:' || p_idempotency_key::text, 0)
  );

  -- A lost HTTP response must remain retryable even if runner health later
  -- changes. The original function verifies the complete idempotent binding.
  if exists (
    select 1
    from public.video_studio_command_recoveries
    where idempotency_key = p_idempotency_key
  ) then
    return query
    select
      result.duplicate,
      result.recovery_review_id,
      result.recovery_generation,
      result.job_id,
      result.platform,
      result.review_status,
      result.parent_revision_hash,
      result.parent_artifact_hash,
      result.created_at,
      result.binding_command_id,
      result.binding_command_status,
      result.binding_command_created_at
    from public.video_studio_recover_failed_review_without_job_lock(
      p_command_id,
      p_job_id,
      p_platform,
      p_expected_parent_revision_hash,
      p_expected_parent_artifact_hash,
      p_idempotency_key,
      p_submitted_at,
      p_recovery_hash,
      p_recovery_review_id,
      p_runner_payload,
      p_runner_payload_hash,
      p_runner_command_hash
    ) as result;
    return;
  end if;

  -- Null while the roles are unseeded, which keeps the original rule.
  select roles.runner_id_hash into v_active_runner_hash
  from public.video_studio_runner_roles as roles
  where roles.role = 'active';

  select source_command.* into v_source_command
  from public.video_studio_commands as source_command
  where source_command.id = p_command_id
    and source_command.job_id = p_job_id
  for update;
  if not found then raise exception 'command_not_found' using errcode = 'P0001'; end if;
  if v_source_command.last_lease_owner_hash is not null then
    select pg_catalog.count(*) into v_healthy_runner_count
    from public.video_studio_runner_heartbeats as heartbeat
    where heartbeat.runner_id_hash = v_source_command.last_lease_owner_hash
      and (v_active_runner_hash is null or heartbeat.runner_id_hash = v_active_runner_hash)
      and heartbeat.runner_status = 'idle'
      and heartbeat.drive_state = 'ready'
      and heartbeat.active_command_id is null
      and heartbeat.pending_receipts = 0
      and v_source_command.schema_version = any(heartbeat.command_schema_versions)
      and heartbeat.received_at > v_source_command.completed_at
      and heartbeat.received_at > pg_catalog.now() - interval '2 minutes';
  elsif v_source_command.status = 'attention'
    and v_source_command.safe_code = 'command_expired'
    and v_source_command.attempt_count = 0 then
    select pg_catalog.count(*) into v_healthy_runner_count
    from public.video_studio_runner_heartbeats as heartbeat
    where (v_active_runner_hash is null or heartbeat.runner_id_hash = v_active_runner_hash)
      and heartbeat.runner_status = 'idle'
      and heartbeat.drive_state = 'ready'
      and heartbeat.active_command_id is null
      and heartbeat.pending_receipts = 0
      and v_source_command.schema_version = any(heartbeat.command_schema_versions)
      and heartbeat.received_at > v_source_command.completed_at
      and heartbeat.received_at > pg_catalog.now() - interval '2 minutes';
  else
    v_healthy_runner_count := 0;
  end if;
  if v_healthy_runner_count <> 1 then
    raise exception 'recovery_not_available' using errcode = 'P0001';
  end if;
  return query
  select
    result.duplicate,
    result.recovery_review_id,
    result.recovery_generation,
    result.job_id,
    result.platform,
    result.review_status,
    result.parent_revision_hash,
    result.parent_artifact_hash,
    result.created_at,
    result.binding_command_id,
    result.binding_command_status,
    result.binding_command_created_at
  from public.video_studio_recover_failed_review_without_job_lock(
    p_command_id,
    p_job_id,
    p_platform,
    p_expected_parent_revision_hash,
    p_expected_parent_artifact_hash,
    p_idempotency_key,
    p_submitted_at,
    p_recovery_hash,
    p_recovery_review_id,
    p_runner_payload,
    p_runner_payload_hash,
    p_runner_command_hash
  ) as result;
end;
$$;

alter table public.video_studio_runner_roles enable row level security;
alter table public.video_studio_runner_role_events enable row level security;

revoke all on public.video_studio_runner_roles from public, anon, authenticated, service_role;
revoke all on public.video_studio_runner_role_events from public, anon, authenticated, service_role;

-- Reads only. Every write goes through the security-definer functions below.
grant select on public.video_studio_runner_roles to service_role;
grant select on public.video_studio_runner_role_events to service_role;

create policy video_studio_runner_roles_service_read on public.video_studio_runner_roles
  for select to service_role using (true);
create policy video_studio_runner_role_events_service_read on public.video_studio_runner_role_events
  for select to service_role using (true);

revoke execute on function public.video_studio_runner_roles_guard()
  from public, anon, authenticated, service_role;
revoke execute on function public.video_studio_runner_roles_require_one_active()
  from public, anon, authenticated, service_role;
revoke execute on function public.video_studio_runner_roles_audit()
  from public, anon, authenticated, service_role;
revoke execute on function public.video_studio_runner_lease_standing(text)
  from public, anon, authenticated, service_role;

revoke execute on function public.video_studio_claim_command(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.video_studio_claim_command(text, text, integer)
  to service_role;
revoke execute on function public.video_studio_lease_production_brief(text, uuid, timestamptz, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.video_studio_lease_production_brief(text, uuid, timestamptz, text, jsonb)
  to service_role;
revoke execute on function public.video_studio_switch_active_runner(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.video_studio_switch_active_runner(text, text, text, text)
  to service_role;
revoke execute on function public.video_studio_set_runner_role(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.video_studio_set_runner_role(text, text, text, text)
  to service_role;
revoke execute on function public.video_studio_recover_failed_review(
  uuid, text, text, text, text, uuid, timestamptz, text, uuid, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.video_studio_recover_failed_review(
  uuid, text, text, text, text, uuid, timestamptz, text, uuid, jsonb, text, text
) to service_role;

comment on table public.video_studio_runner_roles is
  'One row per Windows runner hash. At most one active; once seeded exactly one. Only the active runner is leased new commands or briefs. Rows are permanent and retired is terminal.';
comment on table public.video_studio_runner_role_events is
  'Append-only audit of every runner role change: who, why, from and to.';
comment on function public.video_studio_switch_active_runner(text, text, text, text) is
  'Audited operator switch of the active runner. Refuses while the outgoing runner is running or holds work, or the incoming runner is not heartbeating idle and ready.';
comment on function public.video_studio_lease_production_brief(text, uuid, timestamptz, text, jsonb) is
  'Writes one production brief lease under the runner-role fence, compare-and-swap on content_ideas.updated_at.';

commit;
