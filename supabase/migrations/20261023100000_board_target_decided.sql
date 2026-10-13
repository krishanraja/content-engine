-- A podcast or stage worth taking closes when Krish decides it.
--
-- Krish, 2026-10-13: "I should probably be able to say I want to get more
-- visibility and it brings me podcasts to pitch". Control Center's visibility
-- scorer (api/_visibilityTake.ts there) puts a target judged worth taking on
-- his list as one board item that closes on target_decided, with close_ref
-- {"target_id": the visibility target's uuid}. Its done-check sweep closes it
-- when he applies, and lets it go when the target is rejected or put away.
-- Without this kind the route and this table refused that write, so no
-- podcast could ever reach his list.
--
-- 1. work_board_items_closes_on_check gains target_decided.
-- 2. board_close_ref_ok: target_decided needs a uuid target_id. The same rule
--    as closeRefOk in apps/control-plane/api/workbench.ts.
--
-- Safe to run again: the constraint is dropped and added the same way, and
-- the function is replaced. Every row that passes today passes after.

alter table public.work_board_items drop constraint if exists work_board_items_closes_on_check;
alter table public.work_board_items
  add constraint work_board_items_closes_on_check
  check (closes_on is null or closes_on in (
    'workroom','draft','visual_gate','scripts','pack','record','video','publish','published',
    'week_planned','week_published','share_image_changed','job_ok','post_matched','take_placed','target_decided','session','his_word'));

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
    when k in ('session','his_word') then true
    else false end $$;
