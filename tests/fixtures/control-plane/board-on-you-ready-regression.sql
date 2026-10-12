-- supabase/migrations/20261013090000_board_on_you_is_ready.sql, applied
-- twice after board-on-you-ready-setup.sql: the ready rows stay on Krish,
-- the rest are held in progress with their reason said once, and from then
-- on no writer can put an item on him that is not ready.
do $$
declare
  r record;
  n integer;
  prefix text := 'Held from Krish''s list on ' || to_char(now() at time zone 'America/New_York', 'FMDD FMMonth')
    || ': it does not say how the system will know it is done.';
begin
  -- The constraint is there and validated.
  select count(*) into n from pg_constraint
    where conrelid = 'public.work_board_items'::regclass and conname = 'work_board_items_on_you_is_ready' and convalidated;
  if n <> 1 then raise exception 'work_board_items_on_you_is_ready is missing or not validated'; end if;

  -- The ready rows are untouched.
  for r in select * from public.work_board_items where id in ('monday-record', 'friday-record', 'week-2026-10-19') loop
    if r.lane <> 'on_you' or r.updated_by = 'control_center' or r.detail like 'Held from%' then
      raise exception 'a ready row was moved: % (% by %)', r.id, r.lane, r.updated_by;
    end if;
  end loop;

  -- The rest are held in progress, by control_center, the reason said once before what they said.
  for r in select * from public.work_board_items where id in ('you-launch-today', 'you-engine-github-key', 'you-welcome-days', 'take-aaaaaaaaaaaa') loop
    if r.lane <> 'in_progress' or r.updated_by <> 'control_center' then
      raise exception 'a row that is not ready was left on him: % (% by %)', r.id, r.lane, r.updated_by;
    end if;
    if left(r.detail, length(prefix)) <> prefix then
      raise exception 'the held row does not say why: % (%)', r.id, left(r.detail, 120);
    end if;
    if (length(r.detail) - length(replace(r.detail, 'Held from Krish''s list', ''))) <> length('Held from Krish''s list') then
      raise exception 'the reason was written more than once on %', r.id;
    end if;
    if length(r.detail) > 2000 then raise exception 'the held detail is over 2,000 characters on %', r.id; end if;
  end loop;
  select detail into r from public.work_board_items where id = 'you-launch-today';
  if r.detail <> prefix || ' Article 1 is done: checked 11 October.' then
    raise exception 'the held detail lost what it said: %', r.detail;
  end if;
  select detail into r from public.work_board_items where id = 'you-welcome-days';
  if r.detail <> prefix then raise exception 'an empty detail gained more than the reason: "%"', r.detail; end if;

  -- Not on him: untouched.
  select count(*) into n from public.work_board_items
    where (id = 'doing-build' and lane = 'in_progress' and updated_by = 'codex') or (id = 'old-note' and lane = 'done' and updated_by = 'Krish');
  if n <> 2 then raise exception 'a row that was not on him was changed'; end if;

  -- From now on: an item put on him that is not ready is refused, by any writer.
  begin
    insert into public.work_board_items (id, lane, title, only_you, link) values ('post-901', 'on_you', 'Which piece is this post?', null, 'https://home.makeyourmindup.ai/p/x');
    raise exception 'an item with no reason and no close was put on him';
  exception when check_violation then null; end;
  begin
    update public.work_board_items set lane = 'on_you' where id = 'you-welcome-days';
    raise exception 'a held row was moved back on him without a link or a close';
  exception when check_violation then null; end;
  begin
    update public.work_board_items set link = null where id = 'monday-record';
    raise exception 'an edit stripped the link from an item on him';
  exception when check_violation then null; end;
  begin
    update public.work_board_items set closes_on = 'video', idea_id = null where id = 'friday-record';
    raise exception 'an item on him lost its piece and kept a step close';
  exception when check_violation then null; end;

  -- A ready write passes, an item held in progress can be edited, and one that is not on him needs nothing.
  insert into public.work_board_items (id, lane, title, only_you, link, closes_on, idea_id)
    values ('take-bbbbbbbbbbbb', 'on_you', 'Which cut is this take?', 'judgment', 'https://controlcenter.krishraja.com/#/content?idea=f328382d-71b3-41a7-a221-d8615826f12e', 'record', 'f328382d-71b3-41a7-a221-d8615826f12e');
  update public.work_board_items set detail = detail || ' Nothing can see it done yet.' where id = 'you-welcome-days';
  insert into public.work_board_items (id, lane, title) values ('post-902', 'in_progress', 'Which piece is this post?');
  update public.work_board_items set lane = 'done' where id = 'monday-record';

  -- Deleting a piece empties the idea_id of the items about it (on delete set
  -- null), so one still on him stops the delete: the purge archives it first.
  begin
    delete from public.content_ideas where id = '904658db-4df2-4537-a0ed-ebe93e081db7';
    raise exception 'a piece was deleted from under an item on him';
  exception when check_violation then null; end;
  update public.work_board_items set lane = 'archived' where id = 'friday-record';
  delete from public.content_ideas where id = '904658db-4df2-4537-a0ed-ebe93e081db7';
  select count(*) into n from public.work_board_items where id = 'friday-record' and idea_id is null and lane = 'archived';
  if n <> 1 then raise exception 'the archived item did not let go of its deleted piece'; end if;
end $$;
