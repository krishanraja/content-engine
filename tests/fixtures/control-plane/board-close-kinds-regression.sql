-- supabase/migrations/20261022090000_board_close_columns.sql and
-- 20261022091000_on_you_closes_itself.sql, each applied twice around
-- board-close-kinds-setup.sql: every kind is allowed, an item on Krish
-- carries what its kind needs, and the kinds a session or a machine holds
-- never reach him. Every write that must fail is tried and rolled back.
do $$
declare
  n integer;
  r record;
  refused boolean;
begin
  select count(*) into n from information_schema.columns
    where table_schema = 'public' and table_name = 'work_board_items' and column_name in ('close_ref', 'closed_proof');
  if n <> 2 then raise exception 'close_ref and closed_proof are missing: % of 2', n; end if;
  select count(*) into n from pg_constraint
    where conrelid = 'public.work_board_items'::regclass and conname in ('work_board_items_on_you_is_ready', 'work_board_items_closes_on_check', 'work_board_items_closed_proof_check') and convalidated;
  if n <> 3 then raise exception 'a constraint is missing or not validated: % of 3', n; end if;

  -- The rule, kind by kind.
  for r in select * from (values
      ('record', '{}'::jsonb, 'f328382d-71b3-41a7-a221-d8615826f12e'::uuid, 'x-record', true),
      ('published', '{}'::jsonb, null::uuid, 'x-post', false),
      ('week_planned', '{}'::jsonb, null::uuid, 'week-2026-10-19', true),
      ('week_planned', '{}'::jsonb, null::uuid, 'plan-week-oct-19', false),
      ('week_published', '{}'::jsonb, null::uuid, 'week-publish-board-2026-10-19', true),
      ('week_published', '{}'::jsonb, null::uuid, 'week-2026-10-19', false),
      ('share_image_changed', '{"url": "https://example.substack.com/p/a", "was": "f"}'::jsonb, null::uuid, 'x', true),
      ('share_image_changed', '{"url": "https://example.substack.com/p/a"}'::jsonb, null::uuid, 'x', false),
      ('share_image_changed', '{"url": "http://plain/p", "was": "f"}'::jsonb, null::uuid, 'x', false),
      ('job_ok', '{"job": "build_signals", "after": "2026-10-22T09:30:00Z"}'::jsonb, null::uuid, 'x', true),
      ('job_ok', '{"job": "build_signals"}'::jsonb, null::uuid, 'x', false),
      ('post_matched', '{"url": "https://example.substack.com/p/a"}'::jsonb, null::uuid, 'post-1', true),
      ('post_matched', '{}'::jsonb, null::uuid, 'post-1', false),
      ('take_placed', '{}'::jsonb, null::uuid, 'take-0123456789ab', true),
      ('take_placed', '{}'::jsonb, null::uuid, 'take-NOTHEX', false),
      ('session', '{}'::jsonb, null::uuid, 'x', true),
      ('his_word', '{}'::jsonb, null::uuid, 'x', true),
      ('someday', '{}'::jsonb, null::uuid, 'x', false)
    ) as t(k, ref, idea, item_id, ok) loop
    if public.board_close_ref_ok(r.k, r.ref, r.idea, r.item_id) is distinct from r.ok then
      raise exception 'board_close_ref_ok(%, %, %, %) is not %', r.k, r.ref, r.idea, r.item_id, r.ok;
    end if;
  end loop;

  -- Ready check kinds go on him.
  update public.work_board_items set lane = 'on_you' where id in ('kinds-share-image', 'kinds-key', 'week-publish-board-2026-10-19', 'kinds-welcome');
  get diagnostics n = row_count;
  if n <> 4 then raise exception 'the ready check kinds did not all reach him: % of 4', n; end if;
  update public.work_board_items set lane = 'in_progress' where id in ('kinds-share-image', 'kinds-key', 'week-publish-board-2026-10-19', 'kinds-welcome');

  -- What must never be on him, or never be written at all.
  for r in select * from (values
      ('kinds-session', $q$update public.work_board_items set lane = 'on_you', only_you = 'judgment', link = 'https://example.com/x' where id = 'kinds-session'$q$),
      ('post-9001', $q$update public.work_board_items set lane = 'on_you', only_you = 'judgment' where id = 'post-9001'$q$),
      ('take-0123456789ab', $q$update public.work_board_items set lane = 'on_you', only_you = 'judgment', link = 'https://example.com/x' where id = 'take-0123456789ab'$q$),
      ('kinds-share-image', $q$update public.work_board_items set lane = 'on_you', close_ref = '{"url": "https://example.substack.com/p/a-post"}' where id = 'kinds-share-image'$q$),
      ('kinds-key', $q$update public.work_board_items set lane = 'on_you', close_ref = '{}' where id = 'kinds-key'$q$),
      ('week-wrong', $q$insert into public.work_board_items (id, lane, title, only_you, link, closes_on) values ('week-2026-10-26', 'on_you', 'x', 'post', 'https://example.com/x', 'week_published')$q$),
      ('kinds-bogus', $q$update public.work_board_items set closes_on = 'someday' where id = 'kinds-session'$q$),
      ('kinds-proof', $q$update public.work_board_items set closed_proof = repeat('x', 301) where id = 'kinds-closed'$q$)
    ) as t(what, stmt) loop
    refused := false;
    begin
      execute r.stmt;
    exception when check_violation then refused := true;
    end;
    if not refused then raise exception 'a write that must be refused went through: %', r.what; end if;
  end loop;

  -- Nothing moved.
  select count(*) into n from public.work_board_items where lane = 'on_you' and id in ('kinds-session', 'post-9001', 'take-0123456789ab', 'kinds-share-image', 'kinds-key');
  if n <> 0 then raise exception 'a refused row is on him'; end if;
  -- The ready rows from board-on-you-ready-setup.sql still on him pass the new rule
  -- (board-on-you-ready-regression.sql closed the two recordings and added take-bbbbbbbbbbbb).
  select count(*) into n from public.work_board_items where lane = 'on_you' and id in ('take-bbbbbbbbbbbb', 'week-2026-10-19');
  if n <> 2 then raise exception 'the ready rows left him: % of 2', n; end if;
end $$;
