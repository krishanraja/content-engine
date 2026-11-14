-- One writer at a time, for an engine job that must never run twice at once (2026-11-11).
--
-- The research library's sweep (apps/control-plane/api/_researchLibrary.ts, job research_library_mirror) had no run
-- lock. Five sweeps run by hand on 11 Nov between 18:16 and 18:20 UTC overlapped: each read Drive and the index before
-- the others had written, and each copied the same materials, so the library gained 118 extra Drive copies and 250 extra
-- index rows. Nothing was lost.
--
-- A lease, not a session advisory lock: the engine reaches Postgres through PostgREST, one transaction per call, so a
-- session lock would stay with whichever pooled connection took it and no later call could release it. A lease is a row
-- with an expiry: taken when it is free or has run out, released only by its own holder, and freed by its expiry when a
-- holder dies mid-run. The take is one INSERT ... ON CONFLICT DO UPDATE ... WHERE, which Postgres makes atomic: of two
-- callers at once, exactly one gets the row.
--
--   engine_lease_take(name, holder, seconds)  {"ok": true, ...} or {"ok": false, "error": "held", "holder", "lease_until"}
--   engine_lease_release(name, holder)        true when that holder held it; another holder's lease is never touched
--
-- Additive only: one table and two functions, the server's alone. Re-runnable. Reversible: drop the two functions and
-- the table. Replayed on PGlite by tests/engine-leases-db.mjs on every pull request.

create table if not exists public.engine_leases (
  name text primary key check (name ~ '^[a-z][a-z0-9_.:/-]{1,119}$'),
  holder text not null check (char_length(holder) between 1 and 160),
  taken_at timestamptz not null,
  lease_until timestamptz not null,
  released_at timestamptz
);

alter table public.engine_leases enable row level security;
-- Supabase's default privileges grant every role everything on a new table: the server reads, takes and releases, no more.
revoke all on public.engine_leases from public, anon, authenticated, service_role;
grant select, insert, update on public.engine_leases to service_role;

create or replace function public.engine_lease_take(p_name text, p_holder text, p_seconds integer)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v public.engine_leases%rowtype;
begin
  if coalesce(p_name, '') !~ '^[a-z][a-z0-9_.:/-]{1,119}$' then return jsonb_build_object('ok', false, 'error', 'invalid_name'); end if;
  if char_length(coalesce(p_holder, '')) not between 1 and 160 then return jsonb_build_object('ok', false, 'error', 'invalid_holder'); end if;
  if p_seconds is null or p_seconds not between 1 and 3600 then return jsonb_build_object('ok', false, 'error', 'invalid_seconds'); end if;
  -- Free (never taken, released, or run out) or already this holder's (a renewal): take it. Anything else is held.
  insert into public.engine_leases as l (name, holder, taken_at, lease_until, released_at)
  values (p_name, p_holder, clock_timestamp(), clock_timestamp() + make_interval(secs => p_seconds), null)
  on conflict (name) do update
    set holder = excluded.holder,
        taken_at = case when l.holder = excluded.holder and l.released_at is null then l.taken_at else excluded.taken_at end,
        lease_until = excluded.lease_until,
        released_at = null
    where l.lease_until <= clock_timestamp() or l.released_at is not null or (l.holder = excluded.holder)
  returning * into v;
  if found then
    return jsonb_build_object('ok', true, 'name', v.name, 'holder', v.holder, 'taken_at', v.taken_at, 'lease_until', v.lease_until);
  end if;
  select * into v from public.engine_leases where name = p_name;
  return jsonb_build_object('ok', false, 'error', 'held', 'holder', v.holder, 'taken_at', v.taken_at, 'lease_until', v.lease_until);
end $$;

create or replace function public.engine_lease_release(p_name text, p_holder text)
returns boolean language sql security invoker set search_path = public, pg_temp as $$
  with released as (
    update public.engine_leases
       set released_at = clock_timestamp(), lease_until = least(lease_until, clock_timestamp())
     where name = p_name and holder = p_holder and released_at is null
    returning 1
  )
  select exists (select 1 from released)
$$;

revoke all on function public.engine_lease_take(text, text, integer) from public, anon, authenticated;
revoke all on function public.engine_lease_release(text, text) from public, anon, authenticated;
grant execute on function public.engine_lease_take(text, text, integer) to service_role;
grant execute on function public.engine_lease_release(text, text) to service_role;
