\set ON_ERROR_STOP on

-- The active runner claims, then holds its transaction open. Its claim holds
-- the active role row FOR SHARE until commit; the advisory lock is only the
-- harness's signal that the claim has happened.

begin;
do $claim$
begin
  if not exists (
    select 1 from public.video_studio_claim_command(repeat('a', 64), repeat('c', 64), 30)
  ) then
    raise exception 'race: the active runner must be leased the queued command';
  end if;
end;
$claim$;
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('video-studio-runner-roles-race-marker', 0));
select pg_catalog.pg_sleep(2);
commit;
