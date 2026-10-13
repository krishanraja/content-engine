-- After 20261023100000_board_target_decided.sql: a podcast item closing on
-- target_decided is allowed with a uuid target_id, refused without one, and
-- every other kind keeps its rule. Synthetic rows only.
do $$
begin
  if not public.board_close_ref_ok('target_decided', '{"target_id":"0a1b2c3d-1111-4222-8333-444455556666"}'::jsonb, null, 'visibility-take-x') then
    raise exception 'target_decided with a uuid target_id must pass';
  end if;
  if public.board_close_ref_ok('target_decided', '{"target_id":"not-a-uuid"}'::jsonb, null, 'visibility-take-x') then
    raise exception 'target_decided with a bad target_id must fail';
  end if;
  if public.board_close_ref_ok('target_decided', '{}'::jsonb, null, 'visibility-take-x') then
    raise exception 'target_decided with no target_id must fail';
  end if;
  if not public.board_close_ref_ok('job_ok', '{"job":"build_signals","after":"2026-10-22T09:00:00Z"}'::jsonb, null, 'you-key') then
    raise exception 'job_ok must keep its rule';
  end if;
end $$;

-- The closes_on CHECK takes the new kind.
insert into public.work_board_items (id, lane, title, closes_on, close_ref, only_you, link, updated_by)
values ('visibility-take-ci', 'in_progress', 'A podcast worth your time: Synthetic Show', 'target_decided',
        '{"target_id":"0a1b2c3d-1111-4222-8333-444455556666"}'::jsonb, 'judgment', 'https://example.test/#/people', 'visibility_score');
delete from public.work_board_items where id = 'visibility-take-ci';
