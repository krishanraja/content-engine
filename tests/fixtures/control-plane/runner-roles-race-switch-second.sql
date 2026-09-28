\set ON_ERROR_STOP on

-- Starts while the claim above is still open. The switch must wait for it and
-- then refuse, because the outgoing runner now holds a lease. Without the
-- role-row lock it would read the command as still queued and switch.

do $switch$
begin
  perform * from public.video_studio_switch_active_runner(
    repeat('b', 64), repeat('a', 64), 'operator:' || repeat('e', 64), 'Race fixture: switch while a claim is open.'
  );
  raise exception 'race: the switch went through while the outgoing runner was taking a lease';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'active_runner_holds_work' then raise; end if;
end;
$switch$;
