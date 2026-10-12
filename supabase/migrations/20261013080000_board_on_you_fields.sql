-- Board items say why only Krish can do them, and can be bumped to tomorrow.
--
-- Krish, 2026-10-11, on what waits on him: one list, with Clear, Bump and
-- Purge on every item, holding only what he alone can do, what is prepared,
-- and what says how it closes itself. Control Center builds that list from
-- these rows (its api/_waiting.ts) and writes his verbs back through
-- /api/workbench.
--
-- only_you      why only Krish can do it: send, post, spend, delete,
--               permission, credential (only he changes a key), face (his
--               face and voice), login (his login), or judgment (his call).
--               Null on items that are not waiting on him.
-- bumped_until  set by his Bump: the item stays off his list until this
--               time, the start of his next day. Null when not bumped.
-- closes_on     gains 'week_planned': the week's planning item, which
--               Control Center's slate closes once every day has a piece.
--
-- Idempotent; additive. The closes_on CHECK is dropped and added again with
-- the one new value, so every live row still passes it.

alter table public.work_board_items
  add column if not exists only_you text,
  add column if not exists bumped_until timestamptz;

do $$ begin
  alter table public.work_board_items
    add constraint work_board_items_only_you_check
    check (only_you is null or only_you in ('send','post','spend','delete','permission','credential','face','login','judgment'));
exception when duplicate_object then null; end $$;

alter table public.work_board_items drop constraint if exists work_board_items_closes_on_check;
alter table public.work_board_items
  add constraint work_board_items_closes_on_check
  check (closes_on is null or closes_on in ('workroom','draft','visual_gate','scripts','pack','record','video','publish','published','week_planned'));
