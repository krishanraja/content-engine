-- Board items say how a check can see them finished, and keep its proof.
--
-- Krish, 2026-10-11: "I think closing what you can check is already done is
-- one of the most obvious things I've ever heard of as a suggestion." And:
-- "I am happy to Clear(complete)/Bump/Purge things off my lists as I go but
-- the rest should be automatically done." Step 4 of his operating system is
-- one done-check sweep (Control Center's api/_doneChecks.ts). This migration
-- is its first, additive half; it goes in before the engine code that writes
-- the new columns (apps/control-plane/api/workbench.ts).
--
-- close_ref     what the item's check needs beyond its kind, as an object:
--               share_image_changed {url, was}, job_ok {job, after, probe?},
--               post_matched {url}. Empty for every other kind.
-- closed_proof  the words a check closed it with ("The record step landed,
--               14 Oct 10:14 AM."), or His words: "<said>" for a close a
--               session relayed from him. At most 300 characters.
-- closes_on     gains the kinds that are not a piece's step:
--               week_published   the week's publish board item;
--               share_image_changed  a post's share image is replaced;
--               job_ok           an engine job runs clean after a time;
--               post_matched     a post the watcher could not match;
--               take_placed      a take the recordings lane could not place;
--               session          work a session holds and closes itself;
--               his_word         nothing can see it; only his Clear ends it.
-- board_close_ref_ok(kind, ref, idea_id, id)
--               whether an item carries what its kind needs. Nothing binds
--               it yet; the on_you rule uses it in the next migration
--               (20261022091000_on_you_closes_itself.sql).
--
-- Additive and safe to run again: every row there today passes.

alter table public.work_board_items
  add column if not exists close_ref jsonb not null default '{}'::jsonb,
  add column if not exists closed_proof text;

do $$ begin
  alter table public.work_board_items
    add constraint work_board_items_closed_proof_check
    check (closed_proof is null or char_length(closed_proof) <= 300);
exception when duplicate_object then null; end $$;

alter table public.work_board_items drop constraint if exists work_board_items_closes_on_check;
alter table public.work_board_items
  add constraint work_board_items_closes_on_check
  check (closes_on is null or closes_on in (
    'workroom','draft','visual_gate','scripts','pack','record','video','publish','published',
    'week_planned','week_published','share_image_changed','job_ok','post_matched','take_placed','session','his_word'));

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
    when k in ('session','his_word') then true
    else false end $$;
