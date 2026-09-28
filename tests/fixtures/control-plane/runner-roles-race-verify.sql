\set ON_ERROR_STOP on

do $verify$
begin
  if (select role from public.video_studio_runner_roles where runner_id_hash = repeat('a', 64)) <> 'active'
    or (select role from public.video_studio_runner_roles where runner_id_hash = repeat('b', 64)) <> 'standby' then
    raise exception 'race: the refused switch must leave A active and B standby';
  end if;
  if (select status from public.video_studio_commands where id = '76000000-0000-4000-8000-000000000001') <> 'leased'
    or (select lease_owner_hash from public.video_studio_commands where id = '76000000-0000-4000-8000-000000000001') <> repeat('a', 64) then
    raise exception 'race: the command must be leased to the active runner that claimed it';
  end if;
end;
$verify$;
