-- A late row of Control Center's week clock reaches Krish's list.
--
-- Krish, 2026-10-29: "yes to 4". Control Center keeps the clock of each week
-- (CLOCK_ROWS in its src/lib/weekClock.ts). When a row is late its tick
-- writes one board item clock-<Monday>-<row>, on him, closing on clock with
-- close_ref {"week": its Monday, "row": the row}, and the row's own done
-- check closes it. Without this kind the route and this table refused that
-- write (board_refused), so no late row could ever reach his list.
--
-- 1. An item id may hold an underscore: the rows are snake_case
--    (week_picked), so the id is clock-2026-11-16-week_picked. The id check
--    from 20261003130000_work_board.sql is replaced, whatever it is named.
-- 2. work_board_items_closes_on_check gains clock.
-- 3. board_close_ref_ok: clock needs a dated week, a row name, and the id
--    clock-<week>-<row>. The same rule as closeRefOk in
--    apps/control-plane/api/workbench.ts.
--
-- Safe to run again: the constraint is dropped and added the same way, and
-- the function is replaced. Every row that passes today passes after.

do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.work_board_items'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%a-z0-9-]{1,79}%'
  loop
    execute format('alter table public.work_board_items drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.work_board_items drop constraint if exists work_board_items_id_format;
alter table public.work_board_items
  add constraint work_board_items_id_format check (id ~ '^[a-z0-9][a-z0-9_-]{1,79}$');

alter table public.work_board_items drop constraint if exists work_board_items_closes_on_check;
alter table public.work_board_items
  add constraint work_board_items_closes_on_check
  check (closes_on is null or closes_on in (
    'workroom','draft','visual_gate','scripts','pack','record','video','publish','published',
    'week_planned','week_published','share_image_changed','job_ok','post_matched','take_placed','target_decided','clock','session','his_word'));

create or replace function public.board_close_ref_ok(k text, ref jsonb, idea uuid, item_id text)
returns boolean language sql immutable as $$
  select case
    when k in ('workroom','draft','visual_gate','scripts','pack','record','video','publish','published') then idea is not null
    when k = 'week_planned'        then item_id ~ '^week-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    when k = 'week_published'      then item_id ~ '^week-publish-board-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    when k = 'share_image_changed' then coalesce(ref->>'url', '') ~ '^https://' and coalesce(ref->>'was', '') <> ''
    when k = 'job_ok'              then coalesce(ref->>'job', '') <> '' and coalesce(ref->>'after', '') <> ''
    when k = 'post_matched'        then coalesce(ref->>'url', '') ~ '^https://'
    when k = 'take_placed'         then item_id ~ '^take-[0-9a-f]{12}$'
    when k = 'target_decided'      then coalesce(ref->>'target_id', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    when k = 'clock'               then coalesce(ref->>'week', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                                    and coalesce(ref->>'row', '') ~ '^[a-z][a-z_]{1,39}$'
                                    and item_id = 'clock-' || (ref->>'week') || '-' || (ref->>'row')
    when k in ('session','his_word') then true
    else false end $$;
