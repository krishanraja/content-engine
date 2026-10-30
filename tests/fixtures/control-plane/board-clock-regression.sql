-- After 20261119090000_board_clock_kind.sql: a late week-clock row closing on
-- clock is allowed when its id is clock-<week>-<row> and close_ref names the
-- week and row, refused otherwise, the id may hold an underscore, and every
-- other kind keeps its rule. Synthetic rows only.
do $$
declare refused boolean;
begin
  if not public.board_close_ref_ok('clock', '{"week":"2026-11-16","row":"week_picked"}'::jsonb, null, 'clock-2026-11-16-week_picked') then
    raise exception 'clock with its week, row and id must pass';
  end if;
  if public.board_close_ref_ok('clock', '{"week":"2026-11-16","row":"week_picked"}'::jsonb, null, 'clock-2026-11-09-week_picked') then
    raise exception 'clock whose id names another week must fail';
  end if;
  if public.board_close_ref_ok('clock', '{"week":"2026-11-16"}'::jsonb, null, 'clock-2026-11-16-') then
    raise exception 'clock with no row must fail';
  end if;
  if not public.board_close_ref_ok('target_decided', '{"target_id":"0a1b2c3d-1111-4222-8333-444455556666"}'::jsonb, null, 'visibility-take-x') then
    raise exception 'target_decided must keep its rule';
  end if;
  refused := false;
  begin
    insert into public.work_board_items (id, lane, title, closes_on, updated_by)
    values ('Bad_Upper', 'in_progress', 'x', 'session', 'ci');
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'an upper-case id must still be refused'; end if;
end $$;

-- The closes_on CHECK and the id check take Control Center's clock item.
insert into public.work_board_items (id, lane, title, closes_on, close_ref, only_you, link, updated_by)
values ('clock-2026-11-16-week_picked', 'in_progress', 'Your picks on the Ideas tab is late', 'clock',
        '{"week":"2026-11-16","row":"week_picked"}'::jsonb, 'judgment', 'https://example.test/#/week', 'control_center');
delete from public.work_board_items where id = 'clock-2026-11-16-week_picked';
