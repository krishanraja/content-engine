-- supabase/migrations/20261023090000_one_closer.sql, applied twice after
-- board-one-closer-setup.sql: every open item says how it ends, and only a
-- check, Krish, or a session on its own work closes one. Every write that
-- must fail is tried and rolled back; every write that must pass is kept.
do $$
declare
  n integer;
  r record;
  refused boolean;
  out jsonb;
begin
  select count(*) into n from pg_constraint
    where conrelid = 'public.work_board_items'::regclass and conname = 'work_board_items_open_says_how_it_ends' and convalidated;
  if n <> 1 then raise exception 'work_board_items_open_says_how_it_ends is missing or not validated'; end if;
  select count(*) into n from pg_trigger where tgrelid = 'public.work_board_items'::regclass and not tgisinternal;
  if n <> 1 then raise exception 'the board has % triggers, not the one closer', n; end if;

  -- What must never be written: an open item that does not say how it ends.
  for r in select * from (values
      ('a take on record with no piece', $q$insert into public.work_board_items (id, lane, title, closes_on) values ('take-0123456789cd', 'in_progress', 'x', 'record')$q$),
      ('a post question with no kind', $q$insert into public.work_board_items (id, lane, title, link) values ('post-9002', 'in_progress', 'x', 'https://example.com/p/b')$q$),
      ('an edit that drops the kind', $q$update public.work_board_items set closes_on = null where id = 'closer-session-a'$q$),
      ('a share image with no image', $q$update public.work_board_items set close_ref = '{"url": "https://example.com/p/a-post"}' where id = 'closer-image'$q$),
      ('a reopen with no kind', $q$update public.work_board_items set lane = 'in_progress' where id = 'old-note'$q$)
    ) as t(what, stmt) loop
    refused := false;
    begin
      execute r.stmt;
    exception when check_violation then refused := true;
    end;
    if not refused then raise exception 'an open item that does not say how it ends went in: %', r.what; end if;
  end loop;

  -- What must never close an item.
  for r in select * from (values
      ('an engine closer', $q$update public.work_board_items set lane = 'done', closed_by = 'engine: test' where id = 'closer-record'$q$),
      ('a session on a check''s item', $q$update public.work_board_items set lane = 'done', closed_by = 'claude_code' where id = 'closer-record'$q$),
      ('a session archiving a check''s item', $q$update public.work_board_items set lane = 'archived', closed_by = 'codex' where id = 'closer-image'$q$),
      ('a session on his_word', $q$update public.work_board_items set lane = 'done', closed_by = 'claude_code' where id = 'closer-word'$q$),
      ('a check with no proof', $q$update public.work_board_items set lane = 'done', closed_by = 'check: x', closed_proof = null where id = 'closer-record'$q$),
      ('a Control Center job', $q$update public.work_board_items set lane = 'done', closed_by = 'control_center' where id = 'closer-publish'$q$),
      ('nobody', $q$update public.work_board_items set lane = 'done', closed_by = null where id = 'closer-publish'$q$),
      ('a Control Center job on session work', $q$update public.work_board_items set lane = 'done', closed_by = 'control_center' where id = 'closer-session-a'$q$),
      ('a tool on session work', $q$update public.work_board_items set lane = 'archived', closed_by = 'engine: no session took it' where id = 'closer-session-a'$q$)
    ) as t(what, stmt) loop
    refused := false;
    begin
      execute r.stmt;
    exception when raise_exception then
      refused := sqlerrm like 'check_closes_it:%';
    end;
    if not refused then raise exception 'a close that must be refused went through: %', r.what; end if;
  end loop;
  select count(*) into n from public.work_board_items
    where id in ('closer-record', 'closer-publish', 'closer-image', 'closer-word', 'closer-session-a') and lane not in ('on_you', 'in_progress');
  if n <> 0 then raise exception 'a refused close moved an item'; end if;

  -- What may close one.
  update public.work_board_items set lane = 'done', closed_by = 'check: record', closed_proof = 'The record step landed, 14 Oct 10:14 AM.' where id = 'closer-record';
  update public.work_board_items set lane = 'done', closed_by = 'Krish' where id = 'closer-word';
  update public.work_board_items set lane = 'done', closed_by = 'codex' where id = 'closer-session-a';
  update public.work_board_items set lane = 'archived', closed_by = 'claude_ai' where id = 'closer-session-b';
  update public.work_board_items set lane = 'archived', closed_by = 'check: share_image_changed', closed_proof = 'The post now shows a new share image.' where id = 'closer-image';
  select count(*) into n from public.work_board_items
    where id in ('closer-record', 'closer-word', 'closer-session-a', 'closer-session-b', 'closer-image') and lane in ('done', 'archived');
  if n <> 5 then raise exception 'an allowed close was refused: % of 5', n; end if;
  -- A move between closed lanes, and a reopen (his Undo), are not closes.
  update public.work_board_items set lane = 'archived', closed_by = 'claude_code' where id = 'closer-word';
  update public.work_board_items set lane = 'on_you', closed_by = null, closed_proof = null where id = 'closer-record';
  select count(*) into n from public.work_board_items where id = 'closer-record' and lane = 'on_you';
  if n <> 1 then raise exception 'his Undo did not reopen the item'; end if;
  -- Edits that leave the lane alone pass whoever writes them.
  update public.work_board_items set detail = 'Edited.', closed_by = 'claude_code' where id = 'closer-publish';

  -- The stale archive spares pieces in the making, and still buries an idle seed.
  out := public.archive_stale_content_ideas(3, false);
  select count(*) into n from public.content_ideas
    where id in ('6b3c0a51-2f0e-4d8a-9c41-7e2d5b9a0c21', '6b3c0a51-2f0e-4d8a-9c41-7e2d5b9a0c22', '6b3c0a51-2f0e-4d8a-9c41-7e2d5b9a0c23') and buried_at is not null;
  if n <> 0 then raise exception 'the stale archive buried % pieces in the making', n; end if;
  select count(*) into n from public.content_ideas where id = '6b3c0a51-2f0e-4d8a-9c41-7e2d5b9a0c24' and buried_reason like 'stale:%';
  if n <> 1 then raise exception 'the stale archive no longer buries an idle seed: %', out; end if;
end $$;
